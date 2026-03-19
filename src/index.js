
require('dotenv').config();
const { runMigrations }         = require('./config/migrate');
const { Client, LocalAuth }     = require('whatsapp-web.js');
const qrcode                    = require('qrcode-terminal');
const QRCode                    = require('qrcode');
const express                   = require('express');
const { handleIncomingMessage } = require('./handlers/messageHandler');

const app = express();
let qrImageUrl = null;
let readyAt = null;

app.get('/qr', async (req, res) => {
  if (!qrImageUrl) {
    return res.status(404).send('QR no disponible aún, espera que el cliente inicie.');
  }
  res.send(`<img src="${qrImageUrl}" style="width:300px"/>`);
});

app.listen(3000, () => {
  console.log('[Server] QR disponible en http://localhost:3000/qr');
});

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'chatbot-fase1' }),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  },
});

client.on('qr', async (qr) => {
  qrcode.generate(qr, { small: true });
  qrImageUrl = await QRCode.toDataURL(qr);
  console.log('[WhatsApp] QR actualizado en /qr');
});

client.on('authenticated', () => {
  qrImageUrl = null; // limpiar el QR una vez autenticado
  console.log('[WhatsApp] Sesión autenticada correctamente.');
});


client.on('ready', () => {
  readyAt = Date.now();
  console.log('[WhatsApp] Cliente listo y escuchando mensajes...');
});

client.on('disconnected', (reason) => {
  console.warn('[WhatsApp] Desconectado:', reason);
});

client.on('message', (message) => handleIncomingMessage(client, message, readyAt));

async function start() {
  await runMigrations();
  client.initialize();
}

start();