import { abrirModalCompra }  from './compras.js';
import { openPerfilModal }   from './perfil.js';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

export async function initDashboard() {
  if (!document.getElementById('stat-total')) return;

  await Promise.all([
    refreshAnalytics(),
    refreshInvoiceAnalytics(),
    refreshRecentContacts(),
    refreshRecentInvoices(),
  ]);

  document.getElementById('btn-new-purchase-dash')?.addEventListener('click', () => {
    abrirModalCompra({ onSuccess: refreshInvoiceAnalytics });
  });
}

export async function refreshAnalytics() {
  const [resTotal, resToday, resWeek, resMonth] = await Promise.all([
    fetch('/api/analytics/users?filter=all'),
    fetch('/api/analytics/users?filter=today'),
    fetch('/api/analytics/users?filter=week'),
    fetch('/api/analytics/users?filter=month'),
  ]);

  const { total }        = await resTotal.json();
  const { total: today } = await resToday.json();
  const { total: week }  = await resWeek.json();
  const { total: month } = await resMonth.json();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
  set('stat-total', total);
  set('stat-today', today);
  set('stat-week',  week);
  set('stat-month', month);
}

export async function refreshInvoiceAnalytics() {
  const [resTotal, resToday, resWeek, resMonth] = await Promise.all([
    fetch('/api/analytics/invoices?filter=all'),
    fetch('/api/analytics/invoices?filter=today'),
    fetch('/api/analytics/invoices?filter=week'),
    fetch('/api/analytics/invoices?filter=month'),
  ]);

  const total = await resTotal.json();
  const today = await resToday.json();
  const week  = await resWeek.json();
  const month = await resMonth.json();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('inv-stat-total',        total.count);
  set('inv-stat-total-amount', formatCurrency(total.amount));
  set('inv-stat-today',        today.count);
  set('inv-stat-today-amount', formatCurrency(today.amount));
  set('inv-stat-week',         week.count);
  set('inv-stat-week-amount',  formatCurrency(week.amount));
  set('inv-stat-month',        month.count);
  set('inv-stat-month-amount', formatCurrency(month.amount));
}

export async function refreshWaStatus() {
  const dot      = document.getElementById('dash-wa-dot');
  const statusEl = document.getElementById('dash-wa-status');
  if (!dot || !statusEl) return;

  try {
    const data = await fetch('/api/status').then(r => r.json());

    if (data.connected) {
      dot.className = 'dash-wa-dot dash-wa-dot--connected';
      statusEl.textContent = `Conectado${data.botName ? ` · ${data.botName}` : ''}`;
    } else if (data.qr) {
      dot.className = 'dash-wa-dot dash-wa-dot--pending';
      statusEl.textContent = 'Esperando escaneo de QR';
    } else {
      dot.className = 'dash-wa-dot dash-wa-dot--disconnected';
      statusEl.textContent = 'Desconectado';
    }
  } catch {
    dot.className = 'dash-wa-dot dash-wa-dot--disconnected';
    statusEl.textContent = 'Sin conexión';
  }
}

export async function refreshRecentContacts() {
  const container = document.getElementById('dash-recent-contacts');
  if (!container) return;

  try {
    const data  = await fetch('/api/analytics/users/list?limit=5&sortBy=create_at&sortDir=DESC&filter=all').then(r => r.json());
    const users = data.data || [];

    if (!users.length) {
      container.innerHTML = '<div class="dash-recent-empty">Sin contactos aún</div>';
      return;
    }

    container.innerHTML = users.map(u => {
      const initials = u.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
      return `
        <div class="dash-recent-item" data-id="${u.id}">
          <div class="dash-recent-item__avatar">${initials}</div>
          <div class="dash-recent-item__info">
            <div class="dash-recent-item__name">${u.name}</div>
            <div class="dash-recent-item__sub">${u.phone}</div>
          </div>
          <span class="dash-recent-item__meta">${formatDate(u.create_at)}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.dash-recent-item').forEach(el => {
      el.addEventListener('click', () => openPerfilModal(Number(el.dataset.id)));
    });
  } catch (e) {
    console.error('[dashboard] recent contacts', e);
  }
}

export async function refreshRecentInvoices() {
  const container = document.getElementById('dash-recent-invoices');
  if (!container) return;

  try {
    const data     = await fetch('/api/invoices?limit=5&sortBy=created_at&sortDir=DESC').then(r => r.json());
    const invoices = data.data || [];

    if (!invoices.length) {
      container.innerHTML = '<div class="dash-recent-empty">Sin ventas aún</div>';
      return;
    }

    container.innerHTML = invoices.map(inv => {
      const initials = inv.user_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
      return `
        <div class="dash-recent-item">
          <div class="dash-recent-item__avatar">${initials}</div>
          <div class="dash-recent-item__info">
            <div class="dash-recent-item__name">${inv.user_name}</div>
            <div class="dash-recent-item__sub">${inv.num_items} producto${inv.num_items !== 1 ? 's' : ''}</div>
          </div>
          <span class="dash-recent-item__amount">${formatCurrency(inv.total)}</span>
          <span class="dash-recent-item__meta">${formatDate(inv.created_at)}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('[dashboard] recent invoices', e);
  }
}
