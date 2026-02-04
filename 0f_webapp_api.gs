/**
 * Web App API Functions
 *
 * Server-side functions for the React web app CRUD operations and timeoff review.
 * These functions are called via gas-react routes.
 *
 * @fileoverview
 * - CRUD functions for managing sheet data
 * - Timeoff review functions for approving/rejecting requests
 *
 * Row index convention:
 * - Client sends 0-based data indices (row 0 = first data row after header)
 * - Sheet API uses 1-based row numbers (row 1 = header)
 * - Conversion: sheetRow = dataIndex + 2
 */

// Allowlist of sheets that can be accessed via CRUD operations
const WEBAPP_ALLOWED_SHEETS = [
  'Config', 'Ministries', 'LiturgicalNotes', 'MassTemplates', 'CalendarOverrides',
  'SaintsCalendar', 'Volunteers', 'WeeklyMasses', 'MonthlyMasses', 'YearlyMasses', 'Timeoffs'
];

/**
 * Validates that a sheet name is in the allowlist.
 * @param {string} sheetName - The sheet name to validate.
 * @throws {Error} If the sheet name is not allowed.
 */
function WEBAPP_validateSheetName(sheetName) {
  if (!WEBAPP_ALLOWED_SHEETS.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" is not in the allowed list. Allowed sheets: ${WEBAPP_ALLOWED_SHEETS.join(', ')}`);
  }
}

// ─── CRUD FUNCTIONS ───────────────────────────────────────────────────────────

/**
 * Gets all data from a sheet.
 * @param {string} sheetName - The name of the sheet to read.
 * @returns {object} Object with headers array and rows array.
 */
function CRUD_getSheetData(sheetName) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }

    const allValues = sheet.getDataRange().getValues();
    if (allValues.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = allValues[0];

    // Filter out completely empty rows (where every cell is empty string or blank)
    const rows = allValues.slice(1).filter(row => {
      return row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    });

    Logger.log(`CRUD_getSheetData: Read ${rows.length} rows from ${sheetName}`);
    return { headers, rows };

  } catch (e) {
    Logger.log(`ERROR in CRUD_getSheetData: ${e.message}`);
    throw new Error(`Failed to read sheet "${sheetName}": ${e.message}`);
  }
}

/**
 * Adds a new row to a sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {Array} rowData - Array of values in column order.
 * @returns {object} Object with success flag and new row index.
 */
function CRUD_addRow(sheetName, rowData) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    // lastRow was the last row before adding, so new row is at lastRow + 1
    // Convert to 0-based data index: sheetRow - 2 = (lastRow + 1) - 2 = lastRow - 1
    const newRowIndex = lastRow - 1;

    Logger.log(`CRUD_addRow: Added row to ${sheetName} at index ${newRowIndex}`);
    return { success: true, rowIndex: newRowIndex };

  } catch (e) {
    Logger.log(`ERROR in CRUD_addRow: ${e.message}`);
    throw new Error(`Failed to add row to "${sheetName}": ${e.message}`);
  }
}

/**
 * Updates an existing row in a sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {number} rowIndex - 0-based data row index.
 * @param {Array} rowData - Array of values in column order.
 * @returns {object} Object with success flag.
 */
function CRUD_updateRow(sheetName, rowIndex, rowData) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }

    // Convert 0-based data index to 1-based sheet row (add 2: 1 for header, 1 for 0-to-1 conversion)
    const sheetRow = rowIndex + 2;

    sheet.getRange(sheetRow, 1, 1, rowData.length).setValues([rowData]);

    Logger.log(`CRUD_updateRow: Updated row ${rowIndex} in ${sheetName}`);
    return { success: true };

  } catch (e) {
    Logger.log(`ERROR in CRUD_updateRow: ${e.message}`);
    throw new Error(`Failed to update row ${rowIndex} in "${sheetName}": ${e.message}`);
  }
}

/**
 * Deletes a row from a sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {number} rowIndex - 0-based data row index.
 * @returns {object} Object with success flag.
 */
function CRUD_deleteRow(sheetName, rowIndex) {
  try {
    WEBAPP_validateSheetName(sheetName);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }

    // Convert 0-based data index to 1-based sheet row
    const sheetRow = rowIndex + 2;

    sheet.deleteRows(sheetRow, 1);

    Logger.log(`CRUD_deleteRow: Deleted row ${rowIndex} from ${sheetName}`);
    return { success: true };

  } catch (e) {
    Logger.log(`ERROR in CRUD_deleteRow: ${e.message}`);
    throw new Error(`Failed to delete row ${rowIndex} from "${sheetName}": ${e.message}`);
  }
}

/**
 * Gets the list of allowed sheet names.
 * @returns {object} Object with sheets array.
 */
function CRUD_getAllowedSheets() {
  return { sheets: WEBAPP_ALLOWED_SHEETS };
}

// ─── TIMEOFF REVIEW FUNCTIONS ─────────────────────────────────────────────────

/**
 * Converts a month string from "2026-02" format to "February 2026" format.
 * @param {string} monthString - Month in "YYYY-MM" format.
 * @returns {string} Month in "Month YYYY" format.
 */
function WEBAPP_convertMonthFormat(monthString) {
  const [year, month] = monthString.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

/**
 * Gets pending timeoff requests for a specific month.
 * @param {string} monthString - Month in "YYYY-MM" format (e.g., "2026-02").
 * @returns {object} Object with pending array and totalCount.
 */
function WEBAPP_getPendingTimeoffs(monthString) {
  try {
    // Get all pending requests using existing function
    const allPending = TIMEOFFS_getPendingRequests();

    // Convert monthString to the format stored in the sheet (e.g., "February 2026")
    const targetMonth = WEBAPP_convertMonthFormat(monthString);

    // Get the Timeoffs sheet to fetch month data for each pending request
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
    const cols = CONSTANTS.COLS.TIMEOFFS;

    // Filter by month and add dataIndex
    const filtered = [];
    for (const item of allPending) {
      // Get the month from the sheet for this row
      const month = sheet.getRange(item.rowNumber, cols.MONTH).getValue();

      if (month === targetMonth) {
        // Convert rowNumber (1-based sheet row) to dataIndex (0-based data index)
        const dataIndex = item.rowNumber - 2;

        filtered.push({
          ...item,
          dataIndex,
          month
        });
      }
    }

    Logger.log(`WEBAPP_getPendingTimeoffs: Found ${filtered.length} pending for ${targetMonth}`);
    return { pending: filtered, totalCount: filtered.length };

  } catch (e) {
    Logger.log(`ERROR in WEBAPP_getPendingTimeoffs: ${e.message}`);
    throw new Error(`Failed to get pending timeoffs: ${e.message}`);
  }
}

/**
 * Approves a timeoff request.
 * @param {number} rowIndex - 0-based data row index.
 * @param {string} notes - Optional review notes.
 * @returns {object} Object with success flag.
 */
function WEBAPP_approveTimeoff(rowIndex, notes) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
    const cols = CONSTANTS.COLS.TIMEOFFS;

    // Convert 0-based data index to 1-based sheet row
    const sheetRow = rowIndex + 2;

    // Update status
    sheet.getRange(sheetRow, cols.STATUS).setValue('Approved');

    // Update reviewed date
    sheet.getRange(sheetRow, cols.REVIEWED_DATE).setValue(new Date());

    // Update review notes if provided
    if (notes && notes.trim() !== '') {
      const currentNotes = sheet.getRange(sheetRow, cols.REVIEW_NOTES).getValue();
      const newNotes = currentNotes ? `${currentNotes}\n${notes}` : notes;
      sheet.getRange(sheetRow, cols.REVIEW_NOTES).setValue(newNotes);
    }

    Logger.log(`WEBAPP_approveTimeoff: Approved row ${rowIndex}`);
    return { success: true };

  } catch (e) {
    Logger.log(`ERROR in WEBAPP_approveTimeoff: ${e.message}`);
    throw new Error(`Failed to approve timeoff: ${e.message}`);
  }
}

/**
 * Rejects a timeoff request.
 * @param {number} rowIndex - 0-based data row index.
 * @param {string} notes - Optional rejection notes.
 * @returns {object} Object with success flag.
 */
function WEBAPP_rejectTimeoff(rowIndex, notes) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
    const cols = CONSTANTS.COLS.TIMEOFFS;

    // Convert 0-based data index to 1-based sheet row
    const sheetRow = rowIndex + 2;

    // Update status
    sheet.getRange(sheetRow, cols.STATUS).setValue('Rejected');

    // Update reviewed date
    sheet.getRange(sheetRow, cols.REVIEWED_DATE).setValue(new Date());

    // Update review notes if provided
    if (notes && notes.trim() !== '') {
      const currentNotes = sheet.getRange(sheetRow, cols.REVIEW_NOTES).getValue();
      const newNotes = currentNotes ? `${currentNotes}\n${notes}` : notes;
      sheet.getRange(sheetRow, cols.REVIEW_NOTES).setValue(newNotes);
    }

    Logger.log(`WEBAPP_rejectTimeoff: Rejected row ${rowIndex}`);
    return { success: true };

  } catch (e) {
    Logger.log(`ERROR in WEBAPP_rejectTimeoff: ${e.message}`);
    throw new Error(`Failed to reject timeoff: ${e.message}`);
  }
}
