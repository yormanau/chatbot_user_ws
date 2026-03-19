class MySQLStore {
  constructor(db) {
    this.db = db;
  }

  async sessionExists(options) {
    const [rows] = await this.db.query(
      'SELECT id FROM whatsapp_sessions WHERE session_id = ?',
      [options.session]
    );
    return rows.length > 0;
  }

  async save(options) {
    const exists = await this.sessionExists(options);
    if (exists) {
      await this.db.query(
        'UPDATE whatsapp_sessions SET session_data = ?, updated_at = NOW() WHERE session_id = ?',
        [options.data, options.session]
      );
    } else {
      await this.db.query(
        'INSERT INTO whatsapp_sessions (session_id, session_data, created_at) VALUES (?, ?, NOW())',
        [options.session, options.data]
      );
    }
  }

  async extract(options) {
    const [rows] = await this.db.query(
      'SELECT session_data FROM whatsapp_sessions WHERE session_id = ?',
      [options.session]
    );
    if (rows.length === 0) return null;
    return rows[0].session_data;
  }

  async delete(options) {
    await this.db.query(
      'DELETE FROM whatsapp_sessions WHERE session_id = ?',
      [options.session]
    );
  }
}

module.exports = MySQLStore;