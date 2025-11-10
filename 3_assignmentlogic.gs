/**
 * ====================================================================
 * OPTIMIZED ASSIGNMENT LOGIC - PERFORMANCE & ERROR IMPROVEMENTS
 * ====================================================================
 * This file addresses the performance issues and complexity in the original
 * assignment logic while maintaining all functionality.
 */

/**
 * Optimized main assignment function with better error handling
 */
function ASSIGNMENT_autoAssignRolesForMonthOptimized(monthString) {
  Logger.log(`Starting assignment process for ${monthString}`);
  
  try {
    // Validate inputs first
    const { year, month } = HELPER_validateMonthString(monthString);
    
    // Use safe config reading
    const config = HELPER_readConfigSafe();
    const scheduleYear = config["Year to Schedule"];
    
    if (year !== scheduleYear) {
      throw new Error(`Month ${monthString} is not in schedule year ${scheduleYear}`);
    }
    
    // Performance timing
    return HELPER_timeFunction('AutoAssignment', () => {
      return executeAssignmentLogic(monthString, month, scheduleYear);
    });
    
  } catch (e) {
    Logger.log(`ERROR in ASSIGNMENT_autoAssignRolesForMonthOptimized: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw new Error(`Assignment failed: ${e.message}`);
  }
}

/**
 * Extracted core assignment logic for better testing and modularity
 */
function executeAssignmentLogic(monthString, month, scheduleYear) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  
  if (!assignmentsSheet) {
    throw new Error(`Assignments sheet '${CONSTANTS.SHEETS.ASSIGNMENTS}' not found`);
  }
  
  // Read data once and cache
  const volunteerData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.VOLUNTEERS);
  const timeoffData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.TIMEOFFS);
  
  // Build optimized data structures
  const volunteers = buildVolunteerMapOptimized(volunteerData);
  const timeoffMap = buildTimeoffMapOptimized(timeoffData, month, scheduleYear);
  
  if (volunteers.size === 0) {
    Logger.log("WARNING: No active volunteers found");
    return "No active volunteers found. Check Volunteers sheet Status column.";
  }
  
  // Get assignment data more efficiently
  const assignmentContext = buildAssignmentContext(assignmentsSheet, monthString, scheduleYear);
  
  Logger.log(`Found ${assignmentContext.unassignedRoles.length} unassigned roles and ${assignmentContext.groupAssignments.length} group assignments`);
  
  // Process assignments
  const results = processAssignments(assignmentContext, volunteers, timeoffMap, assignmentsSheet);
  
  return formatAssignmentResults(results, monthString);
}

/**
 * Optimized volunteer map building with better validation
 */
function buildVolunteerMapOptimized(volunteerData) {
  const volMap = new Map();
  const cols = CONSTANTS.COLS.VOLUNTEERS;
  
  for (const row of volunteerData) {
    const id = HELPER_safeArrayAccess(row, cols.VOLUNTEER_ID - 1);
    if (!id) continue;
    
    const status = String(HELPER_safeArrayAccess(row, cols.STATUS - 1, '')).toLowerCase();
    if (status !== 'active') continue;
    
    const name = HELPER_safeArrayAccess(row, cols.FULL_NAME - 1);
    if (!name) {
      Logger.log(`WARNING: Volunteer ${id} has no name, skipping`);
      continue;
    }
    
    // Parse ministries and preferences more safely
    const ministryRole = HELPER_safeArrayAccess(row, cols.MINISTRY_ROLE - 1, '');
    const ministries = parseListField(ministryRole);
    
    if (ministries.length === 0) {
      Logger.log(`WARNING: Volunteer ${name} has no ministry roles, skipping`);
      continue;
    }
    
    const massPrefs = parseListField(HELPER_safeArrayAccess(row, cols.PREFERRED_MASS_TIME - 1, ''));
    const rolePrefs = parseListField(HELPER_safeArrayAccess(row, cols.MINISTRY_ROLE_PREFERENCE - 1, ''));
    const familyTeam = HELPER_safeArrayAccess(row, cols.FAMILY_TEAM - 1) || null;
    
    volMap.set(id, {
      id: id,
      name: name,
      email: HELPER_safeArrayAccess(row, cols.EMAIL - 1),
      familyTeam: familyTeam,
      ministries: ministries,
      massPrefs: massPrefs,
      rolePrefs: rolePrefs,
      status: "Active"
    });
  }
  
  Logger.log(`Built optimized volunteer map with ${volMap.size} volunteers`);
  return volMap;
}

/**
 * Helper function to safely parse comma-separated fields
 */
function parseListField(fieldValue) {
  if (!fieldValue) return [];
  return String(fieldValue)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

/**
 * Optimized timeoff map building
 */
function buildTimeoffMapOptimized(timeoffData, month, year) {
  const timeoffMap = new Map();
  const cols = CONSTANTS.COLS.TIMEOFFS;
  
  // Pre-calculate month boundaries for faster comparison
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // Last day of month
  
  for (const row of timeoffData) {
    const name = HELPER_safeArrayAccess(row, cols.VOLUNTEER_NAME - 1);
    const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, 'Pending');
    
    // Only process approved timeoffs
    if (!name || status !== 'Approved') continue;
    
    const startDate = new Date(HELPER_safeArrayAccess(row, cols.START_DATE - 1));
    const endDate = new Date(HELPER_safeArrayAccess(row, cols.END_DATE - 1));
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Logger.log(`WARNING: Invalid dates for ${name}, skipping timeoff`);
      continue;
    }
    
    // Skip if timeoff doesn't overlap with our month
    if (endDate < monthStart || startDate > monthEnd) continue;
    
    if (!timeoffMap.has(name)) {
      timeoffMap.set(name, new Set()); // Use Set for faster lookups
    }
    
    // Add dates efficiently
    const clampedStart = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
    const clampedEnd = new Date(Math.min(endDate.getTime(), monthEnd.getTime()));
    
    for (let d = new Date(clampedStart); d <= clampedEnd; d.setDate(d.getDate() + 1)) {
      timeoffMap.get(name).add(d.toDateString()); // Use string for faster comparison
    }
  }
  
  Logger.log(`Built optimized timeoff map for ${timeoffMap.size} volunteers`);
  return timeoffMap;
}

/**
 * Build assignment context with better data organization
 */
function buildAssignmentContext(assignmentsSheet, monthString, scheduleYear) {
  const data = assignmentsSheet.getDataRange().getValues();
  data.shift(); // Remove header
  
  const context = {
    unassignedRoles: [],
    groupAssignments: [],
    allAssignments: [],
    assignmentCounts: new Map()
  };
  
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const date = row[assignCols.DATE - 1];
    if (!date) continue;
    
    const rowMonthYear = HELPER_safeArrayAccess(row, assignCols.MONTH_YEAR - 1);
    const assignedVolunteerId = HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_ID - 1);
    const assignedGroup = HELPER_safeArrayAccess(row, assignCols.ASSIGNED_GROUP - 1);
    
    // Build assignment counts for all data (for frequency calculation)
    if (assignedVolunteerId) {
      const assignDate = new Date(date);
      if (!context.assignmentCounts.has(assignedVolunteerId)) {
        context.assignmentCounts.set(assignedVolunteerId, { total: 0, recent: new Date(0) });
      }
      context.assignmentCounts.get(assignedVolunteerId).total++;
      if (assignDate > context.assignmentCounts.get(assignedVolunteerId).recent) {
        context.assignmentCounts.get(assignedVolunteerId).recent = assignDate;
      }
    }
    
    // Process roles for our target month
    if (rowMonthYear === monthString) {
      const roleData = {
        row: row,
        rowIndex: i + 2, // +2 for 1-based indexing and header
        date: new Date(date),
        role: HELPER_safeArrayAccess(row, assignCols.MINISTRY_ROLE - 1),
        eventId: HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1),
        massName: HELPER_safeArrayAccess(row, assignCols.MASS_NAME - 1),
        time: HELPER_safeArrayAccess(row, assignCols.TIME - 1)
      };
      
      if (assignedGroup && !assignedVolunteerId) {
        context.groupAssignments.push({ ...roleData, assignedGroup });
      } else if (!assignedVolunteerId && !assignedGroup) {
        context.unassignedRoles.push(roleData);
      }
    }
  }
  
  return context;
}

/**
 * Process assignments with improved algorithm
 */
function processAssignments(context, volunteers, timeoffMap, assignmentsSheet) {
  const results = {
    groupAssignments: 0,
    individualAssignments: 0,
    skipped: 0
  };
  
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  
  // Process group assignments first
  for (const assignment of context.groupAssignments) {
    const success = processGroupAssignment(assignment, volunteers, assignmentsSheet, assignCols);
    if (success) results.groupAssignments++;
  }
  
  // Group individual assignments by mass for family team processing
  const massesByDateTime = groupAssignmentsByMass(context.unassignedRoles);
  
  // Process each mass
  for (const [massKey, massInfo] of massesByDateTime) {
    const massAssignments = new Map(); // Track assignments for this specific mass
    
    for (const roleInfo of massInfo.roles) {
      const volunteer = findOptimalVolunteer(
        roleInfo,
        volunteers,
        timeoffMap,
        context.assignmentCounts,
        massAssignments
      );
      
      if (volunteer) {
        // Make the assignment
        assignmentsSheet.getRange(roleInfo.rowIndex, assignCols.ASSIGNED_VOLUNTEER_ID).setValue(volunteer.id);
        assignmentsSheet.getRange(roleInfo.rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(volunteer.name);
        assignmentsSheet.getRange(roleInfo.rowIndex, assignCols.STATUS).setValue("Assigned");
        
        // Update tracking
        updateAssignmentCounts(context.assignmentCounts, volunteer.id, roleInfo.date);
        massAssignments.set(volunteer.id, roleInfo.role);
        
        results.individualAssignments++;
        Logger.log(`Assigned ${volunteer.name} to ${roleInfo.role} on ${roleInfo.date.toDateString()}`);
      } else {
        results.skipped++;
        Logger.log(`Could not assign ${roleInfo.role} on ${roleInfo.date.toDateString()}`);
      }
    }
  }
  
  return results;
}

/**
 * Simplified volunteer finding with extracted scoring logic
 */
function findOptimalVolunteer(roleInfo, volunteers, timeoffMap, assignmentCounts, massAssignments) {
  const candidates = filterCandidates(roleInfo, volunteers, timeoffMap, assignmentCounts, massAssignments);
  
  if (candidates.length === 0) return null;
  
  // Score and sort candidates
  for (const candidate of candidates) {
    candidate.score = HELPER_calculateVolunteerScore(
      candidate.volunteer,
      roleInfo.role,
      roleInfo.eventId,
      assignmentCounts,
      massAssignments,
      volunteers
    );
  }
  
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].volunteer;
}

/**
 * Extracted candidate filtering for better testability
 */
function filterCandidates(roleInfo, volunteers, timeoffMap, assignmentCounts, massAssignments) {
  const candidates = [];
  const roleLower = roleInfo.role.toLowerCase();
  const massDateString = roleInfo.date.toDateString();
  
  for (const volunteer of volunteers.values()) {
    // Check if volunteer can do this role
    if (!volunteer.ministries.includes(roleLower)) continue;
    
    // Check timeoff
    const timeoffs = timeoffMap.get(volunteer.name);
    if (timeoffs && timeoffs.has(massDateString)) continue;
    
    // Check if already assigned today
    const counts = assignmentCounts.get(volunteer.id);
    if (counts && counts.recent.toDateString() === massDateString) continue;
    
    // Check if already assigned to this mass
    if (massAssignments.has(volunteer.id)) continue;
    
    candidates.push({ volunteer });
  }
  
  return candidates;
}

/**
 * Utility functions for better organization
 */
function groupAssignmentsByMass(unassignedRoles) {
  const massesByDateTime = new Map();
  
  for (const roleInfo of unassignedRoles) {
    const massKey = `${roleInfo.date.toDateString()}_${roleInfo.time}`;
    
    if (!massesByDateTime.has(massKey)) {
      massesByDateTime.set(massKey, {
        date: roleInfo.date,
        time: roleInfo.time,
        eventId: roleInfo.eventId,
        roles: []
      });
    }
    
    massesByDateTime.get(massKey).roles.push(roleInfo);
  }
  
  return massesByDateTime;
}

function updateAssignmentCounts(assignmentCounts, volunteerId, date) {
  if (!assignmentCounts.has(volunteerId)) {
    assignmentCounts.set(volunteerId, { total: 0, recent: new Date(0) });
  }
  const counts = assignmentCounts.get(volunteerId);
  counts.total++;
  counts.recent = date;
}

function processGroupAssignment(assignment, volunteers, assignmentsSheet, assignCols) {
  // Simplified group assignment logic
  const familyMember = findFamilyMember(assignment, volunteers);
  
  if (familyMember) {
    assignmentsSheet.getRange(assignment.rowIndex, assignCols.ASSIGNED_VOLUNTEER_ID).setValue(familyMember.id);
    assignmentsSheet.getRange(assignment.rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(familyMember.name);
  } else {
    assignmentsSheet.getRange(assignment.rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(assignment.assignedGroup);
  }
  
  assignmentsSheet.getRange(assignment.rowIndex, assignCols.STATUS).setValue("Assigned");
  return true;
}

function findFamilyMember(assignment, volunteers) {
  for (const vol of volunteers.values()) {
    if (vol.familyTeam && 
        vol.familyTeam.toLowerCase() === assignment.assignedGroup.toLowerCase() &&
        vol.ministries.includes(assignment.role.toLowerCase())) {
      return vol;
    }
  }
  return null;
}

function formatAssignmentResults(results, monthString) {
  const total = results.groupAssignments + results.individualAssignments;
  return `Assignment complete for ${monthString}! ` +
         `Group assignments: ${results.groupAssignments}, ` +
         `Individual assignments: ${results.individualAssignments}, ` +
         `Unassigned: ${results.skipped}`;
}

/**
 * Legacy wrapper function for backward compatibility
 */
function ASSIGNMENT_autoAssignRolesForMonth(monthString) {
  return ASSIGNMENT_autoAssignRolesForMonthOptimized(monthString);
}

/**
 * Legacy function to build volunteer map (for substitute finding)
 */
function ASSIGNMENT_buildVolunteerMap(volunteerData) {
  return buildVolunteerMapOptimized(volunteerData);
}

/**
 * Legacy function to build timeoff map
 */
function ASSIGNMENT_buildTimeoffMap(timeoffData, month, year) {
  return buildTimeoffMapOptimized(timeoffData, month, year);
}
