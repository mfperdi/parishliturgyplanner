/**
 * ====================================================================
 * 2. SCHEDULE GENERATION LOGIC (3-LAYER LOGIC)
 * ====================================================================
 * This file contains all logic for "Step 1: Generate Schedule".
 * It reads masses in three layers:
 * 1. WeeklyMasses (Baseline)
 * 2. MonthlyMasses (Overrides)
 * 3. YearlyMasses (Final Overrides)
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
  
  // 3. Find all masses that need to be scheduled this month (using 3-layer logic)
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
    
    // If this is an anticipated Mass, ALWAYS get the liturgical celebration from the next day
    if (mass.isAnticipated) {
      const nextDay = new Date(mass.date.getTime() + 24 * 60 * 60 * 1000);
      const nextDayKey = `${nextDay.getFullYear()}-${(nextDay.getMonth() + 1).toString().padStart(2, '0')}-${nextDay.getDate().toString().padStart(2, '0')}`;
      const nextDayLiturgy = liturgicalMap.get(nextDayKey);
      
      if (nextDayLiturgy) {
        liturgicalCelebration = nextDayLiturgy;
        // Logger.log(`DEBUG: Anticipated Mass on ${mass.date.toDateString()} uses liturgy from ${nextDay.toDateString()}: ${liturgicalCelebration}`);
      } else {
        Logger.log(`WARNING: Could not find liturgy for next day ${nextDay.toDateString()} for anticipated Mass on ${mass.date.toDateString()}`);
        // Still use next day logic - build from scratch if needed
        const sundayOrdinal = Math.ceil(nextDay.getDate() / 7);
        liturgicalCelebration = `${sundayOrdinal}${sundayOrdinal === 1 ? 'st' : sundayOrdinal === 2 ? 'nd' : sundayOrdinal === 3 ? 'rd' : 'th'} Sunday in Ordinary Time`;
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
      newRow[assignCols.ASSIGNED_GROUP - 1] = mass.assignedGroup || ""; 
      newRow[assignCols.ASSIGNED_VOLUNTEER_ID - 1] = "";
      newRow[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] = "";
      newRow[assignCols.STATUS - 1] = "Unassigned"; // Set default status
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
    
    try {
      const rowDate = new Date(row[assignCols.DATE - 1]);
      if (isNaN(rowDate.getTime())) continue; // Skip rows with invalid dates

      const rowStatus = row[assignCols.STATUS - 1];
      
      // Check if the row should be deleted
      const isThisMonth = rowDate.getMonth() === month && rowDate.getFullYear() === year;
      const isUnassigned = rowStatus === "Unassigned" || rowStatus === ""; // Also clear blank status
      
      if (isThisMonth && isUnassigned) {
        // This row should be deleted, so we *don't* add it to rowsToKeep
      } else {
        // This row is from a different month OR is already "Assigned", so we keep it.
        rowsToKeep.push(row);
      }
    } catch (e) {
      Logger.log(`Error processing row in SCHEDULE_clearOldAssignments: ${e} - Row: ${row}`);
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
 * ENHANCED: Builds a map of liturgical celebrations for the month and spillover dates.
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
      if (isNaN(calDate.getTime())) continue; // Skip invalid dates
      
      // Include this month AND the first few days of next month for anticipated Mass logic
      const includeDate = (
        (calDate.getMonth() === month && calDate.getFullYear() === year) ||
        (calDate.getMonth() === (month + 1) % 12 && calDate.getDate() <= 7 && 
         calDate.getFullYear() === (month === 11 ? year + 1 : year))
      );
      
      if (includeDate) {
        const dateKey = `${calDate.getFullYear()}-${(calDate.getMonth() + 1).toString().padStart(2, '0')}-${calDate.getDate().toString().padStart(2, '0')}`;
        const liturgicalCelebration = row[calCols.LITURGICAL_CELEBRATION - 1];
        liturgicalMap.set(dateKey, liturgicalCelebration);
      }
    }
    
    Logger.log(`> Built liturgical map with ${liturgicalMap.size} entries for ${month + 1}/${year} including spillover dates.`);
  } catch (error) {
    Logger.log(`Warning: Could not read liturgical calendar: ${error}. Mass names will use default descriptions.`);
  }
  
  return liturgicalMap;
}

/**
 * NEW: Helper function to find the specific date for a monthly rule
 * e.g., "1st Friday" or "Last Saturday"
 * @param {number} year The year.
 * @param {number} month The month (0-indexed).
 * @param {string|number} weekOfMonth The rule (1, 2, 3, 4, 5, or "Last").
 * @param {string} dayOfWeek The day to find (e.g., "Friday").
 * @returns {Date|null} The specific date, or null if not found.
 */
function HELPER_findDateForMonthlyRule(year, month, weekOfMonth, dayOfWeek) {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayOfWeek);
  if (dayIndex === -1) return null;

  if (weekOfMonth === 'Last') {
    // Start from the last day of the month and go backwards
    const lastDayOfMonth = new Date(year, month + 1, 0); // Day 0 of next month is last day of this month
    for (let d = lastDayOfMonth.getDate(); d >= 1; d--) {
      const dt = new Date(year, month, d);
      if (dt.getDay() === dayIndex) {
        return dt; // Found the last one
      }
    }
  } else {
    // Start from the 1st and go forwards
    const weekNum = parseInt(weekOfMonth);
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      if (dt.getDay() === dayIndex) {
        count++;
        if (count === weekNum) {
          return dt; // Found the Nth day
        }
      }
    }
  }
  
  return null; // Rule didn't match (e.g., no "5th Friday")
}

/**
 * Finds all recurring and special masses for a given month using 3-layer logic.
 * @param {number} month The month (0-indexed).
 * @param {number} year The year.
 * @returns {Array<object>} An array of mass objects.
 */
function SCHEDULE_findMassesForMonth(month, year) {
  const masses = [];
  const weeklyData = HELPER_readSheetData(CONSTANTS.SHEETS.WEEKLY_MASSES);
  const monthlyData = HELPER_readSheetData(CONSTANTS.SHEETS.MONTHLY_MASSES);
  const yearlyData = HELPER_readSheetData(CONSTANTS.SHEETS.YEARLY_MASSES);
  
  const weekCols = CONSTANTS.COLS.WEEKLY_MASSES;
  const monCols = CONSTANTS.COLS.MONTHLY_MASSES;
  const yearCols = CONSTANTS.COLS.YEARLY_MASSES;
  
  // --- 1. Find Weekly Masses (Baseline) ---
  Logger.log("Layer 1: Generating Weekly Masses");
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // Get last day of month
  const lastDayOfMonth = new Date(year, month, daysInMonth);
  const includeNextSunday = lastDayOfMonth.getDay() === 6; // Last day is Saturday
  
  let endDay = daysInMonth;
  let endMonth = month;
  let endYear = year;
  
  if (includeNextSunday) {
    endDay = 7; 
    if (month === 11) { // December
      endMonth = 0; // January
      endYear = year + 1;
    } else {
      endMonth = month + 1;
    }
    Logger.log(`Including spillover dates through ${endYear}-${(endMonth + 1).toString().padStart(2, '0')}-07 for weekend masses`);
  }
  
  // Process current month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Sunday"
    
    for (const row of weeklyData) {
      const isActive = row[weekCols.IS_ACTIVE - 1];
      if (isActive === false) continue; 
      
      const recurringDay = row[weekCols.DAY_OF_WEEK - 1];
      if (recurringDay === dayOfWeek) {
        let isAnticipated = (row[weekCols.IS_ANTICIPATED - 1] === true);
        
        masses.push({
          date: currentDate,
          time: row[weekCols.TIME - 1],
          description: row[weekCols.DESCRIPTION - 1] || dayOfWeek,
          templateName: row[weekCols.TEMPLATE_NAME - 1],
          eventId: row[weekCols.EVENT_ID - 1],
          isAnticipated: isAnticipated,
          assignedGroup: row[weekCols.ASSIGNED_GROUP - 1] || "",
          notes: row[weekCols.NOTES - 1] || ""
        });
      }
    }
  }
  
  // Process spillover dates if needed
  if (includeNextSunday) {
    for (let day = 1; day <= endDay; day++) {
      const currentDate = new Date(endYear, endMonth, day);
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (dayOfWeek === 'Sunday') {
        for (const row of weeklyData) {
          const isActive = row[weekCols.IS_ACTIVE - 1];
          if (isActive === false) continue;
          
          const recurringDay = row[weekCols.DAY_OF_WEEK - 1];
          if (recurringDay === dayOfWeek) {
            let isAnticipated = (row[weekCols.IS_ANTICIPATED - 1] === true);
            masses.push({
              date: currentDate,
              time: row[weekCols.TIME - 1],
              description: row[weekCols.DESCRIPTION - 1] || dayOfWeek,
              templateName: row[weekCols.TEMPLATE_NAME - 1],
              eventId: row[weekCols.EVENT_ID - 1],
              isAnticipated: isAnticipated,
              assignedGroup: row[weekCols.ASSIGNED_GROUP - 1] || "",
              notes: row[weekCols.NOTES - 1] || ""
            });
          }
        }
        break; // Only need the first Sunday
      }
    }
  }
  Logger.log(`> Found ${masses.length} weekly mass instances.`);

  // --- 2. Find and Apply Monthly Masses ---
  Logger.log("Layer 2: Applying Monthly Mass Rules");
  for (const row of monthlyData) {
    const isActive = row[monCols.IS_ACTIVE - 1];
    if (isActive === false) continue;

    const weekOfMonth = row[monCols.WEEK_OF_MONTH - 1];
    const dayOfWeek = row[monCols.DAY_OF_WEEK - 1];
    
    // Find the specific date for this rule (e.g., "1st Friday")
    const specialDate = HELPER_findDateForMonthlyRule(year, month, weekOfMonth, dayOfWeek);
    
    if (!specialDate) {
      // Logger.log(`> Rule ${row[monCols.EVENT_ID - 1]} did not match any date this month.`);
      continue; // Rule doesn't apply this month (e.g., "5th Sunday" in a 4-Sunday month)
    }

    const dateKey = specialDate.toDateString();
    const overrideType = (row[monCols.OVERRIDE_TYPE - 1] || '').toLowerCase();

    if (overrideType === 'overrideday') {
      // --- Type 2: OverrideDay Logic ---
      Logger.log(`Applying MONTHLY OVERRIDE for ${dateKey}`);
      for (let i = masses.length - 1; i >= 0; i--) {
        if (masses[i].date.toDateString() === dateKey) {
          masses.splice(i, 1);
        }
      }
    } else {
      // --- Type 1: Append/Sponsorship Logic ---
      Logger.log(`Applying MONTHLY APPEND for ${dateKey}`);
      const specialTime = new Date(row[monCols.TIME - 1]).toTimeString();
      for (let i = masses.length - 1; i >= 0; i--) {
        const recurringTime = new Date(masses[i].time).toTimeString();
        if (masses[i].date.toDateString() === dateKey && recurringTime === specialTime) {
          Logger.log(`> Replacing weekly mass at ${specialTime}`);
          masses.splice(i, 1);
          break; 
        }
      }
    }

    // --- Finally, Add the Monthly Mass ---
    let isAnticipated = (row[monCols.IS_ANTICIPATED - 1] === true);
    masses.push({
      date: specialDate,
      time: row[monCols.TIME - 1],
      description: row[monCols.DESCRIPTION - 1] || "",
      templateName: row[monCols.TEMPLATE_NAME - 1],
      eventId: row[monCols.EVENT_ID - 1],
      isAnticipated: isAnticipated,
      assignedGroup: row[monCols.ASSIGNED_GROUP - 1] || "",
      notes: row[monCols.NOTES - 1] || ""
    });
    Logger.log(`DEBUG: Added monthly mass - ${row[monCols.EVENT_ID - 1]} on ${dateKey}`);
  }

  // --- 3. Find and Apply Yearly (Date-Specific) Masses ---
  Logger.log("Layer 3: Applying Yearly Mass Rules");
  const yearlyMassesByDate = new Map();
  
  // Group all valid yearly masses by their date
  for (const row of yearlyData) {
    const isActive = row[yearCols.IS_ACTIVE - 1];
    if (isActive === false) continue; 

    const specialDate = new Date(row[yearCols.DATE - 1]);
    if (isNaN(specialDate.getTime())) continue; 

    // Check if the date is in our scheduling window
    const inMonth = (specialDate.getFullYear() === year && specialDate.getMonth() === month);
    const inSpillover = (includeNextSunday && specialDate.getFullYear() === endYear && specialDate.getMonth() === endMonth && specialDate.getDate() <= endDay);

    if (!inMonth && !inSpillover) continue; 
    
    const dateKey = specialDate.toDateString();
    if (!yearlyMassesByDate.has(dateKey)) {
      yearlyMassesByDate.set(dateKey, []);
    }
    yearlyMassesByDate.get(dateKey).push(row);
  }

  // Process each date that has yearly masses
  for (const [dateKey, yearlyMassRows] of yearlyMassesByDate) {
    const specialDate = new Date(dateKey); 

    const isOverrideDay = yearlyMassRows.some(row =>
      (row[yearCols.OVERRIDE_TYPE - 1] || '').toLowerCase() === 'override'
    );

    if (isOverrideDay) {
      // --- Type 2: OverrideDay Logic ---
      Logger.log(`Applying YEARLY OVERRIDE for ${dateKey}`);
      for (let i = masses.length - 1; i >= 0; i--) {
        if (masses[i].date.toDateString() === dateKey) {
          masses.splice(i, 1); // Deletes weekly AND monthly masses
        }
      }
    } else {
      // --- Type 1: Append/Sponsorship Logic ---
      Logger.log(`Applying YEARLY APPEND for ${dateKey}`);
      for (const specialRow of yearlyMassRows) {
        const specialTime = new Date(specialRow[yearCols.TIME - 1]).toTimeString();
        for (let i = masses.length - 1; i >= 0; i--) {
          const recurringTime = new Date(masses[i].time).toTimeString();
          if (masses[i].date.toDateString() === dateKey && recurringTime === specialTime) {
            Logger.log(`> Replacing existing mass at ${specialTime}`);
            masses.splice(i, 1);
            break; 
          }
        }
      }
    }

    // --- Finally, Add the Yearly Masses ---
    for (const specialRow of yearlyMassRows) {
      let isAnticipated = (specialRow[yearCols.IS_ANTICIPATED - 1] === true);
      masses.push({
        date: specialDate,
        time: specialRow[yearCols.TIME - 1],
        description: specialRow[yearCols.DESCRIPTION - 1] || "",
        templateName: specialRow[yearCols.TEMPLATE_NAME - 1],
        eventId: specialRow[yearCols.EVENT_ID - 1],
        isAnticipated: isAnticipated,
        assignedGroup: specialRow[yearCols.ASSIGNED_GROUP - 1] || "",
        notes: specialRow[yearCols.NOTES - 1] || ""
      });
      Logger.log(`DEBUG: Added yearly mass - ${specialRow[yearCols.EVENT_ID - 1]} on ${dateKey}`);
    }
  }

  Logger.log(`> Found ${masses.length} total masses to schedule after all 3 layers.`);

  // --- 4. SORTING ---
  // Sort the final list by date, then by time.
  masses.sort((a, b) => {
    const timeA = new Date(a.time);
    const fullDateA = new Date(a.date.getTime());
    fullDateA.setHours(timeA.getHours(), timeA.getMinutes(), timeA.getSeconds());

    const timeB = new Date(b.time);
    const fullDateB = new Date(b.date.getTime());
    fullDateB.setHours(timeB.getHours(), timeB.getMinutes(), timeB.getSeconds());

    return fullDateA.getTime() - fullDateB.getTime();
  });

  return masses;
}
