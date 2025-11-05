/**
 * ====================================================================
 * HELPERS.GS
 * ====================================================================
 * This file contains re-usable functions that are called by many
 * different logic modules.
 */

/**
 * Reads all data from a given sheet, skipping the header row.
 * @param {string} sheetName The name of the sheet to read.
 * @returns {Array<Array<any>>} A 2D array of the data.
 */
function HELPER_readSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`HELPER_readSheetData: Sheet not found: ${sheetName}`);
    throw new Error(`Sheet not found: '${sheetName}'. Please check your sheet names.`);
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    // Logger.log(`HELPER_readSheetData: No data in ${sheetName}.`);
    return []; // No data below the header
  }
  
  // Read from row 2, column 1, to the last row and last column
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  // Logger.log(`HELPER_readSheetData: Read ${data.length} rows from ${sheetName}.`);
  return data;
}

/**
 * Reads the 'Config' sheet and returns a key-value object.
 * @returns {object} A map of settings, e.g., { "Year to Schedule": 2026 }
 */
function HELPER_readConfig() {
  const configData = HELPER_readSheetData(CONSTANTS.SHEETS.CONFIG);
  const config = {};
  const configCols = CONSTANTS.COLS.CONFIG;
  
  for (const row of configData) {
    const setting = row[configCols.SETTING - 1];
    let value = row[configCols.VALUE - 1];
    
    // Auto-convert TRUE/FALSE strings to booleans
    if (String(value).toUpperCase() === "TRUE") {
      value = true;
    } else if (String(value).toUpperCase() === "FALSE") {
      value = false;
    }
    
    if (setting) {
      config[setting] = value;
    }
  }
  // Logger.log(`HELPER_readConfig: Config loaded: ${JSON.stringify(config)}`);
  return config;
}

/**
 * Translates a liturgical rank (text) into a number for comparison.
 * Lower number = higher precedence.
 * @param {string} rankName The text rank (e.g., "Solemnity", "Feast").
 * @returns {number} The numerical rank (1-99).
 */
function HELPER_translateRank(rankName) {
  if (!rankName || typeof rankName !== 'string') {
    return 99; // Default to lowest rank
  }
  
  switch (rankName.toLowerCase()) {
    case "solemnity":
      return 1;
    case "feast":
      return 2;
    case "memorial":
      return 3;
    case "optional memorial":
      return 4;
    // --- Special Ranks for Seasons (used by 1b_CalendarSeasons) ---
    case "triduum":
      return 1;
    case "easter octave":
      return 1;
    case "lent": // Lenten Weekday
      return 3; 
    case "advent weekday (dec 17-24)":
      return 3; // Higher rank than other weekdays
    // --- Default Weekday ---
    case "weekday":
    default:
      return 7; // Rank 7 for Ordinary Time/Advent/Easter weekdays
  }
}

/**
 * Converts a number to its ordinal string (e.g., 1 -> "1st", 2 -> "2nd").
 * @param {number} n The number to convert.
 * @returns {string} The ordinal string.
 */
function HELPER_getOrdinal(n) {
  if (n === null || isNaN(n)) return ""; // Safety check
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Finds the date of the preceding Sunday for a given date.
 * @param {Date} currentDate The date to start from.
 * @returns {Date} The date of the previous Sunday.
 */
function HELPER_getPreviousSunday(currentDate) {
  const prevSunday = new Date(currentDate.getTime());
  prevSunday.setDate(prevSunday.getDate() - prevSunday.getDay()); // 0 is Sunday, so this finds it
  return prevSunday;
}

/**
 * Checks if a given date is a "protected" day that prevents other celebrations.
 * Protected days include: Sundays of Lent, Holy Week, Easter Octave.
 * @param {Date} date The date to check.
 * @param {object} dates The liturgical dates object.
 * @returns {boolean} True if the date is protected.
 */
function HELPER_isProtectedDay(date, dates) {
  const dateTime = date.getTime();
  const dayOfWeek = date.getDay();
  
  // 1. Sundays of Lent (but not Palm Sunday, which is handled separately)
  if (dayOfWeek === 0 && date >= dates.ashWednesday && date < dates.palmSunday) {
    return true;
  }
  
  // 2. Palm Sunday through Holy Saturday (Holy Week)
  if (date >= dates.palmSunday && date <= dates.holySaturday) {
    return true;
  }
  
  // 3. Easter Octave (Easter Sunday through Divine Mercy Sunday, inclusive)
  if (date >= dates.easter && date <= dates.divineMercySunday) {
    return true;
  }
  
  return false;
}

/**
 * Finds the next available date for transferring a celebration.
 * The target is the next Monday, unless that Monday is also protected.
 * @param {Date} originalDate The original date of the celebration.
 * @param {object} dates The liturgical dates object.
 * @returns {Date} The transfer target date.
 */
function HELPER_findTransferDate(originalDate, dates) {
  // Start with the next Monday
  let targetDate = new Date(originalDate.getTime());
  const daysUntilMonday = (8 - targetDate.getDay()) % 7 || 7; // If already Monday, go to next Monday
  targetDate.setDate(targetDate.getDate() + daysUntilMonday);
  
  // Keep checking if the target is also protected
  let maxAttempts = 30; // Safety limit to prevent infinite loops
  while (HELPER_isProtectedDay(targetDate, dates) && maxAttempts > 0) {
    // Move to the next Monday
    targetDate.setDate(targetDate.getDate() + 7);
    maxAttempts--;
  }
  
  if (maxAttempts === 0) {
    Logger.log("WARNING: Could not find a transfer date after 30 attempts. Using last attempted date.");
  }
  
  return targetDate;
}

/**
 * Formats a date as "M/D" for use as a map key.
 * @param {Date} date The date to format.
 * @returns {string} The formatted date key (e.g., "3/25").
 */
function HELPER_formatDateKey(date) {
  return (date.getMonth() + 1) + "/" + date.getDate();
}
