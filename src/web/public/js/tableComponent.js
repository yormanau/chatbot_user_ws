/**
 * initTable — Componente reutilizable de tabla con búsqueda, filtros y paginación.
 *
 * @param {object} config
 * @param {string}   config.panelId       — ID del div contenedor del panel
 * @param {string}   config.btnId         — ID del botón que abre el panel
 * @param {string}   config.title         — Título del panel
 * @param {string}   config.endpoint      — URL del endpoint
 * @param {string}   config.searchPlaceholder — Placeholder del buscador
 * @param {Array}    config.columns       — Columnas de la tabla
 *   { key, label, sortable, toggleable, toggleLabel }
 * @param {Array}    config.filters       — Filtros del select de rango
 *   { value, label }
 * @param {Function} config.onRowAction   — Callback al hacer click en icono de acción (opcional)
 *   recibe el row completo como argumento
 */
export function initTable({
  panelId,
  btnId,
  title         = 'Tabla',
  endpoint,
  searchPlaceholder = '🔍  Buscar...',
  columns       = [],
  filters       = [],
  onRowAction   = null,
  rowsPerPage   = [10, 25, 50],
}) {
  // ── Estado ──────────────────────────────────────────────
  let sort    = { by: columns.find(c => c.sortable)?.key || '', dir: 'ASC' };
  let page    = 1;
  let limit = rowsPerPage[0];
  let range   = filters[0]?.value || 'all';
  let search  = '';
  let toggles = {};

  columns.forEach(col => {
    if (col.toggleable) toggles[col.key] = col.defaultVisible !== false; // ← cambia esto
  });

  // ── Render del panel ────────────────────────────────────
  const panel = document.getElementById(panelId);
  if (!panel) return;

  panel.innerHTML = `
    <div class="tabla-panel__header">
      <span class="tabla-panel__title">${title}</span>
      <button class="tabla-panel__close" data-action="close">✕</button>
    </div>

    <div class="tabla-search">
      <input type="text" class="tabla-search__input" placeholder="${searchPlaceholder}" data-action="search">
      ${filters.length || columns.some(c => c.toggleable)
        ? `<button class="tabla-panel__filter-btn" data-action="toggle-filters">⚙️</button>`
        : ''}
    </div>

    <div class="tabla-filter-modal" data-filters hidden>
      <div class="tabla-filter-modal__body">
        ${columns.filter(c => c.toggleable).map(col => `
          <label class="tabla-filter-check">
            <input type="checkbox" ${col.defaultVisible !== false ? 'checked' : ''} data-toggle="${col.key}">            <span>${col.toggleLabel || `Mostrar ${col.label.toLowerCase()}`}</span>
          </label>
        `).join('')}
        ${filters.length ? `
          <div class="tabla-filter-field">
            <span class="tabla-filter-label">Rango de fechas</span>
            <select class="analytics-select" data-action="range">
              ${filters.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div class="tabla-filter-field">
          <span class="tabla-filter-label">Filas por página</span>
          <select class="analytics-select" data-action="limit">
            ${rowsPerPage.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="tabla-panel__body">
      <table class="analytics-table" data-table>
        <thead>
          <tr>
            ${columns.map(col => `
              <th ${col.toggleable ? `data-col="${col.key}"` : ''} ${col.toggleable && col.defaultVisible === false ? 'hidden' : ''}>
                ${col.sortable
                  ? `<button class="sort-btn" data-sort="${col.key}" data-dir="ASC">
                      ${col.label} <span class="sort-icon">↑</span>
                    </button>`
                  : col.label}
              </th>
            `).join('')}
            ${onRowAction ? `<th>${onRowAction.label || 'Acción'}</th>` : ''}
          </tr>
        </thead>
        <tbody data-body></tbody>
      </table>
      <div class="analytics-results__empty" data-empty hidden>Sin resultados</div>
    </div>

    <div class="tabla-pagination" data-pagination>
      <button class="tabla-pagination__btn" data-action="prev">←</button>
      <div class="tabla-pagination__pages" data-pages></div>
      <button class="tabla-pagination__btn" data-action="next">→</button>
    </div>
  `;

  // ── Referencias ─────────────────────────────────────────
  const closeBtn     = panel.querySelector('[data-action="close"]');
  const searchInput  = panel.querySelector('[data-action="search"]');
  const filterToggle = panel.querySelector('[data-action="toggle-filters"]');
  const filterModal  = panel.querySelector('[data-filters]');
  const rangeSelect  = panel.querySelector('[data-action="range"]');
  const limitSelect  = panel.querySelector('[data-action="limit"]');
  const tbody        = panel.querySelector('[data-body]');
  const empty        = panel.querySelector('[data-empty]');
  const table        = panel.querySelector('[data-table]');
  const pagination   = panel.querySelector('[data-pagination]');
  const pagesDiv     = panel.querySelector('[data-pages]');
  const prevBtn      = panel.querySelector('[data-action="prev"]');
  const nextBtn      = panel.querySelector('[data-action="next"]');
  const openBtn      = document.getElementById(btnId);

  // ── Cargar datos ─────────────────────────────────────────
  async function load() {
    const params = new URLSearchParams({
      page, limit, search,
      sortBy:  sort.by,
      sortDir: sort.dir,
      ...(range ? { filter: range } : {}),
    });

    const res          = await fetch(`${endpoint}?${params}`);
    const { data, totalPages } = await res.json();

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      empty.hidden  = false;
      table.hidden  = true;
      pagination.hidden = true;
      return;
    }

    empty.hidden      = false;
    table.hidden      = false;
    pagination.hidden = false;
    empty.hidden      = true;

    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = columns.map(col => {
        let val = row[col.key] ?? '—';
        if (col.type === 'date' && val !== '—') {
          val = new Date(val).toLocaleDateString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          });
        }
        const hidden = col.toggleable && !toggles[col.key] ? 'hidden' : '';
        return `<td ${hidden}>${val}</td>`;
      }).join('');

      if (onRowAction) {
        const td = document.createElement('td');
        td.innerHTML = `<button class="tabla-row-action">${onRowAction.icon || '👤'}</button>`;
        td.querySelector('button').addEventListener('click', () => onRowAction.action(row));
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    // Paginación
    prevBtn.disabled = page === 1;
    nextBtn.disabled = page === totalPages;
    nextBtn.dataset.totalPages = totalPages;

    pagesDiv.innerHTML = '';
    let from = Math.max(1, page - 1);
    let to   = Math.min(totalPages, page + 1);
    if (to - from < 2) {
      if (from === 1) to = Math.min(3, totalPages);
      else if (to === totalPages) from = Math.max(1, totalPages - 2);
    }

    for (let i = from; i <= to; i++) {
      const btn = document.createElement('button');
      btn.className = `tabla-pagination__page${i === page ? ' active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => { page = i; load(); });
      pagesDiv.appendChild(btn);
    }
  }

  // ── Eventos ──────────────────────────────────────────────
  openBtn?.addEventListener('click', () => {
    panel.hidden = false;
    load();
  });

  closeBtn?.addEventListener('click', () => {
    panel.hidden = true;
  });

  filterToggle?.addEventListener('click', () => {
    filterModal.hidden = !filterModal.hidden;
  });

  // Toggles de columnas
  panel.querySelectorAll('[data-toggle]').forEach(chk => {
    chk.addEventListener('change', () => {
      const key = chk.dataset.toggle;
      toggles[key] = chk.checked;
      panel.querySelector(`[data-col="${key}"]`).hidden = !chk.checked;
      tbody.querySelectorAll('tr').forEach(tr => {
        const idx = columns.findIndex(c => c.key === key);
        if (tr.cells[idx]) tr.cells[idx].hidden = !chk.checked;
      });
    });
  });

  rangeSelect?.addEventListener('change', () => {
    range = rangeSelect.value;
    page  = 1;
    load();
  });

  limitSelect?.addEventListener('change', () => {
    limit = Number(limitSelect.value);
    page  = 1;
    load();
  });

  // Sort
  let searchTimeout = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      search = e.target.value.trim();
      page   = 1;
      load();
    }, 300);
  });

  panel.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sort = { by: btn.dataset.sort, dir: btn.dataset.dir };
      page = 1;

      panel.querySelectorAll('.sort-btn').forEach(b => {
        const isActive = b.dataset.sort === sort.by;
        b.classList.toggle('active', isActive);
        b.querySelector('.sort-icon').textContent = isActive
          ? (sort.dir === 'ASC' ? '↑' : '↓') : '↑';
        b.dataset.dir = isActive
          ? (sort.dir === 'ASC' ? 'DESC' : 'ASC') : 'ASC';
      });

      load();
    });
  });

  prevBtn?.addEventListener('click', () => {
    if (page > 1) { page--; load(); }
  });

  nextBtn?.addEventListener('click', () => {
    const total = Number(nextBtn.dataset.totalPages || 1);
    if (page < total) { page++; load(); }
  });

  // Retorna load para poder refrescar desde afuera
  return { reload: load };
}