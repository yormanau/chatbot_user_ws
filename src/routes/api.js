const express = require('express');
const router  = express.Router();
const { getQRImageUrl, getQRCreatedAt, getIsConnected, getBotName } = require('../services/whatsappServices');

const QR_TTL = 60;

router.get('/status', (req, res) => {
  const connected = getIsConnected(); // ← usa la función exportada
  const qr        = getQRImageUrl();
  const createdAt = getQRCreatedAt();

  const secondsLeft = createdAt
    ? Math.max(0, QR_TTL - Math.floor((Date.now() - createdAt) / 1000))
    : 0;

  res.json({ connected, qr: connected ? null : qr, secondsLeft, botName: getBotName()   });
});

module.exports = router;