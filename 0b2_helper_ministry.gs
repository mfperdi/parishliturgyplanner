/**
 * ====================================================================
 * HELPER FUNCTIONS - MINISTRY, VOLUNTEER, AND TIMEOFF VALIDATION
 * ====================================================================
 *
 * PURPOSE:
 * Provides core validation logic for volunteers, ministries, assignments,
 * and timeoff management. These functions are the single source of truth
 * for eligibility and conflict checking across the application.
 *
 * FUNCTIONS IN THIS FILE:
 * - Skill-to-ministry mapping (buildSkillToMinistryMap)
 * - Volunteer eligibility checking (isVolunteerEligible)
 * - Timeoff conflict detection (checkTimeoffConflict)
 * - Volunteer scoring for auto-assignment (calculateVolunteerScore)
 * - Timeoff notes parsing (whitelist/blacklist formats)
 * - Event ID validation
 *
 * DEPENDENCIES:
 * - 0a_constants.gs (CONSTANTS object)
 * - 0b1_helper_data.gs (readSheetDataCached, readSheetData)
 * - 0b3_helper_formatting.gs (formatDate) - only for error messages
 * - 0b5_helper_misc.gs (safeArrayAccess)
 *
 * USED BY:
 * - 3_assignmentlogic.gs (auto-assignment)
 * - 2_schedulelogic.gs (schedule validation)
 * - 0d_onedit.gs (real-time validation)
 * - 4_timeoff-form.gs (timeoff processing)
 *
 * DECISION TREE - Add new functions here if they:
 * ✅ Validate volunteer eligibility or skills
 * ✅ Check ministry/role matching
 * ✅ Check timeoff conflicts
 * ✅ Parse timeoff request formats
 * ✅ Score volunteers for assignment
 * ❌ Read sheet data → Use 0b1_helper_data.gs
 * ❌ Format for display → Use 0b3_helper_formatting.gs
 * ❌ Show user dialogs → Use 0b4_helper_ui.gs
 *
 * LOADING ORDER: Second helper file (loads after 0b1_helper_data.gs)
 * ====================================================================
 */

/**
 * Builds skill-to-ministry mapping from Ministries sheet
 * Consolidates duplicate logic from:
 * - 3_assignmentlogic.gs: buildSkillToMinistryMap()
 * - 2_schedulelogic.gs: SCHEDULE_buildRoleToMinistryMap()
 * - 0d_onedit.gs: ONEDIT_getRequiredSkill()
 *
 * @returns {Map<string, string>} Map of roleName (lowercase) → ministryName (lowercase)
 */
function HELPER_buildSkillToMinistryMap() {
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
        // Map: "1st reading" → "lector"
        // Map: "2nd reading" → "lector"
        // Map: "chalice" → "eucharistic minister"
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
 * Checks if volunteer is eligible for a specific assignment
 * Consolidates volunteer validation logic from multiple modules
 *
 * @param {object} volunteer - Volunteer object with status, ministries, rolePrefs
 * @param {string} requiredMinistry - Ministry category (e.g., "Lector")
 * @param {string} requiredRole - Specific role/skill (e.g., "1st reading")
 * @param {string} context - Assignment context: 'assignment' | 'onedit' | 'group'
 * @returns {object} {eligible: boolean, reason: string}
 */
function HELPER_isVolunteerEligible(volunteer, requiredMinistry, requiredRole, context = 'assignment') {
  // 1. Check status
  const statusLower = String(volunteer.status || '').toLowerCase();

  if (context === 'group') {
    // Group assignments allow both Active and Ministry Sponsor
    if (statusLower !== 'active' && statusLower !== 'ministry sponsor') {
      return {
        eligible: false,
        reason: `Status is "${volunteer.status}" (not Active or Ministry Sponsor)`
      };
    }
  } else {
    // Individual assignments require Active status only
    if (statusLower !== 'active') {
      return {
        eligible: false,
        reason: `Status is "${volunteer.status}" (not Active)`
      };
    }
  }

  // 2. Check ministry role / skill matching
  const requiredMinistryLower = String(requiredMinistry).toLowerCase();
  const requiredRoleLower = String(requiredRole).toLowerCase();

  // Parse volunteer's ministries (comma-separated)
  const volunteerMinistries = String(volunteer.ministries || '')
    .split(',')
    .map(m => m.trim().toLowerCase())
    .filter(m => m !== '');

  // Parse volunteer's role preferences (comma-separated, optional)
  const volunteerRolePrefs = String(volunteer.rolePrefs || '')
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(r => r !== '');

  // STRICT ROLE MATCHING:
  // If volunteer has specific role preferences, they must match exactly
  // If volunteer has NO role preferences, they can do any role in their ministry
  if (volunteerRolePrefs.length > 0) {
    // Volunteer has specific role preferences - MUST match exactly
    if (!volunteerRolePrefs.includes(requiredRoleLower)) {
      return {
        eligible: false,
        reason: `Has role preferences (${volunteer.rolePrefs}) but not "${requiredRole}"`
      };
    }
  } else {
    // Volunteer has NO role preferences - check if they have the general ministry
    if (!volunteerMinistries.includes(requiredMinistryLower)) {
      return {
        eligible: false,
        reason: `Does not have required ministry "${requiredMinistry}"`
      };
    }
  }

  return { eligible: true, reason: '' };
}

/**
 * Checks for timeoff conflicts (blacklist/whitelist)
 * Consolidates timeoff checking logic from:
 * - 3_assignmentlogic.gs: filterCandidates() timeoff checks
 * - 0d_onedit.gs: ONEDIT_checkTimeoffConflicts()
 *
 * @param {string} volunteerName - Volunteer's full name
 * @param {Date} assignmentDate - Date of assignment
 * @param {string} eventId - Mass event ID (e.g., "SUN-1000")
 * @param {boolean} isAnticipated - Whether mass is anticipated (vigil)
 * @param {object} timeoffMaps - {blacklist: Map, whitelist: Map} from buildTimeoffMap()
 * @returns {object} {hasConflict: boolean, reason: string}
 */
function HELPER_checkTimeoffConflict(volunteerName, assignmentDate, eventId, isAnticipated, timeoffMaps) {
  const massDateString = assignmentDate.toDateString();
  const massType = isAnticipated ? 'vigil' : 'non-vigil';

  // 1. Check Whitelist (if exists, must match date AND vigil type)
  if (timeoffMaps.whitelist.has(volunteerName)) {
    const whitelistMap = timeoffMaps.whitelist.get(volunteerName);

    // Check if this date is in the whitelist
    if (!whitelistMap.has(massDateString)) {
      return {
        hasConflict: true,
        reason: `Only available for specific dates (this date not on whitelist)`
      };
    }

    // Vigil-specific matching: Check if mass type matches
    const whitelistTypes = whitelistMap.get(massDateString);

    if (!whitelistTypes.has(massType)) {
      return {
        hasConflict: true,
        reason: `Only available for ${Array.from(whitelistTypes).join('/')} masses (this is ${massType})`
      };
    }
  }

  // 2. Check Blacklist (date AND vigil type must match)
  if (timeoffMaps.blacklist.has(volunteerName)) {
    const blacklistMap = timeoffMaps.blacklist.get(volunteerName);

    // Check if this date is blacklisted
    if (blacklistMap.has(massDateString)) {
      // Check if mass type matches
      const blacklistTypes = blacklistMap.get(massDateString);

      if (blacklistTypes.has(massType)) {
        return {
          hasConflict: true,
          reason: `Unavailable on ${HELPER_formatDate(assignmentDate, 'default')} (${massType})`
        };
      }
    }
  }

  return { hasConflict: false, reason: '' };
}

/**
 * Consolidated volunteer scoring (extracted from assignment logic)
 * PERFORMANCE: Removed verbose logging (was generating thousands of log lines)
 *
 * Uses CONSTANTS.SCORING for all scoring weights - see 0a_constants.gs
 */
function HELPER_calculateVolunteerScore(volunteer, roleToFill, eventId, assignmentCounts, massAssignments, volunteers, date, timeoffMaps) {
  const S = CONSTANTS.SCORING;  // Shorthand for readability
  let score = S.BASE_SCORE;
  const counts = assignmentCounts.get(volunteer.id) || { total: 0, recent: new Date(0), byEventId: {} };
  const roleLower = roleToFill.toLowerCase();

  // Frequency penalty: stronger penalty ensures better rotation (max 2 assignments per month)
  const frequencyPenalty = counts.total * S.FREQUENCY_PENALTY;
  score -= frequencyPenalty;

  // Mass preference bonus with rotation: favor least-used preferred masses
  if (eventId && volunteer.massPrefs.includes(eventId)) {
    let massBonus = S.MASS_PREFERENCE_BONUS;

    // Rotation logic: reduce bonus for frequently-used preferred masses
    if (counts.byEventId && counts.byEventId[eventId]) {
      const timesAtThisMass = counts.byEventId[eventId];
      const rotationPenalty = timesAtThisMass * S.MASS_ROTATION_PENALTY;
      massBonus = Math.max(S.MASS_PREFERENCE_MIN, massBonus - rotationPenalty);
    }

    score += massBonus;
  }

  // Role preference bonus
  if (volunteer.rolePrefs.includes(roleLower)) {
    score += S.ROLE_PREFERENCE_BONUS;
  }

  // Family team bonus: if family member already assigned to this Mass
  if (volunteer.familyTeam && massAssignments) {
    for (const [assignedVolId, assignedRole] of massAssignments) {
      const assignedVol = volunteers.get(assignedVolId);
      if (assignedVol && assignedVol.familyTeam === volunteer.familyTeam) {
        score += S.FAMILY_TEAM_BONUS;
        break;
      }
    }
  }

  // Limited availability bonus: prioritize volunteers on whitelist for this date
  // Rationale: If they have limited availability, use them when they're available!
  if (timeoffMaps && timeoffMaps.whitelist && date) {
    if (timeoffMaps.whitelist.has(volunteer.name)) {
      const whitelistMap = timeoffMaps.whitelist.get(volunteer.name);
      const dateString = date.toDateString();
      if (whitelistMap.has(dateString)) {
        score += S.LIMITED_AVAILABILITY_BONUS;
      }
    }
  }

  // Flexibility bonus: easy-to-schedule volunteers with no preferences
  if (volunteer.massPrefs.length === 0 && volunteer.rolePrefs.length === 0) {
    score += S.FLEXIBILITY_BONUS;
  }

  // Spacing penalty: discourage consecutive week assignments
  if (date && counts.recent && counts.recent.getTime() > 0) {
    const daysSinceLastAssignment = Math.floor((date.getTime() - counts.recent.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastAssignment < 7) {
      score -= S.SPACING_PENALTY_SAME_WEEK;  // Strong penalty for 0-6 days
    } else if (daysSinceLastAssignment < 14) {
      score -= S.SPACING_PENALTY_RECENT;     // Mild penalty for 7-13 days
    }
    // No penalty for 14+ days (2+ weeks gap) - preferred spacing
  }

  // Random tiebreaker: creates natural variation between otherwise-equal volunteers
  // Range is small enough to not override real preferences
  const randomTiebreaker = (Math.random() * S.RANDOM_TIEBREAKER_RANGE) - (S.RANDOM_TIEBREAKER_RANGE / 2);
  score += randomTiebreaker;

  return score;
}

/**
 * Parse whitelist notes to extract Event IDs and dates
 * Supports hybrid format: "SUN-1000, SAT-1700, 12/25/2025, 1/1/2026"
 *
 * @param {string} notesField - Comma-separated Event IDs and/or dates
 * @returns {object} { eventIds: [], dates: [], invalid: [] }
 */
function HELPER_parseWhitelistNotes(notesField) {
  const result = {
    eventIds: [],
    dates: [],
    invalid: []
  };

  if (!notesField || notesField.trim() === '') {
    return result;
  }

  // Split by comma and process each item
  const items = notesField.split(',').map(s => s.trim()).filter(s => s.length > 0);

  for (const item of items) {
    // Pattern 1: Event ID (e.g., SUN-1000, SAT-1700, FRI-0700)
    // Format: 3+ letters, hyphen, 4 digits
    const eventIdPattern = /^[A-Z]{3,}-\d{4}$/i;

    if (eventIdPattern.test(item)) {
      result.eventIds.push(item.toUpperCase());
      continue;
    }

    // Pattern 2: Date (try to parse as date)
    const parsedDate = new Date(item);

    if (!isNaN(parsedDate.getTime())) {
      // Valid date - set to noon to avoid timezone issues
      const safeDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 12, 0, 0);
      result.dates.push(safeDate);
      continue;
    }

    // If neither pattern matches, mark as invalid
    result.invalid.push(item);
  }

  Logger.log(`Parsed whitelist notes: ${result.eventIds.length} Event IDs, ${result.dates.length} dates, ${result.invalid.length} invalid`);

  return result;
}

/**
 * Parse date-based Notes field from timeoff form checkboxes.
 * NEW system: Notes contain dates like "1/5/2026, 1/4/2026 (Vigil), 1/12/2026"
 * @param {string} notesField - Notes field content
 * @returns {Array<object>} Array of {dateString, isVigil} objects
 */
function HELPER_parseDateBasedNotes(notesField) {
  const result = [];

  if (!notesField || notesField.trim() === '') {
    return result;
  }

  // Split by comma and process each item
  const items = notesField.split(',').map(s => s.trim()).filter(s => s.length > 0);

  for (const item of items) {
    // Check if this is a vigil mass
    const isVigil = item.toLowerCase().includes('(vigil)');

    // Extract date (remove "(Vigil)" if present)
    const dateStr = item.replace(/\s*\(vigil\)/i, '').trim();

    // Try to parse the date
    const parsedDate = new Date(dateStr);

    if (!isNaN(parsedDate.getTime())) {
      // Valid date - set to noon to avoid timezone issues
      const safeDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 12, 0, 0);

      result.push({
        date: safeDate,
        dateString: safeDate.toDateString(),  // For Map keys
        isVigil: isVigil,
        original: item  // Keep original for debugging
      });
    } else {
      Logger.log(`WARNING: Could not parse date from: "${item}"`);
    }
  }

  Logger.log(`Parsed ${result.length} dates from notes`);
  return result;
}

/**
 * Validate that Event IDs exist in mass configuration sheets
 * Checks WeeklyMasses, MonthlyMasses, and YearlyMasses
 *
 * @param {Array<string>} eventIdArray - Array of Event IDs to validate
 * @returns {object} { valid: [], invalid: [] }
 */
function HELPER_validateEventIds(eventIdArray) {
  const result = {
    valid: [],
    invalid: []
  };

  if (!eventIdArray || eventIdArray.length === 0) {
    return result;
  }

  try {
    // Build set of all valid Event IDs from the consolidated MassSchedule sheet
    const validEventIds = new Set();
    const massData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.MASS_SCHEDULE);
    const massCols = CONSTANTS.COLS.MASS_SCHEDULE;
    for (const row of massData) {
      const eventId = HELPER_safeArrayAccess(row, massCols.EVENT_ID - 1);
      if (eventId) validEventIds.add(eventId.toUpperCase());
    }

    Logger.log(`Found ${validEventIds.size} valid Event IDs in MassSchedule`);

    // Validate each Event ID
    for (const eventId of eventIdArray) {
      const upperEventId = eventId.toUpperCase();
      if (validEventIds.has(upperEventId)) {
        result.valid.push(upperEventId);
      } else {
        result.invalid.push(eventId);
      }
    }

  } catch (e) {
    Logger.log(`ERROR validating Event IDs: ${e.message}`);
    // If we can't read mass config, mark all as invalid
    result.invalid = eventIdArray;
  }

  Logger.log(`Event ID validation: ${result.valid.length} valid, ${result.invalid.length} invalid`);

  return result;
}
