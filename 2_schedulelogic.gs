/**
 * ====================================================================
 * 2. SCHEDULE GENERATION LOGIC
 * ====================================================================
 * This file contains all logic for "Step 1: Generate Schedule".
 * It reads mass templates and recurring/special masses to create
 * all the "Unassigned" rows for a given month.
 */

/**
 * Main function to generate the unassigned schedule for a given month.
 * Called by Code.gs
 * @param {string} monthString A string like "2026-01" (for Jan 2026).
 * @returns {string} A success message.
 */
function SCHEDULE_generateScheduleForMonth(monthString) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  const config = HELPER_readConfig();
  const scheduleYear = config["Year to Schedule"];
  
  const selectedDate = new Date(monthString + "-01T12:00:00"); // Use noon to avoid timezone issues
  const month = selectedDate.getMonth(); // 0-indexed month
  
  if (selectedDate.getFullYear() != scheduleYear) {
    throw new Error(`The selected month (${monthString}) is not in the configured schedule year (${scheduleYear}). Please check the 'Config' sheet.`);
  }

  Logger.log(`Starting schedule generation for: ${monthString} (Month: ${month}, Year: ${scheduleYear})`);

  // 1. Clear out any old "Unassigned" rows for this month
  Logger.log("1. Clearing old 'Unassigned' rows...");
  SCHEDULE_clearOldAssignments(assignmentsSheet, month, scheduleYear);

  // 2. Read all mass templates
  Logger.log("2. Reading mass templates...");
  const templateMap = SCHEDULE_buildTemplateMap();
  
  // 3. Find all masses that need to be scheduled this month
  Logger.log("3. Finding all masses for the month...");
  const massesToSchedule = SCHEDULE_findMassesForMonth(month, scheduleYear);
  
  // 4. Create new rows
  Logger.log(`4. Generating roles for ${massesToSchedule.length} masses...`);
  const newAssignmentRows = [];
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  for (const mass of massesToSchedule) {
    const templateName = mass.templateName;
    const roles = templateMap.get(templateName);

    if (!roles) {
      Logger.log(`Warning: Template "${templateName}" not found for mass "${mass.description}". Skipping.`);
      continue;
    }

    // For each role in the template, create a new row
    for (const role of roles) {
      const newRow = new Array(assignCols.NOTES).fill("");
      
      newRow[assignCols.DATE - 1] = mass.date; // The specific date of the mass
      newRow[assignCols.TIME - 1] = mass.time;
      newRow[assignCols.MASS_NAME - 1] = mass.description;
      newRow[assignCols.LITURGICAL_CELEBRATION - 1] = mass.liturgicalCelebration || "";
      newRow[assignCols.MINISTRY_ROLE - 1] = role.roleName; // e.g., "1st Reading"
      newRow[assignCols.EVENT_ID - 1] = mass.eventId || "";
      newRow[assignCols.MONTH_YEAR - 1] = monthString;
      newRow[assignCols.ASSIGNED_VOLUNTEER_ID - 1] = "";
      newRow[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] = "";
      newRow[assignCols.STATUS - 1] = "Unassigned";
      newRow[assignCols.NOTES - 1] = mass.notes || "";
      
      newAssignmentRows.push(newRow);
    }
  }

  // 5. Write new rows to the sheet
  Logger.log(`5. Writing ${newAssignmentRows.length} new 'Unassigned' rows...`);
  if (newAssignmentRows.length > 0) {
    assignmentsSheet.getRange(
      assignmentsSheet.getLastRow() + 1, // Start on the next available row
      1,
      newAssignmentRows.length,
      newAssignmentRows[0].length
    ).setValues(newAssignmentRows);
  }

  Logger.log("Schedule generation complete.");
  return `Successfully generated ${newAssignmentRows.length} unassigned roles for ${monthString}.`;
}

/**
 * Clears all 'Unassigned' rows for the given month/year.
 * Only clears assignments that belong to this specific month (using MONTH_YEAR column).
 * This preserves weekend spillover from previous months.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The 'Assignments' sheet.
 * @param {number} month The month (0-indexed).
 * @param {number} year The year.
 */
function SCHEDULE_clearOldAssignments(sheet, month, year) {
  // Build the month-year string for this generation
  const currentMonthYear = year + "-" + String(month + 1).padStart(2, '0'); // e.g., "2026-02"
  
  Logger.log(`Clearing assignments for MONTH_YEAR = ${currentMonthYear}`);

  const data = sheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const header = data.shift(); // Remove header
  
  const rowsToKeep = [];
  
  for (const row of data) {
    if (row[0] === "") continue; // Skip blank rows
    
    const rowStatus = row[assignCols.STATUS - 1];
    const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
    
    // Check if the row should be deleted
    const belongsToThisMonth = rowMonthYear === currentMonthYear;
    const isUnassigned = rowStatus === "Unassigned";
    
    if (belongsToThisMonth && isUnassigned) {
      // This row belongs to the month we're regenerating AND is unassigned, so delete it
      Logger.log(`Clearing assignment: ${row[assignCols.DATE - 1]} - ${row[assignCols.MINISTRY_ROLE - 1]}`);
    } else {
      // This row belongs to a different month OR is already "Assigned", so we keep it.
      rowsToKeep.push(row);
    }
  }
  
  // Clear all content from row 2 down
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()).clearContent();
  }
  
  // Write back the rows we're keeping
  if (rowsToKeep.length > 0) {
    sheet.getRange(2, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
  }
  
  Logger.log(`Kept ${rowsToKeep.length} assignments from other months.`);
}

/**
 * Reads 'MassTemplates' and builds a Map for fast lookups.
 * @returns {Map<string, Array<object>>} A map where key is TemplateName
 * and value is an array of {roleName, skill} objects.
 */
function SCHEDULE_buildTemplateMap() {
  const templateData = HELPER_readSheetData(CONSTANTS.SHEETS.TEMPLATES);
  const templateMap = new Map();
  const templateCols = CONSTANTS.COLS.TEMPLATES;

  for (const row of templateData) {
    const templateName = row[templateCols.TEMPLATE_NAME - 1];
    if (!templateName) continue;

    if (!templateMap.has(templateName)) {
      templateMap.set(templateName, []);
    }

    templateMap.get(templateName).push({
      roleName: row[templateCols.MINISTRY_ROLE - 1],
      skill: row[templateCols.MINISTRY_SKILL - 1]
    });
  }
  Logger.log(`> Built template map with ${templateMap.size} templates.`);
  return templateMap;
}

/**
 * Finds all recurring and special masses for a given month.
 * @param {number} month The month (0-indexed).
 * @param {number} year The year.
 * @returns {Array<object>} An array of mass objects {date, time, description, templateName, liturgicalCelebration, notes, eventId}.
 */
function SCHEDULE_findMassesForMonth(month, year) {
  const masses = [];
  const recurringData = HELPER_readSheetData(CONSTANTS.SHEETS.RECURRING_MASSES);
  const specialData = HELPER_readSheetData(CONSTANTS.SHEETS.SPECIAL_MASSES);
  const calData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
  
  const recCols = CONSTANTS.COLS.RECURRING_MASSES;
  const specCols = CONSTANTS.COLS.SPECIAL_MASSES;

  // --- Determine the actual date range to process ---
  const startDate = new Date(year, month, 1); // First day of month
  let endDate = new Date(year, month + 1, 0); // Last day of month
  
  // Check if we need to extend to include the following weekend (Saturday-Sunday only)
  const lastDayOfWeek = endDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  
  if (lastDayOfWeek >= 1 && lastDayOfWeek <= 6) { // Month ends Mon-Sat (not Sunday)
    // Extend to the next Sunday to complete the weekend
    let extendToDate = new Date(endDate);
    while (extendToDate.getDay() !== 0) { // Find next Sunday
      extendToDate.setDate(extendToDate.getDate() + 1);
    }
    endDate = extendToDate;
    Logger.log(`Month extends through ${endDate.toDateString()} to include complete weekend.`);
  }
  
  Logger.log(`Processing masses from ${startDate.toDateString()} to ${endDate.toDateString()}`);

  // --- 1. Find Recurring Masses ---
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Sunday"
    
    for (const row of recurringData) {
      const isActive = row[recCols.IS_ACTIVE - 1];
      if (isActive === false) continue; // Skip if explicitly set to FALSE
      
      const recurringDay = row[recCols.DAY_OF_WEEK - 1];
      if (recurringDay === dayOfWeek) {
        // We have a match
        const isAnticipated = row[recCols.IS_ANTICIPATED - 1];
        Logger.log(`Found recurring mass on ${currentDate.toDateString()}: ${row[recCols.DESCRIPTION - 1]}, IsAnticipated: ${isAnticipated}`);
        
        masses.push({
          date: new Date(currentDate), // Create a copy of the date
          time: row[recCols.TIME - 1],
          description: row[recCols.DESCRIPTION - 1] || dayOfWeek,
          templateName: row[recCols.TEMPLATE_NAME - 1],
          liturgicalCelebration: "", // Will be filled from calendar if needed
          notes: row[recCols.NOTES - 1] || "",
          eventId: row[recCols.EVENT_ID - 1] || "",
          isAnticipated: isAnticipated === true || isAnticipated === "TRUE" || isAnticipated === "true"
        });
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // --- 2. Find Special Masses ---
  // A special mass on a specific date (e.g., 12/25/2026) overrides
  // any recurring masses for that day.
  
  // First, build a map of celebration names to EventIDs from the SpecialMasses sheet
  const specialMassEventIdMap = new Map();
  for (const row of specialData) {
     const isActive = row[specCols.IS_ACTIVE - 1];
     if (isActive === false) continue;
     
     const eventId = row[specCols.EVENT_ID - 1];
     if (!eventId) continue; // Skip if no EventID
     
     // Store the *full row* by its EventID
     specialMassEventIdMap.set(eventId, row);
  }

  // Now, loop through the *LiturgicalCalendar* for our date range
  const calCols = CONSTANTS.COLS.CALENDAR;
  for (const calRow of calData) {
    const calDate = new Date(calRow[calCols.DATE - 1]);
    if (calDate < startDate || calDate > endDate) {
      continue; // Skip dates not in our range
    }
    
    const celebrationName = calRow[calCols.LITURGICAL_CELEBRATION - 1];
    
    // Check if this celebration name exists as an EventID in our map
    if (specialMassEventIdMap.has(celebrationName)) {
      const specialMassRow = specialMassEventIdMap.get(celebrationName);
      
      // Found a special mass!
      // First, remove any *recurring* masses for this same day
      for (let i = masses.length - 1; i >= 0; i--) {
        if (masses[i].date.getTime() === calDate.getTime()) {
          masses.splice(i, 1); // Remove recurring mass
        }
      }
      
      // Then, add the special mass
      masses.push({
        date: calDate,
        time: specialMassRow[specCols.TIME - 1],
        description: specialMassRow[specCols.DESCRIPTION - 1] || celebrationName,
        templateName: specialMassRow[specCols.TEMPLATE_NAME - 1],
        liturgicalCelebration: celebrationName,
        notes: specialMassRow[specCols.NOTES - 1] || "",
        eventId: specialMassRow[specCols.EVENT_ID - 1] || "",
        isAnticipated: specialMassRow[specCols.IS_ANTICIPATED - 1] || false
      });
    }
  }

  // --- 3. Add liturgical celebration info to recurring masses ---
  const calCols2 = CONSTANTS.COLS.CALENDAR;
  for (const mass of masses) {
    if (!mass.liturgicalCelebration) {
      // Determine which date to look up for liturgical celebration
      let lookupDate = mass.date;
      
      // If this is an anticipated Mass, look up the NEXT day's liturgical celebration
      if (mass.isAnticipated === true) {
        lookupDate = new Date(mass.date.getTime() + 86400000); // Add one day (86400000 ms = 1 day)
        Logger.log(`Anticipated Mass on ${mass.date.toDateString()}: Looking up ${lookupDate.toDateString()}`);
      }
      
      // Find the liturgical celebration for the lookup date
      for (const calRow of calData) {
        const calDate = new Date(calRow[calCols2.DATE - 1]);
        if (calDate.getTime() === lookupDate.getTime()) {
          mass.liturgicalCelebration = calRow[calCols2.LITURGICAL_CELEBRATION - 1];
          Logger.log(`Found liturgical celebration for ${lookupDate.toDateString()}: ${mass.liturgicalCelebration}`);
          break;
        }
      }
      
      // If we still don't have a liturgical celebration, log it
      if (!mass.liturgicalCelebration) {
        Logger.log(`Warning: No liturgical celebration found for ${lookupDate.toDateString()}`);
        mass.liturgicalCelebration = "Unknown";
      }
    }
  }

  Logger.log(`> Found ${masses.length} total masses to schedule.`);
  return masses;
}
