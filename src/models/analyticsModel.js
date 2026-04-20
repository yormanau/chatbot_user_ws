const db = require('../config/database');

const USER_FILTERS = {
  all:   `1=1`,
  today: `DATE(create_at) = CURDATE()`,
  week:  `create_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
  month: `MONTH(create_at) = MONTH(NOW()) AND YEAR(create_at) = YEAR(NOW())`,
};

const INVOICE_FILTERS = {
  all:   '1=1',
  today: 'DATE(created_at) = CURDATE()',
  week:  'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
  month: 'MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())',
};

const GROUP_EXPR = {
  day:   "DATE(created_at)",
  week:  "DATE_FORMAT(created_at, '%x-W%v')",
  month: "DATE_FORMAT(created_at, '%Y-%m')",
};

const VALID_USER_SORT = ['name', 'create_at'];

const AnalyticsModel = {
  async invoiceSummary(filter) {
    const where = INVOICE_FILTERS[filter] || INVOICE_FILTERS.all;
    const [[row]] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE ${where}`
    );
    return row;
  },

  async userCount(filter) {
    const where = USER_FILTERS[filter] || USER_FILTERS.today;
    const [rows] = await db.query(`SELECT COUNT(*) as total FROM users WHERE ${where}`);
    return Number(rows[0].total);
  },

  async userList(filter, search, sortBy, sortDir, limit, offset) {
    const where        = USER_FILTERS[filter] || USER_FILTERS.all;
    const validSortBy  = VALID_USER_SORT.includes(sortBy) ? sortBy : 'name';
    const validSortDir = ['ASC', 'DESC'].includes(sortDir?.toUpperCase()) ? sortDir.toUpperCase() : 'ASC';
    const searchCond   = search ? `AND (name LIKE ? OR phone LIKE ?)` : '';
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM users WHERE ${where} ${searchCond}`,
      searchParams
    );
    const [rows] = await db.query(
      `SELECT id, name, phone, create_at FROM users
       WHERE ${where} ${searchCond}
       ORDER BY ${validSortBy} ${validSortDir}
       LIMIT ? OFFSET ?`,
      [...searchParams, limit, offset]
    );
    return { total: Number(total), rows };
  },

  async revenue(from, to) {
    const [[row]] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue, COALESCE(AVG(total),0) as avg_ticket
       FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    );
    return row;
  },

  async prevRevenue(from, to) {
    const [[row]] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    );
    return row;
  },

  async trend(group, from, to) {
    const groupExpr = GROUP_EXPR[group] || GROUP_EXPR.day;
    const [rows] = await db.query(
      `SELECT ${groupExpr} as label, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY label ORDER BY label ASC`,
      [from, to]
    );
    return rows;
  },

  async byWeekday() {
    const [rows] = await db.query(
      `SELECT DAYOFWEEK(created_at) as dow, DAYNAME(created_at) as name,
              COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices GROUP BY dow, name ORDER BY dow`
    );
    return rows;
  },

  async byHour() {
    const [rows] = await db.query(
      `SELECT HOUR(created_at) as hour, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices GROUP BY hour ORDER BY hour`
    );
    return rows;
  },

  async topProductsByUnits(from, to) {
    const dateFilter = from && to ? 'WHERE DATE(i.created_at) BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [from, to] : [];
    const [rows] = await db.query(
      `SELECT ii.product_name, SUM(ii.quantity) as units, SUM(ii.price * ii.quantity) as revenue
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       ${dateFilter}
       GROUP BY ii.product_name ORDER BY units DESC LIMIT 5`,
      dateParams
    );
    return rows;
  },

  async topProductsByRevenue(from, to) {
    const dateFilter = from && to ? 'WHERE DATE(i.created_at) BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [from, to] : [];
    const [rows] = await db.query(
      `SELECT ii.product_name, SUM(ii.quantity) as units, SUM(ii.price * ii.quantity) as revenue
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       ${dateFilter}
       GROUP BY ii.product_name ORDER BY revenue DESC LIMIT 5`,
      dateParams
    );
    return rows;
  },

  async starOfMonth() {
    const [[row]] = await db.query(
      `SELECT ii.product_name, SUM(ii.quantity) as units
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       WHERE MONTH(i.created_at) = MONTH(NOW()) AND YEAR(i.created_at) = YEAR(NOW())
       GROUP BY ii.product_name ORDER BY units DESC LIMIT 1`
    );
    return row || null;
  },

  async inactiveProducts() {
    const [rows] = await db.query(
      `SELECT p.name, MAX(i.created_at) as last_sale,
              DATEDIFF(NOW(), MAX(i.created_at)) as days_inactive
       FROM products p
       JOIN invoice_items ii ON ii.product_id = p.id
       JOIN invoices i ON i.id = ii.invoice_id
       GROUP BY p.id, p.name HAVING days_inactive >= 30
       ORDER BY days_inactive DESC LIMIT 8`
    );
    return rows;
  },

  async topClientsByFrequency(from, to) {
    const dateFilter = from && to ? 'WHERE DATE(i.created_at) BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [from, to] : [];
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.phone, COUNT(i.id) as purchases, COALESCE(SUM(i.total),0) as total_spent
       FROM users u JOIN invoices i ON i.user_id = u.id
       ${dateFilter}
       GROUP BY u.id ORDER BY purchases DESC LIMIT 5`,
      dateParams
    );
    return rows;
  },

  async topClientsBySpend(from, to) {
    const dateFilter = from && to ? 'WHERE DATE(i.created_at) BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [from, to] : [];
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.phone, COUNT(i.id) as purchases, COALESCE(SUM(i.total),0) as total_spent
       FROM users u JOIN invoices i ON i.user_id = u.id
       ${dateFilter}
       GROUP BY u.id ORDER BY total_spent DESC LIMIT 5`,
      dateParams
    );
    return rows;
  },

  async clientRanking(days) {
    const dateFilter = days > 0 ? 'AND i.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const params     = days > 0 ? [days] : [];
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.phone,
              COUNT(i.id) as purchases,
              COALESCE(SUM(i.total), 0) as total_spent,
              MAX(i.created_at) as last_purchase,
              DATEDIFF(NOW(), MAX(i.created_at)) as days_since
       FROM users u LEFT JOIN invoices i ON i.user_id = u.id ${dateFilter}
       GROUP BY u.id ORDER BY total_spent DESC`,
      params
    );
    return rows;
  },

  async combos() {
    const [rows] = await db.query(
      `SELECT a.product_name as prod_a, b.product_name as prod_b, COUNT(*) as times
       FROM invoice_items a
       JOIN invoice_items b ON a.invoice_id = b.invoice_id AND a.product_name < b.product_name
       GROUP BY prod_a, prod_b ORDER BY times DESC LIMIT 10`
    );
    return rows;
  },

  async inactiveClients(days) {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.phone, MAX(i.created_at) as last_purchase,
              DATEDIFF(NOW(), MAX(i.created_at)) as days_inactive
       FROM users u JOIN invoices i ON i.user_id = u.id
       GROUP BY u.id HAVING days_inactive >= ?
       ORDER BY days_inactive DESC LIMIT 15`,
      [days]
    );
    return rows;
  },
};

module.exports = AnalyticsModel;
