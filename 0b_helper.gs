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
