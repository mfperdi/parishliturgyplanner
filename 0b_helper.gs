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
 * Basic sheet data reader (original function)
 */
function HELPER_readSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }
  
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header row
  return data;
}

/**
 * Basic config reader (original function)
 */
function HELPER_readConfig() {
  const configData = HELPER_readSheetData(CONSTANTS.SHEETS.CONFIG);
  const config = {};
  const configCols = CONSTANTS.COLS.CONFIG;
  
  for (const row of configData) {
    const setting = row[configCols.SETTING - 1];
    const value = row[configCols.VALUE - 1];
    if (setting) {
      config[setting] = value;
    }
  }
  
  return config;
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
 * Enhanced with detailed preference debugging
 */
function HELPER_calculateVolunteerScore(volunteer, roleToFill, eventId, assignmentCounts, massAssignments, volunteers) {
  let score = 100; // Base score
  const counts = assignmentCounts.get(volunteer.id) || { total: 0, recent: new Date(0) };
  const roleLower = roleToFill.toLowerCase();
  
  Logger.log(`  Scoring ${volunteer.name} for ${roleToFill} (${eventId}):`);
  Logger.log(`    - Base score: ${score}`);
  
  // Frequency penalty
  const frequencyPenalty = counts.total * 5;
  score -= frequencyPenalty;
  Logger.log(`    - Frequency penalty (-${frequencyPenalty}): ${score}`);
  
  // Mass preference bonus
  if (eventId && volunteer.massPrefs.includes(eventId)) {
    score += 20;
    Logger.log(`    - Mass preference bonus (+20 for ${eventId}): ${score}`);
  } else if (eventId && volunteer.massPrefs.length > 0) {
    Logger.log(`    - No mass preference match: has [${volunteer.massPrefs.join(',')}] but needs ${eventId}`);
  }
  
  // Role preference bonus
  if (volunteer.rolePrefs.includes(roleLower)) {
    score += 15;
    Logger.log(`    - Role preference bonus (+15 for ${roleLower}): ${score}`);
  } else if (volunteer.rolePrefs.length > 0) {
    Logger.log(`    - No role preference match: has [${volunteer.rolePrefs.join(',')}] but needs ${roleLower}`);
  }
  
  // Family team bonus
  if (volunteer.familyTeam && massAssignments) {
    for (const [assignedVolId, assignedRole] of massAssignments) {
      const assignedVol = volunteers.get(assignedVolId);
      if (assignedVol && assignedVol.familyTeam === volunteer.familyTeam) {
        score += 25;
        Logger.log(`    - Family team bonus (+25 with ${assignedVol.name}): ${score}`);
        break;
      }
    }
  }
  
  // Flexibility bonus
  if (volunteer.massPrefs.length === 0 && volunteer.rolePrefs.length === 0) {
    score += 3;
    Logger.log(`    - Flexibility bonus (+3): ${score}`);
  }
  
  Logger.log(`    - FINAL SCORE: ${score}`);
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
    'White': '#f4f4f4',
    'Violet': '#8e44ad', 
    'Rose': '#e91e63',
    'Green': '#27ae60',
    'Red': '#e74c3c',
    'Gold': '#f1c40f'
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
 * MISSING FUNCTION: Translate liturgical rank text to number for comparison
 */
function HELPER_translateRank(rankText) {
  const ranks = {
    'Solemnity': 1,
    'Feast': 2,
    'Memorial': 3,
    'Optional Memorial': 4,
    'Commemoration': 5,
    'Ferial': 6,
    'Weekday': 7
  };
  
  return ranks[rankText] || 7; // Default to weekday if unknown
}

/**
 * MISSING FUNCTION: Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function HELPER_getOrdinal(number) {
  const suffix = ["th", "st", "nd", "rd"];
  const lastDigit = number % 10;
  const lastTwoDigits = number % 100;
  
  // Special cases for 11, 12, 13
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return number + "th";
  }
  
  // Use appropriate suffix based on last digit
  return number + (suffix[lastDigit] || "th");
}

/**
 * MISSING FUNCTION: Get the previous Sunday for a given date
 */
function getPreviousSunday(date) {
  const sunday = new Date(date);
  const dayOfWeek = sunday.getDay(); // 0 = Sunday
  
  if (dayOfWeek === 0) {
    // If it's already Sunday, go back a week
    sunday.setDate(sunday.getDate() - 7);
  } else {
    // Go back to the previous Sunday
    sunday.setDate(sunday.getDate() - dayOfWeek);
  }
  
  return sunday;
}

/**
 * MISSING FUNCTION: Build liturgical data for print functions
 */
function PRINT_buildLiturgicalData(monthString) {
  const liturgicalMap = new Map();
  
  try {
    const calendarData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.CALENDAR);
    const calCols = CONSTANTS.COLS.CALENDAR;
    
    const [targetYear, targetMonth] = monthString.split('-').map(n => parseInt(n));
    
    for (const row of calendarData) {
      const calDate = new Date(row[calCols.DATE - 1]);
      
      // Include this month and spillover Sunday if needed
      const includeDate = (
        (calDate.getMonth() === targetMonth - 1 && calDate.getFullYear() === targetYear) ||
        (calDate.getMonth() === targetMonth % 12 && calDate.getDate() <= 7 && 
         calDate.getFullYear() === (targetMonth === 12 ? targetYear + 1 : targetYear) &&
         calDate.getDay() === 0) // Only Sunday spillover
      );
      
      if (includeDate) {
        const celebration = row[calCols.LITURGICAL_CELEBRATION - 1];
        
        if (!liturgicalMap.has(celebration)) {
          liturgicalMap.set(celebration, {
            celebration: celebration,
            rank: row[calCols.RANK - 1],
            color: row[calCols.COLOR - 1], 
            season: row[calCols.SEASON - 1],
            dates: []
          });
        }
        
        liturgicalMap.get(celebration).dates.push(calDate);
      }
    }
    
    // Sort dates within each celebration
    for (const celebrationData of liturgicalMap.values()) {
      celebrationData.dates.sort((a, b) => a.getTime() - b.getTime());
    }
    
  } catch (error) {
    Logger.log(`Warning: Could not read liturgical calendar: ${error}`);
  }
  
  return liturgicalMap;
}

/**
 * MISSING FUNCTION: Export liturgical schedule to PDF
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

/**
 * MISSING FUNCTION: Generate liturgical schedule (wrapper for enhanced print function)
 */
function PRINT_generateLiturgicalSchedule(monthString) {
  try {
    // Use the enhanced print function with liturgical-specific options
    const result = generatePrintableSchedule(monthString, {
      sheetName: 'LiturgicalSchedule',
      layoutStyle: 'liturgical',
      showRankInfo: true,
      includeColors: true,
      groupByLiturgy: true
    });
    
    return result;
  } catch (e) {
    Logger.log(`Error in PRINT_generateLiturgicalSchedule: ${e.message}`);
    throw e;
  }
}

/**
 * Clear the sheet cache (useful for testing or when data changes)
 */
function HELPER_clearCache() {
  SHEET_CACHE.clear();
  Logger.log("Sheet cache cleared");
}

/**
 * Get cache statistics
 */
function HELPER_getCacheStats() {
  const stats = {
    size: SHEET_CACHE.size,
    entries: []
  };
  
  for (const [key, value] of SHEET_CACHE.entries()) {
    stats.entries.push({
      sheet: key,
      timestamp: new Date(value.timestamp),
      rows: value.data.length
    });
  }
  
  return stats;
}
