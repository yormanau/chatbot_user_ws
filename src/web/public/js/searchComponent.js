export function initSearch({ inputId, endpoint, onResult, onSelect }) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Crear dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'search-dropdown';
  dropdown.hidden = true;
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dropdown);

  let searchTimeout = null;

  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();

    if (!q) {
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      if (onResult) onResult([]);
      return;
    }

    searchTimeout = setTimeout(async () => {
      const res  = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (onResult) onResult(data);

      // Si hay onSelect mostramos dropdown
      if (onSelect) {
        dropdown.innerHTML = '';
        if (data.length === 0) {
          dropdown.innerHTML = `<div class="search-dropdown__empty">Sin resultados</div>`;
        } else {
          data.forEach(user => {
            const item = document.createElement('div');
            item.className = 'search-dropdown__item';
            item.innerHTML = `
              <span class="search-dropdown__name">${user.name}</span>
              <span class="search-dropdown__phone">${user.phone}</span>
            `;
            item.addEventListener('click', () => {
              input.value = user.name;
              dropdown.hidden = true;
              onSelect(user);
            });
            dropdown.appendChild(item);
          });
        }
        dropdown.hidden = false;
      }
    }, 300);
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!input.parentElement.contains(e.target)) {
      dropdown.hidden = true;
    }
  });
}