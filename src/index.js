require('dotenv').config();
const express            = require('express');
const { createServer }   = require('http');
const { Server }         = require('socket.io');
const { runMigrations }  = require('./config/migrate');
const { initWhatsApp }   = require('./services/whatsappServices');
const webRoutes          = require('./routes/web');
const apiRoutes          = require('./routes/api');

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

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

process.on('unhandledRejection', (reason) => {
  if (reason?.message?.includes('Execution context was destroyed') ||
      reason?.message?.includes('Protocol error')) {
    console.warn('[WhatsApp] Promesa rechazada ignorada');
    return;
  }
  console.error('[Error no manejado]', reason);
});

async function start() {
  await runMigrations();
  initWhatsApp(io);
  httpServer.listen(PORT, () => {   // ← httpServer en lugar de app
    console.log(`[Server] Corriendo en puerto ${PORT}`);
  });
}

module.exports = { io };  // ← exporta io para usarlo en otros archivos

start();