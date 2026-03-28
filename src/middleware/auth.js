function requireAuth(req, res, next) {
  if (req.cookies?.auth === process.env.APP_PIN) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// mysql2 con charset:'binary' devuelve strings como Uint8Array (no Buffer),
// por lo que Buffer.isBuffer() falla. Esta función cubre ambos casos.
const toStr = (v) => {
  if (!v && v !== 0) return v;
  if (typeof v === 'string') return v;
  return Buffer.from(v).toString('utf8');
};

module.exports = { requireAuth, toStr };
