const { getQRImageUrl, getQRCreatedAt, getIsConnected, getBotName, getPairingCode, getPairingCodeCreatedAt } = require('../services/whatsappServices');

const QR_TTL      = 60;
const PAIRING_TTL = 120;

function getStatus(req, res) {
  const connected  = getIsConnected();
  const qr         = getQRImageUrl();
  const createdAt  = getQRCreatedAt();
  const pCode      = getPairingCode();
  const pCreatedAt = getPairingCodeCreatedAt();

  const secondsLeft = createdAt
    ? Math.max(0, QR_TTL - Math.floor((Date.now() - createdAt) / 1000))
    : 0;

  const pairingSecondsLeft = pCreatedAt
    ? Math.max(0, PAIRING_TTL - Math.floor((Date.now() - pCreatedAt) / 1000))
    : 0;

  res.json({
    connected,
    qr: connected ? null : qr,
    secondsLeft,
    botName: getBotName(),
    pairingCode: connected ? null : pCode,
    pairingSecondsLeft,
  });
}

module.exports = { getStatus };
