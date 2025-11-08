/**
 * ====================================================================
 * 3. AUTO-ASSIGNMENT LOGIC (WITH FAMILY TEAM & ROLE PREFERENCES)
 * ====================================================================
 * 
 * CHANGES MADE:
 * 1. Added Family Team grouping - volunteers with same family team must be assigned together
 * 2. Added Role Preferences - volunteers get bonus points for preferred roles
 * 3. Updated volunteer map to include familyTeam and rolePrefs
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
  
  // 5. Get the specific rows for the selected month and process AssignedGroup logic
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const unassignedRows = []; 
  const unassignedRowIndexes = []; 
  const assignedGroupRows = [];
  const assignedGroupRowIndexes = [];
  
  for (let i = 0; i < allAssignmentData.length; i++) {
    const row = allAssignmentData[i];
    if (!row[assignCols.DATE - 1]) continue;
    
    const assignMonthYear = row[assignCols.MONTH_YEAR - 1];
    const assignedVolunteerId = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
    const assignedGroup = row[assignCols.ASSIGNED_GROUP - 1];
    
    // If MonthYear matches and this row needs processing
    if (assignMonthYear === monthString) {
      if (assignedGroup && !assignedVolunteerId) {
        // This mass has an AssignedGroup - handle separately
        assignedGroupRows.push(row);
        assignedGroupRowIndexes.push(i + 2);
      } else if (!assignedVolunteerId && !assignedGroup) {
        // Regular unassigned row
        unassignedRows.push(row);
        unassignedRowIndexes.push(i + 2);
      }
    }
  }
  
  Logger.log(`Found ${unassignedRows.length} unassigned roles and ${assignedGroupRows.length} group-assigned roles to process.`);
  
  // 6. Process AssignedGroup rows first
  let groupAssignmentsMade = 0;
  if (assignedGroupRows.length > 0) {
    Logger.log(`\n=== Processing ${assignedGroupRows.length} AssignedGroup roles ===`);
    
    for (let i = 0; i < assignedGroupRows.length; i++) {
      const row = assignedGroupRows[i];
      const rowIndex = assignedGroupRowIndexes[i];
      const assignedGroup = row[assignCols.ASSIGNED_GROUP - 1];
      const roleToFill = row[assignCols.MINISTRY_ROLE - 1];
      
      Logger.log(`Processing AssignedGroup: "${assignedGroup}" for role: "${roleToFill}"`);
      
      // Check if this AssignedGroup matches any FamilyTeam
      let familyMember = null;
      for (const vol of volunteers.values()) {
        if (vol.familyTeam && vol.familyTeam.toLowerCase() === assignedGroup.toLowerCase()) {
          // Found a volunteer from this family team who can do this role
          if (vol.ministries.includes(roleToFill.toLowerCase())) {
            familyMember = vol;
            break;
          }
        }
      }
      
      if (familyMember) {
        // Assign the family team member
        assignmentsSheet.getRange(rowIndex, assignCols.ASSIGNED_VOLUNTEER_ID).setValue(familyMember.id);
        assignmentsSheet.getRange(rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(familyMember.name);
        
        Logger.log(`  SUCCESS: Assigned family team member ${familyMember.name} for group "${assignedGroup}"`);
        groupAssignmentsMade++;
        
      } else {
        // No matching family team found, use the group name as the volunteer name
        assignmentsSheet.getRange(rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(assignedGroup);
        
        Logger.log(`  SUCCESS: Assigned group "${assignedGroup}" (no specific volunteer)`);
        groupAssignmentsMade++;
      }
      
      // Set status if the column exists
      if (assignCols.STATUS && assignCols.STATUS <= assignmentsSheet.getLastColumn()) {
        assignmentsSheet.getRange(rowIndex, assignCols.STATUS).setValue("Assigned");
      }
    }
  }
  
  // 7. Build volunteer assignment counts for frequency tracking
  const assignmentCounts = ASSIGNMENT_buildAssignmentCounts(allAssignmentData);
  
  if (unassignedRows.length === 0) {
    const message = groupAssignmentsMade > 0 
      ? `Processed ${groupAssignmentsMade} group assignments. No individual volunteer assignments needed for ${monthString}.`
      : `No unassigned rows found for ${monthString}. Check assignment MonthYear and AssignedVolunteerID columns.`;
    Logger.log(message);
    return message;
  }

  Logger.log(`Found ${unassignedRows.length} unassigned roles to fill.`);
  
  // 8. --- GROUP ASSIGNMENTS BY MASS DATE/TIME for family team processing ---
  const massByDateTime = new Map();
  
  for (let i = 0; i < unassignedRows.length; i++) {
    const row = unassignedRows[i];
    const massDate = new Date(row[assignCols.DATE - 1]);
    const massTime = row[assignCols.TIME - 1];
    const eventId = row[assignCols.EVENT_ID - 1];
    
    const massKey = `${massDate.toDateString()}_${massTime}`;
    
    if (!massByDateTime.has(massKey)) {
      massByDateTime.set(massKey, {
        date: massDate,
        time: massTime,
        eventId: eventId,
        roles: [],
        rowIndexes: []
      });
    }
    
    massByDateTime.get(massKey).roles.push({
      role: row[assignCols.MINISTRY_ROLE - 1],
      rowIndex: unassignedRowIndexes[i],
      rowData: row
    });
  }
  
  // 8. --- The Core Assignment Loop (by Mass) ---
  let assignmentsMade = 0;
  let assignmentsSkipped = 0;
  
  // Process each Mass separately to handle family team assignments
  for (const [massKey, massInfo] of massByDateTime) {
    Logger.log(`\nProcessing Mass: ${massInfo.date.toDateString()} at ${massInfo.time} (${massInfo.roles.length} roles)`);
    
    // Track which volunteers are already assigned to this specific Mass
    const massAssignments = new Map(); // volunteerID -> role
    
    for (const roleInfo of massInfo.roles) {
      const roleToFill = roleInfo.role;
      const massDate = massInfo.date;
      const eventId = massInfo.eventId;
      
      Logger.log(`  Trying to fill "${roleToFill}"`);
      
      // Find a volunteer for this role (considering family teams already assigned to this Mass)
      const assignedVolunteer = ASSIGNMENT_findVolunteerForRole(
        roleToFill,
        massDate,
        volunteers,
        timeoffMap,
        assignmentCounts,
        eventId,
        massAssignments // FAMILY TEAM: Pass current Mass assignments
      );
      
      if (assignedVolunteer) {
        // Write the assignment to the sheet
        assignmentsSheet.getRange(roleInfo.rowIndex, assignCols.ASSIGNED_VOLUNTEER_ID).setValue(assignedVolunteer.id);
        assignmentsSheet.getRange(roleInfo.rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(assignedVolunteer.name);
        
        // Set status if the column exists and has data
        if (assignCols.STATUS && assignCols.STATUS <= assignmentsSheet.getLastColumn()) {
          assignmentsSheet.getRange(roleInfo.rowIndex, assignCols.STATUS).setValue("Assigned");
        }
        
        // Update tracking data
        if (!assignmentCounts.has(assignedVolunteer.id)) {
           assignmentCounts.set(assignedVolunteer.id, { total: 0, recent: new Date(0) });
        }
        assignmentCounts.get(assignedVolunteer.id).total++;
        assignmentCounts.get(assignedVolunteer.id).recent = massDate;
        
        // FAMILY TEAM: Track this assignment for the current Mass
        massAssignments.set(assignedVolunteer.id, roleToFill);
        
        assignmentsMade++;
        Logger.log(`  SUCCESS: Assigned ${assignedVolunteer.name} to ${roleToFill}`);
      } else {
        assignmentsSkipped++;
        Logger.log(`  FAILED: Could not find volunteer for ${roleToFill}`);
      }
    }
  }
  
  Logger.log(`\nFinished auto-assignment. Group assignments: ${groupAssignmentsMade}, Individual assignments: ${assignmentsMade}, Skipped: ${assignmentsSkipped}`);
  return `Assignment complete! Group assignments: ${groupAssignmentsMade}, Individual assignments: ${assignmentsMade}. ${assignmentsSkipped} roles remain unassigned.`;
}

/**
 * Builds a map of volunteer objects from the sheet data for fast lookups.
 * ENHANCED: Now includes family team and role preferences.
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
    const ministryRole = row[cols.MINISTRY_ROLE - 1]; // Column J (10)
    
    Logger.log(`DEBUG: Volunteer ${id} (${name}) - Status: "${status}", MinistryRole: "${ministryRole}"`);
    
    if (status !== "active") {
      Logger.log(`Excluding volunteer from auto-assignment: ${name} (Status: ${status})`);
      continue;
    }
    
    const ministries = (ministryRole || "").split(',').map(s => s.trim().toLowerCase());
    const massPrefs = (row[cols.PREFERRED_MASS_TIME - 1] || "").split(',').map(s => s.trim()); // Column L (12)
    const familyTeam = row[cols.FAMILY_TEAM - 1] || null; // Column H (8)
    
    // ROLE PREFERENCES: Column K (11) - renamed to "Preference"
    const rolePrefs = (row[cols.PREFERENCE - 1] || "").split(',').map(s => s.trim().toLowerCase());
    
    Logger.log(`DEBUG: Added active volunteer ${name} - Family: ${familyTeam}, RolePrefs: [${rolePrefs.join(', ')}]`);
    
    volMap.set(id, {
      id: id,
      name: name,
      email: row[cols.EMAIL - 1],
      familyTeam: familyTeam,        // FAMILY TEAM: Store family team
      ministries: ministries,
      massPrefs: massPrefs,
      rolePrefs: rolePrefs,          // ROLE PREFERENCES: Store role preferences
      status: "Active"
    });
  }
  Logger.log(`Built volunteer map with ${volMap.size} active volunteers.`);
  return volMap;
}

/**
 * Builds a map of volunteer time-offs for the specific month being scheduled.
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
        timeoffMap.get(name).push(new Date(currentDate.getTime()));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  Logger.log(`Built timeoff map. ${timeoffMap.size} volunteers have time off this month.`);
  return timeoffMap;
}

/**
 * Builds a map tracking how many times each volunteer has been assigned.
 */
function ASSIGNMENT_buildAssignmentCounts(allAssignmentData) {
  const counts = new Map();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  
  for (const row of allAssignmentData) {
    const id = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
    if (!row[assignCols.DATE - 1]) continue;
    const date = new Date(row[assignCols.DATE - 1]);
    
    // Count assignment if volunteer ID exists (regardless of status)
    if (id) {
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
 * The core scheduling algorithm with Family Team and Role Preference support.
 * ENHANCED: Now considers family teams and role preferences.
 * 
 * @param {string} roleToFill The specific role name.
 * @param {Date} massDate The date of the mass.
 * @param {Map} volunteers The main volunteer map.
 * @param {Map} timeoffMap The timeoff map.
 * @param {Map} assignmentCounts The frequency map.
 * @param {string} eventId The EventID for this mass.
 * @param {Map} massAssignments Current assignments for this specific Mass (volunteerID -> role).
 * @returns {object|null} The volunteer object {id, name} or null if none found.
 */
function ASSIGNMENT_findVolunteerForRole(roleToFill, massDate, volunteers, timeoffMap, assignmentCounts, eventId, massAssignments) {
  
  let candidates = [];
  const massDateZeroed = new Date(massDate.setHours(0,0,0,0));
  const roleLower = roleToFill.toLowerCase();
  
  Logger.log(`    Looking for volunteers for role "${roleToFill}"`);
  
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

    // C. Check if already assigned on this day (globally)
    const counts = assignmentCounts.get(vol.id) || { total: 0, recent: new Date(0) };
    
    if (counts.recent.getTime() === massDateZeroed.getTime()) {
       continue; // Already assigned today, skip
    }
    
    // D. FAMILY TEAM: Check if already assigned to this specific Mass
    if (massAssignments && massAssignments.has(vol.id)) {
      continue; // Already assigned to this Mass
    }
    
    // This volunteer is a valid candidate
    candidates.push({
      vol: vol,
      score: 100 // Start with a base score
    });
  }
  
  if (candidates.length === 0) {
    Logger.log(`    No volunteers found for role: ${roleToFill}`);
    return null;
  }

  Logger.log(`    Found ${candidates.length} candidate volunteers`);

  // --- 2. Score: Rank the qualified candidates ---
  for (const candidate of candidates) {
    const vol = candidate.vol;
    const counts = assignmentCounts.get(vol.id) || { total: 0, recent: new Date(0) };

    // A. Penalize for high frequency (spread the work)
    candidate.score -= counts.total * 5;
    
    // DEBUG: Log volunteer preferences
    Logger.log(`    ${vol.name} massPrefs: [${vol.massPrefs.join(', ')}], rolePrefs: [${vol.rolePrefs.join(', ')}]`);
    
    // B. Bonus for Mass Preference
    if (eventId && vol.massPrefs.includes(eventId)) {
      candidate.score += 20;
      Logger.log(`    ${vol.name} gets +20 points for preferring ${eventId}`);
    } else if (eventId && vol.massPrefs.length > 0) {
      Logger.log(`    ${vol.name} has preferences [${vol.massPrefs.join(', ')}] but doesn't match ${eventId}`);
    }
    
    // C. ROLE PREFERENCES: Bonus for preferred role
    if (vol.rolePrefs.includes(roleLower)) {
      candidate.score += 15;
      Logger.log(`    ${vol.name} gets +15 points for preferring role ${roleToFill}`);
    }
    
    // D. FAMILY TEAM: Bonus if family member is already assigned to this Mass
    if (vol.familyTeam && massAssignments) {
      for (const [assignedVolId, assignedRole] of massAssignments) {
        const assignedVol = volunteers.get(assignedVolId);
        if (assignedVol && assignedVol.familyTeam === vol.familyTeam) {
          candidate.score += 25; // Big bonus for keeping families together
          Logger.log(`    ${vol.name} gets +25 points for family team with ${assignedVol.name}`);
          break; // Only count this bonus once per volunteer
        }
      }
    }
    
    // E. Small bonus for flexibility (no preferences)
    if (vol.massPrefs.length === 0 && vol.rolePrefs.length === 0) {
      candidate.score += 3;
    }
    
    Logger.log(`    ${vol.name} final score: ${candidate.score} (base: 100, freq: -${counts.total * 5})`);
  }
  
  // --- 3. Sort: Find the best candidate ---
  candidates.sort((a, b) => b.score - a.score);
  
  const bestVolunteer = candidates[0].vol;
  Logger.log(`    Selected ${bestVolunteer.name} for ${roleToFill} (score: ${candidates[0].score})`);
  
  return {
    id: bestVolunteer.id,
    name: bestVolunteer.name
  };
}
