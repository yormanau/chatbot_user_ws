const QR_DURATION = 60;
let timerInterval = null;
let secondsLeft   = QR_DURATION;
let lastQR        = null;
let closingModal  = false;
import { showToast } from './toast.js';

export function initQR() {
  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const btnConnect = document.getElementById('btn-connect');
  const modal      = document.getElementById('modal');
  const modalClose = document.getElementById('modal-close');
  const qrImg      = document.getElementById('qr-img');
  const timerBar   = document.getElementById('timer-bar');
  const modalBody  = document.querySelector('.modal-body');
  const timer = document.getElementById('timer');
  const connectedView    = document.getElementById('connected-view');
  const disconnectedView = document.getElementById('disconnected-view');
  const statusName = document.getElementById('status-name');

  async function fetchStatus() {
    try {
      const res  = await fetch('/api/status');
      const data = await res.json();
      updateUI(data);
    } catch (e) {
      console.error('[Status] Error:', e);
    }
  }

  function updateUI({ connected, qr, secondsLeft: sLeft, botName }) {
    const sidebarDot = document.getElementById('sidebar-wa-dot');

    if (connected) {
      if (sidebarDot) sidebarDot.className = 'sidebar-wa-dot connected';
      statusDot.className    = 'status-dot connected';
      statusName.textContent = botName || '';
      statusText.textContent = '(Conectado)';
      btnConnect.disabled    = true;
      connectedView.hidden    = false;
      disconnectedView.hidden = true;

      if (!modal.hidden && !closingModal) {
        closingModal = true;
        stopTimer();
        qrImg.style.display              = 'none';
        timerBar.parentElement.style.display = 'none';
        document.querySelector('.timer-row').style.display = 'none';

        const msg = document.createElement('div');
        msg.id    = 'success-msg';
        msg.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 0;';
        msg.innerHTML = `
          <div style="font-size:48px">✅</div>
          <p style="font-weight:600;font-size:16px;color:var(--text)">¡Conectado correctamente!</p>
          <p style="font-size:13px;color:var(--muted)">Cerrando en <span id="countdown">3</span> segundos...</p>
        `;
        modalBody.appendChild(msg);

        let count = 3;
        const countdown = setInterval(() => {
          count--;
          const span = document.getElementById('countdown');
          if (span) span.textContent = count;
          if (count <= 0) {
            clearInterval(countdown);
            closeModal();
            msg.remove();
            qrImg.style.display                                = '';
            timerBar.parentElement.style.display               = '';
            document.querySelector('.timer-row').style.display = '';
            closingModal = false;
          }
        }, 1000);
      }

    } else {
      if (sidebarDot) sidebarDot.className = 'sidebar-wa-dot';
      statusDot.className     = 'status-dot disconnected';
      statusName.textContent  = '';
      statusText.textContent  = 'WhatsApp desconectado';
      btnConnect.disabled     = false;
      connectedView.hidden    = true;
      disconnectedView.hidden = false;

      if (!modal.hidden && qr && qr !== lastQR) {
        lastQR    = qr;
        qrImg.src = qr;
        startTimer(sLeft);
      }
    }
  }

  async function openModal() {
    // ── Estado de carga en el botón ──
    const originalHTML = btnConnect.innerHTML;
    btnConnect.disabled = true;
    btnConnect.innerHTML = `
      <span>Conectando</span>
      <svg class="btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
          stroke-dasharray="31.4" stroke-dashoffset="10" opacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;

    await fetch('/api/whatsapp/connect', { method: 'POST' });

    // ── Polling hasta que el QR esté disponible (máx 20s) ──
    let data = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch('/api/status');
      data = await res.json();
      if (data.qr) break;
      if (data.connected) break;
    }

    // ── Restaurar botón ──
    btnConnect.innerHTML = originalHTML;
    btnConnect.disabled  = false;

    if (!data || (!data.qr && !data.connected)) {
      showToast('error', 'Error', 'No se pudo obtener el QR, intenta de nuevo');
      return;
    }

    if (data.connected) return; // ya estaba conectado

    lastQR       = data.qr;
    qrImg.src    = data.qr;
    modal.hidden = false;
    startTimer(data.secondsLeft);
  }

  async function closeModal() {
    modal.hidden = true;
    stopTimer();

    const res  = await fetch('/api/status');
    const data = await res.json();
    if (!data.connected) {
      fetch('/api/whatsapp/disconnect', { method: 'POST' }).catch(() => {});
    }
  }

  function startTimer(seconds) {
    stopTimer();
    secondsLeft = seconds > 0 ? seconds : QR_DURATION;
    updateBar();
    timerInterval = setInterval(() => {
      secondsLeft--;
      updateBar();
      if (secondsLeft <= 0) stopTimer();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateBar() {
    timer.textContent = secondsLeft;
    const pct                 = (secondsLeft / QR_DURATION) * 100;
    timerBar.style.width      = pct + '%';
    timerBar.style.background = pct > 40
      ? 'var(--accent)'
      : pct > 20 ? '#f59e0b' : '#ef4444';
  }

  btnConnect.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  fetchStatus();
  setInterval(fetchStatus, 2000);
}