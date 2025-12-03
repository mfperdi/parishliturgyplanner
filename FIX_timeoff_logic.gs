/**
 * ====================================================================
 * FIXES FOR TIMEOFF LOGIC BUGS
 * ====================================================================
 *
 * This file contains corrected versions of the timeoff-related functions
 * with bugs fixed. Replace the corresponding functions in 3_assignmentlogic.gs
 * with these corrected versions.
 *
 * BUGS FIXED:
 * 1. Month boundary comparison (Jan 31 exclusion bug)
 * 2. Spillover date handling (Feb 1 in January assignments)
 * 3. Enhanced logging for debugging
 */

/**
 * FIXED VERSION: Build timeoff maps with corrected month boundary logic
 *
 * CHANGES:
 * - monthEnd now set to 23:59:59 instead of 00:00:00 (fixes last-day-of-month bug)
 * - Added spillover date handling (includes dates outside month if they're in assignments)
 * - Enhanced logging for debugging
 *
 * @param {Array} timeoffData Raw timeoff sheet data
 * @param {number} month 0-indexed month (0=January)
 * @param {number} year Year (e.g., 2026)
 * @param {string} monthString Optional month string (e.g., "2026-01") for spillover detection
 * @returns {object} { blacklist: Map, whitelist: Map }
 */
function buildTimeoffMapOptimized_FIXED(timeoffData, month, year, monthString = null) {
  const result = {
    blacklist: new Map(),        // Not Available: volunteer => Map<dateString, Set<{vigil|non-vigil}>>
    whitelist: new Map()         // Only Available: volunteer => Map<dateString, Set<{vigil|non-vigil}>>
  };

  const cols = CONSTANTS.COLS.TIMEOFFS;

  // FIX #1: Set monthEnd to END of day instead of beginning
  const monthStart = new Date(year, month, 1, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999); // ← FIXED: End of last day

  Logger.log(`Building timeoff map for ${year}-${String(month + 1).padStart(2, '0')}`);
  Logger.log(`  Month boundaries: ${monthStart.toDateString()} to ${monthEnd.toDateString()}`);

  // FIX #2: Optionally include spillover dates
  // If monthString is provided, we can check which dates are actually in the assignments
  let spilloverDates = new Set();

  if (monthString) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

      if (assignmentsSheet) {
        const assignData = assignmentsSheet.getDataRange().getValues();
        const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

        // Find all dates that are in this month's assignments (including spillovers)
        for (let i = 1; i < assignData.length; i++) { // Skip header
          const rowMonthYear = assignData[i][assignCols.MONTH_YEAR - 1];
          if (rowMonthYear === monthString) {
            const assignDate = new Date(assignData[i][assignCols.DATE - 1]);
            if (!isNaN(assignDate.getTime())) {
              spilloverDates.add(assignDate.toDateString());
            }
          }
        }

        Logger.log(`  Found ${spilloverDates.size} unique dates in assignments (including spillovers)`);
      }
    } catch (e) {
      Logger.log(`  WARNING: Could not read assignment dates for spillover detection: ${e.message}`);
    }
  }

  // Process each timeoff request
  let processedCount = 0;
  let skippedCount = 0;

  for (const row of timeoffData) {
    const name = HELPER_safeArrayAccess(row, cols.VOLUNTEER_NAME - 1);
    const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, 'Pending');
    const type = HELPER_safeArrayAccess(row, cols.TYPE - 1);

    // Only process approved timeoffs
    if (!name || status !== 'Approved') {
      skippedCount++;
      continue;
    }

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
          let addedCount = 0;

          for (const dateInfo of blacklistDates) {
            // FIX: Include if date is in current month OR in spillover dates
            const inMonthRange = dateInfo.date >= monthStart && dateInfo.date <= monthEnd;
            const inSpillover = spilloverDates.has(dateInfo.dateString);

            if (inMonthRange || inSpillover) {
              if (!blacklistMap.has(dateInfo.dateString)) {
                blacklistMap.set(dateInfo.dateString, new Set());
              }

              // Add vigil or non-vigil marker
              blacklistMap.get(dateInfo.dateString).add(dateInfo.isVigil ? 'vigil' : 'non-vigil');
              addedCount++;
            }
          }

          Logger.log(`  Blacklist: ${name} - added ${addedCount} dates`);
          processedCount++;
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
          let addedCount = 0;

          for (const dateInfo of whitelistDates) {
            // FIX: Include if date is in current month OR in spillover dates
            const inMonthRange = dateInfo.date >= monthStart && dateInfo.date <= monthEnd;
            const inSpillover = spilloverDates.has(dateInfo.dateString);

            if (inMonthRange || inSpillover) {
              if (!whitelistMap.has(dateInfo.dateString)) {
                whitelistMap.set(dateInfo.dateString, new Set());
              }

              // Add vigil or non-vigil marker
              whitelistMap.get(dateInfo.dateString).add(dateInfo.isVigil ? 'vigil' : 'non-vigil');
              addedCount++;
            }
          }

          Logger.log(`  Whitelist: ${name} - added ${addedCount} dates`);
          processedCount++;
        }
        break;

      default:
        // Unknown type - log warning
        if (type && type !== '') {
          Logger.log(`  WARNING: Unknown timeoff type "${type}" for ${name}`);
        }
        skippedCount++;
        break;
    }
  }

  Logger.log(`Built timeoff maps: ${result.blacklist.size} blacklists, ${result.whitelist.size} whitelists`);
  Logger.log(`  Processed: ${processedCount}, Skipped: ${skippedCount}`);

  return result;
}

/**
 * FIXED VERSION: Updated to use the fixed timeoff map builder
 *
 * CHANGE: Pass monthString to buildTimeoffMapOptimized for spillover date handling
 */
function executeAssignmentLogic_FIXED(monthString, month, scheduleYear) {
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

  // FIX: Pass monthString to enable spillover date detection
  const timeoffMaps = buildTimeoffMapOptimized_FIXED(timeoffData, month, scheduleYear, monthString);

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
 * USAGE INSTRUCTIONS:
 *
 * To apply these fixes to your production code:
 *
 * 1. Open 3_assignmentlogic.gs
 * 2. Find the function buildTimeoffMapOptimized() (around line 195)
 * 3. Replace it with buildTimeoffMapOptimized_FIXED() from this file
 * 4. Rename the function back to buildTimeoffMapOptimized() (remove _FIXED suffix)
 * 5. Find the function executeAssignmentLogic() (around line 42)
 * 6. Replace the line:
 *      const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, scheduleYear);
 *    with:
 *      const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, scheduleYear, monthString);
 * 7. Save and test
 *
 * Before applying fixes, run DEBUG_analyzeTimeoffEnforcement() to confirm the bugs.
 */
