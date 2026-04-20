export function darkenHex(hex, factor = 0.84) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const h = n => Math.round(n * factor).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function getLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDarkMode() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark')  return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveIconAccent(hex) {
  return (isDarkMode() && getLuminance(hex) < 0.15) ? '#ffffff' : hex;
}

export function applyOnAccentLive(hex) { applyOnAccent(hex); }

function applyOnAccent(hex) {
  const [r, g, b] = hexToRgb(hex);
  const root = document.documentElement;
  root.style.setProperty('--on-accent',      hex);
  root.style.setProperty('--on-accent-muted',`rgba(${r},${g},${b},0.72)`);
  root.style.setProperty('--on-accent-sub',  `rgba(${r},${g},${b},0.65)`);
  root.style.setProperty('--on-accent-sep',  `rgba(${r},${g},${b},0.12)`);
  root.style.setProperty('--on-accent-ov',   `rgba(${r},${g},${b},0.10)`);
  root.style.setProperty('--on-accent-ac',   `rgba(${r},${g},${b},0.18)`);
}

export async function applySettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();

    if (s.accent_color) {
      document.documentElement.style.setProperty('--accent',   s.accent_color);
      document.documentElement.style.setProperty('--accent-h', darkenHex(s.accent_color));
      const iconAccent = (isDarkMode() && getLuminance(s.accent_color) < 0.15)
        ? '#ffffff'
        : s.accent_color;
      document.documentElement.style.setProperty('--icon-accent', iconAccent);
    }

    if (s.text_on_accent) {
      applyOnAccent(s.text_on_accent);
    }

    if (s.brand_name) {
      const brandText = document.querySelector('.sidebar-brand span');
      if (brandText) brandText.textContent = s.brand_name;
      const loginName = document.querySelector('.login-logo__name');
      if (loginName) loginName.textContent = s.brand_name;
      const isLogin = !!document.querySelector('.login-wrapper');
      document.title = isLogin ? `CRM — ${s.brand_name} · Acceso` : `CRM — ${s.brand_name}`;
    }

    if (s.theme === 'dark' || s.theme === 'light') {
      document.documentElement.dataset.theme = s.theme;
    }

    if (s.brand_logo) {
      // Sidebar icon: reemplaza SVG o img existente, conservando el id
      const iconEl = document.getElementById('sidebar-brand-icon');
      if (iconEl) {
        const img = document.createElement('img');
        img.id = 'sidebar-brand-icon';
        img.src = s.brand_logo;
        img.width = 26;
        img.height = 26;
        img.style.cssText = 'border-radius:6px;object-fit:contain;flex-shrink:0';
        iconEl.replaceWith(img);
      }
      // Login logo icon
      const loginIcon = document.querySelector('.login-logo__icon');
      if (loginIcon) {
        loginIcon.innerHTML = '';
        const img = document.createElement('img');
        img.src = s.brand_logo;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:6px';
        loginIcon.appendChild(img);
      }
      // Favicon
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = s.brand_logo;
    }
  } catch { /* silencioso */ }
}
