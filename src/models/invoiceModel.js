const db = require('../config/database');

const SORT_COLS = { user_name: 'u.name', num_items: 'num_items', total: 'i.total', created_at: 'i.created_at' };

const InvoiceModel = {
  async count(search) {
    const searchCond   = search ? 'AND (u.name LIKE ? OR u.phone LIKE ?)' : '';
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total
       FROM invoices i JOIN users u ON i.user_id = u.id
       WHERE 1=1 ${searchCond}`,
      searchParams
    );
    return Number(total);
  },

  async list(search, sortBy, sortDir, limit, offset) {
    const orderCol     = SORT_COLS[sortBy] || 'i.created_at';
    const orderDir     = sortDir === 'ASC' ? 'ASC' : 'DESC';
    const searchCond   = search ? 'AND (u.name LIKE ? OR u.phone LIKE ?)' : '';
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];
    const [rows] = await db.query(
      `SELECT i.id, i.total, i.created_at,
              u.name  AS user_name,
              u.phone AS user_phone,
              COUNT(ii.id) AS num_items
       FROM   invoices i
       JOIN   users u ON i.user_id = u.id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE  1=1 ${searchCond}
       GROUP  BY i.id
       ORDER  BY ${orderCol} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...searchParams, limit, offset]
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query(
      `SELECT i.id, i.total, i.created_at,
              u.name AS user_name, u.phone AS user_phone
       FROM invoices i
       JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [id]
    );
    return row || null;
  },

  async findItemsByInvoiceId(invoiceId) {
    const [rows] = await db.query(
      `SELECT product_name, price, quantity FROM invoice_items WHERE invoice_id = ?`,
      [invoiceId]
    );
    return rows;
  },

  async findByUserId(userId) {
    const [rows] = await db.query(
      `SELECT i.id, i.total, i.created_at,
              COUNT(ii.id) AS num_items
       FROM   invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE  i.user_id = ?
       GROUP  BY i.id
       ORDER  BY i.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async create(conn, userId, total) {
    const [result] = await conn.query(
      `INSERT INTO invoices (user_id, total) VALUES (?, ?)`,
      [userId, total]
    );
    return result.insertId;
  },

  async createItem(conn, invoiceId, productId, name, price, quantity) {
    await conn.query(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)`,
      [invoiceId, productId, name, price, quantity]
    );
  },

  getConnection() {
    return db.getConnection();
  },
};

module.exports = InvoiceModel;
