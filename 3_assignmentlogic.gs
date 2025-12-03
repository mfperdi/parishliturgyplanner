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
  // Pass monthString to enable spillover date detection
  const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, scheduleYear, monthString);

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

  } catch (e) {
    Logger.log(`WARNING: Could not build skill-to-ministry map: ${e.message}`);
  }

  return map;
}

/**
 * Optimized volunteer map building with CORRECTED preference reading
 * UPDATED: Include "Ministry Sponsor" status for group assignments
 */
function buildVolunteerMapOptimized(volunteerData) {
  const volMap = new Map();
  const cols = CONSTANTS.COLS.VOLUNTEERS;

  for (const row of volunteerData) {
    const id = HELPER_safeArrayAccess(row, cols.VOLUNTEER_ID - 1);
    if (!id) continue;

    const status = String(HELPER_safeArrayAccess(row, cols.STATUS - 1, '')).toLowerCase();
    // Include both Active and Ministry Sponsor (Ministry Sponsors can be assigned to their groups)
    if (status !== 'active' && status !== 'ministry sponsor') continue;
    
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
      status: status              // Preserve actual status (active or ministry sponsor)
    });
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
 *
 * FIXED: Month boundary comparison (Jan 31 bug fixed)
 * FIXED: Spillover date handling (Feb 1 in January assignments)
 *
 * @param {Array} timeoffData Raw timeoff sheet data
 * @param {number} month 0-indexed month (0=January)
 * @param {number} year Year (e.g., 2026)
 * @param {string} monthString Optional month string (e.g., "2026-01") for spillover detection
 */
function buildTimeoffMapOptimized(timeoffData, month, year, monthString = null) {
  const result = {
    blacklist: new Map(),        // Not Available: volunteer => Map<dateString, Set<{vigil|non-vigil}>>
    whitelist: new Map()         // Only Available: volunteer => Map<dateString, Set<{vigil|non-vigil}>>
  };

  const cols = CONSTANTS.COLS.TIMEOFFS;

  // FIX #1: Set monthEnd to END of day instead of beginning (fixes Jan 31 bug)
  const monthStart = new Date(year, month, 1, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999); // ← FIXED: End of last day

  // FIX #2: Include spillover dates (e.g., Feb 1 in January assignments)
  let spilloverDates = new Set();
  if (monthString) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
      if (assignmentsSheet) {
        const assignData = assignmentsSheet.getDataRange().getValues();
        const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

        // Find all dates in this month's assignments (including spillovers)
        for (let i = 1; i < assignData.length; i++) {
          const rowMonthYear = assignData[i][assignCols.MONTH_YEAR - 1];
          if (rowMonthYear === monthString) {
            const assignDate = new Date(assignData[i][assignCols.DATE - 1]);
            if (!isNaN(assignDate.getTime())) {
              spilloverDates.add(assignDate.toDateString());
            }
          }
        }
        Logger.log(`Found ${spilloverDates.size} unique dates in assignments (including spillovers)`);
      }
    } catch (e) {
      Logger.log(`WARNING: Could not detect spillover dates: ${e.message}`);
    }
  }

  for (const row of timeoffData) {
    const name = HELPER_safeArrayAccess(row, cols.VOLUNTEER_NAME - 1);
    const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, 'Pending');
    const type = HELPER_safeArrayAccess(row, cols.TYPE - 1);

    // Only process approved timeoffs
    if (!name || status !== 'Approved') continue;

    const selectedDates = HELPER_safeArrayAccess(row, cols.SELECTED_DATES - 1);

    // Process based on TYPE
    switch (type) {
      case CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE:
        // Blacklist: Parse dates from Selected Dates column
        const blacklistDates = HELPER_parseDateBasedNotes(selectedDates);

        if (blacklistDates.length > 0) {
          if (!result.blacklist.has(name)) {
            result.blacklist.set(name, new Map());
          }

          const blacklistMap = result.blacklist.get(name);

          for (const dateInfo of blacklistDates) {
            // Include if in month range OR in spillover dates
            const inMonthRange = dateInfo.date >= monthStart && dateInfo.date <= monthEnd;
            const inSpillover = spilloverDates.has(dateInfo.dateString);

            if (inMonthRange || inSpillover) {
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
        // Whitelist: Parse dates from Selected Dates column
        const whitelistDates = HELPER_parseDateBasedNotes(selectedDates);

        if (whitelistDates.length > 0) {
          if (!result.whitelist.has(name)) {
            result.whitelist.set(name, new Map());
          }

          const whitelistMap = result.whitelist.get(name);

          for (const dateInfo of whitelistDates) {
            // Include if in month range OR in spillover dates
            const inMonthRange = dateInfo.date >= monthStart && dateInfo.date <= monthEnd;
            const inSpillover = spilloverDates.has(dateInfo.dateString);

            if (inMonthRange || inSpillover) {
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
    
    // Build assignment counts for all data (for frequency calculation AND rotation)
    if (assignedVolunteerId) {
      const assignDate = new Date(date);
      const eventId = HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1);

      if (!context.assignmentCounts.has(assignedVolunteerId)) {
        context.assignmentCounts.set(assignedVolunteerId, {
          total: 0,
          recent: new Date(0),
          byEventId: {} // NEW: Track assignments per Event ID for rotation
        });
      }

      const counts = context.assignmentCounts.get(assignedVolunteerId);
      counts.total++;

      if (assignDate > counts.recent) {
        counts.recent = assignDate;
      }

      // Track count for this specific Event ID (for rotation)
      if (eventId) {
        counts.byEventId[eventId] = (counts.byEventId[eventId] || 0) + 1;
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
        time: HELPER_safeArrayAccess(row, assignCols.TIME - 1),
        isAnticipated: HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1, false) // NEW: Vigil flag
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
 * PERFORMANCE OPTIMIZED: Batch writes instead of individual setValue() calls
 */
function processAssignments(context, volunteers, timeoffMaps, assignmentsSheet, skillToMinistryMap) {
  const results = {
    groupAssignments: 0,
    individualAssignments: 0,
    skipped: 0
  };

  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Collect all updates to write in batches
  const batchUpdates = [];

  // Process group assignments first
  for (const assignment of context.groupAssignments) {
    const update = processGroupAssignment(assignment, volunteers, assignCols, skillToMinistryMap);
    if (update) {
      batchUpdates.push(update);
      results.groupAssignments++;
    }
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
        // Collect the assignment update (don't write yet)
        batchUpdates.push({
          rowIndex: roleInfo.rowIndex,
          volunteerId: volunteer.id,
          volunteerName: volunteer.name,
          status: "Assigned"
        });

        // Update tracking (including Event ID for rotation)
        updateAssignmentCounts(context.assignmentCounts, volunteer.id, roleInfo.date, roleInfo.eventId);
        massAssignments.set(volunteer.id, roleInfo.role);

        results.individualAssignments++;
        // Reduced logging for performance - only log summary
      } else {
        results.skipped++;
        // Failures logged in findOptimalVolunteer
      }
    }
  }

  // PERFORMANCE BOOST: Write all updates in batch operations
  if (batchUpdates.length > 0) {
    writeBatchAssignments(assignmentsSheet, batchUpdates, assignCols);
    Logger.log(`✅ PERFORMANCE: Batch wrote ${batchUpdates.length} assignments (reduced from ${batchUpdates.length * 3} to ${batchUpdates.length} API calls = 3x faster)`);
  }

  return results;
}

/**
 * Simplified volunteer finding with extracted scoring logic
 * PERFORMANCE: Reduced logging to prevent slowdowns
 */
function findOptimalVolunteer(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap) {
  const candidates = filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap);

  if (candidates.length === 0) {
    // Only log failures to reduce noise
    Logger.log(`⚠️ No eligible volunteers for ${roleInfo.role} on ${roleInfo.date.toDateString()}`);
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

  return candidates[0].volunteer;
}

/**
 * Extracted candidate filtering
 * Filters volunteers based on:
 * - Strict role matching (volunteers only assigned to their specified roles)
 * - Mass preference matching (volunteers only assigned to their preferred masses if specified)
 * - Timeoff blacklist/whitelist enforcement
 * - Already assigned checks
 */
function filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap) {
  const candidates = [];
  const roleLower = roleInfo.role.toLowerCase();
  const massDateString = roleInfo.date.toDateString();
  const eventId = roleInfo.eventId;

  // Map the specific skill to its general ministry category
  // Example: "1st reading" → "lector"
  const requiredMinistry = skillToMinistryMap.get(roleLower) || roleLower;

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

    // 2. Must be Active status (for individual assignments)
    // Note: Ministry Sponsors are excluded from individual auto-assignment
    // but can still be assigned to their designated group masses
    if (volunteer.status && volunteer.status.toLowerCase() !== 'active') {
      continue;
    }

    // 3. Check Mass Preference (if volunteer has preferences, must match Event ID)
    if (volunteer.massPrefs && volunteer.massPrefs.length > 0) {
      // Volunteer has preferred mass times - MUST match Event ID
      if (!eventId || !volunteer.massPrefs.includes(eventId)) {
        // This mass is not in their preferences - exclude
        continue;
      }
    }
    // If volunteer has NO mass preferences, they are flexible (eligible for all masses)

    // 4. Check Whitelist (if exists, must match date AND vigil type)
    if (timeoffMaps.whitelist.has(volunteer.name)) {
      const whitelistMap = timeoffMaps.whitelist.get(volunteer.name);

      // Check if this date is in the whitelist
      if (!whitelistMap.has(massDateString)) {
        // Date not in whitelist - exclude this volunteer
        continue;
      }

      // Vigil-specific matching: Check if mass type matches
      const whitelistTypes = whitelistMap.get(massDateString);
      const massType = roleInfo.isAnticipated ? 'vigil' : 'non-vigil';

      if (!whitelistTypes.has(massType)) {
        // Wrong mass type (e.g., they selected non-vigil but this is vigil) - exclude
        continue;
      }
    }

    // 5. Check Blacklist (date AND vigil type must match)
    if (timeoffMaps.blacklist.has(volunteer.name)) {
      const blacklistMap = timeoffMaps.blacklist.get(volunteer.name);

      // Check if this date is blacklisted
      if (blacklistMap.has(massDateString)) {
        // Check if mass type matches
        const blacklistTypes = blacklistMap.get(massDateString);
        const massType = roleInfo.isAnticipated ? 'vigil' : 'non-vigil';

        if (blacklistTypes.has(massType)) {
          continue; // Blacklisted for this specific mass type
        }
      }
    }

    // 6. Check if already assigned today
    const counts = assignmentCounts.get(volunteer.id);
    if (counts && counts.recent.toDateString() === massDateString) {
      continue;
    }

    // 7. Check if already assigned to this mass
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

function updateAssignmentCounts(assignmentCounts, volunteerId, date, eventId = null) {
  if (!assignmentCounts.has(volunteerId)) {
    assignmentCounts.set(volunteerId, {
      total: 0,
      recent: new Date(0),
      byEventId: {}
    });
  }
  const counts = assignmentCounts.get(volunteerId);
  counts.total++;
  counts.recent = date;

  // Track count for this specific Event ID (for rotation)
  if (eventId) {
    counts.byEventId[eventId] = (counts.byEventId[eventId] || 0) + 1;
  }
}

/**
 * PERFORMANCE OPTIMIZATION: Batch write all assignment updates
 * Reduces API calls from 3 per assignment to 1 per assignment
 *
 * For 100 assignments: 300 API calls → 100 API calls = 3x improvement
 */
function writeBatchAssignments(assignmentsSheet, batchUpdates, assignCols) {
  if (batchUpdates.length === 0) return;

  try {
    Logger.log(`📝 Writing ${batchUpdates.length} assignments in batch mode...`);

    // Get sheet dimensions for validation
    const maxRows = assignmentsSheet.getMaxRows();
    const maxCols = assignmentsSheet.getMaxColumns();
    const startCol = assignCols.ASSIGNED_VOLUNTEER_ID;

    Logger.log(`Sheet dimensions: ${maxRows} rows × ${maxCols} cols, writing to cols ${startCol}-${startCol + 2}`);

    // Validate updates before writing
    for (const update of batchUpdates) {
      const row = update.rowIndex;

      // Validation
      if (!row || row < 1) {
        throw new Error(`Invalid row index: ${row} (must be >= 1)`);
      }

      if (row > maxRows) {
        throw new Error(`Row ${row} exceeds sheet max rows (${maxRows}). Update may reference deleted row.`);
      }

      if (startCol + 2 > maxCols) {
        throw new Error(`Column range ${startCol}-${startCol + 2} exceeds sheet max cols (${maxCols})`);
      }

      if (!update.volunteerName) {
        throw new Error(`Missing volunteer name for row ${row}`);
      }
    }

    // Write each assignment's 3 columns (ID, Name, Status) in a single setValues call
    for (const update of batchUpdates) {
      const row = update.rowIndex;

      try {
        // Write all 3 columns at once: [ID, Name, Status]
        assignmentsSheet.getRange(row, startCol, 1, 3).setValues([[
          update.volunteerId || '',  // Col 10 (J): Volunteer ID (or empty if group)
          update.volunteerName,      // Col 11 (K): Volunteer Name
          update.status              // Col 12 (L): Status
        ]]);
      } catch (rangeError) {
        Logger.log(`❌ Failed to write row ${row}: ${rangeError.message}`);
        Logger.log(`   Update data: volunteerId=${update.volunteerId}, name=${update.volunteerName}, status=${update.status}`);
        throw new Error(`Range error at row ${row}, col ${startCol}: ${rangeError.message}`);
      }
    }

    Logger.log(`✅ Performance: Batch wrote ${batchUpdates.length} assignments in ${batchUpdates.length} API calls (saved ${batchUpdates.length * 2} calls)`);
  } catch (e) {
    Logger.log(`❌ ERROR in writeBatchAssignments: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    throw new Error(`Failed to write batch assignments: ${e.message}`);
  }
}

function processGroupAssignment(assignment, volunteers, assignCols, skillToMinistryMap) {
  // Simplified group assignment logic - returns update object for batch writing
  const familyMember = findFamilyMember(assignment, volunteers, skillToMinistryMap);

  if (familyMember) {
    return {
      rowIndex: assignment.rowIndex,
      volunteerId: familyMember.id,
      volunteerName: familyMember.name,
      status: "Assigned"
    };
  } else {
    return {
      rowIndex: assignment.rowIndex,
      volunteerId: null,
      volunteerName: assignment.assignedGroup,
      status: "Assigned"
    };
  }
}

function findFamilyMember(assignment, volunteers, skillToMinistryMap) {
  const roleLower = assignment.role.toLowerCase();
  const requiredMinistry = skillToMinistryMap.get(roleLower) || roleLower;

  // Note: No status check here - allows both Active and Ministry Sponsor
  // volunteers to be assigned to their designated group masses
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
function ASSIGNMENT_buildTimeoffMap(timeoffData, month, year, monthString = null) {
  return buildTimeoffMapOptimized(timeoffData, month, year, monthString);
}
