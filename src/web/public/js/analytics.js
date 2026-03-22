let currentSort  = { by: 'name', dir: 'ASC' };
let currentPage  = 1;
let currentLimit = 10;
let currentRange = 'all';
let showDate     = true;
let currentSearch = '';

async function initAnalytics() {
  if (!document.getElementById('analytics-total')) return;

  await refreshAnalytics();

  const toggle = document.getElementById('analytics-toggle');
  const body   = document.getElementById('analytics-body');

  toggle.addEventListener('click', () => {
    const isOpen = !body.hidden;
    body.hidden  = isOpen;
    toggle.textContent = isOpen ? '+' : '−';
  });

  document.getElementById('btn-ver-tabla').addEventListener('click', async () => {
    document.getElementById('tabla-panel').hidden = false;
    await loadTable();
  });

  document.getElementById('tabla-panel-close').addEventListener('click', () => {
    document.getElementById('tabla-panel').hidden = true;
  });

  document.getElementById('tabla-filter-btn').addEventListener('click', () => {
    const modal = document.getElementById('tabla-filter-modal');
    modal.hidden = !modal.hidden;
  });

  document.getElementById('show-date').addEventListener('change', () => {
    showDate = document.getElementById('show-date').checked;
    document.getElementById('col-fecha').hidden = !showDate;
    document.querySelectorAll('#tabla-body tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells[2]) cells[2].hidden = !showDate;
    });
  });

  document.getElementById('tabla-filter-range').addEventListener('change', async () => {
    currentRange = document.getElementById('tabla-filter-range').value;
    currentPage  = 1;
    await loadTable();
  });

  document.getElementById('tabla-limit').addEventListener('change', async () => {
    currentLimit = Number(document.getElementById('tabla-limit').value);
    currentPage  = 1;
    await loadTable();
  });

  document.querySelectorAll('#tabla-panel .sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = { by: btn.dataset.sort, dir: btn.dataset.dir };
      currentPage = 1;

      document.querySelectorAll('#tabla-panel .sort-btn').forEach(b => {
        const isActive = b.dataset.sort === currentSort.by;
        b.classList.toggle('active', isActive);
        b.querySelector('.sort-icon').textContent = isActive
          ? (currentSort.dir === 'ASC' ? '↑' : '↓') : '↑';
        b.dataset.dir = isActive
          ? (currentSort.dir === 'ASC' ? 'DESC' : 'ASC') : 'ASC';
      });

      loadTable();
    });
  });

  document.getElementById('tabla-prev').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadTable(); }
  });

  document.getElementById('tabla-next').addEventListener('click', () => {
    const totalPages = Number(document.getElementById('tabla-next').dataset.totalPages || 1);
    if (currentPage < totalPages) { currentPage++; loadTable(); }
  });

  let searchTimeout = null;
  document.getElementById('tabla-search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      currentSearch = e.target.value.trim();
      currentPage   = 1;
      await loadTable();
    }, 300); // espera 300ms después de que el usuario deje de escribir
  });
}

async function loadTable() {
  const res = await fetch(
    `/api/analytics/users/list?filter=${currentRange}&sortBy=${currentSort.by}&sortDir=${currentSort.dir}&page=${currentPage}&limit=${currentLimit}&search=${encodeURIComponent(currentSearch)}`
  );
  const { data, total, totalPages } = await res.json();

  const tbody = document.getElementById('tabla-body');
  const empty = document.getElementById('tabla-empty');

  tbody.innerHTML = '';

  if (data.length === 0) {
    empty.hidden = false;
    document.getElementById('tabla-table').hidden = true;
    document.getElementById('tabla-pagination').hidden = true;
    return;
  }

  empty.hidden = true;
  document.getElementById('tabla-table').hidden = false;
  document.getElementById('tabla-pagination').hidden = false;

  data.forEach(({ name, phone, create_at }) => {
    const date = new Date(create_at).toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name}</td>
      <td>${phone}</td>
      <td ${!showDate ? 'hidden' : ''}>${date}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('tabla-prev').disabled = currentPage === 1;
  document.getElementById('tabla-next').disabled = currentPage === totalPages;
  document.getElementById('tabla-next').dataset.totalPages = totalPages;

  const pagesDiv = document.getElementById('tabla-pages');
  pagesDiv.innerHTML = '';

  let from = Math.max(1, currentPage - 1);
  let to   = Math.min(totalPages, currentPage + 1);

  if (to - from < 2) {
    if (from === 1) to = Math.min(3, totalPages);
    else if (to === totalPages) from = Math.max(1, totalPages - 2);
  }

  for (let i = from; i <= to; i++) {
    const btn = document.createElement('button');
    btn.className = `tabla-pagination__page${i === currentPage ? ' active' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => { currentPage = i; loadTable(); });
    pagesDiv.appendChild(btn);
  }
}

async function refreshAnalytics() {
  const [resTotal, resToday, resWeek, resMonth] = await Promise.all([
    fetch('/api/analytics/users?filter=all'),
    fetch('/api/analytics/users?filter=today'),
    fetch('/api/analytics/users?filter=week'),
    fetch('/api/analytics/users?filter=month'),
  ]);

  const { total }        = await resTotal.json();
  const { total: today } = await resToday.json();
  const { total: week }  = await resWeek.json();
  const { total: month } = await resMonth.json();

  document.getElementById('analytics-total').textContent = total ?? 0;
  document.getElementById('legend-today').textContent    = today ?? 0;
  document.getElementById('legend-week').textContent     = week  ?? 0;
  document.getElementById('legend-month').textContent    = month ?? 0;
}

export { initAnalytics, refreshAnalytics };