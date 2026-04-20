const AnalyticsModel = require('../models/analyticsModel');
const SettingsModel  = require('../models/settingsModel');
const { normalizeNames } = require('../utils/normalizeNames');
const { toStr } = require('../middleware/auth');

async function invoiceSummary(req, res) {
  try {
    const row = await AnalyticsModel.invoiceSummary(req.query.filter);
    res.json({ count: Number(row.count), amount: Number(row.amount) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function userCount(req, res) {
  const { filter } = req.query;
  try {
    const total = await AnalyticsModel.userCount(filter);
    res.json({ filter, total });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: 'Error consultando analytics' });
  }
}

async function userList(req, res) {
  const { filter, sortBy = 'name', sortDir = 'ASC', page = 1, limit = 10, search = '' } = req.query;

  const validLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const validPage  = Math.max(1, Number(page));
  const offset     = (validPage - 1) * validLimit;

  try {
    const { total, rows } = await AnalyticsModel.userList(filter, search, sortBy, sortDir, validLimit, offset);

    res.json({
      data: rows.map(row => ({
        id:        row.id,
        name:      normalizeNames(toStr(row.name)),
        phone:     toStr(row.phone),
        create_at: row.create_at,
      })),
      total,
      page:       validPage,
      limit:      validLimit,
      totalPages: Math.ceil(total / validLimit),
    });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function revenue(req, res) {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to requeridos' });

  const fromDate     = new Date(from + 'T12:00:00Z');
  const toDate       = new Date(to   + 'T12:00:00Z');
  const durationDays = Math.round((toDate - fromDate) / 86400000) + 1;
  const isoDate      = d => d.toISOString().slice(0, 10);
  const prevToDate   = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (durationDays - 1) * 86400000);

  try {
    const cur  = await AnalyticsModel.revenue(from, to);
    const prev = await AnalyticsModel.prevRevenue(isoDate(prevFromDate), isoDate(prevToDate));

    const daysElapsed = Math.max(1, Math.min(durationDays, Math.round((new Date() - fromDate) / 86400000) + 1));
    const projection  = (Number(cur.revenue) / daysElapsed) * durationDays;

    res.json({
      revenue:      Number(cur.revenue),
      count:        Number(cur.count),
      avg_ticket:   Number(cur.avg_ticket),
      prev_revenue: Number(prev.revenue),
      prev_count:   Number(prev.count),
      projection:   Math.round(projection),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function trend(req, res) {
  const { from, to, group = 'day' } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to requeridos' });

  try {
    const rows = await AnalyticsModel.trend(group, from, to);
    res.json(rows.map(r => ({ label: r.label, count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function byWeekday(req, res) {
  try {
    const rows = await AnalyticsModel.byWeekday();
    res.json(rows.map(r => ({ dow: r.dow, name: r.name, count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function byHour(req, res) {
  try {
    const rows = await AnalyticsModel.byHour();
    res.json(rows.map(r => ({ hour: Number(r.hour), count: Number(r.count), revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function topProducts(req, res) {
  const { from, to } = req.query;

  try {
    const [byUnits, byRevenue, starOfMonth, inactive] = await Promise.all([
      AnalyticsModel.topProductsByUnits(from, to),
      AnalyticsModel.topProductsByRevenue(from, to),
      AnalyticsModel.starOfMonth(),
      AnalyticsModel.inactiveProducts(),
    ]);

    const map = r => ({ name: toStr(r.product_name || r.name), units: Number(r.units), revenue: Number(r.revenue || 0) });
    res.json({
      by_units:      byUnits.map(map),
      by_revenue:    byRevenue.map(map),
      star_of_month: starOfMonth ? toStr(starOfMonth.product_name) : null,
      inactive:      inactive.map(r => ({ name: toStr(r.name), last_sale: r.last_sale, days_inactive: Number(r.days_inactive) })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function topClients(req, res) {
  const { from, to } = req.query;

  try {
    const [byFreq, bySpend] = await Promise.all([
      AnalyticsModel.topClientsByFrequency(from, to),
      AnalyticsModel.topClientsBySpend(from, to),
    ]);

    const map = r => ({ id: r.id, name: normalizeNames(toStr(r.name)), phone: toStr(r.phone), purchases: Number(r.purchases), total_spent: Number(r.total_spent) });
    res.json({ by_frequency: byFreq.map(map), by_spend: bySpend.map(map) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function clientRanking(req, res) {
  const days = req.query.days ? parseInt(req.query.days, 10) : 0;

  try {
    const rows = await AnalyticsModel.clientRanking(days);
    res.json(rows.map(r => ({
      id:            r.id,
      name:          normalizeNames(toStr(r.name)),
      phone:         toStr(r.phone),
      purchases:     Number(r.purchases),
      total_spent:   Number(r.total_spent),
      last_purchase: r.last_purchase,
      days_since:    r.days_since != null ? Number(r.days_since) : null,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function combos(req, res) {
  try {
    const rows = await AnalyticsModel.combos();
    res.json(rows.map(r => ({ prod_a: toStr(r.prod_a), prod_b: toStr(r.prod_b), times: Number(r.times) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function inactiveClients(req, res) {
  const days = Math.max(1, Number(req.query.days) || 30);
  try {
    const rows = await AnalyticsModel.inactiveClients(days);
    res.json(rows.map(r => ({
      id:            r.id,
      name:          normalizeNames(toStr(r.name)),
      phone:         toStr(r.phone),
      last_purchase: r.last_purchase,
      days_inactive: Number(r.days_inactive),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getConfig(req, res) {
  try {
    const value = await SettingsModel.get('analytics_cfg');
    res.json(value ? JSON.parse(toStr(value)) : null);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function saveConfig(req, res) {
  try {
    await SettingsModel.set('analytics_cfg', JSON.stringify(req.body));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { invoiceSummary, userCount, userList, revenue, trend, byWeekday, byHour, topProducts, topClients, clientRanking, combos, inactiveClients, getConfig, saveConfig };
