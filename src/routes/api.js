const express = require('express');
const router  = express.Router();
const { getQRImageUrl, getQRCreatedAt, getIsConnected, getBotName, restartWhatsApp, initWhatsApp, stopWhatsApp } = require('../services/whatsappServices');
const db = require('../config/database');
const { formatDateToDisplay, formatDateToSQL } = require('../utils/dateHelpers');
const { normalizeNames } = require('../utils/normalizeNames');
const { existsByPhone, registerUser } = require('../repositories/userRepository');
const QR_TTL = 60;

// mysql2 con charset:'binary' devuelve strings como Uint8Array (no Buffer),
// por lo que Buffer.isBuffer() falla. Esta función cubre ambos casos.
const toStr = (v) => {
  if (!v && v !== 0) return v;
  if (typeof v === 'string') return v;
  return Buffer.from(v).toString('utf8');
};

function requireAuth(req, res, next) {
  if (req.cookies?.auth === process.env.APP_PIN) return next();
  res.status(401).json({ error: 'No autorizado' });
}

router.get('/status', (req, res) => {
  
  const connected = getIsConnected();
  const qr        = getQRImageUrl();
  const createdAt = getQRCreatedAt();

  const secondsLeft = createdAt
    ? Math.max(0, QR_TTL - Math.floor((Date.now() - createdAt) / 1000))
    : 0;

  res.json({ connected, qr: connected ? null : qr, secondsLeft, botName: getBotName() });
});

router.get('/analytics/invoices', requireAuth, async (req, res) => {
  const { filter } = req.query;
  const filters = {
    all:   '1=1',
    today: 'DATE(created_at) = CURDATE()',
    week:  'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
    month: 'MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())',
  };
  const where = filters[filter] || filters.all;
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE ${where}`
    );
    res.json({ count: Number(row.count), amount: Number(row.amount) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/users', requireAuth, async (req, res) => {
  const { filter } = req.query;

  const filters = {
    all:   `1=1`,
    today: `DATE(create_at) = CURDATE()`,
    week:  `create_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    month: `MONTH(create_at) = MONTH(NOW()) AND YEAR(create_at) = YEAR(NOW())`
  };

  const where = filters[filter] || filters.today;

  try {
    const [rows] = await db.query(`SELECT COUNT(*) as total FROM users WHERE ${where}`);
    res.json({ filter, total: rows[0].total });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: 'Error consultando analytics' });
  }
});

router.get('/analytics/users/list', requireAuth, async (req, res) => {
  const { filter, sortBy = 'name', sortDir = 'ASC', page = 1, limit = 10, search = '' } = req.query;

  const filters = {
    all:   `1=1`,
    today: `DATE(create_at) = CURDATE()`,
    week:  `create_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    month: `MONTH(create_at) = MONTH(NOW()) AND YEAR(create_at) = YEAR(NOW())`
  };

  const validSortBy  = ['name', 'create_at'].includes(sortBy) ? sortBy : 'name';
  const validSortDir = ['ASC', 'DESC'].includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'ASC';
  const validLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const validPage    = Math.max(1, Number(page));
  const offset       = (validPage - 1) * validLimit;
  const where        = filters[filter] || filters.all;

  const searchCondition = search ? `AND (name LIKE ? OR phone LIKE ?)` : '';
  const searchParams    = search ? [`%${search}%`, `%${search}%`] : [];

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM users WHERE ${where} ${searchCondition}`,
      searchParams
    );

    const [rows] = await db.query(
      `SELECT id, name, phone, create_at FROM users WHERE ${where} ${searchCondition} ORDER BY ${validSortBy} ${validSortDir} LIMIT ? OFFSET ?`,
      [...searchParams, validLimit, offset]
    );

    const users = rows.map(row => ({
      id:        row.id,
      name:      normalizeNames(toStr(row.name)),
      phone:     toStr(row.phone),
      create_at: row.create_at
    }));

    res.json({
      data:       users,
      total,
      page:       validPage,
      limit:      validLimit,
      totalPages: Math.ceil(total / validLimit)
    });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const [[user]] = await db.query(`SELECT id, name FROM users WHERE id = ?`, [id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.query(`DELETE FROM users WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE user] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/whatsapp/restart', (req, res) => {
  restartWhatsApp();
  res.json({ ok: true });
});

router.post('/auth/login', (req, res) => {
  const { user, pin } = req.body;
  
  if (user !== process.env.APP_USER || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: 'Usuario o PIN incorrecto' });
  }

  res.cookie('auth', process.env.APP_PIN, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ ok: true });
});

router.get('/auth/check', (req, res) => {
  const valid = req.cookies?.auth === process.env.APP_PIN;
  res.json({ authenticated: valid });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ ok: true });
});

router.get('/users/search', requireAuth, async (req, res) => {
  const { q = '' } = req.query;

  if (!q.trim()) return res.json([]);

  try {
    const [rows] = await db.query(
      `SELECT id, name, phone, create_at FROM users WHERE name LIKE ? OR phone LIKE ? LIMIT 10`,
      [`%${q}%`, `%${q}%`]
    );

    const users = rows.map(row => ({
      id:        row.id,
      name:      normalizeNames(toStr(row.name)),
      phone:     toStr(row.phone),
      create_at: row.create_at
    }));

    res.json(users);
  } catch (err) {
    console.error('[Search] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [[user]] = await db.query(
      `SELECT id, name, phone, email, ciudad, birth_date, gender, create_at FROM users WHERE id = ?`, [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const result = {
      id:         user.id,
      name:       normalizeNames(toStr(user.name)),
      phone:      toStr(user.phone),
      email:      toStr(user.email),
      ciudad:     toStr(user.ciudad),
      birth_date: formatDateToDisplay(user.birth_date),
      gender:     (() => {
        const raw = toStr(user.gender);
        return raw === 'M' ? 'Masculino' : raw === 'F' ? 'Femenino' : raw;
      })(),
      create_at:  user.create_at
    };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', requireAuth, async (req, res) => {
  const { id }   = req.params;
  const { name } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const normalizedName = normalizeNames(name.trim());

  try {
    await db.query(`UPDATE users SET name = ? WHERE id = ?`, [normalizedName, id]);
    res.json({ ok: true, name: normalizedName  });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /users/:id/info — agrega o actualiza un campo opcional ─────────────

const ALLOWED_FIELDS = ['email', 'ciudad', 'birth_date', 'gender'];
 
router.post('/users/:id/info', requireAuth, async (req, res) => {
  const { id }          = req.params;
  let { field, value } = req.body;
 
  if (!field || !ALLOWED_FIELDS.includes(field)) {
    return res.status(400).json({ error: 'Campo no permitido' });
  }
 
  if (!value?.toString().trim()) {
    return res.status(400).json({ error: 'El valor no puede estar vacío' });
  }

  if (field === 'gender') {
    value = value === 'Masculino' ? 'M' : value === 'Femenino' ? 'F' : value;
  }
  
  if (field === 'birth_date') {
    value = formatDateToSQL(value);
    if (!value) return res.status(400).json({ error: 'Formato de fecha inválido' });
  }

  if (field === 'ciudad') {
    value = normalizeNames(value);
  }

    if (field === 'email'){
    value = value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }
  }

  try {
    const [[user]] = await db.query(`SELECT id FROM users WHERE id = ?`, [id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
 
    await db.query(
      `UPDATE users SET \`${field}\` = ? WHERE id = ?`,
      [value.toString().trim(), id]
    );
 
    res.json({ ok: true, field, value: value.toString().trim() });
  } catch (err) {
    console.error('[users/info] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Products: list with stats ────────────────────────────────
router.get('/products/list', requireAuth, async (req, res) => {
  const { search = '', page = 1, limit = 25, sortBy = 'times_sold', sortDir = 'DESC' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const SORT_COLS = { name: 'p.name', times_sold: 'times_sold', avg_price: 'avg_price', total_revenue: 'total_revenue' };
  const orderCol  = SORT_COLS[sortBy] || 'times_sold';
  const orderDir  = sortDir === 'ASC' ? 'ASC' : 'DESC';

  const where  = search.trim() ? 'WHERE p.name LIKE ?' : '';
  const params = search.trim() ? [`%${search.trim()}%`] : [];

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total FROM products p ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT
         p.id,
         p.name,
         COUNT(ii.id)              AS times_sold,
         AVG(ii.price)             AS avg_price,
         COALESCE(SUM(ii.price * ii.quantity), 0) AS total_revenue
       FROM products p
       LEFT JOIN invoice_items ii ON ii.product_id = p.id
       ${where}
       GROUP BY p.id, p.name
       ORDER BY ${orderCol} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      total:      Number(total),
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.max(1, Math.ceil(Number(total) / Number(limit))),
      data:       rows.map(r => ({
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
});

// ─── Products: autocomplete search ────────────────────────────
router.get('/products/search', requireAuth, async (req, res) => {
  const { q = '' } = req.query;
  if (!q.trim()) return res.json([]);
  try {
    const [rows] = await db.query(
      'SELECT id, name FROM products WHERE name LIKE ? ORDER BY name ASC LIMIT 8',
      [`%${q}%`]
    );
    res.json(rows.map(r => ({
      id:   r.id,
      name: toStr(r.name),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User invoices ────────────────────────────────────────────
router.get('/users/:id/invoices', requireAuth, async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const [invoices] = await db.query(
      `SELECT i.id, i.total, i.created_at,
              COUNT(ii.id) AS num_items
       FROM   invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE  i.user_id = ?
       GROUP  BY i.id
       ORDER  BY i.created_at DESC`,
      [userId]
    );


    const result = await Promise.all(invoices.map(async (inv) => {
      const [items] = await db.query(
        'SELECT product_name, price, quantity FROM invoice_items WHERE invoice_id = ?',
        [inv.id]
      );
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
});

// ─── Invoices: list ───────────────────────────────────────────
router.get('/invoices', requireAuth, async (req, res) => {
  const { page = 1, limit = 10, search = '', sortBy = 'created_at', sortDir = 'DESC' } = req.query;
  const validLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const validPage  = Math.max(1, Number(page));
  const offset     = (validPage - 1) * validLimit;

  const SORT_COLS = { user_name: 'u.name', num_items: 'num_items', total: 'i.total', created_at: 'i.created_at' };
  const orderCol  = SORT_COLS[sortBy] || 'i.created_at';
  const orderDir  = sortDir === 'ASC' ? 'ASC' : 'DESC';

  const searchCond   = search ? 'AND (u.name LIKE ? OR u.phone LIKE ?)' : '';
  const searchParams = search ? [`%${search}%`, `%${search}%`] : [];

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM invoices i JOIN users u ON i.user_id = u.id WHERE 1=1 ${searchCond}`,
      searchParams
    );

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
      [...searchParams, validLimit, offset]
    );

    const data = rows.map(r => ({
      id:         r.id,
      user_name:  normalizeNames(toStr(r.user_name)),
      user_phone: toStr(r.user_phone),
      total:      Number(r.total),
      num_items:  Number(r.num_items),
      created_at: r.created_at,
    }));

    res.json({ data, total, page: validPage, limit: validLimit, totalPages: Math.ceil(total / validLimit) });
  } catch (err) {
    console.error('[invoices] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Invoices: detail ─────────────────────────────────────────
router.get('/invoices/:id', requireAuth, async (req, res) => {
  const invoiceId = Number(req.params.id);
  try {
    const [[inv]] = await db.query(
      `SELECT i.id, i.total, i.created_at,
              u.name AS user_name, u.phone AS user_phone
       FROM invoices i
       JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [invoiceId]
    );
    if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });

    const [items] = await db.query(
      'SELECT product_name, price, quantity FROM invoice_items WHERE invoice_id = ?',
      [invoiceId]
    );

    res.json({
      ...inv,
      total:     Number(inv.total),
      user_name: normalizeNames(toStr(inv.user_name)),
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
});

// ─── Invoices: create ─────────────────────────────────────────
router.post('/invoices', requireAuth, async (req, res) => {
  const { user_id, items } = req.body;

  if (!user_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const total = items.reduce((sum, i) => sum + (Number(i.price) * (Number(i.quantity) || 1)), 0);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [invoiceResult] = await conn.query(
      'INSERT INTO invoices (user_id, total) VALUES (?, ?)',
      [user_id, total]
    );
    const invoiceId = invoiceResult.insertId;

    for (const item of items) {
      const name     = item.name.trim();
      const price    = Number(item.price);
      const quantity = Number(item.quantity) || 1;

      await conn.query(
        'INSERT INTO products (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
        [name]
      );
      const [[prodRow]] = await conn.query('SELECT LAST_INSERT_ID() AS id');

      await conn.query(
        'INSERT INTO invoice_items (invoice_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [invoiceId, prodRow.id, name, price, quantity]
      );
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
});

router.post('/whatsapp/connect', requireAuth, (req, res) => {
  const { io } = require('../index.js');
  initWhatsApp(io);
  res.json({ ok: true });
});

router.post('/whatsapp/disconnect', requireAuth, (req, res) => {
  stopWhatsApp();
  res.json({ ok: true });
});

router.post('/users/register', requireAuth, async (req, res) => {
  let { nombre, telefono, email, gender, ciudad, birth_date } = req.body;

  if (!nombre?.trim() || !telefono?.trim()) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  }

  telefono = telefono.replace(/[\s\-\(\)\+]/g, '');

  try {
    const exists = await existsByPhone(telefono);
    if (exists) return res.status(409).json({ error: 'El teléfono ya está registrado' });

    const registered = await registerUser(telefono, normalizeNames(nombre.trim()));
    if (!registered) return res.status(500).json({ error: 'Error al registrar contacto' });

    const [[newUser]] = await db.query('SELECT id FROM users WHERE phone = ?', [telefono]);

    const updates = [];
    if (email?.trim()) updates.push(db.query('UPDATE users SET email = ? WHERE id = ?', [email.trim().toLowerCase(), newUser.id]));
    if (gender) {
      const g = gender === 'Masculino' ? 'M' : gender === 'Femenino' ? 'F' : gender;
      updates.push(db.query('UPDATE users SET gender = ? WHERE id = ?', [g, newUser.id]));
    }
    if (ciudad?.trim()) updates.push(db.query('UPDATE users SET ciudad = ? WHERE id = ?', [normalizeNames(ciudad.trim()), newUser.id]));
    if (birth_date) {
      const sqlDate = formatDateToSQL(birth_date);
      if (sqlDate) updates.push(db.query('UPDATE users SET birth_date = ? WHERE id = ?', [sqlDate, newUser.id]));
    }
    await Promise.all(updates);

    const { io } = require('../index.js');
    io.emit('user-registered', { nombre: normalizeNames(nombre.trim()), telefono });

    res.json({ ok: true, id: newUser.id });
  } catch (err) {
    console.error('[register] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ANALÍTICA AVANZADA  /api/analytics/adv/*
// ═══════════════════════════════════════════════════════════════

// ── 1. Métricas de ingresos ────────────────────────────────────
router.get('/analytics/adv/revenue', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to requeridos' });

  // Usar noon UTC para evitar problemas de DST al calcular días
  const fromDate = new Date(from + 'T12:00:00Z');
  const toDate   = new Date(to   + 'T12:00:00Z');
  const durationDays = Math.round((toDate - fromDate) / 86400000) + 1;

  const isoDate  = d => d.toISOString().slice(0, 10);
  const prevToDate   = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (durationDays - 1) * 86400000);
  const prevTo   = isoDate(prevToDate);
  const prevFrom = isoDate(prevFromDate);

  try {
    const [[cur]]  = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue, COALESCE(AVG(total),0) as avg_ticket
       FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    );
    const [[prev]] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?`,
      [prevFrom, prevTo]
    );

    const now         = new Date();
    const daysTotal   = durationDays;
    const daysElapsed = Math.max(1, Math.min(durationDays, Math.round((now - fromDate) / 86400000) + 1));
    const projection  = (Number(cur.revenue) / daysElapsed) * daysTotal;

    res.json({
      revenue:     Number(cur.revenue),
      count:       Number(cur.count),
      avg_ticket:  Number(cur.avg_ticket),
      prev_revenue:Number(prev.revenue),
      prev_count:  Number(prev.count),
      projection:  Math.round(projection),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 2. Tendencia de ventas ─────────────────────────────────────
router.get('/analytics/adv/trend', requireAuth, async (req, res) => {
  const { from, to, group = 'day' } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to requeridos' });

  const groupExpr = {
    day:   "DATE(created_at)",
    week:  "DATE_FORMAT(created_at, '%x-W%v')",
    month: "DATE_FORMAT(created_at, '%Y-%m')",
  }[group] || "DATE(created_at)";

  try {
    const [rows] = await db.query(
      `SELECT ${groupExpr} as label, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY label ORDER BY label ASC`,
      [from, to]
    );
    res.json(rows.map(r => ({ label: r.label, count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 3. Ventas por día de la semana ─────────────────────────────
router.get('/analytics/adv/by-weekday', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DAYOFWEEK(created_at) as dow, DAYNAME(created_at) as name,
              COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices GROUP BY dow, name ORDER BY dow`
    );
    res.json(rows.map(r => ({ dow: r.dow, name: r.name, count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 4. Ventas por hora del día ─────────────────────────────────
router.get('/analytics/adv/by-hour', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT HOUR(created_at) as hour, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
       FROM invoices GROUP BY hour ORDER BY hour`
    );
    res.json(rows.map(r => ({ hour: Number(r.hour), count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 5. Top productos ───────────────────────────────────────────
router.get('/analytics/adv/top-products', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = from && to ? 'WHERE DATE(i.created_at) BETWEEN ? AND ?' : '';
  const dateParams = from && to ? [from, to] : [];

  try {
    const [byUnits] = await db.query(
      `SELECT ii.product_name, SUM(ii.quantity) as units, SUM(ii.price * ii.quantity) as revenue
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       ${dateFilter}
       GROUP BY ii.product_name ORDER BY units DESC LIMIT 5`,
      dateParams
    );
    const [byRevenue] = await db.query(
      `SELECT ii.product_name, SUM(ii.quantity) as units, SUM(ii.price * ii.quantity) as revenue
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       ${dateFilter}
       GROUP BY ii.product_name ORDER BY revenue DESC LIMIT 5`,
      dateParams
    );
    const [[starOfMonth]] = await db.query(
      `SELECT ii.product_name, SUM(ii.quantity) as units
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       WHERE MONTH(i.created_at) = MONTH(NOW()) AND YEAR(i.created_at) = YEAR(NOW())
       GROUP BY ii.product_name ORDER BY units DESC LIMIT 1`
    );
    const [inactive] = await db.query(
      `SELECT p.name, MAX(i.created_at) as last_sale,
              DATEDIFF(NOW(), MAX(i.created_at)) as days_inactive
       FROM products p
       JOIN invoice_items ii ON ii.product_id = p.id
       JOIN invoices i ON i.id = ii.invoice_id
       GROUP BY p.id, p.name HAVING days_inactive >= 30
       ORDER BY days_inactive DESC LIMIT 8`
    );

    const map = (r) => ({ name: toStr(r.product_name || r.name), units: Number(r.units), revenue: Number(r.revenue || 0) });
    res.json({
      by_units:      byUnits.map(map),
      by_revenue:    byRevenue.map(map),
      star_of_month: starOfMonth ? toStr(starOfMonth.product_name) : null,
      inactive:      inactive.map(r => ({ name: toStr(r.name), last_sale: r.last_sale, days_inactive: Number(r.days_inactive) })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 6. Top clientes ────────────────────────────────────────────
router.get('/analytics/adv/top-clients', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = from && to ? 'WHERE DATE(i.created_at) BETWEEN ? AND ?' : '';
  const dateParams = from && to ? [from, to] : [];

  try {
    const [byFreq] = await db.query(
      `SELECT u.id, u.name, u.phone, COUNT(i.id) as purchases, COALESCE(SUM(i.total),0) as total_spent
       FROM users u JOIN invoices i ON i.user_id = u.id
       ${dateFilter}
       GROUP BY u.id ORDER BY purchases DESC LIMIT 5`,
      dateParams
    );
    const [bySpend] = await db.query(
      `SELECT u.id, u.name, u.phone, COUNT(i.id) as purchases, COALESCE(SUM(i.total),0) as total_spent
       FROM users u JOIN invoices i ON i.user_id = u.id
       ${dateFilter}
       GROUP BY u.id ORDER BY total_spent DESC LIMIT 5`,
      dateParams
    );
    const map = r => ({ id: r.id, name: normalizeNames(toStr(r.name)), phone: toStr(r.phone), purchases: Number(r.purchases), total_spent: Number(r.total_spent) });
    res.json({ by_frequency: byFreq.map(map), by_spend: bySpend.map(map) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 7. Ranking de clientes ─────────────────────────────────────
router.get('/analytics/adv/client-ranking', requireAuth, async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days, 10) : 0;
  const dateFilter = days > 0
    ? 'AND i.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'
    : '';
  const params = days > 0 ? [days] : [];

  try {
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
    res.json(rows.map(r => ({
      id:            r.id,
      name:          normalizeNames(toStr(r.name)),
      phone:         toStr(r.phone),
      purchases:     Number(r.purchases),
      total_spent:   Number(r.total_spent),
      last_purchase: r.last_purchase,
      days_since:    r.days_since != null ? Number(r.days_since) : null,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 8. Combos naturales ────────────────────────────────────────
router.get('/analytics/adv/combos', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.product_name as prod_a, b.product_name as prod_b, COUNT(*) as times
       FROM invoice_items a
       JOIN invoice_items b ON a.invoice_id = b.invoice_id AND a.product_name < b.product_name
       GROUP BY prod_a, prod_b ORDER BY times DESC LIMIT 10`
    );
    res.json(rows.map(r => ({ prod_a: toStr(r.prod_a), prod_b: toStr(r.prod_b), times: Number(r.times) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 9. Clientes inactivos ──────────────────────────────────────
router.get('/analytics/adv/inactive-clients', requireAuth, async (req, res) => {
  const days = Math.max(1, Number(req.query.days) || 30);
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.phone, MAX(i.created_at) as last_purchase,
              DATEDIFF(NOW(), MAX(i.created_at)) as days_inactive
       FROM users u JOIN invoices i ON i.user_id = u.id
       GROUP BY u.id HAVING days_inactive >= ?
       ORDER BY days_inactive DESC LIMIT 15`,
      [days]
    );
    res.json(rows.map(r => ({
      id:             r.id,
      name:           normalizeNames(toStr(r.name)),
      phone:          toStr(r.phone),
      last_purchase:  r.last_purchase,
      days_inactive:  Number(r.days_inactive),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Analytics: configuración de tiers ─────────────────────────
router.get('/analytics/adv/config', requireAuth, async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT `value` FROM app_settings WHERE `key` = 'analytics_cfg'");
    if (!rows.length || !rows[0].value) return res.json(null);
    res.json(JSON.parse(toStr(rows[0].value)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/analytics/adv/config', requireAuth, async (req, res) => {
  try {
    await db.query(
      "INSERT INTO app_settings (`key`, `value`) VALUES ('analytics_cfg', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;