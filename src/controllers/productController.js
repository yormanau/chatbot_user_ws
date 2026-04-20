const ProductModel = require('../models/productModel');
const { toStr } = require('../middleware/auth');

async function list(req, res) {
  const { search = '', page = 1, limit = 25, sortBy = 'times_sold', sortDir = 'DESC' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const total = await ProductModel.count(search);
    const rows  = await ProductModel.list(search, sortBy, sortDir, Number(limit), offset);

    res.json({
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
      data: rows.map(r => ({
        id:            r.id,
        name:          toStr(r.name),
        times_sold:    Number(r.times_sold),
        avg_price:     r.avg_price != null ? Number(r.avg_price) : null,
        total_revenue: Number(r.total_revenue),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function search(req, res) {
  const { q = '' } = req.query;
  if (!q.trim()) return res.json([]);
  try {
    const rows = await ProductModel.search(q);
    res.json(rows.map(r => ({ id: r.id, name: toStr(r.name) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, search };
