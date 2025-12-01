/**
 * Standalone web app entrypoint + CRUD helpers for Sheets.
 * Provides: doGet (renders WebApp.html), list metadata, and CRUD endpoints.
 */

/**
 * Renders the standalone web app for CRUD + automations.
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle('Parish Liturgy Planner');
}

/**
 * Returns sheet metadata (names + headers) and enums for dropdowns.
 * @returns {{sheets: Array, statusOptions: object, timeoffTypes: object}}
 */
function WEBAPP_getSheetMetadata() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetIds = Object.values(CONSTANTS.SHEETS);
  const sheets = sheetIds.map((id) => {
    const sheet = ss.getSheetByName(id);
    const headers = sheet
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    return {
      id,
      label: id,
      headers,
      rowCount: Math.max(0, (sheet ? sheet.getLastRow() : 1) - 1),
    };
  });

  return {
    sheets,
    statusOptions: CONSTANTS.STATUS,
    timeoffTypes: CONSTANTS.TIMEOFF_TYPES,
  };
}

/**
 * Fetches a page of rows for a given sheet.
 * @param {string} sheetName
 * @param {number} page
 * @param {number} pageSize
 * @returns {{header: string[], rows: Array, total: number}}
 */
function WEBAPP_listRows(sheetName, page, pageSize) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const total = Math.max(0, sheet.getLastRow() - 1);

  const startIndex = Math.max(0, page * pageSize);
  const remaining = Math.max(0, total - startIndex);
  const fetchCount = Math.min(pageSize, remaining);

  if (fetchCount === 0) {
    return { header, rows: [], total };
  }

  const range = sheet.getRange(startIndex + 2, 1, fetchCount, header.length);
  const values = range.getValues();
  const rows = values.map((row, idx) => {
    const obj = {};
    header.forEach((key, colIdx) => {
      obj[key] = row[colIdx];
    });
    return {
      rowNumber: startIndex + idx + 2,
      values: obj,
    };
  });

  return { header, rows, total };
}

/**
 * Creates or updates a row in the specified sheet.
 * @param {string} sheetName
 * @param {number|null} rowNumber
 * @param {object} payload
 * @returns {{rowNumber: number, values: object}}
 */
function WEBAPP_saveRow(sheetName, rowNumber, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRow = header.map((key) => payload[key] ?? '');

  const targetRow = rowNumber && rowNumber >= 2 ? rowNumber : sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, header.length).setValues([dataRow]);

  return {
    rowNumber: targetRow,
    values: payload,
  };
}

/**
 * Deletes a row from the specified sheet.
 * @param {string} sheetName
 * @param {number} rowNumber
 * @returns {{success: boolean}}
 */
function WEBAPP_deleteRow(sheetName, rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  if (!rowNumber || rowNumber < 2) {
    throw new Error('Invalid row number');
  }

  const lastRow = sheet.getLastRow();
  if (rowNumber > lastRow) {
    throw new Error(`Row ${rowNumber} does not exist`);
  }

  sheet.deleteRow(rowNumber);
  return { success: true };
}
