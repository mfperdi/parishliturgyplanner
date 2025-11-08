/**
 * ====================================================================
 * GLOBAL CONSTANTS (CORRECTED TO MATCH USER'S DATA STRUCTURE)
 * ====================================================================
 * 
 * CORRECTED: Column 11 "Preference" contains Mass times (SUN-1000)
 *            Column 12 "PreferredMassTime" contains role preferences
 */
const CONSTANTS = {
  // 1. Sheet Names
  SHEETS: {
    CONFIG: "Config",
    VOLUNTEERS: "Volunteers",
    TIMEOFFS: "Timeoffs",
    TEMPLATES: "MassTemplates",
    RECURRING_MASSES: "RecurringMasses",
    SPECIAL_MASSES: "SpecialMasses",
    SAINTS_CALENDAR: "SaintsCalendar",
    OVERRIDES: "CalendarOverrides",
    CALENDAR: "LiturgicalCalendar",
    ASSIGNMENTS: "Assignments"
  },
  
  // 2. Column Number Maps
  COLS: {
    // 'Config' sheet
    CONFIG: {
      SETTING: 1,
      VALUE: 2
    },
    
    // 'LiturgicalCalendar' sheet (7 columns)
    CALENDAR: {
      DATE: 1,
      WEEKDAY: 2,
      LITURGICAL_CELEBRATION: 3,
      OPTIONAL_MEMORIAL: 4,
      SEASON: 5,
      RANK: 6,
      COLOR: 7
    },
    
    // 'SaintsCalendar' sheet (6 columns)
    SAINTS_CALENDAR: {
      MONTH: 1,
      DAY: 2,
      LITURGICAL_CELEBRATION: 3,
      RANK: 4,
      COLOR: 5,
      CALENDAR: 6
    },
    
    // 'CalendarOverrides' sheet (7 columns)
    OVERRIDES: {
      MONTH: 1,
      DAY: 2,
      LITURGICAL_CELEBRATION: 3,
      RANK: 4,
      COLOR: 5,
      CALENDAR: 6,
      NOTES: 7
    },
    
    // 'RecurringMasses' sheet (9 columns)
    RECURRING_MASSES: {
      EVENT_ID: 1,
      DAY_OF_WEEK: 2,
      TIME: 3,
      IS_ACTIVE: 4,
      IS_ANTICIPATED: 5,
      DESCRIPTION: 6,
      TEMPLATE_NAME: 7,
      ASSIGNED_GROUP: 8,         // Column H
      NOTES: 9
    },
    
    // 'SpecialMasses' sheet (9 columns)
    SPECIAL_MASSES: {
      EVENT_ID: 1,
      DATE: 2,
      TIME: 3,
      IS_ACTIVE: 4,
      IS_ANTICIPATED: 5,
      DESCRIPTION: 6,
      TEMPLATE_NAME: 7,
      ASSIGNED_GROUP: 8,         // Column H
      NOTES: 9
    },
    
    // 'MassTemplates' sheet (3 columns)
    TEMPLATES: {
      TEMPLATE_NAME: 1,
      MINISTRY_ROLE: 2,
      MINISTRY_SKILL: 3
    },
    
    // 'Assignments' sheet (12 columns - AssignedGroup in column H)
    ASSIGNMENTS: {
      DATE: 1,
      TIME: 2,
      MASS_NAME: 3,
      LITURGICAL_CELEBRATION: 4,
      MINISTRY_ROLE: 5,
      EVENT_ID: 6,
      MONTH_YEAR: 7,
      ASSIGNED_GROUP: 8,          // Column H
      ASSIGNED_VOLUNTEER_ID: 9,
      ASSIGNED_VOLUNTEER_NAME: 10,
      STATUS: 11,
      NOTES: 12
    },
    
    // 'Volunteers' sheet (14 columns)
    // CORRECTED: Based on user's actual data structure
    VOLUNTEERS: {
      VOLUNTEER_ID: 1,
      FIRST_NAME: 2,
      LAST_NAME: 3,
      FULL_NAME: 4,
      EMAIL: 5,
      PHONE: 6,
      PARENT_GUARDIAN_NAME: 7,
      FAMILY_TEAM: 8,
      STATUS: 9,
      MINISTRY_ROLE: 10,
      PREFERRED_MASS_TIME: 11,        // Mass time preferences (e.g., "SUN-1000")
      MINISTRY_ROLE_PREFERENCE: 12,   // Role preferences (e.g., "1st reading")
      DATE_CLEARED: 13,
      DATE_TRAINED: 14
    },
    
    // 'Timeoffs' sheet (4 columns)
    TIMEOFFS: {
      VOLUNTEER_NAME: 1,
      TYPE: 2,
      START_DATE: 3,
      END_DATE: 4
    }
  }
};
