const { Client, RemoteAuth, LocalAuth } = require('whatsapp-web.js');
const qrcode                 = require('qrcode-terminal');
const QRCode                 = require('qrcode');
const { handleIncomingMessage } = require('../handlers/messageHandler');
const MySQLStore             = require('../store/MySQLStore');
const db                     = require('../config/database');
const fs   = require('fs');
const path = require('path');

let manualStop = false;
let isUnauthorized = false; 
let ioInstance = null; 
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
function getBotName() {
  return client?.info?.pushname || null;
}

function initWhatsApp(io) {
  if (client) {
    console.warn('[WhatsApp] Ya hay una instancia corriendo, ignorando initWhatsApp');
    return;
  }
  ioInstance = io; // ← guarda la instancia de io para usarla en restartWhatsApp
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
        '--disable-session-crashed-bubble', // ← ignora crashes anteriores
        '--disable-infobars',
      ],
      userDataDir: undefined, // ← deja que LocalAuth lo maneje
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
    
    const myNumber = client.info.wid.user;
    const allowed  = process.env.ALLOWED_NUMBERS.split(',').map(n => n.trim());

    if (!allowed.includes(myNumber)) {
      console.warn(`[WhatsApp] Número no autorizado: ${myNumber}`);
      isUnauthorized = true; // ← marca como no autorizado
      ioInstance.emit('whatsapp-unauthorized');
      client.logout();
      isConnected = false;
      return;
    }

    isConnected = true;
    ioInstance.emit('whatsapp-ready');
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

    if (isUnauthorized) {
      isUnauthorized = false;
      return;
    }

    if (manualStop) {
      manualStop = false; // ← resetea para próximas conexiones
      return;
    }

    setTimeout(() => {
      console.log('[WhatsApp] Reintentando conexión...');
      client = null; // ← limpia antes de reiniciar
      initWhatsApp(ioInstance);
    }, 5000);
  });

  client.on('message', (msg) => handleIncomingMessage(client, msg, readyAt, io)); // ← pasa io

  client.initialize();

  
}

async function stopWhatsApp() {
  if (!client) return;
  manualStop = true;
  isUnauthorized = false;

  try {
    await client.logout();
  } catch {}

  try {
    client.removeAllListeners();
    await client.destroy();
  } catch {}

  client      = null;
  qrImageUrl  = null;
  qrCreatedAt = null;
  isConnected = false;
  readyAt     = null;
  if (isLocal) {
    const authPath  = path.join(process.cwd(), '.wwebjs_auth');
    const cachePath = path.join(process.cwd(), '.wwebjs_cache');
    if (fs.existsSync(authPath))  fs.rmSync(authPath,  { recursive: true, force: true });
    if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true });
    console.log('[WhatsApp] Carpetas de sesión eliminadas');
  } else {
    try {
      const store = new MySQLStore(db);
      await store.delete('RemoteAuth-chatbot');
      console.log('[WhatsApp] Sesión eliminada de MySQL');
    } catch {}
  }

  if (ioInstance) ioInstance.emit('whatsapp-stopped');
  console.log('[WhatsApp] Sesión cerrada y lista para nuevo QR');
}

function restartWhatsApp() {
  if (client) {
    client.destroy().catch(() => {});
    client = null;
  }

  if (isLocal) {
    const authPath  = path.join(process.cwd(), '.wwebjs_auth');
    const cachePath = path.join(process.cwd(), '.wwebjs_cache');
    if (fs.existsSync(authPath))  fs.rmSync(authPath,  { recursive: true, force: true });
    if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true });
  } else {
    // Limpiar sesión de MySQL
    const store = new MySQLStore(db);
    store.delete('RemoteAuth-chatbot').catch(() => {});
  }

  qrImageUrl    = null;
  qrCreatedAt   = null;
  readyAt       = null;
  isConnected   = false;
  isUnauthorized = false;

  console.log('[WhatsApp] Sesión limpiada, reiniciando...');
  initWhatsApp(ioInstance);
}

async function checkExistingSession() {
  if (isLocal) {
    // En local verifica si existe la carpeta de auth
    const authPath = path.join(process.cwd(), '.wwebjs_auth');
    return fs.existsSync(authPath);
  } else {
    // En producción verifica si existe la sesión en MySQL
    try {
      const store = new MySQLStore(db);
      const session = await store.extract('RemoteAuth-chatbot');
      return !!session;
    } catch {
      return false;
    }
  }
}

module.exports = { initWhatsApp, getQRImageUrl, getQRCreatedAt, getClient, getIsConnected, getBotName, restartWhatsApp, stopWhatsApp, checkExistingSession };
