/**
 * ====================================================================
 * DEBUG AND DIAGNOSTIC FUNCTIONS
 * ====================================================================
 * These functions help test and troubleshoot the system.
 * Run them from the Apps Script Editor when debugging issues.
 */

/**
 * This function's only purpose is to force Apps Script to
 * compile all files and report any syntax/reference errors.
 */
function DEBUG_findCompileError() {
  Logger.log("Starting debug compile check...");
  
  // This code "touches" one function from each file
  // to force it to be included in the compilation.
  // We are not *running* the functions, just referencing them.
  
  let f1 = CALENDAR_generateLiturgicalCalendar;
  let f2 = CALENDAR_calculateLiturgicalDates;
  let f3 = CALENDAR_getSeasonalCelebration;
  let f4 = SCHEDULE_generateScheduleForMonth;
  let f5 = ASSIGNMENT_autoAssignRolesForMonth;
  let f6 = HELPER_readConfig;
  let f7 = onFormSubmit;
  let f8 = TIMEOFFS_getPendingRequests;
  let f9 = TIMEOFFS_approveRequest;
  
  Logger.log("Debug compile check finished. If this log appears, no major compile errors were found.");
}

/**
 * Comprehensive diagnostic test for the Liturgical Calendar generation.
 * Run this from the Script Editor to see detailed logs.
 */
function DEBUG_testCalendarGeneration() {
  Logger.log("=== STARTING DIAGNOSTIC TEST ===");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // 1. Check if all required sheets exist
    Logger.log("\n--- Step 1: Checking Sheets ---");
    const requiredSheets = [
      CONSTANTS.SHEETS.CONFIG,
      CONSTANTS.SHEETS.CALENDAR,
      CONSTANTS.SHEETS.OVERRIDES,
      CONSTANTS.SHEETS.SAINTS_CALENDAR
    ];
    
    for (const sheetName of requiredSheets) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`ERROR: Sheet "${sheetName}" not found!`);
        return;
      } else {
        Logger.log(`✓ Sheet "${sheetName}" found`);
      }
    }
    
    // 2. Check Config
    Logger.log("\n--- Step 2: Reading Config ---");
    const config = HELPER_readConfig();
    Logger.log("Config contents: " + JSON.stringify(config));
    
    const scheduleYear = config["Year to Schedule"];
    const calendarRegion = config["Calendar Region"];
    
    if (!scheduleYear) {
      Logger.log("ERROR: 'Year to Schedule' not found in Config!");
      return;
    }
    Logger.log(`✓ Year to Schedule: ${scheduleYear}`);
    Logger.log(`✓ Calendar Region: ${calendarRegion || "Not set"}`);
    
    // 3. Test Date Calculations
    Logger.log("\n--- Step 3: Testing Date Calculations ---");
    const dates = CALENDAR_calculateLiturgicalDates(scheduleYear, config);
    Logger.log(`✓ Easter: ${dates.easter}`);
    Logger.log(`✓ Ash Wednesday: ${dates.ashWednesday}`);
    Logger.log(`✓ Pentecost: ${dates.pentecost}`);
    Logger.log(`✓ First Sunday of Advent: ${dates.firstSundayOfAdvent}`);
    
    // 4. Test Override Map
    Logger.log("\n--- Step 4: Testing Override Map ---");
    const overrideData = HELPER_readSheetData(CONSTANTS.SHEETS.OVERRIDES);
    Logger.log(`Override data rows: ${overrideData.length}`);
    const overrideMap = CALENDAR_buildOverrideMap(overrideData, scheduleYear);
    Logger.log(`Override map size: ${overrideMap.size}`);
    if (overrideMap.size > 0) {
      Logger.log("Sample override: " + JSON.stringify(Array.from(overrideMap.entries())[0]));
    }
    
    // 5. Test Saint Map
    Logger.log("\n--- Step 5: Testing Saint Map ---");
    const saintsData = HELPER_readSheetData(CONSTANTS.SHEETS.SAINTS_CALENDAR);
    Logger.log(`Saints data rows: ${saintsData.length}`);
    const saintMap = CALENDAR_buildSaintMap(saintsData, calendarRegion);
    Logger.log(`Saint map size: ${saintMap.size}`);
    if (saintMap.size > 0) {
      Logger.log("Sample saint: " + JSON.stringify(Array.from(saintMap.entries())[0]));
    }
    
    // 6. Test One Day's Calculation
    Logger.log("\n--- Step 6: Testing Single Day Calculation ---");
    const testDate = new Date(scheduleYear, 0, 1); // Jan 1
    const dayOfWeek = testDate.getDay();
    Logger.log(`Test date: ${testDate} (Day of week: ${dayOfWeek})`);
    
    const seasonal = CALENDAR_getSeasonalCelebration(testDate, dayOfWeek, dates);
    Logger.log(`Seasonal celebration: ${JSON.stringify(seasonal)}`);
    
    const override = overrideMap.get("1/1");
    Logger.log(`Override for 1/1: ${override ? JSON.stringify(override) : "None"}`);
    
    const saint = saintMap.get("1/1");
    Logger.log(`Saint for 1/1: ${saint ? JSON.stringify(saint) : "None"}`);
    
    // 7. Test Sheet Write Permission
    Logger.log("\n--- Step 7: Testing Sheet Write ---");
    const calSheet = ss.getSheetByName(CONSTANTS.SHEETS.CALENDAR);
    const lastRow = calSheet.getLastRow();
    const maxRows = calSheet.getMaxRows();
    Logger.log(`Calendar sheet - Last row: ${lastRow}, Max rows: ${maxRows}`);
    
    // Try to write a test value
    try {
      calSheet.getRange("A2").setValue("TEST");
      Logger.log("✓ Write test successful");
      calSheet.getRange("A2").clearContent();
      Logger.log("✓ Clear test successful");
    } catch (e) {
      Logger.log("ERROR: Cannot write to sheet! " + e.message);
      return;
    }
    
    // 8. Run the actual generation (first 10 days only for testing)
    Logger.log("\n--- Step 8: Testing Generation Loop (First 10 Days) ---");
    const newCalendarRows = [];
    const calCols = CONSTANTS.COLS.CALENDAR;
    
    let currentDate = new Date(scheduleYear, 0, 1);
    const endDate = new Date(scheduleYear, 0, 10); // Only first 10 days
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dayKey = (currentDate.getMonth() + 1) + "/" + currentDate.getDate();
      
      const override = overrideMap.get(dayKey);
      const seasonal = CALENDAR_getSeasonalCelebration(currentDate, dayOfWeek, dates);
      const saint = saintMap.get(dayKey);
      
      const seasonalRankNum = HELPER_translateRank(seasonal.rank);
      const saintRankNum = saint ? HELPER_translateRank(saint.rank) : 99;
      
      let finalCelebration;
      let optionalMemorial = "";
      
      if (override) {
        finalCelebration = {
          celebration: override.celebration,
          rank: override.rank,
          color: override.color,
          season: seasonal.season
        };
      } else if (saint && (saintRankNum < seasonalRankNum)) {
        finalCelebration = {
          celebration: saint.celebration,
          rank: saint.rank,
          color: saint.color,
          season: seasonal.season
        };
      } else if (saint && seasonal.season === "Lent" && saintRankNum === 3 && seasonalRankNum === 3) {
        finalCelebration = seasonal;
        if (saintRankNum === 4) { 
          optionalMemorial = saint.celebration;
        }
      } else if (saint && saintRankNum === 4 && seasonalRankNum === 7) {
        finalCelebration = seasonal;
        optionalMemorial = saint.celebration;
      } else {
        finalCelebration = seasonal;
        if (saint && saintRankNum === 4) {
          optionalMemorial = saint.celebration;
        }
      }
      
      const newRow = new Array(calCols.COLOR).fill("");
      newRow[calCols.DATE - 1] = new Date(currentDate);
      newRow[calCols.WEEKDAY - 1] = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
      newRow[calCols.LITURGICAL_CELEBRATION - 1] = finalCelebration.celebration;
      newRow[calCols.OPTIONAL_MEMORIAL - 1] = optionalMemorial;
      newRow[calCols.SEASON - 1] = finalCelebration.season;
      newRow[calCols.RANK - 1] = finalCelebration.rank;
      newRow[calCols.COLOR - 1] = finalCelebration.color;
      
      newCalendarRows.push(newRow);
      Logger.log(`${currentDate.toDateString()}: ${finalCelebration.celebration}`);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    Logger.log(`\n✓ Generated ${newCalendarRows.length} test rows successfully`);
    
    // 9. Try writing test rows
    Logger.log("\n--- Step 9: Writing Test Rows to Sheet ---");
    if (newCalendarRows.length > 0) {
      try {
        calSheet.getRange(2, 1, newCalendarRows.length, newCalendarRows[0].length).setValues(newCalendarRows);
        Logger.log(`✓ Successfully wrote ${newCalendarRows.length} rows to sheet`);
      } catch (e) {
        Logger.log("ERROR writing to sheet: " + e.message);
        Logger.log("Row length: " + newCalendarRows[0].length);
        Logger.log("Sample row: " + JSON.stringify(newCalendarRows[0]));
      }
    }
    
    Logger.log("\n=== DIAGNOSTIC TEST COMPLETE ===");
    Logger.log("If you see this message, check the logs above for any ERROR messages.");
    
  } catch (e) {
    Logger.log("\n=== FATAL ERROR ===");
    Logger.log("Error message: " + e.message);
    Logger.log("Error stack: " + e.stack);
  }
}

// ====================================================================
// TIMEOFF DEBUGGING FUNCTIONS
// ====================================================================

/**
 * Analyze why timeoffs aren't being enforced
 * Compares actual assignments against approved timeoffs
 */
function DEBUG_analyzeTimeoffEnforcement() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Test with January 2026
  const monthString = "2026-01";
  const { year, month } = HELPER_validateMonthString(monthString);

  Logger.log(`\n=== DEBUGGING TIMEOFF ENFORCEMENT FOR ${monthString} ===\n`);

  // Step 1: Build timeoff maps (same as production code)
  const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
  const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, year);

  Logger.log(`\n--- STEP 1: Timeoff Maps Built ---`);
  Logger.log(`Blacklists: ${timeoffMaps.blacklist.size} volunteers`);
  Logger.log(`Whitelists: ${timeoffMaps.whitelist.size} volunteers`);

  // Detailed logging of blacklist contents
  Logger.log(`\n--- Blacklist Details ---`);
  for (const [volunteerName, dateMap] of timeoffMaps.blacklist.entries()) {
    Logger.log(`\n  Volunteer: ${volunteerName}`);
    for (const [dateString, types] of dateMap.entries()) {
      Logger.log(`    Date: ${dateString}, Types: ${Array.from(types).join(', ')}`);
    }
  }

  // Detailed logging of whitelist contents
  Logger.log(`\n--- Whitelist Details ---`);
  for (const [volunteerName, dateMap] of timeoffMaps.whitelist.entries()) {
    Logger.log(`\n  Volunteer: ${volunteerName}`);
    for (const [dateString, types] of dateMap.entries()) {
      Logger.log(`    Date: ${dateString}, Types: ${Array.from(types).join(', ')}`);
    }
  }

  Logger.log(`\n\n=== DEBUGGING COMPLETE ===`);
  Logger.log(`Check the execution logs above for detailed analysis.`);

  return "Debugging complete - check execution logs";
}

/**
 * Test the date parsing logic in isolation
 */
function DEBUG_testDateParsing() {
  Logger.log(`\n=== TESTING DATE PARSING ===\n`);

  const testCases = [
    "1/3/2026 (Vigil), 1/4/2026",
    "1/10/2026 (Vigil), 1/11/2026, 1/31/2026 (Vigil), 2/1/2026",
    "1/17/2026 (Vigil), 1/18/2026, 1/24/2026 (Vigil), 1/25/2026",
    "1/10/2026 (Vigil), 1/11/2026, 1/24/2026 (Vigil), 1/25/2026"
  ];

  for (const testCase of testCases) {
    Logger.log(`\nInput: "${testCase}"`);
    const parsed = HELPER_parseDateBasedNotes(testCase);
    Logger.log(`Parsed ${parsed.length} dates:`);
    for (const dateInfo of parsed) {
      Logger.log(`  - ${dateInfo.dateString} (vigil: ${dateInfo.isVigil})`);
    }
  }

  return "Date parsing test complete - check execution logs";
}

/**
 * Test the month boundary logic
 */
function DEBUG_testMonthBoundaries() {
  Logger.log(`\n=== TESTING MONTH BOUNDARIES ===\n`);

  const year = 2026;
  const month = 0; // January

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  Logger.log(`Month: January 2026`);
  Logger.log(`monthStart: ${monthStart} (${monthStart.getTime()})`);
  Logger.log(`monthEnd: ${monthEnd} (${monthEnd.getTime()})`);

  // Test dates throughout the month
  const testDates = [
    "1/1/2026",
    "1/3/2026",
    "1/10/2026",
    "1/25/2026",
    "1/31/2026",
    "2/1/2026"
  ];

  for (const dateStr of testDates) {
    const parsed = new Date(dateStr);
    const safeDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);

    const inRange = safeDate >= monthStart && safeDate <= monthEnd;

    Logger.log(`\nDate: ${dateStr}`);
    Logger.log(`  Parsed: ${parsed}`);
    Logger.log(`  Safe: ${safeDate} (${safeDate.getTime()})`);
    Logger.log(`  >= monthStart: ${safeDate >= monthStart}`);
    Logger.log(`  <= monthEnd: ${safeDate <= monthEnd}`);
    Logger.log(`  In range: ${inRange} ${inRange ? '✓' : '✗'}`);
  }

  return "Month boundary test complete - check execution logs";
}

/**
 * Trace through actual filterCandidates logic
 * Simulates what happens during auto-assignment
 */
function DEBUG_traceFilterLogic() {
  Logger.log(`\n=== TRACING FILTER CANDIDATES LOGIC ===\n`);

  const monthString = "2026-01";
  const { year, month } = HELPER_validateMonthString(monthString);

  // Build same data structures as auto-assignment
  const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
  const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
  const volunteers = buildVolunteerMapOptimized(volunteerData);
  const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, year);

  Logger.log(`Volunteers map size: ${volunteers.size}`);
  Logger.log(`Blacklist map size: ${timeoffMaps.blacklist.size}`);

  // Test case: First volunteer with a blacklist entry
  const firstBlacklistVolunteer = Array.from(timeoffMaps.blacklist.keys())[0];
  if (firstBlacklistVolunteer) {
    Logger.log(`\n--- Testing blacklist for: ${firstBlacklistVolunteer} ---`);
    const blacklistMap = timeoffMaps.blacklist.get(firstBlacklistVolunteer);
    Logger.log(`Blacklist entries: ${blacklistMap.size}`);
    for (const [dateStr, types] of blacklistMap.entries()) {
      Logger.log(`  - "${dateStr}": ${Array.from(types).join(', ')}`);
    }
  }

  return "Filter trace complete - check execution logs";
}

// ====================================================================
// ORIGINAL DEBUG FUNCTIONS
// ====================================================================

/**
 * Diagnostic test for Timeoffs integration.
 * Run this after setting up the form to verify everything works.
 */
function DEBUG_testTimeoffsIntegration() {
  Logger.log("=== STARTING TIMEOFFS DIAGNOSTIC TEST ===");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // 1. Check if Timeoffs sheet exists
    Logger.log("\n--- Step 1: Checking Timeoffs Sheet ---");
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
    if (!sheet) {
      Logger.log("ERROR: Timeoffs sheet not found!");
      Logger.log("Expected sheet name: " + CONSTANTS.SHEETS.TIMEOFFS);
      return;
    }
    Logger.log("✓ Timeoffs sheet found");
    
    // 2. Check column headers
    Logger.log("\n--- Step 2: Checking Column Headers ---");
    const headers = sheet.getRange(1, 1, 1, 10).getValues()[0];
    Logger.log("Headers: " + JSON.stringify(headers));
    
    const expectedHeaders = [
      "Timestamp", "Name", "Email Address", "Availability Type", 
      "Start Date", "End Date", "Notes", "Status", "Reviewed Date", "Review Notes"
    ];
    
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (!headers[i]) {
        Logger.log(`⚠️ Column ${i + 1} (${expectedHeaders[i]}) appears to be empty`);
      } else {
        Logger.log(`✓ Column ${i + 1}: ${headers[i]}`);
      }
    }
    
    // 3. Check for existing data
    Logger.log("\n--- Step 3: Checking Existing Data ---");
    const lastRow = sheet.getLastRow();
    Logger.log(`Last row with data: ${lastRow}`);
    
    if (lastRow > 1) {
      const sampleRow = sheet.getRange(2, 1, 1, 10).getValues()[0];
      Logger.log("Sample row data: " + JSON.stringify(sampleRow));
      
      // Check if Status column has a value
      const status = sampleRow[CONSTANTS.COLS.TIMEOFFS.STATUS - 1];
      Logger.log(`Sample status value: ${status || "EMPTY - needs to be set!"}`);
    } else {
      Logger.log("No data rows yet (only header exists)");
    }
    
    // 4. Test getting pending requests
    Logger.log("\n--- Step 4: Testing TIMEOFFS_getPendingRequests ---");
    try {
      const pending = TIMEOFFS_getPendingRequests();
      Logger.log(`✓ Found ${pending.length} pending request(s)`);
      
      if (pending.length > 0) {
        Logger.log("Sample pending request: " + JSON.stringify(pending[0]));
      }
    } catch (e) {
      Logger.log("ERROR in TIMEOFFS_getPendingRequests: " + e.message);
    }
    
    // 5. Test integration with assignment logic
    Logger.log("\n--- Step 5: Testing Assignment Integration ---");
    try {
      // Get a sample month/year from config
      const config = HELPER_readConfig();
      const year = config["Year to Schedule"];
      const testMonth = 0; // January
      
      Logger.log(`Testing timeoff map for ${year}-${testMonth + 1}...`);
      
      const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
      Logger.log(`Read ${timeoffData.length} timeoff rows`);
      
      const timeoffMap = ASSIGNMENT_buildTimeoffMap(timeoffData, testMonth, year);
      Logger.log(`✓ Built timeoff map with ${timeoffMap.size} volunteers`);
      
      if (timeoffMap.size > 0) {
        const sampleVolunteer = Array.from(timeoffMap.keys())[0];
        const sampleDates = timeoffMap.get(sampleVolunteer);
        Logger.log(`Sample volunteer: ${sampleVolunteer}`);
        Logger.log(`  - Has ${sampleDates.length} not available date(s) in this month`);
        if (sampleDates.length > 0) {
          Logger.log(`  - First date: ${sampleDates[0]}`);
        }
      }
      
    } catch (e) {
      Logger.log("ERROR testing assignment integration: " + e.message);
      Logger.log("Stack: " + e.stack);
    }
    
    // 6. Test column constants
    Logger.log("\n--- Step 6: Verifying Column Constants ---");
    const cols = CONSTANTS.COLS.TIMEOFFS;
    Logger.log("Column map:");
    Logger.log(`  TIMESTAMP: ${cols.TIMESTAMP}`);
    Logger.log(`  VOLUNTEER_NAME: ${cols.VOLUNTEER_NAME}`);
    Logger.log(`  EMAIL: ${cols.EMAIL}`);
    Logger.log(`  TYPE: ${cols.TYPE}`);
    Logger.log(`  START_DATE: ${cols.START_DATE}`);
    Logger.log(`  END_DATE: ${cols.END_DATE}`);
    Logger.log(`  NOTES: ${cols.NOTES}`);
    Logger.log(`  STATUS: ${cols.STATUS}`);
    Logger.log(`  REVIEWED_DATE: ${cols.REVIEWED_DATE}`);
    Logger.log(`  REVIEW_NOTES: ${cols.REVIEW_NOTES}`);
    
    Logger.log("\n=== TIMEOFFS DIAGNOSTIC TEST COMPLETE ===");
    Logger.log("Check logs above for any ERROR or ⚠️ messages.");
    
  } catch (e) {
    Logger.log("\n=== FATAL ERROR ===");
    Logger.log("Error message: " + e.message);
    Logger.log("Error stack: " + e.stack);
  }
}
