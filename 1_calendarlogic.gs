/**
 * ====================================================================
 * 1. LITURGICAL CALENDAR LOGIC (THE CONDUCTOR)
 * ====================================================================
 * This file contains all logic for generating the Liturgical Calendar.
 * The main function CALENDAR_generateLiturgicalCalendar() is called
 * by the wrapper function in Code.gs.
 */

/**
 * Main function to generate the liturgical calendar for the year.
 * Writes the results to the 'LiturgicalCalendar' sheet.
 * @returns {string} A success message.
 */
function CALENDAR_generateLiturgicalCalendar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calSheet = ss.getSheetByName(CONSTANTS.SHEETS.CALENDAR);
  // 1. Read all supporting data
  const config = HELPER_readConfig();
  const scheduleYear = config["Year to Schedule"];
  const calendarRegion = config["Calendar Region"];
  
  const overrideData = HELPER_readSheetData(CONSTANTS.SHEETS.OVERRIDES);
  const saintsData = HELPER_readSheetData(CONSTANTS.SHEETS.SAINTS_CALENDAR);
  // 2. Calculate all critical (moveable) feast dates
  // This function is in 1a_CalendarDates.gs
  const dates = CALENDAR_calculateLiturgicalDates(scheduleYear, config);
  // 3. Build lookup maps for overrides and saints
  const overrideMap = CALENDAR_buildOverrideMap(overrideData, scheduleYear);
  const saintMap = CALENDAR_buildSaintMap(saintsData, calendarRegion);
  // 4. --- Main Generation Loop ---
  Logger.log(`Starting calendar generation for ${scheduleYear}...`);
  const newCalendarRows = [];
  const calCols = CONSTANTS.COLS.CALENDAR;
  
  let currentDate = new Date(scheduleYear, 0, 1);
  // Start on Jan 1
  const endDate = new Date(scheduleYear, 11, 31);
  // End on Dec 31
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // 0=Sun, 1=Mon...
    const dayKey = (currentDate.getMonth() + 1) + "/" + currentDate.getDate();
    // "M/D"
    
    // --- A. Check for a manual override ---
    const override = overrideMap.get(dayKey);
    // --- B. Get the seasonal and saint celebrations ---
    
    // This function is in 1b_CalendarSeasons.gs
    // *** THIS IS THE FIX: Added dayOfWeek ***
    const seasonal = CALENDAR_getSeasonalCelebration(currentDate, dayOfWeek, dates);
    const saint = saintMap.get(dayKey);

    // --- C. Get numerical ranks for comparison ---
    // We must translate the text ranks (e.g., "Solemnity") to numbers (e.g., 1)
    const seasonalRankNum = HELPER_translateRank(seasonal.rank);
    const saintRankNum = saint ? HELPER_translateRank(saint.rank) : 99; // 99 = no saint
    
    // --- D. Determine the final celebration (Override > Saint > Seasonal) ---
    let finalCelebration;
    let optionalMemorial = ""; // For the new column
    
    if (override) {
      // 1. Override always wins
      finalCelebration = {
        celebration: override.celebration,
        rank: override.rank,
        color: override.color,
        season: seasonal.season // Use the *actual* season
      };
    } else if (saint && saintRankNum === 4) {
      // 2. SPECIAL CASE: Optional Memorial (rank 4)
      // The seasonal day always wins the main column
      finalCelebration = seasonal;
      optionalMemorial = saint.celebration;
      
    } else if (isSundayInOrdinaryTime(seasonal)) {
      // 3. NEW LOGIC: Handle Sundays in Ordinary Time
      // They outrank Feasts of Saints (Rank 7) but not Feasts of the Lord (Rank 5)
      if (saint && saint.rank === "Feast" && isFeastOfTheLord(saint)) {
        // "Feast of the Lord" (e.g. Transfiguration) wins
        finalCelebration = {
          celebration: saint.celebration,
          rank: saint.rank,
          color: saint.color,
          season: seasonal.season
        };
      } else {
        // The Sunday wins against regular Saint Feasts (like Conversion of St. Paul) or Memorials
        finalCelebration = seasonal;
        // (Note: if the saint was a Memorial, it is suppressed per this logic)
      }
      
    } else if (saint && (saintRankNum < seasonalRankNum)) {
      // 4. Original logic: Saint's rank is higher (lower number)
      finalCelebration = {
        celebration: saint.celebration,
        rank: saint.rank,
        color: saint.color,
        season: seasonal.season // Use the *actual* season
      };
    } else if (saint && seasonal.season === "Lent" && saintRankNum === 3 && seasonalRankNum === 3) {
      // 5. Original logic: Lenten Weekday beats a Memorial
      finalCelebration = seasonal;
    } else {
      // 6. Original logic: Seasonal day wins
      finalCelebration = seasonal;
    }
    
    // --- E. Build the row for the sheet ---
    const newRow = new Array(calCols.COLOR).fill("");
    newRow[calCols.DATE - 1] = new Date(currentDate);
    newRow[calCols.WEEKDAY - 1] = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    newRow[calCols.LITURGICAL_CELEBRATION - 1] = finalCelebration.celebration;
    newRow[calCols.OPTIONAL_MEMORIAL - 1] = optionalMemorial; // Populate new column
    newRow[calCols.SEASON - 1] = finalCelebration.season;
    newRow[calCols.RANK - 1] = finalCelebration.rank; // This will be the text (e.g., "Solemnity")
    newRow[calCols.COLOR - 1] = finalCelebration.color;
    newCalendarRows.push(newRow);
    
    // Go to the next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // 5. --- Write to Sheet ---
  // Clear all content from row 2 down (preserves header/filters)
  if (calSheet.getMaxRows() > 1) {
    calSheet.getRange(2, 1, calSheet.getMaxRows() - 1, calSheet.getMaxColumns()).clearContent();
  }
  
  // Write the new data
  if (newCalendarRows.length > 0) {
    calSheet.getRange(2, 1, newCalendarRows.length, newCalendarRows[0].length).setValues(newCalendarRows);
  }
  
  Logger.log(`Successfully generated ${newCalendarRows.length} days for the ${scheduleYear} calendar.`);
  return `Successfully generated the ${scheduleYear} liturgical calendar.`;
}

/**
 * Builds a Map of manual overrides for the year.
 * @param {Array<Array<any>>} overrideData Data from 'CalendarOverrides' sheet.
 * @param {number} scheduleYear The year being scheduled.
 * @returns {Map<string, object>} A map where key is "M/D"
 * and value is { celebration, rank, color, season }.
 */
function CALENDAR_buildOverrideMap(overrideData, scheduleYear) {
  const map = new Map();
  const overrideCols = CONSTANTS.COLS.OVERRIDES;
  for (const row of overrideData) {
    const month = parseInt(row[overrideCols.MONTH - 1], 10);
    const day = parseInt(row[overrideCols.DAY - 1], 10);
    const celebration = row[overrideCols.LITURGICAL_CELEBRATION - 1];
    const rank = row[overrideCols.RANK - 1];
    const color = row[overrideCols.COLOR - 1];
    let calendar = row[overrideCols.CALENDAR - 1];
    // e.g., "Parish"

    if (!month || !day || !celebration || !rank) continue;
    const key = month + "/" + day;
    
    map.set(key, {
      celebration: celebration,
      rank: rank, // Keep as text
      color: color,
      season: calendar || "Override" // This is used to show *source*
    });
  }
  Logger.log(`Built override map with ${map.size} entries.`);
  return map;
}

/**
 * Builds a Map of all saints and fixed feasts for the year.
 * @param {Array<Array<any>>} saintsData Data from 'SaintsCalendar' sheet.
 * @param {string} calendarRegion The region to filter by (e.g., "USA").
 * @returns {Map<string, object>} A map where key is "M/D"
 * and value is { celebration, rank, color, season: 'Saints' }.
 */
function CALENDAR_buildSaintMap(saintsData, calendarRegion) {
  const map = new Map();
  const saintsCols = CONSTANTS.COLS.SAINTS_CALENDAR;
  for (const row of saintsData) {
    const month = parseInt(row[saintsCols.MONTH - 1], 10);
    const day = parseInt(row[saintsCols.DAY - 1], 10);
    const celebration = row[saintsCols.LITURGICAL_CELEBRATION - 1];
    const rank = row[saintsCols.RANK - 1];
    const color = row[saintsCols.COLOR - 1];
    let calendarName = row[saintsCols.CALENDAR - 1];
    if (!calendarName) calendarName = "General Roman Calendar";
    // Default

    if (!month || !day || !celebration || !rank) continue;
    // Add the saint if they are "General Roman Calendar", match the user's region,
    // or are explicitly for the Parish or Diocese.
    if (calendarName === "General Roman Calendar" || 
        calendarName === calendarRegion || 
        calendarName === "Parish" || 
        calendarName === "Diocese of Sacramento") { // This should be dynamic, but hardcoded for now
      
      const key = month + "/" + day;
      const newSaint = {
        celebration: celebration,
        rank: rank, // Keep as text (e.g., "Solemnity")
        color: color,
        season: "Saints"
      };
      // Check if a saint already exists for this day
      if (map.has(key)) {
        // A saint is already on this day.
        // Compare ranks.
        const existingSaint = map.get(key);
        // New saint's rank is higher (lower number), so it replaces the existing one
        if (HELPER_translateRank(newSaint.rank) < HELPER_translateRank(existingSaint.rank)) {
          map.set(key, newSaint);
        }
      } else {
        map.set(key, newSaint);
      }
    }
  }
  Logger.log(`Built saints map with ${map.size} entries for region: ${calendarRegion}.`);
  return map;
}

/**
 * Determines if the seasonal celebration is a Sunday in Ordinary Time.
 * @param {object} seasonal The seasonal celebration object.
 * @returns {boolean} True if it's a Sunday in Ordinary Time.
 */
function isSundayInOrdinaryTime(seasonal) {
  return seasonal.season === "Ordinary Time" && 
         seasonal.celebration.includes("Sunday in Ordinary Time") &&
         seasonal.rank === "Sunday"; // <-- Bug Fix: Was "Feast"
}

/**
 * Determines if a saint celebration is a "Feast of the Lord" that can override Sundays.
 * These are the only saint celebrations that can override Sundays in Ordinary Time.
 * @param {object} saint The saint celebration object.
 * @returns {boolean} True if it'static feast of the Lord that can override Sundays.
 */
function isFeastOfTheLord(saint) {
  // List of feasts of the Lord that CAN override Sundays in Ordinary Time
  const feastsOfTheLord = [
    "The Presentation of the Lord", // Feb 2
    "The Transfiguration of the Lord", // Aug 6
    "The Exaltation of the Holy Cross", // Sep 14
    "The Dedication of the Lateran Basilica" // Nov 9
  ];
  return feastsOfTheLord.includes(saint.celebration);
}
