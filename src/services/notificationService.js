/**
 * Envía una notificación al número del bot informando
 * que un nuevo usuario fue registrado exitosamente.
 * @param {import('whatsapp-web.js').Client} client
 * @param {string} telefono
 * @param {string} nombre
 */

async function notifyBot(client, telefono, nombre) {
  const chatId = `${client.info.wid.user}@c.us`;

  const mensaje =
    `✅ *Nuevo usuario registrado*\n` +
    `👤 Nombre: ${nombre}\n` +
    `📱 Teléfono: ${telefono}\n` +
    `🕐 Fecha: ${new Date().toLocaleString('es-CO')}`;

  await client.sendMessage(chatId, mensaje);
}

module.exports = { notifyBot };