import { initTable } from './tableComponent.js';

export function initContacts() {
  const panel = document.getElementById('contacts-panel');
  if (!panel) return;

  panel.hidden = false;

  const { reload } = initTable({
    panelId:           'contacts-panel',
    btnId:             null,
    title:             'Contactos',
    endpoint:          '/api/analytics/users/list',
    searchPlaceholder: 'Buscar nombre o teléfono...',
    columns: [
      { key: 'name',      label: 'Nombre',           sortable: true  },
      { key: 'phone',     label: 'Teléfono',          sortable: false },
      { key: 'create_at', label: 'Fecha de registro', sortable: true, toggleable: true, toggleLabel: 'Mostrar fecha de registro', type: 'date', defaultVisible: false },
    ],
    filters: [
      { value: 'all',   label: 'Todos'       },
      { value: 'today', label: 'Hoy'         },
      { value: 'week',  label: 'Esta semana' },
      { value: 'month', label: 'Este mes'    },
    ],
    rowsPerPage: [10, 25, 50],
    onRowAction: {
      label:  'Ver perfil',
      icon:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                 <path d="M10 4H6C5.47 4 4.96 4.21 4.59 4.59C4.21 4.96 4 5.47 4 6V18C4 18.53 4.21 19.04 4.59 19.41C4.96 19.79 5.47 20 6 20H18C18.53 20 19.04 19.79 19.41 19.41C19.79 19.04 20 18.53 20 18V14M12 12L20 4M20 4V9M20 4H15" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>`,
      action: (row) => window.open(`/perfil?id=${row.id}`, '_blank'),
    },
  });

  reload();

  return { reload };
}
