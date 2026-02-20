/**
 * ====================================================================
 * 2. SCHEDULE GENERATION LOGIC (3-LAYER LOGIC with Smart Dates)
 * ====================================================================
 * This file contains all logic for "Step 1: Generate Schedule".
 * It reads masses in three layers and respects Start/End dates.
 * 1. WeeklyMasses (Baseline)
 * 2. MonthlyMasses (Overrides)
 * 3. YearlyMasses (Final Overrides with Liturgy Calendar lookup)
 */

/**
 * Main function to generate the unassigned schedule for a given month.
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

  // 1. Clear out ANY old rows for this month (Assigned or Unassigned)
  Logger.log(`1. Clearing ALL old rows for ${monthString}...`);
  SCHEDULE_clearOldAssignments(assignmentsSheet, monthString);

  // 2. Read all mass templates
  Logger.log("2. Reading mass templates...");
  const templateMap = SCHEDULE_buildTemplateMap();

  // 2a. Build role-to-ministry mapping for validation and population (centralized helper)
  Logger.log("2a. Building role-to-ministry mapping...");
  const roleToMinistryMap = HELPER_buildSkillToMinistryMap();

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
      } else {
        Logger.log(`WARNING: Could not find liturgy for next day ${nextDay.toDateString()} for anticipated Mass on ${mass.date.toDateString()}`);
        // Generate fallback text - verify it's actually a Sunday before claiming it is
        if (nextDay.getDay() === 0) { // 0 = Sunday
          const sundayOrdinal = HELPER_getWeekdayOccurrenceInMonth(nextDay);
          liturgicalCelebration = `${HELPER_getOrdinalSuffix(sundayOrdinal)} Sunday in Ordinary Time`;
        } else {
          // Not a Sunday - use the mass description as fallback
          liturgicalCelebration = mass.description || 'Unknown Celebration';
        }
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
      const roleName = role.skill;

      // Look up ministry name for this role
      const ministryName = roleToMinistryMap.get(roleName.toLowerCase());

      // VALIDATION: Throw error if role doesn't exist in Ministries sheet
      if (!ministryName) {
        throw new Error(
          `Role "${roleName}" from template "${templateName}" does not exist in the Ministries sheet. ` +
          `Please add this role to the Ministries sheet with an appropriate Ministry Name, ` +
          `or update the "${templateName}" template to use a valid role.`
        );
      }

      const newRow = new Array(assignCols.STATUS).fill(""); // 13 columns (A-M), formulas in N-P

      newRow[assignCols.DATE - 1] = mass.date;
      newRow[assignCols.TIME - 1] = mass.time;
      newRow[assignCols.DESCRIPTION - 1] = mass.description;
      newRow[assignCols.LITURGICAL_CELEBRATION - 1] = liturgicalCelebration;
      newRow[assignCols.MINISTRY - 1] = ministryName;    // NEW: Ministry category (e.g., "Lector")
      newRow[assignCols.ROLE - 1] = roleName;            // Specific role (e.g., "1st reading")
      newRow[assignCols.EVENT_ID - 1] = mass.eventId || "";
      newRow[assignCols.IS_ANTICIPATED - 1] = mass.isAnticipated || false;
      newRow[assignCols.MONTH_YEAR - 1] = monthString;
      newRow[assignCols.ASSIGNED_GROUP - 1] = mass.assignedGroup || "";
      newRow[assignCols.ASSIGNED_VOLUNTEER_ID - 1] = "";
      newRow[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] = "";
      newRow[assignCols.STATUS - 1] = "Unassigned";
      // Helper formulas (Qualified?, Active?, Free?) in columns N-P

      newAssignmentRows.push(newRow);
    }
  }

  // 6. Write new rows to the sheet
  Logger.log(`6. Writing ${newAssignmentRows.length} new 'Unassigned' rows...`);
  if (newAssignmentRows.length > 0) {
    const startRow = assignmentsSheet.getLastRow() + 1;
    assignmentsSheet.getRange(
      startRow, // Start on the next available row
      1,
      newAssignmentRows.length,
      newAssignmentRows[0].length
    ).setValues(newAssignmentRows);

    // 7. Format IS_ANTICIPATED column as checkboxes
    Logger.log("7. Formatting IS_ANTICIPATED column as checkboxes...");
    const checkboxRange = assignmentsSheet.getRange(
      startRow,
      assignCols.IS_ANTICIPATED,  // Now column 8 (was 7)
      newAssignmentRows.length,
      1
    );
    const checkboxValidation = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .setAllowInvalid(false)
      .build();
    checkboxRange.setDataValidation(checkboxValidation);

    // 8. Ensure Assignments column L uses "Show warning" mode so group names
    //    (e.g. "School", "Spanish") can be entered without a hard rejection error.
    try {
      DROPDOWNS_setupAssignmentsVolunteerValidation();
    } catch (e) {
      Logger.log(`Warning: Could not update Assignments volunteer validation: ${e.message}`);
    }
  }

  Logger.log("Schedule generation complete.");
  return `Successfully DELETED all old assignments and generated ${newAssignmentRows.length} new unassigned roles for ${monthString}.`;
}

/**
 * Clears ALL rows for the given month/year, regardless of status.
 * This is now a destructive reset function.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The 'Assignments' sheet.
 * @param {string} monthString The month to clear (e.g., "2026-01").
 */
function SCHEDULE_clearOldAssignments(sheet, monthString) {
  const data = sheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const header = data.shift(); // Remove header
  
  const rowsToKeep = [];
  
  for (const row of data) {
    if (row[0] === "") continue; // Skip blank rows
    
    try {
      // *** MODIFIED LOGIC ***
      // Check the MonthYear column (e.g., "2026-01")
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      
      if (rowMonthYear === monthString) {
        // This row is for the month being cleared. DO NOT KEEP.
      } else {
        // This row is from a different month, so we keep it.
        rowsToKeep.push(row);
      }
      // *** END MODIFIED LOGIC ***

    } catch (e) {
      Logger.log(`Error processing row in SCHEDULE_clearOldAssignments: ${e} - Row: ${row}`);
      rowsToKeep.push(row); // Keep rows that cause errors
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
 * UPDATED: Now reads comma-separated roles from single column
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

    // Parse comma-separated roles
    const rolesRaw = row[templateCols.ROLES - 1];
    if (!rolesRaw) {
      Logger.log(`WARNING: Template '${templateName}' has no roles defined`);
      continue;
    }

    const roles = String(rolesRaw)
      .split(',')
      .map(r => r.trim())
      .filter(r => r !== '');

    // Add each role to the template
    for (const role of roles) {
      templateMap.get(templateName).push({
        skill: role
      });
    }
  }

  Logger.log(`> Built template map with ${templateMap.size} templates.`);
  return templateMap;
}

/**
 * Builds a map of liturgical celebrations for the month and spillover dates.
 */
function SCHEDULE_buildLiturgicalMap(month, year) {
  const liturgicalMap = new Map();
  
  try {
    const calData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    const calCols = CONSTANTS.COLS.CALENDAR;
    
    for (const row of calData) {
      const calDate = new Date(row[calCols.DATE - 1]);
      if (isNaN(calDate.getTime())) continue; // Skip invalid dates
      
      // Include this month AND the first few days of next month
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
 * Helper function to check if a date falls within a start/end range.
 * Handles blank dates as "all year".
 * @param {Date} dateToCheck The date of the mass being scheduled.
 * @param {Date | string} startDate The start date from the rule (can be invalid/blank).
 * @param {Date | string} endDate The end date from the rule (can be invalid/blank).
 * @returns {boolean} True if the mass should be scheduled.
 */
function HELPER_isDateInRange(dateToCheck, startDate, endDate) {
  // Ensure dateToCheck is valid
  if (!dateToCheck || isNaN(dateToCheck.getTime())) return false;
  
  const checkTime = dateToCheck.getTime();
  
  const startIsValid = startDate && !isNaN(new Date(startDate).getTime());
  const endIsValid = endDate && !isNaN(new Date(endDate).getTime());

  if (!startIsValid && !endIsValid) {
    return true; // No dates set, so it's active all year
  }
  
  if (startIsValid) {
    const startTime = new Date(startDate);
    startTime.setHours(0, 0, 0, 0); 
    if (checkTime < startTime.getTime()) {
      return false; // Date is before the start date
    }
  }
  
  if (endIsValid) {
    const endTime = new Date(endDate);
    endTime.setHours(23, 59, 59, 999);
    if (checkTime > endTime.getTime()) {
      return false; // Date is after the end date
    }
  }
  
  return true; // Date is within the range
}


/**
 * Helper function to find the specific date for a monthly rule
 */
function HELPER_findDateForMonthlyRule(year, month, weekOfMonth, dayOfWeek) {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayOfWeek);
  if (dayIndex === -1) return null;

  if (weekOfMonth === 'Last') {
    const lastDayOfMonth = new Date(year, month + 1, 0); 
    for (let d = lastDayOfMonth.getDate(); d >= 1; d--) {
      const dt = new Date(year, month, d, 12, 0, 0); // Use noon
      if (dt.getDay() === dayIndex) {
        return dt; // Found the last one
      }
    }
  } else {
    const weekNum = parseInt(weekOfMonth);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) return null; 
    
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d, 12, 0, 0); // Use noon
      if (dt.getDay() === dayIndex) {
        count++;
        if (count === weekNum) {
          return dt; // Found the Nth day
        }
      }
    }
  }
  
  return null; // Rule didn't match
}

/**
 * Finds all recurring and special masses for a given month using 3-layer logic.
 */
function SCHEDULE_findMassesForMonth(month, year) {
  let masses = []; // Use 'let' so we can filter
  const weeklyData = HELPER_readSheetData(CONSTANTS.SHEETS.WEEKLY_MASSES);
  const monthlyData = HELPER_readSheetData(CONSTANTS.SHEETS.MONTHLY_MASSES);
  const yearlyData = HELPER_readSheetData(CONSTANTS.SHEETS.YEARLY_MASSES);
  const calData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
  
  const weekCols = CONSTANTS.COLS.WEEKLY_MASSES;
  const monCols = CONSTANTS.COLS.MONTHLY_MASSES;
  const yearCols = CONSTANTS.COLS.YEARLY_MASSES;
  
  // --- 1. Find Weekly Masses (Baseline) ---
  Logger.log("Layer 1: Generating Weekly Masses");
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDayOfMonth = new Date(year, month, daysInMonth);
  const includeNextSunday = lastDayOfMonth.getDay() === 6;
  
  let endDay = daysInMonth;
  let endMonth = month;
  let endYear = year;
  
  if (includeNextSunday) {
    endDay = 7; 
    if (month === 11) { endMonth = 0; endYear = year + 1; }
    else { endMonth = month + 1; }
    Logger.log(`Including spillover dates through ${endYear}-${(endMonth + 1).toString().padStart(2, '0')}-07`);
  }
  
  // *** FIX: Check if Day 1 belongs to the previous month's spillover ***
  let startDay = 1;
  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
  if (firstDayOfMonth.getDay() === 0) { // If Day 1 is a Sunday
    const yesterday = new Date(firstDayOfMonth.getTime());
    yesterday.setDate(yesterday.getDate() - 1); // Get the last day of the previous month
    if (yesterday.getDay() === 6) { // If yesterday was a Saturday
      Logger.log(`Skipping Day 1 as it belongs to the previous month's spillover weekend.`);
      startDay = 2; // Start processing on Day 2
    }
  }
  // *** END FIX ***

  // Process current month, starting from the correct day
  for (let day = startDay; day <= daysInMonth; day++) { // <-- MODIFIED to use startDay
    const currentDate = new Date(year, month, day, 12, 0, 0); // Use noon
    const dayOfWeek = currentDate.toLocaleString('en-US', { weekday: 'long' });
    
    for (const row of weeklyData) {
      if (row[weekCols.IS_ACTIVE - 1] === false) continue; 
      
      if (row[weekCols.DAY_OF_WEEK - 1] === dayOfWeek) {
        const startDate = new Date(row[weekCols.START_DATE - 1]);
        const endDate = new Date(row[weekCols.END_DATE - 1]);
        if (!HELPER_isDateInRange(currentDate, startDate, endDate)) continue;
      
        masses.push({
          date: currentDate,
          time: row[weekCols.TIME - 1],
          description: row[weekCols.DESCRIPTION - 1] || dayOfWeek,
          templateName: row[weekCols.TEMPLATE_NAME - 1],
          eventId: row[weekCols.EVENT_ID - 1],
          isAnticipated: (row[weekCols.IS_ANTICIPATED - 1] === true),
          assignedGroup: row[weekCols.ASSIGNED_GROUP - 1] || "",
          notes: row[weekCols.NOTES - 1] || ""
        });
      }
    }
  }
  
  // Process spillover dates
  if (includeNextSunday) {
    for (let day = 1; day <= endDay; day++) {
      const currentDate = new Date(endYear, endMonth, day, 12, 0, 0); // Use noon
      if (currentDate.toLocaleDateString('en-US', { weekday: 'long' }) === 'Sunday') {
        for (const row of weeklyData) {
          if (row[weekCols.IS_ACTIVE - 1] === false) continue;
          if (row[weekCols.DAY_OF_WEEK - 1] === 'Sunday') {
            const startDate = new Date(row[weekCols.START_DATE - 1]);
            const endDate = new Date(row[weekCols.END_DATE - 1]);
            if (!HELPER_isDateInRange(currentDate, startDate, endDate)) continue;
          
            masses.push({
              date: currentDate,
              time: row[weekCols.TIME - 1],
              description: row[weekCols.DESCRIPTION - 1] || 'Sunday',
              templateName: row[weekCols.TEMPLATE_NAME - 1],
              eventId: row[weekCols.EVENT_ID - 1],
              isAnticipated: (row[weekCols.IS_ANTICIPATED - 1] === true),
              assignedGroup: row[weekCols.ASSIGNED_GROUP - 1] || "",
              notes: row[weekCols.NOTES - 1] || ""
            });
          }
        }
        break; 
      }
    }
  }
  Logger.log(`> Found ${masses.length} weekly mass instances.`);

  // --- 2. Find and Apply Monthly Masses ---
  Logger.log("Layer 2: Applying Monthly Mass Rules");
  const monthlyMassesToAdd = []; 
  for (const row of monthlyData) {
    if (row[monCols.IS_ACTIVE - 1] === false) continue;

    const weekOfMonth = row[monCols.WEEK_OF_MONTH - 1];
    const dayOfWeek = row[monCols.DAY_OF_WEEK - 1];
    // Find the date for the *current* month
    const specialDate = HELPER_findDateForMonthlyRule(year, month, weekOfMonth, dayOfWeek);
    
    // Find if the date for the *next* month (for spillover) is also needed
    let spilloverDate = null;
    if (includeNextSunday && endMonth !== month) {
      const spilloverRuleDate = HELPER_findDateForMonthlyRule(endYear, endMonth, weekOfMonth, dayOfWeek);
      if (spilloverRuleDate && spilloverRuleDate.getDate() <= 7 && spilloverRuleDate.getDay() === 0) { // Only Sunday spillover
         spilloverDate = spilloverRuleDate;
      }
    }
    
    const datesToProcess = [];
    if(specialDate) datesToProcess.push(specialDate);
    if(spilloverDate) datesToProcess.push(spilloverDate);

    if (datesToProcess.length === 0) continue;
    
    for (const dateToProcess of datesToProcess) {
      
      // *** FIX: Skip Day 1 if it's a spillover day ***
      if (startDay === 2 && dateToProcess.getDate() === 1 && dateToProcess.getMonth() === month) {
        Logger.log(`> Skipping Monthly rule ${row[monCols.EVENT_ID - 1]} because it lands on spillover Day 1.`);
        continue;
      }
      
      const startDate = new Date(row[monCols.START_DATE - 1]);
      const endDate = new Date(row[monCols.END_DATE - 1]);
      if (!HELPER_isDateInRange(dateToProcess, startDate, endDate)) continue;

      const dateKey = dateToProcess.toDateString();
      const overrideType = (row[monCols.OVERRIDE_TYPE - 1] || '').toLowerCase();
      
      if (overrideType === 'overrideday') {
        Logger.log(`Applying MONTHLY OVERRIDE for ${dateKey}`);
        masses = masses.filter(m => m.date.toDateString() !== dateKey);
      } else {
        Logger.log(`Applying MONTHLY APPEND for ${dateKey}`);
        const specialTime = new Date(row[monCols.TIME - 1]).toTimeString();
        masses = masses.filter(m => {
          const isMatch = m.date.toDateString() === dateKey && new Date(m.time).toTimeString() === specialTime;
          if (isMatch) Logger.log(`> Replacing weekly mass at ${specialTime}`);
          return !isMatch;
        });
      }

      monthlyMassesToAdd.push({
        date: dateToProcess,
        time: row[monCols.TIME - 1],
        description: row[monCols.DESCRIPTION - 1] || "",
        templateName: row[monCols.TEMPLATE_NAME - 1],
        eventId: row[monCols.EVENT_ID - 1],
        isAnticipated: (row[monCols.IS_ANTICIPATED - 1] === true),
        assignedGroup: row[monCols.ASSIGNED_GROUP - 1] || "",
        notes: row[monCols.NOTES - 1] || ""
      });
      Logger.log(`DEBUG: Added monthly mass - ${row[monCols.EVENT_ID - 1]} on ${dateKey}`);
    }
  }
  masses.push(...monthlyMassesToAdd);


  // --- 3. Find and Apply Yearly (Date-Specific) Masses ---
  Logger.log("Layer 3: Applying Yearly Mass Rules (with Liturgy Lookup)");
  
  const liturgyDateMap = new Map();
  const calCols = CONSTANTS.COLS.CALENDAR;
  for (const row of calData) {
    const calDate = new Date(row[calCols.DATE - 1]);
    if (isNaN(calDate.getTime())) continue;
    
    // Map dates for the *current schedule year* AND the *next* year (for spillover)
    if (calDate.getFullYear() === year || calDate.getFullYear() === year + 1) { 
      const celebrationName = row[calCols.LITURGICAL_CELEBRATION - 1];
      if (celebrationName && !liturgyDateMap.has(celebrationName)) {
        liturgyDateMap.set(celebrationName, setDateToNoon(calDate)); // Store at noon
      }
    }
  }
  Logger.log(`> Built Liturgy-to-Date map with ${liturgyDateMap.size} entries.`);

  const yearlyMassesByDate = new Map();
  
  for (const row of yearlyData) {
    if (row[yearCols.IS_ACTIVE - 1] === false) continue; 

    let specialDate = null;
    const liturgyMatch = row[yearCols.LITURGICAL_CELEBRATION - 1];
    const staticDate = new Date(row[yearCols.DATE - 1]);

    if (liturgyMatch) {
      specialDate = liturgyDateMap.get(liturgyMatch);
      if (!specialDate) {
        Logger.log(`WARNING: Could not find LiturgicalCelebration "${liturgyMatch}" in calendar for EventID ${row[yearCols.EVENT_ID - 1]}. Skipping.`);
        continue;
      }

      // NEW: If this is an anticipated mass, place it on the day BEFORE the liturgical celebration
      const isAnticipated = row[yearCols.IS_ANTICIPATED - 1] === true;
      if (isAnticipated) {
        specialDate = new Date(specialDate.getTime() - 24 * 60 * 60 * 1000); // Subtract one day
        specialDate.setHours(12, 0, 0, 0); // Keep at noon for consistency
        Logger.log(`> Adjusted anticipated mass ${row[yearCols.EVENT_ID - 1]} to previous day: ${specialDate.toDateString()}`);
      }
    } else if (!isNaN(staticDate.getTime())) {
      specialDate = setDateToNoon(staticDate); // Use static date, set to noon
    } else {
      continue;
    }
    
    // *** FIX: Skip Day 1 if it's a spillover day ***
    if (startDay === 2 && specialDate.getDate() === 1 && specialDate.getMonth() === month) {
      Logger.log(`> Skipping Yearly rule ${row[yearCols.EVENT_ID - 1]} because it lands on spillover Day 1.`);
      continue;
    }

    const inMonth = (specialDate.getFullYear() === year && specialDate.getMonth() === month);
    const inSpillover = (includeNextSunday && specialDate.getFullYear() === endYear && specialDate.getMonth() === endMonth && specialDate.getDate() <= endDay);

    if (!inMonth && !inSpillover) continue; 
    
    const dateKey = specialDate.toDateString();
    if (!yearlyMassesByDate.has(dateKey)) {
      yearlyMassesByDate.set(dateKey, []);
    }
    yearlyMassesByDate.get(dateKey).push({ row: row, calculatedDate: specialDate });
  }

  const yearlyMassesToAdd = [];
  for (const [dateKey, yearlyMassItems] of yearlyMassesByDate) {
    
    const isOverrideDay = yearlyMassItems.some(item =>
      (item.row[yearCols.OVERRIDE_TYPE - 1] || '').toLowerCase() === 'override'
    );

    if (isOverrideDay) {
      Logger.log(`Applying YEARLY OVERRIDE for ${dateKey}`);
      masses = masses.filter(m => m.date.toDateString() !== dateKey);
    } else {
      Logger.log(`Applying YEARLY APPEND for ${dateKey}`);
      for (const item of yearlyMassItems) {
        const specialTime = new Date(item.row[yearCols.TIME - 1]).toTimeString();
        masses = masses.filter(m => {
          const isMatch = m.date.toDateString() === dateKey && new Date(m.time).toTimeString() === specialTime;
          if (isMatch) Logger.log(`> Replacing existing mass at ${specialTime}`);
          return !isMatch;
        });
      }
    }

    for (const item of yearlyMassItems) {
      const specialRow = item.row;
      yearlyMassesToAdd.push({
        date: item.calculatedDate, // Use the correct calculated date
        time: specialRow[yearCols.TIME - 1],
        description: specialRow[yearCols.DESCRIPTION - 1] || "",
        templateName: specialRow[yearCols.TEMPLATE_NAME - 1],
        eventId: specialRow[yearCols.EVENT_ID - 1],
        isAnticipated: (specialRow[yearCols.IS_ANTICIPATED - 1] === true),
        assignedGroup: specialRow[yearCols.ASSIGNED_GROUP - 1] || "",
        notes: specialRow[yearCols.NOTES - 1] || ""
      });
      Logger.log(`DEBUG: Added yearly mass - ${specialRow[yearCols.EVENT_ID - 1]} on ${dateKey}`);
    }
  }
  masses.push(...yearlyMassesToAdd);

  Logger.log(`> Found ${masses.length} total masses to schedule after all 3 layers.`);

  // --- 4. SORTING ---
  masses.sort((a, b) => {
    // Handle potential invalid date/time values during sort
    try {
      const timeA = new Date(a.time);
      const fullDateA = new Date(a.date.getTime());
      fullDateA.setHours(timeA.getHours(), timeA.getMinutes(), timeA.getSeconds());

      const timeB = new Date(b.time);
      const fullDateB = new Date(b.date.getTime());
      fullDateB.setHours(timeB.getHours(), timeB.getMinutes(), timeB.getSeconds());

      if (isNaN(fullDateA.getTime()) || isNaN(fullDateB.getTime())) return 0;

      return fullDateA.getTime() - fullDateB.getTime();
    } catch (e) {
      return 0; // Don't crash on invalid dates
    }
  });

  return masses;
}

/**
 * Helper function to set a date to noon (local time) to avoid timezone bugs.
 */
function setDateToNoon(date) {
  if (!date || isNaN(new Date(date).getTime())) {
    return null; // Handle invalid dates
  }
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}
