require('dotenv').config();
const express            = require('express');
const { createServer }   = require('http');
const { Server }         = require('socket.io');
const { runMigrations }  = require('./config/migrate');
const { initWhatsApp, checkExistingSession }   = require('./services/whatsappServices');
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

process.on('uncaughtException', (err) => {
  if (err?.message?.includes('Execution context was destroyed') ||
      err?.message?.includes('Protocol error')) {
    console.warn('[WhatsApp] Contexto destruido, continuando...');
    return;
  }
  console.error('[Error crítico]', err);
});


async function start() {
  try {
    await runMigrations();

    // ── Auto-conectar si ya hay sesión guardada ──
    const hasSession = await checkExistingSession();
    if (hasSession) {
      console.log('[WhatsApp] Sesión existente encontrada, conectando automáticamente...');
      initWhatsApp(io);
    }

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