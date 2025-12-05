/**
 * Debug script to diagnose CYMJAN mass configuration
 */
function DEBUG_findCYMJAN() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];

  // Check MonthlyMasses
  const monthlySheet = ss.getSheetByName(CONSTANTS.SHEETS.MONTHLY_MASSES);
  if (monthlySheet) {
    const monthlyData = monthlySheet.getDataRange().getValues();
    const header = monthlyData.shift();

    monthlyData.forEach((row, idx) => {
      if (row[0] === 'CYMJAN') {
        results.push({
          sheet: 'MonthlyMasses',
          row: idx + 2,
          eventId: row[0],
          weekOfMonth: row[1],
          dayOfWeek: row[2],
          time: row[3],
          startDate: row[4],
          endDate: row[5],
          isActive: row[6],
          isAnticipated: row[7],
          overrideType: row[8],
          description: row[9],
          templateName: row[10],
          assignedGroup: row[11],
          notes: row[12]
        });
      }
    });
  }

  // Check YearlyMasses
  const yearlySheet = ss.getSheetByName(CONSTANTS.SHEETS.YEARLY_MASSES);
  if (yearlySheet) {
    const yearlyData = yearlySheet.getDataRange().getValues();
    const header = yearlyData.shift();

    yearlyData.forEach((row, idx) => {
      if (row[0] === 'CYMJAN') {
        results.push({
          sheet: 'YearlyMasses',
          row: idx + 2,
          eventId: row[0],
          date: row[1],
          liturgicalCelebration: row[2],
          time: row[3],
          isActive: row[4],
          isAnticipated: row[5],
          overrideType: row[6],
          description: row[7],
          templateName: row[8],
          assignedGroup: row[9],
          notes: row[10]
        });
      }
    });
  }

  // Get config year
  const config = HELPER_readConfig();
  const scheduleYear = config["Year to Schedule"];

  // Log results
  Logger.log('=== CYMJAN DIAGNOSTIC RESULTS ===');
  Logger.log(`Schedule Year: ${scheduleYear}`);
  Logger.log(`\nFound ${results.length} CYMJAN entries:\n`);

  results.forEach(r => {
    Logger.log(`Sheet: ${r.sheet}, Row: ${r.row}`);
    Logger.log(JSON.stringify(r, null, 2));
    Logger.log('---');
  });

  // Provide recommendations
  Logger.log('\n=== RECOMMENDATIONS ===');

  if (results.length === 0) {
    Logger.log('❌ CYMJAN not found in MonthlyMasses or YearlyMasses');
  } else {
    results.forEach(r => {
      if (r.sheet === 'MonthlyMasses') {
        const weekOfMonth = r.weekOfMonth;
        const dayOfWeek = r.dayOfWeek;

        if (weekOfMonth && weekOfMonth.toString().includes('/')) {
          Logger.log(`❌ MonthlyMasses has a date (${weekOfMonth}) instead of week number`);
          Logger.log(`   SOLUTION: Change Week of Month to "2" and Day of Week to "Saturday"`);
          Logger.log(`   (CYM Mass is the 2nd Saturday in January)`);
        } else {
          Logger.log(`✅ MonthlyMasses format looks correct`);
          Logger.log(`   Week of Month: ${weekOfMonth}, Day of Week: ${dayOfWeek}`);
        }

        if (r.startDate || r.endDate) {
          Logger.log(`ℹ️ Start Date: ${r.startDate}, End Date: ${r.endDate}`);
          if (r.endDate && new Date(r.endDate).getFullYear() < scheduleYear) {
            Logger.log(`❌ End Date (${r.endDate}) is before schedule year (${scheduleYear})`);
            Logger.log(`   SOLUTION: Update End Date to blank or a future date`);
          }
        }
      } else if (r.sheet === 'YearlyMasses') {
        const date = new Date(r.date);
        if (!isNaN(date.getTime()) && date.getFullYear() !== scheduleYear) {
          Logger.log(`❌ YearlyMasses has date ${r.date} but schedule year is ${scheduleYear}`);
          Logger.log(`   SOLUTION 1: Use Liturgical Celebration "The Baptism of the Lord" instead of static date`);
          Logger.log(`   SOLUTION 2: Update date to 1/11/${scheduleYear}`);
        }
      }
    });
  }

  // Return user-friendly message
  const message = results.length > 0
    ? `Found ${results.length} CYMJAN entry in ${results[0].sheet}. Check Execution Log for details.`
    : 'CYMJAN not found. Check Event ID spelling.';

  SpreadsheetApp.getUi().alert(message);
  return results;
}
