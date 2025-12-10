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
 * - Parish Logo URL: Direct URL to parish logo (Google Drive sharing URLs auto-converted)
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
    parishLogoUrl: null,
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

    // Read parish logo URL from Config
    if (config['Parish Logo URL']) {
      let logoUrl = config['Parish Logo URL'];

      // Convert Google Drive sharing URLs to direct image URLs
      // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
      // Convert to: https://drive.google.com/uc?export=view&id=FILE_ID
      if (logoUrl.includes('drive.google.com/file/d/')) {
        const match = logoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const fileId = match[1];
          logoUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
          Logger.log(`✓ Converted Google Drive sharing URL to direct URL`);
        }
      }

      defaults.parishLogoUrl = logoUrl;
      Logger.log(`✓ Found parish logo URL in Config`);
    } else {
      Logger.log('⚠ No Parish Logo URL configured');
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
 * PERFORMANCE: Removed verbose logging (was generating thousands of log lines)
 */
function HELPER_calculateVolunteerScore(volunteer, roleToFill, eventId, assignmentCounts, massAssignments, volunteers, date, timeoffMaps) {
  let score = 100; // Base score
  const counts = assignmentCounts.get(volunteer.id) || { total: 0, recent: new Date(0), byEventId: {} };
  const roleLower = roleToFill.toLowerCase();

  // Frequency penalty: -25 points per previous assignment
  // Stronger penalty ensures better rotation (max 2 assignments per volunteer per month)
  const frequencyPenalty = counts.total * 25;
  score -= frequencyPenalty;

  // Mass preference bonus with rotation: favor least-used preferred masses
  if (eventId && volunteer.massPrefs.includes(eventId)) {
    // Base bonus for preferred mass
    let massBonus = 20;

    // Rotation logic: reduce bonus for frequently-used preferred masses
    if (counts.byEventId && counts.byEventId[eventId]) {
      const timesAtThisMass = counts.byEventId[eventId];
      const rotationPenalty = timesAtThisMass * 3; // -3 per previous assignment to this mass
      massBonus = Math.max(5, massBonus - rotationPenalty); // Min 5 points, max 20
    }

    score += massBonus;
  }

  // Role preference bonus: +15 points if volunteer prefers this role
  if (volunteer.rolePrefs.includes(roleLower)) {
    score += 15;
  }

  // Family team bonus: +25 points if family member already assigned to this Mass
  if (volunteer.familyTeam && massAssignments) {
    for (const [assignedVolId, assignedRole] of massAssignments) {
      const assignedVol = volunteers.get(assignedVolId);
      if (assignedVol && assignedVol.familyTeam === volunteer.familyTeam) {
        score += 25;
        break;
      }
    }
  }

  // Limited availability bonus: +15 points if volunteer is on whitelist for this date
  // This prioritizes volunteers who said "I can ONLY serve these dates"
  // Rationale: If they have limited availability, use them when they're available!
  if (timeoffMaps && timeoffMaps.whitelist && date) {
    if (timeoffMaps.whitelist.has(volunteer.name)) {
      const whitelistMap = timeoffMaps.whitelist.get(volunteer.name);
      const dateString = date.toDateString();
      if (whitelistMap.has(dateString)) {
        score += 15;
      }
    }
  }

  // Flexibility bonus: +3 points for volunteers with no preferences (easy to schedule)
  if (volunteer.massPrefs.length === 0 && volunteer.rolePrefs.length === 0) {
    score += 3;
  }

  // Spacing penalty: discourage consecutive week assignments
  // Prefer volunteers who haven't served recently for better temporal distribution
  if (date && counts.recent && counts.recent.getTime() > 0) {
    const daysSinceLastAssignment = Math.floor((date.getTime() - counts.recent.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastAssignment < 7) {
      score -= 30; // Strong penalty for same/next week (0-6 days)
    } else if (daysSinceLastAssignment < 14) {
      score -= 15; // Mild penalty for 1-2 weeks (7-13 days)
    }
    // No penalty for 14+ days (2+ weeks gap) - preferred spacing
  }

  // Random tiebreaker: ±3 points to introduce variety between runs
  // Ensures similar volunteers rotate naturally without overriding strong preferences
  // Range is small enough to not override:
  //   - Family bonus (+25), Mass preference (+20), Role preference (+15)
  //   - But large enough to create natural rotation among similarly-qualified volunteers
  const randomTiebreaker = (Math.random() * 6) - 3; // Range: -3 to +3
  score += randomTiebreaker;

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

/**
 * ====================================================================
 * TIMEOFF HELPER FUNCTIONS
 * ====================================================================
 * Functions to support enhanced timeoff request processing
 */

/**
 * Parse whitelist notes to extract Event IDs and dates
 * Supports hybrid format: "SUN-1000, SAT-1700, 12/25/2025, 1/1/2026"
 *
 * @param {string} notesField - Comma-separated Event IDs and/or dates
 * @returns {object} { eventIds: [], dates: [], invalid: [] }
 */
function HELPER_parseWhitelistNotes(notesField) {
  const result = {
    eventIds: [],
    dates: [],
    invalid: []
  };

  if (!notesField || notesField.trim() === '') {
    return result;
  }

  // Split by comma and process each item
  const items = notesField.split(',').map(s => s.trim()).filter(s => s.length > 0);

  for (const item of items) {
    // Pattern 1: Event ID (e.g., SUN-1000, SAT-1700, FRI-0700)
    // Format: 3+ letters, hyphen, 4 digits
    const eventIdPattern = /^[A-Z]{3,}-\d{4}$/i;

    if (eventIdPattern.test(item)) {
      result.eventIds.push(item.toUpperCase());
      continue;
    }

    // Pattern 2: Date (try to parse as date)
    const parsedDate = new Date(item);

    if (!isNaN(parsedDate.getTime())) {
      // Valid date - set to noon to avoid timezone issues
      const safeDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 12, 0, 0);
      result.dates.push(safeDate);
      continue;
    }

    // If neither pattern matches, mark as invalid
    result.invalid.push(item);
  }

  Logger.log(`Parsed whitelist notes: ${result.eventIds.length} Event IDs, ${result.dates.length} dates, ${result.invalid.length} invalid`);

  return result;
}

/**
 * Parse date-based Notes field from timeoff form checkboxes.
 * NEW system: Notes contain dates like "1/5/2026, 1/4/2026 (Vigil), 1/12/2026"
 * @param {string} notesField - Notes field content
 * @returns {Array<object>} Array of {dateString, isVigil} objects
 */
function HELPER_parseDateBasedNotes(notesField) {
  const result = [];

  if (!notesField || notesField.trim() === '') {
    return result;
  }

  // Split by comma and process each item
  const items = notesField.split(',').map(s => s.trim()).filter(s => s.length > 0);

  for (const item of items) {
    // Check if this is a vigil mass
    const isVigil = item.toLowerCase().includes('(vigil)');

    // Extract date (remove "(Vigil)" if present)
    const dateStr = item.replace(/\s*\(vigil\)/i, '').trim();

    // Try to parse the date
    const parsedDate = new Date(dateStr);

    if (!isNaN(parsedDate.getTime())) {
      // Valid date - set to noon to avoid timezone issues
      const safeDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 12, 0, 0);

      result.push({
        date: safeDate,
        dateString: safeDate.toDateString(),  // For Map keys
        isVigil: isVigil,
        original: item  // Keep original for debugging
      });
    } else {
      Logger.log(`WARNING: Could not parse date from: "${item}"`);
    }
  }

  Logger.log(`Parsed ${result.length} dates from notes`);
  return result;
}

/**
 * Validate that Event IDs exist in mass configuration sheets
 * Checks WeeklyMasses, MonthlyMasses, and YearlyMasses
 *
 * @param {Array<string>} eventIdArray - Array of Event IDs to validate
 * @returns {object} { valid: [], invalid: [] }
 */
function HELPER_validateEventIds(eventIdArray) {
  const result = {
    valid: [],
    invalid: []
  };

  if (!eventIdArray || eventIdArray.length === 0) {
    return result;
  }

  try {
    // Build set of all valid Event IDs from all three mass configuration sheets
    const validEventIds = new Set();

    // Weekly Masses
    const weeklyData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.WEEKLY_MASSES);
    const weeklyCols = CONSTANTS.COLS.WEEKLY_MASSES;
    for (const row of weeklyData) {
      const eventId = HELPER_safeArrayAccess(row, weeklyCols.EVENT_ID - 1);
      if (eventId) validEventIds.add(eventId.toUpperCase());
    }

    // Monthly Masses
    const monthlyData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MONTHLY_MASSES);
    const monthlyCols = CONSTANTS.COLS.MONTHLY_MASSES;
    for (const row of monthlyData) {
      const eventId = HELPER_safeArrayAccess(row, monthlyCols.EVENT_ID - 1);
      if (eventId) validEventIds.add(eventId.toUpperCase());
    }

    // Yearly Masses
    const yearlyData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.YEARLY_MASSES);
    const yearlyCols = CONSTANTS.COLS.YEARLY_MASSES;
    for (const row of yearlyData) {
      const eventId = HELPER_safeArrayAccess(row, yearlyCols.EVENT_ID - 1);
      if (eventId) validEventIds.add(eventId.toUpperCase());
    }

    Logger.log(`Found ${validEventIds.size} valid Event IDs in mass configuration`);

    // Validate each Event ID
    for (const eventId of eventIdArray) {
      const upperEventId = eventId.toUpperCase();
      if (validEventIds.has(upperEventId)) {
        result.valid.push(upperEventId);
      } else {
        result.invalid.push(eventId);
      }
    }

  } catch (e) {
    Logger.log(`ERROR validating Event IDs: ${e.message}`);
    // If we can't read mass config, mark all as invalid
    result.invalid = eventIdArray;
  }

  Logger.log(`Event ID validation: ${result.valid.length} valid, ${result.invalid.length} invalid`);

  return result;
}

/**
 * ====================================================================
 * NOTIFICATION HELPER FUNCTIONS
 * ====================================================================
 * Standardized notification patterns for consistent user experience
 */

/**
 * Show a standardized alert/info dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message (supports line breaks with \n)
 * @param {string} type - Optional type: 'info', 'success', 'warning', 'error' (default: 'info')
 * @returns {void}
 */
function HELPER_showAlert(title, message, type = 'info') {
  const ui = SpreadsheetApp.getUi();

  // Add emoji prefix based on type for visual clarity
  const prefixes = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  };

  const prefix = prefixes[type] || prefixes['info'];
  const formattedTitle = `${prefix} ${title}`;

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}

/**
 * Show a standardized confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {object} options - Optional configuration
 *   - type: 'warning', 'info', 'danger' (default: 'warning')
 *   - confirmText: Custom text for yes button (default: 'Yes')
 *   - cancelText: Custom text for no button (default: 'No')
 * @returns {boolean} true if user confirmed, false if canceled
 */
function HELPER_confirmAction(title, message, options = {}) {
  const ui = SpreadsheetApp.getUi();

  // Default options
  const type = options.type || 'warning';
  const confirmText = options.confirmText || 'Yes';
  const cancelText = options.cancelText || 'No';

  // Add emoji prefix based on type
  const prefixes = {
    'warning': '⚠️',
    'info': 'ℹ️',
    'danger': '🛑'
  };

  const prefix = prefixes[type] || prefixes['warning'];
  const formattedTitle = `${prefix} ${title}`;

  // Add instruction text at bottom
  const instruction = `\n────────────────────────────\nClick "${confirmText}" to proceed or "${cancelText}" to cancel.`;
  const formattedMessage = message + instruction;

  const response = ui.alert(formattedTitle, formattedMessage, ui.ButtonSet.YES_NO);

  return response === ui.Button.YES;
}

/**
 * Show a standardized user input prompt
 * @param {string} title - Dialog title
 * @param {string} message - Prompt message
 * @param {object} options - Optional configuration
 *   - defaultValue: Pre-filled default value
 *   - required: If true, rejects empty input (default: false)
 *   - validator: Function to validate input, returns {valid: boolean, error: string}
 * @returns {object} {success: boolean, value: string, cancelled: boolean}
 */
function HELPER_promptUser(title, message, options = {}) {
  const ui = SpreadsheetApp.getUi();

  const defaultValue = options.defaultValue || '';
  const required = options.required || false;
  const validator = options.validator || null;

  const formattedTitle = `📝 ${title}`;

  while (true) {
    const response = ui.prompt(formattedTitle, message, ui.ButtonSet.OK_CANCEL);

    // User cancelled
    if (response.getSelectedButton() !== ui.Button.OK) {
      return { success: false, value: '', cancelled: true };
    }

    const value = response.getResponseText().trim();

    // Check if required and empty
    if (required && value === '') {
      ui.alert('⚠️ Input Required', 'This field cannot be empty. Please enter a value.', ui.ButtonSet.OK);
      continue;
    }

    // Run custom validator if provided
    if (validator && value !== '') {
      const validation = validator(value);
      if (!validation.valid) {
        ui.alert('⚠️ Invalid Input', validation.error, ui.ButtonSet.OK);
        continue;
      }
    }

    return { success: true, value: value, cancelled: false };
  }
}

/**
 * Show a standardized error dialog with troubleshooting hints
 * @param {string} title - Error title
 * @param {string} error - Error message or Error object
 * @param {string} context - Context for troubleshooting hints (optional)
 *   - 'calendar', 'validation', 'schedule', 'assignment', 'timeoffs', 'print', 'form', 'archive'
 * @returns {void}
 */
function HELPER_showError(title, error, context = null) {
  const ui = SpreadsheetApp.getUi();

  // Extract error message from Error object if needed
  const errorMessage = (error instanceof Error) ? error.message : String(error);

  // Build troubleshooting hints based on context
  const hints = HELPER_getErrorTroubleshootingHints(context, errorMessage);

  const formattedTitle = `❌ ${title}`;

  let message = errorMessage;

  if (hints && hints.length > 0) {
    message += '\n\n📋 Troubleshooting Tips:\n';
    message += hints.map((hint, i) => `${i + 1}. ${hint}`).join('\n');
  }

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}

/**
 * Show a standardized success dialog
 * @param {string} title - Success title
 * @param {string} message - Success message
 * @param {object} options - Optional configuration
 *   - autoClose: Not supported in Apps Script, included for API consistency
 *   - showStats: If true and message contains numbers, formats nicely (default: false)
 * @returns {void}
 */
function HELPER_showSuccess(title, message, options = {}) {
  const ui = SpreadsheetApp.getUi();

  const formattedTitle = `✅ ${title}`;

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}

/**
 * Get context-specific troubleshooting hints for error messages
 * @param {string} context - Error context
 * @param {string} errorMessage - The error message
 * @returns {Array<string>} Array of troubleshooting hints
 */
function HELPER_getErrorTroubleshootingHints(context, errorMessage) {
  const hints = [];

  // Common hints based on error message patterns
  if (errorMessage.toLowerCase().includes('sheet') && errorMessage.toLowerCase().includes('not found')) {
    hints.push('Verify all required sheets exist in your spreadsheet');
    hints.push('Check sheet names match exactly (case-sensitive)');
  }

  if (errorMessage.toLowerCase().includes('config')) {
    hints.push('Check the Config sheet has all required settings');
    hints.push('Ensure "Year to Schedule" is set to a valid year (2020-2050)');
  }

  // Context-specific hints
  switch (context) {
    case 'calendar':
      hints.push('Run Admin Tools → Validate Data to check for configuration issues');
      hints.push('Verify the SaintsCalendar sheet has data for your calendar region');
      hints.push('Check that "Year to Schedule" in Config is set correctly');
      break;

    case 'validation':
      hints.push('Review the validation errors listed above');
      hints.push('Fix errors (❌) before warnings (⚠️) for best results');
      hints.push('Check the CLAUDE.md file for data requirements');
      break;

    case 'schedule':
      hints.push('Verify you have generated the liturgical calendar first');
      hints.push('Check that MassTemplates exist and have valid roles');
      hints.push('Ensure WeeklyMasses, MonthlyMasses, or YearlyMasses have entries');
      hints.push('Run Admin Tools → Validate Data to check mass configuration');
      break;

    case 'assignment':
      hints.push('Check that you have Active volunteers with the required ministry roles');
      hints.push('Verify the Ministries sheet has all roles used in your templates');
      hints.push('Generate the schedule for this month before assigning volunteers');
      hints.push('Run Admin Tools → Validate Data to check volunteer configuration');
      break;

    case 'timeoffs':
      hints.push('Verify the volunteer name matches exactly with the Volunteers sheet');
      hints.push('Check that dates are in the correct format');
      hints.push('Ensure the Timeoffs sheet has the correct column structure');
      hints.push('Review the timeoff type: "I CANNOT serve" vs "I can ONLY serve"');
      break;

    case 'print':
      hints.push('Ensure you have generated assignments for this month');
      hints.push('Check that the liturgical calendar exists for this date range');
      hints.push('Verify the Config sheet has Parish Name configured');
      break;

    case 'form':
      hints.push('Check that the Google Form is properly linked to the Timeoffs sheet');
      hints.push('Verify you have edit permissions for the form');
      hints.push('Ensure the form has the correct question structure');
      break;

    case 'archive':
      hints.push('Verify you have completed schedules to archive');
      hints.push('Check that you have permissions to create new files in Google Drive');
      hints.push('Ensure the source sheet has data in the expected format');
      break;
  }

  return hints;
}

/**
 * Show a multi-line validation report dialog
 * Specifically designed for displaying validation results with proper formatting
 * @param {string} title - Report title
 * @param {Array<object>} items - Array of validation items {type: 'error'|'warning'|'info', message: string}
 * @param {object} summary - Optional summary stats {errors: number, warnings: number}
 * @returns {void}
 */
function HELPER_showValidationReport(title, items, summary = null) {
  const ui = SpreadsheetApp.getUi();

  let message = '';

  // Add summary at top if provided
  if (summary) {
    const emoji = summary.errors > 0 ? '❌' : (summary.warnings > 0 ? '⚠️' : '✅');
    message += `${emoji} Validation Results:\n`;
    message += `Errors: ${summary.errors || 0} | Warnings: ${summary.warnings || 0}\n\n`;
  }

  // Group items by type
  const errors = items.filter(item => item.type === 'error');
  const warnings = items.filter(item => item.type === 'warning');
  const infos = items.filter(item => item.type === 'info');

  // Add errors
  if (errors.length > 0) {
    message += '❌ ERRORS (must fix):\n';
    errors.forEach((item, i) => {
      message += `${i + 1}. ${item.message}\n`;
    });
    message += '\n';
  }

  // Add warnings
  if (warnings.length > 0) {
    message += '⚠️ WARNINGS (recommended to fix):\n';
    warnings.forEach((item, i) => {
      message += `${i + 1}. ${item.message}\n`;
    });
    message += '\n';
  }

  // Add info items
  if (infos.length > 0) {
    message += 'ℹ️ INFO:\n';
    infos.forEach((item, i) => {
      message += `${i + 1}. ${item.message}\n`;
    });
  }

  // If no items, show success
  if (items.length === 0) {
    message = '✅ All validation checks passed!\n\nYour data is configured correctly and ready to use.';
  }

  const formattedTitle = summary && summary.errors > 0 ? `❌ ${title}` :
                        summary && summary.warnings > 0 ? `⚠️ ${title}` :
                        `✅ ${title}`;

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}
