import { initTable } from './tableComponent.js';

function formatCurrency(value) {
  return value != null
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
    : '—';
}

export function initProducts() {
  const panel = document.getElementById('products-panel');
  if (!panel) return;

  panel.hidden = false;

  const { reload } = initTable({
    panelId:           'products-panel',
    btnId:             null,
    title:             'Productos',
    endpoint:          '/api/products/list',
    searchPlaceholder: 'Buscar producto...',
    columns: [
      { key: 'name',          label: 'Producto',         sortable: true },
      { key: 'times_sold',    label: 'Veces vendido',    sortable: true },
      { key: 'avg_price',     label: 'Precio promedio',  sortable: true, format: formatCurrency },
      { key: 'total_revenue', label: 'Ingresos totales', sortable: true, format: formatCurrency },
    ],
    filters:     [],
    rowsPerPage: [10, 25, 50],
  });

  reload();

  return { reload };
}