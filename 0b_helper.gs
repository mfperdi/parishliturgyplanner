/**
 * ====================================================================
 * IMPROVED HELPER FUNCTIONS - CONSOLIDATED UTILITIES
 * ====================================================================
 * This consolidates common functionality and adds missing error handling
 */

/**
 * Enhanced data reading with caching and error handling
 */
const SHEET_CACHE = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

function HELPER_readSheetDataCached(sheetName, useCache = true) {
  const now = new Date().getTime();
  
  if (useCache && SHEET_CACHE.has(sheetName)) {
    const cached = SHEET_CACHE.get(sheetName);
    if (now - cached.timestamp < CACHE_EXPIRY) {
      return cached.data;
    }
  }
  
  try {
    const data = HELPER_readSheetData(sheetName);
    if (useCache) {
      SHEET_CACHE.set(sheetName, { data: data, timestamp: now });
    }
    return data;
  } catch (e) {
    Logger.log(`ERROR reading sheet ${sheetName}: ${e.message}`);
    throw new Error(`Failed to read sheet '${sheetName}': ${e.message}`);
  }
}

/**
 * Consolidated date formatting
 */
function HELPER_formatDate(date, format = 'default') {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  const formats = {
    'default': { month: 'numeric', day: 'numeric', year: 'numeric' },
    'long': { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    'short': { weekday: 'short', month: 'short', day: 'numeric' },
    'month-year': { month: 'long', year: 'numeric' },
    'iso': null // Special case for ISO format
  };
  
  if (format === 'iso') {
    return date.toISOString().split('T')[0];
  }
  
  const options = formats[format] || formats['default'];
  return date.toLocaleDateString('en-US', options);
}

/**
 * Consolidated time formatting
 */
function HELPER_formatTime(time) {
  if (!time) return '';
  
  if (typeof time === 'string') return time;
  
  if (time instanceof Date) {
    return time.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
  }
  
  return String(time);
}

/**
 * Enhanced config reader with validation
 */
function HELPER_readConfigSafe() {
  try {
    const config = HELPER_readConfig();
    
    // Validate critical settings
    const requiredSettings = ['Year to Schedule'];
    const missing = requiredSettings.filter(setting => !config[setting]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required config settings: ${missing.join(', ')}`);
    }
    
    // Validate year
    const year = config["Year to Schedule"];
    if (year < 2020 || year > 2050) {
      throw new Error(`Invalid year: ${year}. Must be between 2020-2050`);
    }
    
    return config;
  } catch (e) {
    Logger.log(`Config validation failed: ${e.message}`);
    throw e;
  }
}

/**
 * Consolidated volunteer scoring (extracted from assignment logic)
 */
function HELPER_calculateVolunteerScore(volunteer, roleToFill, eventId, assignmentCounts, massAssignments, volunteers) {
  let score = 100; // Base score
  const counts = assignmentCounts.get(volunteer.id) || { total: 0, recent: new Date(0) };
  const roleLower = roleToFill.toLowerCase();
  
  // Frequency penalty
  score -= counts.total * 5;
  
  // Mass preference bonus
  if (eventId && volunteer.massPrefs.includes(eventId)) {
    score += 20;
  }
  
  // Role preference bonus
  if (volunteer.rolePrefs.includes(roleLower)) {
    score += 15;
  }
  
  // Family team bonus
  if (volunteer.familyTeam && massAssignments) {
    for (const [assignedVolId, assignedRole] of massAssignments) {
      const assignedVol = volunteers.get(assignedVolId);
      if (assignedVol && assignedVol.familyTeam === volunteer.familyTeam) {
        score += 25;
        break;
      }
    }
  }
  
  // Flexibility bonus
  if (volunteer.massPrefs.length === 0 && volunteer.rolePrefs.length === 0) {
    score += 3;
  }
  
  return score;
}

/**
 * Input validation utilities
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
 * Safe array operations
 */
function HELPER_safeArrayAccess(array, index, defaultValue = '') {
  return (array && array.length > index) ? array[index] : defaultValue;
}

/**
 * Liturgical color utilities
 */
function HELPER_getLiturgicalColorHex(colorName) {
  const colors = {
    'White': '#edce47',
      'Violet': '#805977', 
      'Rose': '#cf7f93',
      'Green': '#2c926c',
      'Red': '#e06666'
  };
  return colors[colorName] || '#ecf0f1'; // Default light gray
}

/**
 * Performance monitoring wrapper
 */
function HELPER_timeFunction(funcName, func) {
  const start = new Date().getTime();
  const result = func();
  const end = new Date().getTime();
  Logger.log(`⏱️ ${funcName} took ${end - start}ms`);
  return result;
}

/**
 * ====================================================================
 * MISSING HELPER FUNCTIONS - BASIC UTILITIES
 * ====================================================================
 * These are the core helper functions that were missing from your codebase.
 * Add these functions to your existing helper.gs file or create a new file.
 */

/**
 * Reads data from a sheet, excluding the header row.
 * @param {string} sheetName The name of the sheet to read.
 * @returns {Array<Array<any>>} Array of row data (without header).
 */
function HELPER_readSheetData(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return []; // No data rows (only header or empty sheet)
    }
    
    // Read from row 2 to skip header
    const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    return range.getValues();
  } catch (e) {
    Logger.log(`Error reading sheet ${sheetName}: ${e.message}`);
    throw new Error(`Could not read sheet "${sheetName}": ${e.message}`);
  }
}

/**
 * Reads configuration settings from the Config sheet.
 * @returns {object} Configuration object with setting names as keys.
 */
function HELPER_readConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);
    
    if (!configSheet) {
      throw new Error('Config sheet not found');
    }
    
    const data = configSheet.getDataRange().getValues();
    const config = {};
    
    // Skip header row, process setting/value pairs
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const setting = row[0]; // Column A
      const value = row[1];   // Column B
      
      if (setting && value !== undefined && value !== '') {
        config[setting] = value;
      }
    }
    
    Logger.log(`Loaded ${Object.keys(config).length} config settings`);
    return config;
  } catch (e) {
    Logger.log(`Error reading config: ${e.message}`);
    throw new Error(`Could not read configuration: ${e.message}`);
  }
}

/**
 * Translates liturgical rank text to numbers for comparison.
 * Lower numbers = higher priority.
 * @param {string} rankText The rank text (e.g., "Solemnity").
 * @returns {number} Numerical rank for comparison.
 */
function HELPER_translateRank(rankText) {
  if (!rankText) return 99; // Default for undefined/null
  
  const rankMap = {
    'solemnity': 1,
    'feast': 2,
    'memorial': 3,
    'optional memorial': 4,
    'weekday': 7
  };
  
  const normalized = String(rankText).toLowerCase();
  return rankMap[normalized] || 99; // Default for unrecognized ranks
}

/**
 * Converts numbers to ordinal strings (1st, 2nd, 3rd, etc.).
 * @param {number} num The number to convert.
 * @returns {string} The ordinal string.
 */
function HELPER_getOrdinal(num) {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = num % 100;
  
  // Handle special cases (11th, 12th, 13th)
  if (value >= 11 && value <= 13) {
    return num + "th";
  }
  
  // Use last digit for suffix determination
  const lastDigit = num % 10;
  const suffix = suffixes[lastDigit] || suffixes[0];
  
  return num + suffix;
}

/**
 * Gets the previous Sunday from a given date.
 * @param {Date} date The reference date.
 * @returns {Date} The previous Sunday.
 */
function getPreviousSunday(date) {
  const result = new Date(date);
  const dayOfWeek = result.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  if (dayOfWeek === 0) {
    // If it's already Sunday, go back 7 days to get previous Sunday
    result.setDate(result.getDate() - 7);
  } else {
    // Go back to the most recent Sunday
    result.setDate(result.getDate() - dayOfWeek);
  }
  
  return result;
}

/**
 * Safely validates and parses month string input.
 * @param {string} monthString The month string to validate (YYYY-MM).
 * @returns {object} Object with validated year and month.
 */
function HELPER_validateMonthString(monthString) {
  if (!monthString || typeof monthString !== 'string') {
    throw new Error('Month string is required and must be a string');
  }
  
  const monthPattern = /^\d{4}-\d{2}$/;
  if (!monthPattern.test(monthString)) {
    throw new Error(`Invalid month format: "${monthString}". Expected format: YYYY-MM (e.g., 2026-01)`);
  }
  
  const [yearStr, monthStr] = monthString.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  
  // Validate year range
  if (year < 2020 || year > 2050) {
    throw new Error(`Year ${year} is out of range. Must be between 2020 and 2050.`);
  }
  
  // Validate month range
  if (month < 1 || month > 12) {
    throw new Error(`Month ${month} is invalid. Must be between 01 and 12.`);
  }
  
  return {
    year: year,
    month: month - 1  // Return 0-indexed month for JavaScript Date compatibility
  };
}

/**
 * Enhanced error logging with context information.
 * @param {string} context Description of what operation failed.
 * @param {Error} error The error object.
 * @param {object} additionalInfo Optional additional context.
 */
function HELPER_logError(context, error, additionalInfo = {}) {
  const timestamp = new Date().toISOString();
  const errorMessage = error.message || error;
  const stack = error.stack || 'No stack trace available';
  
  const logEntry = {
    timestamp: timestamp,
    context: context,
    message: errorMessage,
    additionalInfo: additionalInfo
  };
  
  Logger.log(`❌ ERROR [${context}]: ${errorMessage}`);
  if (Object.keys(additionalInfo).length > 0) {
    Logger.log(`   Additional Info: ${JSON.stringify(additionalInfo)}`);
  }
  Logger.log(`   Stack: ${stack}`);
  
  return logEntry;
}

/**
 * Safe array access with default values and type checking.
 * @param {Array} array The array to access.
 * @param {number} index The index to access.
 * @param {any} defaultValue The default value if index is out of bounds.
 * @returns {any} The value at the index or the default value.
 */
function HELPER_safeArrayAccess(array, index, defaultValue = '') {
  if (!Array.isArray(array)) {
    Logger.log(`Warning: Expected array but got ${typeof array}`);
    return defaultValue;
  }
  
  if (index < 0 || index >= array.length) {
    return defaultValue;
  }
  
  const value = array[index];
  return (value === null || value === undefined) ? defaultValue : value;
}

/**
 * Validates that required sheets exist in the spreadsheet.
 * @param {Array<string>} requiredSheets Array of sheet names to check.
 * @returns {object} Validation result with missing sheets.
 */
function HELPER_validateRequiredSheets(requiredSheets) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existingSheets = ss.getSheets().map(sheet => sheet.getName());
  const missing = requiredSheets.filter(sheetName => !existingSheets.includes(sheetName));
  
  const result = {
    valid: missing.length === 0,
    missingSheets: missing,
    existingSheets: existingSheets
  };
  
  if (!result.valid) {
    Logger.log(`❌ Missing required sheets: ${missing.join(', ')}`);
  }
  
  return result;
}

/**
 * Creates a friendly display message for operation results.
 * @param {string} operation The operation that was performed.
 * @param {boolean} success Whether the operation was successful.
 * @param {object} details Additional details about the operation.
 * @returns {string} Formatted message string.
 */
function HELPER_formatOperationResult(operation, success, details = {}) {
  const icon = success ? '✅' : '❌';
  const status = success ? 'SUCCESS' : 'FAILED';
  
  let message = `${icon} ${operation} ${status}`;
  
  if (details.itemCount !== undefined) {
    message += ` (${details.itemCount} items processed)`;
  }
  
  if (details.duration !== undefined) {
    message += ` in ${details.duration}ms`;
  }
  
  if (details.additionalInfo) {
    message += `\n${details.additionalInfo}`;
  }
  
  return message;
}

/**
 * Utility function to measure execution time of operations.
 * @param {string} operationName Name of the operation being timed.
 * @param {Function} operation The function to execute and time.
 * @returns {any} The result of the operation function.
 */
function HELPER_timeFunction(operationName, operation) {
  const startTime = new Date().getTime();
  
  try {
    const result = operation();
    const endTime = new Date().getTime();
    const duration = endTime - startTime;
    
    Logger.log(`⏱️ ${operationName} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const endTime = new Date().getTime();
    const duration = endTime - startTime;
    
    Logger.log(`⏱️ ${operationName} failed after ${duration}ms`);
    throw error;
  }
}
