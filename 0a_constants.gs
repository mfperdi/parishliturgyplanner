/**
 * ====================================================================
 * CONSTANTS - UPDATED FOR 3-LAYER SCHEDULE LOGIC (with Smart Dates)
 * ====================================================================
 */

const CONSTANTS = {
  // 1. Sheet Names
  SHEETS: {
    CONFIG: "Config",
    VOLUNTEERS: "Volunteers", 
    TIMEOFFS: "Timeoffs",
    TEMPLATES: "MassTemplates",
    WEEKLY_MASSES: "WeeklyMasses",       
    MONTHLY_MASSES: "MonthlyMasses",     
    YEARLY_MASSES: "YearlyMasses",       
    SAINTS_CALENDAR: "SaintsCalendar",
    OVERRIDES: "CalendarOverrides",
    LITURGICAL_NOTES: "LiturgicalNotes",
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

    // 'LiturgicalNotes' sheet (2 columns)
    LITURGICAL_NOTES: {
      CELEBRATION: 1,
      NOTES: 2
    },

    // 'WeeklyMasses' sheet (11 columns)
    WEEKLY_MASSES: {
      EVENT_ID: 1,
      DAY_OF_WEEK: 2,
      TIME: 3,
      START_DATE: 4,
      END_DATE: 5,
      IS_ACTIVE: 6,
      IS_ANTICIPATED: 7,
      DESCRIPTION: 8,
      TEMPLATE_NAME: 9,
      ASSIGNED_GROUP: 10,
      NOTES: 11
    },

    // 'MonthlyMasses' sheet (13 columns)
    MONTHLY_MASSES: {
      EVENT_ID: 1,
      WEEK_OF_MONTH: 2,
      DAY_OF_WEEK: 3,
      TIME: 4,
      START_DATE: 5,
      END_DATE: 6,
      IS_ACTIVE: 7,
      IS_ANTICIPATED: 8,
      OVERRIDE_TYPE: 9,
      DESCRIPTION: 10,
      TEMPLATE_NAME: 11,
      ASSIGNED_GROUP: 12,
      NOTES: 13
    },
    
    // 'YearlyMasses' sheet (11 columns) - UPDATED
    YEARLY_MASSES: {
      EVENT_ID: 1,
      DATE: 2,
      LITURGICAL_CELEBRATION: 3, // <-- UPDATED
      TIME: 4,
      IS_ACTIVE: 5,
      IS_ANTICIPATED: 6,
      OVERRIDE_TYPE: 7,
      DESCRIPTION: 8,
      TEMPLATE_NAME: 9,
      ASSIGNED_GROUP: 10,
      NOTES: 11
    },
    
    // 'MassTemplates' sheet (3 columns)
    TEMPLATES: {
      TEMPLATE_NAME: 1,
      MINISTRY_NAME: 2,    // General ministry category
      ROLE_NAME: 3         // Specific role/skill within ministry
    },
    
    // 'Assignments' sheet (13 columns)
    ASSIGNMENTS: {
      DATE: 1,
      TIME: 2,
      DESCRIPTION: 3,           // Mass description
      LITURGICAL_CELEBRATION: 4,
      MINISTRY_ROLE: 5,
      EVENT_ID: 6,
      IS_ANTICIPATED: 7,        // NEW: Is this a vigil mass? (true/false)
      MONTH_YEAR: 8,            // Shifted from 7
      ASSIGNED_GROUP: 9,        // Shifted from 8
      ASSIGNED_VOLUNTEER_ID: 10, // Shifted from 9
      ASSIGNED_VOLUNTEER_NAME: 11, // Shifted from 10
      STATUS: 12,               // Shifted from 11
      NOTES: 13,                // Shifted from 12
      FAMILY_GROUP: 14          // Shifted from 13
    },
    
    // 'Volunteers' sheet (14 columns)
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
      MINISTRIES: 10,              // General ministry categories (dropdown from MassTemplates MinistryName)
      ROLES: 11,                   // Specific role preferences
      PREFERRED_MASS_TIME: 12,     // Event IDs for preferred masses
      DATE_CLEARED: 13,
      DATE_TRAINED: 14
    },
    
    // 'Timeoffs' sheet (10 columns)
    TIMEOFFS: {
      TIMESTAMP: 1,
      VOLUNTEER_NAME: 2,
      EMAIL: 3,
      TYPE: 4,
      START_DATE: 5,
      END_DATE: 6,
      NOTES: 7,
      STATUS: 8,
      REVIEWED_DATE: 9,
      REVIEW_NOTES: 10
    }
  },
  
  // 3. Status Values (for validation)
  STATUS: {
    VOLUNTEER: ['Active', 'Inactive', 'Substitute Only', 'Ministry Sponsor', 'Parent/Guardian'],
    TIMEOFF: ['Pending', 'Approved', 'Rejected'],
    ASSIGNMENT: ['Unassigned', 'Assigned', 'Substitute Needed']
  },

  // 4. Timeoff Request Types
  TIMEOFF_TYPES: {
    NOT_AVAILABLE: 'Not Available',             // Blacklist - don't schedule for these dates
    ONLY_AVAILABLE: 'Only Available'           // Whitelist - only schedule for these dates/masses (Notes field: Event IDs and/or dates)
  },

  // 5. Validation Rules
  VALIDATION: {
    MAX_TIMEOFF_DAYS: 90,
    MIN_YEAR: 2020,
    MAX_YEAR: 2050,
    REQUIRED_CONFIG: ['Year to Schedule']
  }
};
