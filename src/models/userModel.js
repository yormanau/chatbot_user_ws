const db = require('../config/database');

const UserModel = {
  async findById(id) {
    const [[row]] = await db.query(
      `SELECT u.id, u.name, u.phone, u.email, u.ciudad, u.birth_date, u.gender, u.create_at, c.name AS channel
       FROM users u
       LEFT JOIN channels c ON u.channel_id = c.id
       WHERE u.id = ?`,
      [id]
    );
    return row || null;
  },

  async findByPhone(phone) {
    const [[row]] = await db.query(`SELECT id FROM users WHERE phone = ?`, [phone]);
    return row || null;
  },

  async search(q) {
    const [rows] = await db.query(
      `SELECT id, name, phone, create_at FROM users WHERE name LIKE ? OR phone LIKE ? LIMIT 10`,
      [`%${q}%`, `%${q}%`]
    );
    return rows;
  },

  async create(phone, name, channelId = null) {
    const [result] = await db.query(
      `INSERT INTO users (phone, name, channel_id) VALUES (?, ?, ?)`,
      [phone, name, channelId]
    );
    return result.insertId;
  },

  async updateName(id, name) {
    await db.query(`UPDATE users SET name = ? WHERE id = ?`, [name, id]);
  },

  async updateField(id, field, value) {
    await db.query(`UPDATE users SET \`${field}\` = ? WHERE id = ?`, [value, id]);
  },

  async updateFields(id, fields) {
    const entries = Object.entries(fields);
    await Promise.all(
      entries.map(([field, value]) =>
        db.query(`UPDATE users SET \`${field}\` = ? WHERE id = ?`, [value, id])
      )
    );
  },

  async deleteById(id) {
    await db.query(`DELETE FROM users WHERE id = ?`, [id]);
  },
};

module.exports = UserModel;
