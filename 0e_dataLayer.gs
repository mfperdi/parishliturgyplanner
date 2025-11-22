/**
 * ====================================================================
 * GENERALIZED DATA ACCESS LAYER
 * ====================================================================
 * Provides consistent CRUD utilities for Sheets data using the column
 * maps defined in CONSTANTS. Includes per-sheet normalizers and
 * validators that run before writes, and helpers for returning row data
 * as objects keyed by column names.
 */

/**
 * Lists sheets that exist in the active spreadsheet and are known in
 * CONSTANTS.SHEETS. Safe for exposure via google.script.run.
 * @returns {Array<string>} Sorted list of available sheet names.
 */
function DATA_listSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const knownSheets = Object.values(CONSTANTS.SHEETS);
  return knownSheets.filter(name => ss.getSheetByName(name)).sort();
}

/**
 * Reads all rows from the specified sheet, returning header names and
 * row objects keyed by the column map. Uses column positions from
 * CONSTANTS to avoid header drift.
 * @param {string} sheetName
 * @returns {{headers: string[], rows: object[]}}
 */
function DATA_readRows(sheetName) {
  const meta = DATA_getSheetMeta(sheetName);
  const sheet = meta.sheet;
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { headers: meta.keys, rows: [] };
  }

  // Drop header row from data values; use column map keys as headers
  values.shift();
  const rows = values.map(row => DATA_applyNormalization(meta.key, DATA_rowToRecord(meta, row)));
  return { headers: meta.keys, rows: rows };
}

/**
 * Creates a new row in the given sheet using the provided record.
 * @param {string} sheetName
 * @param {string} keyColumn Name from the column map to enforce uniqueness
 * @param {object} record
 * @returns {object} Saved record
 */
function DATA_createRow(sheetName, keyColumn, record) {
  const meta = DATA_getSheetMeta(sheetName);
  if (!meta.colMap[keyColumn]) {
    throw new Error(`Column '${keyColumn}' is not defined for sheet ${sheetName}`);
  }
  const prepared = DATA_prepareRecord(meta, record);
  const keyValue = prepared[keyColumn];
  if (!keyValue) {
    throw new Error(`Key column '${keyColumn}' is required for ${sheetName}`);
  }

  // Prevent duplicates
  const existing = DATA_readRows(sheetName).rows.find(row => row[keyColumn] === keyValue);
  if (existing) {
    throw new Error(`Row with ${keyColumn} '${keyValue}' already exists in ${sheetName}`);
  }

  const rowValues = DATA_recordToRow(meta, prepared);
  meta.sheet.appendRow(rowValues);
  return prepared;
}

/**
 * Updates a row by matching key column value.
 * @param {string} sheetName
 * @param {string} keyColumn
 * @param {object} record
 * @returns {object} Updated record
 */
function DATA_updateRow(sheetName, keyColumn, record) {
  const meta = DATA_getSheetMeta(sheetName);
  if (!meta.colMap[keyColumn]) {
    throw new Error(`Column '${keyColumn}' is not defined for sheet ${sheetName}`);
  }
  const prepared = DATA_prepareRecord(meta, record);
  const keyValue = prepared[keyColumn];
  if (!keyValue) {
    throw new Error(`Key column '${keyColumn}' is required for ${sheetName}`);
  }

  const rows = meta.sheet.getDataRange().getValues();
  const headerOffset = 1; // skip header row
  for (let i = headerOffset; i < rows.length; i++) {
    const row = rows[i];
    if (row[meta.colMap[keyColumn] - 1] === keyValue) {
      const rowValues = DATA_recordToRow(meta, prepared);
      meta.sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return prepared;
    }
  }

  throw new Error(`No row found in ${sheetName} with ${keyColumn} '${keyValue}'`);
}

/**
 * Deletes a row by key column value.
 * @param {string} sheetName
 * @param {string} keyColumn
 * @param {string|number} keyValue
 * @returns {boolean} True if a row was deleted
 */
function DATA_deleteRow(sheetName, keyColumn, keyValue) {
  const meta = DATA_getSheetMeta(sheetName);
  if (!meta.colMap[keyColumn]) {
    throw new Error(`Column '${keyColumn}' is not defined for sheet ${sheetName}`);
  }
  if (!keyValue) {
    throw new Error(`Key column '${keyColumn}' is required for ${sheetName}`);
  }

  const rows = meta.sheet.getDataRange().getValues();
  const headerOffset = 1;
  for (let i = headerOffset; i < rows.length; i++) {
    const row = rows[i];
    if (row[meta.colMap[keyColumn] - 1] === keyValue) {
      meta.sheet.deleteRow(i + 1);
      return true;
    }
  }

  throw new Error(`No row found in ${sheetName} with ${keyColumn} '${keyValue}'`);
}

/**
 * Converts a sheet row array to a record keyed by column map keys.
 * @param {{colMap: object, keys: string[]}} meta
 * @param {Array} row
 * @returns {object}
 */
function DATA_rowToRecord(meta, row) {
  const record = {};
  meta.keys.forEach(key => {
    record[key] = row[meta.colMap[key] - 1];
  });
  return record;
}

/**
 * Converts a normalized record to a row array matching the column order.
 * @param {{colMap: object, keys: string[]}} meta
 * @param {object} record
 * @returns {Array}
 */
function DATA_recordToRow(meta, record) {
  return meta.keys.map(key => record[key] !== undefined ? record[key] : '');
}

/**
 * Resolves sheet metadata and column ordering.
 * @param {string} sheetName
 * @returns {{sheet: GoogleAppsScript.Spreadsheet.Sheet, key: string, colMap: object, keys: string[]}}
 */
function DATA_getSheetMeta(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  const key = Object.entries(CONSTANTS.SHEETS).find(([, name]) => name === sheetName);
  if (!key) {
    throw new Error(`Sheet '${sheetName}' is not registered in CONSTANTS.SHEETS`);
  }

  const colMap = CONSTANTS.COLS[key[0]];
  if (!colMap) {
    throw new Error(`No column map found for sheet '${sheetName}'`);
  }

  const keys = Object.entries(colMap)
    .sort((a, b) => a[1] - b[1])
    .map(([colName]) => colName);

  return { sheet, key: key[0], colMap, keys };
}

/**
 * Applies per-sheet normalization and validation.
 * @param {{key: string}} meta
 * @param {object} record
 * @returns {object} Normalized and validated record
 */
function DATA_prepareRecord(meta, record) {
  const normalized = DATA_applyNormalization(meta.key, record);
  const errors = DATA_validateRecord(meta.key, normalized);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
  return normalized;
}

/**
 * Runs normalization logic for supported sheets.
 * @param {string} sheetKey
 * @param {object} record
 * @returns {object}
 */
function DATA_applyNormalization(sheetKey, record) {
  const normalizers = {
    CALENDAR: rec => ({
      ...rec,
      DATE: rec.DATE ? new Date(rec.DATE) : rec.DATE,
      COLOR: rec.COLOR || (rec.SEASON ? rec.SEASON : rec.COLOR)
    }),
    ASSIGNMENTS: rec => ({
      ...rec,
      DATE: rec.DATE ? new Date(rec.DATE) : rec.DATE,
      STATUS: rec.STATUS || CONSTANTS.STATUS.ASSIGNMENT[0],
      NOTES: rec.NOTES || ''
    }),
    TIMEOFFS: rec => ({
      ...rec,
      START_DATE: rec.START_DATE ? new Date(rec.START_DATE) : rec.START_DATE,
      END_DATE: rec.END_DATE ? new Date(rec.END_DATE) : rec.END_DATE,
      STATUS: rec.STATUS || CONSTANTS.STATUS.TIMEOFF[0]
    })
  };

  const handler = normalizers[sheetKey];
  return handler ? handler({ ...record }) : { ...record };
}

/**
 * Runs validation logic for supported sheets.
 * @param {string} sheetKey
 * @param {object} record
 * @returns {string[]} List of error messages
 */
function DATA_validateRecord(sheetKey, record) {
  const validators = {
    CALENDAR: rec => {
      const errors = [];
      if (!rec.DATE || isNaN(new Date(rec.DATE).getTime())) {
        errors.push('Calendar rows require a valid DATE');
      }
      if (!rec.LITURGICAL_CELEBRATION) {
        errors.push('Calendar rows require a LITURGICAL_CELEBRATION');
      }
      return errors;
    },
    ASSIGNMENTS: rec => {
      const errors = [];
      if (!rec.DATE) {
        errors.push('Assignments require DATE');
      }
      if (!rec.DESCRIPTION) {
        errors.push('Assignments require DESCRIPTION');
      }
      if (rec.STATUS && !CONSTANTS.STATUS.ASSIGNMENT.includes(rec.STATUS)) {
        errors.push(`Invalid STATUS '${rec.STATUS}' for Assignments`);
      }
      return errors;
    },
    TIMEOFFS: rec => {
      const errors = [];
      if (!rec.VOLUNTEER_NAME) {
        errors.push('Timeoffs require VOLUNTEER_NAME');
      }
      if (rec.STATUS && !CONSTANTS.STATUS.TIMEOFF.includes(rec.STATUS)) {
        errors.push(`Invalid STATUS '${rec.STATUS}' for Timeoffs`);
      }
      return errors;
    }
  };

  const validator = validators[sheetKey];
  return validator ? validator(record) : [];
}
