const express = require('express');
const router  = express.Router();
const { getQRImageUrl } = require('../services/whatsappServices');
const path = require('path');

function requireAuth(req, res, next) {
  if (req.cookies?.auth === process.env.APP_PIN) return next();
  res.redirect('/login');
}

router.get('/login', (req, res) => {
  res.sendFile(path.resolve('src/web/public/login.html'));
});

router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.resolve('src/web/public/index.html'));
});

router.get('/qr', (req, res) => {
  const qrImageUrl = getQRImageUrl();
  if (!qrImageUrl) {
    return res.status(404).send('QR no disponible aún, espera que el cliente inicie.');
  }
  res.send(`<img src="${qrImageUrl}" style="width:300px"/>`);
});

router.get('/perfil', requireAuth, (req, res) => {
  res.sendFile(path.resolve('src/web/public/perfil.html'));
});

module.exports = router;