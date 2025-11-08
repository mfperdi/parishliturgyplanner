/**
 * ====================================================================
 * GLOBAL CONSTANTS (ENHANCED FOR PREFERREDMASSTIME SUPPORT)
 * ====================================================================
 * This file defines all sheet names and column numbers for the entire
 * project. If you change a sheet name or column order, update it here.
 * 
 * ENHANCED: Added support for EventID and other columns needed for
 * PreferredMassTime functionality.
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
    // ENHANCED: Column order updated to match new structure
    RECURRING_MASSES: {
      EVENT_ID: 1,           // ENHANCED: Moved to front for easy reference
      DAY_OF_WEEK: 2,
      TIME: 3,
      IS_ACTIVE: 4,
      IS_ANTICIPATED: 5,     // ENHANCED: Critical for Saturday vigil logic
      DESCRIPTION: 6,
      TEMPLATE_NAME: 7,
      ASSIGNED_GROUP: 8,
      NOTES: 9
    },
    
    // 'SpecialMasses' sheet (9 columns)
    // ENHANCED: Column order updated to match new structure
    SPECIAL_MASSES: {
      EVENT_ID: 1,           // ENHANCED: Moved to front for easy reference
      DATE: 2,
      TIME: 3,
      IS_ACTIVE: 4,
      IS_ANTICIPATED: 5,     // ENHANCED: Critical for vigil Mass logic
      DESCRIPTION: 6,
      TEMPLATE_NAME: 7,
      ASSIGNED_GROUP: 8,
      NOTES: 9
    },
    
    // 'MassTemplates' sheet (3 columns)
    TEMPLATES: {
      TEMPLATE_NAME: 1,
      MINISTRY_ROLE: 2,      // ENHANCED: Specific role name (e.g., "1st Reading")
      MINISTRY_SKILL: 3      // ENHANCED: General skill category (e.g., "Lector")
    },
    
    // 'Assignments' sheet (13 columns)
    // ENHANCED: Additional columns for better assignment tracking
    ASSIGNMENTS: {
      DATE: 1,
      TIME: 2,
      MASS_NAME: 3,
      LITURGICAL_CELEBRATION: 4,  // ENHANCED: Actual liturgical celebration name
      MINISTRY_ROLE: 5,           // ENHANCED: Specific role (e.g., "1st Reading")
      MINISTRY_SKILL: 6,          // ENHANCED: General skill (e.g., "Lector")
      ASSIGNED_VOLUNTEER_ID: 7,
      ASSIGNED_VOLUNTEER_NAME: 8,
      STATUS: 9,
      NOTES: 10,
      EVENT_ID: 11,               // ENHANCED: Critical for mass preference matching
      MONTH_YEAR: 12,             // ENHANCED: For efficient filtering (e.g., "2026-01")
      FAMILY_GROUP: 13            // ENHANCED: For family team assignment logic
    },
    
    // 'Volunteers' sheet (12 columns)
    // NOTE: You may need to update your volunteer sheet structure
    VOLUNTEERS: {
      VOLUNTEER_ID: 1,
      FIRST_NAME: 2,
      LAST_NAME: 3,
      FULL_NAME: 4,
      EMAIL: 5,
      PHONE: 6,
      MINISTRY_ROLE: 7,           // ENHANCED: Updated to match template structure
      PREF_MASS_TIME: 8,          // ENHANCED: Critical - comma-separated EventIDs
      DATE_CLEARED: 9,
      DATE_TRAINED: 10,
      FAMILY_TEAM: 11,            // ENHANCED: Updated name for clarity
      STATUS: 12                  // ENHANCED: Active/Substitute/Inactive
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
