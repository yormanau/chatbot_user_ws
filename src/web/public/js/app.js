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
  await loadModule('app', 'qr.html');
  initQR();
}

init();