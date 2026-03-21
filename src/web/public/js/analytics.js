const FILTER_LABELS = {
  all:   'Todos los usuarios',
  today: 'Usuarios de hoy',
  week:  'Usuarios de esta semana',
  month: 'Usuarios de este mes',
};

let currentFilter = 'all';
let currentSort   = { by: 'name', dir: 'ASC' };

async function initAnalytics() {
  if (!document.getElementById('analytics-total')) return;

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

  drawBars({ today, week, month });

  document.getElementById('analytics-filter-btn').addEventListener('click', async () => {
    currentFilter = document.getElementById('analytics-select').value;
    await fetchAndRender();
  });

  document.getElementById('analytics-results-close').addEventListener('click', () => {
    document.getElementById('analytics-results').hidden = true;
  });

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = { by: btn.dataset.sort, dir: btn.dataset.dir };
      fetchAndRender();
    });
  });
}

async function fetchAndRender() {
  const res  = await fetch(
    `/api/analytics/users/list?filter=${currentFilter}&sortBy=${currentSort.by}&sortDir=${currentSort.dir}`
  );
  const data = await res.json();

  const card  = document.getElementById('analytics-results');
  const title = document.getElementById('analytics-results-title');
  const tbody = document.getElementById('analytics-table-body');
  const empty = document.getElementById('analytics-results-empty');

  title.textContent = `${FILTER_LABELS[currentFilter] || 'Usuarios'} (${data.length})`;
  tbody.innerHTML   = '';

  if (data.length === 0) {
    empty.hidden = false;
    document.querySelector('.analytics-table').hidden = true;
  } else {
    empty.hidden = true;
    document.querySelector('.analytics-table').hidden = false;
    data.forEach(({ name, phone, create_at }) => {
      const date = new Date(create_at).toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${name}</td><td>${phone}</td><td>${date}</td>`;
      tbody.appendChild(tr);
    });
  }

  document.querySelectorAll('.sort-btn').forEach(btn => {
    const isActive = btn.dataset.sort === currentSort.by;
    btn.classList.toggle('active', isActive);
    btn.querySelector('.sort-icon').textContent = isActive
      ? (currentSort.dir === 'ASC' ? '↑' : '↓')
      : '↑';
    btn.dataset.dir = isActive
      ? (currentSort.dir === 'ASC' ? 'DESC' : 'ASC')
      : 'ASC';
  });

  card.hidden = false;
}

function drawBars({ today, week, month }) {
  const canvas = document.getElementById('analytics-chart');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(today, week, month, 1);
  const bars = [
    { label: 'Hoy',    value: today, color: '#075e54' },
    { label: 'Semana', value: week,  color: '#34d399' },
    { label: 'Mes',    value: month, color: '#93c5fd' },
  ];

  const barW      = 32;
  const gap       = (W - bars.length * barW) / (bars.length + 1);
  const maxH      = H - 36;
  const textColor = isDark ? '#888' : '#666';

  bars.forEach(({ label, value, color }, i) => {
    const x  = gap + i * (barW + gap);
    const bH = Math.max((value / maxVal) * maxH, value > 0 ? 4 : 0);
    const y  = maxH - bH;

    ctx.beginPath();
    ctx.roundRect(x, y, barW, bH, [6, 6, 0, 0]);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = isDark ? '#f0f0f0' : '#1a1a1a';
    ctx.font      = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(value, x + barW / 2, y - 6);

    ctx.fillStyle = textColor;
    ctx.font      = '11px system-ui';
    ctx.fillText(label, x + barW / 2, H - 6);
  });
}

export { initAnalytics };