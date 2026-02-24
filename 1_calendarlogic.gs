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
  const diocese = config["Diocese"]; // Optional diocese-specific calendar (e.g., "Diocese of Sacramento")

  const litRefData = HELPER_readSheetData(CONSTANTS.SHEETS.LITURGICAL_REFERENCE);
  // 2. Calculate all critical (moveable) feast dates
  // This function is in 1a_CalendarDates.gs
  const dates = CALENDAR_calculateLiturgicalDates(scheduleYear, config);
  // 3. Build lookup map from consolidated LiturgicalReference sheet
  const litRefMap = CALENDAR_buildLiturgicalReferenceMap(litRefData, calendarRegion, diocese);
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
    
    // --- A. Get the seasonal celebration and any reference entry for this date ---
    // This function is in 1b_CalendarSeasons.gs
    const seasonal = CALENDAR_getSeasonalCelebration(currentDate, dayOfWeek, dates);
    const ref = litRefMap.get(dayKey);

    // --- B. Determine the final celebration via precedence (ref vs. seasonal) ---
    // All entries in LiturgicalReference go through normal precedence comparison.

    let finalCelebration;
    let optionalMemorial = ""; // For the Optional Memorial column

    // SPECIAL HANDLING: Optional Memorials ALWAYS go to separate column
    if (ref && ref.rank === 'Optional Memorial') {
      finalCelebration = seasonal;
      optionalMemorial = ref.celebration;
    } else {
      const seasonalPrecedence = HELPER_getPrecedence(seasonal.rank);
      const refPrecedence = ref ? HELPER_getPrecedence(ref.rank) : 99; // 99 = no entry

      // The core logic: lower number wins.
      if (ref && refPrecedence < seasonalPrecedence) {
        finalCelebration = {
          celebration: ref.celebration,
          rank: ref.rank,
          color: ref.color,
          season: seasonal.season // Always use the actual liturgical season
        };
      } else {
        finalCelebration = seasonal;
      }
    }
    
    // --- E. Build the row for the sheet ---
    const newRow = new Array(calCols.COLOR).fill("");
    newRow[calCols.DATE - 1] = new Date(currentDate);
    newRow[calCols.WEEKDAY - 1] = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    newRow[calCols.LITURGICAL_CELEBRATION - 1] = finalCelebration.celebration;
    newRow[calCols.OPTIONAL_MEMORIAL - 1] = optionalMemorial; // Populate new column
    newRow[calCols.SEASON - 1] = finalCelebration.season;
    
    // Use the new HELPER_simplifyRank function to get the clean rank for output
    newRow[calCols.RANK - 1] = HELPER_simplifyRank(finalCelebration.rank);
    
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
 * Builds a Map of all liturgical reference entries (saints, feasts, parish entries).
 * Reads from the consolidated 'LiturgicalReference' sheet.
 *
 * Filtering logic (Calendar column):
 *   'General Roman Calendar' → always included
 *   region match (e.g., 'USA') → included when calendarRegion matches
 *   'Diocese' → included when a diocese is configured
 *   'Parish' → always included (parish-specific feasts and corrections)
 *
 * When multiple entries fall on the same date, the higher-ranked one wins.
 * All entries go through normal precedence comparison in the main loop.
 *
 * @param {Array<Array<any>>} refData Data from 'LiturgicalReference' sheet.
 * @param {string} calendarRegion The region to filter by (e.g., "USA").
 * @param {string} [diocese] Optional diocese config value.
 * @returns {Map<string, object>} Map keyed by "M/D" →
 *   { celebration, rank, color }
 */
function CALENDAR_buildLiturgicalReferenceMap(refData, calendarRegion, diocese) {
  const map = new Map();
  const cols = CONSTANTS.COLS.LITURGICAL_REFERENCE;

  for (const row of refData) {
    const month = parseInt(row[cols.MONTH - 1], 10);
    const day = parseInt(row[cols.DAY - 1], 10);
    const celebration = row[cols.LITURGICAL_CELEBRATION - 1];
    const rank = row[cols.RANK - 1];
    const color = row[cols.COLOR - 1];
    let calendarName = row[cols.CALENDAR - 1];
    if (!calendarName) calendarName = 'General Roman Calendar';

    if (!month || !day || !celebration || !rank) continue;

    // Filter: include only entries relevant to this parish's calendar configuration
    if (calendarName !== 'General Roman Calendar' &&
        calendarName !== calendarRegion &&
        calendarName !== 'Parish' &&
        !(diocese && calendarName === 'Diocese')) {
      continue;
    }

    const key = month + '/' + day;
    const newEntry = { celebration, rank, color };

    // If multiple entries on the same date, keep the higher-ranked one
    if (map.has(key)) {
      const existing = map.get(key);
      if (HELPER_getPrecedence(newEntry.rank) < HELPER_getPrecedence(existing.rank)) {
        map.set(key, newEntry);
      }
    } else {
      map.set(key, newEntry);
    }
  }

  Logger.log(`Built liturgical reference map with ${map.size} entries for region: ${calendarRegion}.`);
  return map;
}
