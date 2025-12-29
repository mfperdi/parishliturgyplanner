/**
 * Simple diagnostic test for weekly view - Dec 28, 2025 to Jan 4, 2026
 * Run this from Script Editor to see detailed logs
 */
function TEST_checkWeeklyViewData() {
  Logger.log('=== WEEKLY VIEW DATA CHECK ===\n');

  // Week boundaries
  const testDate = new Date(2025, 11, 29, 12, 0, 0); // Dec 29, 2025
  const weekBounds = HELPER_getCurrentWeekBounds(testDate);

  Logger.log(`Week: ${weekBounds.weekString}`);
  Logger.log(`Start: ${weekBounds.startDate}`);
  Logger.log(`End: ${weekBounds.endDate}\n`);

  // Check if specific dates are in week
  const testDates = [
    { date: new Date(2025, 11, 31, 12, 0), label: 'Dec 31, 2025 (Wed)' },
    { date: new Date(2026, 0, 1, 12, 0), label: 'Jan 1, 2026 (Thu)' },
    { date: new Date(2026, 0, 3, 12, 0), label: 'Jan 3, 2026 (Sat)' },
    { date: new Date(2026, 0, 4, 12, 0), label: 'Jan 4, 2026 (Sun)' }
  ];

  Logger.log('Date filtering tests:');
  for (const test of testDates) {
    const inWeek = HELPER_isDateInWeek(test.date, weekBounds.startDate, weekBounds.endDate);
    Logger.log(`  ${test.label}: ${inWeek ? '✓ IN WEEK' : '✗ NOT IN WEEK'}`);
  }

  // Check Assignments sheet data
  Logger.log('\nChecking Assignments sheet:');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  if (!assignSheet) {
    Logger.log('ERROR: Assignments sheet not found!');
    return 'ERROR: Assignments sheet not found';
  }

  const data = assignSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Count assignments by date
  const assignmentsByDate = new Map();
  for (let i = 1; i < data.length; i++) { // Skip header
    const row = data[i];
    const date = row[assignCols.DATE - 1];
    const monthYear = row[assignCols.MONTH_YEAR - 1];

    if (!date) continue;

    const dateObj = new Date(date);
    const dateStr = HELPER_formatDate(dateObj, 'default');

    if (!assignmentsByDate.has(dateStr)) {
      assignmentsByDate.set(dateStr, { count: 0, monthYear: monthYear, dates: [] });
    }
    assignmentsByDate.get(dateStr).count++;
    assignmentsByDate.get(dateStr).dates.push(dateObj);
  }

  // Show assignments for our target dates
  Logger.log('\nAssignments in Assignments sheet:');
  for (const test of testDates) {
    const dateStr = HELPER_formatDate(test.date, 'default');
    const info = assignmentsByDate.get(dateStr);
    if (info) {
      Logger.log(`  ${test.label}: ${info.count} assignments (Month-Year: ${info.monthYear})`);
    } else {
      Logger.log(`  ${test.label}: NO ASSIGNMENTS FOUND`);
    }
  }

  // Try to build weekly schedule data
  Logger.log('\nBuilding weekly schedule data...');
  try {
    const config = { ministryFilter: null, includeColors: false };
    const scheduleData = buildWeeklyScheduleData(weekBounds.startDate, weekBounds.endDate, config);

    Logger.log(`\nResults:`);
    Logger.log(`  Total assignments loaded: ${scheduleData.assignments.length}`);

    // Group by date
    const byDate = new Map();
    for (const a of scheduleData.assignments) {
      const dateStr = HELPER_formatDate(a.date, 'default');
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, 0);
      }
      byDate.set(dateStr, byDate.get(dateStr) + 1);
    }

    Logger.log(`\n  Assignments by date:`);
    for (const test of testDates) {
      const dateStr = HELPER_formatDate(test.date, 'default');
      const count = byDate.get(dateStr) || 0;
      Logger.log(`    ${test.label}: ${count} assignments`);
    }

  } catch (e) {
    Logger.log(`\nERROR building schedule data: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
  }

  Logger.log('\n=== END CHECK ===');
  return 'Check complete - see execution logs (View > Executions in Script Editor)';
}
