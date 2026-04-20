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
    try {
      const [rows] = await this.db.query(
        'SELECT id FROM whatsapp_sessions WHERE session_id = ?',
        [sessionId]
      );
      return rows.length > 0;
    } catch (e) {
      console.error('[MySQLStore] Error en sessionExists:', e.message);
      return false;
    }
  }

  async save(options) {
    const sessionId = this._getSessionId(options.session);
    const zipPath   = options.path || `${options.session}.zip`;

    if (!fs.existsSync(zipPath)) {
      console.warn('[MySQLStore] No se encontró el zip en:', zipPath);
      return;
    }

    let data;
    try {
      data = fs.readFileSync(zipPath);
    } catch (e) {
      console.warn('[MySQLStore] No se pudo leer el zip:', e.message);
      return;
    }

    const sizeMB = (data.length / 1024 / 1024).toFixed(1);
    console.log(`[MySQLStore] Guardando sesión (${sizeMB} MB)...`);

    const exists = await this.sessionExists(options);
    const conn   = await this.db.getConnection();
    try {
      await conn.query('SET SESSION max_allowed_packet = 209715200');
      if (exists) {
        await conn.query(
          'UPDATE whatsapp_sessions SET session_data = ?, updated_at = NOW() WHERE session_id = ?',
          [data, sessionId]
        );
      } else {
        await conn.query(
          'INSERT INTO whatsapp_sessions (session_id, session_data, created_at) VALUES (?, ?, NOW())',
          [sessionId, data]
        );
      }
      console.log('[MySQLStore] Sesión guardada correctamente ✅');
    } catch (e) {
      // Errores comunes: ER_NET_PACKET_TOO_LARGE si el zip supera max_allowed_packet de MySQL
      console.error('[MySQLStore] Error al guardar sesión (no fatal):', e.code || e.message);
    } finally {
      conn.release();
    }
  }

  async extract(options) {
    const sessionId = this._getSessionId(options.session);
    console.log('[MySQLStore] Intentando restaurar sesión para:', sessionId);
    try {
      const [rows] = await this.db.query(
        'SELECT session_data FROM whatsapp_sessions WHERE session_id = ?',
        [sessionId]
      );
      if (rows.length === 0 || !rows[0].session_data) return null;

      const zipPath = options.path;
      const zipDir  = path.dirname(zipPath);
      if (!fs.existsSync(zipDir)) fs.mkdirSync(zipDir, { recursive: true });

      fs.writeFileSync(zipPath, rows[0].session_data);
      console.log('[MySQLStore] Sesión restaurada desde MySQL ✅');
      return true;
    } catch (e) {
      console.error('[MySQLStore] Error al restaurar sesión:', e.message);
      return null;
    }
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