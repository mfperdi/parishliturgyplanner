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
  ent
