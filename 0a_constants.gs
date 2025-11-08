/**
 * ====================================================================
 * GLOBAL CONSTANTS (UPDATED FOR FAMILY TEAM & ROLE PREFERENCES)
 * ====================================================================
 * 
 * CHANGES MADE:
 * 1. Added ROLE_PREFERENCES column to Volunteers sheet
 * 2. Updated column count for Volunteers sheet
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
      ASSIGNED_GROUP: 8,
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
      ASSIGNED_GROUP: 8,
      NOTES: 9
    },
    
    // 'MassTemplates' sheet (3 columns)
    TEMPLATES: {
      TEMPLATE_NAME: 1,
      MINISTRY_ROLE: 2,
      MINISTRY_SKILL: 3
    },
    
    // 'Assignments' sheet (13 columns)
    ASSIGNMENTS: {
      DATE: 1,
      TIME: 2,
      MASS_NAME: 3,
      LITURGICAL_CELEBRATION: 4,
      MINISTRY_ROLE: 5,
      MINISTRY_SKILL: 6,
      ASSIGNED_VOLUNTEER_ID: 7,
      ASSIGNED_VOLUNTEER_NAME: 8,
      STATUS: 9,
      NOTES: 10,
      EVENT_ID: 11,
      MONTH_YEAR: 12,
      FAMILY_GROUP: 13
    },
    
    // 'Volunteers' sheet (14 columns)
    // UPDATED: Based on actual column order provided by user
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
      PREFERENCE: 11,             // Role preferences (renamed from ROLE_PREFERENCES)
      PREFERRED_MASS_TIME: 12,
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

/*
 * IMPLEMENTATION NOTES:
 * 
 * 1. FAMILY TEAM GROUPINGS:
 *    - Volunteers with the same value in FAMILY_GROUP column will be prioritized
 *      to serve at the same Mass
 *    - +25 point bonus when family members are already assigned to a Mass
 *    - Family team name is stored in FAMILY_GROUP column of Assignments sheet
 * 
 * 2. ROLE PREFERENCES:
 *    - New ROLE_PREFERENCES column (I) in Volunteers sheet
 *    - Comma-separated list of preferred ministry roles (lowercase)
 *    - Examples: "1st reading", "psalm", "eucharistic minister"
 *    - +15 point bonus when volunteer is assigned to preferred role
 * 
 * 3. SCORING SYSTEM:
 *    - Base score: 100 points
 *    - Frequency penalty: -5 points per existing assignment
 *    - Mass preference bonus: +20 points
 *    - Role preference bonus: +15 points
 *    - Family team bonus: +25 points
 *    - Flexibility bonus: +3 points (no preferences)
 */
