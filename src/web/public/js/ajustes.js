import { showToast }    from './toast.js';
import { applySettings, darkenHex, applyOnAccentLive, resolveIconAccent } from './themeSettings.js';

export function initAjustes() {
  loadSettings();
  setupColorPicker();
  setupTextOnAccentPicker();
  setupLogoUpload();
  setupThemeToggle();
  document.getElementById('aj-save')?.addEventListener('click', save);
}

let pendingLogo  = undefined; // undefined=sin cambio, null=borrado, string=nuevo base64
let currentTheme = document.documentElement.dataset.theme || 'dark';

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const s   = await res.json();

    if (s.accent_color) {
      const input = document.getElementById('aj-accent');
      if (input) input.value = s.accent_color;
      updateColorPreview(s.accent_color);
    } else {
      updateColorPreview('#075e54');
    }

    if (s.brand_name) {
      const input = document.getElementById('aj-brand-name');
      if (input) input.value = s.brand_name;
    }

    if (s.brand_logo) showLogoPreview(s.brand_logo);

    if (s.text_on_accent) {
      const toa = document.getElementById('aj-text-on-accent');
      if (toa) toa.value = s.text_on_accent;
      updateToaPreview(s.text_on_accent);
    } else {
      updateToaPreview('#ffffff');
    }

    if (s.theme === 'dark' || s.theme === 'light') {
      currentTheme = s.theme;
    }
    setActiveThemeBtn(currentTheme);
  } catch (e) {
    console.error('[ajustes] load error', e);
  }
}

function setupThemeToggle() {
  document.querySelectorAll('.aj-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTheme = btn.dataset.theme;
      document.documentElement.dataset.theme = currentTheme;
      setActiveThemeBtn(currentTheme);
    });
  });
}

function setActiveThemeBtn(theme) {
  document.querySelectorAll('.aj-theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function setupColorPicker() {
  const input = document.getElementById('aj-accent');
  input?.addEventListener('input', () => {
    updateColorPreview(input.value);
    document.documentElement.style.setProperty('--accent',      input.value);
    document.documentElement.style.setProperty('--accent-h',    darkenHex(input.value));
    document.documentElement.style.setProperty('--icon-accent', resolveIconAccent(input.value));
  });
}

function setupTextOnAccentPicker() {
  const input = document.getElementById('aj-text-on-accent');
  input?.addEventListener('input', () => {
    updateToaPreview(input.value);
    applyOnAccentLive(input.value);
  });
}

function updateToaPreview(hex) {
  const swatch   = document.getElementById('aj-toa-swatch');
  const hexLabel = document.getElementById('aj-toa-hex');
  if (swatch)   swatch.style.background = hex;
  if (hexLabel) hexLabel.textContent     = hex;
}

function updateColorPreview(hex) {
  const swatch      = document.getElementById('aj-color-swatch');
  const hexLabel    = document.getElementById('aj-color-hex');
  const hoverSwatch = document.getElementById('aj-color-hover-swatch');

  if (swatch)      swatch.style.background = hex;
  if (hexLabel)    hexLabel.textContent     = hex;
  if (hoverSwatch) hoverSwatch.style.background = darkenHex(hex);
}

function setupLogoUpload() {
  const area      = document.getElementById('aj-upload-area');
  const fileInput = document.getElementById('aj-logo-file');
  const btnUpload = document.getElementById('aj-btn-upload');
  const btnClear  = document.getElementById('aj-btn-clear');

  area?.addEventListener('click',      () => fileInput?.click());
  btnUpload?.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      showToast('error', 'Imagen muy grande', 'Usa una imagen menor a 200KB');
      return;
    }
    resizeImage(file, 128, (dataUrl) => {
      pendingLogo = dataUrl;
      showLogoPreview(dataUrl);
    });
    fileInput.value = '';
  });

  btnClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    pendingLogo = null;
    hideLogoPreview();
  });
}

function resizeImage(file, maxSize, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const scale   = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas  = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL('image/png'));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showLogoPreview(src) {
  const preview     = document.getElementById('aj-logo-preview');
  const placeholder = document.getElementById('aj-upload-placeholder');
  const btnClear    = document.getElementById('aj-btn-clear');

  if (preview)     { preview.src = src; preview.hidden = false; }
  if (placeholder)   placeholder.hidden = true;
  if (btnClear)      btnClear.hidden = false;
}

function hideLogoPreview() {
  const preview     = document.getElementById('aj-logo-preview');
  const placeholder = document.getElementById('aj-upload-placeholder');
  const btnClear    = document.getElementById('aj-btn-clear');

  if (preview)     { preview.src = ''; preview.hidden = true; }
  if (placeholder)   placeholder.hidden = false;
  if (btnClear)      btnClear.hidden = true;
}

async function save() {
  const btn       = document.getElementById('aj-save');
  const accentVal = document.getElementById('aj-accent')?.value;
  const nameVal   = document.getElementById('aj-brand-name')?.value?.trim() ?? '';

  const toaVal = document.getElementById('aj-text-on-accent')?.value;

  const body = {
    accent_color:    accentVal,
    brand_name:      nameVal,
    theme:           currentTheme,
    text_on_accent:  toaVal,
  };
  if (pendingLogo !== undefined) body.brand_logo = pendingLogo ?? '';

  btn.disabled = true;
  try {
    const res = await fetch('/api/settings', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error();

    pendingLogo = undefined;
    await applySettings();
    showToast('success', 'Ajustes guardados', 'Los cambios se aplicaron correctamente');
  } catch {
    showToast('error', 'Error', 'No se pudieron guardar los ajustes');
  } finally {
    btn.disabled = false;
  }
}
