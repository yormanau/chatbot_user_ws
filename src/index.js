require('dotenv').config();
const express            = require('express');
const { createServer }   = require('http');
const { Server }         = require('socket.io');
const { runMigrations }  = require('./config/migrate');
const { initWhatsApp }   = require('./services/whatsappServices');
const webRoutes          = require('./routes/web');
const apiRoutes          = require('./routes/api');
const cookieParser       = require('cookie-parser');

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());
app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use(express.static('src/web/public'));

const PUPPETEER_ERRORS = ['Execution context was destroyed', 'Protocol error', 'Target closed', 'Session closed'];
const isPuppeteerNoise = msg => PUPPETEER_ERRORS.some(e => msg?.includes(e));

process.on('uncaughtException', (err) => {
  if (isPuppeteerNoise(err?.message)) return;
  console.error('[Error crítico]', err);
});

process.on('unhandledRejection', (reason) => {
  if (isPuppeteerNoise(reason?.message)) return;
  console.error('[Rechazo no manejado]', reason);
});


async function start() {
  try {
    await runMigrations();

    httpServer.listen(PORT, () => {
      console.log(`[Server] Corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Error al iniciar:', err);
  }
}

async function shutdown() {
  console.log('[Server] Cerrando limpiamente...');
  const { getClient } = require('./services/whatsappServices');
  const client = getClient();
  if (client) {
    try {
      await client.destroy();
      console.log('[WhatsApp] Cliente destruido correctamente');
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { io };  // ← exporta io para usarlo en otros archivos

start();