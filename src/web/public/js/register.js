import { initDatePicker } from './datePicker.js';
import { showToast }      from './toast.js';
import { initFormInput }  from './inputComponent.js';

export function initRegistrarUsuario() {
  const btn = document.getElementById('btn-registrar-usuario');
  if (!btn) return;
  btn.addEventListener('click', abrirFormularioRegistro);
}

export function abrirFormularioRegistro() {
  if (document.getElementById('register-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'register-overlay';
  overlay.className = 'register-overlay';

  overlay.innerHTML = `
    <div class="register-panel">
      <div class="register-panel__header">
        <div class="register-panel__title">
          <span class="register-panel__icon">👤</span>
          <span>Registrar Contacto</span>
        </div>
        <button class="register-panel__close" id="register-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="register-panel__body">
        <div class="register-form" id="register-form">
          <div class="register-form__group"><div id="field-nombre"></div></div>
          <div class="register-form__group"><div id="field-telefono"></div></div>
          <div class="register-form__group"><div id="field-email"></div></div>
          <div class="register-form__group"><div id="field-gender"></div></div>
          <div class="register-form__group"><div id="field-ciudad"></div></div>
          <div class="register-form__group">
            <span class="ic-label">FECHA DE NACIMIENTO</span>
            <div id="reg-birth-dp"></div>
          </div>
          <div class="divider"></div>
          <div class="register-form__actions">
            <button class="register-form__btn register-form__btn--cancel" id="register-cancel">Cancelar</button>
            <button class="register-form__btn register-form__btn--submit" id="register-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              Registrar contacto
            </button>
          </div>
          <div class="register-form__feedback" id="register-feedback" hidden></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('register-overlay--visible'));

  const nombreInput   = initFormInput({ containerId: 'field-nombre',   label: 'Nombre completo *',   placeholder: 'Ej: Juan Pérez',          rules: [{ rule: 'required' }, { rule: 'minLength', value: 2 }] });
  const telefonoInput = initFormInput({ containerId: 'field-telefono',  label: 'Teléfono WhatsApp *', type: 'phone', placeholder: '+57 300 000 0000', rules: [{ rule: 'required' }, { rule: 'phoneFormat' }] });
  const emailInput    = initFormInput({ containerId: 'field-email',     label: 'Correo electrónico',  type: 'email', placeholder: 'Ej: juan@correo.com', rules: [{ rule: 'email' }] });
  const ciudadInput   = initFormInput({ containerId: 'field-ciudad',    label: 'Ciudad',              placeholder: 'Ej: Bogotá' });
  const genderInput   = initFormInput({ containerId: 'field-gender',    label: 'Género', type: 'select', placeholder: 'Selecciona...', options: [{ value: 'Masculino', label: 'Masculino' }, { value: 'Femenino', label: 'Femenino' }], className: 'ic-input' });

  let birthDate = null;
  initDatePicker(document.getElementById('reg-birth-dp'), {
    onConfirm: (dateStr) => { birthDate = dateStr; }
  });

  const cerrar = () => {
    overlay.classList.remove('register-overlay--visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  document.getElementById('register-close').addEventListener('click', cerrar);
  document.getElementById('register-cancel').addEventListener('click', cerrar);

  const onKeyDown = (e) => { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', onKeyDown); } };
  document.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  document.getElementById('register-submit').addEventListener('click', async () => {
    const isNombreValid   = nombreInput.validate();
    const isTelefonoValid = telefonoInput.validate();
    if (!isNombreValid || !isTelefonoValid) {
      showToast('error', 'Datos inválidos', 'Por favor corrige los campos resaltados.');
      return;
    }

    const submitBtn = document.getElementById('register-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrando...';

    const body = {
      nombre:   nombreInput.getValue(),
      telefono: telefonoInput.getValue(),
    };

    const email  = emailInput?.getValue?.()?.trim();
    const gender = genderInput?.getValue?.();
    const ciudad = ciudadInput?.getValue?.()?.trim();

    if (email)     body.email      = email;
    if (gender)    body.gender     = gender;
    if (ciudad)    body.ciudad     = ciudad;
    if (birthDate) body.birth_date = birthDate;

    try {
      const res  = await fetch('/api/users/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast('error', 'Error', data.error || 'No se pudo registrar el contacto.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Registrar contacto`;
        return;
      }

      setTimeout(cerrar, 400);
    } catch (err) {
      console.error('[register]', err);
      showToast('error', 'Error de conexión', 'Intenta de nuevo.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Registrar contacto`;
    }
  });
}
