/**
 * DIAGNOSTIC: Check why Palm Sunday (March 28-29, 2026) is missing from print schedule
 */
function DEBUG_checkPalmSundayIssue() {
  Logger.log("=".repeat(70));
  Logger.log("PALM SUNDAY DIAGNOSTIC - March 28-29, 2026");
  Logger.log("=".repeat(70));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const monthString = "2026-03";
  const palmDates = [
    new Date(2026, 2, 28, 12, 0, 0), // March 28 (month index 2 = March)
    new Date(2026, 2, 29, 12, 0, 0)  // March 29
  ];

  const results = {
    calendarCheck: null,
    assignmentsCheck: null,
    liturgyMapCheck: null,
    printScheduleCheck: null
  };

  // 1. Check LiturgicalCalendar sheet
  Logger.log("\n1. CHECKING LITURGICAL CALENDAR...");
  try {
    const calendarSheet = ss.getSheetByName(CONSTANTS.SHEETS.CALENDAR);
    if (!calendarSheet) {
      results.calendarCheck = "❌ LiturgicalCalendar sheet NOT FOUND";
      Logger.log(results.calendarCheck);
    } else {
      const calData = calendarSheet.getDataRange().getValues();
      const calCols = CONSTANTS.COLS.CALENDAR;
      calData.shift(); // Remove header

      const palmEntries = calData.filter(row => {
        const date = new Date(row[calCols.DATE - 1]);
        return (date.getMonth() === 2 && (date.getDate() === 28 || date.getDate() === 29) && date.getFullYear() === 2026);
      });

      if (palmEntries.length === 0) {
        results.calendarCheck = "❌ NO entries found for March 28-29, 2026 in LiturgicalCalendar";
        Logger.log(results.calendarCheck);
      } else {
        results.calendarCheck = `✓ Found ${palmEntries.length} entries in LiturgicalCalendar:`;
        Logger.log(results.calendarCheck);
        palmEntries.forEach(row => {
          const celebration = row[calCols.LITURGICAL_CELEBRATION - 1];
          const date = new Date(row[calCols.DATE - 1]);
          const rank = row[calCols.RANK - 1];
          const color = row[calCols.COLOR - 1];
          Logger.log(`  - ${HELPER_formatDate(date, 'default')}: "${celebration}" (${rank}, ${color})`);
        });
      }
    }
  } catch (e) {
    results.calendarCheck = `❌ ERROR checking calendar: ${e.message}`;
    Logger.log(results.calendarCheck);
  }

  // 2. Check Assignments sheet
  Logger.log("\n2. CHECKING ASSIGNMENTS SHEET...");
  try {
    const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (!assignSheet) {
      results.assignmentsCheck = "❌ Assignments sheet NOT FOUND";
      Logger.log(results.assignmentsCheck);
    } else {
      const assignData = assignSheet.getDataRange().getValues();
      const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
      assignData.shift(); // Remove header

      const palmAssignments = assignData.filter(row => {
        const date = new Date(row[assignCols.DATE - 1]);
        return (date.getMonth() === 2 && (date.getDate() === 28 || date.getDate() === 29) && date.getFullYear() === 2026);
      });

      if (palmAssignments.length === 0) {
        results.assignmentsCheck = "❌ NO assignments found for March 28-29, 2026";
        Logger.log(results.assignmentsCheck);
        Logger.log("   This means the schedule was never generated for these dates.");
        Logger.log("   Check WeeklyMasses/YearlyMasses configuration for Saturday/Sunday.");
      } else {
        results.assignmentsCheck = `✓ Found ${palmAssignments.length} assignments for March 28-29:`;
        Logger.log(results.assignmentsCheck);

        // Group by liturgical celebration
        const celebrationGroups = new Map();
        palmAssignments.forEach(row => {
          const celebration = row[assignCols.LITURGICAL_CELEBRATION - 1];
          if (!celebrationGroups.has(celebration)) {
            celebrationGroups.set(celebration, []);
          }
          celebrationGroups.get(celebration).push(row);
        });

        celebrationGroups.forEach((rows, celebration) => {
          Logger.log(`  Celebration: "${celebration}" (${rows.length} assignments)`);
          rows.slice(0, 3).forEach(row => {
            const date = new Date(row[assignCols.DATE - 1]);
            const time = row[assignCols.TIME - 1];
            const role = row[assignCols.ROLE - 1];
            const monthYear = row[assignCols.MONTH_YEAR - 1];
            Logger.log(`    - ${HELPER_formatDate(date, 'default')} ${HELPER_formatTime(time)}: ${role} (Month-Year: ${monthYear})`);
          });
          if (rows.length > 3) {
            Logger.log(`    ... and ${rows.length - 3} more`);
          }
        });
      }
    }
  } catch (e) {
    results.assignmentsCheck = `❌ ERROR checking assignments: ${e.message}`;
    Logger.log(results.assignmentsCheck);
  }

  // 3. Check buildLiturgicalDataMap function behavior
  Logger.log("\n3. TESTING buildLiturgicalDataMap() FUNCTION...");
  try {
    const liturgicalMap = buildLiturgicalDataMap(monthString);

    Logger.log(`   Total celebrations in map: ${liturgicalMap.size}`);
    Logger.log(`   Showing ALL celebrations with March 28-29 dates:\n`);

    let palmSundayFound = false;
    const palmCelebrations = [];

    for (const [celebration, data] of liturgicalMap.entries()) {
      // Check if this celebration has March 28 or 29 dates
      const palmDatesInThisCelebration = data.dates.filter(d =>
        (d.getMonth() === 2 && (d.getDate() === 28 || d.getDate() === 29) && d.getFullYear() === 2026)
      );

      if (palmDatesInThisCelebration.length > 0) {
        palmSundayFound = true;
        palmCelebrations.push({ celebration, data, palmDates: palmDatesInThisCelebration });

        Logger.log(`   Celebration: "${celebration}"`);
        Logger.log(`   Dates in map: ${palmDatesInThisCelebration.map(d => HELPER_formatDate(d, 'default')).join(', ')}`);
        Logger.log(`   Rank: ${data.rank}, Color: ${data.color}, Season: ${data.season}`);
        Logger.log('');
      }
    }

    if (!palmSundayFound) {
      results.liturgyMapCheck = "❌ buildLiturgicalDataMap() did NOT include March 28-29 dates";
      Logger.log(results.liturgyMapCheck);
      Logger.log(`   This is the root cause - the print function filters out these dates!`);
    } else {
      results.liturgyMapCheck = `✓ Found ${palmCelebrations.length} celebration(s) with March 28-29 dates`;
      Logger.log(results.liturgyMapCheck);

      // Check if "Palm Sunday of the Passion of the Lord" is in the map
      const hasPalmSunday = palmCelebrations.some(c => c.celebration.includes('Palm Sunday'));
      if (!hasPalmSunday) {
        Logger.log(`   ⚠️ WARNING: "Palm Sunday of the Passion of the Lord" NOT found in map!`);
        Logger.log(`   This is likely why it's not showing in the print schedule.`);
      }
    }
  } catch (e) {
    results.liturgyMapCheck = `❌ ERROR testing buildLiturgicalDataMap: ${e.message}`;
    Logger.log(results.liturgyMapCheck);
    Logger.log(`   Stack: ${e.stack}`);
  }

  // 4. Check MonthlyView sheet (actual print output)
  Logger.log("\n4. CHECKING MONTHLYVIEW SHEET (PRINT OUTPUT)...");
  try {
    const monthlyViewSheet = ss.getSheetByName('MonthlyView');
    if (!monthlyViewSheet) {
      results.printScheduleCheck = "⚠️ MonthlyView sheet doesn't exist yet";
      Logger.log(results.printScheduleCheck);
    } else {
      const printData = monthlyViewSheet.getDataRange().getValues();
      const palmInPrint = printData.some(row =>
        row.some(cell =>
          String(cell).includes('Palm Sunday') ||
          String(cell).includes('3/28/2026') ||
          String(cell).includes('3/29/2026') ||
          String(cell).includes('March 28') ||
          String(cell).includes('March 29')
        )
      );

      if (!palmInPrint) {
        results.printScheduleCheck = "❌ Palm Sunday NOT found in MonthlyView output";
        Logger.log(results.printScheduleCheck);
      } else {
        results.printScheduleCheck = "✓ Palm Sunday FOUND in MonthlyView output";
        Logger.log(results.printScheduleCheck);
      }
    }
  } catch (e) {
    results.printScheduleCheck = `❌ ERROR checking MonthlyView: ${e.message}`;
    Logger.log(results.printScheduleCheck);
  }

  // SUMMARY
  Logger.log("\n" + "=".repeat(70));
  Logger.log("DIAGNOSTIC SUMMARY");
  Logger.log("=".repeat(70));
  Logger.log(results.calendarCheck);
  Logger.log(results.assignmentsCheck);
  Logger.log(results.liturgyMapCheck);
  Logger.log(results.printScheduleCheck);
  Logger.log("\n" + "=".repeat(70));

  // Determine root cause
  let rootCause = "";
  if (results.calendarCheck && results.calendarCheck.includes("❌")) {
    rootCause = "ROOT CAUSE: Liturgical Calendar missing entries for March 28-29.\n" +
                "FIX: Run Step 1 (Generate Calendar) to create the full year calendar.";
  } else if (results.assignmentsCheck && results.assignmentsCheck.includes("❌")) {
    rootCause = "ROOT CAUSE: No assignments exist for March 28-29.\n" +
                "FIX: Check WeeklyMasses/YearlyMasses configuration, then run Step 2 (Generate Schedule).";
  } else if (results.liturgyMapCheck && results.liturgyMapCheck.includes("❌")) {
    rootCause = "ROOT CAUSE: buildLiturgicalDataMap() is filtering out March 28-29 dates.\n" +
                "FIX: This is a code bug in 5_printschedule.gs lines 164-176.";
  } else if (results.printScheduleCheck && results.printScheduleCheck.includes("❌")) {
    rootCause = "ROOT CAUSE: Data exists but print schedule failed to render it.\n" +
                "FIX: Check if there's a celebration name mismatch or other rendering issue.";
  } else {
    rootCause = "✓ No issues found - Palm Sunday should be displaying correctly!";
  }

  Logger.log("\n" + rootCause);
  Logger.log("=".repeat(70));

  // Show user-friendly dialog
  const ui = SpreadsheetApp.getUi();
  const message = `Calendar Check: ${results.calendarCheck}\n\n` +
                  `Assignments Check: ${results.assignmentsCheck}\n\n` +
                  `Liturgy Map Check: ${results.liturgyMapCheck}\n\n` +
                  `Print Schedule Check: ${results.printScheduleCheck}\n\n` +
                  `${rootCause}\n\n` +
                  `See execution logs (View > Executions) for detailed analysis.`;

  ui.alert('Palm Sunday Diagnostic Results', message, ui.ButtonSet.OK);

  return rootCause;
}
