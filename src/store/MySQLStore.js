const fs   = require('fs');
const path = require('path');

class MySQLStore {
  constructor(db) {
    this.db = db;
  }

  _getSessionId(session) {
    return path.basename(session);
  }

  async sessionExists(options) {
    const sessionId = this._getSessionId(options.session);
    console.log('[MySQLStore] sessionExists:', sessionId);
    const [rows] = await this.db.query(
      'SELECT id FROM whatsapp_sessions WHERE session_id = ?',
      [sessionId]
    );
    console.log('[MySQLStore] resultado:', rows.length > 0);
    return rows.length > 0;
  }

  async save(options) {
  const sessionId = this._getSessionId(options.session);
  const zipPath   = options.path || `${options.session}.zip`;

  if (!fs.existsSync(zipPath)) {
    console.warn('[MySQLStore] No se encontró el zip en:', zipPath);
    return;
  }

  // Leer como Buffer binario directamente ← fix
  const data   = fs.readFileSync(zipPath);
  const exists = await this.sessionExists(options);

  if (exists) {
    await this.db.query(
      'UPDATE whatsapp_sessions SET session_data = ?, updated_at = NOW() WHERE session_id = ?',
      [data, sessionId]
    );
  } else {
    await this.db.query(
      'INSERT INTO whatsapp_sessions (session_id, session_data, created_at) VALUES (?, ?, NOW())',
      [sessionId, data]
    );
  }
  console.log('[MySQLStore] Sesión guardada correctamente ✅');
}

  async extract(options) {
  const sessionId = this._getSessionId(options.session);
  console.log('[MySQLStore] Intentando restaurar sesión para:', sessionId);

  const [rows] = await this.db.query(
    'SELECT session_data FROM whatsapp_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (rows.length === 0 || !rows[0].session_data) return null;

  const zipPath = options.path;
  const zipDir  = path.dirname(zipPath);

  if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir, { recursive: true });
  }

  // Escribir el Buffer directamente sin base64 ← fix
  fs.writeFileSync(zipPath, rows[0].session_data);
  console.log('[MySQLStore] Sesión restaurada desde MySQL ✅');
  return true;
}

  async delete(options) {
    const sessionId = this._getSessionId(options.session); // ← fix
    await this.db.query(
      'DELETE FROM whatsapp_sessions WHERE session_id = ?',
      [sessionId]
    );
  }
}

module.exports = MySQLStore;