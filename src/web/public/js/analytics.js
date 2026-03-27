/* ── Panel de Analítica Avanzada ─────────────────────────────── */

// ── Configuración de tiers (persistida en backend) ───────────────
const DEFAULT_CFG = {
  window:           0,       // 0 = todos los tiempos, N = últimos N días
  vipPct:           10,      // top X% por gasto
  goldPurchases:    7,
  goldSpent:        500000,
  silverPurchases:  3,
  silverSpent:      200000,
  bronzePurchases:  1,
  degradeEnabled:   false,
  degradeDays:      30,
};

async function loadCfg() {
  try {
    const res = await fetch('/api/analytics/adv/config');
    if (!res.ok) return { ...DEFAULT_CFG };
    const data = await res.json();
    return data ? { ...DEFAULT_CFG, ...data } : { ...DEFAULT_CFG };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

async function saveCfg(newCfg) {
  try {
    await fetch('/api/analytics/adv/config', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(newCfg),
    });
  } catch (e) {
    console.error('[Analytics] Error guardando configuración:', e);
  }
}

let cfg = { ...DEFAULT_CFG };

// ── Estado global ────────────────────────────────────────────────
let dateFrom = null;
let dateTo   = null;
let trendGroup = 'day';
let rankingTier = 'all';

// Instancias Chart.js
const charts = {};

// ── Utilidades ──────────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-CO').format(n);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function deltaClass(val) {
  if (val > 0) return 'adv-card__delta--up';
  if (val < 0) return 'adv-card__delta--down';
  return 'adv-card__delta--flat';
}

function deltaText(val) {
  if (val == null || !isFinite(val)) return '';
  const sign = val > 0 ? '▲' : val < 0 ? '▼' : '—';
  return `${sign} ${Math.abs(val).toFixed(1)}% vs período anterior`;
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function buildParams() {
  const p = new URLSearchParams();
  if (dateFrom) p.set('from', dateFrom);
  if (dateTo)   p.set('to',   dateTo);
  return p.toString() ? '?' + p.toString() : '';
}

// ── Período preset ───────────────────────────────────────────────
function setPreset(preset) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  let from, to;

  if (preset === 'today') {
    from = to = iso(now);
  } else if (preset === 'week') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    from = iso(mon); to = iso(now);
  } else if (preset === 'month') {
    from = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
    to   = iso(now);
  } else if (preset === 'year') {
    from = `${now.getFullYear()}-01-01`;
    to   = iso(now);
  }

  dateFrom = from;
  dateTo   = to;

  const fromEl = document.getElementById('adv-date-from');
  const toEl   = document.getElementById('adv-date-to');
  if (fromEl) fromEl.value = from;
  if (toEl)   toEl.value   = to;

  refreshAll();
}

// ── Carga todos los datos ────────────────────────────────────────
function refreshAll() {
  loadRevenue();
  loadTrend();
  loadTopProducts();
  loadTopClients();
  loadClientRanking();
  loadCombos();
  loadInactiveClients();
}

// Solo weekday y hour se cargan una vez (todos los tiempos)
function loadTimeCharts() {
  loadWeekday();
  loadHour();
}

// ── 1. Cards de ingresos ─────────────────────────────────────────
async function loadRevenue() {
  try {
    const res  = await fetch('/api/analytics/adv/revenue' + buildParams());
    const data = await res.json();

    const { revenue, count, avg_ticket, prev_revenue, prev_count, projection } = data;

    document.getElementById('adv-revenue').textContent = fmt(revenue);
    document.getElementById('adv-count').textContent   = fmtNum(count);
    document.getElementById('adv-avg-ticket').textContent = fmt(avg_ticket);

    // Deltas
    const revDelta  = prev_revenue > 0 ? ((revenue - prev_revenue) / prev_revenue * 100) : null;
    const cntDelta  = prev_count   > 0 ? ((count   - prev_count)   / prev_count   * 100) : null;

    const revDeltaEl = document.getElementById('adv-revenue-delta');
    const cntDeltaEl = document.getElementById('adv-count-delta');

    if (revDeltaEl) {
      revDeltaEl.textContent  = deltaText(revDelta);
      revDeltaEl.className    = 'adv-card__delta ' + deltaClass(revDelta);
    }
    if (cntDeltaEl) {
      cntDeltaEl.textContent  = deltaText(cntDelta);
      cntDeltaEl.className    = 'adv-card__delta ' + deltaClass(cntDelta);
    }

    // Proyección
    const projEl    = document.getElementById('adv-projection');
    const projSubEl = document.getElementById('adv-projection-sub');
    if (projEl) {
      projEl.textContent = fmt(projection);
      if (projSubEl) projSubEl.textContent = 'Proyección al cierre del período';
    }

  } catch (e) {
    console.error('[Analytics] revenue:', e);
  }
}

// ── 2. Tendencia de ventas ────────────────────────────────────────
async function loadTrend() {
  try {
    const params = buildParams();
    const sep    = params ? '&' : '?';
    const res    = await fetch('/api/analytics/adv/trend' + params + sep + 'group=' + trendGroup);
    const rows   = await res.json();

    const labels   = rows.map(r => r.label);
    const revenues = rows.map(r => Number(r.revenue));
    const counts   = rows.map(r => Number(r.count));

    destroyChart('trend');
    const ctx = document.getElementById('chart-trend');
    if (!ctx) return;

    charts['trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos',
            data: revenues,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.08)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y',
            pointRadius: labels.length > 30 ? 0 : 3,
          },
          {
            label: 'Ventas',
            data: counts,
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            tension: 0.3,
            yAxisID: 'y2',
            borderDash: [4, 3],
            pointRadius: labels.length > 30 ? 0 : 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.yAxisID === 'y'
                ? ' ' + fmt(ctx.parsed.y)
                : ' ' + fmtNum(ctx.parsed.y) + ' ventas',
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 11 }, maxTicksLimit: 12 }, grid: { display: false } },
          y:  { position: 'left',  ticks: { font: { size: 11 }, callback: v => fmt(v) } },
          y2: { position: 'right', ticks: { font: { size: 11 } }, grid: { drawOnChartArea: false } },
        },
      },
    });

  } catch (e) {
    console.error('[Analytics] trend:', e);
  }
}

// ── 3. Día pico ───────────────────────────────────────────────────
async function loadWeekday() {
  try {
    const res  = await fetch('/api/analytics/adv/by-weekday');
    const rows = await res.json();

    const labels   = rows.map(r => r.name);
    const revenues = rows.map(r => Number(r.revenue));
    const maxRev   = Math.max(...revenues);
    const colors   = revenues.map(v => v === maxRev ? '#6366f1' : 'rgba(99,102,241,0.35)');

    destroyChart('weekday');
    const ctx = document.getElementById('chart-weekday');
    if (!ctx) return;

    charts['weekday'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos',
          data: revenues,
          backgroundColor: colors,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.x) } },
        },
        scales: {
          x: { ticks: { font: { size: 11 }, callback: v => fmt(v) } },
          y: { ticks: { font: { size: 11 } } },
        },
      },
    });

  } catch (e) {
    console.error('[Analytics] weekday:', e);
  }
}

// ── 4. Hora pico ─────────────────────────────────────────────────
async function loadHour() {
  try {
    const res  = await fetch('/api/analytics/adv/by-hour');
    const rows = await res.json();

    const labels   = rows.map(r => `${String(r.hour).padStart(2,'0')}:00`);
    const revenues = rows.map(r => Number(r.revenue));
    const maxRev   = Math.max(...revenues);
    const colors   = revenues.map(v => v === maxRev ? '#6366f1' : 'rgba(99,102,241,0.35)');

    destroyChart('hour');
    const ctx = document.getElementById('chart-hour');
    if (!ctx) return;

    charts['hour'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos',
          data: revenues,
          backgroundColor: colors,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } },
        },
        scales: {
          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { font: { size: 11 }, callback: v => fmt(v) } },
        },
      },
    });

  } catch (e) {
    console.error('[Analytics] hour:', e);
  }
}

// ── 5. Top productos ─────────────────────────────────────────────
async function loadTopProducts() {
  try {
    const res  = await fetch('/api/analytics/adv/top-products' + buildParams());
    const data = await res.json();

    // Top por unidades
    renderTopList('adv-top-units', data.by_units, row => ({
      name:  row.name,
      meta:  `${fmtNum(row.units)} uds.`,
      value: fmt(row.revenue),
      bar:   data.by_units[0]?.units > 0 ? (row.units / data.by_units[0].units * 100) : 0,
    }));

    // Top por ingresos
    renderTopList('adv-top-revenue', data.by_revenue, row => ({
      name:  row.name,
      meta:  `${fmtNum(row.units)} uds.`,
      value: fmt(row.revenue),
      bar:   data.by_revenue[0]?.revenue > 0 ? (row.revenue / data.by_revenue[0].revenue * 100) : 0,
    }));

    // Productos inactivos
    renderInactiveProducts('adv-inactive-products', data.inactive);
    const inactPanel = document.getElementById('adv-inactive-products-panel');
    if (inactPanel) inactPanel.hidden = !data.inactive?.length;

  } catch (e) {
    console.error('[Analytics] top-products:', e);
  }
}

function renderTopList(containerId, rows, mapper) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<div class="adv-empty">Sin datos</div>'; return; }

  el.innerHTML = rows.map((row, i) => {
    const { name, meta, value, bar } = mapper(row);
    return `
      <div class="adv-top-item">
        <span class="adv-top-item__rank">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span class="adv-top-item__name">${name}</span>
            <span class="adv-top-item__value">${value}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div class="adv-progress-bar" style="flex:1">
              <div class="adv-progress-bar__fill" style="width:${bar}%"></div>
            </div>
            <span class="adv-top-item__meta">${meta}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderInactiveProducts(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<div class="adv-empty">Sin productos inactivos</div>'; return; }

  el.innerHTML = rows.map(row => `
    <div class="adv-inactive-item">
      <span class="adv-inactive-item__name">${row.name}</span>
      <span class="adv-inactive-item__phone">${fmtDate(row.last_sale)}</span>
      <span class="adv-inactive-item__days">${row.days_inactive}d sin ventas</span>
    </div>`).join('');
}

// ── 6. Top clientes ──────────────────────────────────────────────
async function loadTopClients() {
  try {
    const res  = await fetch('/api/analytics/adv/top-clients' + buildParams());
    const data = await res.json();

    renderTopList('adv-top-freq', data.by_frequency, row => ({
      name:  row.name,
      meta:  `${fmtNum(row.purchases)} compras`,
      value: fmt(row.total_spent),
      bar:   data.by_frequency[0]?.purchases > 0 ? (row.purchases / data.by_frequency[0].purchases * 100) : 0,
    }));

    renderTopList('adv-top-spend', data.by_spend, row => ({
      name:  row.name,
      meta:  `${fmtNum(row.purchases)} compras`,
      value: fmt(row.total_spent),
      bar:   data.by_spend[0]?.total_spent > 0 ? (row.total_spent / data.by_spend[0].total_spent * 100) : 0,
    }));

  } catch (e) {
    console.error('[Analytics] top-clients:', e);
  }
}

// ── 7. Ranking de clientes ────────────────────────────────────────
let rankingData    = [];
let rankingPage    = 1;
let rankingPerPage = 10;

function calcTier(client, vipThreshold) {
  const { purchases, total_spent, days_since } = client;

  // Degradación: si está activa y el cliente lleva más de N días sin comprar, restar 1 nivel al final
  let base;
  if (total_spent >= vipThreshold)                                              base = 'vip';
  else if (purchases >= cfg.goldPurchases   || total_spent >= cfg.goldSpent)   base = 'gold';
  else if (purchases >= cfg.silverPurchases || total_spent >= cfg.silverSpent) base = 'silver';
  else if (purchases >= cfg.bronzePurchases)                                    base = 'bronze';
  else                                                                           base = 'new';

  if (cfg.degradeEnabled && days_since != null && days_since >= cfg.degradeDays) {
    const ORDER = ['new', 'bronze', 'silver', 'gold', 'vip'];
    const idx = ORDER.indexOf(base);
    base = ORDER[Math.max(0, idx - 1)];
  }

  return base;
}

const TIER_LABEL = {
  vip:    '💎 VIP',
  gold:   '🥇 Gold',
  silver: '🥈 Silver',
  bronze: '🥉 Bronze',
  new:    'Nuevo',
};

async function loadClientRanking() {
  try {
    const params = cfg.window > 0 ? `?days=${cfg.window}` : '';
    const res    = await fetch('/api/analytics/adv/client-ranking' + params);
    const rows   = await res.json();

    // VIP = top X% por gasto (solo clientes que han comprado algo)
    const withPurchases = rows.filter(r => r.total_spent > 0).sort((a, b) => b.total_spent - a.total_spent);
    const vipCount  = Math.max(1, Math.ceil(withPurchases.length * (cfg.vipPct / 100)));
    const vipThresh = withPurchases.length > 0
      ? withPurchases[vipCount - 1].total_spent
      : Infinity;

    rankingData = rows.map(r => ({ ...r, tier: calcTier(r, vipThresh) }));
    renderRanking();

  } catch (e) {
    console.error('[Analytics] client-ranking:', e);
  }
}

function renderRanking() {
  const tbody      = document.getElementById('adv-ranking-body');
  const emptyEl    = document.getElementById('adv-ranking-empty');
  const countEl    = document.getElementById('adv-ranking-count');
  const pagEl      = document.getElementById('adv-ranking-pagination');
  if (!tbody) return;

  const filtered = rankingTier === 'all'
    ? rankingData
    : rankingData.filter(r => r.tier === rankingTier);

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    if (countEl) countEl.textContent = '';
    if (pagEl)   pagEl.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  // Ajustar página si quedó fuera de rango al cambiar filtro o perPage
  const totalPages = Math.ceil(filtered.length / rankingPerPage);
  if (rankingPage > totalPages) rankingPage = totalPages;

  const start = (rankingPage - 1) * rankingPerPage;
  const page  = filtered.slice(start, start + rankingPerPage);

  if (countEl) countEl.textContent = `${filtered.length} clientes`;

  tbody.innerHTML = page.map(r => `
    <tr>
      <td><span class="adv-tier-badge adv-tier-badge--${r.tier}">${TIER_LABEL[r.tier]}</span></td>
      <td>${r.name}</td>
      <td>${fmtNum(r.purchases)}</td>
      <td>${fmt(r.total_spent)}</td>
      <td>${fmtDate(r.last_purchase)}</td>
      <td>${r.days_since != null ? r.days_since + 'd' : '—'}</td>
    </tr>`).join('');

  // Paginación
  if (!pagEl) return;
  if (totalPages <= 1) { pagEl.innerHTML = ''; return; }

  const prevDis = rankingPage === 1          ? 'disabled' : '';
  const nextDis = rankingPage === totalPages ? 'disabled' : '';

  // Ventana de páginas: máx 5 botones
  const WINDOW = 2;
  let pStart = Math.max(1, rankingPage - WINDOW);
  let pEnd   = Math.min(totalPages, rankingPage + WINDOW);
  if (pEnd - pStart < WINDOW * 2) {
    pStart = Math.max(1, pEnd - WINDOW * 2);
    pEnd   = Math.min(totalPages, pStart + WINDOW * 2);
  }

  const pageButtons = [];
  for (let i = pStart; i <= pEnd; i++) {
    pageButtons.push(
      `<button class="tabla-pagination__page${i === rankingPage ? ' active' : ''}" data-p="${i}">${i}</button>`
    );
  }

  pagEl.innerHTML = `
    <button class="tabla-pagination__btn" id="rank-prev" ${prevDis}>&#8592;</button>
    <div class="tabla-pagination__pages">${pageButtons.join('')}</div>
    <button class="tabla-pagination__btn" id="rank-next" ${nextDis}>&#8594;</button>`;

  pagEl.querySelector('#rank-prev')?.addEventListener('click', () => { rankingPage--; renderRanking(); });
  pagEl.querySelector('#rank-next')?.addEventListener('click', () => { rankingPage++; renderRanking(); });
  pagEl.querySelectorAll('.tabla-pagination__page').forEach(btn => {
    btn.addEventListener('click', () => { rankingPage = Number(btn.dataset.p); renderRanking(); });
  });
}

// ── 8. Combos naturales ──────────────────────────────────────────
async function loadCombos() {
  try {
    const res  = await fetch('/api/analytics/adv/combos');
    const rows = await res.json();

    const el = document.getElementById('adv-combos-list');
    const panel = document.getElementById('adv-combos-panel');
    if (!el) return;

    if (!rows?.length) {
      if (panel) panel.hidden = true;
      return;
    }
    if (panel) panel.hidden = false;

    el.innerHTML = rows.map(r => `
      <div class="adv-combo-item">
        <div class="adv-combo-item__products">
          <span>${r.prod_a}</span>
          <span class="adv-combo-item__sep">+</span>
          <span>${r.prod_b}</span>
        </div>
        <span class="adv-combo-item__times">${fmtNum(r.times)}×</span>
      </div>`).join('');

  } catch (e) {
    console.error('[Analytics] combos:', e);
  }
}

// ── 9. Clientes inactivos ─────────────────────────────────────────
async function loadInactiveClients() {
  try {
    const res  = await fetch('/api/analytics/adv/inactive-clients?days=30');
    const rows = await res.json();

    const el    = document.getElementById('adv-inactive-clients');
    const panel = document.getElementById('adv-inactive-clients-panel');
    if (!el) return;

    if (!rows?.length) {
      if (panel) panel.hidden = true;
      return;
    }
    if (panel) panel.hidden = false;

    el.innerHTML = rows.map(r => `
      <div class="adv-inactive-item">
        <span class="adv-inactive-item__name">${r.name}</span>
        <span class="adv-inactive-item__phone">${r.phone}</span>
        <span class="adv-inactive-item__days">${r.days_inactive}d sin comprar</span>
      </div>`).join('');

  } catch (e) {
    console.error('[Analytics] inactive-clients:', e);
  }
}

// ── Init flatpickr para rango personalizado ──────────────────────
function initDatePickers() {
  if (typeof flatpickr === 'undefined') return;

  const fpCfg = { dateFormat: 'Y-m-d', locale: 'es', allowInput: false };

  flatpickr('#adv-date-from', {
    ...fpCfg,
    onChange([date], str) {
      if (!date) return;
      dateFrom = str;
      if (dateTo && str > dateTo) { dateTo = str; document.getElementById('adv-date-to').value = str; }
      clearPresetActive();
      refreshAll();
    },
  });

  flatpickr('#adv-date-to', {
    ...fpCfg,
    onChange([date], str) {
      if (!date) return;
      dateTo = str;
      if (dateFrom && str < dateFrom) { dateFrom = str; document.getElementById('adv-date-from').value = str; }
      clearPresetActive();
      refreshAll();
    },
  });
}

// ── Modal de configuración ────────────────────────────────────────
function openConfigModal() {
  const overlay = document.getElementById('adv-cfg-overlay');
  if (!overlay) return;

  // Poblar formulario con config actual
  const windowVal = String(cfg.window);
  document.querySelectorAll('input[name="cfg-window"]').forEach(r => {
    r.checked = r.value === windowVal;
  });
  document.getElementById('cfg-vip-pct').value          = cfg.vipPct;
  document.getElementById('cfg-gold-purchases').value    = cfg.goldPurchases;
  document.getElementById('cfg-gold-spent').value        = cfg.goldSpent;
  document.getElementById('cfg-silver-purchases').value  = cfg.silverPurchases;
  document.getElementById('cfg-silver-spent').value      = cfg.silverSpent;
  document.getElementById('cfg-bronze-purchases').value  = cfg.bronzePurchases;

  const degradeEl = document.getElementById('cfg-degrade-enabled');
  degradeEl.checked = cfg.degradeEnabled;
  document.getElementById('cfg-degrade-days').value = cfg.degradeDays;
  document.getElementById('cfg-degrade-opts').style.display = cfg.degradeEnabled ? 'flex' : 'none';
  document.getElementById('cfg-degrade-label').textContent  = cfg.degradeEnabled ? 'Activada' : 'Desactivada';

  overlay.classList.add('adv-cfg-overlay--open');
}

function closeConfigModal() {
  document.getElementById('adv-cfg-overlay')?.classList.remove('adv-cfg-overlay--open');
}

function initConfigModal() {
  // Abrir
  document.getElementById('adv-config-btn')?.addEventListener('click', openConfigModal);

  // Cerrar
  document.getElementById('adv-cfg-close')?.addEventListener('click',  closeConfigModal);
  document.getElementById('adv-cfg-cancel')?.addEventListener('click', closeConfigModal);
  document.getElementById('adv-cfg-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfigModal();
  });

  // Toggle degradación muestra/oculta opciones
  document.getElementById('cfg-degrade-enabled')?.addEventListener('change', function () {
    document.getElementById('cfg-degrade-opts').style.display  = this.checked ? 'flex' : 'none';
    document.getElementById('cfg-degrade-label').textContent   = this.checked ? 'Activada' : 'Desactivada';
  });

  // Guardar
  document.getElementById('adv-cfg-save')?.addEventListener('click', async () => {
    const windowRadio = document.querySelector('input[name="cfg-window"]:checked');

    cfg = {
      window:           windowRadio ? Number(windowRadio.value) : 0,
      vipPct:           Math.max(1, Math.min(50, Number(document.getElementById('cfg-vip-pct').value)         || 10)),
      goldPurchases:    Math.max(1, Number(document.getElementById('cfg-gold-purchases').value)                || 7),
      goldSpent:        Math.max(0, Number(document.getElementById('cfg-gold-spent').value)                   || 500000),
      silverPurchases:  Math.max(1, Number(document.getElementById('cfg-silver-purchases').value)             || 3),
      silverSpent:      Math.max(0, Number(document.getElementById('cfg-silver-spent').value)                 || 200000),
      bronzePurchases:  Math.max(1, Number(document.getElementById('cfg-bronze-purchases').value)             || 1),
      degradeEnabled:   document.getElementById('cfg-degrade-enabled').checked,
      degradeDays:      Math.max(1, Number(document.getElementById('cfg-degrade-days').value)                 || 30),
    };

    await saveCfg(cfg);
    closeConfigModal();
    loadClientRanking(); // Recalcular ranking con nueva config
  });
}

function clearPresetActive() {
  document.querySelectorAll('.adv-preset-btn').forEach(b => b.classList.remove('active'));
}

// ── Exportadas ───────────────────────────────────────────────────
export function refreshAdvAnalytics() { refreshAll(); }

export async function initAnalytics() {
  cfg = await loadCfg();
  // Preset buttons
  document.querySelectorAll('.adv-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.adv-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setPreset(btn.dataset.preset);
    });
  });

  // Toggle grupo tendencia
  document.querySelectorAll('.adv-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.adv-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trendGroup = btn.dataset.group;
      loadTrend();
    });
  });

  // Filtro de tier en ranking
  document.querySelectorAll('.adv-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.adv-tier-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rankingTier = btn.dataset.tier;
      rankingPage = 1;
      renderRanking();
    });
  });

  // Filas por página en ranking
  document.getElementById('adv-ranking-per-page')?.addEventListener('change', function () {
    rankingPerPage = Number(this.value);
    rankingPage    = 1;
    renderRanking();
  });

  // Modal de configuración
  initConfigModal();

  // Inicializar flatpickr
  initDatePickers();

  // Carga inicial: mes actual como preset
  setPreset('month');

  // Cargar gráficas de todos los tiempos (no dependen de fecha)
  loadTimeCharts();
}