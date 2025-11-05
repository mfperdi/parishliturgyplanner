/**
 * @OnlyCurrentDoc
 * This script manages the Parish Liturgical Scheduler.
 * It adds a custom menu on open and shows the sidebar.
 */

/**
 * Runs when the spreadsheet is opened. Adds a custom menu.
 * @param {object} e The event object.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('Parish Scheduler')
      .addItem('Show Sidebar', 'showSidebar')
      .addToUi();
}

/**
 * Shows the main HTML sidebar.
 * This function is called by the menu item.
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Parish Scheduler')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Fetches the list of months from the LiturgicalCalendar sheet.
 * This function is called by the sidebar's JavaScript.
 * @returns {Array<string>} A list of unique months (e.g., "2026-01").
 */
function getMonthsForSidebar() {
  try {
    // This function calls HELPER_readSheetData, which is in the Helpers.gs file.
    // This works because all .gs files share the same global scope.
    const calendarData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    if (calendarData.length === 0) {
      return []; // No data, return empty
    }
    
    const calendarCols = CONSTANTS.COLS.CALENDAR;
    const months = new Set();
    
    // Start from row 0 of the data array (which is row 2 of the sheet)
    for (const row of calendarData) {
      const date = new Date(row[calendarCols.DATE - 1]);
      if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        // getMonth() is 0-indexed, so add 1
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        months.add(`${year}-${month}`);
      }
    }
    
    return Array.from(months).sort();
    
  } catch (e) {
    Logger.log(`Error in getMonthsForSidebar: ${e}`);
    // Return a specific error message to the sidebar
    throw new Error(`Could not load months. Error: ${e.message}`);
  }
}

// ---================================---
//      SIDEBAR TRIGGER FUNCTIONS
// ---================================---
// These functions are called directly by the sidebar.
// They act as simple wrappers for the main logic functions.

/**
 * (SIDEBAR) Triggers the calendar generation.
 * @returns {string} A success message.
 */
function triggerCalendarGeneration() {
  // This calls the main logic function from 1_CalendarLogic.gs
  return CALENDAR_generateLiturgicalCalendar();
}

/**
 * (SIDEBAR) Triggers the schedule generation.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerScheduleGeneration(monthString) {
  // This calls the main logic function from 2_ScheduleLogic.gs
  return SCHEDULE_generateScheduleForMonth(monthString);
}

/**
 * (SIDEBAR) Triggers the auto-assignment.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerAssignment(monthString) {
  // This calls the main logic function from 3_AssignmentLogic.gs
  return ASSIGNMENT_autoAssignRolesForMonth(monthString);
}


// ---================================---
//            DEBUGGING
// ---================================---

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
