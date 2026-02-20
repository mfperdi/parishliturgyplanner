/**
 * ====================================================================
 * DROPDOWNS SHEET MANAGEMENT
 * ====================================================================
 * Refreshes the dynamic columns in the Dropdowns sheet so that data
 * validation throughout the spreadsheet stays in sync with actual data.
 *
 * Static columns (1-8, 13-14, 16) are left untouched.
 * Dynamic columns refreshed:
 *   Col  9 - All Ministry Names  (from Ministries sheet, active only)
 *   Col 10 - All Role Names      (from Ministries sheet, active only)
 *   Col 11 - All Mass Event IDs  (from WeeklyMasses + MonthlyMasses + YearlyMasses)
 *   Col 12 - All Template Names  (from MassTemplates sheet)
 *
 * Col 15 (Assigned Volunteer Name) is intentionally left alone — it is managed
 * by a live SORT/UNIQUE/VSTACK formula in the sheet that already includes
 * active volunteers, Family Team group names, and Assigned Group values from
 * the mass configuration sheets.
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
    results.push(DROPDOWNS_refreshMinistryNames(sheet));
    results.push(DROPDOWNS_refreshRoleNames(sheet));
    results.push(DROPDOWNS_refreshMassEventIds(sheet));
    results.push(DROPDOWNS_refreshTemplateNames(sheet));
    // Col 15 (Assigned Volunteer Name) is left alone — managed by a live formula.

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
// COLUMN REFRESH HELPERS
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
 * Col 9: Active ministry names from the Ministries sheet (unique, sorted).
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
 * Col 10: Active role names from the Ministries sheet (unique, sorted).
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
 * Col 11: All active Event IDs from WeeklyMasses, MonthlyMasses, YearlyMasses (unique, sorted).
 */
function DROPDOWNS_refreshMassEventIds(sheet) {
  const ids = new Set();

  const weeklyData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.WEEKLY_MASSES);
  for (const row of weeklyData) {
    const id = HELPER_safeArrayAccess(row, CONSTANTS.COLS.WEEKLY_MASSES.EVENT_ID - 1, '').toString().trim();
    const active = HELPER_safeArrayAccess(row, CONSTANTS.COLS.WEEKLY_MASSES.IS_ACTIVE - 1, false);
    if (id && (active === true || active === 'TRUE')) ids.add(id);
  }

  const monthlyData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MONTHLY_MASSES);
  for (const row of monthlyData) {
    const id = HELPER_safeArrayAccess(row, CONSTANTS.COLS.MONTHLY_MASSES.EVENT_ID - 1, '').toString().trim();
    const active = HELPER_safeArrayAccess(row, CONSTANTS.COLS.MONTHLY_MASSES.IS_ACTIVE - 1, false);
    if (id && (active === true || active === 'TRUE')) ids.add(id);
  }

  const yearlyData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.YEARLY_MASSES);
  for (const row of yearlyData) {
    const id = HELPER_safeArrayAccess(row, CONSTANTS.COLS.YEARLY_MASSES.EVENT_ID - 1, '').toString().trim();
    const active = HELPER_safeArrayAccess(row, CONSTANTS.COLS.YEARLY_MASSES.IS_ACTIVE - 1, false);
    if (id && (active === true || active === 'TRUE')) ids.add(id);
  }

  const sorted = Array.from(ids).sort();
  DROPDOWNS_writeColumn(sheet, CONSTANTS.COLS.DROPDOWNS.ALL_MASS_EVENT_IDS, sorted);
  return `✓ Mass Event IDs: ${sorted.length} entries`;
}

/**
 * Col 12: All template names from MassTemplates sheet (unique, sorted).
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

