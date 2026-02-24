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
    MINISTRIES: "Ministries",
    TEMPLATES: "MassTemplates",
    MASS_SCHEDULE: "MassSchedule",
    LITURGICAL_REFERENCE: "LiturgicalReference",
    LITURGICAL_NOTES: "LiturgicalNotes",
    CALENDAR: "LiturgicalCalendar",
    ASSIGNMENTS: "Assignments",
    DASHBOARD: "Dashboard",
    DROPDOWNS: "Dropdowns"
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
    
    // 'LiturgicalReference' sheet (7 columns)
    // Consolidates former SaintsCalendar and CalendarOverrides sheets.
    // Calendar column values: 'General Roman Calendar' | 'USA' | 'Diocese' | 'Parish'
    //   - General Roman Calendar: applies everywhere
    //   - USA (or other region code): applies when Calendar Region config matches
    //   - Diocese: applies when a Diocese is configured
    //   - Parish: always applies (parish-specific feasts and admin corrections)
    // All entries go through normal liturgical precedence comparison.
    LITURGICAL_REFERENCE: {
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

    // 'MassSchedule' sheet (16 columns) - consolidated from WeeklyMasses, MonthlyMasses, YearlyMasses
    // RECURRENCE_TYPE discriminates between row types: 'Weekly' | 'Monthly' | 'Yearly'
    // Type-specific columns:
    //   Weekly:  DAY_OF_WEEK, START_DATE, END_DATE (OVERRIDE_TYPE, WEEK_OF_MONTH, DATE, LITURGICAL_CELEBRATION blank)
    //   Monthly: DAY_OF_WEEK, WEEK_OF_MONTH, START_DATE, END_DATE, OVERRIDE_TYPE ('overrideday'|'append')
    //   Yearly:  DATE and/or LITURGICAL_CELEBRATION, OVERRIDE_TYPE ('override'|'append') (DAY_OF_WEEK, WEEK_OF_MONTH, START_DATE, END_DATE blank)
    MASS_SCHEDULE: {
      EVENT_ID: 1,
      RECURRENCE_TYPE: 2,          // 'Weekly' | 'Monthly' | 'Yearly'
      DAY_OF_WEEK: 3,              // blank for Yearly
      WEEK_OF_MONTH: 4,            // Monthly only ('1st'–'Last')
      DATE: 5,                     // Yearly only (specific calendar date)
      LITURGICAL_CELEBRATION: 6,   // Yearly only (moveable feast name lookup)
      TIME: 7,
      START_DATE: 8,               // blank for Yearly
      END_DATE: 9,                 // blank for Yearly
      IS_ACTIVE: 10,
      IS_ANTICIPATED: 11,
      OVERRIDE_TYPE: 12,           // blank for Weekly; 'overrideday'|'append' for Monthly; 'override'|'append' for Yearly
      DESCRIPTION: 13,
      TEMPLATE_NAME: 14,
      ASSIGNED_GROUP: 15,
      NOTES: 16
    },

    // 'Ministries' sheet (4 columns)
    MINISTRIES: {
      MINISTRY_NAME: 1,    // General ministry category (e.g., "Lector")
      ROLE_NAME: 2,        // Specific role/skill within ministry (e.g., "1st reading")
      DESCRIPTION: 3,      // Role description for training/reference
      IS_ACTIVE: 4         // TRUE/FALSE - whether this role is currently active
    },

    // 'MassTemplates' sheet (3 columns)
    TEMPLATES: {
      TEMPLATE_NAME: 1,
      DESCRIPTION: 2,      // Template description (e.g., "Regular Sunday morning Mass with full participation")
      ROLES: 3             // Comma-separated list of role names (e.g., "1st reading, 2nd reading, Psalm, Bread, Chalice")
    },
    
    // 'Assignments' sheet (13 columns + 3 formula helper columns)
    ASSIGNMENTS: {
      DATE: 1,
      TIME: 2,
      DESCRIPTION: 3,           // Mass description
      LITURGICAL_CELEBRATION: 4,
      MINISTRY: 5,              // Ministry category (e.g., "Lector")
      ROLE: 6,                  // Specific role within ministry (e.g., "1st reading")
      EVENT_ID: 7,
      IS_ANTICIPATED: 8,        // Is this a vigil mass? (true/false)
      MONTH_YEAR: 9,
      ASSIGNED_GROUP: 10,
      ASSIGNED_VOLUNTEER_ID: 11,
      ASSIGNED_VOLUNTEER_NAME: 12,
      STATUS: 13
      // Helper columns N-P are formula-based and not written by scripts
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
      MINISTRIES: 10,              // General ministry categories (dropdown from Ministries sheet)
      ROLES: 11,                   // Specific role preferences (dropdown from Ministries sheet)
      PREFERRED_MASS_TIME: 12,     // Event IDs for preferred masses
      DATE_CLEARED: 13,
      DATE_TRAINED: 14
    },
    
    // 'Timeoffs' sheet (9 columns)
    TIMEOFFS: {
      TIMESTAMP: 1,
      VOLUNTEER_NAME: 2,
      TYPE: 3,
      SELECTED_DATES: 4,    // Selected dates from checkboxes (e.g., "2/7/2026 (Vigil), 2/8/2026")
      VOLUNTEER_NOTES: 5,   // Optional notes from volunteer (form question 4)
      MONTH: 6,             // Month for this timeoff request (e.g., "January 2026")
      STATUS: 7,
      REVIEWED_DATE: 8,
      REVIEW_NOTES: 9       // Admin review notes and warnings
    },

    // 'Dropdowns' sheet (16 columns) - provides data validation lists for the spreadsheet
    // Columns 1-8 and 13-14, 16 are static; columns 9-12 and 15 are managed by DROPDOWNS_refresh()
    DROPDOWNS: {
      LITURGICAL_SEASONS: 1,
      LITURGICAL_RANKS: 2,
      LITURGICAL_COLORS: 3,
      READING_CYCLE: 4,
      OVERRIDE_TYPE: 5,
      DAY_OF_MONTH: 6,
      DAY_OF_WEEK: 7,
      VOLUNTEER_STATUS: 8,
      ALL_MINISTRY_NAMES: 9,
      ALL_ROLE_NAMES: 10,
      ALL_MASS_EVENT_IDS: 11,
      ALL_TEMPLATE_NAMES: 12,
      AVAILABILITY_TYPE: 13,
      TIMEOFF_APPROVAL_STATUS: 14,
      ASSIGNED_VOLUNTEER_NAME: 15,
      ASSIGNMENT_STATUS: 16
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
    NOT_AVAILABLE: 'I CANNOT serve these dates',             // Blacklist - don't schedule for these dates
    ONLY_AVAILABLE: 'I can ONLY serve these dates'           // Whitelist - only schedule for these dates
  },

  // 5. Validation Rules
  VALIDATION: {
    MAX_TIMEOFF_DAYS: 90,
    MIN_YEAR: 2020,
    MAX_YEAR: 2050,
    REQUIRED_CONFIG: ['Year to Schedule']
  },

  // 6. Archive Configuration
  ARCHIVE: {
    // Sheets to archive (year-specific data)
    SHEETS_TO_ARCHIVE: ['LiturgicalCalendar', 'Assignments', 'Timeoffs'],

    // Optional sheets to archive (configuration snapshots)
    OPTIONAL_SHEETS: ['CalendarOverrides', 'Config', 'Volunteers'],

    // Archive file naming format: "[Parish Name] - [YYYY] Archive"
    FILE_NAME_TEMPLATE: '{parishName} - {year} Archive',

    // Archive metadata
    METADATA_SHEET_NAME: 'Archive_Info'
  },

  // 7. Scoring Algorithm Constants
  // Used in HELPER_calculateVolunteerScore() in 0b2_helper_ministry.gs
  SCORING: {
    BASE_SCORE: 100,                      // Starting score for all volunteers
    FREQUENCY_PENALTY: 25,                // Penalty per previous assignment this month
    MASS_PREFERENCE_BONUS: 20,            // Bonus for preferred mass time
    MASS_ROTATION_PENALTY: 3,             // Reduction per repeat at same mass (min 5 bonus)
    MASS_PREFERENCE_MIN: 5,               // Minimum mass preference bonus after rotation
    ROLE_PREFERENCE_BONUS: 15,            // Bonus for preferred role
    FAMILY_TEAM_BONUS: 25,                // Bonus if family member already assigned
    LIMITED_AVAILABILITY_BONUS: 15,       // Bonus for whitelist volunteers
    FLEXIBILITY_BONUS: 3,                 // Bonus for volunteers with no preferences
    SPACING_PENALTY_SAME_WEEK: 30,        // Penalty for 0-6 days since last assignment
    SPACING_PENALTY_RECENT: 15,           // Penalty for 7-13 days since last assignment
    RANDOM_TIEBREAKER_RANGE: 6            // Random range (±3 points)
  },

  // 8. Cache Configuration
  CACHE: {
    EXPIRY_MS: 5 * 60 * 1000,             // Cache expiration (5 minutes)
    MAX_LOGO_HEIGHT: 300                  // Maximum logo height in pixels
  },

  // 9. Validation Sample Sizes
  SAMPLE: {
    VALIDATION_ROWS: 10,                  // Number of rows to sample for validation
    MAX_DIAGNOSTIC_ENTRIES: 50            // Max entries to show in diagnostic reports
  }
};
