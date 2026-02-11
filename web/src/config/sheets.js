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

  liturgicalNotes: {
    id: 'LiturgicalNotes',
    label: 'Liturgical Notes',
    view: 'table',
    columns: [
      { key: 'celebration', label: 'Celebration', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  config: {
    id: 'Config',
    label: 'Config',
    view: 'settings',
    columns: [
      { key: 'setting', label: 'Setting', type: 'readonly' },
      { key: 'value', label: 'Value', type: 'text' },
    ],
  },

  massTemplates: {
    id: 'MassTemplates',
    label: 'Mass Templates',
    view: 'table',
    columns: [
      { key: 'templateName', label: 'Template', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'roles', label: 'Roles', type: 'multiselect', optionsFrom: { sheet: 'Ministries', column: 1 } },
    ],
  },

  calendarOverrides: {
    id: 'CalendarOverrides',
    label: 'Calendar Overrides',
    view: 'table',
    columns: [
      { key: 'month', label: 'Month', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12'], required: true },
      { key: 'day', label: 'Day', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31'], required: true },
      { key: 'liturgicalCelebration', label: 'Celebration', type: 'text', required: true },
      { key: 'rank', label: 'Rank', type: 'select', options: ['Solemnity','Feast','Sunday','Memorial','Optional Memorial','Weekday'], required: true },
      { key: 'color', label: 'Color', type: 'select', options: ['White','Violet','Rose','Green','Red','Gold','Blue','Black'], required: true },
      { key: 'calendar', label: 'Calendar', type: 'select', options: ['General Roman Calendar','USA','Parish'], required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  saintsCalendar: {
    id: 'SaintsCalendar',
    label: 'Saints Calendar',
    view: 'table',
    columns: [
      { key: 'month', label: 'Month', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12'], required: true },
      { key: 'day', label: 'Day', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31'], required: true },
      { key: 'liturgicalCelebration', label: 'Celebration', type: 'text', required: true },
      { key: 'rank', label: 'Rank', type: 'select', options: ['Solemnity','Feast','Sunday','Memorial','Optional Memorial','Weekday'], required: true },
      { key: 'color', label: 'Color', type: 'select', options: ['White','Violet','Rose','Green','Red','Gold','Blue','Black'], required: true },
      { key: 'calendar', label: 'Calendar', type: 'select', options: ['General Roman Calendar','USA','Parish'], required: true },
    ],
  },

  volunteers: {
    id: 'Volunteers',
    label: 'Volunteers',
    view: 'table',
    columns: [
      { key: 'volunteerId', label: 'ID', type: 'text', required: true },
      { key: 'firstName', label: 'First Name', type: 'text', required: true },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'fullName', label: 'Full Name', type: 'readonly', computed: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'parentGuardian', label: 'Parent/Guardian', type: 'text' },
      { key: 'familyTeam', label: 'Family Team', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active','Inactive','Substitute Only','Ministry Sponsor','Parent/Guardian'], required: true },
      { key: 'ministries', label: 'Ministries', type: 'multiselect', optionsFrom: { sheet: 'Ministries', column: 0 } },
      { key: 'roles', label: 'Roles', type: 'multiselect', optionsFrom: { sheet: 'Ministries', column: 1 } },
      { key: 'preferredMassTime', label: 'Preferred Mass Time', type: 'multiselect', optionsFrom: { sheet: 'WeeklyMasses', column: 0, also: ['MonthlyMasses', 'YearlyMasses'] } },
      { key: 'dateCleared', label: 'Date Cleared', type: 'date' },
      { key: 'dateTrained', label: 'Date Trained', type: 'date' },
    ],
  },

  weeklyMasses: {
    id: 'WeeklyMasses',
    label: 'Weekly Masses',
    view: 'table',
    columns: [
      { key: 'eventId', label: 'Event ID', type: 'text', required: true },
      { key: 'dayOfWeek', label: 'Day', type: 'select', options: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
      { key: 'time', label: 'Time', type: 'time', required: true },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'endDate', label: 'End Date', type: 'date' },
      { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      { key: 'isAnticipated', label: 'Anticipated', type: 'toggle', default: false },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'templateName', label: 'Template', type: 'select', optionsFrom: { sheet: 'MassTemplates', column: 0 }, required: true },
      { key: 'assignedGroup', label: 'Group', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  monthlyMasses: {
    id: 'MonthlyMasses',
    label: 'Monthly Masses',
    view: 'table',
    columns: [
      { key: 'eventId', label: 'Event ID', type: 'text', required: true },
      { key: 'weekOfMonth', label: 'Week', type: 'select', options: ['1st','2nd','3rd','4th','5th','Last'], required: true },
      { key: 'dayOfWeek', label: 'Day', type: 'select', options: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
      { key: 'time', label: 'Time', type: 'time', required: true },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'endDate', label: 'End Date', type: 'date' },
      { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      { key: 'isAnticipated', label: 'Anticipated', type: 'toggle', default: false },
      { key: 'overrideType', label: 'Override', type: 'select', options: ['append','overrideday'] },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'templateName', label: 'Template', type: 'select', optionsFrom: { sheet: 'MassTemplates', column: 0 }, required: true },
      { key: 'assignedGroup', label: 'Group', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  yearlyMasses: {
    id: 'YearlyMasses',
    label: 'Yearly Masses',
    view: 'table',
    columns: [
      { key: 'eventId', label: 'Event ID', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'liturgicalCelebration', label: 'Celebration', type: 'text' },
      { key: 'time', label: 'Time', type: 'time', required: true },
      { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      { key: 'isAnticipated', label: 'Anticipated', type: 'toggle', default: false },
      { key: 'overrideType', label: 'Override', type: 'select', options: ['append','override'] },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'templateName', label: 'Template', type: 'select', optionsFrom: { sheet: 'MassTemplates', column: 0 }, required: true },
      { key: 'assignedGroup', label: 'Group', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
};

export const SHEET_ORDER = [
  'ministries', 'liturgicalNotes', 'config', 'massTemplates',
  'calendarOverrides', 'saintsCalendar', 'volunteers',
  'weeklyMasses', 'monthlyMasses', 'yearlyMasses'
];
