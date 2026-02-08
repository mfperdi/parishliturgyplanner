/**
 * Web App API Functions for Parish Liturgical Scheduler
 *
 * This file provides CRUD operations for the React web app.
 * All functions validate sheet names against an allowlist for security.
 */

// Allowlist of sheets that can be accessed via the web app
const WEBAPP_ALLOWED_SHEETS = [
  'Config', 'Ministries', 'LiturgicalNotes', 'MassTemplates', 'CalendarOverrides',
  'SaintsCalendar', 'Volunteers', 'WeeklyMasses', 'MonthlyMasses', 'YearlyMasses', 'Timeoffs'
];

/**
 * Validates that a sheet name is in the allowlist
 * @param {string} sheetName - The sheet name to validate
 * @throws {Error} If sheet name is not allowed
 */
function WEBAPP_validateSheetName(sheetName) {
  if (!WEBAPP_ALLOWED_SHEETS.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" is not allowed`);
  }
}

/**
 * Gets all data from a sheet
 * @param {string} sheetName - The name of the sheet to read
 * @returns {Object} { headers: string[], rows: any[][] }
 */
function CRUD_getSheetData(sheetName) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const allValues = sheet.getDataRange().getValues();
    if (allValues.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = allValues[0];
    // Filter out empty rows (where every cell is empty string or blank)
    const rows = allValues.slice(1).filter(row =>
      row.some(cell => cell !== '' && cell !== null && cell !== undefined)
    );

    return { headers, rows };
  } catch (e) {
    Logger.log(`ERROR in CRUD_getSheetData: ${e.message}`);
    throw new Error(`Failed to get sheet data: ${e.message}`);
  }
}

/**
 * Adds a new row to a sheet
 * @param {string} sheetName - The name of the sheet
 * @param {any[]} rowData - Array of values in column order
 * @returns {Object} { success: boolean, rowIndex: number }
 */
function CRUD_addRow(sheetName, rowData) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    // Return the 0-based data index of the new row
    // lastRow is the 1-based sheet row before adding, so after adding:
    // new sheet row = lastRow + 1
    // data index = sheet row - 2 (subtract 1 for header, subtract 1 for 0-based)
    // = lastRow + 1 - 2 = lastRow - 1
    return { success: true, rowIndex: lastRow - 1 };
  } catch (e) {
    Logger.log(`ERROR in CRUD_addRow: ${e.message}`);
    throw new Error(`Failed to add row: ${e.message}`);
  }
}

/**
 * Updates an existing row in a sheet
 * @param {string} sheetName - The name of the sheet
 * @param {number} rowIndex - 0-based data index (row 0 = first data row after header)
 * @param {any[]} rowData - Array of values in column order
 * @returns {Object} { success: boolean }
 */
function CRUD_updateRow(sheetName, rowIndex, rowData) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    // Convert 0-based data index to 1-based sheet row
    // sheetRow = rowIndex + 2 (add 1 for header, add 1 for 1-based)
    const sheetRow = rowIndex + 2;
    sheet.getRange(sheetRow, 1, 1, rowData.length).setValues([rowData]);

    return { success: true };
  } catch (e) {
    Logger.log(`ERROR in CRUD_updateRow: ${e.message}`);
    throw new Error(`Failed to update row: ${e.message}`);
  }
}

/**
 * Deletes a row from a sheet
 * @param {string} sheetName - The name of the sheet
 * @param {number} rowIndex - 0-based data index
 * @returns {Object} { success: boolean }
 */
function CRUD_deleteRow(sheetName, rowIndex) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    // Convert 0-based data index to 1-based sheet row
    const sheetRow = rowIndex + 2;
    sheet.deleteRows(sheetRow, 1);

    return { success: true };
  } catch (e) {
    Logger.log(`ERROR in CRUD_deleteRow: ${e.message}`);
    throw new Error(`Failed to delete row: ${e.message}`);
  }
}

/**
 * Gets the list of allowed sheets
 * @returns {Object} { sheets: string[] }
 */
function CRUD_getAllowedSheets() {
  return { sheets: WEBAPP_ALLOWED_SHEETS };
}

// ─── TIMEOFF REVIEW FUNCTIONS ─────────────────────────────────────────────────

/**
 * Gets pending timeoff requests for a specific month
 * @param {string} monthString - Month in "YYYY-MM" format (e.g., "2026-02")
 * @returns {Object} { pending: Object[], totalCount: number }
 */
function WEBAPP_getPendingTimeoffs(monthString) {
  try {
    // Convert monthString "2026-02" to "February 2026" format for comparison
    const [year, month] = monthString.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const targetMonth = `${monthNames[parseInt(month, 10) - 1]} ${year}`;

    // Get pending requests from existing function if available, otherwise read directly
    let pendingRequests = [];

    if (typeof TIMEOFFS_getPendingRequests === 'function') {
      pendingRequests = TIMEOFFS_getPendingRequests();
    } else {
      // Fallback: read directly from Timeoffs sheet
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeoffs');
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][6] === 'Pending') { // STATUS column (G, index 6)
            pendingRequests.push({
              rowNumber: i + 1, // 1-based sheet row
              timestamp: data[i][0],
              name: data[i][1],
              type: data[i][2],
              selectedDates: data[i][3],
              volunteerNotes: data[i][4],
              reviewNotes: data[i][8]
            });
          }
        }
      }
    }

    // Convert rowNumber to dataIndex and filter by month
    const filtered = pendingRequests
      .map(req => ({
        ...req,
        dataIndex: req.rowNumber - 2 // Convert 1-based sheet row to 0-based data index
      }))
      .filter(req => {
        // Check if the request is for the target month
        // The selectedDates field contains dates like "2/7/2026 (Vigil), 2/8/2026"
        // We need to check if any date matches the target month/year
        const dates = String(req.selectedDates || '');
        return dates.includes(`/${month.replace(/^0/, '')}/${year}`) ||
               dates.includes(`${month.replace(/^0/, '')}/${year}`);
      });

    return { pending: filtered, totalCount: filtered.length };
  } catch (e) {
    Logger.log(`ERROR in WEBAPP_getPendingTimeoffs: ${e.message}`);
    throw new Error(`Failed to get pending timeoffs: ${e.message}`);
  }
}

/**
 * Approves a timeoff request
 * @param {number} rowIndex - 0-based data index
 * @param {string} notes - Optional review notes
 * @returns {Object} { success: boolean }
 */
function WEBAPP_approveTimeoff(rowIndex, notes) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeoffs');
    if (!sheet) {
      throw new Error('Timeoffs sheet not found');
    }

    const sheetRow = rowIndex + 2;
    sheet.getRange(sheetRow, 7).setValue('Approved'); // STATUS column (G)
    sheet.getRange(sheetRow, 8).setValue(new Date()); // REVIEWED_DATE column (H)
    if (notes && notes.trim() !== '') {
      sheet.getRange(sheetRow, 9).setValue(notes); // REVIEW_NOTES column (I)
    }

    return { success: true };
  } catch (e) {
    Logger.log(`ERROR in WEBAPP_approveTimeoff: ${e.message}`);
    throw new Error(`Failed to approve timeoff: ${e.message}`);
  }
}

/**
 * Rejects a timeoff request
 * @param {number} rowIndex - 0-based data index
 * @param {string} notes - Optional review notes
 * @returns {Object} { success: boolean }
 */
function WEBAPP_rejectTimeoff(rowIndex, notes) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeoffs');
    if (!sheet) {
      throw new Error('Timeoffs sheet not found');
    }

    const sheetRow = rowIndex + 2;
    sheet.getRange(sheetRow, 7).setValue('Rejected'); // STATUS column (G)
    sheet.getRange(sheetRow, 8).setValue(new Date()); // REVIEWED_DATE column (H)
    if (notes && notes.trim() !== '') {
      sheet.getRange(sheetRow, 9).setValue(notes); // REVIEW_NOTES column (I)
    }

    return { success: true };
  } catch (e) {
    Logger.log(`ERROR in WEBAPP_rejectTimeoff: ${e.message}`);
    throw new Error(`Failed to reject timeoff: ${e.message}`);
  }
}
