/**
 * DEBUGGING TOOL: Analyze why timeoffs aren't being enforced
 *
 * This function helps diagnose the timeoff logic by comparing
 * actual assignments against approved timeoffs and logging
 * detailed information about why volunteers were/weren't excluded.
 *
 * Run this function and check the execution logs to see what's happening.
 */
function DEBUG_analyzeTimeoffEnforcement() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Test with January 2026
  const monthString = "2026-01";
  const { year, month } = HELPER_validateMonthString(monthString);

  Logger.log(`\n=== DEBUGGING TIMEOFF ENFORCEMENT FOR ${monthString} ===\n`);

  // Step 1: Build timeoff maps (same as production code)
  const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
  const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, year);

  Logger.log(`\n--- STEP 1: Timeoff Maps Built ---`);
  Logger.log(`Blacklists: ${timeoffMaps.blacklist.size} volunteers`);
  Logger.log(`Whitelists: ${timeoffMaps.whitelist.size} volunteers`);

  // Detailed logging of blacklist contents
  Logger.log(`\n--- Blacklist Details ---`);
  for (const [volunteerName, dateMap] of timeoffMaps.blacklist.entries()) {
    Logger.log(`\n  Volunteer: ${volunteerName}`);
    for (const [dateString, types] of dateMap.entries()) {
      Logger.log(`    Date: ${dateString}, Types: ${Array.from(types).join(', ')}`);
    }
  }

  // Detailed logging of whitelist contents
  Logger.log(`\n--- Whitelist Details ---`);
  for (const [volunteerName, dateMap] of timeoffMaps.whitelist.entries()) {
    Logger.log(`\n  Volunteer: ${volunteerName}`);
    for (const [dateString, types] of dateMap.entries()) {
      Logger.log(`    Date: ${dateString}, Types: ${Array.from(types).join(', ')}`);
    }
  }

  // Step 2: Check specific assignments that violated timeoffs
  Logger.log(`\n\n--- STEP 2: Checking Known Violations ---`);

  const violations = [
    { name: "Margie Weiner", date: "1/3/2026", eventId: "SAT-1700", isAnticipated: true },
    { name: "Melissa Guba", date: "1/10/2026", eventId: "SAT-1700", isAnticipated: true },
    { name: "Melissa Guba", date: "1/31/2026", eventId: "SAT-1700", isAnticipated: true },
    { name: "Hanalei Savala", date: "1/25/2026", eventId: "SUN-0800", isAnticipated: false },
    { name: "Mark Perdiguerra", date: "1/31/2026", eventId: "SAT-1700", isAnticipated: true }
  ];

  for (const violation of violations) {
    Logger.log(`\n--- Testing: ${violation.name} on ${violation.date} ---`);

    const testDate = new Date(violation.date);
    const dateString = testDate.toDateString();
    const massType = violation.isAnticipated ? 'vigil' : 'non-vigil';

    Logger.log(`  Date object: ${testDate}`);
    Logger.log(`  Date string: ${dateString}`);
    Logger.log(`  Mass type: ${massType}`);

    // Check blacklist
    if (timeoffMaps.blacklist.has(violation.name)) {
      const blacklistMap = timeoffMaps.blacklist.get(violation.name);
      Logger.log(`  ✓ Volunteer found in blacklist`);

      if (blacklistMap.has(dateString)) {
        const types = blacklistMap.get(dateString);
        Logger.log(`  ✓ Date found in blacklist with types: ${Array.from(types).join(', ')}`);

        if (types.has(massType)) {
          Logger.log(`  ✓✓✓ SHOULD BE BLOCKED (mass type matches)`);
        } else {
          Logger.log(`  ⚠️ Mass type doesn't match (${massType} not in ${Array.from(types).join(', ')})`);
        }
      } else {
        Logger.log(`  ✗ Date NOT found in blacklist`);
        Logger.log(`  Available dates in blacklist: ${Array.from(blacklistMap.keys()).join(', ')}`);
      }
    } else {
      Logger.log(`  ✗ Volunteer NOT found in blacklist`);
    }

    // Check whitelist
    if (timeoffMaps.whitelist.has(violation.name)) {
      const whitelistMap = timeoffMaps.whitelist.get(violation.name);
      Logger.log(`  ✓ Volunteer found in whitelist`);

      if (whitelistMap.has(dateString)) {
        const types = whitelistMap.get(dateString);
        Logger.log(`  ✓ Date found in whitelist with types: ${Array.from(types).join(', ')}`);

        if (types.has(massType)) {
          Logger.log(`  ✓✓✓ ALLOWED (mass type matches whitelist)`);
        } else {
          Logger.log(`  ⚠️ Mass type doesn't match (${massType} not in ${Array.from(types).join(', ')})`);
        }
      } else {
        Logger.log(`  ✗✗✗ SHOULD BE BLOCKED (date not in whitelist)`);
        Logger.log(`  Available dates in whitelist: ${Array.from(whitelistMap.keys()).join(', ')}`);
      }
    } else {
      Logger.log(`  No whitelist for this volunteer`);
    }
  }

  Logger.log(`\n\n=== DEBUGGING COMPLETE ===`);
  Logger.log(`Check the execution logs above for detailed analysis.`);
  Logger.log(`Look for discrepancies between expected behavior and actual blacklist/whitelist contents.`);

  return "Debugging complete - check execution logs";
}

/**
 * Test the date parsing logic in isolation
 */
function DEBUG_testDateParsing() {
  Logger.log(`\n=== TESTING DATE PARSING ===\n`);

  const testCases = [
    "1/3/2026 (Vigil), 1/4/2026",
    "1/10/2026 (Vigil), 1/11/2026, 1/31/2026 (Vigil), 2/1/2026",
    "1/17/2026 (Vigil), 1/18/2026, 1/24/2026 (Vigil), 1/25/2026",
    "1/10/2026 (Vigil), 1/11/2026, 1/24/2026 (Vigil), 1/25/2026"
  ];

  for (const testCase of testCases) {
    Logger.log(`\nInput: "${testCase}"`);
    const parsed = HELPER_parseDateBasedNotes(testCase);
    Logger.log(`Parsed ${parsed.length} dates:`);
    for (const dateInfo of parsed) {
      Logger.log(`  - ${dateInfo.dateString} (vigil: ${dateInfo.isVigil})`);
    }
  }

  return "Date parsing test complete - check execution logs";
}

/**
 * Test the month boundary logic
 */
function DEBUG_testMonthBoundaries() {
  Logger.log(`\n=== TESTING MONTH BOUNDARIES ===\n`);

  const year = 2026;
  const month = 0; // January

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  Logger.log(`Month: January 2026`);
  Logger.log(`monthStart: ${monthStart} (${monthStart.getTime()})`);
  Logger.log(`monthEnd: ${monthEnd} (${monthEnd.getTime()})`);

  // Test dates throughout the month
  const testDates = [
    "1/1/2026",
    "1/3/2026",
    "1/10/2026",
    "1/25/2026",
    "1/31/2026",
    "2/1/2026"
  ];

  for (const dateStr of testDates) {
    const parsed = new Date(dateStr);
    const safeDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);

    const inRange = safeDate >= monthStart && safeDate <= monthEnd;

    Logger.log(`\nDate: ${dateStr}`);
    Logger.log(`  Parsed: ${parsed}`);
    Logger.log(`  Safe: ${safeDate} (${safeDate.getTime()})`);
    Logger.log(`  >= monthStart: ${safeDate >= monthStart}`);
    Logger.log(`  <= monthEnd: ${safeDate <= monthEnd}`);
    Logger.log(`  In range: ${inRange} ${inRange ? '✓' : '✗'}`);
  }

  return "Month boundary test complete - check execution logs";
}

/**
 * CRITICAL DEBUG: Trace through actual filterCandidates logic
 * This simulates what happens during auto-assignment
 */
function DEBUG_traceFilterLogic() {
  Logger.log(`\n=== TRACING FILTER CANDIDATES LOGIC ===\n`);

  const monthString = "2026-01";
  const { year, month } = HELPER_validateMonthString(monthString);

  // Build same data structures as auto-assignment
  const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
  const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
  const volunteers = buildVolunteerMapOptimized(volunteerData);
  const timeoffMaps = buildTimeoffMapOptimized(timeoffData, month, year);

  Logger.log(`Volunteers map size: ${volunteers.size}`);
  Logger.log(`Blacklist map size: ${timeoffMaps.blacklist.size}`);

  // Test case: Margie Weiner on 1/3/2026 SAT-1700 (vigil)
  Logger.log(`\n--- SIMULATING FILTER FOR: Margie Weiner, 1/3/2026, SAT-1700 (vigil) ---`);

  // Create roleInfo exactly as it would be in production
  const roleInfo = {
    date: new Date("1/3/2026"),  // This mimics what comes from Assignments sheet
    role: "2nd Reading",
    eventId: "SAT-1700",
    isAnticipated: true
  };

  Logger.log(`roleInfo.date: ${roleInfo.date}`);
  Logger.log(`roleInfo.date.toDateString(): ${roleInfo.date.toDateString()}`);
  Logger.log(`roleInfo.isAnticipated: ${roleInfo.isAnticipated}`);

  const massDateString = roleInfo.date.toDateString();
  const massType = roleInfo.isAnticipated ? 'vigil' : 'non-vigil';

  Logger.log(`massDateString: "${massDateString}"`);
  Logger.log(`massType: "${massType}"`);

  // Now trace through each step of filterCandidates for Margie Weiner
  const margie = Array.from(volunteers.values()).find(v => v.name === "Margie Weiner");

  if (!margie) {
    Logger.log(`ERROR: Margie Weiner not found in volunteers map!`);
    return "ERROR - volunteer not found";
  }

  Logger.log(`\nFound volunteer: ${margie.name}`);
  Logger.log(`  Status: ${margie.status}`);
  Logger.log(`  Ministries: ${margie.ministries.join(', ')}`);
  Logger.log(`  Role prefs: ${margie.rolePrefs.join(', ')}`);

  // Check blacklist (line 506-519 in filterCandidates)
  Logger.log(`\n--- BLACKLIST CHECK ---`);
  Logger.log(`Step 1: timeoffMaps.blacklist.has("${margie.name}"): ${timeoffMaps.blacklist.has(margie.name)}`);

  if (timeoffMaps.blacklist.has(margie.name)) {
    const blacklistMap = timeoffMaps.blacklist.get(margie.name);
    Logger.log(`Step 2: Got blacklistMap with ${blacklistMap.size} dates`);

    Logger.log(`Step 3: blacklistMap.has("${massDateString}"): ${blacklistMap.has(massDateString)}`);

    if (blacklistMap.has(massDateString)) {
      const blacklistTypes = blacklistMap.get(massDateString);
      Logger.log(`Step 4: Got blacklistTypes: ${Array.from(blacklistTypes).join(', ')}`);
      Logger.log(`Step 5: blacklistTypes.has("${massType}"): ${blacklistTypes.has(massType)}`);

      if (blacklistTypes.has(massType)) {
        Logger.log(`\n✅ RESULT: Should CONTINUE (skip this volunteer)`);
      } else {
        Logger.log(`\n⚠️ RESULT: Mass type doesn't match - volunteer NOT excluded`);
      }
    } else {
      Logger.log(`\n⚠️ RESULT: Date not in blacklist - volunteer NOT excluded`);
      Logger.log(`Available dates in blacklist:`);
      for (const [dateStr, types] of blacklistMap.entries()) {
        Logger.log(`  - "${dateStr}": ${Array.from(types).join(', ')}`);
      }
    }
  } else {
    Logger.log(`\n⚠️ RESULT: Volunteer not in blacklist - NOT excluded`);
  }

  // Now check the actual Assignments sheet to see what date format it uses
  Logger.log(`\n--- CHECKING ACTUAL ASSIGNMENTS SHEET DATE FORMAT ---`);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  const assignData = assignSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Find Margie's 1/3 assignment
  for (let i = 1; i < assignData.length; i++) {
    const row = assignData[i];
    const volName = row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1];
    const date = row[assignCols.DATE - 1];

    if (volName === "Margie Weiner" && date) {
      const dateObj = new Date(date);
      if (dateObj.getMonth() === 0 && dateObj.getDate() === 3) {
        Logger.log(`\nFound Margie's 1/3 assignment in sheet:`);
        Logger.log(`  Raw date from sheet: ${date}`);
        Logger.log(`  Type: ${typeof date}`);
        Logger.log(`  Date object: ${dateObj}`);
        Logger.log(`  toDateString(): ${dateObj.toDateString()}`);
        Logger.log(`  IsAnticipated value: ${row[assignCols.IS_ANTICIPATED - 1]}`);
        break;
      }
    }
  }

  return "Filter trace complete - check execution logs";
}
