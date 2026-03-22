import { initTable } from './tableComponent.js';

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

  initTable({
    panelId:  'tabla-panel',
    btnId:    'btn-ver-tabla',
    title:    'Tabla de usuarios',
    endpoint: '/api/analytics/users/list',
    searchPlaceholder: '🔍  Buscar nombre o teléfono...',
    columns: [
      { key: 'name',      label: 'Nombre',   sortable: true  },
      { key: 'phone',     label: 'Teléfono', sortable: false },
      { key: 'create_at', label: 'Fecha', sortable: true, toggleable: true, toggleLabel: 'Mostrar fecha de registro', type: 'date', defaultVisible: false }
    ],
    filters: [
      { value: 'all',   label: 'Todos'       },
      { value: 'today', label: 'Hoy'         },
      { value: 'week',  label: 'Esta semana' },
      { value: 'month', label: 'Este mes'    },
    ],
    rowsPerPage: [5, 10, 25, 50],
    onRowAction: {
      label:  'Perfil',
      icon:   '👤',
      action: (row) => {
        console.log('Usuario:', row);
        window.open(`/perfil?id=${row.id}`, '_blank');
      }
    }
  });
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