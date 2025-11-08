/**
 * ====================================================================
 * 3. AUTO-ASSIGNMENT LOGIC (ENHANCED WITH MASS PREFERENCES)
 * ====================================================================
 * This file contains all logic for "Step 2: Auto-Assign Volunteers".
 * It reads the "Unassigned" roles and intelligently assigns them
 * based on volunteer skills, preferences, and time off.
 * 
 * ENHANCED: Now includes PreferredMassTime logic for better assignments.
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
  
  Logger.log(`DEBUG: Read ${volunteerData.length} volunteer rows and ${timeoffData.length} timeoff rows`);
  
  // 3. Build lookup maps
  const volunteers = ASSIGNMENT_buildVolunteerMap(volunteerData);
  const timeoffMap = ASSIGNMENT_buildTimeoffMap(timeoffData, month, scheduleYear);
  
  if (volunteers.size === 0) {
    Logger.log(`ERROR: No active volunteers found! Check Volunteers sheet Status column.`);
    return "No active volunteers found. Check that volunteers have Status = 'Active' in Volunteers sheet.";
  }
  
  // 4. Get all assignments for the *entire year* to calculate frequency
  const allAssignmentData = assignmentsSheet.getRange(2, 1, assignmentsSheet.getLastRow() - 1, assignmentsSheet.getLastColumn()).getValues();
  
  Logger.log(`DEBUG: Read ${allAssignmentData.length} assignment rows`);
  
  // 5. Get the specific "Unassigned" rows for the selected month
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const unassignedRows = []; 
  const unassignedRowIndexes = []; 
  
  for (let i = 0; i < allAssignmentData.length; i++) {
    const row = allAssignmentData[i];
    if (!row[assignCols.DATE - 1]) continue;
    
    const assignStatus = row[assignCols.STATUS - 1];
    const assignMonthYear = row[assignCols.MONTH_YEAR - 1];
    
    if (assignMonthYear === monthString && assignStatus === "Unassigned") {
      unassignedRows.push(row);
      unassignedRowIndexes.push(i + 2);
    }
  }
  
  if (unassignedRows.length === 0) {
    Logger.log(`ERROR: No 'Unassigned' rows found for ${monthString}. Check that assignments exist with Status = 'Unassigned' and MonthYear = '${monthString}'`);
    return `No 'Unassigned' rows found for ${monthString}. Check assignment Status and MonthYear columns.`;
  }
  
  Logger.log(`Found ${unassignedRows.length} unassigned roles to fill.`);
  
  // Debug: Show first few roles
  for (let i = 0; i < Math.min(3, unassignedRows.length); i++) {
    const row = unassignedRows[i];
    Logger.log(`DEBUG Role ${i+1}: ${row[assignCols.MINISTRY_ROLE - 1]} on ${new Date(row[assignCols.DATE - 1]).toDateString()}`);
  }
  
  // 6. Build volunteer assignment counts for frequency tracking
  const assignmentCounts = ASSIGNMENT_buildAssignmentCounts(allAssignmentData);
  
  // 7. --- The Core Assignment Loop ---
  let assignmentsMade = 0;
  let assignmentsSkipped = 0;
  
  for (let i = 0; i < unassignedRowIndexes.length; i++) {
    const sheetRowIndex = unassignedRowIndexes[i];
    const rowData = unassignedRows[i];
    
    const roleToFill = rowData[assignCols.MINISTRY_ROLE - 1];
    const massDate = new Date(rowData[assignCols.DATE - 1]);
    const eventId = rowData[assignCols.EVENT_ID - 1]; // Get the EventID for this mass
    
    Logger.log(`DEBUG: Trying to fill "${roleToFill}" on ${massDate.toDateString()} for EventID: ${eventId}`);
    
    // Find a volunteer for this role (now includes eventId for preference matching)
    const assignedVolunteer = ASSIGNMENT_findVolunteerForRole(
      roleToFill,
      massDate,
      volunteers,
      timeoffMap,
      assignmentCounts,
      eventId  // NEW: Pass the EventID for mass preference matching
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
      Logger.log(`SUCCESS: Assigned ${assignedVolunteer.name} to ${roleToFill} on ${massDate.toDateString()}`);
    } else {
      assignmentsSkipped++;
      Logger.log(`FAILED: Could not find volunteer for ${roleToFill} on ${massDate.toDateString()}`);
    }
  }
  
  Logger.log(`Finished auto-assignment. Made: ${assignmentsMade}, Skipped: ${assignmentsSkipped}`);
  return `Assignment complete! Filled ${assignmentsMade} roles. ${assignmentsSkipped} roles remain unassigned.`;
}

/**
 * Builds a map of volunteer objects from the sheet data for fast lookups.
 * @param {Array<Array<any>>} volunteerData 2D array from 'Volunteers' sheet.
 * @returns {Map<string, object>} A map where key is VolunteerID
 */
function ASSIGNMENT_buildVolunteerMap(volunteerData) {
  const volMap = new Map();
  const cols = CONSTANTS.COLS.VOLUNTEERS;
  
  Logger.log(`DEBUG: Building volunteer map from ${volunteerData.length} rows`);
  
  for (const row of volunteerData) {
    const id = row[cols.VOLUNTEER_ID - 1];
    if (!id) {
      Logger.log(`DEBUG: Skipping row with no VolunteerID`);
      continue;
    }
    
    const status = String(row[cols.STATUS - 1] || "").toLowerCase();
    const name = row[cols.FULL_NAME - 1];
    const ministryRole = row[cols.MINISTRY_ROLE - 1];
    
    Logger.log(`DEBUG: Volunteer ${id} (${name}) - Status: "${status}", MinistryRole: "${ministryRole}"`);
    
    if (status !== "active") {
      Logger.log(`Excluding volunteer from auto-assignment: ${name} (Status: ${status})`);
      continue;
    }
    
    const ministries = (ministryRole || "").split(',').map(s => s.trim().toLowerCase());
    
    // ENHANCED: Parse PreferredMassTime and clean up the data
    const massPrefsRaw = row[cols.PREF_MASS_TIME - 1] || "";
    const massPrefs = massPrefsRaw.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);  // Remove empty strings
    
    Logger.log(`DEBUG: Added active volunteer ${name} with roles: [${ministries.join(', ')}], mass prefs: [${massPrefs.join(', ')}]`);
    
    volMap.set(id, {
      id: id,
      name: name,
      email: row[cols.EMAIL - 1],
      family: row[cols.FAMILY_TEAM - 1] || null,
      ministries: ministries, // Stored as lowercase
      massPrefs: massPrefs,   // ENHANCED: Clean array of EventIDs
      status: "Active"
    });
  }
  Logger.log(`Built volunteer map with ${volMap.size} active volunteers (substitutes and inactive excluded from auto-assignment).`);
  return volMap;
}

/**
 * Builds a map of ALL volunteer objects (active + substitutes, excludes inactive) for manual assignment scenarios.
 * @param {Array<Array<any>>} volunteerData 2D array from 'Volunteers' sheet.
 * @returns {Map<string, object>} A map where key is VolunteerID, includes active and substitute volunteers only
 */
function ASSIGNMENT_buildAllVolunteersMap(volunteerData) {
  const volMap = new Map();
  const cols = CONSTANTS.COLS.VOLUNTEERS;
  
  for (const row of volunteerData) {
    const id = row[cols.VOLUNTEER_ID - 1];
    if (!id) continue;
    
    const status = String(row[cols.STATUS - 1] || "").toLowerCase();
    
    // Exclude inactive volunteers from ALL assignment scenarios
    if (status === "inactive") {
      Logger.log(`Excluding inactive volunteer: ${row[cols.FULL_NAME - 1]} (Status: ${status})`);
      continue;
    }
    
    const ministries = (row[cols.MINISTRY_ROLE - 1] || "").split(',').map(s => s.trim().toLowerCase());
    
    // ENHANCED: Parse PreferredMassTime and clean up the data
    const massPrefsRaw = row[cols.PREF_MASS_TIME - 1] || "";
    const massPrefs = massPrefsRaw.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    volMap.set(id, {
      id: id,
      name: row[cols.FULL_NAME - 1],
      email: row[cols.EMAIL - 1],
      family: row[cols.FAMILY_TEAM - 1] || null,
      ministries: ministries,
      massPrefs: massPrefs,  // ENHANCED: Clean array of EventIDs
      status: status,
      isActive: status === "active",
      isSubstitute: status === "substitute"
    });
  }
  Logger.log(`Built complete volunteer map with ${volMap.size} volunteers (active + substitutes, inactive excluded).`);
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
 * ENHANCED: Now includes mass preference scoring for better assignments.
 * 
 * @param {string} roleToFill The specific role name (e.g., "1st Reading", "2nd Reading").
 * @param {Date} massDate The date of the mass.
 * @param {Map} volunteers The main volunteer map.
 * @param {Map} timeoffMap The timeoff map.
 * @param {Map} assignmentCounts The frequency map.
 * @param {string} eventId The EventID for this mass (e.g., "Sat5pm", "Sun9am").
 * @returns {object|null} The volunteer object {id, name} or null if none found.
 */
function ASSIGNMENT_findVolunteerForRole(roleToFill, massDate, volunteers, timeoffMap, assignmentCounts, eventId) {
  
  let candidates = [];
  const massDateZeroed = new Date(massDate.setHours(0,0,0,0));
  const roleLower = roleToFill.toLowerCase();
  
  Logger.log(`DEBUG: Looking for volunteers for role "${roleToFill}" at EventID "${eventId}"`);
  
  // --- 1. Filter: Find all volunteers who *can* do the specific role ---
  for (const vol of volunteers.values()) {
    // A. Check if volunteer has this specific role in their ministries
    if (!vol.ministries.includes(roleLower)) {
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
  
  if (candidates.length === 0) {
    Logger.log(`No volunteers found for role: ${roleToFill}`);
    return null;
  }

  Logger.log(`DEBUG: Found ${candidates.length} candidate volunteers for ${roleToFill}`);

  // --- 2. Score: Rank the qualified candidates ---
  for (const candidate of candidates) {
    const vol = candidate.vol;
    const counts = assignmentCounts.get(vol.id) || { total: 0, recent: new Date(0) };

    // A. Penalize for high frequency (spread the work)
    candidate.score -= counts.total * 5; // Each assignment = -5 points
    
    // B. ENHANCED: Bonus for Mass Preference Match
    if (eventId && vol.massPrefs.includes(eventId)) {
      candidate.score += 20; // Big bonus for preferred mass time
      Logger.log(`DEBUG: ${vol.name} gets +20 points for preferring ${eventId}`);
    }
    
    // C. ENHANCED: Small bonus if volunteer has no mass preference (flexible)
    if (vol.massPrefs.length === 0) {
      candidate.score += 5; // Small bonus for flexible volunteers
      Logger.log(`DEBUG: ${vol.name} gets +5 points for being flexible (no mass preference)`);
    }
    
    // D. ENHANCED: Family Team Bonus (if we want to implement this)
    // Note: This would require more complex logic to check if family members
    // are already assigned to the same mass. For now, we skip this.
    
    Logger.log(`DEBUG: ${vol.name} final score: ${candidate.score} (assignments: ${counts.total})`);
  }
  
  // --- 3. Sort: Find the best candidate ---
  candidates.sort((a, b) => b.score - a.score);
  
  const bestVolunteer = candidates[0].vol;
  Logger.log(`Selected ${bestVolunteer.name} for ${roleToFill} (score: ${candidates[0].score})`);
  
  return {
    id: bestVolunteer.id,
    name: bestVolunteer.name
  };
}

/**
 * ENHANCED: Helper function to get EventID from mass information
 * This function maps a date/time/description back to an EventID by looking up
 * the RecurringMasses or SpecialMasses sheets.
 * 
 * @param {Date} massDate The date of the mass
 * @param {string} massTime The time of the mass
 * @param {string} massDescription The description of the mass
 * @returns {string|null} The EventID or null if not found
 */
function ASSIGNMENT_getEventIdForMass(massDate, massTime, massDescription) {
  try {
    // First check RecurringMasses
    const recurringData = HELPER_readSheetData(CONSTANTS.SHEETS.RECURRING_MASSES);
    const recCols = CONSTANTS.COLS.RECURRING_MASSES;
    
    const dayOfWeek = massDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    for (const row of recurringData) {
      const recurringDay = row[recCols.DAY_OF_WEEK - 1];
      const recurringTime = row[recCols.TIME - 1];
      const eventId = row[recCols.EVENT_ID - 1];
      
      if (recurringDay === dayOfWeek && 
          String(recurringTime) === String(massTime) &&
          eventId) {
        return eventId;
      }
    }
    
    // Then check SpecialMasses
    const specialData = HELPER_readSheetData(CONSTANTS.SHEETS.SPECIAL_MASSES);
    const specCols = CONSTANTS.COLS.SPECIAL_MASSES;
    
    for (const row of specialData) {
      const specialDate = new Date(row[specCols.DATE - 1]);
      const specialTime = row[specCols.TIME - 1];
      const eventId = row[specCols.EVENT_ID - 1];
      
      if (specialDate.getTime() === massDate.getTime() && 
          String(specialTime) === String(massTime) &&
          eventId) {
        return eventId;
      }
    }
    
    Logger.log(`Warning: Could not find EventID for mass on ${massDate.toDateString()} at ${massTime}`);
    return null;
    
  } catch (error) {
    Logger.log(`Error getting EventID for mass: ${error}`);
    return null;
  }
}
