export const SHEETS = {
  ministries: {
    id: 'Ministries',
    label: 'Ministries',
    view: 'table',
    columns: [
      { key: 'ministryName', label: 'Ministry', type: 'text', required: true },
      { key: 'roleName', label: 'Role', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'isActive', label: 'Active', type: 'toggle', default: true },
    ],
  },
};

export const SHEET_ORDER = ['ministries'];
