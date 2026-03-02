/**
 * ====================================================================
 * DROPDOWNS SHEET MANAGEMENT
 * ====================================================================
 * Refreshes all columns in the Dropdowns sheet so that data validation
 * throughout the spreadsheet stays in sync with actual data.
 *
 * Static columns (1-3, 5-10, 15-16, 18) are restored to known correct values.
 * Col 4 (Liturgical Celebrations) is left untouched (large reference list).
 *
 * Dynamic columns refreshed from sheet data:
 *   Col 11 - All Ministry Names        (from Ministries sheet, active only)
 *   Col 12 - All Role Names            (from Ministries sheet, active only)
 *   Col 13 - All Mass Event IDs        (from MassSchedule sheet)
 *   Col 14 - All Template Names        (from MassTemplates sheet)
 *   Col 17 - Assigned Volunteer Names  (groups from MassSchedule + Volunteers,
 *                                       then active volunteer names)
 */

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

/**
 * Refreshes all dynamic columns in the Dropdowns sheet.
 * Called from Admin Tools → Refresh Dropdowns Sheet.
 */
function DROPDOWNS_refresh() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.DROPDOWNS);
    if (!sheet) {
      HELPER_showError(
        'Dropdowns Sheet Not Found',
        new Error('A sheet named "Dropdowns" was not found in this spreadsheet.'),
        'validation'
      );
      return;
    }

    const results = [];

    // Restore static columns first (fixes any corruption)
    results.push(DROPDOWNS_refreshStaticColumns(sheet));

    // Then refresh dynamic columns from sheet data
    results.push(DROPDOWNS_refreshMinistryNames(sheet));
    results.push(DROPDOWNS_refreshRoleNames(sheet));
    results.push(DROPDOWNS_refreshMassEventIds(sheet));
    results.push(DROPDOWNS_refreshTemplateNames(sheet));
    results.push(DROPDOWNS_refreshAssignedVolunteerNames(sheet));

    // Also fix the Assignments sheet validation to "Show warning" mode so group
    // names and other non-list values can be entered without hard rejection.
    try {
      DROPDOWNS_setupAssignmentsVolunteerValidation();
      results.push('✓ Assignments volunteer column: validation set to Show Warning mode');
    } catch (e) {
      results.push(`⚠️ Could not update Assignments validation: ${e.message}`);
    }

    HELPER_showSuccess(
      'Dropdowns Sheet Refreshed',
      results.join('\n')
    );
  } catch (e) {
    Logger.log(`ERROR in DROPDOWNS_refresh: ${e.message}\n${e.stack}`);
    HELPER_showError('Dropdowns Refresh Failed', e, 'validation');
  }
}

// ============================================================================
// STATIC COLUMN REFRESH
// ============================================================================

/**
 * Restores all static columns (1-10, 15-16, 18) to their correct values.
 * These columns have fixed, known values that don't depend on sheet data.
 * Running this repairs any accidental overwrites or corruption.
 */
function DROPDOWNS_refreshStaticColumns(sheet) {
  const cols = CONSTANTS.COLS.DROPDOWNS;

  // Col 1: Liturgical Seasons
  DROPDOWNS_writeColumn(sheet, cols.LITURGICAL_SEASONS,
    ['Advent', 'Christmas', 'Lent', 'Triduum', 'Easter', 'Ordinary Time']);

  // Col 2: Liturgical Ranks (simplified display names)
  DROPDOWNS_writeColumn(sheet, cols.LITURGICAL_RANKS,
    ['Solemnity', 'Sunday', 'Feast', 'Memorial', 'Optional Memorial', 'Weekday']);

  // Col 3: Liturgical Colors (standard liturgical set)
  DROPDOWNS_writeColumn(sheet, cols.LITURGICAL_COLORS,
    ['White', 'Red', 'Violet', 'Rose', 'Green', 'Gold']);

  // Col 5: Reading Cycle
  DROPDOWNS_writeColumn(sheet, cols.READING_CYCLE,
    ['A', 'B', 'C', 'I', 'II', 'ABC']);

  // Col 6: Override Type
  DROPDOWNS_writeColumn(sheet, cols.OVERRIDE_TYPE,
    ['Append', 'Override']);

  // Col 7: Recurrence Type
  DROPDOWNS_writeColumn(sheet, cols.RECURRENCE_TYPE,
    ['Weekly', 'Monthly', 'Yearly']);

  // Col 8: Day of Month
  DROPDOWNS_writeColumn(sheet, cols.DAY_OF_MONTH,
    ['1st', '2nd', '3rd', '4th', 'Last']);

  // Col 9: Day of Week
  DROPDOWNS_writeColumn(sheet, cols.DAY_OF_WEEK,
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

  // Col 10: Volunteer Status (from CONSTANTS)
  DROPDOWNS_writeColumn(sheet, cols.VOLUNTEER_STATUS,
    CONSTANTS.STATUS.VOLUNTEER);

  // Col 15: Availability Type (from CONSTANTS)
  DROPDOWNS_writeColumn(sheet, cols.AVAILABILITY_TYPE,
    [CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE, CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE]);

  // Col 16: Timeoff Approval Status (from CONSTANTS)
  DROPDOWNS_writeColumn(sheet, cols.TIMEOFF_APPROVAL_STATUS,
    CONSTANTS.STATUS.TIMEOFF);

  // Col 18: Assignment Status (from CONSTANTS)
  DROPDOWNS_writeColumn(sheet, cols.ASSIGNMENT_STATUS,
    CONSTANTS.STATUS.ASSIGNMENT);

  // Note: Col 4 (Liturgical Celebrations) is left untouched — it's a large
  // reference list maintained manually from SaintsCalendar / CalendarOverrides.

  return '✓ Static columns restored (1-3, 5-10, 15-16, 18)';
}

// ============================================================================
// COLUMN WRITE HELPER
// ============================================================================

/**
 * Writes a sorted array of values into one column of the Dropdowns sheet,
 * starting at row 2 (row 1 is assumed to be the header).
 * Clears any old values below the new list so stale entries don't linger.
 */
function DROPDOWNS_writeColumn(sheet, colNum, values) {
  const maxRows = sheet.getMaxRows();
  const dataRows = maxRows - 1; // rows available below the header

  // Clear the entire column data area first
  if (dataRows > 0) {
    sheet.getRange(2, colNum, dataRows, 1).clearContent();
  }

  if (values.length === 0) return;

  // Expand sheet if needed
  if (values.length > dataRows) {
    sheet.insertRowsAfter(maxRows, values.length - dataRows);
  }

  sheet.getRange(2, colNum, values.length, 1)
    .setValues(values.map(v => [v]));
}

/**
 * Col 11: Active ministry names from the Ministries sheet (unique, sorted).
 */
function DROPDOWNS_refreshMinistryNames(sheet) {
  const data = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MINISTRIES);
  const cols = CONSTANTS.COLS.MINISTRIES;
  const names = new Set();
  for (const row of data) {
    const isActive = HELPER_safeArrayAccess(row, cols.IS_ACTIVE - 1, false);
    const name = HELPER_safeArrayAccess(row, cols.MINISTRY_NAME - 1, '').toString().trim();
    if ((isActive === true || isActive === 'TRUE') && name) {
      names.add(name);
    }
  }
  const sorted = Array.from(names).sort();
  DROPDOWNS_writeColumn(sheet, CONSTANTS.COLS.DROPDOWNS.ALL_MINISTRY_NAMES, sorted);
  return `✓ Ministry Names: ${sorted.length} entries`;
}

/**
 * Col 12: Active role names from the Ministries sheet (unique, sorted).
 */
function DROPDOWNS_refreshRoleNames(sheet) {
  const data = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MINISTRIES);
  const cols = CONSTANTS.COLS.MINISTRIES;
  const names = new Set();
  for (const row of data) {
    const isActive = HELPER_safeArrayAccess(row, cols.IS_ACTIVE - 1, false);
    const name = HELPER_safeArrayAccess(row, cols.ROLE_NAME - 1, '').toString().trim();
    if ((isActive === true || isActive === 'TRUE') && name) {
      names.add(name);
    }
  }
  const sorted = Array.from(names).sort();
  DROPDOWNS_writeColumn(sheet, CONSTANTS.COLS.DROPDOWNS.ALL_ROLE_NAMES, sorted);
  return `✓ Role Names: ${sorted.length} entries`;
}

/**
 * Col 13: All active Event IDs from the consolidated MassSchedule sheet (unique, sorted).
 */
function DROPDOWNS_refreshMassEventIds(sheet) {
  const ids = new Set();
  const cols = CONSTANTS.COLS.MASS_SCHEDULE;

  const massData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MASS_SCHEDULE);
  for (const row of massData) {
    const id = HELPER_safeArrayAccess(row, cols.EVENT_ID - 1, '').toString().trim();
    const active = HELPER_safeArrayAccess(row, cols.IS_ACTIVE - 1, false);
    if (id && (active === true || active === 'TRUE')) ids.add(id);
  }

  const sorted = Array.from(ids).sort();
  DROPDOWNS_writeColumn(sheet, CONSTANTS.COLS.DROPDOWNS.ALL_MASS_EVENT_IDS, sorted);
  return `✓ Mass Event IDs: ${sorted.length} entries`;
}

/**
 * Col 14: All template names from MassTemplates sheet (unique, sorted).
 */
function DROPDOWNS_refreshTemplateNames(sheet) {
  const data = HELPER_readSheetDataCached(CONSTANTS.SHEETS.TEMPLATES);
  const cols = CONSTANTS.COLS.TEMPLATES;
  const names = new Set();
  for (const row of data) {
    const name = HELPER_safeArrayAccess(row, cols.TEMPLATE_NAME - 1, '').toString().trim();
    if (name) names.add(name);
  }
  const sorted = Array.from(names).sort();
  DROPDOWNS_writeColumn(sheet, CONSTANTS.COLS.DROPDOWNS.ALL_TEMPLATE_NAMES, sorted);
  return `✓ Template Names: ${sorted.length} entries`;
}

/**
 * Col 17: Assigned Volunteer Names — writes a sorted, de-duplicated list of:
 *   - Active / Substitute Only / Ministry Sponsor volunteer names (Volunteers!D)
 *   - Family Team group names (Volunteers!H)
 *   - Assigned Group values from MassSchedule (MassSchedule!O)
 *
 * Groups are listed first so they appear at the top of the dropdown.
 * Replaces the legacy live formula that referenced WeeklyMasses / MonthlyMasses /
 * YearlyMasses, which no longer exist after the sheets were consolidated.
 */
function DROPDOWNS_refreshAssignedVolunteerNames(sheet) {
  const groupNames = new Set();
  const names = [];

  // Volunteer names and Family Team groups
  const volData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.VOLUNTEERS);
  const volCols = CONSTANTS.COLS.VOLUNTEERS;
  for (const row of volData) {
    const status = HELPER_safeArrayAccess(row, volCols.STATUS - 1, '').toString().trim();
    const name = HELPER_safeArrayAccess(row, volCols.FULL_NAME - 1, '').toString().trim();
    const familyTeam = HELPER_safeArrayAccess(row, volCols.FAMILY_TEAM - 1, '').toString().trim();
    if ((status === 'Active' || status === 'Substitute Only' || status === 'Ministry Sponsor') && name) {
      names.push(name);
    }
    if (familyTeam) groupNames.add(familyTeam);
  }

  // Assigned Group values from MassSchedule (covers groups like "School", "Spanish")
  const massData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MASS_SCHEDULE);
  const massCols = CONSTANTS.COLS.MASS_SCHEDULE;
  for (const row of massData) {
    const group = HELPER_safeArrayAccess(row, massCols.ASSIGNED_GROUP - 1, '').toString().trim();
    if (group) groupNames.add(group);
  }

  const sortedGroups = Array.from(groupNames).sort();
  names.sort();
  const combined = [...sortedGroups, ...names];

  DROPDOWNS_writeColumn(sheet, CONSTANTS.COLS.DROPDOWNS.ASSIGNED_VOLUNTEER_NAME, combined);
  return `✓ Assigned Volunteer Names: ${combined.length} entries (${sortedGroups.length} groups + ${names.length} volunteers)`;
}

// ============================================================================
// ASSIGNMENTS SHEET VALIDATION
// ============================================================================

/**
 * Applies "Show warning" (not "Reject input") data validation to the
 * Assigned Volunteer Name column (L) of the Assignments sheet.
 *
 * Points to the live Dropdowns formula column so the dropdown list still
 * suggests volunteer names and group names — but entering any value
 * (e.g. "School", "Spanish") is no longer rejected with an error.
 *
 * Safe to call repeatedly; schedule generation calls this automatically.
 */
function DROPDOWNS_setupAssignmentsVolunteerValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  const dropdownsSheet = ss.getSheetByName(CONSTANTS.SHEETS.DROPDOWNS);

  if (!assignmentsSheet) throw new Error('Assignments sheet not found');
  if (!dropdownsSheet) throw new Error('Dropdowns sheet not found');

  const lastRow = assignmentsSheet.getLastRow();
  if (lastRow < 2) return; // No data rows yet

  // Use a generous range so the full spilled formula output is covered.
  const sourceRange = dropdownsSheet.getRange(
    2,
    CONSTANTS.COLS.DROPDOWNS.ASSIGNED_VOLUNTEER_NAME,
    500,
    1
  );

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sourceRange, true)  // true = show dropdown arrow
    .setAllowInvalid(true)                   // Show warning triangle, never reject
    .build();

  assignmentsSheet
    .getRange(2, CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_NAME, lastRow - 1, 1)
    .setDataValidation(rule);

  Logger.log(`✓ Assignments column L validation updated (${lastRow - 1} rows, Show Warning mode)`);
}

