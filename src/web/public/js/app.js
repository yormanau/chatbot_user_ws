import { showToast }                                       from './toast.js';
import { initDashboard, refreshAnalytics, refreshInvoiceAnalytics, refreshRecentContacts, refreshRecentInvoices  } from './home.js';
import { initContacts }                                    from './contacts.js';
import { initPurchases }                                   from './compras.js';
import { initProducts }                                    from './products.js';
import { initRegistrarUsuario, abrirFormularioRegistro }   from './register.js';
import { initAjustes }                                      from './ajustes.js';
import { applySettings }                                    from './themeSettings.js';

import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

const socket = io();
let unauthorized = false;

let reloadContacts  = () => {};
let reloadPurchases = () => {};

socket.on('user-registered', ({ nombre, telefono }) => {
  showToast('success', 'Nuevo contacto registrado', `${nombre} (${telefono})`);
  refreshAnalytics();
  refreshRecentContacts();
  reloadContacts();
});

socket.on('invoice-created', () => {
  refreshInvoiceAnalytics();
  refreshRecentInvoices();
  reloadPurchases();
});

// ── Navegación entre secciones ─────────────────────────────────
const SECTION_TITLES = {
  dashboard: 'Dashboard',
  contacts:  'Contactos',
  purchases: 'Ventas',
  products:  'Productos',
  settings:  'Ajustes',
};

export function navigateTo(sectionId) {
  Object.keys(SECTION_TITLES).forEach(id => {
    document.getElementById(`section-${id}`).hidden = (id !== sectionId);
    document.querySelector(`.sidebar-nav__item[data-section="${id}"]`)
      ?.classList.toggle('active', id === sectionId);
  });
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = SECTION_TITLES[sectionId] || sectionId;
}

// ── Carga de módulos HTML ──────────────────────────────────────
async function loadModule(containerId, file) {
  try {
    const res  = await fetch(`/modules/${file}`);
    const html = await res.text();
    document.getElementById(containerId).innerHTML = html;
  } catch (e) {
    console.error(`[App] Error cargando módulo ${file}:`, e);
  }
}


async function init() {
  // Aplicar ajustes guardados (color, nombre, logo/favicon)
  await applySettings();

  // Topbar
  await loadModule('topbar-container', 'topbar.html');

  // Secciones en paralelo
  await Promise.all([
    loadModule('section-dashboard', 'home.html'),
    loadModule('section-contacts',  'contacts.html'),
    loadModule('section-purchases', 'compras.html'),
    loadModule('section-products',  'products.html'),
    loadModule('section-settings',  'ajustes.html'),
  ]);

  // Sidebar: navegación
  document.querySelectorAll('.sidebar-nav__item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.section);
      document.getElementById('sidebar').classList.remove('sidebar--open');
    });
  });

  // Sidebar: logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Mobile: toggle sidebar
  document.getElementById('sidebar-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('sidebar').classList.toggle('sidebar--open');
  });
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('sidebar--open') && !sidebar.contains(e.target)) {
      sidebar.classList.remove('sidebar--open');
    }
  });

  // WhatsApp: desconectar
  document.getElementById('btn-disconnect-wa')?.addEventListener('click', async () => {
    if (!confirm('¿Desconectar WhatsApp? Se cerrará la sesión activa.')) return;
    await fetch('/api/whatsapp/disconnect', { method: 'POST' });
  });

  // Dashboard: botón nuevo contacto
  document.getElementById('btn-new-contact-dash')?.addEventListener('click', () => {
    abrirFormularioRegistro();
  });

  // Dashboard: ver todos los contactos
  document.getElementById('btn-ver-contactos')?.addEventListener('click', () => {
    navigateTo('contacts');
  });

  // Init módulos
  await initDashboard();
  ({ reload: reloadContacts }  = initContacts()  ?? { reload: () => {} });
  ({ reload: reloadPurchases } = initPurchases() ?? { reload: () => {} });
  initProducts();
  initRegistrarUsuario();
  initAjustes();

  // Polling de respaldo cada 30 s
  setInterval(() => { refreshAnalytics(); refreshInvoiceAnalytics(); }, 30_000);

}

init();
