/**
 * Debug liturgical data lookup for specific dates
 */
function TEST_liturgicalLookupDebug() {
  Logger.log('=== LITURGICAL LOOKUP DEBUG ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calSheet = ss.getSheetByName(CONSTANTS.SHEETS.CALENDAR);

  if (!calSheet) {
    Logger.log('ERROR: LiturgicalCalendar sheet not found');
    return;
  }

  const data = calSheet.getDataRange().getValues();
  const calCols = CONSTANTS.COLS.CALENDAR;

  // Check for 12/31/2025 and 1/1/2026
  const targetDates = [
    new Date(2025, 11, 31, 12, 0, 0), // Dec 31, 2025
    new Date(2026, 0, 1, 12, 0, 0)    // Jan 1, 2026
  ];

  Logger.log('\n--- Checking LiturgicalCalendar sheet for target dates ---');

  for (const targetDate of targetDates) {
    Logger.log(`\nLooking for: ${HELPER_formatDate(targetDate, 'default')}`);
    let found = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const calDate = new Date(row[calCols.DATE - 1]);

      if (calDate.getTime() === targetDate.getTime()) {
        found = true;
        Logger.log(`  ✓ FOUND at row ${i + 1}:`);
        Logger.log(`    Date: ${HELPER_formatDate(calDate, 'default')}`);
        Logger.log(`    Celebration: "${row[calCols.LITURGICAL_CELEBRATION - 1]}"`);
        Logger.log(`    Rank: ${row[calCols.RANK - 1]}`);
        Logger.log(`    Season: ${row[calCols.SEASON - 1]}`);
        Logger.log(`    Color: ${row[calCols.COLOR - 1]}`);
      }
    }

    if (!found) {
      Logger.log(`  ✗ NOT FOUND in LiturgicalCalendar`);
    }
  }

  // Now check what buildLiturgicalDataMap returns for these months
  Logger.log('\n--- Checking buildLiturgicalDataMap results ---');

  const dec2025Map = buildLiturgicalDataMap('2025-12');
  const jan2026Map = buildLiturgicalDataMap('2026-01');

  Logger.log(`\nDecember 2025 map has ${dec2025Map.size} celebrations:`);
  for (const [celebration, data] of dec2025Map.entries()) {
    Logger.log(`  "${celebration}": ${data.dates.length} dates`);
    for (const date of data.dates) {
      if (date.getTime() === targetDates[0].getTime()) {
        Logger.log(`    ✓ Contains 12/31/2025`);
        Logger.log(`    Rank: ${data.rank}, Season: ${data.season}, Color: ${data.color}`);
      }
    }
  }

  Logger.log(`\nJanuary 2026 map has ${jan2026Map.size} celebrations:`);
  for (const [celebration, data] of jan2026Map.entries()) {
    Logger.log(`  "${celebration}": ${data.dates.length} dates`);
    for (const date of data.dates) {
      if (date.getTime() === targetDates[1].getTime()) {
        Logger.log(`    ✓ Contains 1/1/2026`);
        Logger.log(`    Rank: ${data.rank}, Season: ${data.season}, Color: ${data.color}`);
      }
    }
  }

  // Check what celebration name is in Assignments for 1/1/2026
  Logger.log('\n--- Checking Assignments sheet for 1/1/2026 ---');

  const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  if (assignSheet) {
    const assignData = assignSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

    for (let i = 1; i < assignData.length; i++) {
      const row = assignData[i];
      const date = new Date(row[assignCols.DATE - 1]);

      if (date.getTime() === targetDates[1].getTime()) {
        Logger.log(`  Row ${i + 1}: "${row[assignCols.LITURGICAL_CELEBRATION - 1]}"`);
        break; // Just show first one
      }
    }
  }

  Logger.log('\n=== END DEBUG ===');
}
