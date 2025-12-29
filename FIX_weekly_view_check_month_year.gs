/**
 * Check Month-Year values for late December / early January assignments
 * This will help verify if the Month-Year column has correct values
 */
function TEST_checkMonthYearValues() {
  Logger.log('=== MONTH-YEAR VALUE CHECK ===\n');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  if (!assignSheet) {
    return 'ERROR: Assignments sheet not found';
  }

  const data = assignSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Target dates to check
  const targetDates = [
    '12/31/2025',
    '1/1/2026',
    '1/3/2026',
    '1/4/2026'
  ];

  Logger.log('Checking Month-Year values for key dates:\n');

  for (const targetDateStr of targetDates) {
    Logger.log(`\n${targetDateStr}:`);
    let found = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[assignCols.DATE - 1];

      if (!date) continue;

      const dateObj = new Date(date);
      const dateStr = HELPER_formatDate(dateObj, 'default');

      if (dateStr === targetDateStr) {
        found = true;
        const monthYear = row[assignCols.MONTH_YEAR - 1];
        const time = row[assignCols.TIME - 1];
        const role = row[assignCols.ROLE - 1];
        const volunteer = row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED';
        const liturgy = row[assignCols.LITURGICAL_CELEBRATION - 1];

        const timeStr = time instanceof Date ? HELPER_formatTime(time) : time;

        Logger.log(`  Row ${i+1}: ${timeStr} ${role} → ${volunteer}`);
        Logger.log(`           Month-Year: "${monthYear}" | Liturgy: ${liturgy}`);
      }
    }

    if (!found) {
      Logger.log(`  ❌ NO ASSIGNMENTS FOUND`);
    }
  }

  Logger.log('\n=== EXPECTED VALUES ===');
  Logger.log('12/31/2025 should have Month-Year: "2025-12"');
  Logger.log('1/1/2026 should have Month-Year: "2025-12" (part of Dec Christmas season)');
  Logger.log('1/3/2026 vigil should have Month-Year: "2026-01"');
  Logger.log('1/4/2026 should have Month-Year: "2026-01"');

  return 'Check complete - see execution logs';
}
