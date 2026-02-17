/**
 * ====================================================================
 * HELPER FUNCTIONS - FORMATTING & DISPLAY UTILITIES
 * ====================================================================
 *
 * PURPOSE:
 * Provides date/time formatting, liturgical utilities, precedence logic,
 * and week calculation functions. These transform data into user-friendly
 * display formats.
 *
 * FUNCTIONS IN THIS FILE:
 * - Date/time formatting (formatDate, formatTime, getOrdinal, etc.)
 * - Liturgical precedence logic (PRECEDENCE constant, getPrecedence, simplifyRank)
 * - Week calculation utilities (getCurrentWeekBounds, getWeekString, etc.)
 * - Print schedule data builders (buildLiturgicalData)
 *
 * DEPENDENCIES:
 * - 0a_constants.gs (CONSTANTS object)
 * - 0b1_helper_data.gs (readSheetDataCached)
 * - 0b5_helper_misc.gs (safeArrayAccess) - minimal
 *
 * USED BY:
 * - 1_calendarlogic.gs (liturgical precedence)
 * - 5_printschedule.gs (formatting for print)
 * - 6_publicschedule.gs (weekly views)
 * - All modules (date/time display)
 *
 * DECISION TREE - Add new functions here if they:
 * ✅ Format dates, times, or numbers for display
 * ✅ Calculate liturgical precedence or ranks
 * ✅ Calculate week boundaries or date ranges
 * ✅ Build liturgical data for display
 * ❌ Read sheet data → Use 0b1_helper_data.gs
 * ❌ Validate volunteers/ministries → Use 0b2_helper_ministry.gs
 * ❌ Show user dialogs → Use 0b4_helper_ui.gs
 *
 * LOADING ORDER: Third helper file (loads after 0b1, 0b2)
 * ====================================================================
 */

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
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} n - The number
 * @returns {string} The number with its ordinal suffix
 */
function HELPER_getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Calculate which occurrence of a weekday this date is within its month.
 * For example, if date is the 2nd Tuesday of the month, returns 2.
 * @param {Date} date - The date to check
 * @returns {number} The occurrence number (1-5)
 */
function HELPER_getWeekdayOccurrenceInMonth(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 0;
  }

  // Find the first occurrence of this weekday in the month
  const dayOfWeek = date.getDay();
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOfWeek = firstOfMonth.getDay();

  // Calculate day of first occurrence of this weekday
  let firstOccurrence = dayOfWeek - firstDayOfWeek + 1;
  if (firstOccurrence <= 0) firstOccurrence += 7;

  // Calculate which occurrence this is
  return Math.floor((date.getDate() - firstOccurrence) / 7) + 1;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
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
 * Get the previous Sunday for a given date
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
 * PRECEDENCE - Master list of liturgical ranks
 * This is the single source of truth for liturgical precedence.
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
 * Get precedence number for a rank text
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
 * Simplify internal rank keys to user-facing rank names
 * Called AFTER precedence logic is finished for spreadsheet output
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
    case 'Advent Sunday':
    case 'Lent Sunday':
    case 'Easter Sunday':
    case 'Sunday-OT':
      return 'Sunday';

    // Memorials (Rank 10, 11)
    case 'Memorial':
    case 'PROPER_MEMORIAL':
      return 'Memorial';

    // Optional Memorials (Rank 12)
    case 'Optional Memorial':
      return 'Optional Memorial';

    // Weekdays (Rank 2.3, 2.4, 9, 13)
    case 'ASH_WEDNESDAY':
    case 'HOLY_WEEK_WEEKDAY':
    case 'Weekday-High':
    case 'Weekday':
    default:
      return 'Weekday';
  }
}

/**
 * Build liturgical data for print functions
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
 * Calculate current week boundaries (Monday-Sunday)
 * @param {Date} referenceDate - Reference date (default: today)
 * @returns {object} { startDate, endDate, weekString }
 */
function HELPER_getCurrentWeekBounds(referenceDate = new Date()) {
  try {
    // Clone the date to avoid modifying the original
    const date = new Date(referenceDate.getTime());

    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = date.getDay();

    // Calculate days back to Monday (start of week)
    // If Sunday (0), go back 6 days to previous Monday
    // If Monday (1), go back 0 days
    // If Tuesday (2), go back 1 day, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Calculate week start (Monday at midnight)
    const weekStart = new Date(date.getTime());
    weekStart.setDate(date.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);

    // Calculate week end (Sunday at 11:59:59 PM)
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Generate week string
    const weekString = HELPER_getWeekString(weekStart, weekEnd);

    return {
      startDate: weekStart,
      endDate: weekEnd,
      weekString: weekString
    };
  } catch (e) {
    Logger.log(`ERROR in HELPER_getCurrentWeekBounds: ${e.message}`);
    throw new Error(`Could not calculate week boundaries: ${e.message}`);
  }
}

/**
 * Format week range for display.
 * Handles weeks that span multiple months or years.
 *
 * @param {Date} startDate - Monday of the week (start)
 * @param {Date} endDate - Sunday of the week (end)
 * @returns {string} Formatted week string
 */
function HELPER_getWeekString(startDate, endDate) {
  try {
    const startMonth = startDate.getMonth();
    const endMonth = endDate.getMonth();
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Same month and year: "Week of January 5-11, 2026"
    if (startMonth === endMonth && startYear === endYear) {
      return `Week of ${monthNames[startMonth]} ${startDate.getDate()}-${endDate.getDate()}, ${startYear}`;
    }

    // Different months (and possibly years): "Week of December 29, 2025 - January 4, 2026"
    return `Week of ${monthNames[startMonth]} ${startDate.getDate()}, ${startYear} - ${monthNames[endMonth]} ${endDate.getDate()}, ${endYear}`;

  } catch (e) {
    Logger.log(`ERROR in HELPER_getWeekString: ${e.message}`);
    return 'Week of [Error]';
  }
}

/**
 * Check if a date falls within a week range (inclusive).
 *
 * @param {Date} dateToCheck - Date to test
 * @param {Date} weekStart - Start of week (Monday)
 * @param {Date} weekEnd - End of week (Sunday)
 * @returns {boolean} True if date is within the week
 */
function HELPER_isDateInWeek(dateToCheck, weekStart, weekEnd) {
  try {
    // Normalize all dates to midnight for comparison
    const checkDate = new Date(dateToCheck.getFullYear(), dateToCheck.getMonth(), dateToCheck.getDate());
    const startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    const endDate = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());

    return checkDate >= startDate && checkDate <= endDate;
  } catch (e) {
    Logger.log(`ERROR in HELPER_isDateInWeek: ${e.message}`);
    return false;
  }
}

/**
 * Calculate date range for multi-week views.
 * Supports "current", "next", "2weeks", "3weeks", "4weeks".
 *
 * @param {string} weekRange - Range specification ('current', 'next', '2weeks', '3weeks', '4weeks')
 * @param {Date} referenceDate - Reference date (default: today)
 * @returns {object} { startDate, endDate, weekString }
 */
function HELPER_getWeekRangeBounds(weekRange = 'current', referenceDate = new Date()) {
  try {
    // Get base week bounds
    const baseWeek = HELPER_getCurrentWeekBounds(referenceDate);
    let startDate = new Date(baseWeek.startDate.getTime());
    let endDate = new Date(baseWeek.endDate.getTime());

    // Adjust based on range type
    switch (weekRange) {
      case 'current':
        // Use base week as-is
        break;

      case 'next':
        // Shift to next week
        startDate.setDate(startDate.getDate() + 7);
        endDate.setDate(endDate.getDate() + 7);
        break;

      case '2weeks':
        // Current week + next week (14 days total)
        endDate.setDate(endDate.getDate() + 7);
        break;

      case '3weeks':
        // Next 3 weeks (21 days total)
        endDate.setDate(endDate.getDate() + 14);
        break;

      case '4weeks':
        // Next 4 weeks (28 days total)
        endDate.setDate(endDate.getDate() + 21);
        break;

      default:
        Logger.log(`Unknown week range: ${weekRange}, using current week`);
    }

    // Generate appropriate week string
    let weekString;
    if (weekRange === 'current' || weekRange === 'next') {
      weekString = HELPER_getWeekString(startDate, endDate);
    } else {
      // Multi-week: "Weeks of January 5 - January 25, 2026"
      const startMonth = startDate.getMonth();
      const endMonth = endDate.getMonth();
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      if (startMonth === endMonth && startYear === endYear) {
        // Same month: "Weeks of January 5-25, 2026"
        weekString = `Weeks of ${monthNames[startMonth]} ${startDate.getDate()}-${endDate.getDate()}, ${startYear}`;
      } else if (startYear === endYear) {
        // Different months, same year: "Weeks of December 29 - January 11, 2026"
        weekString = `Weeks of ${monthNames[startMonth]} ${startDate.getDate()} - ${monthNames[endMonth]} ${endDate.getDate()}, ${startYear}`;
      } else {
        // Different years: "Weeks of December 29, 2025 - January 11, 2026"
        weekString = `Weeks of ${monthNames[startMonth]} ${startDate.getDate()}, ${startYear} - ${monthNames[endMonth]} ${endDate.getDate()}, ${endYear}`;
      }
    }

    return {
      startDate: startDate,
      endDate: endDate,
      weekString: weekString
    };

  } catch (e) {
    Logger.log(`ERROR in HELPER_getWeekRangeBounds: ${e.message}`);
    throw new Error(`Could not calculate week range boundaries: ${e.message}`);
  }
}

/**
 * Calculate "upcoming week" bounds for Monday email workflow.
 * Smart logic based on current day:
 * - Monday-Wednesday: Show current week
 * - Thursday-Sunday: Show next week
 *
 * @param {Date} referenceDate - Reference date (default: today)
 * @returns {object} { startDate, endDate, weekString }
 */
function HELPER_getUpcomingWeekBounds(referenceDate = new Date()) {
  try {
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = referenceDate.getDay();

    // Determine which week to show
    // Monday (1), Tuesday (2), Wednesday (3) → current week
    // Sunday (0), Thursday (4), Friday (5), Saturday (6) → next week
    const useNextWeek = dayOfWeek === 0 || (dayOfWeek >= 4 && dayOfWeek <= 6);

    if (useNextWeek) {
      // Calculate next week (7 days from today, then get that week's bounds)
      const nextWeekDate = new Date(referenceDate.getTime());
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      Logger.log(`Smart upcoming week: Today is ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}, showing next week`);
      return HELPER_getCurrentWeekBounds(nextWeekDate);
    } else {
      // Use current week
      Logger.log(`Smart upcoming week: Today is ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}, showing current week`);
      return HELPER_getCurrentWeekBounds(referenceDate);
    }

  } catch (e) {
    Logger.log(`ERROR in HELPER_getUpcomingWeekBounds: ${e.message}`);
    throw new Error(`Could not calculate upcoming week boundaries: ${e.message}`);
  }
}
