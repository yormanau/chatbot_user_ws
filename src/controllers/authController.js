function login(req, res) {
  const { user, pin } = req.body;

  if (user !== process.env.APP_USER || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: 'Usuario o PIN incorrecto' });
  }

  res.cookie('auth', process.env.APP_PIN, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true });
}

function check(req, res) {
  const valid = req.cookies?.auth === process.env.APP_PIN;
  res.json({ authenticated: valid });
}

function logout(req, res) {
  res.clearCookie('auth');
  res.json({ ok: true });
}

module.exports = { login, check, logout };
