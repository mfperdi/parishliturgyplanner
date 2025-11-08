/**
 * ====================================================================
 * 2. SCHEDULE GENERATION LOGIC (ENHANCED WITH EVENTID SUPPORT)
 * ====================================================================
 * This file contains all logic for "Step 1: Generate Schedule".
 * It reads mass templates and recurring/special masses to create
 * all the "Unassigned" rows for a given month.
 * 
 * ENHANCED: Now properly populates EventID column for mass preference matching.
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
  
  // 4. Get liturgical celebrations for the month (for anticipated Mass handling)
  Logger.log("4. Reading liturgical calendar for anticipated Mass logic...");
  const liturgicalMap = SCHEDULE_buildLiturgicalMap(month, scheduleYear);
  
  // 5. Create new rows
  Logger.log(`5. Generating roles for ${massesToSchedule.length} masses...`);
  const newAssignmentRows = [];
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  for (const mass of massesToSchedule) {
    const templateName = mass.templateName;
    const roles = templateMap.get(templateName);

    if (!roles) {
      Logger.log(`Warning: Template "${templateName}" not found for mass "${mass.description}". Skipping.`);
      continue;
    }

    // ENHANCED: Determine the liturgical celebration name for this mass
    let liturgicalCelebration = mass.description;
    
    // If this is an anticipated Mass, get the liturgical celebration from the next day
    if (mass.isAnticipated) {
      const nextDay = new Date(mass.date.getTime() + 24 * 60 * 60 * 1000);
      const nextDayKey = `${nextDay.getFullYear()}-${(nextDay.getMonth() + 1).toString().padStart(2, '0')}-${nextDay.getDate().toString().padStart(2, '0')}`;
      const nextDayLiturgy = liturgicalMap.get(nextDayKey);
      
      if (nextDayLiturgy) {
        liturgicalCelebration = nextDayLiturgy;
        Logger.log(`DEBUG: Anticipated Mass on ${mass.date.toDateString()} uses liturgy from ${nextDay.toDateString()}: ${liturgicalCelebration}`);
      }
    } else {
      // Regular Mass uses the liturgy from the same day
      const massDateKey = `${mass.date.getFullYear()}-${(mass.date.getMonth() + 1).toString().padStart(2, '0')}-${mass.date.getDate().toString().padStart(2, '0')}`;
      const massDayLiturgy = liturgicalMap.get(massDateKey);
      
      if (massDayLiturgy) {
        liturgicalCelebration = massDayLiturgy;
      }
    }

    // For each role in the template, create a new row
    for (const role of roles) {
      const newRow = new Array(assignCols.FAMILY_GROUP).fill("");
      
      newRow[assignCols.DATE - 1] = mass.date;
      newRow[assignCols.TIME - 1] = mass.time;
      newRow[assignCols.MASS_NAME - 1] = mass.description;
      newRow[assignCols.LITURGICAL_CELEBRATION - 1] = liturgicalCelebration;
      newRow[assignCols.MINISTRY_ROLE - 1] = role.roleName;
      newRow[assignCols.EVENT_ID - 1] = mass.eventId || "";
      newRow[assignCols.MONTH_YEAR - 1] = monthString;
      newRow[assignCols.ASSIGNED_GROUP - 1] = mass.assignedGroup || ""; // Column H
      newRow[assignCols.ASSIGNED_VOLUNTEER_ID - 1] = "";
      newRow[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] = "";
      newRow[assignCols.STATUS - 1] = "";
      newRow[assignCols.NOTES - 1] = mass.notes || "";
      
      newAssignmentRows.push(newRow);
    }
  }

  // 6. Write new rows to the sheet
  Logger.log(`6. Writing ${newAssignmentRows.length} new 'Unassigned' rows...`);
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
 * This function preserves filters by clearing content, not deleting rows.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The 'Assignments' sheet.
 * @param {number} month The month (0-indexed).
 * @param {number} year The year.
 */
function SCHEDULE_clearOldAssignments(sheet, month, year) {
  const data = sheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const header = data.shift(); // Remove header
  
  const rowsToKeep = [];
  
  for (const row of data) {
    if (row[0] === "") continue; // Skip blank rows
    
    const rowDate = new Date(row[assignCols.DATE - 1]);
    const rowStatus = row[assignCols.STATUS - 1];
    
    // Check if the row should be deleted
    const isThisMonth = rowDate.getMonth() === month && rowDate.getFullYear() === year;
    const isUnassigned = rowStatus === "Unassigned";
    
    if (isThisMonth && isUnassigned) {
      // This row should be deleted, so we *don't* add it to rowsToKeep
    } else {
      // This row is from a different month OR is already "Assigned", so we keep it.
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
 * ENHANCED: Builds a map of liturgical celebrations for the month.
 * @param {number} month The month (0-indexed).
 * @param {number} year The year.
 * @returns {Map<string, string>} A map where key is "YYYY-MM-DD" and value is the liturgical celebration name.
 */
function SCHEDULE_buildLiturgicalMap(month, year) {
  const liturgicalMap = new Map();
  
  try {
    const calData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    const calCols = CONSTANTS.COLS.CALENDAR;
    
    for (const row of calData) {
      const calDate = new Date(row[calCols.DATE - 1]);
      if (calDate.getMonth() === month && calDate.getFullYear() === year) {
        const dateKey = `${calDate.getFullYear()}-${(calDate.getMonth() + 1).toString().padStart(2, '0')}-${calDate.getDate().toString().padStart(2, '0')}`;
        const liturgicalCelebration = row[calCols.LITURGICAL_CELEBRATION - 1];
        liturgicalMap.set(dateKey, liturgicalCelebration);
      }
    }
    
    Logger.log(`> Built liturgical map with ${liturgicalMap.size} entries for the month.`);
  } catch (error) {
    Logger.log(`Warning: Could not read liturgical calendar: ${error}. Mass names will use default descriptions.`);
  }
  
  return liturgicalMap;
}

/**
 * Finds all recurring and special masses for a given month.
 * ENHANCED: Now properly handles EventIDs and IsAnticipated flag.
 * 
 * @param {number} month The month (0-indexed).
 * @param {number} year The year.
 * @returns {Array<object>} An array of mass objects {date, time, description, templateName, eventId, isAnticipated, notes}.
 */
function SCHEDULE_findMassesForMonth(month, year) {
  const masses = [];
  const recurringData = HELPER_readSheetData(CONSTANTS.SHEETS.RECURRING_MASSES);
  const specialData = HELPER_readSheetData(CONSTANTS.SHEETS.SPECIAL_MASSES);
  const calData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
  
  const recCols = CONSTANTS.COLS.RECURRING_MASSES;
  const specCols = CONSTANTS.COLS.SPECIAL_MASSES;

  // --- 1. Find Recurring Masses ---
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // Get last day of month
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Sunday"
    
    for (const row of recurringData) {
      const isActive = row[recCols.IS_ACTIVE - 1];
      if (isActive === false) continue; // Skip if explicitly set to FALSE
      
      const assignedGroup = row[recCols.ASSIGNED_GROUP - 1];
      if (assignedGroup) continue; // Skip if assigned to a specific group
      
      const recurringDay = row[recCols.DAY_OF_WEEK - 1];
      if (recurringDay === dayOfWeek) {
        // ENHANCED: Parse IsAnticipated as boolean
        let isAnticipated = false;
        const anticipatedValue = row[recCols.IS_ANTICIPATED - 1];
        if (anticipatedValue === true || anticipatedValue === "TRUE" || anticipatedValue === "true" || anticipatedValue === 1) {
          isAnticipated = true;
        }
        
        // We have a match
        masses.push({
          date: currentDate,
          time: row[recCols.TIME - 1],
          description: row[recCols.DESCRIPTION - 1] || dayOfWeek,
          templateName: row[recCols.TEMPLATE_NAME - 1],
          eventId: row[recCols.EVENT_ID - 1], // ENHANCED: Include EventID
          isAnticipated: isAnticipated,       // ENHANCED: Include IsAnticipated flag
          assignedGroup: row[recCols.ASSIGNED_GROUP - 1] || "", // ENHANCED: Include AssignedGroup
          notes: row[recCols.NOTES - 1] || ""
        });
        
        Logger.log(`DEBUG: Added recurring mass - ${dayOfWeek} ${row[recCols.TIME - 1]} (${row[recCols.EVENT_ID - 1]}) - Anticipated: ${isAnticipated}`);
      }
    }
  }
  
  // --- 2. Find Special Masses ---
  // A special mass on a specific date (e.g., 12/25/2026) overrides
  // any recurring masses for that day.
  
  // First, build a map of celebration names to EventIDs from the SpecialMasses sheet
  const specialMassEventIdMap = new Map();
  for (const row of specialData) {
     const isActive = row[specCols.IS_ACTIVE - 1];
     if (isActive === false) continue;
     
     const assignedGroup = row[specCols.ASSIGNED_GROUP - 1];
     if (assignedGroup) continue; // Skip if assigned to a specific group
     
     const eventId = row[specCols.EVENT_ID - 1];
     if (!eventId) continue; // Skip if no EventID
     
     // Store the *full row* by its EventID
     specialMassEventIdMap.set(eventId, row);
  }

  // Now, loop through the *LiturgicalCalendar* for the month
  const calCols = CONSTANTS.COLS.CALENDAR;
  for (const calRow of calData) {
    const calDate = new Date(calRow[calCols.DATE - 1]);
    if (calDate.getMonth() !== month || calDate.getFullYear() !== year) {
      continue; // Skip dates not in our month
    }
    
    const celebrationName = calRow[calCols.LITURGICAL_CELEBRATION - 1];
    
    // Check if this celebration name exists as an EventID in our map
    if (specialMassEventIdMap.has(celebrationName)) {
      const specialMassRow = specialMassEventIdMap.get(celebrationName);
      
      // First, remove any *recurring* masses for this same day
      for (let i = masses.length - 1; i >= 0; i--) {
        if (masses[i].date.getTime() === calDate.getTime()) {
          masses.splice(i, 1); // Remove recurring mass
        }
      }
      
      // ENHANCED: Parse IsAnticipated as boolean
      let isAnticipated = false;
      const anticipatedValue = specialMassRow[specCols.IS_ANTICIPATED - 1];
      if (anticipatedValue === true || anticipatedValue === "TRUE" || anticipatedValue === "true" || anticipatedValue === 1) {
        isAnticipated = true;
      }
      
      // Then, add the special mass
      masses.push({
        date: calDate,
        time: specialMassRow[specCols.TIME - 1],
        description: specialMassRow[specCols.DESCRIPTION - 1] || celebrationName,
        templateName: specialMassRow[specCols.TEMPLATE_NAME - 1],
        eventId: celebrationName,          // ENHANCED: EventID is the celebration name
        isAnticipated: isAnticipated,      // ENHANCED: Include IsAnticipated flag
        assignedGroup: specialMassRow[specCols.ASSIGNED_GROUP - 1] || "", // ENHANCED: Include AssignedGroup
        notes: specialMassRow[specCols.NOTES - 1] || ""
      });
      
      Logger.log(`DEBUG: Added special mass - ${celebrationName} on ${calDate.toDateString()} - Anticipated: ${isAnticipated}`);
    }
  }

  Logger.log(`> Found ${masses.length} total masses to schedule.`);
  return masses;
}
