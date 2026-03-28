const QR_DURATION      = 60;
const PAIRING_DURATION = 120;

let qrTimerInterval      = null;
let pairingTimerInterval = null;
let qrSecondsLeft        = QR_DURATION;
let pairingSecondsLeft   = PAIRING_DURATION;
let lastQR               = null;
let closingModal         = false;
let activeTab            = 'qr';

import { showToast } from './toast.js';

let _onConnected = null;

export function notifyConnected() {
  if (_onConnected) _onConnected();
}

export function initQR() {
  const statusDot          = document.getElementById('status-dot');
  const statusText         = document.getElementById('status-text');
  const statusName         = document.getElementById('status-name');
  const btnConnect         = document.getElementById('btn-connect');
  const modal              = document.getElementById('modal');
  const modalClose         = document.getElementById('modal-close');
  const modalTabs          = document.getElementById('modal-tabs');
  const tabQR              = document.getElementById('tab-qr');
  const tabPairing         = document.getElementById('tab-pairing');
  const panelQR            = document.getElementById('panel-qr');
  const panelPairing       = document.getElementById('panel-pairing');
  const qrImg              = document.getElementById('qr-img');
  const timerBar           = document.getElementById('timer-bar');
  const timer              = document.getElementById('timer');
  const pairingPhoneInput  = document.getElementById('pairing-phone');
  const btnGetCode         = document.getElementById('btn-get-code');
  const pairingForm        = document.getElementById('pairing-form');
  const pairingCodeDisplay = document.getElementById('pairing-code-display');
  const pairingCodeVal     = document.getElementById('pairing-code-val');
  const pairingTimerEl     = document.getElementById('pairing-timer');
  const pairingTimerBar    = document.getElementById('pairing-timer-bar');
  const connectedView      = document.getElementById('connected-view');
  const disconnectedView   = document.getElementById('disconnected-view');

  // ── Tab switching ────────────────────────────────────────────
  function switchTab(tab) {
    activeTab = tab;
    tabQR.classList.toggle('active', tab === 'qr');
    tabPairing.classList.toggle('active', tab === 'pairing');
    panelQR.hidden      = tab !== 'qr';
    panelPairing.hidden = tab !== 'pairing';
  }

  tabQR.addEventListener('click', () => switchTab('qr'));
  tabPairing.addEventListener('click', () => switchTab('pairing'));

  // ── Status polling ───────────────────────────────────────────
  async function fetchStatus() {
    try {
      const res  = await fetch('/api/status');
      const data = await res.json();
      updateUI(data);
    } catch (e) {
      console.error('[Status] Error:', e);
    }
  }

  function updateUI({ connected, qr, secondsLeft: sLeft, botName, pairingCode, pairingSecondsLeft: pLeft }) {
    const sidebarDot = document.getElementById('sidebar-wa-dot');

    if (connected) {
      if (sidebarDot) sidebarDot.className = 'sidebar-wa-dot connected';
      statusDot.className    = 'status-dot connected';
      statusName.textContent = botName || '';
      statusText.textContent = '(Conectado)';
      btnConnect.disabled    = true;
      connectedView.hidden    = false;
      disconnectedView.hidden = true;


    } else {
      if (sidebarDot) sidebarDot.className = 'sidebar-wa-dot';
      statusDot.className     = 'status-dot disconnected';
      statusName.textContent  = '';
      statusText.textContent  = 'WhatsApp desconectado';
      btnConnect.disabled     = false;
      connectedView.hidden    = true;
      disconnectedView.hidden = false;

      // Actualizar QR si cambió
      if (!modal.hidden && activeTab === 'qr' && qr && qr !== lastQR) {
        lastQR    = qr;
        qrImg.src = qr;
        startQRTimer(sLeft);
      }

      // Mostrar pairing code si llegó
      if (!modal.hidden && activeTab === 'pairing' && pairingCode && !pairingCodeDisplay.hidden === false) {
        showPairingCode(pairingCode, pLeft);
      }
    }
  }

  function showSuccess() {
    if (closingModal) return;
    closingModal = true;
    stopQRTimer();
    stopPairingTimer();
    closeModal();
    closingModal = false;
    showToast('success', '¡Conectado!', 'WhatsApp conectado correctamente.');
  }

  _onConnected = showSuccess;

  // ── Modal open / close ───────────────────────────────────────
  async function openModal() {
    const originalHTML = btnConnect.innerHTML;
    btnConnect.disabled  = true;
    btnConnect.innerHTML = `
      <span>Conectando</span>
      <svg class="btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"
          stroke-dasharray="31.4" stroke-dashoffset="10" opacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;

    await fetch('/api/whatsapp/connect', { method: 'POST' });

    // Polling hasta QR disponible (máx 20s)
    let data = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch('/api/status');
      data = await res.json();
      if (data.qr || data.connected) break;
    }

    btnConnect.innerHTML = originalHTML;
    btnConnect.disabled  = false;

    if (!data || (!data.qr && !data.connected)) {
      showToast('error', 'Error', 'No se pudo obtener el QR, intenta de nuevo');
      return;
    }

    if (data.connected) return;

    lastQR       = data.qr;
    qrImg.src    = data.qr;
    modal.hidden = false;
    switchTab('qr');
    startQRTimer(data.secondsLeft);
  }

  function closeModal() {
    modal.hidden = true;
    stopQRTimer();
    stopPairingTimer();

    // Restaurar QR panel
    qrImg.src = '';
    lastQR    = null;

    // Restaurar pairing panel
    pairingForm.hidden        = false;
    pairingCodeDisplay.hidden = true;
    pairingPhoneInput.value   = '';
    pairingCodeVal.textContent = '----·----';

    // Restaurar modal
    modalTabs.hidden    = false;
    switchTab('qr');

    fetch('/api/status').then(r => r.json()).then(data => {
      if (!data.connected) {
        fetch('/api/whatsapp/disconnect', { method: 'POST' }).catch(() => {});
      }
    }).catch(() => {});
  }

  // ── QR timer ─────────────────────────────────────────────────
  function startQRTimer(seconds) {
    stopQRTimer();
    qrSecondsLeft = seconds > 0 ? seconds : QR_DURATION;
    updateQRBar();
    qrTimerInterval = setInterval(() => {
      qrSecondsLeft--;
      updateQRBar();
      if (qrSecondsLeft <= 0) stopQRTimer();
    }, 1000);
  }

  function stopQRTimer() { clearInterval(qrTimerInterval); qrTimerInterval = null; }

  function updateQRBar() {
    timer.textContent        = qrSecondsLeft;
    const pct                = (qrSecondsLeft / QR_DURATION) * 100;
    timerBar.style.width     = pct + '%';
    timerBar.style.background = pct > 40 ? 'var(--accent)' : pct > 20 ? '#f59e0b' : '#ef4444';
  }

  // ── Pairing timer ────────────────────────────────────────────
  function startPairingTimer(seconds) {
    stopPairingTimer();
    pairingSecondsLeft = seconds > 0 ? seconds : PAIRING_DURATION;
    updatePairingBar();
    pairingTimerInterval = setInterval(() => {
      pairingSecondsLeft--;
      updatePairingBar();
      if (pairingSecondsLeft <= 0) stopPairingTimer();
    }, 1000);
  }

  function stopPairingTimer() { clearInterval(pairingTimerInterval); pairingTimerInterval = null; }

  function updatePairingBar() {
    pairingTimerEl.textContent   = pairingSecondsLeft;
    const pct                    = (pairingSecondsLeft / PAIRING_DURATION) * 100;
    pairingTimerBar.style.width  = pct + '%';
    pairingTimerBar.style.background = pct > 40 ? 'var(--accent)' : pct > 20 ? '#f59e0b' : '#ef4444';
  }

  function showPairingCode(code, secondsLeft) {
    if (!pairingCodeDisplay.hidden) return; // ya se muestra
    const formatted = code.length === 8
      ? `${code.slice(0, 4)}-${code.slice(4)}`
      : code;
    pairingCodeVal.textContent = formatted;
    pairingForm.hidden         = true;
    pairingCodeDisplay.hidden  = false;
    startPairingTimer(secondsLeft);
  }

  // ── Pairing code request ─────────────────────────────────────
  btnGetCode.addEventListener('click', async () => {
    const phone = pairingPhoneInput.value.replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      showToast('error', 'Número inválido', 'Ingresa el número con código de país (sin +)');
      return;
    }

    const orig = btnGetCode.textContent;
    btnGetCode.disabled     = true;
    btnGetCode.textContent  = 'Solicitando...';

    await fetch('/api/whatsapp/pairing-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    // Polling para el código (máx 30s)
    let data = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch('/api/status');
      data = await res.json();
      if (data.pairingCode || data.connected) break;
    }

    btnGetCode.disabled    = false;
    btnGetCode.textContent = orig;

    if (!data?.pairingCode && !data?.connected) {
      showToast('error', 'Error', 'No se pudo obtener el código, verifica el número e intenta de nuevo');
      return;
    }

    if (data.connected) return;

    showPairingCode(data.pairingCode, data.pairingSecondsLeft);
  });

  // ── Event listeners ──────────────────────────────────────────
  btnConnect.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  fetchStatus();
  setInterval(fetchStatus, 2000);
}
