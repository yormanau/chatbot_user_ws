import { initInlineInput } from './inputComponent.js';
import { showToast } from './toast.js';
import { initDatePicker } from './datePicker.js';

// ── Modal fullscreen ───────────────────────────────────────────
export function openPerfilModal(id) {
  history.pushState({ modal: 'perfil' }, '');

  const overlay = document.createElement('div');
  overlay.className = 'perfil-modal-overlay';
  overlay.innerHTML = `
    <div class="perfil-modal__topbar">
      <span class="perfil-modal__title">Perfil de usuario</span>
      <button class="perfil-modal__close" aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="perfil-content perfil-modal__body" id="perfil-modal-content">
      <div class="perfil-loading">Cargando...</div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const close = (fromPopState = false) => {
    overlay.remove();
    document.body.style.overflow = '';
    window.removeEventListener('popstate', onPopState);
    document.removeEventListener('keydown', onKey);
    if (!fromPopState) history.back();
  };

  const onPopState = () => close(true);
  window.addEventListener('popstate', onPopState);

  overlay.querySelector('.perfil-modal__close').addEventListener('click', () => close(false));

  const onKey = (e) => {
    if (e.key === 'Escape') close(false);
  };
  document.addEventListener('keydown', onKey);

  loadPerfil(id, overlay.querySelector('#perfil-modal-content'), () => close(false));
}

// ── Carga datos y renderiza en el contenedor dado ─────────────
async function loadPerfil(id, containerEl, onClose) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error('Usuario no encontrado');
    const user = await res.json();
    renderPerfil(user, containerEl, onClose);
  } catch (err) {
    showError(containerEl, err.message);
  }
}

// ── Standalone: usado por perfil.html ─────────────────────────
async function initPerfil() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const containerEl = document.getElementById('perfil-content');

  if (!id) { showError(containerEl, 'ID de usuario no encontrado'); return; }

  await loadPerfil(id, containerEl, () => window.close());
}

function renderPerfil(user, containerEl, onClose) {
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const fechaRegistro = new Date(user.create_at).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const horaRegistro = new Date(user.create_at).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit'
  });

  function makeRow(label, value, field, inputHtml = null) {
    const input = inputHtml ?? `<input class="perfil-row__input" type="text" value="${value ?? ''}">`;
    return `
      <div class="perfil-row" data-field="${field}">
        <span class="perfil-row__label">${label}</span>
        <span class="perfil-row__value">${value ?? ''}</span>
        <button class="perfil-row__edit-btn" data-edit="✏️">✏️</button>
        <div class="perfil-row__edit-group">
          ${input}
          <button class="perfil-row__cancel">✕</button>
          <button class="perfil-row__confirm">✓</button>
        </div>
      </div>
    `;
  }

  function attachDatePicker(row, onConfirm) {
    const editBtn   = row.querySelector('.perfil-row__edit-btn');
    const cancelBtn = row.querySelector('.perfil-row__cancel');

    editBtn?.addEventListener('click', () => {
      row.classList.add('perfil-row--editing');
    });

    cancelBtn?.addEventListener('click', () => {
      row.classList.remove('perfil-row--editing');
    });

    initDatePicker(row.querySelector('.dp-container'), {
      onConfirm: async (dateStr) => {
        row.querySelector('.perfil-row__value').textContent = dateStr;
        row.classList.remove('perfil-row--editing');
        if (onConfirm) await onConfirm(dateStr);
      }
    });
  }

  containerEl.innerHTML = `
    <div class="perfil-avatar-card">
      <div class="perfil-avatar">${initials}</div>
      <div class="perfil-avatar-info">
        <span class="perfil-name">${user.name}</span>
      </div>
      <button class="perfil-delete-btn" id="btn-eliminar-usuario" title="Eliminar usuario">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <div class="perfil-card">
      <div class="perfil-card__header">
        Información del usuario
        <button class="perfil-card__add-btn" id="btn-agregar-campo" title="Agregar información">＋</button>
      </div>
      <div class="perfil-card__body" id="contacto-body">
        ${makeRow('Nombre', user.name, 'name')}
        <div class="perfil-row">
          <span class="perfil-row__label">Teléfono</span>
          <span class="perfil-row__value">${user.phone}</span>
          <button class="perfil-row__edit-btn" disabled>✏️</button>
        </div>
        ${user.channel ? `
        <div class="perfil-row">
          <span class="perfil-row__label">Canal</span>
          <span class="perfil-channel-badge perfil-channel-badge--${user.channel}">${user.channel === 'whatsapp' ? '💬 WhatsApp' : '🖥️ Manual'}</span>
        </div>` : ''}
        <div class="perfil-add-row" id="add-row" style="display:none;">
          <select class="perfil-add-select" id="add-select">
            <option value="" disabled selected>Selecciona un campo...</option>
          </select>
        </div>
      </div>
    </div>

    <div class="perfil-card perfil-card--collapsible" id="card-registro">
      <button class="perfil-card__header perfil-card__toggle" aria-expanded="false" aria-controls="registro-body">
        Fecha de registro
        <span class="perfil-card__toggle-icon">＋</span>
      </button>
      <div class="perfil-card__body perfil-card__body--collapsed" id="registro-body">
        <div class="perfil-row">
          <span class="perfil-row__label">Fecha</span>
          <span class="perfil-row__value">${fechaRegistro}</span>
        </div>
        <div class="perfil-row">
          <span class="perfil-row__label">Hora</span>
          <span class="perfil-row__value">${horaRegistro}</span>
        </div>
      </div>
    </div>

    <div id="compras-section"></div>

  `;

  // ── Campos fijos (solo name) ───────────────────────────────────
  const fieldMessages = {
    name: { label: 'nombre', error: 'No se pudo actualizar el nombre' },
  };

  const fieldRules = {
    name: [{ rule: 'required' }, { rule: 'minLength', value: 2 }],
  };

  containerEl.querySelectorAll('.perfil-row[data-field="name"]').forEach(row => {
    const field = row.dataset.field;
    initInlineInput({
      rowEl:     row,
      type:      'text',
      rules:     fieldRules[field] || [{ rule: 'required' }],
      onConfirm: async (newVal) => {
        const res = await fetch(`/api/users/${user.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ [field]: newVal })
        });

        if (!res.ok) {
          showToast('error', 'Error', fieldMessages[field]?.error || 'No se pudo guardar');
          return null;
        }

        const data = await res.json();

        showToast('success', 'Actualización exitosa', `Se ha actualizado el ${fieldMessages[field]?.label || field} correctamente`);

        if (field === 'name') {
          const updatedName = data.name || newVal;
          const initials = updatedName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
          containerEl.querySelector('.perfil-avatar').textContent = initials;
          containerEl.querySelector('.perfil-name').textContent   = updatedName;
        }

        return data.name ?? newVal;
      }
    });
  });

  // ── Toggle card Registro ───────────────────────────────────────
  const toggleBtn = containerEl.querySelector('.perfil-card__toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const body     = containerEl.querySelector('#registro-body');
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      const icon     = toggleBtn.querySelector('.perfil-card__toggle-icon');

      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      body.classList.toggle('perfil-card__body--collapsed', expanded);
      icon.textContent = expanded ? '＋' : '－';
    });
  }

  // ── Campos opcionales ──────────────────────────────────────────
  const OPTIONAL_FIELDS = [
    {
      key:   'email',
      label: 'Email',
      type:  'email',
      rules: [{ rule: 'required' }, { rule: 'emailFormat' }],
    },
    {
      key:   'ciudad',
      label: 'Ciudad',
      type:  'text',
      rules: [{ rule: 'required' }],
    },
    {
      key:      'gender',
      label:    'Género',
      type:     'select',
      rules:    [{ rule: 'required' }],
      inputHtml: `
        <select class="perfil-row__input">
          <option value="">Selecciona...</option>
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
        </select>
      `,
    },
    {
      key:      'birth_date',
      label:    'Fecha de nacimiento',
      type:     'text',
      rules:    [{ rule: 'required' }],
      inputHtml: `<div class="dp-container"></div>`,
    },
  ];

  function genderDisplay(val) {
    return val === 'M' ? 'Masculino' : val === 'F' ? 'Femenino' : val;
  }

  const presentFields = new Set(
    OPTIONAL_FIELDS.map(f => f.key).filter(k => user[k] != null && user[k] !== '')
  );

  const addRow    = containerEl.querySelector('#add-row');
  const addSelect = containerEl.querySelector('#add-select');

  // ── Renderizar campos opcionales que el usuario ya tiene ───────
  OPTIONAL_FIELDS.forEach(({ key, label, type, rules, inputHtml }) => {
    if (!presentFields.has(key)) return;

    const displayValue = key === 'gender'
      ? genderDisplay(user[key])
      : user[key];

    const resolvedInputHtml = key === 'gender'
      ? `
        <select class="perfil-row__input">
          <option value="">Selecciona...</option>
          <option value="Masculino" ${user[key] === 'M' ? 'selected' : ''}>Masculino</option>
          <option value="Femenino"  ${user[key] === 'F' ? 'selected' : ''}>Femenino</option>
        </select>
      `
      : (inputHtml ?? null);

    const tmp = document.createElement('div');
    tmp.innerHTML = makeRow(label, displayValue, key, resolvedInputHtml);
    const row = tmp.firstElementChild;
    containerEl.querySelector('#contacto-body').insertBefore(row, addRow);

    if (key === 'birth_date') {
      attachDatePicker(row, async (val) => {
        await saveField(key, val, label, user.id);
      });
    } else {
      initInlineInput({
        rowEl:  row,
        type,
        rules,
        onConfirm: async (val) => {
          const result = await saveField(key, val, label, user.id);

          if (key === 'gender') {
            row.querySelector('.perfil-row__value').textContent = genderDisplay(val);
          }

          return result?.value ?? val;
        },
      });
    }
  });

  // ── Botón ＋ ───────────────────────────────────────────────────
  const btnAgregar = containerEl.querySelector('#btn-agregar-campo');

  btnAgregar.addEventListener('click', () => {
    const missing = OPTIONAL_FIELDS.filter(f => !presentFields.has(f.key));
    if (!missing.length) return;

    addSelect.innerHTML = `<option value="" disabled selected>Selecciona un campo...</option>`;
    missing.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.key;
      opt.textContent = f.label;
      addSelect.appendChild(opt);
    });

    addRow.style.display = addRow.style.display === 'none' ? 'flex' : 'none';
  });

  // ── Al seleccionar un campo ────────────────────────────────────
  addSelect.addEventListener('change', () => {
    const key   = addSelect.value;
    const field = OPTIONAL_FIELDS.find(f => f.key === key);
    if (!field) return;

    addRow.style.display = 'none';

    const tmp = document.createElement('div');
    tmp.innerHTML = makeRow(field.label, '', key, field.inputHtml ?? null);
    const row = tmp.firstElementChild;
    containerEl.querySelector('#contacto-body').insertBefore(row, addRow);

    if (key === 'birth_date') {
      attachDatePicker(row, async (val) => {
        await saveField(key, val, field.label, user.id);
        presentFields.add(key);
      });
    } else {
      initInlineInput({
        rowEl:  row,
        type:   field.type,
        rules:  field.rules,
        onConfirm: async (val) => {
          if (key === 'gender') {
            row.querySelector('.perfil-row__value').textContent = genderDisplay(val);
          }
          await saveField(key, val, field.label, user.id);
          presentFields.add(key);
        },
      });
    }

    row.querySelector('.perfil-row__edit-btn')?.click();
  });

  // ── Helpers ───────────────────────────────────────────────────
  async function saveField(field, val, label, userId) {
    const res = await fetch(`/api/users/${userId}/info`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ field, value: val }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast('error', 'Error', data.error || `No se pudo guardar ${label}`);
      return null;
    }
    showToast('success', 'Guardado', `${label} guardado correctamente`);
    return await res.json();
  }

  // ── Historial de compras ───────────────────────────────────────
  renderCompras(user.id, containerEl);

  // ── Tier / Ranking ────────────────────────────────────────────
  loadUserTier(user.id, containerEl);

  // BORRAR USUARIO
  const btnEliminar = containerEl.querySelector('#btn-eliminar-usuario');
  btnEliminar?.addEventListener('click', async () => {
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar a ${user.name}? Esta acción no se puede deshacer.`);
    if (!confirmar) return;

    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });

    if (!res.ok) {
      const data = await res.json();
      showToast('error', 'Error', data.error || 'No se pudo eliminar el usuario');
      return;
    }

    showToast('success', 'Usuario eliminado', `${user.name} ha sido eliminado correctamente`);
    setTimeout(() => onClose(), 1500);
  });
}

async function renderCompras(userId, containerEl) {
  const section = containerEl.querySelector('#compras-section');
  if (!section) return;

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

  try {
    const res      = await fetch(`/api/users/${userId}/invoices`);
    const invoices = await res.json();

    const grandTotal = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

    const bodyHtml = invoices.length
      ? invoices.map((inv) => `
          <div class="perfil-compra-item">
            <button class="perfil-compra-item__header">
              <span class="perfil-compra-item__date">${formatDate(inv.created_at)}</span>
              <span class="perfil-compra-item__count">${inv.num_items} producto${inv.num_items !== 1 ? 's' : ''}</span>
              <span class="perfil-compra-item__total">${formatCurrency(inv.total)}</span>
              <span class="perfil-compra-item__icon">›</span>
            </button>
            <div class="perfil-compra-item__products" hidden>
              ${inv.items.map(p => `
                <div class="perfil-compra-product">
                  <span class="perfil-compra-product__name">${p.product_name}</span>
                  <span class="perfil-compra-product__price">${formatCurrency(p.price)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('') + `
          <div class="perfil-compra-total">
            <span class="perfil-compra-total__label">Total</span>
            <span class="perfil-compra-total__value">${formatCurrency(grandTotal)}</span>
          </div>`
      : `<div class="perfil-compras-empty">Sin ventas registradas</div>`;

    section.innerHTML = `
      <div class="perfil-card perfil-card--collapsible">
        <button class="perfil-card__header perfil-card__toggle" aria-expanded="false" aria-controls="compras-body">
          Historial de ventas (${invoices.length})
          <span class="perfil-card__toggle-icon">＋</span>
        </button>
        <div class="perfil-card__body perfil-card__body--collapsed" id="compras-body">
          ${bodyHtml}
        </div>
      </div>
    `;

    const toggleBtn = section.querySelector('.perfil-card__toggle');
    const body      = section.querySelector('#compras-body');
    const icon      = toggleBtn.querySelector('.perfil-card__toggle-icon');
    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      body.classList.toggle('perfil-card__body--collapsed', expanded);
      icon.textContent = expanded ? '＋' : '－';

      if (!expanded) {
        requestAnimationFrame(() => {
          toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });

    section.querySelectorAll('.perfil-compra-item__header').forEach(btn => {
      btn.addEventListener('click', () => {
        const products = btn.nextElementSibling;
        const itemIcon = btn.querySelector('.perfil-compra-item__icon');
        const isOpen   = !products.hidden;
        products.hidden = isOpen;
        itemIcon.classList.toggle('perfil-compra-item__icon--open', !isOpen);
      });
    });

  } catch (err) {
    console.error('[perfil/compras]', err);
  }
}

async function loadUserTier(userId, containerEl) {
  const DEFAULT_CFG = {
    vipPct: 10, goldPurchases: 7, goldSpent: 500000,
    silverPurchases: 3, silverSpent: 200000, bronzePurchases: 1,
    degradeEnabled: false, degradeDays: 30,
  };

  try {
    const [rankRes, cfgRes] = await Promise.all([
      fetch('/api/analytics/adv/client-ranking'),
      fetch('/api/analytics/adv/config'),
    ]);

    const rows   = await rankRes.json();
    const cfgRaw = await cfgRes.json();
    const cfg    = { ...DEFAULT_CFG, ...(cfgRaw ?? {}) };

    const client = rows.find(r => r.id === userId);
    if (!client) return;

    const withPurchases = rows
      .filter(r => r.total_spent > 0)
      .sort((a, b) => b.total_spent - a.total_spent);
    const vipCount  = Math.max(1, Math.ceil(withPurchases.length * (cfg.vipPct / 100)));
    const vipThresh = withPurchases.length > 0 ? withPurchases[vipCount - 1].total_spent : Infinity;

    const { purchases, total_spent, days_since } = client;
    let tier;
    if (total_spent >= vipThresh)                                                    tier = 'vip';
    else if (purchases >= cfg.goldPurchases   || total_spent >= cfg.goldSpent)       tier = 'gold';
    else if (purchases >= cfg.silverPurchases || total_spent >= cfg.silverSpent)     tier = 'silver';
    else if (purchases >= cfg.bronzePurchases)                                       tier = 'bronze';
    else                                                                             tier = 'new';

    if (cfg.degradeEnabled && days_since != null && days_since >= cfg.degradeDays) {
      const ORDER = ['new', 'bronze', 'silver', 'gold', 'vip'];
      const idx = ORDER.indexOf(tier);
      tier = ORDER[Math.max(0, idx - 1)];
    }

    if (tier === 'new') return;

    const LABEL = { vip: '💎 VIP', gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' };

    const badge = document.createElement('span');
    badge.className = `perfil-tier-badge perfil-tier-badge--${tier}`;
    badge.textContent = LABEL[tier];
    containerEl.querySelector('.perfil-avatar-info')?.appendChild(badge);

  } catch (e) {
    console.error('[perfil/tier]', e);
  }
}

function showError(containerEl, msg) {
  containerEl.innerHTML = `<div class="perfil-empty">${msg}</div>`;
}

// Auto-init solo cuando se carga como perfil.html standalone
if (document.getElementById('perfil-content')) {
  initPerfil();
}
