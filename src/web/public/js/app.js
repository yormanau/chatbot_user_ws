import { showToast } from "./toast.js";
import { initQR } from "./qr.js";
import { initAnalytics, refreshAnalytics } from './analytics.js';

import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

const socket = io();
let unauthorized = false;


socket.on('user-registered', ({ nombre, telefono }) => {
  showToast('success', 'Nuevo usuario registrado', `${nombre} (${telefono})`);
  refreshAnalytics();
});


socket.on('whatsapp-unauthorized', async () => {
  if (unauthorized) return;
  unauthorized = true;
  document.getElementById('modal').hidden = true;
  showToast('error', 'Acceso denegado', 'Este número no está autorizado');
  await fetch('/api/whatsapp/restart', { method: 'POST' });
  setTimeout(() => unauthorized = false, 3000);
});


async function loadModule(containerId, file) {
  try {
    const res  = await fetch(`/modules/${file}`);
    const html = await res.text();
    document.getElementById(containerId).innerHTML = html;
  } catch (e) {
    console.error(`[App] Error cargando módulo ${file}:`, e);
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 't') {
    showToast('success', 'Usuario registrado', 'Juan Pérez se registró correctamente');
  }
});



// Desbloquea el audio con la primera interacción del usuario
document.addEventListener('click', () => {
  const audio = new Audio('/sounds/positive-notification.wav');
  audio.volume = 0;
  audio.play().catch(() => {});
}, { once: true }); // ← once: true para que solo se ejecute una vez

async function init() {

  await loadModule('topbar', 'topbar.html');
  await loadModule('qr-section', 'qr.html');
  await loadModule('toast-wrapper', 'toast.html');
  await loadModule('analytics-section', 'analytics_dashboard.html');
  await initAnalytics();
  initQR();
}

init();