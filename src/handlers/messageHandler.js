const { existsByPhone, registerUser } = require('../repositories/userRepository');
const { notifyBot }                   = require('../services/notificationService');

/**
 * Procesa cada mensaje entrante:
 * 1. Extrae teléfono y nombre del contacto.
 * 2. Verifica si ya existe en la BD.
 * 3. Si no existe → registra y notifica al bot.
 *
 * @param {import('whatsapp-web.js').Client}  client
 * @param {import('whatsapp-web.js').Message} message
 */

async function handleIncomingMessage(client, message, readyAt, io) {
  try {
    if (message.from.endsWith('@g.us') || message.fromMe) return;

    const ahoraEnSegundos = Math.floor(Date.now() / 1000);
    if (message.timestamp < ahoraEnSegundos - 30) {
      return;
    }

    const contact  = await message.getContact();
    const nombre   = contact.pushname || contact.name || 'Sin nombre';
    const telefono = contact.number || message.from.replace(/@\w+/, '');

    const isExist = await existsByPhone(telefono);

    if (isExist) return;
    

    const registrado = await registerUser(telefono, nombre);

    if (registrado) {
      await notifyBot(client, telefono, nombre);
      io.emit('user-registered', { nombre, telefono });
    } else {
      console.error(`[Handler] Fallo al registrar: ${telefono}`);
    }
  } catch (err) {
    console.error('[Handler] Error procesando mensaje:', err.message);
  }
}

module.exports = { handleIncomingMessage };