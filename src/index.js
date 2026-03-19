require('dotenv').config();
const { runMigrations }         = require('./config/migrate');
const { Client, RemoteAuth }    = require('whatsapp-web.js');
const qrcode                    = require('qrcode-terminal');
const QRCode                    = require('qrcode');
const express                   = require('express');
const { handleIncomingMessage } = require('./handlers/messageHandler');
const MySQLStore                = require('./store/MySQLStore');
const db                        = require('./config/database'); // tu conexión mysql2

const app = express();
const PORT = process.env.PORT || 3000;
let qrImageUrl = null;
let readyAt = null;

app.get('/', (req, res) => res.redirect('/qr'));

app.get('/qr', async (req, res) => {
  if (!qrImageUrl) {
    return res.status(404).send('QR no disponible aún, espera que el cliente inicie.');
  }
  res.send(`<img src="${qrImageUrl}" style="width:300px"/>`);
});

app.listen(PORT, () => {
  console.log(`[Server] QR disponible en http://localhost:${PORT}/qr`);
});

// ---- Store + Cliente ----
const store = new MySQLStore(db);


const client = new Client({
  authStrategy: new RemoteAuth({
    clientId: 'chatbot', 
    store: store,
    backupSyncIntervalMs: 3600000, // guarda sesión cada 5 min
  }),
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
  qrImageUrl = null;
  console.log('[WhatsApp] Sesión autenticada correctamente.');
});

client.on('ready', () => {
  readyAt = Date.now();
  console.log('[WhatsApp] Cliente listo y escuchando mensajes...');
});

client.on('remote_session_saved', () => {
  console.log('[WhatsApp] Sesión guardada en MySQL ✅');
});

client.on('disconnected', (reason) => {
  console.warn('[WhatsApp] Desconectado:', reason);
});

client.on('message', (message) => handleIncomingMessage(client, message, readyAt));

async function start() {
  await runMigrations();
  client.initialize();
}

// Probando conexión a la base de datos antes de iniciar el cliente

start();