/**
 * DIAGNOSTIC: Check print schedule generation for Palm Sunday with ministry filter
 */
function DEBUG_checkPrintPalmSunday() {
  Logger.log("=".repeat(70));
  Logger.log("PRINT SCHEDULE DIAGNOSTIC - Palm Sunday with Ministry Filter");
  Logger.log("=".repeat(70));

  const monthString = "2026-03";
  const ministryFilter = ["Lector"]; // Word Ministry

  // Step 1: Get raw assignments
  Logger.log("\n1. GETTING RAW ASSIGNMENTS...");
  const allAssignments = getAssignmentDataForMonth(monthString);
  Logger.log(`   Total assignments for ${monthString}: ${allAssignments.length}`);

  const palmAssignments = allAssignments.filter(a =>
    a.liturgicalCelebration === "Palm Sunday of the Passion of the Lord"
  );
  Logger.log(`   Palm Sunday assignments (all ministries): ${palmAssignments.length}`);
  palmAssignments.forEach(a => {
    Logger.log(`     - ${HELPER_formatDate(a.date, 'default')} ${HELPER_formatTime(a.time)}: ${a.ministry} - ${a.role}`);
  });

  // Step 2: Apply ministry filter
  Logger.log("\n2. APPLYING MINISTRY FILTER (Lector)...");
  const ministrySet = new Set(ministryFilter.map(m => m.toLowerCase()));
  const filteredAssignments = allAssignments.filter(a =>
    ministrySet.has(a.ministry.toLowerCase())
  );
  Logger.log(`   Total assignments after filter: ${filteredAssignments.length}`);

  const filteredPalmAssignments = filteredAssignments.filter(a =>
    a.liturgicalCelebration === "Palm Sunday of the Passion of the Lord"
  );
  Logger.log(`   Palm Sunday assignments after filter: ${filteredPalmAssignments.length}`);
  filteredPalmAssignments.forEach(a => {
    Logger.log(`     - ${HELPER_formatDate(a.date, 'default')} ${HELPER_formatTime(a.time)}: ${a.ministry} - ${a.role}`);
  });

  // Step 3: Group assignments by liturgy
  Logger.log("\n3. GROUPING ASSIGNMENTS BY LITURGY...");
  const assignmentsByLiturgy = groupAssignmentsByLiturgy(filteredAssignments);
  Logger.log(`   Total celebrations with assignments: ${assignmentsByLiturgy.size}`);
  Logger.log(`   Celebrations:`);
  for (const [celebration, assignments] of assignmentsByLiturgy.entries()) {
    Logger.log(`     - "${celebration}": ${assignments.length} assignments`);
    if (celebration.includes("Palm Sunday")) {
      const dates = [...new Set(assignments.map(a => HELPER_formatDate(a.date, 'default')))];
      Logger.log(`       Dates: ${dates.join(', ')}`);
    }
  }

  // Step 4: Build liturgical data map
  Logger.log("\n4. BUILDING LITURGICAL DATA MAP...");
  const liturgicalMap = buildLiturgicalDataMap(monthString);
  Logger.log(`   Total celebrations in liturgical map: ${liturgicalMap.size}`);
  Logger.log(`   Palm Sunday-related celebrations:`);
  for (const [celebration, data] of liturgicalMap.entries()) {
    if (celebration.includes("Palm") || celebration.includes("Saturday of the 5th Week")) {
      Logger.log(`     - "${celebration}"`);
      Logger.log(`       Dates: ${data.dates.map(d => HELPER_formatDate(d, 'default')).join(', ')}`);
      Logger.log(`       Has assignments? ${assignmentsByLiturgy.has(celebration) ? 'YES' : 'NO'}`);
      if (assignmentsByLiturgy.has(celebration)) {
        Logger.log(`       Assignment count: ${assignmentsByLiturgy.get(celebration).length}`);
      }
    }
  }

  // Step 5: Check what would be displayed
  Logger.log("\n5. SIMULATING PRINT LOGIC...");
  const sortedCelebrations = Array.from(liturgicalMap.keys()).sort((a, b) => {
    const aFirstDate = liturgicalMap.get(a).dates[0];
    const bFirstDate = liturgicalMap.get(b).dates[0];
    return aFirstDate.getTime() - bFirstDate.getTime();
  });

  Logger.log(`   Celebrations that would be displayed:`);
  let palmSundayDisplayed = false;
  for (const celebration of sortedCelebrations) {
    const celebrationAssignments = assignmentsByLiturgy.get(celebration) || [];
    if (celebrationAssignments.length > 0) {
      const dates = liturgicalMap.get(celebration).dates;
      Logger.log(`     ✓ "${celebration}" (${celebrationAssignments.length} assignments, dates: ${dates.map(d => HELPER_formatDate(d, 'default')).join(', ')})`);
      if (celebration.includes("Palm Sunday")) {
        palmSundayDisplayed = true;
        // Show which dates have assignments
        const assignmentDates = [...new Set(celebrationAssignments.map(a => HELPER_formatDate(a.date, 'default')))];
        Logger.log(`       Assignment dates: ${assignmentDates.join(', ')}`);
      }
    }
  }

  Logger.log(`\n   Celebrations that would be SKIPPED (no assignments):`);
  for (const celebration of sortedCelebrations) {
    const celebrationAssignments = assignmentsByLiturgy.get(celebration) || [];
    if (celebrationAssignments.length === 0) {
      const dates = liturgicalMap.get(celebration).dates;
      if (celebration.includes("Palm") || celebration.includes("Saturday of the 5th Week")) {
        Logger.log(`     ✗ "${celebration}" (${dates.map(d => HELPER_formatDate(d, 'default')).join(', ')})`);
      }
    }
  }

  // Summary
  Logger.log("\n" + "=".repeat(70));
  Logger.log("DIAGNOSTIC SUMMARY");
  Logger.log("=".repeat(70));

  if (!palmSundayDisplayed) {
    Logger.log("❌ PROBLEM FOUND: Palm Sunday would NOT be displayed!");
    Logger.log("\nROOT CAUSE:");
    Logger.log("  The liturgical map only includes 'Palm Sunday of the Passion of the Lord'");
    Logger.log("  for March 29. When the print logic iterates through celebrations,");
    Logger.log("  it finds assignments and displays them.");
    Logger.log("\nBut this doesn't explain why it's missing from the print...");
    Logger.log("Need to investigate further.");
  } else {
    Logger.log("✓ Palm Sunday WOULD be displayed with all assignments!");
    Logger.log("\nIf it's missing from actual print, the issue is elsewhere.");
    Logger.log("Check:");
    Logger.log("  1. Ministry filter settings used in actual generation");
    Logger.log("  2. Month string format");
    Logger.log("  3. Cache issues (try clearing cache)");
  }

  Logger.log("=".repeat(70));

  // Show user dialog
  const ui = SpreadsheetApp.getUi();
  const message = `Filtered assignments for Palm Sunday: ${filteredPalmAssignments.length}\n\n` +
                  `Palm Sunday in liturgical map? ${liturgicalMap.has("Palm Sunday of the Passion of the Lord") ? 'YES' : 'NO'}\n\n` +
                  `Would be displayed? ${palmSundayDisplayed ? 'YES' : 'NO'}\n\n` +
                  `See execution logs for detailed analysis.`;

  ui.alert('Print Schedule Diagnostic', message, ui.ButtonSet.OK);
}
