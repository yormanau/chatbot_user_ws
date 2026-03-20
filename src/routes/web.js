const express = require('express');
const router  = express.Router();
const { getQRImageUrl } = require('../services/whatsappServices');
const path = require('path');
router.get('/', (req, res) => {
  res.sendFile(path.resolve('src/web/public/index.html'));
});

router.get('/qr', (req, res) => {
  const qrImageUrl = getQRImageUrl();
  if (!qrImageUrl) {
    return res.status(404).send('QR no disponible aún, espera que el cliente inicie.');
  }
  res.send(`<img src="${qrImageUrl}" style="width:300px"/>`);
});

module.exports = router;