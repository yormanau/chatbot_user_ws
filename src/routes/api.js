const express = require('express');
const router  = express.Router();
const { getQRImageUrl, getQRCreatedAt, getIsConnected, getBotName, restartWhatsApp } = require('../services/whatsappServices');
const db = require('../config/database');

const QR_TTL = 60;

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
      name:      Buffer.isBuffer(row.name)  ? row.name.toString('utf8')  : row.name,
      phone:     Buffer.isBuffer(row.phone) ? row.phone.toString('utf8') : row.phone,
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
      name:      Buffer.isBuffer(row.name)  ? row.name.toString('utf8')  : row.name,
      phone:     Buffer.isBuffer(row.phone) ? row.phone.toString('utf8') : row.phone,
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
      `SELECT id, name, phone, create_at FROM users WHERE id = ?`, [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const result = {
      id:        user.id,
      name:      Buffer.isBuffer(user.name)  ? user.name.toString('utf8')  : user.name,
      phone:     Buffer.isBuffer(user.phone) ? user.phone.toString('utf8') : user.phone,
      create_at: user.create_at
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

  try {
    await db.query(`UPDATE users SET name = ? WHERE id = ?`, [name.trim(), id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;