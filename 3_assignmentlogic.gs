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

  // Determine spacing thresholds based on month workload
  assignmentContext.spacingThresholds = calculateSpacingThresholds(assignmentContext.unassignedRoles);

  // Process assignments
  const results = processAssignments(assignmentContext, volunteers, timeoffMaps, assignmentsSheet, skillToMinistryMap);

  return formatAssignmentResults(results, monthString);
}

/**
 * Build skill-to-ministry mapping from Ministries sheet
 * Maps specific skills (e.g., "1st reading") to general ministry categories (e.g., "Lector")
 * This allows volunteers with "Lector" to be matched to "1st reading" assignments
 * UPDATED: Now reads from Ministries sheet instead of MassTemplates for centralized role definitions
 */
function buildSkillToMinistryMap() {
  const map = new Map();

  try {
    const ministryData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MINISTRIES);
    const cols = CONSTANTS.COLS.MINISTRIES;

    for (const row of ministryData) {
      const ministryName = HELPER_safeArrayAccess(row, cols.MINISTRY_NAME - 1);
      const roleName = HELPER_safeArrayAccess(row, cols.ROLE_NAME - 1);
      const isActive = HELPER_safeArrayAccess(row, cols.IS_ACTIVE - 1, true); // Default to active if missing

      // Only include active roles
      if (ministryName && roleName && isActive) {
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

    Logger.log(`Built skill-to-ministry map with ${map.size} mappings from Ministries sheet`);

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
 * Calculate spacing thresholds based on month workload
 * Busy months (6+ liturgical days) get relaxed spacing to ensure coverage
 */
function calculateSpacingThresholds(unassignedRoles) {
  // Count unique liturgical dates in this month
  const uniqueDates = new Set();
  for (const roleInfo of unassignedRoles) {
    uniqueDates.add(roleInfo.date.toDateString());
  }

  const liturgicalDays = uniqueDates.size;
  const isBusyMonth = liturgicalDays >= 6;

  if (isBusyMonth) {
    // Relaxed spacing for busy months (Christmas, Easter, etc.)
    Logger.log(`📅 BUSY MONTH: ${liturgicalDays} liturgical days detected, using relaxed spacing`);
    return {
      afterZero: 7,    // 8+ days (same as normal)
      afterOne: 10,    // 11+ days (relaxed from 14+)
      afterTwo: 14,    // 15+ days (relaxed from 21+)
      isBusy: true
    };
  } else {
    // Normal spacing for typical months
    Logger.log(`📅 Normal month: ${liturgicalDays} liturgical days, using standard spacing`);
    return {
      afterZero: 7,    // 8+ days
      afterOne: 13,    // 14+ days
      afterTwo: 20,    // 21+ days
      isBusy: false
    };
  }
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
    assignmentCounts: new Map(),
    liturgicalAssignments: new Map() // NEW: Track assignments by liturgical celebration
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

      // Track liturgical celebration assignments for current month
      // Map<liturgicalCelebration, Map<volunteerId, massKey>>
      if (rowMonthYear === monthString) {
        const liturgicalCelebration = HELPER_safeArrayAccess(row, assignCols.LITURGICAL_CELEBRATION - 1);
        const time = HELPER_safeArrayAccess(row, assignCols.TIME - 1);
        if (liturgicalCelebration) {
          if (!context.liturgicalAssignments.has(liturgicalCelebration)) {
            context.liturgicalAssignments.set(liturgicalCelebration, new Map());
          }
          const massKey = `${assignDate.toDateString()}_${time}`;
          context.liturgicalAssignments.get(liturgicalCelebration).set(assignedVolunteerId, massKey);
        }
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
        isAnticipated: HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1, false), // Vigil flag
        liturgicalCelebration: HELPER_safeArrayAccess(row, assignCols.LITURGICAL_CELEBRATION - 1) // NEW: For liturgical day filtering
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
    skipped: 0,
    fallbackWarnings: []  // Track assignments that required fallback passes
  };

  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Collect all updates to write in batches
  const batchUpdates = [];

  // Process group assignments first - GROUP BY MASS to prevent double-assignment
  const groupedGroupAssignments = groupAssignmentsByMassKey(context.groupAssignments);

  for (const [massKey, assignments] of groupedGroupAssignments) {
    const massGroupAssignments = new Map(); // Track volunteers assigned to THIS mass

    for (const assignment of assignments) {
      const update = processGroupAssignment(assignment, volunteers, assignCols, skillToMinistryMap, massGroupAssignments, context.liturgicalAssignments);
      if (update) {
        batchUpdates.push(update);
        results.groupAssignments++;

        // Track this volunteer as assigned to this mass (if a specific volunteer was assigned)
        if (update.volunteerId) {
          massGroupAssignments.set(update.volunteerId, assignment.role);

          // CRITICAL FIX: Update liturgical celebration tracking for group assignments
          // This prevents the same volunteer from being assigned to individual roles
          // at a different mass on the same liturgical day
          if (assignment.liturgicalCelebration) {
            if (!context.liturgicalAssignments.has(assignment.liturgicalCelebration)) {
              context.liturgicalAssignments.set(assignment.liturgicalCelebration, new Map());
            }
            const liturgicalMassKey = `${assignment.date.toDateString()}_${assignment.time}`;
            context.liturgicalAssignments.get(assignment.liturgicalCelebration).set(update.volunteerId, liturgicalMassKey);
          }
        }
      }
    }
  }

  // Group individual assignments by mass for family team processing
  const massesByDateTime = groupAssignmentsByMass(context.unassignedRoles);

  // NEW: PROACTIVE FAMILY TEAM ASSIGNMENT
  // Assign family teams together BEFORE individual processing
  // This ensures families serve at the same mass (hard requirement)
  for (const [massKey, massInfo] of massesByDateTime) {
    if (massInfo.roles.length >= 2) {
      assignFamilyTeamsToMass(
        massInfo,
        volunteers,
        timeoffMaps,
        context,
        context.assignmentCounts,
        skillToMinistryMap,
        batchUpdates,
        results
      );
    }
  }

  // Process each mass for remaining individual assignments
  for (const [massKey, massInfo] of massesByDateTime) {
    const massAssignments = new Map(); // Track assignments for this specific mass

    for (const roleInfo of massInfo.roles) {
      // Skip roles already assigned by family team pass
      if (roleInfo.familyAssigned) {
        continue;
      }

      const result = findOptimalVolunteer(
        roleInfo,
        volunteers,
        timeoffMaps,
        context.assignmentCounts,
        massAssignments,
        skillToMinistryMap,
        context.liturgicalAssignments,
        context
      );

      if (result.volunteer) {
        // Track warnings for fallback passes 2 and 3
        if (result.fallbackLevel >= 2) {
          const warningType = result.fallbackLevel === 2 ? 'No spacing constraints' : 'Ignored mass preferences';
          results.fallbackWarnings.push({
            date: HELPER_formatDate(roleInfo.date, 'default'),
            time: roleInfo.time,
            role: roleInfo.role,
            volunteer: result.volunteer.name,
            level: result.fallbackLevel,
            type: warningType
          });
        }

        // Collect the assignment update (don't write yet)
        batchUpdates.push({
          rowIndex: roleInfo.rowIndex,
          volunteerId: result.volunteer.id,
          volunteerName: result.volunteer.name,
          status: "Assigned"
        });

        // Update tracking (including Event ID for rotation)
        updateAssignmentCounts(context.assignmentCounts, result.volunteer.id, roleInfo.date, roleInfo.eventId);
        massAssignments.set(result.volunteer.id, roleInfo.role);

        // Update liturgical celebration tracking
        if (roleInfo.liturgicalCelebration) {
          if (!context.liturgicalAssignments.has(roleInfo.liturgicalCelebration)) {
            context.liturgicalAssignments.set(roleInfo.liturgicalCelebration, new Map());
          }
          const massKey = `${roleInfo.date.toDateString()}_${roleInfo.time}`;
          context.liturgicalAssignments.get(roleInfo.liturgicalCelebration).set(result.volunteer.id, massKey);
        }

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
 * PROACTIVE FAMILY TEAM ASSIGNMENT
 * Assigns family teams together BEFORE individual processing
 * This ensures families serve at the same mass (hard requirement)
 */
function assignFamilyTeamsToMass(massInfo, volunteers, timeoffMaps, context, assignmentCounts, skillToMinistryMap, batchUpdates, results) {
  // Build family team map (only from eligible volunteers)
  const familyTeams = new Map(); // familyTeam => Array<volunteer>

  for (const volunteer of volunteers.values()) {
    if (volunteer.familyTeam && volunteer.status === 'active') {
      if (!familyTeams.has(volunteer.familyTeam)) {
        familyTeams.set(volunteer.familyTeam, []);
      }
      familyTeams.get(volunteer.familyTeam).push(volunteer);
    }
  }

  // Filter to only teams with 2+ members
  const multiMemberTeams = Array.from(familyTeams.entries())
    .filter(([_, members]) => members.length >= 2);

  if (multiMemberTeams.length === 0) return; // No family teams to assign

  // Get unassigned roles for this mass
  const unassignedRoles = massInfo.roles.filter(role => !role.familyAssigned);

  if (unassignedRoles.length < 2) return; // Need at least 2 roles for family assignment

  // Try to assign each family team
  for (const [familyTeam, members] of multiMemberTeams) {
    // Find roles that family members can fill
    const eligibleAssignments = []; // Array<{volunteer, roleInfo}>

    for (const member of members) {
      // Find a role this family member can fill
      for (const roleInfo of unassignedRoles) {
        // Skip roles already claimed by this family
        if (eligibleAssignments.some(ea => ea.roleInfo === roleInfo)) {
          continue;
        }

        // Check if member is eligible for this role
        if (isVolunteerEligibleForRole(member, roleInfo, timeoffMaps, assignmentCounts, skillToMinistryMap, context)) {
          eligibleAssignments.push({ volunteer: member, roleInfo: roleInfo });
          break; // Found a role for this member, move to next member
        }
      }
    }

    // If ALL family members can be assigned to different roles, check spacing before assigning
    if (eligibleAssignments.length === members.length && eligibleAssignments.length >= 2) {
      // SPACING CHECK: Skip family if any member was assigned within required spacing
      // Dynamic spacing: becomes stricter with more assignments
      // Thresholds automatically relax during busy months (6+ liturgical days)
      let hasRecentAssignment = false;
      for (const { volunteer, roleInfo } of eligibleAssignments) {
        const counts = assignmentCounts.get(volunteer.id);
        if (counts && counts.recent && counts.recent.getTime() > 0) {
          const daysSinceLastAssignment = Math.floor((roleInfo.date.getTime() - counts.recent.getTime()) / (1000 * 60 * 60 * 24));

          // Determine minimum spacing based on assignment count
          // Uses context.spacingThresholds which adjusts for busy months
          let minSpacing = context.spacingThresholds.afterZero;
          if (counts.total >= 2) {
            minSpacing = context.spacingThresholds.afterTwo;
          } else if (counts.total >= 1) {
            minSpacing = context.spacingThresholds.afterOne;
          }

          if (daysSinceLastAssignment <= minSpacing) {
            hasRecentAssignment = true;
            Logger.log(`⚠️ FAMILY SPACING: Skipping ${familyTeam} (${volunteer.name} served ${daysSinceLastAssignment} days ago, needs ${minSpacing + 1}+ days with ${counts.total} prior assignments)`);
            break;
          }
        }
      }

      if (hasRecentAssignment) {
        continue; // Skip this family due to spacing, let other families or individuals fill these roles
      }

      Logger.log(`✅ FAMILY TEAM: Assigning ${familyTeam} together (${members.length} members)`);

      for (const { volunteer, roleInfo } of eligibleAssignments) {
        // Create batch update
        batchUpdates.push({
          rowIndex: roleInfo.rowIndex,
          volunteerId: volunteer.id,
          volunteerName: volunteer.name,
          status: "Assigned"
        });

        // Update tracking
        updateAssignmentCounts(assignmentCounts, volunteer.id, roleInfo.date, roleInfo.eventId);

        // Mark role as assigned
        roleInfo.familyAssigned = true;

        // Update liturgical tracking
        if (roleInfo.liturgicalCelebration) {
          if (!context.liturgicalAssignments.has(roleInfo.liturgicalCelebration)) {
            context.liturgicalAssignments.set(roleInfo.liturgicalCelebration, new Map());
          }
          const massKey = `${roleInfo.date.toDateString()}_${roleInfo.time}`;
          context.liturgicalAssignments.get(roleInfo.liturgicalCelebration).set(volunteer.id, massKey);
        }

        results.individualAssignments++;
      }

      // Don't try to assign this family again at this mass
      // (they've been assigned)
      break;
    }
  }
}

/**
 * Helper: Check if volunteer is eligible for a specific role
 * Uses same logic as filterCandidates but for a single volunteer
 */
function isVolunteerEligibleForRole(volunteer, roleInfo, timeoffMaps, assignmentCounts, skillToMinistryMap, context) {
  const roleLower = roleInfo.role.toLowerCase();
  const massDateString = roleInfo.date.toDateString();
  const eventId = roleInfo.eventId;

  // Map skill to ministry
  const requiredMinistry = skillToMinistryMap.get(roleLower) || roleLower;

  // 1. Check role match
  if (volunteer.rolePrefs && volunteer.rolePrefs.length > 0) {
    if (!volunteer.rolePrefs.includes(roleLower)) {
      return false;
    }
  } else {
    if (!volunteer.ministries.includes(requiredMinistry.toLowerCase())) {
      return false;
    }
  }

  // 2. Must be Active
  if (volunteer.status && volunteer.status.toLowerCase() !== 'active') {
    return false;
  }

  // 3. Check mass preference
  if (volunteer.massPrefs && volunteer.massPrefs.length > 0) {
    if (!eventId || !volunteer.massPrefs.includes(eventId)) {
      return false;
    }
  }

  // 4. Check whitelist
  if (timeoffMaps.whitelist.has(volunteer.name)) {
    const whitelistMap = timeoffMaps.whitelist.get(volunteer.name);
    if (!whitelistMap.has(massDateString)) {
      return false;
    }
    const whitelistTypes = whitelistMap.get(massDateString);
    const massType = roleInfo.isAnticipated ? 'vigil' : 'non-vigil';
    if (!whitelistTypes.has(massType)) {
      return false;
    }
  }

  // 5. Check blacklist
  if (timeoffMaps.blacklist.has(volunteer.name)) {
    const blacklistMap = timeoffMaps.blacklist.get(volunteer.name);
    if (blacklistMap.has(massDateString)) {
      const blacklistTypes = blacklistMap.get(massDateString);
      const massType = roleInfo.isAnticipated ? 'vigil' : 'non-vigil';
      if (blacklistTypes.has(massType)) {
        return false;
      }
    }
  }

  // 6. Check if already assigned today
  const counts = assignmentCounts.get(volunteer.id);
  if (counts && counts.recent.toDateString() === massDateString) {
    return false;
  }

  // 7. Check if already assigned to this liturgical celebration
  if (context.liturgicalAssignments && roleInfo.liturgicalCelebration) {
    const celebrationMap = context.liturgicalAssignments.get(roleInfo.liturgicalCelebration);
    if (celebrationMap && celebrationMap.has(volunteer.id)) {
      return false;
    }
  }

  return true; // Eligible!
}

/**
 * Simplified volunteer finding with extracted scoring logic
 * PERFORMANCE: Reduced logging to prevent slowdowns
 * FALLBACK LOGIC: Progressively relaxes constraints to ensure all slots are filled
 *
 * @returns {Object} { volunteer, fallbackLevel } where fallbackLevel indicates which pass succeeded:
 *   0 = full constraints, 1 = relaxed spacing, 2 = no spacing, 3 = no mass preference, null = failed
 */
function findOptimalVolunteer(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap, liturgicalAssignments, context) {
  let fallbackLevel = 0;

  // Try with full constraints first
  let candidates = filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap, liturgicalAssignments, context, 1.0);

  // FALLBACK PASS 1: Relax spacing by 50% if no candidates found
  if (candidates.length === 0) {
    fallbackLevel = 1;
    Logger.log(`⚠️ No volunteers with full constraints for ${roleInfo.role} on ${roleInfo.date.toDateString()}, trying relaxed spacing (50%)...`);
    candidates = filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap, liturgicalAssignments, context, 0.5);
  }

  // FALLBACK PASS 2: Remove spacing constraints entirely if still no candidates
  if (candidates.length === 0) {
    fallbackLevel = 2;
    Logger.log(`⚠️ No volunteers with relaxed spacing, trying without spacing constraints...`);
    candidates = filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap, liturgicalAssignments, context, 0);
  }

  // FALLBACK PASS 3: Remove mass preference requirement if still no candidates
  if (candidates.length === 0) {
    fallbackLevel = 3;
    Logger.log(`⚠️ No volunteers without spacing, trying without mass preference filter...`);
    candidates = filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap, liturgicalAssignments, context, 0, true);
  }

  if (candidates.length === 0) {
    Logger.log(`❌ CRITICAL: No eligible volunteers found even with all fallbacks for ${roleInfo.role} on ${roleInfo.date.toDateString()}`);
    return { volunteer: null, fallbackLevel: null };
  }

  // Score and sort candidates
  for (const candidate of candidates) {
    candidate.score = HELPER_calculateVolunteerScore(
      candidate.volunteer,
      roleInfo.role,
      roleInfo.eventId,
      assignmentCounts,
      massAssignments,
      volunteers,
      roleInfo.date,
      timeoffMaps
    );
  }

  candidates.sort((a, b) => b.score - a.score);

  return { volunteer: candidates[0].volunteer, fallbackLevel: fallbackLevel };
}

/**
 * Extracted candidate filtering
 * Filters volunteers based on:
 * - Strict role matching (volunteers only assigned to their specified roles)
 * - Mass preference matching (volunteers only assigned to their preferred masses if specified)
 * - Timeoff blacklist/whitelist enforcement
 * - Already assigned checks (same day and same liturgical celebration)
 *
 * @param {number} spacingMultiplier - Multiplier for spacing constraints (0=none, 0.5=relaxed, 1.0=full)
 * @param {boolean} ignoreMassPreference - If true, ignore mass preference filtering
 */
function filterCandidates(roleInfo, volunteers, timeoffMaps, assignmentCounts, massAssignments, skillToMinistryMap, liturgicalAssignments, context, spacingMultiplier = 1.0, ignoreMassPreference = false) {
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
    // FALLBACK: Skip this check if ignoreMassPreference is true
    if (!ignoreMassPreference && volunteer.massPrefs && volunteer.massPrefs.length > 0) {
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

    // 7. Check spacing (dynamic based on assignment count)
    // Dynamic spacing: becomes stricter with more assignments
    // Thresholds automatically relax during busy months (6+ liturgical days)
    // FALLBACK: Apply spacingMultiplier (0=skip, 0.5=relaxed, 1.0=full)
    if (spacingMultiplier > 0 && counts && counts.recent && counts.recent.getTime() > 0) {
      const daysSinceLastAssignment = Math.floor((roleInfo.date.getTime() - counts.recent.getTime()) / (1000 * 60 * 60 * 24));

      // Determine minimum spacing based on assignment count
      // Uses context.spacingThresholds which adjusts for busy months
      let minSpacing = context.spacingThresholds.afterZero;
      if (counts.total >= 2) {
        minSpacing = context.spacingThresholds.afterTwo;
      } else if (counts.total >= 1) {
        minSpacing = context.spacingThresholds.afterOne;
      }

      // Apply spacing multiplier for fallback passes
      minSpacing = Math.floor(minSpacing * spacingMultiplier);

      if (daysSinceLastAssignment <= minSpacing) {
        continue; // Skip - insufficient spacing for assignment count
      }
    }

    // 8. Check if already assigned to this mass
    if (massAssignments.has(volunteer.id)) {
      continue;
    }

    // 9. Check if already assigned to this liturgical celebration
    // Prevents volunteer from serving multiple masses on same liturgical day
    // (e.g., Saturday vigil + Sunday morning for same celebration)
    if (liturgicalAssignments && roleInfo.liturgicalCelebration) {
      const celebrationMap = liturgicalAssignments.get(roleInfo.liturgicalCelebration);
      if (celebrationMap && celebrationMap.has(volunteer.id)) {
        continue; // Already assigned to a mass for this liturgical celebration
      }
    }

    // 10. Check family team constraint - family members MUST serve together at same mass
    // If volunteer has family team AND a family member is already assigned to this liturgical
    // celebration, ensure they're assigned to the SAME mass (same date+time), not a different one.
    if (volunteer.familyTeam && liturgicalAssignments && roleInfo.liturgicalCelebration) {
      const celebrationMap = liturgicalAssignments.get(roleInfo.liturgicalCelebration);
      if (celebrationMap) {
        const currentMassKey = `${roleInfo.date.toDateString()}_${roleInfo.time}`;
        let familyMemberAtDifferentMass = false;

        // Check if any family member is assigned to this liturgical celebration
        for (const [otherVolId, otherVol] of volunteers) {
          if (otherVol.familyTeam === volunteer.familyTeam && otherVolId !== volunteer.id) {
            const familyMemberMassKey = celebrationMap.get(otherVolId);
            if (familyMemberMassKey && familyMemberMassKey !== currentMassKey) {
              // Family member is assigned to a DIFFERENT mass on this liturgical day
              familyMemberAtDifferentMass = true;
              break;
            }
          }
        }

        if (familyMemberAtDifferentMass) {
          continue; // Exclude this volunteer (families must serve together at same mass)
        }
      }
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

/**
 * Group group assignments by mass (date+time)
 * This prevents the same volunteer from being assigned to multiple roles in the same mass
 */
function groupAssignmentsByMassKey(groupAssignments) {
  const massesByDateTime = new Map();

  for (const assignment of groupAssignments) {
    const massKey = `${assignment.date.toDateString()}_${assignment.time}`;

    if (!massesByDateTime.has(massKey)) {
      massesByDateTime.set(massKey, []);
    }

    massesByDateTime.get(massKey).push(assignment);
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

function processGroupAssignment(assignment, volunteers, assignCols, skillToMinistryMap, massGroupAssignments = new Map(), liturgicalAssignments = new Map()) {
  // Simplified group assignment logic - returns update object for batch writing
  const familyMember = findFamilyMember(assignment, volunteers, skillToMinistryMap, massGroupAssignments, liturgicalAssignments);

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

function findFamilyMember(assignment, volunteers, skillToMinistryMap, massGroupAssignments = new Map(), liturgicalAssignments = new Map()) {
  const roleLower = assignment.role.toLowerCase();
  const requiredMinistry = skillToMinistryMap.get(roleLower) || roleLower;

  // Build list of eligible volunteers with their role flexibility
  const eligible = [];

  // Note: No status check here - allows both Active and Ministry Sponsor
  // volunteers to be assigned to their designated group masses
  for (const vol of volunteers.values()) {
    if (!vol.familyTeam || vol.familyTeam.toLowerCase() !== assignment.assignedGroup.toLowerCase()) {
      continue;
    }

    // CRITICAL: Check if this volunteer is already assigned to another role in this mass
    if (massGroupAssignments.has(vol.id)) {
      continue; // Skip - already assigned to this mass
    }

    // CRITICAL FIX: Check if this volunteer is already assigned to another mass
    // for this liturgical celebration (prevents duplicate assignments on same liturgical day)
    if (assignment.liturgicalCelebration && liturgicalAssignments.has(assignment.liturgicalCelebration)) {
      const celebrationMap = liturgicalAssignments.get(assignment.liturgicalCelebration);
      if (celebrationMap.has(vol.id)) {
        const existingMassKey = celebrationMap.get(vol.id);
        const currentMassKey = `${assignment.date.toDateString()}_${assignment.time}`;
        if (existingMassKey !== currentMassKey) {
          // Volunteer is already assigned to a DIFFERENT mass on this liturgical day
          continue;
        }
      }
    }

    let matches = false;
    let roleCount = 0;

    // STRICT ROLE MATCHING: Same logic as filterCandidates
    if (vol.rolePrefs && vol.rolePrefs.length > 0) {
      // Volunteer has specific role preferences - MUST match exactly
      if (vol.rolePrefs.includes(roleLower)) {
        matches = true;
        roleCount = vol.rolePrefs.length; // Count how many roles they can do
      }
    } else {
      // Volunteer has NO role preferences - check if they have the general ministry
      if (vol.ministries.includes(requiredMinistry.toLowerCase())) {
        matches = true;
        roleCount = 999; // High number = very flexible (can do many roles)
      }
    }

    if (matches) {
      eligible.push({ volunteer: vol, roleCount: roleCount });
    }
  }

  if (eligible.length === 0) {
    return null;
  }

  // PRIORITY: Sort by role count (ascending) - volunteers with fewer role options get priority
  // This ensures specialists (1 role) get their role before generalists (multiple roles)
  eligible.sort((a, b) => a.roleCount - b.roleCount);

  // Return the volunteer with the fewest role options (most specialized)
  return eligible[0].volunteer;
}

function formatAssignmentResults(results, monthString) {
  const total = results.groupAssignments + results.individualAssignments;
  let message = `Assignment complete for ${monthString}! ` +
                `Group assignments: ${results.groupAssignments}, ` +
                `Individual assignments: ${results.individualAssignments}, ` +
                `Unassigned: ${results.skipped}`;

  // Add warnings if fallback passes were used
  if (results.fallbackWarnings && results.fallbackWarnings.length > 0) {
    message += '\n\n⚠️ FALLBACK WARNINGS:\n';
    message += `${results.fallbackWarnings.length} assignment(s) required relaxed constraints:\n\n`;

    // Group by type
    const noSpacing = results.fallbackWarnings.filter(w => w.level === 2);
    const ignoredPrefs = results.fallbackWarnings.filter(w => w.level === 3);

    if (noSpacing.length > 0) {
      message += `🔶 NO SPACING CONSTRAINTS (${noSpacing.length}):\n`;
      message += 'These volunteers were assigned without spacing requirements:\n';
      noSpacing.forEach(w => {
        message += `  • ${w.date} ${w.time} - ${w.role}: ${w.volunteer}\n`;
      });
      message += '\n';
    }

    if (ignoredPrefs.length > 0) {
      message += `🔶 IGNORED MASS PREFERENCES (${ignoredPrefs.length}):\n`;
      message += 'These volunteers were assigned outside their preferred mass times:\n';
      ignoredPrefs.forEach(w => {
        message += `  • ${w.date} ${w.time} - ${w.role}: ${w.volunteer}\n`;
      });
      message += '\n';
    }

    message += '💡 These assignments will carry higher frequency penalties for future months.';
  }

  return message;
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
