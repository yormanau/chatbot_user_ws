const pool = require('../config/database');

/**
 * Verifica si un número de teléfono ya existe en la BD.
 * @param {string} telefono
 * @returns {Promise<boolean>}
 */
async function existsByPhone(telefono) {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE phone = ? LIMIT 1',
    [telefono]
  );
  return rows.length > 0;
}

/**
 * Registra un nuevo usuario en la BD.
 * @param {string} phone
 * @param {string} name
 * @returns {Promise<boolean>} true si se insertó correctamente
 */
async function registerUser(phone, name, channelId = null) {
  const [result] = await pool.query(
    'INSERT INTO users (phone, name, channel_id) VALUES (?, ?, ?)',
    [phone, name, channelId]
  );
  return result.affectedRows === 1;
}

module.exports = { existsByPhone, registerUser };