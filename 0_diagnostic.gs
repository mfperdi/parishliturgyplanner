/**
 * DIAGNOSTIC TOOL FOR ASSIGNMENT TROUBLESHOOTING
 * Run this from the Script Editor to diagnose assignment issues
 */

function DIAGNOSTIC_checkAssignmentReadiness(monthString) {
  Logger.log("=".repeat(60));
  Logger.log(`ASSIGNMENT READINESS DIAGNOSTIC FOR ${monthString}`);
  Logger.log("=".repeat(60));

  const diagnostics = {
    errors: [],
    warnings: [],
    info: []
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Check Volunteers Sheet
    Logger.log("\n1. CHECKING VOLUNTEERS...");
    const volunteersSheet = ss.getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);
    if (!volunteersSheet) {
      diagnostics.errors.push("Volunteers sheet not found");
      return formatDiagnostics(diagnostics);
    }

    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const volCols = CONSTANTS.COLS.VOLUNTEERS;

    let activeCount = 0;
    let inactiveCount = 0;
    let noMinistryCount = 0;
    const ministryCounts = new Map();
    const roleCounts = new Map(); // NEW: Track volunteers by specific roles

    // NEW: Build skill-to-ministry map from MassTemplates
    const skillToMinistryMap = buildSkillToMinistryMap();

    for (const row of volunteerData) {
      const id = HELPER_safeArrayAccess(row, volCols.VOLUNTEER_ID - 1);
      if (!id) continue;

      const status = String(HELPER_safeArrayAccess(row, volCols.STATUS - 1, '')).toLowerCase();
      const name = HELPER_safeArrayAccess(row, volCols.FULL_NAME - 1);
      const ministriesRaw = HELPER_safeArrayAccess(row, volCols.MINISTRIES - 1, '');
      const rolePrefsRaw = HELPER_safeArrayAccess(row, volCols.ROLES - 1, ''); // NEW: Read role preferences

      if (status === 'active') {
        activeCount++;

        if (!ministriesRaw || ministriesRaw.trim() === '') {
          noMinistryCount++;
          diagnostics.warnings.push(`Active volunteer "${name}" has no ministry roles`);
        } else {
          // Parse ministries
          const ministries = String(ministriesRaw)
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 0);

          ministries.forEach(ministry => {
            ministryCounts.set(ministry, (ministryCounts.get(ministry) || 0) + 1);
          });

          // NEW: Parse role preferences
          const rolePrefs = String(rolePrefsRaw)
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 0);

          if (rolePrefs.length > 0) {
            // Volunteer has specific role preferences - count for those roles
            rolePrefs.forEach(role => {
              roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
            });
          } else {
            // Volunteer has NO role preferences - can do ANY role in their ministries
            // Add them to all roles that map to their ministries
            for (const [skill, ministry] of skillToMinistryMap) {
              if (ministries.includes(ministry)) {
                roleCounts.set(skill, (roleCounts.get(skill) || 0) + 1);
              }
            }
          }
        }
      } else {
        inactiveCount++;
      }
    }

    diagnostics.info.push(`Total active volunteers: ${activeCount}`);
    diagnostics.info.push(`Total inactive/other volunteers: ${inactiveCount}`);

    if (activeCount === 0) {
      diagnostics.errors.push("NO ACTIVE VOLUNTEERS FOUND - check Volunteers sheet Status column");
    }

    if (noMinistryCount > 0) {
      diagnostics.warnings.push(`${noMinistryCount} active volunteers have no ministry roles`);
    }

    Logger.log(`  ✓ Active volunteers: ${activeCount}`);
    Logger.log(`  ✓ With ministry roles: ${activeCount - noMinistryCount}`);
    Logger.log(`  Ministry distribution:`);
    for (const [ministry, count] of ministryCounts) {
      Logger.log(`    - ${ministry}: ${count} volunteers`);
    }
    Logger.log(`  Role coverage (with strict matching):`);
    for (const [role, count] of roleCounts) {
      Logger.log(`    - ${role}: ${count} volunteers`);
    }

    // 2. Check Assignments Sheet
    Logger.log("\n2. CHECKING ASSIGNMENTS...");
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (!assignmentsSheet) {
      diagnostics.errors.push("Assignments sheet not found - run Step 2 (Generate Schedule) first");
      return formatDiagnostics(diagnostics);
    }

    const assignData = assignmentsSheet.getDataRange().getValues();
    assignData.shift(); // Remove header

    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    let targetMonthCount = 0;
    let unassignedCount = 0;
    const rolesNeeded = new Map();

    for (const row of assignData) {
      if (!row[0]) continue; // Skip empty rows

      const rowMonthYear = HELPER_safeArrayAccess(row, assignCols.MONTH_YEAR - 1);

      if (rowMonthYear === monthString) {
        targetMonthCount++;

        const assignedVolunteerId = HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_ID - 1);
        const assignedVolunteerName = HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_NAME - 1);

        if (!assignedVolunteerId && !assignedVolunteerName) {
          unassignedCount++;
          const roleNeeded = HELPER_safeArrayAccess(row, assignCols.MINISTRY_ROLE - 1);
          const roleLower = String(roleNeeded).toLowerCase();
          rolesNeeded.set(roleLower, (rolesNeeded.get(roleLower) || 0) + 1);
        }
      }
    }

    diagnostics.info.push(`Total assignments for ${monthString}: ${targetMonthCount}`);
    diagnostics.info.push(`Unassigned roles: ${unassignedCount}`);

    if (targetMonthCount === 0) {
      diagnostics.errors.push(`NO assignments found for ${monthString} - run Step 2 (Generate Schedule) first`);
      return formatDiagnostics(diagnostics);
    }

    if (unassignedCount === 0) {
      diagnostics.info.push("All roles are already assigned - nothing to do!");
      return formatDiagnostics(diagnostics);
    }

    Logger.log(`  ✓ Total assignments for month: ${targetMonthCount}`);
    Logger.log(`  ✓ Unassigned roles: ${unassignedCount}`);
    Logger.log(`  Roles needed:`);
    for (const [role, count] of rolesNeeded) {
      Logger.log(`    - ${role}: ${count} assignments`);
    }

    // 3. Check Role Coverage (using strict role matching)
    Logger.log("\n3. CHECKING ROLE COVERAGE (STRICT MATCHING)...");
    let coverageIssues = 0;

    for (const [roleNeeded, countNeeded] of rolesNeeded) {
      const volunteersForRole = roleCounts.get(roleNeeded) || 0;

      // Get the ministry category for this role
      const ministryCategory = skillToMinistryMap.get(roleNeeded) || roleNeeded;
      const volunteersWithMinistry = ministryCounts.get(ministryCategory) || 0;

      if (volunteersForRole === 0) {
        if (volunteersWithMinistry > 0) {
          diagnostics.errors.push(`NO volunteers found for role "${roleNeeded}" (needed ${countNeeded} times) - but ${volunteersWithMinistry} volunteers have "${ministryCategory}" ministry. Fix: Add "${roleNeeded}" to their ROLES column (Column K) OR leave ROLES blank for flexible assignment.`);
          Logger.log(`  ✗ ${roleNeeded}: NEED ${countNeeded}, HAVE 0 volunteers`);
          Logger.log(`     BUT: ${volunteersWithMinistry} volunteers have "${ministryCategory}" ministry`);
          Logger.log(`     FIX: In Volunteers sheet, Column K (ROLES):`);
          Logger.log(`          - Add "${roleNeeded}" to specific volunteers, OR`);
          Logger.log(`          - Leave blank to allow any "${ministryCategory}" role`);
        } else {
          diagnostics.errors.push(`NO volunteers found for role "${roleNeeded}" (needed ${countNeeded} times) - and no volunteers have "${ministryCategory}" ministry`);
          Logger.log(`  ✗ ${roleNeeded}: NEED ${countNeeded}, HAVE 0 volunteers and 0 with ministry`);
        }
        coverageIssues++;
      } else if (volunteersForRole < countNeeded) {
        diagnostics.warnings.push(`Limited volunteers for "${roleNeeded}": ${volunteersForRole} volunteers, ${countNeeded} assignments`);
        Logger.log(`  ⚠ ${roleNeeded}: NEED ${countNeeded}, HAVE ${volunteersForRole} volunteers`);
      } else {
        Logger.log(`  ✓ ${roleNeeded}: NEED ${countNeeded}, HAVE ${volunteersForRole} volunteers`);
      }
    }

    // 4. Check Timeoffs
    Logger.log("\n4. CHECKING TIMEOFFS...");
    const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
    if (!timeoffsSheet) {
      diagnostics.info.push("No Timeoffs sheet found - no timeoff restrictions");
    } else {
      const timeoffData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.TIMEOFFS);
      const { year, month } = HELPER_validateMonthString(monthString);
      const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, year);

      const blacklistCount = timeoffMaps.blacklist.size;
      const whitelistCount = timeoffMaps.whitelist.size;

      diagnostics.info.push(`Approved blacklist timeoffs (Not Available): ${blacklistCount}`);
      diagnostics.info.push(`Approved whitelist timeoffs (Only Available): ${whitelistCount}`);

      Logger.log(`  ✓ Blacklist entries: ${blacklistCount}`);
      Logger.log(`  ✓ Whitelist entries: ${whitelistCount}`);

      if (blacklistCount > 0) {
        Logger.log(`  Volunteers with blacklist timeoffs:`);
        for (const [name, dates] of timeoffMaps.blacklist) {
          Logger.log(`    - ${name}: ${dates.size} blocked dates`);
        }
      }

      if (whitelistCount > 0) {
        Logger.log(`  Volunteers with whitelist restrictions:`);
        for (const [name, whitelist] of timeoffMaps.whitelist) {
          Logger.log(`    - ${name}: only available for ${whitelist.eventIds.join(', ')} or ${whitelist.dates.size} specific dates`);
        }
      }
    }

  } catch (e) {
    diagnostics.errors.push(`Diagnostic error: ${e.message}`);
    Logger.log(`ERROR: ${e.message}`);
    Logger.log(e.stack);
  }

  return formatDiagnostics(diagnostics);
}

function formatDiagnostics(diagnostics) {
  let output = "\n" + "=".repeat(60) + "\n";
  output += "DIAGNOSTIC SUMMARY\n";
  output += "=".repeat(60) + "\n\n";

  if (diagnostics.errors.length > 0) {
    output += "❌ ERRORS (must fix):\n";
    diagnostics.errors.forEach(err => output += `  • ${err}\n`);
    output += "\n";
  }

  if (diagnostics.warnings.length > 0) {
    output += "⚠️  WARNINGS (review):\n";
    diagnostics.warnings.forEach(warn => output += `  • ${warn}\n`);
    output += "\n";
  }

  if (diagnostics.info.length > 0) {
    output += "ℹ️  INFO:\n";
    diagnostics.info.forEach(info => output += `  • ${info}\n`);
    output += "\n";
  }

  if (diagnostics.errors.length === 0 && diagnostics.warnings.length === 0) {
    output += "✅ All checks passed! Auto-assignment should work.\n\n";
  }

  Logger.log(output);
  return output;
}

/**
 * Quick menu function to run diagnostics for current month
 */
function runAssignmentDiagnostic() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Assignment Diagnostic', 'Enter month to check (YYYY-MM format, e.g., 2026-01):', ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() === ui.Button.OK) {
    const monthString = response.getResponseText().trim();

    try {
      const result = DIAGNOSTIC_checkAssignmentReadiness(monthString);
      ui.alert('Diagnostic Results', result, ui.ButtonSet.OK);
    } catch (e) {
      ui.alert('Error', `Diagnostic failed: ${e.message}`, ui.ButtonSet.OK);
    }
  }
}
