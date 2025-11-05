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
 * Uses a two-pass system: First pass builds the base calendar,
 * second pass handles transfers and omissions.
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
  const dates = CALENDAR_calculateLiturgicalDates(scheduleYear, config);
  
  // 3. Build lookup maps for overrides and saints
  const overrideMap = CALENDAR_buildOverrideMap(overrideData, scheduleYear);
  const saintMap = CALENDAR_buildSaintMap(saintsData, calendarRegion);
  
  // 4. FIRST PASS: Generate the base calendar (without transfers)
  Logger.log(`Starting calendar generation for ${scheduleYear}...`);
  const calendarMap = new Map(); // Key: date string, Value: row data
  
  let currentDate = new Date(scheduleYear, 0, 1);
  const endDate = new Date(scheduleYear, 11, 31);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dayKey = HELPER_formatDateKey(currentDate);
    
    // Get seasonal celebration
    const seasonal = CALENDAR_getSeasonalCelebration(currentDate, dayOfWeek, dates);
    
    // Check for override
    const override = overrideMap.get(dayKey);
    
    // Check for saint
    const saint = saintMap.get(dayKey);
    
    // Create the calendar entry for this day
    const entry = CALENDAR_resolveDay(currentDate, seasonal, saint, override, dates);
    
    calendarMap.set(dayKey, entry);
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // 5. SECOND PASS: Handle transfers and omissions
  Logger.log("Processing transfers and omissions...");
  const transfersToProcess = CALENDAR_findTransfersAndOmissions(calendarMap, dates, scheduleYear);
  
  // Apply transfers
  for (const transfer of transfersToProcess) {
    const targetKey = HELPER_formatDateKey(transfer.targetDate);
    const targetEntry = calendarMap.get(targetKey);
    
    if (targetEntry) {
      // The transferred celebration goes into the main column
      // The original weekday/seasonal goes to Optional Memorial (if it was lower rank)
      if (targetEntry.rank === "Weekday") {
        targetEntry.optionalMemorial = targetEntry.celebration; // Save the weekday
      }
      
      targetEntry.celebration = transfer.celebration;
      targetEntry.rank = transfer.rank;
      targetEntry.color = transfer.color;
    }
  }
  
  // 6. Convert the map to an array for writing to the sheet
  const newCalendarRows = [];
  const calCols = CONSTANTS.COLS.CALENDAR;
  
  currentDate = new Date(scheduleYear, 0, 1);
  while (currentDate <= endDate) {
    const dayKey = HELPER_formatDateKey(currentDate);
    const entry = calendarMap.get(dayKey);
    
    if (entry) {
      const newRow = new Array(calCols.COLOR).fill("");
      
      newRow[calCols.DATE - 1] = new Date(currentDate);
      newRow[calCols.WEEKDAY - 1] = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
      newRow[calCols.LITURGICAL_CELEBRATION - 1] = entry.celebration;
      newRow[calCols.OPTIONAL_MEMORIAL - 1] = entry.optionalMemorial || "";
      newRow[calCols.SEASON - 1] = entry.season;
      newRow[calCols.RANK - 1] = entry.rank;
      newRow[calCols.COLOR - 1] = entry.color;
      
      newCalendarRows.push(newRow);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // 7. Write to sheet
  if (calSheet.getMaxRows() > 1) {
    calSheet.getRange(2, 1, calSheet.getMaxRows() - 1, calSheet.getMaxColumns()).clearContent();
  }
  
  if (newCalendarRows.length > 0) {
    calSheet.getRange(2, 1, newCalendarRows.length, newCalendarRows[0].length).setValues(newCalendarRows);
  }
  
  Logger.log(`Successfully generated ${newCalendarRows.length} days for the ${scheduleYear} calendar.`);
  Logger.log(`Processed ${transfersToProcess.length} transfers.`);
  return `Successfully generated the ${scheduleYear} liturgical calendar with ${transfersToProcess.length} transfers.`;
}

/**
 * Resolves the celebration for a single day (without considering transfers).
 * @param {Date} date The date.
 * @param {object} seasonal The seasonal celebration.
 * @param {object} saint The saint celebration (or null).
 * @param {object} override The override celebration (or null).
 * @param {object} dates The liturgical dates.
 * @returns {object} An entry object with celebration details.
 */
function CALENDAR_resolveDay(date, seasonal, saint, override, dates) {
  const entry = {
    date: date,
    celebration: "",
    optionalMemorial: "",
    season: seasonal.season,
    rank: "",
    color: ""
  };
  
  const seasonalRankNum = HELPER_translateRank(seasonal.rank);
  const saintRankNum = saint ? HELPER_translateRank(saint.rank) : 99;
  const isProtected = HELPER_isProtectedDay(date, dates);
  
  // Priority 1: Override always wins
  if (override) {
    entry.celebration = override.celebration;
    entry.rank = override.rank;
    entry.color = override.color;
    entry.season = seasonal.season;
    return entry;
  }
  
  // Priority 2: Protected days (Sundays of Lent, Holy Week, Easter Octave)
  // These days ALWAYS show their seasonal celebration
  // Saints on these days will be handled in the transfer pass
  if (isProtected) {
    entry.celebration = seasonal.celebration;
    entry.rank = seasonal.rank;
    entry.color = seasonal.color;
    // Note: We do NOT add saints here - they'll be transferred or omitted
    return entry;
  }
  
  // Priority 3: Optional Memorials always go to the side column
  if (saint && saintRankNum === 4) {
    entry.celebration = seasonal.celebration;
    entry.rank = seasonal.rank;
    entry.color = seasonal.color;
    entry.optionalMemorial = saint.celebration;
    return entry;
  }
  
  // Priority 4: Higher-ranked saint overrides seasonal
  if (saint && saintRankNum < seasonalRankNum) {
    entry.celebration = saint.celebration;
    entry.rank = saint.rank;
    entry.color = saint.color;
    return entry;
  }
  
  // Priority 5: Lenten weekday beats Memorial
  if (saint && seasonal.season === "Lent" && saintRankNum === 3 && seasonalRankNum === 3) {
    entry.celebration = seasonal.celebration;
    entry.rank = seasonal.rank;
    entry.color = seasonal.color;
    return entry;
  }
  
  // Default: Seasonal celebration
  entry.celebration = seasonal.celebration;
  entry.rank = seasonal.rank;
  entry.color = seasonal.color;
  
  return entry;
}

/**
 * Finds all saints that need to be transferred or omitted due to protected days.
 * @param {Map} calendarMap The calendar map (will be modified).
 * @param {object} dates The liturgical dates.
 * @param {number} year The schedule year.
 * @returns {Array} An array of transfer objects.
 */
function CALENDAR_findTransfersAndOmissions(calendarMap, dates, year) {
  const transfers = [];
  
  // Go through each day of the year
  let currentDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  while (currentDate <= endDate) {
    const dayKey = HELPER_formatDateKey(currentDate);
    const entry = calendarMap.get(dayKey);
    
    // Check if this is a protected day
    if (HELPER_isProtectedDay(currentDate, dates)) {
      // Get the saint for this day from the global saint map
      // We need to rebuild the saint map here (not ideal, but works)
      const saintsData = HELPER_readSheetData(CONSTANTS.SHEETS.SAINTS_CALENDAR);
      const config = HELPER_readConfig();
      const calendarRegion = config["Calendar Region"];
      const saintMap = CALENDAR_buildSaintMap(saintsData, calendarRegion);
      
      const saint = saintMap.get(dayKey);
      
      if (saint) {
        const saintRankNum = HELPER_translateRank(saint.rank);
        
        // Solemnities are transferred
        if (saintRankNum === 1) {
          const targetDate = HELPER_findTransferDate(currentDate, dates);
          
          transfers.push({
            originalDate: new Date(currentDate),
            targetDate: targetDate,
            celebration: saint.celebration,
            rank: saint.rank,
            color: saint.color
          });
          
          Logger.log(`Transferring "${saint.celebration}" from ${dayKey} to ${HELPER_formatDateKey(targetDate)}`);
        }
        // Feasts and Memorials (ranks 2 and 3) are omitted - do nothing
        // Optional Memorials (rank 4) are already handled in resolveDay
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return transfers;
}

/**
 * Builds a Map of manual overrides for the year.
 * @param {Array<Array<any>>} overrideData Data from 'CalendarOverrides' sheet.
 * @param {number} scheduleYear The year being scheduled.
 * @returns {Map<string, object>} A map where key is "M/D".
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

    if (!month || !day || !celebration || !rank) continue;
    
    const key = month + "/" + day;
    
    map.set(key, {
      celebration: celebration,
      rank: rank,
      color: color,
      season: calendar || "Override"
    });
  }
  Logger.log(`Built override map with ${map.size} entries.`);
  return map;
}

/**
 * Builds a Map of all saints and fixed feasts for the year.
 * @param {Array<Array<any>>} saintsData Data from 'SaintsCalendar' sheet.
 * @param {string} calendarRegion The region to filter by (e.g., "USA").
 * @returns {Map<string, object>} A map where key is "M/D".
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

    if (!month || !day || !celebration || !rank) continue;
    
    if (calendarName === "General Roman Calendar" || 
        calendarName === calendarRegion || 
        calendarName === "Parish" || 
        calendarName === "Diocese of Sacramento") {
      
      const key = month + "/" + day;
      
      const newSaint = {
        celebration: celebration,
        rank: rank,
        color: color,
        season: "Saints"
      };
      
      if (map.has(key)) {
        const existingSaint = map.get(key);
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
