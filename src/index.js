require('dotenv').config();
const express            = require('express');
const { runMigrations }  = require('./config/migrate');
const { initWhatsApp }   = require('./services/whatsappServices');
const webRoutes          = require('./routes/web');
const apiRoutes = require('./routes/api');




const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use(express.static('src/web/public'));

async function start() {
  await runMigrations();
  initWhatsApp();
  app.listen(PORT, () => {
    console.log(`[Server] Corriendo en puerto ${PORT}`);
  });
}

start();