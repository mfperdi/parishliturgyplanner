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
 * Read print schedule configuration with sensible defaults
 * Configurable settings:
 * - Print Schedule Title: Custom title (e.g., "Lector Ministry Schedule")
 * - Parish Logo: Insert image in Config sheet using "Insert > Image > Image over cells"
 *   (Will use the first image found in Config sheet)
 * - Parish Logo Height: Row height for logo in pixels (default: 60, max: 300)
 *   Note: Logo scales to fit within the row height
 * - Assigned Group Color [GroupName]: Background color for specific assigned groups (hex code)
 *   Examples: "Assigned Group Color Spanish", "Assigned Group Color Knights of Columbus"
 * - Liturgical Color [ColorName]: Override default liturgical colors (e.g., "Liturgical Color White")
 *
 * @returns {object} Print configuration object with defaults
 */
function HELPER_readPrintScheduleConfig() {
  const defaults = {
    scheduleTitle: 'Ministry Schedule',
    parishLogoBlob: null,
    parishLogoHeight: 60,
    ministryGroupColors: {}, // Will hold colors for each assigned group
    liturgicalColors: {} // Will hold any liturgical color overrides
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);
    const config = HELPER_readConfig();

    // Read custom schedule title
    if (config['Print Schedule Title']) {
      defaults.scheduleTitle = config['Print Schedule Title'];
    }

    // Read parish logo from Config sheet - use first image found
    try {
      const images = configSheet.getImages();

      if (images.length > 0) {
        // Images in Google Sheets are stored as URLs, not blobs
        // Use getUrl() to get the image URL, then fetch it as a blob
        if (images[0] && typeof images[0].getUrl === 'function') {
          const imageUrl = images[0].getUrl();

          // Fetch the image from the URL and convert to blob
          try {
            const response = UrlFetchApp.fetch(imageUrl);
            defaults.parishLogoBlob = response.getBlob();
            Logger.log(`✓ Found parish logo image in Config sheet (fetched from URL)`);
          } catch (fetchError) {
            Logger.log(`✗ Could not fetch logo from URL: ${fetchError.message}`);
            Logger.log(`  → Image URL: ${imageUrl}`);
          }
        } else {
          Logger.log(`✗ Image object doesn't have getUrl() method`);
          Logger.log('  → The image type may not be compatible with Apps Script API');
        }
      } else {
        Logger.log('⚠ No images found in Config sheet.');
        Logger.log('  → Insert logo: Insert > Image > Image over cells (NOT "Image in cell")');
      }
    } catch (e) {
      Logger.log(`✗ Could not read parish logo: ${e.message}`);
      Logger.log('  → Try re-inserting the logo using Insert > Image > Image over cells');
    }

    // Read parish logo height
    if (config['Parish Logo Height']) {
      const height = parseInt(config['Parish Logo Height']);
      if (!isNaN(height) && height > 0 && height <= 300) {
        defaults.parishLogoHeight = height;
      } else {
        Logger.log(`Warning: Invalid Parish Logo Height: ${config['Parish Logo Height']}. Using default (60px)`);
      }
    }

    // Read assigned group colors
    // Supports both "Assigned Group Color" and "Ministry Sponsor Color" (backward compatible)
    const assignedGroupColorKeys = Object.keys(config).filter(key =>
      key.startsWith('Assigned Group Color ') ||
      key.startsWith('Ministry Sponsor Color ')
    );

    for (const key of assignedGroupColorKeys) {
      let groupName;
      if (key.startsWith('Assigned Group Color ')) {
        groupName = key.replace('Assigned Group Color ', '');
      } else if (key.startsWith('Ministry Sponsor Color ')) {
        groupName = key.replace('Ministry Sponsor Color ', '');
      }

      const colorValue = config[key];
      // Validate hex color format
      if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
        defaults.ministryGroupColors[groupName] = colorValue;
        Logger.log(`Loaded color for group "${groupName}": ${colorValue}`);
      } else {
        Logger.log(`Warning: Invalid color format for ${key}: ${colorValue}`);
      }
    }

    // Read liturgical color overrides
    // Format: "Liturgical Color White" = "#ffffff"
    const liturgicalColorKeys = Object.keys(config).filter(key => key.startsWith('Liturgical Color '));
    for (const key of liturgicalColorKeys) {
      const colorName = key.replace('Liturgical Color ', '');
      const colorValue = config[key];
      if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
        defaults.liturgicalColors[colorName] = colorValue;
        Logger.log(`Loaded liturgical color override for "${colorName}": ${colorValue}`);
      } else {
        Logger.log(`Warning: Invalid color format for ${key}: ${colorValue}`);
      }
    }

    Logger.log(`Print schedule config loaded: ${Object.keys(defaults.ministryGroupColors).length} group colors, ${Object.keys(defaults.liturgicalColors).length} liturgical color overrides`);
    return defaults;

  } catch (e) {
    Logger.log(`Warning: Could not read print schedule config: ${e.message}. Using defaults.`);
    return defaults;
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
 * Liturgical color utilities - UPDATED TO USE CONSOLIDATED COLORS
 * NOTE: HELPER_getLiturgicalColorHex() is now defined in 0_liturgicalcolors.gs
 * The LITURGICAL_COLORS constant is also defined there.
 * This note remains for reference only.
 */

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
 * REPLACEMENT for PRECEDENCE object in 0b_helper.gs
 * This is the master list of all liturgical ranks and their precedence.
 */
const PRECEDENCE = {
  // === Group I ===
  // 1. Paschal Triduum
  'TRIDUUM': 1,
  
  // 2. Nativity, Epiphany, Ascension, Pentecost,
  //    Sundays of Advent, Lent, Easter, Ash Wednesday,
  //    Weekdays of Holy Week, Days in Octave of Easter
  'SOLEMNITY_HIGH': 2.1,   // For Easter, Pentecost, Nativity, Epiphany, Ascension
  'Advent Sunday': 2.2,
  'Lent Sunday': 2.2,
  'Easter Sunday': 2.2,    // Includes Divine Mercy Sunday
  'ASH_WEDNESDAY': 2.3,
  'HOLY_WEEK_WEEKDAY': 2.4,
  'EASTER_OCTAVE_DAY': 2.5,
  
  // 3. Solemnities (General)
  'SOLEMNITY': 3,          // For general Solemnities of Lord, Mary, Saints
  
  // 4. Proper Solemnities (e.g., Patron)
  'PROPER_SOLEMNITY': 4,

  // === Group II ===
  // 5. Feasts of the Lord
  'Feast-Lord': 5,         // For Baptism of the Lord, Transfiguration, etc.
  
  // 6. Sundays of Christmas Time and Ordinary Time
  'Sunday-OT': 6,          // For Ordinary Time & Christmas Time Sundays
  
  // 7. Feasts of Mary and Saints (General)
  'Feast': 7,
  
  // 8. Proper Feasts
  'PROPER_FEAST': 8,
  
  // === Group III ===
  // 9. Weekdays of Advent (Dec 17-24), Lent, & Christmas Octave
  'Weekday-High': 9.1,     // For Lent Weekdays & Advent 17-24
  'CHRISTMAS_OCTAVE_DAY': 9.2, // For days in Christmas Octave
  
  // 10. Obligatory Memorials
  'Memorial': 10,
  
  // 11. Proper Memorials
  'PROPER_MEMORIAL': 11,
  
  // 12. Optional Memorials
  'Optional Memorial': 12,
  
  // 13. Other Weekdays
  'Weekday': 13           // For Advent (before 17th), Christmas (after Octave), Easter (after Octave), Ordinary Time
};

/**
 * Wrapper function to safely get a precedence number
 * This REPLACES the old HELPER_translateRank logic
 *
 * Normalizes rank text from SaintsCalendar to match PRECEDENCE keys
 */
function HELPER_getPrecedence(rankText) {
  // Normalize "Solemnity" to match the PRECEDENCE key 'SOLEMNITY'
  if (rankText === 'Solemnity') {
    return PRECEDENCE['SOLEMNITY'];
  }

  // All other ranks match directly (Memorial, Optional Memorial, Feast, etc.)
  return PRECEDENCE[rankText] || 13; // Default to lowest rank (Weekday)
}

/**
 * NEW FUNCTION: Translates a detailed internal rank key into a
 * simple, user-facing rank for the spreadsheet output.
 * This is called AFTER the precedence logic is finished.
 */
function HELPER_simplifyRank(detailedRank) {
  switch (detailedRank) {
    // Solemnities (Rank 1-4)
    case 'TRIDUUM':
    case 'SOLEMNITY_HIGH':
    case 'SOLEMNITY':
    case 'PROPER_SOLEMNITY':
    case 'EASTER_OCTAVE_DAY': // Days in Easter Octave are treated as Solemnities
      return 'Solemnity';

    // Feasts (Rank 5, 7, 8)
    case 'Feast-Lord':
    case 'Feast':
    case 'PROPER_FEAST':
      return 'Feast';

    // Sundays (Rank 2, 6)
    case 'Advent Sunday':     //
    case 'Lent Sunday':       //
    case 'Easter Sunday':     //
    case 'Sunday-OT':         //
      return 'Sunday'; 

    // Memorials (Rank 10, 11)
    case 'Memorial':
    case 'PROPER_MEMORIAL':
      return 'Memorial';
    
    // Optional Memorials (Rank 12)
    case 'Optional Memorial':
      return 'Optional Memorial';

    // Weekdays (Rank 2.3, 2.4, 9, 13)
    case 'ASH_WEDNESDAY':       //
    case 'HOLY_WEEK_WEEKDAY':   //
    case 'Weekday-High':      //
    case 'Weekday':
    default:
      return 'Weekday';
  }
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
