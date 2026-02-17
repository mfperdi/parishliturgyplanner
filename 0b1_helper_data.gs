/**
 * ====================================================================
 * HELPER FUNCTIONS - DATA READING & CACHING
 * ====================================================================
 *
 * PURPOSE:
 * Provides data reading, caching, and configuration management for the
 * entire application. This is the foundational data layer.
 *
 * FUNCTIONS IN THIS FILE:
 * - Sheet data reading (cached and non-cached)
 * - Configuration reading and validation
 * - Print schedule configuration
 * - Cache management
 * - Month/year normalization
 *
 * DEPENDENCIES:
 * - 0a_constants.gs (CONSTANTS object)
 * - Google Sheets API (SpreadsheetApp)
 *
 * USED BY:
 * - All other helper modules (0b2-0b5)
 * - All application modules (1_*, 2_*, 3_*, etc.)
 *
 * DECISION TREE - Add new functions here if they:
 * ✅ Read data from Google Sheets
 * ✅ Cache sheet data
 * ✅ Read/validate configuration
 * ✅ Parse or normalize data formats
 * ❌ Validate volunteers/ministries → Use 0b2_helper_ministry.gs
 * ❌ Format for display → Use 0b3_helper_formatting.gs
 * ❌ Show user dialogs → Use 0b4_helper_ui.gs
 *
 * LOADING ORDER: First helper file (loads after 0a_constants.gs)
 * ====================================================================
 */

/**
 * Enhanced data reading with caching and error handling
 */
const SHEET_CACHE = new Map();
// Note: Cache expiry is defined in CONSTANTS.CACHE.EXPIRY_MS but we keep a local
// constant here for initialization order (CONSTANTS may not be loaded yet)

function HELPER_readSheetDataCached(sheetName, useCache = true) {
  const now = new Date().getTime();
  const cacheExpiry = CONSTANTS.CACHE ? CONSTANTS.CACHE.EXPIRY_MS : (5 * 60 * 1000);

  if (useCache && SHEET_CACHE.has(sheetName)) {
    const cached = SHEET_CACHE.get(sheetName);
    if (now - cached.timestamp < cacheExpiry) {
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
 * Clear the sheet data cache
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
 * Normalize month-year values to YYYY-MM format
 * Handles Date objects, strings, and various date-like formats
 * @param {Date|string|object} monthYearValue - The value to normalize
 * @returns {string} Normalized YYYY-MM string or empty string if invalid
 */
function HELPER_normalizeMonthYear(monthYearValue) {
  if (!monthYearValue) {
    return "";
  }

  // If it's already a string in "YYYY-MM" format, return it
  if (typeof monthYearValue === 'string') {
    // Check if it matches YYYY-MM pattern
    if (/^\d{4}-\d{2}$/.test(monthYearValue)) {
      return monthYearValue;
    }
    // Try to parse it as a date
    const parsed = new Date(monthYearValue);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
      return `${year}-${month}`;
    }
    return "";
  }

  // If it's a Date object (from Google Sheets auto-formatting)
  if (monthYearValue instanceof Date && !isNaN(monthYearValue.getTime())) {
    const year = monthYearValue.getFullYear();
    const month = (monthYearValue.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  // If it's an object with getTime() method (Date-like)
  if (monthYearValue.getTime && typeof monthYearValue.getTime === 'function') {
    try {
      const timestamp = monthYearValue.getTime();
      if (!isNaN(timestamp)) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
      }
    } catch (e) {
      Logger.log(`HELPER_normalizeMonthYear: Could not convert object to date: ${e.message}`);
    }
  }

  return "";
}
