/**
 * initDatePicker — Componente de ingreso de fecha manual DD / MM / AAAA.
 *
 * @param {HTMLElement} containerEl
 * @param {object}      options
 * @param {Function}    options.onConfirm   — Callback con "DD/MM/YYYY"
 * @param {string}      options.value       — Valor inicial "DD/MM/YYYY"
 */
export function initDatePicker(containerEl, { onConfirm, value = '' } = {}) {
  if (!containerEl) return;

  const [initDay = '', initMonth = '', initYear = ''] = value ? value.split('/') : [];

  containerEl.innerHTML = `
    <div class="dp-wrap">
      <div class="dp-field">
        <input class="dp-input perfil-row__input" id="dp-day"   type="text" inputmode="numeric" maxlength="2" placeholder="DD"   value="${initDay}">
        <span class="dp-label">Día</span>
      </div>
      <span class="dp-sep">/</span>
      <div class="dp-field">
        <input class="dp-input perfil-row__input" id="dp-month" type="text" inputmode="numeric" maxlength="2" placeholder="MM"   value="${initMonth}">
        <span class="dp-label">Mes</span>
      </div>
      <span class="dp-sep">/</span>
      <div class="dp-field dp-field--year">
        <input class="dp-input perfil-row__input" id="dp-year"  type="text" inputmode="numeric" maxlength="4" placeholder="AAAA" value="${initYear}">
        <span class="dp-label">Año</span>
      </div>
    </div>
    <span class="dp-error" hidden></span>
  `;

  const dayEl   = containerEl.querySelector('#dp-day');
  const monthEl = containerEl.querySelector('#dp-month');
  const yearEl  = containerEl.querySelector('#dp-year');
  const errorEl = containerEl.querySelector('.dp-error');

  // Solo permitir dígitos
  function onlyDigits(e) {
    e.target.value = e.target.value.replace(/\D/g, '');
  }

  function maxDayForMonth(month, year) {
    if (!month || !year) return 31;
    return new Date(year, month, 0).getDate();
  }

  function validate() {
    const day   = parseInt(dayEl.value, 10);
    const month = parseInt(monthEl.value, 10);
    const year  = parseInt(yearEl.value, 10);

    if (!day || !month || !year) return null;

    if (day < 1 || day > 31) return 'El día debe ser entre 1 y 31';
    if (month < 1 || month > 12) return 'El mes debe ser entre 1 y 12';
    if (year < 1900 || year > new Date().getFullYear()) {
      return `El año debe ser entre 1900 y ${new Date().getFullYear()}`;
    }

    const maxDay = maxDayForMonth(month, year);
    if (day > maxDay) return `El mes ${month}/${year} solo tiene ${maxDay} días`;

    return null;
  }

  function tryConfirm() {
    if (!dayEl.value || !monthEl.value || yearEl.value.length < 4) return;

    const err = validate();
    if (err) {
      errorEl.textContent = err;
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;

    const dd   = dayEl.value.padStart(2, '0');
    const mm   = monthEl.value.padStart(2, '0');
    const yyyy = yearEl.value;

    if (onConfirm) onConfirm(`${dd}/${mm}/${yyyy}`);
  }

  // ── Día ──────────────────────────────────────────────────────
  dayEl.addEventListener('input', () => {
    onlyDigits({ target: dayEl });
    if (dayEl.value.length === 2) monthEl.focus();
    tryConfirm();
  });

  dayEl.addEventListener('blur', () => {
    const val = parseInt(dayEl.value, 10);
    if (!isNaN(val)) {
      if (val < 1) dayEl.value = '01';
      if (val > 31) dayEl.value = '31';
      dayEl.value = dayEl.value.padStart(2, '0');
    }
    tryConfirm();
  });

  // ── Mes ──────────────────────────────────────────────────────
  monthEl.addEventListener('input', () => {
    onlyDigits({ target: monthEl });
    // Si el primer dígito es > 1, ya sabemos que es mes de 1 dígito (ej: 2-9)
    if (monthEl.value.length === 1 && parseInt(monthEl.value) > 1) {
      monthEl.value = monthEl.value.padStart(2, '0');
      yearEl.focus();
    }
    if (monthEl.value.length === 2) yearEl.focus();
    tryConfirm();
  });

  monthEl.addEventListener('blur', () => {
    const val = parseInt(monthEl.value, 10);
    if (!isNaN(val)) {
      if (val < 1) monthEl.value = '01';
      if (val > 12) monthEl.value = '12';
      monthEl.value = monthEl.value.padStart(2, '0');
    }
    tryConfirm();
  });

  // ── Año ──────────────────────────────────────────────────────
  yearEl.addEventListener('input', () => {
    onlyDigits({ target: yearEl });
    if (yearEl.value.length === 4) tryConfirm();
  });

  yearEl.addEventListener('blur', () => {
    tryConfirm();
  });

  if (!value) dayEl.focus();
}