const { Client, RemoteAuth, LocalAuth } = require('whatsapp-web.js');
const qrcode                 = require('qrcode-terminal');
const QRCode                 = require('qrcode');
const { handleIncomingMessage } = require('../handlers/messageHandler');
const MySQLStore             = require('../store/MySQLStore');
const db                     = require('../config/database');

let qrImageUrl = null;
let qrCreatedAt = null;
let readyAt    = null;
let client     = null;
let isConnected = false;

function getQRCreatedAt() { return qrCreatedAt; }
function getIsConnected() { return isConnected; } 
function getQRImageUrl() { return qrImageUrl; }
function getClient()     { return client; }
const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT;

function initWhatsApp() {
  const store = new MySQLStore(db);

  client = new Client({
  authStrategy: isLocal
    ? new LocalAuth({ clientId: 'chatbot' })
    : new RemoteAuth({
        clientId: 'chatbot',
        store,
        backupSyncIntervalMs: 60000,
      }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--no-first-run', '--no-zygote', '--single-process',
      ],
    },
  });

  process.on('unhandledRejection', (reason) => {
    if (reason?.message?.includes('Execution context was destroyed') ||
        reason?.message?.includes('Protocol error')) {
      return; // ignorar estos errores de puppeteer
    }
    console.error('[Error]', reason);
  });

  client.on('qr', async (qr) => {
    qrcode.generate(qr, { small: true });
    isConnected = false;
    qrImageUrl = await QRCode.toDataURL(qr);
    console.log('[WhatsApp] QR actualizado en /qr');
    qrCreatedAt = Date.now();
  });

  client.on('auth_failure', () => {
    isConnected = false;
    qrImageUrl  = null;
    qrCreatedAt = null;
    console.warn('[WhatsApp] Auth failure — sesión perdida');
  });

  client.on('authenticated', () => {
    qrImageUrl = null;
    console.log('[WhatsApp] Sesión autenticada correctamente.');
  });

  client.on('ready', () => {
    readyAt = Date.now();
    isConnected = true;
    console.log('[WhatsApp] Cliente listo y escuchando mensajes...');
  });

  client.on('remote_session_saved', () => {
    console.log('[WhatsApp] Sesión guardada en MySQL ✅');
  });

  client.on('disconnected', (reason) => {
    isConnected = false;
    qrImageUrl  = null;
    qrCreatedAt = null;
    console.warn('[WhatsApp] Desconectado:', reason);
  });

  client.on('message', (msg) => handleIncomingMessage(client, msg, readyAt));

  client.initialize();
}

module.exports = { initWhatsApp, getQRImageUrl, getQRCreatedAt, getClient, getIsConnected };
