/**
 * Find duplicate assignments in the Assignments sheet.
 * Duplicates are defined as: same Date, Time, Role, and Volunteer
 */
function DIAGNOSTIC_findDuplicateAssignments() {
  try {
    Logger.log('=== FINDING DUPLICATE ASSIGNMENTS ===\n');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!assignSheet) {
      return 'ERROR: Assignments sheet not found';
    }

    const data = assignSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

    // Skip header
    const assignments = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[assignCols.DATE - 1];

      if (!date) continue;

      assignments.push({
        rowNum: i + 1,
        date: HELPER_formatDate(new Date(date), 'default'),
        time: row[assignCols.TIME - 1],
        timeStr: row[assignCols.TIME - 1] instanceof Date ? HELPER_formatTime(row[assignCols.TIME - 1]) : row[assignCols.TIME - 1],
        description: row[assignCols.DESCRIPTION - 1],
        liturgy: row[assignCols.LITURGICAL_CELEBRATION - 1],
        ministry: row[assignCols.MINISTRY - 1],
        role: row[assignCols.ROLE - 1],
        volunteer: row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED',
        monthYear: row[assignCols.MONTH_YEAR - 1],
        eventId: row[assignCols.EVENT_ID - 1]
      });
    }

    // Find duplicates
    const duplicates = [];
    const seen = new Map();

    for (const assignment of assignments) {
      const key = `${assignment.date}|${assignment.timeStr}|${assignment.role}|${assignment.volunteer}`;

      if (seen.has(key)) {
        // This is a duplicate
        const original = seen.get(key);
        duplicates.push({
          original: original,
          duplicate: assignment,
          key: key
        });
      } else {
        seen.set(key, assignment);
      }
    }

    Logger.log(`Total assignments: ${assignments.length}`);
    Logger.log(`Duplicates found: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      Logger.log('DUPLICATE ASSIGNMENTS:\n');

      for (const dup of duplicates) {
        Logger.log(`Duplicate: ${dup.original.date} ${dup.original.timeStr} - ${dup.original.role} → ${dup.original.volunteer}`);
        Logger.log(`  Original row: ${dup.original.rowNum} (Month-Year: ${dup.original.monthYear})`);
        Logger.log(`  Duplicate row: ${dup.duplicate.rowNum} (Month-Year: ${dup.duplicate.monthYear})`);
        Logger.log(`  Liturgy: ${dup.original.liturgy}`);
        Logger.log('');
      }

      // Create summary message
      const message = `Found ${duplicates.length} duplicate assignments.\n\n` +
                      `See execution logs (View > Executions) for details.\n\n` +
                      `To fix: Delete the duplicate rows from the Assignments sheet.`;

      SpreadsheetApp.getUi().alert('Duplicate Assignments Found', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      const message = 'No duplicate assignments found!';
      Logger.log(message);
      SpreadsheetApp.getUi().alert('No Duplicates', message, SpreadsheetApp.getUi().ButtonSet.OK);
    }

    return `Check complete - found ${duplicates.length} duplicates. See execution logs for details.`;

  } catch (e) {
    Logger.log(`ERROR: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    throw e;
  }
}


/**
 * Find assignments for a specific date and time.
 * Useful for investigating specific duplicate issues.
 */
function DIAGNOSTIC_findAssignmentsForDateTime(dateStr, timeStr) {
  try {
    Logger.log(`=== ASSIGNMENTS FOR ${dateStr} ${timeStr} ===\n`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!assignSheet) {
      return 'ERROR: Assignments sheet not found';
    }

    const data = assignSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

    const matches = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[assignCols.DATE - 1];

      if (!date) continue;

      const formattedDate = HELPER_formatDate(new Date(date), 'default');
      const time = row[assignCols.TIME - 1];
      const formattedTime = time instanceof Date ? HELPER_formatTime(time) : time;

      if (formattedDate === dateStr && formattedTime === timeStr) {
        matches.push({
          rowNum: i + 1,
          date: formattedDate,
          time: formattedTime,
          description: row[assignCols.DESCRIPTION - 1],
          liturgy: row[assignCols.LITURGICAL_CELEBRATION - 1],
          ministry: row[assignCols.MINISTRY - 1],
          role: row[assignCols.ROLE - 1],
          volunteer: row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED',
          monthYear: row[assignCols.MONTH_YEAR - 1],
          eventId: row[assignCols.EVENT_ID - 1],
          status: row[assignCols.STATUS - 1]
        });
      }
    }

    Logger.log(`Found ${matches.length} assignments:\n`);

    for (const match of matches) {
      Logger.log(`Row ${match.rowNum}:`);
      Logger.log(`  ${match.role}: ${match.volunteer}`);
      Logger.log(`  Description: ${match.description}`);
      Logger.log(`  Liturgy: ${match.liturgy}`);
      Logger.log(`  Month-Year: ${match.monthYear}`);
      Logger.log(`  Event ID: ${match.eventId}`);
      Logger.log(`  Status: ${match.status}`);
      Logger.log('');
    }

    return `Found ${matches.length} assignments for ${dateStr} ${timeStr}`;

  } catch (e) {
    Logger.log(`ERROR: ${e.message}`);
    throw e;
  }
}
