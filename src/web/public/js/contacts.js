import { initTable }        from './tableComponent.js';
import { openPerfilModal } from './perfil.js';

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
                 <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
                 <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
               </svg>`,
      action: (row) => openPerfilModal(row.id),
    },
  });

  reload();

  return { reload };
}
