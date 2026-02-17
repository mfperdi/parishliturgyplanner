/**
 * ====================================================================
 * HELPER FUNCTIONS - MISCELLANEOUS UTILITIES
 * ====================================================================
 *
 * PURPOSE:
 * Provides general utility functions that don't fit into other
 * categories. These are low-level helpers used throughout the
 * application.
 *
 * FUNCTIONS IN THIS FILE:
 * - Array utilities (safeArrayAccess)
 * - Input validation (validateMonthString)
 * - Performance monitoring (timeFunction)
 * - PDF export (exportLiturgicalSchedulePDF)
 *
 * DEPENDENCIES:
 * - Google Apps Script (SpreadsheetApp)
 * - Minimal dependencies on other helpers
 *
 * USED BY:
 * - All modules (safeArrayAccess is ubiquitous)
 * - Debug/diagnostics (timeFunction)
 * - Print functions (PDF export)
 *
 * DECISION TREE - Add new functions here if they:
 * ✅ Are general utilities not fitting other categories
 * ✅ Are array/string/number manipulation helpers
 * ✅ Are performance monitoring utilities
 * ✅ Are low-level helpers with no dependencies
 * ❌ Read sheet data → Use 0b1_helper_data.gs
 * ❌ Validate volunteers/ministries → Use 0b2_helper_ministry.gs
 * ❌ Format for display → Use 0b3_helper_formatting.gs
 * ❌ Show user dialogs → Use 0b4_helper_ui.gs
 *
 * LOADING ORDER: Fifth helper file (loads last, minimal dependencies)
 * ====================================================================
 */

/**
 * Input validation for month strings
 * @param {string} monthString - Month in YYYY-MM format
 * @returns {object} {year: number, month: number} - month is 0-indexed
 * @throws {Error} If format is invalid
 */
function HELPER_validateMonthString(monthString) {
  if (!monthString || !/^\d{4}-\d{2}$/.test(monthString)) {
    throw new Error(`Invalid month format: ${monthString}. Expected YYYY-MM`);
  }

  const [year, month] = monthString.split('-').map(n => parseInt(n));
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be 1-12`);
  }

  return { year, month: month - 1 }; // Return 0-indexed month
}

/**
 * Safe array access with default value
 * Prevents index out of bounds errors
 *
 * @param {Array} array - Array to access
 * @param {number} index - Index to access
 * @param {*} defaultValue - Default value if index invalid (default: '')
 * @returns {*} Array value at index or default value
 */
function HELPER_safeArrayAccess(array, index, defaultValue = '') {
  return (array && array.length > index) ? array[index] : defaultValue;
}

/**
 * Performance monitoring wrapper
 * Logs execution time of a function
 *
 * @param {string} funcName - Name of function for logging
 * @param {Function} func - Function to execute
 * @returns {*} Return value of the function
 */
function HELPER_timeFunction(funcName, func) {
  const start = new Date().getTime();
  const result = func();
  const end = new Date().getTime();
  Logger.log(`⏱️ ${funcName} took ${end - start}ms`);
  return result;
}

/**
 * Export liturgical schedule to PDF
 * Note: This function is here for legacy compatibility
 * Consider moving to 5_printschedule.gs in future refactoring
 *
 * @param {string} monthString - Month to export in YYYY-MM format
 * @returns {string} Message with export URL
 */
function PRINT_exportLiturgicalSchedulePDF(monthString) {
  try {
    // First generate the schedule if it doesn't exist
    const result = PRINT_generateLiturgicalSchedule(monthString);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const scheduleSheet = ss.getSheetByName('LiturgicalSchedule');

    if (!scheduleSheet) {
      throw new Error('No schedule sheet found to export');
    }

    // Create PDF blob
    const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?';
    const params = {
      exportFormat: 'pdf',
      format: 'pdf',
      size: 'A4',
      portrait: 'true',
      fitw: 'true',
      gridlines: 'false',
      printtitle: 'false',
      sheetnames: 'false',
      pagenumber: 'false',
      gid: scheduleSheet.getSheetId()
    };

    const paramString = Object.keys(params).map(key => key + '=' + params[key]).join('&');
    const fullUrl = url + paramString;

    return `PDF export prepared. You can download it from: ${fullUrl}`;

  } catch (e) {
    Logger.log(`Error exporting PDF: ${e.message}`);
    throw new Error(`Could not export PDF: ${e.message}`);
  }
}
