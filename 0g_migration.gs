/**
 * ====================================================================
 * ONE-TIME DATA MIGRATION UTILITIES
 * ====================================================================
 * Functions for migrating data between sheet layouts.
 * Safe to run multiple times — always confirms before overwriting.
 *
 * MIGRATE_consolidateMassSchedule():
 *   Reads WeeklyMasses, MonthlyMasses, and YearlyMasses and writes
 *   every row into the new consolidated MassSchedule sheet.
 *   The source sheets are LEFT INTACT so you can verify the result
 *   before deleting them.
 *
 * MIGRATE_consolidateLiturgicalReference():
 *   Reads SaintsCalendar and CalendarOverrides and writes all rows
 *   into the new consolidated LiturgicalReference sheet.
 *   Calendar column mapping:
 *     SaintsCalendar entries: keep existing Calendar value; diocese names → 'Diocese'
 *     CalendarOverrides entries: Calendar set to 'Parish' (admin-managed corrections)
 *   The source sheets are LEFT INTACT so you can verify before deleting them.
 */

// ============================================================================
// OLD SHEET COLUMN INDICES (0-based, matching the original sheet layouts)
// Used ONLY by migration functions — not referenced anywhere else.
// ============================================================================

const _MIGRATE_WEEKLY_COLS = {
  EVENT_ID: 0, DAY_OF_WEEK: 1, TIME: 2, START_DATE: 3, END_DATE: 4,
  IS_ACTIVE: 5, IS_ANTICIPATED: 6, DESCRIPTION: 7, TEMPLATE_NAME: 8,
  ASSIGNED_GROUP: 9, NOTES: 10
};

const _MIGRATE_MONTHLY_COLS = {
  EVENT_ID: 0, WEEK_OF_MONTH: 1, DAY_OF_WEEK: 2, TIME: 3, START_DATE: 4,
  END_DATE: 5, IS_ACTIVE: 6, IS_ANTICIPATED: 7, OVERRIDE_TYPE: 8,
  DESCRIPTION: 9, TEMPLATE_NAME: 10, ASSIGNED_GROUP: 11, NOTES: 12
};

const _MIGRATE_YEARLY_COLS = {
  EVENT_ID: 0, DATE: 1, LITURGICAL_CELEBRATION: 2, TIME: 3,
  IS_ACTIVE: 4, IS_ANTICIPATED: 5, OVERRIDE_TYPE: 6, DESCRIPTION: 7,
  TEMPLATE_NAME: 8, ASSIGNED_GROUP: 9, NOTES: 10
};

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

/**
 * Migrates data from WeeklyMasses, MonthlyMasses, and YearlyMasses into
 * the consolidated MassSchedule sheet.
 *
 * Called from: Admin Tools → Migrate to MassSchedule
 */
function MIGRATE_consolidateMassSchedule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- 1. Check source sheets ---
  const weeklySheet  = ss.getSheetByName('WeeklyMasses');
  const monthlySheet = ss.getSheetByName('MonthlyMasses');
  const yearlySheet  = ss.getSheetByName('YearlyMasses');

  if (!weeklySheet && !monthlySheet && !yearlySheet) {
    HELPER_showError(
      'Migration Failed',
      new Error('None of the source sheets (WeeklyMasses, MonthlyMasses, YearlyMasses) were found.'),
      'schedule'
    );
    return;
  }

  // --- 2. Confirm if MassSchedule already has data ---
  const destSheet = ss.getSheetByName(CONSTANTS.SHEETS.MASS_SCHEDULE);
  if (destSheet && destSheet.getLastRow() > 1) {
    const ok = HELPER_confirmAction(
      'MassSchedule Already Has Data',
      `The MassSchedule sheet already contains ${destSheet.getLastRow() - 1} data row(s).\n\n` +
      'Running migration will CLEAR all existing data and re-import from the source sheets.\n\n' +
      'Continue?',
      { type: 'danger' }
    );
    if (!ok) return;
  }

  // --- 3. Build new rows ---
  const newRows = [];
  let weeklyCount = 0, monthlyCount = 0, yearlyCount = 0;

  // Weekly rows
  if (weeklySheet && weeklySheet.getLastRow() > 1) {
    const data = weeklySheet.getDataRange().getValues();
    const c = _MIGRATE_WEEKLY_COLS;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[c.EVENT_ID]) continue; // skip blank rows
      newRows.push([
        r[c.EVENT_ID],       // 1  Event ID
        'Weekly',            // 2  Recurrence Type
        r[c.DAY_OF_WEEK],    // 3  Day of Week
        '',                  // 4  Week of Month   (N/A)
        '',                  // 5  Specific Date   (N/A)
        '',                  // 6  Liturgical Celebration (N/A)
        r[c.TIME],           // 7  Time
        r[c.START_DATE],     // 8  Start Date
        r[c.END_DATE],       // 9  End Date
        r[c.IS_ACTIVE],      // 10 Is Active
        r[c.IS_ANTICIPATED], // 11 Is Anticipated
        '',                  // 12 Override Type   (N/A for Weekly)
        r[c.DESCRIPTION],    // 13 Description
        r[c.TEMPLATE_NAME],  // 14 Template Name
        r[c.ASSIGNED_GROUP], // 15 Assigned Group
        r[c.NOTES]           // 16 Notes
      ]);
      weeklyCount++;
    }
  }

  // Monthly rows
  if (monthlySheet && monthlySheet.getLastRow() > 1) {
    const data = monthlySheet.getDataRange().getValues();
    const c = _MIGRATE_MONTHLY_COLS;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[c.EVENT_ID]) continue;
      newRows.push([
        r[c.EVENT_ID],          // 1  Event ID
        'Monthly',              // 2  Recurrence Type
        r[c.DAY_OF_WEEK],       // 3  Day of Week
        r[c.WEEK_OF_MONTH],     // 4  Week of Month
        '',                     // 5  Specific Date   (N/A)
        '',                     // 6  Liturgical Celebration (N/A)
        r[c.TIME],              // 7  Time
        r[c.START_DATE],        // 8  Start Date
        r[c.END_DATE],          // 9  End Date
        r[c.IS_ACTIVE],         // 10 Is Active
        r[c.IS_ANTICIPATED],    // 11 Is Anticipated
        r[c.OVERRIDE_TYPE],     // 12 Override Type
        r[c.DESCRIPTION],       // 13 Description
        r[c.TEMPLATE_NAME],     // 14 Template Name
        r[c.ASSIGNED_GROUP],    // 15 Assigned Group
        r[c.NOTES]              // 16 Notes
      ]);
      monthlyCount++;
    }
  }

  // Yearly rows
  if (yearlySheet && yearlySheet.getLastRow() > 1) {
    const data = yearlySheet.getDataRange().getValues();
    const c = _MIGRATE_YEARLY_COLS;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[c.EVENT_ID]) continue;
      newRows.push([
        r[c.EVENT_ID],               // 1  Event ID
        'Yearly',                    // 2  Recurrence Type
        '',                          // 3  Day of Week   (N/A)
        '',                          // 4  Week of Month (N/A)
        r[c.DATE],                   // 5  Specific Date
        r[c.LITURGICAL_CELEBRATION], // 6  Liturgical Celebration
        r[c.TIME],                   // 7  Time
        '',                          // 8  Start Date    (N/A)
        '',                          // 9  End Date      (N/A)
        r[c.IS_ACTIVE],              // 10 Is Active
        r[c.IS_ANTICIPATED],         // 11 Is Anticipated
        r[c.OVERRIDE_TYPE],          // 12 Override Type
        r[c.DESCRIPTION],            // 13 Description
        r[c.TEMPLATE_NAME],          // 14 Template Name
        r[c.ASSIGNED_GROUP],         // 15 Assigned Group
        r[c.NOTES]                   // 16 Notes
      ]);
      yearlyCount++;
    }
  }

  if (newRows.length === 0) {
    HELPER_showAlert(
      'Nothing to Migrate',
      'All source sheets are empty. No rows were written to MassSchedule.',
      'info'
    );
    return;
  }

  // --- 4. Write to MassSchedule ---
  const sheet = _MIGRATE_getOrCreateSheet(ss);

  // Clear data rows (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  sheet.getRange(2, 1, newRows.length, 16).setValues(newRows);

  // --- 5. Apply formatting ---
  _MIGRATE_applyFormatting(sheet, newRows.length);

  // --- 6. Success ---
  HELPER_showSuccess(
    'Migration Complete',
    `Successfully migrated to MassSchedule:\n\n` +
    `  • ${weeklyCount} Weekly row${weeklyCount !== 1 ? 's' : ''}\n` +
    `  • ${monthlyCount} Monthly row${monthlyCount !== 1 ? 's' : ''}\n` +
    `  • ${yearlyCount} Yearly row${yearlyCount !== 1 ? 's' : ''}\n` +
    `  • ${newRows.length} total rows\n\n` +
    `The original sheets (WeeklyMasses, MonthlyMasses, YearlyMasses) have been\n` +
    `left intact. Once you have verified the MassSchedule data looks correct,\n` +
    `you can delete them.`
  );
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Returns the MassSchedule sheet, creating it with a header row if needed.
 */
function _MIGRATE_getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(CONSTANTS.SHEETS.MASS_SCHEDULE);

  if (!sheet) {
    sheet = ss.insertSheet(CONSTANTS.SHEETS.MASS_SCHEDULE);
    // Write header
    const headers = [
      'Event ID', 'Recurrence Type', 'Day of Week', 'Week of Month',
      'Specific Date', 'Liturgical Celebration', 'Time', 'Start Date',
      'End Date', 'Is Active', 'Is Anticipated', 'Override Type',
      'Description', 'Template Name', 'Assigned Group', 'Notes'
    ];
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Applies data validation and basic formatting to the migrated data rows.
 */
function _MIGRATE_applyFormatting(sheet, dataRowCount) {
  if (dataRowCount < 1) return;

  const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  // Is Active (col 10) and Is Anticipated (col 11) → checkboxes
  sheet.getRange(2, 10, dataRowCount, 2).setDataValidation(checkboxRule);

  // Recurrence Type (col 2) → dropdown
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Weekly', 'Monthly', 'Yearly'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 2, dataRowCount, 1).setDataValidation(typeRule);

  // Auto-resize all columns for readability
  sheet.autoResizeColumns(1, 16);
}

// ============================================================================
// LITURGICAL REFERENCE CONSOLIDATION (SaintsCalendar + CalendarOverrides)
// ============================================================================

// Old SaintsCalendar columns (0-based)
const _MIGRATE_SAINTS_COLS = {
  MONTH: 0, DAY: 1, LITURGICAL_CELEBRATION: 2, RANK: 3, COLOR: 4, CALENDAR: 5
};

// Old CalendarOverrides columns (0-based)
const _MIGRATE_OVERRIDES_COLS = {
  MONTH: 0, DAY: 1, LITURGICAL_CELEBRATION: 2, RANK: 3, COLOR: 4, CALENDAR: 5, NOTES: 6
};

// Standard calendar values that pass through unchanged during migration
const _MIGRATE_STANDARD_CALENDARS = new Set([
  'General Roman Calendar', 'USA', 'Canada', 'Mexico', 'Parish'
]);

/**
 * Migrates data from SaintsCalendar and CalendarOverrides into the
 * consolidated LiturgicalReference sheet.
 *
 * Calendar column mapping:
 *   SaintsCalendar: keep 'General Roman Calendar', region codes, 'Parish' as-is;
 *                   map diocese names → 'Diocese'; blank → 'General Roman Calendar'
 *   CalendarOverrides: always set to 'Parish' (admin-managed corrections)
 *
 * Called from: Admin Tools → Migrate to LiturgicalReference
 */
function MIGRATE_consolidateLiturgicalReference() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- 1. Check source sheets ---
  const saintsSheet    = ss.getSheetByName('SaintsCalendar');
  const overridesSheet = ss.getSheetByName('CalendarOverrides');

  if (!saintsSheet && !overridesSheet) {
    HELPER_showError(
      'Migration Failed',
      new Error('Neither SaintsCalendar nor CalendarOverrides sheet was found.'),
      'calendar'
    );
    return;
  }

  // --- 2. Confirm if LiturgicalReference already has data ---
  const destSheet = ss.getSheetByName(CONSTANTS.SHEETS.LITURGICAL_REFERENCE);
  if (destSheet && destSheet.getLastRow() > 1) {
    const ok = HELPER_confirmAction(
      'LiturgicalReference Already Has Data',
      `The LiturgicalReference sheet already contains ${destSheet.getLastRow() - 1} data row(s).\n\n` +
      'Running migration will CLEAR all existing data and re-import from the source sheets.\n\n' +
      'Continue?',
      { type: 'danger' }
    );
    if (!ok) return;
  }

  // --- 3. Build new rows ---
  const newRows = [];
  let saintsCount = 0, overridesCount = 0;

  // SaintsCalendar rows
  if (saintsSheet && saintsSheet.getLastRow() > 1) {
    const data = saintsSheet.getDataRange().getValues();
    const c = _MIGRATE_SAINTS_COLS;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[c.MONTH] && !r[c.LITURGICAL_CELEBRATION]) continue; // skip blank rows

      // Map calendar value: keep standard values, map anything else to 'Diocese'
      let calendarVal = String(r[c.CALENDAR] || '').trim();
      if (!calendarVal) {
        calendarVal = 'General Roman Calendar';
      } else if (!_MIGRATE_STANDARD_CALENDARS.has(calendarVal)) {
        calendarVal = 'Diocese'; // diocese-specific name → generic 'Diocese'
      }

      newRows.push([
        r[c.MONTH],                  // 1 Month
        r[c.DAY],                    // 2 Day
        r[c.LITURGICAL_CELEBRATION], // 3 Liturgical Celebration
        r[c.RANK],                   // 4 Rank
        r[c.COLOR],                  // 5 Color
        calendarVal,                 // 6 Calendar
        ''                           // 7 Notes (saints had no notes column)
      ]);
      saintsCount++;
    }
  }

  // CalendarOverrides rows
  if (overridesSheet && overridesSheet.getLastRow() > 1) {
    const data = overridesSheet.getDataRange().getValues();
    const c = _MIGRATE_OVERRIDES_COLS;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[c.MONTH] && !r[c.LITURGICAL_CELEBRATION]) continue;

      newRows.push([
        r[c.MONTH],                  // 1 Month
        r[c.DAY],                    // 2 Day
        r[c.LITURGICAL_CELEBRATION], // 3 Liturgical Celebration
        r[c.RANK],                   // 4 Rank
        r[c.COLOR],                  // 5 Color
        'Parish',                    // 6 Calendar — overrides become Parish entries
        r[c.NOTES] || ''             // 7 Notes
      ]);
      overridesCount++;
    }
  }

  if (newRows.length === 0) {
    HELPER_showAlert(
      'Nothing to Migrate',
      'Both source sheets are empty. No rows were written to LiturgicalReference.',
      'info'
    );
    return;
  }

  // --- 4. Write to LiturgicalReference ---
  const sheet = _MIGRATE_getOrCreateLitRefSheet(ss);

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  sheet.getRange(2, 1, newRows.length, 7).setValues(newRows);

  // Auto-resize for readability
  sheet.autoResizeColumns(1, 7);

  // --- 5. Success ---
  HELPER_showSuccess(
    'Migration Complete',
    `Successfully migrated to LiturgicalReference:\n\n` +
    `  • ${saintsCount} row${saintsCount !== 1 ? 's' : ''} from SaintsCalendar\n` +
    `  • ${overridesCount} row${overridesCount !== 1 ? 's' : ''} from CalendarOverrides\n` +
    `  • ${newRows.length} total rows\n\n` +
    `CalendarOverrides entries have been set to Calendar = 'Parish'.\n` +
    `Any diocese-specific SaintsCalendar entries have been set to Calendar = 'Diocese'.\n\n` +
    `The original sheets (SaintsCalendar, CalendarOverrides) have been left intact.\n` +
    `Once you have verified the LiturgicalReference data looks correct, you can delete them.`
  );
}

/**
 * Returns the LiturgicalReference sheet, creating it with a header row if needed.
 */
function _MIGRATE_getOrCreateLitRefSheet(ss) {
  let sheet = ss.getSheetByName(CONSTANTS.SHEETS.LITURGICAL_REFERENCE);

  if (!sheet) {
    sheet = ss.insertSheet(CONSTANTS.SHEETS.LITURGICAL_REFERENCE);
    const headers = ['Month', 'Day', 'Liturgical Celebration', 'Rank', 'Color', 'Calendar', 'Notes'];
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    sheet.setFrozenRows(1);
  }

  return sheet;
}
