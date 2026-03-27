import { abrirModalCompra } from './compras.js';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

export async function initDashboard() {
  if (!document.getElementById('stat-total')) return;

  await Promise.all([refreshAnalytics(), refreshInvoiceAnalytics()]);

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