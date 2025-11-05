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
