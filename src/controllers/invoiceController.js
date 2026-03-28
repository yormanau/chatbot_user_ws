const InvoiceModel  = require('../models/invoiceModel');
const ProductModel  = require('../models/productModel');
const { normalizeNames } = require('../utils/normalizeNames');
const { toStr } = require('../middleware/auth');

async function list(req, res) {
  const { page = 1, limit = 10, search = '', sortBy = 'created_at', sortDir = 'DESC' } = req.query;
  const validLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const validPage  = Math.max(1, Number(page));
  const offset     = (validPage - 1) * validLimit;

  try {
    const total = await InvoiceModel.count(search);
    const rows  = await InvoiceModel.list(search, sortBy, sortDir, validLimit, offset);

    res.json({
      data: rows.map(r => ({
        id:         r.id,
        user_name:  normalizeNames(toStr(r.user_name)),
        user_phone: toStr(r.user_phone),
        total:      Number(r.total),
        num_items:  Number(r.num_items),
        created_at: r.created_at,
      })),
      total,
      page:       validPage,
      limit:      validLimit,
      totalPages: Math.ceil(total / validLimit),
    });
  } catch (err) {
    console.error('[invoices] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getById(req, res) {
  const invoiceId = Number(req.params.id);
  try {
    const inv = await InvoiceModel.findById(invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });

    const items = await InvoiceModel.findItemsByInvoiceId(invoiceId);

    res.json({
      ...inv,
      total:      Number(inv.total),
      user_name:  normalizeNames(toStr(inv.user_name)),
      user_phone: toStr(inv.user_phone),
      items: items.map(i => ({
        product_name: toStr(i.product_name),
        price:        Number(i.price),
        quantity:     Number(i.quantity),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  const { user_id, items } = req.body;

  if (!user_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const total = items.reduce((sum, i) => sum + (Number(i.price) * (Number(i.quantity) || 1)), 0);
  const conn  = await InvoiceModel.getConnection();

  try {
    await conn.beginTransaction();

    const invoiceId = await InvoiceModel.create(conn, user_id, total);

    for (const item of items) {
      const name      = item.name.trim();
      const price     = Number(item.price);
      const quantity  = Number(item.quantity) || 1;
      const productId = await ProductModel.upsert(conn, name);
      await InvoiceModel.createItem(conn, invoiceId, productId, name, price, quantity);
    }

    await conn.commit();

    const { io } = require('../index.js');
    io.emit('invoice-created', { total });

    res.json({ ok: true, invoice_id: invoiceId, total });
  } catch (err) {
    await conn.rollback();
    console.error('[invoices] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}

async function getByUser(req, res) {
  const userId = Number(req.params.id);
  try {
    const invoices = await InvoiceModel.findByUserId(userId);

    const result = await Promise.all(invoices.map(async (inv) => {
      const items = await InvoiceModel.findItemsByInvoiceId(inv.id);
      return {
        ...inv,
        items: items.map(i => ({
          product_name: toStr(i.product_name),
          price:        Number(i.price),
          quantity:     Number(i.quantity),
        })),
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('[users/invoices] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, getById, create, getByUser };
