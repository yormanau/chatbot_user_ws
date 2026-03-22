import { initInlineInput } from './inputComponent.js';
import { showToast } from './toast.js';

async function initPerfil() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    showError('ID de usuario no encontrado');
    return;
  }

  try {
    const res  = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error('Usuario no encontrado');
    const user = await res.json();
    renderPerfil(user);
  } catch (err) {
    showError(err.message);
  }
}

function renderPerfil(user) {
  const content = document.getElementById('perfil-content');
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

  function makeRow(label, value, field) {
    return `
        <div class="perfil-row" data-field="${field}">
        <span class="perfil-row__label">${label}</span>
        <span class="perfil-row__value">${value}</span>
        <button class="perfil-row__edit-btn" data-edit="✏️">✏️</button>
        <div class="perfil-row__edit-group">
            <input class="perfil-row__input" type="text" value="${value}">
            <button class="perfil-row__cancel">✕</button>
            <button class="perfil-row__confirm">✓</button>
        </div>
        </div>
    `;
    }

  content.innerHTML = `
    <div class="perfil-avatar-card">
      <div class="perfil-avatar">${initials}</div>
      <div class="perfil-avatar-info">
        <span class="perfil-name">${user.name}</span>
      </div>
    </div>

    <div class="perfil-card">
        <div class="perfil-card__header">Información de contacto</div>
        <div class="perfil-card__body">
            ${makeRow('Nombre', user.name, 'name')}
            <div class="perfil-row">
            <span class="perfil-row__label">Teléfono</span>
            <span class="perfil-row__value">${user.phone}</span>
            </div>
        </div>
    </div>

    <div class="perfil-card">
      <div class="perfil-card__header">Registro</div>
      <div class="perfil-card__body">
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

    <div class="perfil-empty">
      Más información próximamente
    </div>
  `;
  const fieldMessages = {
    name: { label: 'nombre', error: 'No se pudo actualizar el nombre' },
  };

  const fieldRules = {
    name:  [{ rule: 'required' }, { rule: 'minLength', value: 2 }],
    // email: [{ rule: 'required' }, { rule: 'emailFormat' }],
  };

  content.querySelectorAll('.perfil-row[data-field]').forEach(row => {
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
          return;
        }

        showToast('success', 'Actualización exitosa', `Se ha actualizado el ${fieldMessages[field]?.label || field} correctamente`);

        if (field === 'name') {
          const initials = newVal.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
          document.querySelector('.perfil-avatar').textContent = initials;
          document.querySelector('.perfil-name').textContent   = newVal;
        }
      }
    });
  });
}

function showError(msg) {
  document.getElementById('perfil-content').innerHTML = `
    <div class="perfil-empty">${msg}</div>
  `;
}

initPerfil();