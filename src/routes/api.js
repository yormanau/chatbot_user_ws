const express = require('express');
const router  = express.Router();
const { getQRImageUrl, getQRCreatedAt, getIsConnected, getBotName } = require('../services/whatsappServices');
const db = require('../config/database'); // ← agrega esto

const QR_TTL = 60;

router.get('/status', (req, res) => {
  const connected = getIsConnected();
  const qr        = getQRImageUrl();
  const createdAt = getQRCreatedAt();

  const secondsLeft = createdAt
    ? Math.max(0, QR_TTL - Math.floor((Date.now() - createdAt) / 1000))
    : 0;

  res.json({ connected, qr: connected ? null : qr, secondsLeft, botName: getBotName() });
});

router.get('/analytics/users', async (req, res) => {
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


router.get('/analytics/users/list', async (req, res) => {
  const { filter, sortBy = 'name', sortDir = 'ASC' } = req.query;

  const filters = {
    all:   `1=1`,
    today: `DATE(create_at) = CURDATE()`,
    week:  `create_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    month: `MONTH(create_at) = MONTH(NOW()) AND YEAR(create_at) = YEAR(NOW())`
  };

  const validSortBy  = ['name', 'create_at'].includes(sortBy)  ? sortBy  : 'name';
  const validSortDir = ['ASC', 'DESC'].includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'ASC';

  const where = filters[filter] || filters.all;

  try {
    const [rows] = await db.query(
      `SELECT name, phone, create_at FROM users WHERE ${where} ORDER BY ${validSortBy} ${validSortDir}`
    );

    const users = rows.map(row => ({
      name:      Buffer.isBuffer(row.name)  ? row.name.toString('utf8')  : row.name,
      phone:     Buffer.isBuffer(row.phone) ? row.phone.toString('utf8') : row.phone,
      create_at: row.create_at
    }));

    res.json(users);
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;