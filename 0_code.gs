/**
 * ====================================================================
 * PARISH LITURGICAL SCHEDULER
 * ====================================================================
 * File Structure:
 * - constants.gs - Global constants and column maps
 * - helper.gs - Reusable helper functions
 * - main.gs - Menu, sidebar, and wrapper functions
 * - 1_calendarlogic.gs - Liturgical calendar generation
 * - 1a_calendardates.gs - Date calculations
 * - 1b_calendarseasons.gs - Seasonal celebrations
 * - 2_schedulelogic.gs - Mass schedule generation
 * - 3_assignmentlogic.gs - Volunteer auto-assignment
 * - 4_timeoffslogic.gs - Timeoff request management
 * - debug.gs - Diagnostic and testing functions
 * - Sidebar.html - User interface
 */

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
    const calendarData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    if (calendarData.length === 0) {
      return [];
    }
    
    const calendarCols = CONSTANTS.COLS.CALENDAR;
    const months = new Set();
    
    for (const row of calendarData) {
      const date = new Date(row[calendarCols.DATE - 1]);
      if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        months.add(`${year}-${month}`);
      }
    }
    
    return Array.from(months).sort();
    
  } catch (e) {
    Logger.log(`Error in getMonthsForSidebar: ${e}`);
    throw new Error(`Could not load months. Error: ${e.message}`);
  }
}

// ---================================---
//      SIDEBAR TRIGGER FUNCTIONS
// ---================================---

/**
 * (SIDEBAR) Triggers the calendar generation.
 * @returns {string} A success message.
 */
function triggerCalendarGeneration() {
  return CALENDAR_generateLiturgicalCalendar();
}

/**
 * (SIDEBAR) Triggers the schedule generation.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerScheduleGeneration(monthString) {
  return SCHEDULE_generateScheduleForMonth(monthString);
}

/**
 * (SIDEBAR) Triggers the auto-assignment.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerAssignment(monthString) {
  return ASSIGNMENT_autoAssignRolesForMonth(monthString);
}
