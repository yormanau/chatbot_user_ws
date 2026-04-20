const db = require('../config/database');

const SettingsModel = {
  async get(key) {
    const [rows] = await db.query(
      "SELECT `value` FROM app_settings WHERE `key` = ?",
      [key]
    );
    return rows.length ? rows[0].value : null;
  },

  async set(key, value) {
    await db.query(
      "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [key, value]
    );
  },
};

module.exports = SettingsModel;
