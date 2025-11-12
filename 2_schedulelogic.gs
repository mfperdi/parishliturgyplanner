/**
 * ====================================================================
 * 2. SCHEDULE GENERATION LOGIC (ENHANCED WITH EVENTID SUPPORT)
 * ====================================================================
 * This file contains all logic for "Step 1: Generate Schedule".
* It reads mass templates and recurring/special masses to create
 * all the "Unassigned" rows for a given month.
* * ENHANCED: Now properly populates EventID column for mass preference matching.
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
  
  const selectedDate = new Date(monthString + "-01T12:00:00");
// Use noon to avoid timezone issues
  const month = selectedDate.getMonth();
// 0-indexed month
  
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
// If this is an anticipated Mass, ALWAYS get the liturgical celebration from the next day
    if (mass.isAnticipated) {
      const nextDay = new Date(mass.date.getTime() + 24 * 60 * 60 * 1000);
const nextDayKey = `${nextDay.getFullYear()}-${(nextDay.getMonth() + 1).toString().padStart(2, '0')}-${nextDay.getDate().toString().padStart(2, '0')}`;
      const nextDayLiturgy = liturgicalMap.get(nextDayKey);
if (nextDayLiturgy) {
        liturgicalCelebration = nextDayLiturgy;
Logger.log(`DEBUG: Anticipated Mass on ${mass.date.toDateString()} uses liturgy from ${nextDay.toDateString()}: ${liturgicalCelebration}`);
} else {
        Logger.log(`WARNING: Could not find liturgy for next day ${nextDay.toDateString()} for anticipated Mass on ${mass.date.toDateString()}`);
// Still use next day logic - build from scratch if needed
        const sundayOrdinal = Math.ceil(nextDay.getDate() / 7);
liturgicalCelebration = `${sundayOrdinal}${sundayOrdinal === 1 ? 'st' : sundayOrdinal === 2 ? 'nd' : sundayOrdinal === 3 ?
'rd' : 'th'} Sunday in Ordinary Time`;
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
  const header = data.shift();
// Remove header
  
  const rowsToKeep = [];
for (const row of data) {
    if (row[0] === "") continue;
// Skip blank rows
    
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
 * Finds all recurring and special masses for a given month.
 * THIS FUNCTION IS COMPLETELY REWRITTEN TO USE THE NEW LOGIC
 * * @param {number} month The month (0-indexed).
* @param {number} year The year.
 * @returns {Array<object>} An array of mass objects {date, time, description, templateName, eventId, isAnticipated, notes}.
 */
function SCHEDULE_findMassesForMonth(month, year) {
  const masses = [];
  const recurringData = HELPER_readSheetData(CONSTANTS.SHEETS.RECURRING_MASSES);
  const specialData = HELPER_readSheetData(CONSTANTS.SHEETS.SPECIAL_MASSES);
  // REMOVED: calData is no longer needed for this logic
  
  const recCols = CONSTANTS.COLS.RECURRING_MASSES;
  const specCols = CONSTANTS.COLS.SPECIAL_MASSES;
  
  // --- 1. Find Recurring Masses ---
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // Get last day of month
  
  // Check if we need to include the first Sunday of next month
  const lastDayOfMonth = new Date(year, month, daysInMonth);
  const includeNextSunday = lastDayOfMonth.getDay() === 6; // Last day is Saturday
  
  let endDay = daysInMonth;
  let endMonth = month;
  let endYear = year;
  
  if (includeNextSunday) {
    // Include first Sunday of next month for weekend masses
    endDay = 7; // First week of next month
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
    
    for (const row of recurringData) {
      const isActive = row[recCols.IS_ACTIVE - 1];
      if (isActive === false) continue; // Skip if explicitly set to FALSE
      
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
          eventId: row[recCols.EVENT_ID - 1],
           isAnticipated: isAnticipated,
          assignedGroup: row[recCols.ASSIGNED_GROUP - 1] || "",
          notes: row[recCols.NOTES - 1] || ""
        });
        // Logger.log(`DEBUG: Added recurring mass - ${dayOfWeek} ${row[recCols.TIME - 1]} (${row[recCols.EVENT_ID - 1]}) - Anticipated: ${isAnticipated}`);
      }
    }
  }
  
  // Process spillover dates if needed (first week of next month for weekend completion)
  if (includeNextSunday) {
    for (let day = 1; day <= endDay; day++) {
      const currentDate = new Date(endYear, endMonth, day);
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Only include Sunday masses for spillover
      if (dayOfWeek === 'Sunday') {
        for (const row of recurringData) {
          const isActive = row[recCols.IS_ACTIVE - 1];
          if (isActive === false) continue;
          
          const recurringDay = row[recCols.DAY_OF_WEEK - 1];
          if (recurringDay === dayOfWeek) {
            let isAnticipated = false;
            const anticipatedValue = row[recCols.IS_ANTICIPATED - 1];
            if (anticipatedValue === true || anticipatedValue === "TRUE" || anticipatedValue === "true" || anticipatedValue === 1) {
              isAnticipated = true;
            }
            
            masses.push({
              date: currentDate,
              time: row[recCols.TIME - 1],
              description: row[recCols.DESCRIPTION - 1] || dayOfWeek,
              templateName: row[recCols.TEMPLATE_NAME - 1],
              eventId: row[recCols.EVENT_ID - 1],
              isAnticipated: isAnticipated,
              assignedGroup: row[recCols.ASSIGNED_GROUP - 1] || "",
              notes: row[recCols.NOTES - 1] || ""
            });
            // Logger.log(`DEBUG: Added spillover Sunday mass - ${currentDate.toDateString()} ${row[recCols.TIME - 1]} (${row[recCols.EVENT_ID - 1]})`);
          }
        }
        break; // Only need the first Sunday
      }
    }
  }

  // --- 2. Find and Apply Special Masses (NEW LOGIC) ---
  // This logic is now driven by the 'SpecialMasses' sheet, using the
  // 'Date' and 'OverrideType' columns.

  const specialMassesByDate = new Map();
  
  // First, group all valid special masses by their date
  for (const row of specialData) {
    const isActive = row[specCols.IS_ACTIVE - 1];
    if (isActive === false) continue; // Skip inactive

    const specialDate = new Date(row[specCols.DATE - 1]);
    if (isNaN(specialDate.getTime())) continue; // Skip rows with blank or invalid dates

    // Check if the date is in our scheduling window (this month + spillover)
    const inMonth = (specialDate.getFullYear() === year && specialDate.getMonth() === month);
    const inSpillover = (includeNextSunday && specialDate.getFullYear() === endYear && specialDate.getMonth() === endMonth && specialDate.getDate() <= endDay);

    if (!inMonth && !inSpillover) continue; // Skip if not in this month's schedule
    
    // Add the mass to its date group
    const dateKey = specialDate.toDateString();
    if (!specialMassesByDate.has(dateKey)) {
      specialMassesByDate.set(dateKey, []);
    }
    specialMassesByDate.get(dateKey).push(row);
  }

  // Now, process each date that has special masses
  for (const [dateKey, specialMassRows] of specialMassesByDate) {
    const specialDate = new Date(dateKey); // The date we're processing

    // Check if *any* mass for this day is an "Override"
    const isOverrideDay = specialMassRows.some(row =>
      (row[specCols.OVERRIDE_TYPE - 1] || '').toLowerCase() === 'override'
    );

    if (isOverrideDay) {
      // --- Type 2: Override Logic ---
      // Delete ALL recurring masses for this date
      Logger.log(`Applying OVERRIDE for ${dateKey}`);
      for (let i = masses.length - 1; i >= 0; i--) {
        if (masses[i].date.toDateString() === dateKey) {
          masses.splice(i, 1);
        }
      }
    } else {
      // --- Type 1: Append/Sponsorship Logic ---
      // Delete ONLY the specific recurring masses that are being replaced
      Logger.log(`Applying APPEND for ${dateKey}`);
      for (const specialRow of specialMassRows) {
        // We must compare times. Google Sheet times can be tricky.
        const specialTime = new Date(specialRow[specCols.TIME - 1]).toTimeString();
        
        for (let i = masses.length - 1; i >= 0; i--) {
          const recurringTime = new Date(masses[i].time).toTimeString();
          if (masses[i].date.toDateString() === dateKey && recurringTime === specialTime) {
            Logger.log(`> Replacing recurring mass at ${specialTime}`);
            masses.splice(i, 1);
            break; // Found and removed the one recurring mass, stop looking
          }
        }
      }
    }

    // --- Finally, Add the Special Masses ---
    // (This happens for both Override and Append)
    for (const specialRow of specialMassRows) {
      let isAnticipated = false;
      const anticipatedValue = specialRow[specCols.IS_ANTICIPATED - 1];
      if (anticipatedValue === true || anticipatedValue === "TRUE" || anticipatedValue === "true" || anticipatedValue === 1) {
        isAnticipated = true;
      }

      masses.push({
        date: specialDate,
        time: specialRow[specCols.TIME - 1],
        description: specialRow[specCols.DESCRIPTION - 1] || "",
        templateName: specialRow[specCols.TEMPLATE_NAME - 1],
        eventId: specialRow[specCols.EVENT_ID - 1],
        isAnticipated: isAnticipated,
        assignedGroup: specialRow[specCols.ASSIGNED_GROUP - 1] || "",
        notes: specialRow[specCols.NOTES - 1] || ""
      });
      Logger.log(`DEBUG: Added special mass - ${specialRow[specCols.EVENT_ID - 1]} on ${dateKey}`);
    }
  }

  Logger.log(`> Found ${masses.length} total masses to schedule.`);
  return masses;
}
