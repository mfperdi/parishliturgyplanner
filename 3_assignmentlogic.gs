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
  const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, scheduleYear);

  // CRITICAL: Build skill-to-ministry mapping from MassTemplates
  const skillToMinistryMap = buildSkillToMinistryMap();

  if (volunteers.size === 0) {
    Logger.log("WARNING: No active volunteers found");
    return "No active volunteers found. Check Volunteers sheet Status column.";
  }

  // Get assignment data more efficiently
  const assignmentContext = buildAssignmentContext(assignmentsSheet, monthString, scheduleYear);

  Logger.log(`Found ${assignmentContext.unassignedRoles.length} unassigned roles and ${assignmentContext.groupAssignments.length} group assignments`);

  // Process assignments
  const results = processAssignments(assignmentContext, volunteers, timeoffMaps, assignmentsSheet, skillToMinistryMap);

  return formatAssignmentResults(results, monthString);
}

/**
 * Build skill-to-ministry mapping from MassTemplates sheet
 * Maps specific skills (e.g., "1st reading") to general ministry categories (e.g., "Lector")
 * This allows volunteers with "Lector" to be matched to "1st reading" assignments
 */
function buildSkillToMinistryMap() {
  const map = new Map();

  try {
    const templateData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.TEMPLATES);
    const cols = CONSTANTS.COLS.TEMPLATES;

    for (const row of templateData) {
      const ministryName = HELPER_safeArrayAccess(row, cols.MINISTRY_NAME - 1);
      const roleName = HELPER_safeArrayAccess(row, cols.ROLE_NAME - 1);

      if (ministryName && roleName) {
        // Map: "1st reading" → "Lector"
        // Map: "2nd reading" → "Lector"
        // Map: "chalice" → "Eucharistic Minister"
        const skillLower = String(roleName).toLowerCase();
        const ministryLower = String(ministryName).toLowerCase();

        // Only add if not already mapped (first occurrence wins)
        if (!map.has(skillLower)) {
          map.set(skillLower, ministryLower);
        }
      }
    }

    Logger.log(`Built skill-to-ministry map with ${map.size} mappings`);

    // Debug: show all mappings
    for (const [skill, ministry] of map) {
      Logger.log(`  "${skill}" → "${ministry}"`);
    }

  } catch (e) {
    Logger.log(`WARNING: Could not build skill-to-ministry map: ${e.message}`);
  }

  return map;
}

/**
 * Optimized volunteer map building with CORRECTED preference reading
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
    const ministriesRaw = HELPER_safeArrayAccess(row, cols.MINISTRIES - 1, '');
    const ministries = parseListField(ministriesRaw);

    if (ministries.length === 0) {
      Logger.log(`WARNING: Volunteer ${name} has no ministry roles, skipping`);
      continue;
    }

    // CORRECTED: Read preferences from the right columns
    // PREFERRED_MASS_TIME (column 12) = Mass time preferences like "SUN-1000, SAT-1700"
    const massPrefsRaw = HELPER_safeArrayAccess(row, cols.PREFERRED_MASS_TIME - 1, '');
    const massPrefs = parseListField(massPrefsRaw, false); // Don't lowercase EventIDs

    // ROLES (column 11) = Role preferences like "1st reading, psalm"
    const rolePrefsRaw = HELPER_safeArrayAccess(row, cols.ROLES - 1, '');
    const rolePrefs = parseListField(rolePrefsRaw); // Lowercase for role matching
    
    const familyTeam = HELPER_safeArrayAccess(row, cols.FAMILY_TEAM - 1) || null;
    
    volMap.set(id, {
      id: id,
      name: name,
      email: HELPER_safeArrayAccess(row, cols.EMAIL - 1),
      familyTeam: familyTeam,
      ministries: ministries,
      massPrefs: massPrefs,       // EventIDs like ["SUN-1000", "SAT-1700"]
      rolePrefs: rolePrefs,       // Roles like ["1st reading", "psalm"]
      status: "Active"
    });
    
    // Debug logging for preferences
    Logger.log(`${name}: massPrefs=[${massPrefs.join(',')}], rolePrefs=[${rolePrefs.join(',')}]`);
  }
  
  Logger.log(`Built optimized volunteer map with ${volMap.size} volunteers`);
  return volMap;
}

/**
 * Helper function to safely parse comma-separated fields
 * @param {string} fieldValue The field value to parse
 * @param {boolean} toLowerCase Whether to convert to lowercase (default true)
 */
function parseListField(fieldValue, toLowerCase = true) {
  if (!fieldValue) return [];
  
  const items = String(fieldValue)
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return toLowerCase ? items.map(s => s.toLowerCase()) : items;
}

/**
 * Optimized timeoff map building (DATE-BASED SYSTEM)
 * Returns object with two maps: blacklist, whitelist
 * NEW: Uses date checkboxes from form - no more Event IDs
 */
function buildTimeoffMapOptimized(timeoffData, month, year) {
  const result = {
    blacklist: new Map(),        // Not Available: volunteer => Map<dateString, Set<{vigil|non-vigil}>>
    whitelist: new Map()         // Only Available: volunteer => Map<dateString, Set<{vigil|non-vigil}>>
  };

  const cols = CONSTANTS.COLS.TIMEOFFS;

  // Pre-calculate month boundaries for faster comparison
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // Last day of month

  for (const row of timeoffData) {
    const name = HELPER_safeArrayAccess(row, cols.VOLUNTEER_NAME - 1);
    const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, 'Pending');
    const type = HELPER_safeArrayAccess(row, cols.TYPE - 1);

    // Only process approved timeoffs
    if (!name || status !== 'Approved') continue;

    const notes = HELPER_safeArrayAccess(row, cols.NOTES - 1);

    // Process based on TYPE
    switch (type) {
      case CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE:
        // Blacklist: Parse dates from Notes
        const blacklistDates = HELPER_parseDateBasedNotes(notes);

        if (blacklistDates.length > 0) {
          if (!result.blacklist.has(name)) {
            result.blacklist.set(name, new Map());
          }

          const blacklistMap = result.blacklist.get(name);

          for (const dateInfo of blacklistDates) {
            // Only include dates in current month
            if (dateInfo.date >= monthStart && dateInfo.date <= monthEnd) {
              if (!blacklistMap.has(dateInfo.dateString)) {
                blacklistMap.set(dateInfo.dateString, new Set());
              }

              // Add vigil or non-vigil marker
              blacklistMap.get(dateInfo.dateString).add(dateInfo.isVigil ? 'vigil' : 'non-vigil');
            }
          }
        }
        break;

      case CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE:
        // Whitelist: Parse dates from Notes
        const whitelistDates = HELPER_parseDateBasedNotes(notes);

        if (whitelistDates.length > 0) {
          if (!result.whitelist.has(name)) {
            result.whitelist.set(name, new Map());
          }

          const whitelistMap = result.whitelist.get(name);

          for (const dateInfo of whitelistDates) {
            // Only include dates in current month
            if (dateInfo.date >= monthStart && dateInfo.date <= monthEnd) {
              if (!whitelistMap.has(dateInfo.dateString)) {
                whitelistMap.set(dateInfo.dateString, new Set());
              }

              // Add vigil or non-vigil marker
              whitelistMap.get(dateInfo.dateString).add(dateInfo.isVigil ? 'vigil' : 'non-vigil');
            }
          }
        }
        break;

      default:
        // Unknown type - log warning
        if (type && type !== '') {
          Logger.log(`WARNING: Unknown timeoff type "${type}" for ${name}`);
        }
        break;
    }
  }

  Logger.log(`Built timeoff maps: ${result.blacklist.size} blacklists, ${result.whitelist.size} whitelists`);
  return result;
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
        massName: HELPER_safeArrayAccess(row, assignCols.DESCRIPTION - 1),
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
function processAssignments(context, volunteers, timeoffMaps, assignmentsSheet, skillToMinistryMap) {
  const results = {
    groupAssignments: 0,
    individualAssignments: 0,
    skipped: 0
  };

  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Process group assignments first
  for (const assignment of context.groupAssignments) {
    const success = processGroupAssignment(assignment, volunteers, assignmentsSheet, assignCols, skillToMinistryMap);
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
        timeoffMaps,
        context.assignmentCounts,
        massAssignments,
        skillToMinistryMap
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
 * Simplified volunteer finding with extracted scoring logic and detailed logging
 */
function findOptimalVolunteer(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap) {
  Logger.log(`\n🎯 Looking for volunteer for ${roleInfo.role} on ${roleInfo.date.toDateString()} (${roleInfo.eventId})`);

  const candidates = filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap);

  Logger.log(`📋 Found ${candidates.length} eligible candidates`);

  if (candidates.length === 0) {
    Logger.log(`❌ No eligible volunteers found for ${roleInfo.role}`);
    return null;
  }

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

  Logger.log(`🏆 Selected ${candidates[0].volunteer.name} (score: ${candidates[0].score}) for ${roleInfo.role}`);

  // Show top 3 candidates for debugging
  const topCandidates = candidates.slice(0, 3);
  topCandidates.forEach((candidate, index) => {
    Logger.log(`  ${index + 1}. ${candidate.volunteer.name}: ${candidate.score} points`);
  });

  return candidates[0].volunteer;
}

/**
 * Extracted candidate filtering
 * Filters volunteers based on timeoff blacklist/whitelist
 * NOW INCLUDES: Strict role matching - volunteers only assigned to their specified roles
 */
function filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap) {
  const candidates = [];
  const roleLower = roleInfo.role.toLowerCase();
  const massDateString = roleInfo.date.toDateString();
  const eventId = roleInfo.eventId;

  // Map the specific skill to its general ministry category
  // Example: "1st reading" → "lector"
  const requiredMinistry = skillToMinistryMap.get(roleLower) || roleLower;

  Logger.log(`  🔍 Checking for skill "${roleLower}" → ministry "${requiredMinistry}"`);

  for (const volunteer of volunteers.values()) {
    // 1. STRICT ROLE MATCHING:
    // If volunteer has specific role preferences, they must match exactly
    // If volunteer has NO role preferences, they can do any role in their ministry
    if (volunteer.rolePrefs && volunteer.rolePrefs.length > 0) {
      // Volunteer has specific role preferences - MUST match exactly
      if (!volunteer.rolePrefs.includes(roleLower)) {
        // This volunteer specified roles, but this role isn't one of them
        continue;
      }
    } else {
      // Volunteer has NO role preferences - check if they have the general ministry
      if (!volunteer.ministries.includes(requiredMinistry.toLowerCase())) {
        continue;
      }
    }

    // 2. Must be Active status
    if (volunteer.status && volunteer.status.toLowerCase() !== 'active') {
      continue;
    }

    // 3. Check Whitelist (if exists, must match date)
    if (timeoffMaps.whitelist.has(volunteer.name)) {
      const whitelistMap = timeoffMaps.whitelist.get(volunteer.name);

      // Check if this date is in the whitelist
      if (!whitelistMap.has(massDateString)) {
        // Date not in whitelist - exclude this volunteer
        continue;
      }
      // Note: For now, we match just the date.
      // Future enhancement: match vigil/non-vigil specifically
    }

    // 4. Check Blacklist
    if (timeoffMaps.blacklist.has(volunteer.name)) {
      const blacklistMap = timeoffMaps.blacklist.get(volunteer.name);

      // Check if this date is blacklisted
      if (blacklistMap.has(massDateString)) {
        continue; // Blacklisted for this date
      }
    }

    // 5. Check if already assigned today
    const counts = assignmentCounts.get(volunteer.id);
    if (counts && counts.recent.toDateString() === massDateString) {
      continue;
    }

    // 6. Check if already assigned to this mass
    if (massAssignments.has(volunteer.id)) {
      continue;
    }

    // Passed all checks - eligible
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

function processGroupAssignment(assignment, volunteers, assignmentsSheet, assignCols, skillToMinistryMap) {
  // Simplified group assignment logic
  const familyMember = findFamilyMember(assignment, volunteers, skillToMinistryMap);

  if (familyMember) {
    assignmentsSheet.getRange(assignment.rowIndex, assignCols.ASSIGNED_VOLUNTEER_ID).setValue(familyMember.id);
    assignmentsSheet.getRange(assignment.rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(familyMember.name);
  } else {
    assignmentsSheet.getRange(assignment.rowIndex, assignCols.ASSIGNED_VOLUNTEER_NAME).setValue(assignment.assignedGroup);
  }

  assignmentsSheet.getRange(assignment.rowIndex, assignCols.STATUS).setValue("Assigned");
  return true;
}

function findFamilyMember(assignment, volunteers, skillToMinistryMap) {
  const roleLower = assignment.role.toLowerCase();
  const requiredMinistry = skillToMinistryMap.get(roleLower) || roleLower;

  for (const vol of volunteers.values()) {
    if (!vol.familyTeam || vol.familyTeam.toLowerCase() !== assignment.assignedGroup.toLowerCase()) {
      continue;
    }

    // STRICT ROLE MATCHING: Same logic as filterCandidates
    if (vol.rolePrefs && vol.rolePrefs.length > 0) {
      // Volunteer has specific role preferences - MUST match exactly
      if (vol.rolePrefs.includes(roleLower)) {
        return vol;
      }
    } else {
      // Volunteer has NO role preferences - check if they have the general ministry
      if (vol.ministries.includes(requiredMinistry.toLowerCase())) {
        return vol;
      }
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
