const express    = require('express');
const router     = express.Router();
const { requireAuth }    = require('../middleware/auth');
const authCtrl            = require('../controllers/authController');
const statusCtrl          = require('../controllers/statusController');
const whatsappCtrl        = require('../controllers/whatsappController');
const userCtrl            = require('../controllers/userController');
const productCtrl         = require('../controllers/productController');
const invoiceCtrl         = require('../controllers/invoiceController');
const analyticsCtrl       = require('../controllers/analyticsController');
const settingsCtrl        = require('../controllers/settingsController');

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/login',   authCtrl.login);
router.get ('/auth/check',   authCtrl.check);
router.post('/auth/logout',  authCtrl.logout);

// ── Estado general ────────────────────────────────────────────
router.get('/status', statusCtrl.getStatus);

// ── WhatsApp ──────────────────────────────────────────────────
router.post('/whatsapp/connect',      requireAuth, whatsappCtrl.connect);
router.post('/whatsapp/disconnect',   requireAuth, whatsappCtrl.disconnect);
router.post('/whatsapp/restart',               whatsappCtrl.restart);
router.post('/whatsapp/pairing-code', requireAuth, whatsappCtrl.pairingCode);

// ── Usuarios ──────────────────────────────────────────────────
router.get   ('/users/search',    requireAuth, userCtrl.search);
router.post  ('/users/register',  requireAuth, userCtrl.register);
router.get   ('/users/:id',       requireAuth, userCtrl.getById);
router.put   ('/users/:id',       requireAuth, userCtrl.update);
router.post  ('/users/:id/info',  requireAuth, userCtrl.updateInfo);
router.delete('/users/:id',       requireAuth, userCtrl.remove);
router.get   ('/users/:id/invoices', requireAuth, invoiceCtrl.getByUser);

// ── Productos ─────────────────────────────────────────────────
router.get('/products/list',   requireAuth, productCtrl.list);
router.get('/products/search', requireAuth, productCtrl.search);

// ── Facturas ──────────────────────────────────────────────────
router.get ('/invoices',     requireAuth, invoiceCtrl.list);
router.get ('/invoices/:id', requireAuth, invoiceCtrl.getById);
router.post('/invoices',     requireAuth, invoiceCtrl.create);

// ── Analítica básica ──────────────────────────────────────────
router.get('/analytics/invoices',    requireAuth, analyticsCtrl.invoiceSummary);
router.get('/analytics/users',       requireAuth, analyticsCtrl.userCount);
router.get('/analytics/users/list',         requireAuth, analyticsCtrl.userList);

// ── Analítica avanzada ────────────────────────────────────────
router.get('/analytics/adv/revenue',          requireAuth, analyticsCtrl.revenue);
router.get('/analytics/adv/trend',            requireAuth, analyticsCtrl.trend);
router.get('/analytics/adv/by-weekday',       requireAuth, analyticsCtrl.byWeekday);
router.get('/analytics/adv/by-hour',          requireAuth, analyticsCtrl.byHour);
router.get('/analytics/adv/top-products',     requireAuth, analyticsCtrl.topProducts);
router.get('/analytics/adv/top-clients',      requireAuth, analyticsCtrl.topClients);
router.get('/analytics/adv/client-ranking',   requireAuth, analyticsCtrl.clientRanking);
router.get('/analytics/adv/combos',           requireAuth, analyticsCtrl.combos);
router.get('/analytics/adv/inactive-clients', requireAuth, analyticsCtrl.inactiveClients);
router.get('/analytics/adv/config',           requireAuth, analyticsCtrl.getConfig);
router.put('/analytics/adv/config',           requireAuth, analyticsCtrl.saveConfig);

// ── Ajustes ───────────────────────────────────────────────────
router.get('/settings',              settingsCtrl.getAll);  // público: login y perfil lo necesitan sin sesión
router.put('/settings', requireAuth, settingsCtrl.save);

module.exports = router;
