/**
 * ====================================================================
 * 3. AUTO-ASSIGNMENT LOGIC
 * ====================================================================
 * This file contains all logic for "Step 2: Auto-Assign Volunteers".
 * It reads the "Unassigned" roles and intelligently assigns them
 * based on volunteer skills, preferences, and time off.
 */

/**
 * Main function to auto-assign roles for a given month.
 * Called by Code.gs wrapper.
 * @param {string} monthString A string like "2026-01" (for Jan 2026).
 * @returns {string} A success message.
 */
function ASSIGNMENT_autoAssignRolesForMonth(monthString) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  
  // 1. Get the year we are scheduling
  const config = HELPER_readConfig();
  const scheduleYear = config["Year to Schedule"];
  const selectedDate = new Date(monthString + "-01T12:00:00");
  const month = selectedDate.getMonth();
  
  if (selectedDate.getFullYear() != scheduleYear) {
    throw new Error(`The selected month (${monthString}) is not in the configured schedule year (${scheduleYear}). Please check the 'Config' sheet.`);
  }
  
  Logger.log(`Starting auto-assignment for: ${monthString}`);
  
  // 2. Read all required data
  const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
  const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
  
  // 3. Build lookup maps
  const volunteers = ASSIGNMENT_buildVolunteerMap(volunteerData);
  const timeoffMap = ASSIGNMENT_buildTimeoffMap(timeoffData, month, scheduleYear);
  
  // 4. Get all assignments for the *entire year* to calculate frequency
  // We get all rows at once for efficiency.
  const allAssignmentData = assignmentsSheet.getRange(2, 1, assignmentsSheet.getLastRow() - 1, assignmentsSheet.getLastColumn()).getValues();
  
  // 5. Get the specific "Unassigned" rows for the selected month
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const unassignedRows = []; // Stores the full row data
  const unassignedRowIndexes = []; // Stores the 1-based sheet row index
  
  for (let i = 0; i < allAssignmentData.length; i++) {
    const row = allAssignmentData[i];
    if (!row[assignCols.DATE - 1]) continue; // Skip blank rows
    
    const assignStatus = row[assignCols.STATUS - 1];
    const assignMonthYear = row[assignCols.MONTH_YEAR - 1];
    
    if (assignMonthYear === monthString && assignStatus === "Unassigned") {
      unassignedRows.push(row);
      unassignedRowIndexes.push(i + 2); // +2 because sheet is 1-indexed and we skipped header
    }
  }
  
  if (unassignedRows.length === 0) {
    Logger.log("No 'Unassigned' rows found for this month.");
    return "No 'Unassigned' rows found for this month.";
  }
  
  Logger.log(`Found ${unassignedRows.length} roles to fill.`);
  
  // 6. Build volunteer assignment counts for frequency tracking
  const assignmentCounts = ASSIGNMENT_buildAssignmentCounts(allAssignmentData);
  
  // 7. --- The Core Assignment Loop ---
  let assignmentsMade = 0;
  let assignmentsSkipped = 0;
  
  // We loop by *sheet row index* so we can write back to the correct row
  for (let i = 0; i < unassignedRowIndexes.length; i++) {
    const sheetRowIndex = unassignedRowIndexes[i];
    const rowData = unassignedRows[i];
    
    const roleToFill = rowData[assignCols.MINISTRY_ROLE - 1]; // e.g., "1st Reading"
    const massDate = new Date(rowData[assignCols.DATE - 1]);
    
    // Get the skill required for this role from MassTemplates
    const skillToFill = ASSIGNMENT_getSkillForRole(roleToFill);
    
    if (!skillToFill) {
      Logger.log(`Warning: No skill found for role "${roleToFill}". Skipping.`);
      assignmentsSkipped++;
      continue;
    }
    
    // Find a volunteer for this role
    const assignedVolunteer = ASSIGNMENT_findVolunteerForRole(
      skillToFill,
      massDate,
      volunteers,
      timeoffMap,
      assignmentCounts
    );
    
    if (assignedVolunteer) {
      // 8. --- Write the assignment to the sheet ---
      assignmentsSheet.getRange(sheetRowIndex, assignCols.ASSIGNED_VOLUNTEER_ID).setValue(assignedVolunteer.id);
      assignmentsSheet.getRange(sheetRowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(assignedVolunteer.name);
      assignmentsSheet.getRange(sheetRowIndex, assignCols.STATUS).setValue("Assigned");
      
      // 9. Update our local tracking data
      if (!assignmentCounts.has(assignedVolunteer.id)) {
         assignmentCounts.set(assignedVolunteer.id, { total: 0, recent: new Date(0) });
      }
      assignmentCounts.get(assignedVolunteer.id).total++;
      assignmentCounts.get(assignedVolunteer.id).recent = massDate;
      
      assignmentsMade++;
      Logger.log(`Assigned ${assignedVolunteer.name} to ${roleToFill} on ${massDate.toDateString()}`);
    } else {
      // Could not find anyone for this slot
      assignmentsSkipped++;
      Logger.log(`Could not find volunteer for ${roleToFill} on ${massDate.toDateString()}`);
    }
  }
  
  Logger.log(`Finished auto-assignment. Made: ${assignmentsMade}, Skipped: ${assignmentsSkipped}`);
  return `Assignment complete! Filled ${assignmentsMade} roles. ${assignmentsSkipped} roles remain unassigned.`;
}

/**
 * Gets the skill required for a ministry role from the MassTemplates sheet.
 * @param {string} roleName The role name (e.g., "1st Reading").
 * @returns {string|null} The skill name (e.g., "Lector") or null if not found.
 */
function ASSIGNMENT_getSkillForRole(roleName) {
  const templateData = HELPER_readSheetData(CONSTANTS.SHEETS.TEMPLATES);
  const templateCols = CONSTANTS.COLS.TEMPLATES;
  
  for (const row of templateData) {
    const templateRole = row[templateCols.MINISTRY_ROLE - 1];
    const templateSkill = row[templateCols.MINISTRY_SKILL - 1];
    
    if (templateRole === roleName) {
      return templateSkill;
    }
  }
  
  return null; // Role not found
}

/**
 * Builds a map of volunteer objects from the sheet data for fast lookups.
 * @param {Array<Array<any>>} volunteerData 2D array from 'Volunteers' sheet.
 * @returns {Map<string, object>} A map where key is VolunteerID
 */
function ASSIGNMENT_buildVolunteerMap(volunteerData) {
  const volMap = new Map();
  const cols = CONSTANTS.COLS.VOLUNTEERS;
  
  for (const row of volunteerData) {
    const id = row[cols.VOLUNTEER_ID - 1];
    if (!id) continue;
    
    const ministries = (row[cols.MINISTRIES - 1] || "").split(',').map(s => s.trim().toLowerCase());
    const massPrefs = (row[cols.PREFERRED_MASS_TIME - 1] || "").split(',').map(s => s.trim());
    
    volMap.set(id, {
      id: id,
      name: row[cols.FULL_NAME - 1],
      email: row[cols.EMAIL - 1],
      family: row[cols.FAMILY_TEAM - 1] || null,
      ministries: ministries, // Stored as lowercase
      massPrefs: massPrefs
    });
  }
  Logger.log(`Built volunteer map with ${volMap.size} volunteers.`);
  return volMap;
}

/**
 * Builds a map of volunteer time-offs for the specific month being scheduled.
 * @param {Array<Array<any>>} timeoffData 2D array from 'Timeoffs' sheet.
 * @param {number} month The month being scheduled (0-indexed).
 * @param {number} year The year being scheduled.
 * @returns {Map<string, Array<Date>>} A map where key is Volunteer Name
 * and value is an array of Date objects they are unavailable.
 */
function ASSIGNMENT_buildTimeoffMap(timeoffData, month, year) {
  const timeoffMap = new Map();
  const cols = CONSTANTS.COLS.TIMEOFFS;
  
  for (const row of timeoffData) {
    const name = row[cols.VOLUNTEER_NAME - 1];
    const type = row[cols.TYPE - 1];
    const startDate = new Date(row[cols.START_DATE - 1]);
    const endDate = new Date(row[cols.END_DATE - 1]);
    
    if (!name || !type || !startDate.getTime() || !endDate.getTime()) continue;

    if (!timeoffMap.has(name)) {
      timeoffMap.set(name, []);
    }
    
    // Add all dates in the range to the map
    let currentDate = new Date(startDate.setHours(0,0,0,0));
    let zonedEndDate = new Date(endDate.setHours(0,0,0,0));
    
    while (currentDate <= zonedEndDate) {
      // Only add dates that are in the month we are scheduling
      if (currentDate.getMonth() === month && currentDate.getFullYear() === year) {
        timeoffMap.get(name).push(new Date(currentDate.getTime())); // Add a *copy* of the date
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  Logger.log(`Built timeoff map. ${timeoffMap.size} volunteers have time off this month.`);
  return timeoffMap;
}

/**
 * Builds a map tracking how many times each volunteer has been assigned.
 * @param {Array<Array<any>>} allAssignmentData 2D array from 'Assignments' sheet.
 * @returns {Map<string, object>} A map where key is VolunteerID
 * and value is { total: number, recent: Date }.
 */
function ASSIGNMENT_buildAssignmentCounts(allAssignmentData) {
  const counts = new Map();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  
  for (const row of allAssignmentData) {
    const id = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
    const status = row[assignCols.STATUS - 1];
    if (!row[assignCols.DATE - 1]) continue;
    const date = new Date(row[assignCols.DATE - 1]);
    
    if (id && status === "Assigned") {
      if (!counts.has(id)) {
        counts.set(id, { total: 0, recent: new Date(0) });
      }
      counts.get(id).total++;
      if (date > counts.get(id).recent) {
        counts.get(id).recent = date;
      }
    }
  }
  Logger.log(`Built assignment counts.`);
  return counts;
}

/**
 * The core scheduling algorithm. Finds the "best" volunteer for a single role.
 * @param {string} skillToFill The name of the ministry skill needed (e.g., "Lector").
 * @param {Date} massDate The date of the mass.
 * @param {Map} volunteers The main volunteer map.
 * @param {Map} timeoffMap The timeoff map.
 * @param {Map} assignmentCounts The frequency map.
 * @returns {object|null} The volunteer object {id, name} or null if none found.
 */
function ASSIGNMENT_findVolunteerForRole(skillToFill, massDate, volunteers, timeoffMap, assignmentCounts) {
  
  let candidates = [];
  const massDateZeroed = new Date(massDate.setHours(0,0,0,0));
  const skillLower = skillToFill.toLowerCase();
  
  // --- 1. Filter: Find all volunteers who *can* do the job ---
  for (const vol of volunteers.values()) {
    // A. Check skill
    if (!vol.ministries.includes(skillLower)) {
      continue;
    }
    
    // B. Check time off
    const timeoffs = timeoffMap.get(vol.name) || [];
    let isOff = false;
    for (const offDate of timeoffs) {
      if (offDate.getTime() === massDateZeroed.getTime()) {
        isOff = true;
        break;
      }
    }
    if (isOff) {
      continue;
    }

    // C. Check if already assigned on this day
    const counts = assignmentCounts.get(vol.id) || { total: 0, recent: new Date(0) };
    
    if (counts.recent.getTime() === massDateZeroed.getTime()) {
       continue; // Already assigned today, skip
    }
    
    // This volunteer is a valid candidate
    candidates.push({
      vol: vol,
      score: 100 // Start with a base score
    });
  }
  
  if (candidates.length === 0) return null;

  // --- 2. Score: Rank the qualified candidates ---
  for (const candidate of candidates) {
    const vol = candidate.vol;
    const counts = assignmentCounts.get(vol.id) || { total: 0, recent: new Date(0) };

    // Penalize for high frequency (spread the work)
    candidate.score -= counts.total * 5; // Each assignment = -5 points
  }
  
  // --- 3. Sort: Find the best candidate ---
  candidates.sort((a, b) => b.score - a.score);
  
  const bestVolunteer = candidates[0].vol;
  
  return {
    id: bestVolunteer.id,
    name: bestVolunteer.name
  };
}
