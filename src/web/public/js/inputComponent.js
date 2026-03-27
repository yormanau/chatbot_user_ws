/**
 * inputComponent — Componente reutilizable de input con validación.
 *
 * Modos:
 * - inline:  edición inline en perfiles (editable con lápiz)
 * - form:    input estándar para formularios
 *
 * @param {object} config
 * @param {string}   config.containerId  — ID del div donde se renderiza (modo form)
 * @param {string}   config.mode         — 'inline' | 'form' (default: 'form')
 * @param {string}   config.type         — 'text' | 'number' | 'phone' | 'date' | 'select' | 'email'
 * @param {string}   config.label        — Etiqueta del campo
 * @param {string}   config.value        — Valor inicial
 * @param {string}   config.placeholder  — Placeholder del input
 * @param {Array}    config.options       — Opciones para select [{ value, label }]
 * @param {Array}    config.rules        — Reglas de validación
 *   { rule: 'required' | 'minLength' | 'maxLength' | 'onlyNumbers' | 'phoneFormat' | 'emailFormat', value?: number, message?: string }
 * @param {Function} config.onConfirm    — Callback al confirmar con el valor válido
 * @param {Function} config.onChange     — Callback en cada cambio (opcional)
 */

const VALIDATORS = {
  required:    (val)        => val.trim().length > 0,
  minLength:   (val, n)     => val.trim().length >= n,
  maxLength:   (val, n)     => val.trim().length <= n,
  onlyNumbers: (val)        => /^\d+$/.test(val.trim()),
  phoneFormat: (val)        => /^\+?\d{7,15}$/.test(val.trim()),
  emailFormat: (val)        => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
};

const DEFAULT_MESSAGES = {
  required:    'Este campo es requerido',
  minLength:   (n) => `Mínimo ${n} caracteres`,
  maxLength:   (n) => `Máximo ${n} caracteres`,
  onlyNumbers: 'Solo se permiten números',
  phoneFormat: 'Formato de teléfono inválido',
  emailFormat: 'Formato de email inválido',
};

function validate(value, rules = []) {
  for (const r of rules) {
    const fn = VALIDATORS[r.rule];
    if (!fn) continue;
    const pass = fn(value, r.value);
    if (!pass) {
      const defaultMsg = typeof DEFAULT_MESSAGES[r.rule] === 'function'
        ? DEFAULT_MESSAGES[r.rule](r.value)
        : DEFAULT_MESSAGES[r.rule];
      return r.message || defaultMsg;
    }
  }
  return null; // sin errores
}

function buildInput(type, value, placeholder, options, className = 'ic-input') {
  if (type === 'select') {
    return `
      <select class="${className}">
        ${placeholder ? `<option value="" disabled ${!value ? 'selected' : ''}>${placeholder}</option>` : ''}
        ${(options || []).map(o =>
          `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`
        ).join('')}
      </select>
    `;
  }

  const inputType = type === 'phone' ? 'tel'
    : type === 'number' ? 'number'
    : type === 'date'   ? 'date'
    : type === 'email'  ? 'email'
    : 'text';

  return `<input class="${className}" type="${inputType}" value="${value ?? ''}" placeholder="${placeholder ?? ''}">`;
}

// ── Modo inline (edición en perfil) ─────────────────────────────────────────
export function initInlineInput({
  rowEl,
  type        = 'text',
  value       = '',
  rules       = [],
  options     = [],
  onConfirm   = null,
  onChange    = null,
}) {
  const valueEl   = rowEl.querySelector('.perfil-row__value');
  const editBtn   = rowEl.querySelector('.perfil-row__edit-btn');
  const editGroup = rowEl.querySelector('.perfil-row__edit-group');
  const cancelBtn = rowEl.querySelector('.perfil-row__cancel');
  const confirmBtn = rowEl.querySelector('.perfil-row__confirm');
  const inputEl   = rowEl.querySelector('.perfil-row__input');

  // Inyectar error placeholder si no existe
  if (!rowEl.querySelector('.ic-error')) {
    const err = document.createElement('span');
    err.className = 'ic-error';
    err.hidden = true;
    editGroup.appendChild(err);
  }
  const errorEl = rowEl.querySelector('.ic-error');

  editBtn?.addEventListener('click', () => {
    rowEl.classList.add('perfil-row--editing');
    inputEl.focus();
    inputEl.select();
  });

  cancelBtn?.addEventListener('click', () => {
    inputEl.value = valueEl.textContent;
    errorEl.hidden = true;
    rowEl.classList.remove('perfil-row--editing');
  });

  inputEl?.addEventListener('input', () => {
    const err = validate(inputEl.value, rules);
    if (err) {
      errorEl.textContent = err;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
    }
    if (onChange) onChange(inputEl.value);
  });

  confirmBtn?.addEventListener('click', async () => {
    const newVal = inputEl.value.trim();
    const err    = validate(newVal, rules);

    if (err) {
      errorEl.textContent = err;
      errorEl.hidden = false;
      return;
    }

    if (newVal === valueEl.textContent) {
      rowEl.classList.remove('perfil-row--editing');
      return;
    }

    errorEl.hidden = true;
    const result = onConfirm ? await onConfirm(newVal) : null;
    valueEl.textContent = result ?? newVal;
    rowEl.classList.remove('perfil-row--editing');
  });
}

// ── Modo form (formularios) ─────────────────────────────────────────────────
export function initFormInput({
  containerId,
  type        = 'text',
  label       = '',
  value       = '',
  placeholder = '',
  options     = [],
  rules       = [],
  onConfirm   = null,
  onChange    = null,
  className   = 'ic-input',
}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="ic-field">
      ${label ? `<label class="ic-label">${label}</label>` : ''}
      ${buildInput(type, value, placeholder, options, className)}
      <span class="ic-error" hidden></span>
    </div>
  `;

  const inputEl  = container.querySelector('.ic-input');
  const errorEl  = container.querySelector('.ic-error');

  inputEl.addEventListener('input', () => {
    const err = validate(inputEl.value, rules);
    if (err) {
      errorEl.textContent = err;
      errorEl.hidden = false;
      inputEl.classList.add('ic-input--error');
    } else {
      errorEl.hidden = true;
      inputEl.classList.remove('ic-input--error');
    }
    if (onChange) onChange(inputEl.value);
  });

  inputEl.addEventListener('blur', () => {
    const err = validate(inputEl.value, rules);
    if (!err && onConfirm) onConfirm(inputEl.value.trim());
  });

  // Método público para obtener valor y validar
  return {
    getValue: () => inputEl.value.trim(),
    validate: () => {
      const err = validate(inputEl.value, rules);
      if (err) {
        errorEl.textContent = err;
        errorEl.hidden = false;
        inputEl.classList.add('ic-input--error');
        return false;
      }
      errorEl.hidden = true;
      inputEl.classList.remove('ic-input--error');
      return true;
    },
    reset: () => {
      inputEl.value = '';
      errorEl.hidden = true;
      inputEl.classList.remove('ic-input--error');
    }
  };
}
