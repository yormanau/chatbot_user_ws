import { showToast }     from './toast.js';
import { initTable }     from './tableComponent.js';
import { initFormInput } from './inputComponent.js';

// ── Formateador de moneda ────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Sección Ventas ───────────────────────────────────────────
export function initPurchases() {
  const panel = document.getElementById('invoices-panel');
  if (!panel) return;

  panel.hidden = false;

  const { reload } = initTable({
    panelId:           'invoices-panel',
    btnId:             null,
    title:             'Historial de ventas',
    endpoint:          '/api/invoices',
    searchPlaceholder: 'Buscar por nombre o teléfono...',
    columns: [
      { key: 'user_name',  label: 'Cliente',    sortable: true  },
      { key: 'user_phone', label: 'Teléfono',   sortable: false },
      { key: 'num_items',       label: 'Productos',  sortable: true  },
      { key: 'total',           label: 'Total',      sortable: true,  format: formatCurrency },
      { key: 'payment_method',  label: 'Método de pago',       sortable: true  },
      { key: 'created_at',      label: 'Fecha',      sortable: true,  type: 'date' },
    ],
    filters:     [],
    rowsPerPage: [10, 25, 50],
    onRowAction: {
      label:  'Ver detalle',
      icon:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                 <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
               </svg>`,
      action: (row) => abrirDetalleVenta(row.id),
    },
  });

  reload();

  document.getElementById('btn-nueva-compra')
    ?.addEventListener('click', () => abrirModalCompra({ onSuccess: reload }));

  return { reload };
}

// ── Modal detalle de venta ────────────────────────────────────
export async function abrirDetalleVenta(invoiceId) {
  if (document.getElementById('detalle-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id        = 'detalle-overlay';
  overlay.className = 'compra-overlay';

  overlay.innerHTML = `
    <div class="compra-panel">
      <div class="compra-panel__header">
        <div class="compra-panel__title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Detalle de venta
        </div>
        <button class="compra-panel__close" id="detalle-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="compra-panel__body" id="detalle-body">
        <div style="text-align:center;padding:32px;color:var(--muted)">Cargando...</div>
      </div>
      <div class="compra-panel__footer">
        <button class="register-form__btn register-form__btn--cancel" id="detalle-cerrar">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('compra-overlay--visible'));

  const cerrar = () => {
    overlay.classList.remove('compra-overlay--visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  overlay.querySelector('#detalle-close').addEventListener('click', cerrar);
  overlay.querySelector('#detalle-cerrar').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  const onKeyDown = (e) => { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', onKeyDown); } };
  document.addEventListener('keydown', onKeyDown);

  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    if (!res.ok) throw new Error('No se pudo cargar la venta');
    const inv = await res.json();

    const body = overlay.querySelector('#detalle-body');
    body.innerHTML = `
      <div class="detalle-cliente">
        <span class="detalle-cliente__name">${inv.user_name}</span>
        <span class="detalle-cliente__phone">${inv.user_phone}</span>
      </div>

      <div class="compra-block">
        <table class="detalle-items">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map(item => `
              <tr>
                <td>${item.product_name}</td>
                <td class="detalle-qty">${item.quantity}</td>
                <td>${formatCurrency(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="compra-total">
        <span class="compra-total__label">Total</span>
        <span class="compra-total__value">${formatCurrency(inv.total)}</span>
      </div>

      <div class="detalle-meta">
        ${inv.payment_method ? `<span class="detalle-meta__item">Pago: <strong>${inv.payment_method}</strong></span>` : ''}
        <span class="detalle-meta__item">${formatDate(inv.created_at)}</span>
      </div>
    `;
  } catch (err) {
    overlay.querySelector('#detalle-body').innerHTML =
      `<div style="text-align:center;padding:32px;color:var(--muted)">${err.message}</div>`;
  }
}

// ── Modal Nueva Venta ─────────────────────────────────────────
export async function abrirModalCompra({ onSuccess } = {}) {
  if (document.getElementById('compra-overlay')) return;

  const paymentMethodsRes = await fetch('/api/payment-methods');
  const paymentMethods    = await paymentMethodsRes.json();

  let selectedUser = null;
  let items        = [];

  const overlay = document.createElement('div');
  overlay.id        = 'compra-overlay';
  overlay.className = 'compra-overlay';

  overlay.innerHTML = `
    <div class="compra-panel">

      <div class="compra-panel__header">
        <div class="compra-panel__title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Nueva Venta
        </div>
        <button class="compra-panel__close" id="compra-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="compra-panel__body">

        <!-- Bloque: Cliente -->
        <div class="compra-block">
          <span class="compra-block__label">Cliente</span>
          <div class="compra-user-wrap" id="compra-user-wrap">
            <input
              id="compra-user-input"
              class="ic-input"
              type="text"
              placeholder="Buscar contacto por nombre o teléfono..."
              autocomplete="off"
            >
            <div class="compra-dropdown" id="compra-user-dropdown" hidden></div>
          </div>
          <div class="compra-user-badge" id="compra-user-badge" hidden>
            <div class="compra-user-badge__info">
              <span class="compra-user-badge__name"  id="badge-name"></span>
              <span class="compra-user-badge__phone" id="badge-phone"></span>
            </div>
            <button class="compra-user-badge__remove" id="compra-user-clear">✕</button>
          </div>
        </div>

        <!-- Bloque: Productos -->
        <div class="compra-block">
          <span class="compra-block__label">Añadir producto</span>
          <div class="compra-product-row">
            <div class="compra-product-input-wrap">
              <input
                id="compra-prod-name"
                class="ic-input"
                type="text"
                placeholder="Nombre del producto..."
                autocomplete="off"
              >
              <div class="compra-dropdown" id="compra-prod-dropdown" hidden></div>
            </div>
            <input
              id="compra-prod-qty"
              class="ic-input compra-qty-input"
              type="number"
              placeholder="Cant."
              min="1"
              step="1"
              value="1"
            >
            <input
              id="compra-prod-price"
              class="ic-input compra-price-input"
              type="number"
              placeholder="Precio"
              min="0"
              step="100"
            >
            <button class="btn-primary" id="compra-prod-add">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="compra-items" id="compra-items"></div>

          <!-- Bloque: Método de pago -->
          <div class="compra-block">
            <div id="compra-payment-method"></div>
          </div>

          <div class="compra-total" id="compra-total" hidden>
            <span class="compra-total__label">Total</span>
            <span class="compra-total__value" id="compra-total-value">$0</span>
          </div>
        </div>

      </div>

      <div class="compra-panel__footer">
        <button class="register-form__btn register-form__btn--cancel" id="compra-cancel">Cancelar</button>
        <button class="register-form__btn register-form__btn--submit" id="compra-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Registrar venta
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('compra-overlay--visible'));

  // ── Método de pago ───────────────────────────────────────────
  const paymentInput = initFormInput({
    containerId: 'compra-payment-method',
    type:        'select',
    label:       'Método de pago *',
    placeholder: 'Selecciona...',
    options:     paymentMethods.map(pm => ({ value: String(pm.id), label: pm.name })),
    rules:       [{ rule: 'required' }],
    className:   'ic-input',
  });

  // ── Referencias ──────────────────────────────────────────────
  const userInput      = overlay.querySelector('#compra-user-input');
  const userDropdown   = overlay.querySelector('#compra-user-dropdown');
  const userBadge      = overlay.querySelector('#compra-user-badge');
  const userWrap       = overlay.querySelector('#compra-user-wrap');
  const badgeName      = overlay.querySelector('#badge-name');
  const badgePhone     = overlay.querySelector('#badge-phone');
  const userClear      = overlay.querySelector('#compra-user-clear');

  const prodNameInput  = overlay.querySelector('#compra-prod-name');
  const prodDropdown   = overlay.querySelector('#compra-prod-dropdown');
  const prodQtyInput   = overlay.querySelector('#compra-prod-qty');
  const prodPriceInput = overlay.querySelector('#compra-prod-price');
  const prodAddBtn     = overlay.querySelector('#compra-prod-add');

  const itemsList  = overlay.querySelector('#compra-items');
  const totalBox   = overlay.querySelector('#compra-total');
  const totalValue = overlay.querySelector('#compra-total-value');
  const submitBtn  = overlay.querySelector('#compra-submit');

  // ── Cerrar ───────────────────────────────────────────────────
  const cerrar = () => {
    overlay.classList.remove('compra-overlay--visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  overlay.querySelector('#compra-close').addEventListener('click', cerrar);
  overlay.querySelector('#compra-cancel').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  const onKeyDown = (e) => { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', onKeyDown); } };
  document.addEventListener('keydown', onKeyDown);

  // ── Búsqueda de usuario ──────────────────────────────────────
  let userSearchTimeout = null;

  userInput.addEventListener('input', () => {
    clearTimeout(userSearchTimeout);
    const q = userInput.value.trim();
    if (q.length < 2) { userDropdown.hidden = true; return; }

    userSearchTimeout = setTimeout(async () => {
      const res   = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const users = await res.json();

      if (!users.length) {
        userDropdown.innerHTML = `<div class="compra-dropdown__item" style="color:var(--muted)">Sin resultados</div>`;
        userDropdown.hidden = false;
        return;
      }

      userDropdown.innerHTML = users.map(u => `
        <div class="compra-dropdown__item" data-id="${u.id}" data-name="${u.name}" data-phone="${u.phone}">
          <strong>${u.name}</strong> <span style="color:var(--muted);font-size:12px">${u.phone}</span>
        </div>
      `).join('');
      userDropdown.hidden = false;
    }, 250);
  });

  userDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.compra-dropdown__item[data-id]');
    if (!item) return;
    selectUser({ id: Number(item.dataset.id), name: item.dataset.name, phone: item.dataset.phone });
  });

  function selectUser(user) {
    selectedUser = user;
    userInput.value = '';
    userDropdown.hidden = true;
    userWrap.hidden     = true;
    badgeName.textContent  = user.name;
    badgePhone.textContent = user.phone;
    userBadge.hidden = false;
  }

  userClear.addEventListener('click', () => {
    selectedUser = null;
    userBadge.hidden = true;
    userWrap.hidden  = false;
    userInput.value  = '';
    userInput.focus();
  });

  document.addEventListener('click', (e) => {
    if (!userWrap.contains(e.target)) userDropdown.hidden = true;
  }, { signal: AbortSignal.timeout ? AbortSignal.timeout(300000) : undefined });

  // ── Autocompletado de productos ──────────────────────────────
  let prodSearchTimeout = null;
  let selectedProductId = null;

  prodNameInput.addEventListener('input', () => {
    clearTimeout(prodSearchTimeout);
    selectedProductId = null;
    const q = prodNameInput.value.trim();
    if (q.length < 2) { prodDropdown.hidden = true; return; }

    prodSearchTimeout = setTimeout(async () => {
      const res   = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const prods = await res.json();
      if (!prods.length) { prodDropdown.hidden = true; return; }

      prodDropdown.innerHTML = prods.map(p => `
        <div class="compra-dropdown__item" data-id="${p.id}" data-name="${p.name}">${p.name}</div>
      `).join('');
      prodDropdown.hidden = false;
    }, 250);
  });

  prodDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.compra-dropdown__item[data-id]');
    if (!item) return;
    selectedProductId    = Number(item.dataset.id);
    prodNameInput.value  = item.dataset.name;
    prodDropdown.hidden  = true;
    prodQtyInput.focus();
  });

  prodNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); prodQtyInput.focus(); }
  });

  prodQtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); prodPriceInput.focus(); }
  });

  prodPriceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); prodAddBtn.click(); }
  });

  overlay.querySelector('.compra-product-input-wrap').addEventListener('click', (e) => e.stopPropagation());
  overlay.addEventListener('click', () => { prodDropdown.hidden = true; });

  // ── Agregar ítem ─────────────────────────────────────────────
  prodAddBtn.addEventListener('click', () => {
    const name     = prodNameInput.value.trim();
    const quantity = Math.max(1, parseInt(prodQtyInput.value) || 1);
    const price    = parseFloat(prodPriceInput.value);

    if (!name) {
      prodNameInput.focus();
      prodNameInput.classList.add('ic-input--error');
      setTimeout(() => prodNameInput.classList.remove('ic-input--error'), 1500);
      return;
    }
    if (isNaN(price) || price <= 0) {
      prodPriceInput.focus();
      prodPriceInput.classList.add('ic-input--error');
      setTimeout(() => prodPriceInput.classList.remove('ic-input--error'), 1500);
      return;
    }

    items.push({ name, price, quantity, product_id: selectedProductId });
    renderItems();

    prodNameInput.value  = '';
    prodQtyInput.value   = '1';
    prodPriceInput.value = '';
    selectedProductId    = null;
    prodDropdown.hidden  = true;
    prodNameInput.focus();
  });

  // ── Render lista de ítems ─────────────────────────────────────
  function renderItems() {
    if (!items.length) {
      itemsList.innerHTML = '';
      totalBox.hidden = true;
      return;
    }

    itemsList.innerHTML = items.map((item, idx) => `
      <div class="compra-item">
        <span class="compra-item__name">${item.name}</span>
        ${item.quantity > 1 ? `<span class="compra-item__qty">× ${item.quantity}</span>` : ''}
        <span class="compra-item__price">${formatCurrency(item.price * item.quantity)}</span>
        <button class="compra-item__remove" data-idx="${idx}">✕</button>
      </div>
    `).join('');

    itemsList.querySelectorAll('.compra-item__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        items.splice(Number(btn.dataset.idx), 1);
        renderItems();
      });
    });

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    totalValue.textContent = formatCurrency(total);
    totalBox.hidden = false;
  }

  // ── Submit ───────────────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    if (!selectedUser) {
      showToast('error', 'Cliente requerido', 'Selecciona un contacto antes de registrar la venta.');
      userInput.focus();
      return;
    }
    if (!items.length) {
      showToast('error', 'Sin productos', 'Agrega al menos un producto a la venta.');
      prodNameInput.focus();
      return;
    }
    if (!paymentInput.validate()) return;

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Registrando...';

    try {
      const res  = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id:           selectedUser.id,
          payment_method_id: Number(paymentInput.getValue()),
          items:             items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, product_id: i.product_id })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast('error', 'Error', data.error || 'No se pudo registrar la venta.');
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Registrar venta';
        return;
      }

      showToast('success', 'Venta registrada', `${selectedUser.name} — ${formatCurrency(data.total)}`);
      if (onSuccess) onSuccess();
      cerrar();
    } catch (err) {
      console.error('[compras]', err);
      showToast('error', 'Error de conexión', 'Intenta de nuevo.');
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Registrar venta';
    }
  });
}