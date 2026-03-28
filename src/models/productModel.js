const db = require('../config/database');

const SORT_COLS = { name: 'p.name', times_sold: 'times_sold', avg_price: 'avg_price', total_revenue: 'total_revenue' };

const ProductModel = {
  async count(search) {
    const where  = search.trim() ? 'WHERE p.name LIKE ?' : '';
    const params = search.trim() ? [`%${search.trim()}%`] : [];
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total FROM products p ${where}`,
      params
    );
    return Number(total);
  },

  async list(search, sortBy, sortDir, limit, offset) {
    const orderCol = SORT_COLS[sortBy] || 'times_sold';
    const orderDir = sortDir === 'ASC' ? 'ASC' : 'DESC';
    const where    = search.trim() ? 'WHERE p.name LIKE ?' : '';
    const params   = search.trim() ? [`%${search.trim()}%`] : [];
    const [rows] = await db.query(
      `SELECT
         p.id,
         p.name,
         COUNT(ii.id)                             AS times_sold,
         AVG(ii.price)                            AS avg_price,
         COALESCE(SUM(ii.price * ii.quantity), 0) AS total_revenue
       FROM products p
       LEFT JOIN invoice_items ii ON ii.product_id = p.id
       ${where}
       GROUP BY p.id, p.name
       ORDER BY ${orderCol} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  },

  async search(q) {
    const [rows] = await db.query(
      `SELECT id, name FROM products WHERE name LIKE ? ORDER BY name ASC LIMIT 8`,
      [`%${q}%`]
    );
    return rows;
  },

  async upsert(conn, name) {
    await conn.query(
      `INSERT INTO products (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [name]
    );
    const [[row]] = await conn.query(`SELECT LAST_INSERT_ID() AS id`);
    return row.id;
  },
};

module.exports = ProductModel;
