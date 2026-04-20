const { initWhatsApp, stopWhatsApp, restartWhatsApp, requestPairing } = require('../services/whatsappServices');

function connect(req, res) {
  const { io } = require('../index.js');
  initWhatsApp(io);
  res.json({ ok: true });
}

function disconnect(req, res) {
  stopWhatsApp();
  res.json({ ok: true });
}

function restart(req, res) {
  restartWhatsApp();
  res.json({ ok: true });
}

async function pairingCode(req, res) {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Falta el número' });
  const result = await requestPairing(phone.replace(/\D/g, ''));
  res.json({ ok: true, ...result });
}

module.exports = { connect, disconnect, restart, pairingCode };
