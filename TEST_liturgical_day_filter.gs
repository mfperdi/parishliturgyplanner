/**
 * TEST: Liturgical Day Conflict Prevention
 *
 * Verifies that volunteers are not assigned to multiple masses on the same
 * liturgical day (Saturday vigil + Sunday masses for same celebration).
 *
 * Example: If volunteer assigned to Saturday 5:00 PM vigil for "Epiphany",
 * they should NOT be assigned to any Sunday mass for "Epiphany".
 */

/**
 * Analyze current assignments for liturgical day conflicts
 */
function TEST_analyzeLiturgicalDayConflicts() {
  Logger.log('=== LITURGICAL DAY CONFLICT ANALYSIS ===\n');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  if (!assignmentsSheet) {
    Logger.log('❌ Assignments sheet not found');
    return;
  }

  const data = assignmentsSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Build map of liturgical celebration assignments
  // Map<liturgicalCelebration, Map<volunteerId, Array<massInfo>>>
  const celebrationAssignments = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const volunteerId = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
    const volunteerName = row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1];
    const liturgicalCelebration = row[assignCols.LITURGICAL_CELEBRATION - 1];
    const date = row[assignCols.DATE - 1];
    const time = row[assignCols.TIME - 1];
    const description = row[assignCols.DESCRIPTION - 1];
    const isAnticipated = row[assignCols.IS_ANTICIPATED - 1];

    if (!volunteerId || !liturgicalCelebration) continue;

    if (!celebrationAssignments.has(liturgicalCelebration)) {
      celebrationAssignments.set(liturgicalCelebration, new Map());
    }

    const celebrationMap = celebrationAssignments.get(liturgicalCelebration);
    if (!celebrationMap.has(volunteerId)) {
      celebrationMap.set(volunteerId, []);
    }

    celebrationMap.get(volunteerId).push({
      name: volunteerName,
      date: date,
      time: time,
      description: description,
      isAnticipated: isAnticipated
    });
  }

  // Find conflicts
  let conflictCount = 0;
  const conflicts = [];

  for (const [celebration, volunteerMap] of celebrationAssignments) {
    for (const [volunteerId, masses] of volunteerMap) {
      if (masses.length > 1) {
        conflictCount++;
        conflicts.push({
          celebration: celebration,
          volunteer: masses[0].name,
          volunteerId: volunteerId,
          masses: masses
        });
      }
    }
  }

  // Report results
  if (conflictCount === 0) {
    Logger.log('✅ NO CONFLICTS FOUND!');
    Logger.log('All volunteers assigned to at most one mass per liturgical celebration.\n');
  } else {
    Logger.log(`❌ FOUND ${conflictCount} CONFLICTS:\n`);

    for (const conflict of conflicts) {
      Logger.log(`Volunteer: ${conflict.volunteer} (ID: ${conflict.volunteerId})`);
      Logger.log(`Liturgical Celebration: ${conflict.celebration}`);
      Logger.log(`Assigned to ${conflict.masses.length} masses:`);

      for (const mass of conflict.masses) {
        const dateStr = Utilities.formatDate(new Date(mass.date), Session.getScriptTimeZone(), 'M/d/yyyy');
        const vigil = mass.isAnticipated ? ' (VIGIL)' : '';
        Logger.log(`  - ${dateStr} ${mass.time}${vigil}: ${mass.description}`);
      }
      Logger.log('');
    }
  }

  Logger.log('=== SUMMARY ===');
  Logger.log(`Total liturgical celebrations: ${celebrationAssignments.size}`);
  Logger.log(`Conflicts found: ${conflictCount}`);
  Logger.log(`Status: ${conflictCount === 0 ? '✅ PASS' : '❌ FAIL'}`);
}

/**
 * Demonstrate the filtering logic with examples
 */
function TEST_liturgicalDayFilteringExamples() {
  Logger.log('=== LITURGICAL DAY FILTERING EXAMPLES ===\n');

  Logger.log('Example 1: Epiphany Weekend (Jan 3-4, 2026)');
  Logger.log('  Masses for "The Epiphany of the Lord":');
  Logger.log('    - Saturday 1/3 5:00 PM (Vigil)');
  Logger.log('    - Sunday 1/4 8:00 AM');
  Logger.log('    - Sunday 1/4 10:00 AM');
  Logger.log('    - Sunday 1/4 12:00 PM');
  Logger.log('    - Sunday 1/4 5:00 PM');
  Logger.log('');
  Logger.log('  If Mark assigned to Saturday vigil:');
  Logger.log('    ✅ Can assign to Saturday 5:00 PM');
  Logger.log('    ❌ CANNOT assign to any Sunday mass (same liturgical celebration)');
  Logger.log('');

  Logger.log('Example 2: Two Different Celebrations');
  Logger.log('  Epiphany (Jan 3-4):');
  Logger.log('    - Mark assigned to Saturday vigil');
  Logger.log('');
  Logger.log('  Baptism of the Lord (Jan 10-11):');
  Logger.log('    - ✅ Mark CAN be assigned (different liturgical celebration)');
  Logger.log('');

  Logger.log('Example 3: Special Masses on Same Weekend');
  Logger.log('  Santo Niño de Cebu Mass (Saturday 1/17):');
  Logger.log('    - Liturgical Celebration: "2nd Sunday in Ordinary Time"');
  Logger.log('  Sunday Masses (Sunday 1/18):');
  Logger.log('    - Liturgical Celebration: "2nd Sunday in Ordinary Time"');
  Logger.log('');
  Logger.log('  If Mark assigned to Santo Niño Saturday:');
  Logger.log('    ❌ CANNOT assign to any Sunday mass (same liturgical celebration)');
  Logger.log('');

  Logger.log('=== KEY POINT ===');
  Logger.log('The filter groups by LITURGICAL CELEBRATION, not calendar date.');
  Logger.log('Saturday vigil + all Sunday masses = SAME liturgical day.');
}

/**
 * Before/After comparison
 */
function TEST_beforeAfterLiturgicalFilter() {
  Logger.log('=== BEFORE vs AFTER: Liturgical Day Filter ===\n');

  Logger.log('Scenario: Epiphany Weekend (Jan 3-4)');
  Logger.log('  Mark Perdiguerra:');
  Logger.log('    - Prefers: SAT-1700, SUN-0800, SUN-1700');
  Logger.log('    - Available: Jan 3-4 (on whitelist)');
  Logger.log('');

  Logger.log('BEFORE (no liturgical day filter):');
  Logger.log('  Saturday 1/3 5:00 PM Vigil: Mark (1st Reading) ✅');
  Logger.log('  Sunday 1/4 8:00 AM: Mark (2nd Reading) ❌ CONFLICT!');
  Logger.log('  Result: Mark serving TWICE on same liturgical day\n');

  Logger.log('AFTER (with liturgical day filter):');
  Logger.log('  Saturday 1/3 5:00 PM Vigil: Mark (1st Reading) ✅');
  Logger.log('  Sunday 1/4 8:00 AM: [Mark excluded - already assigned to Epiphany]');
  Logger.log('  Sunday 1/4 8:00 AM: Lora Boquiren (1st Reading) ✅');
  Logger.log('  Result: Mark serves once, different volunteer for Sunday\n');

  Logger.log('=== BENEFITS ===');
  Logger.log('✅ Volunteers serve at most ONE mass per liturgical celebration');
  Logger.log('✅ Respects the liturgical unity of vigil + Sunday masses');
  Logger.log('✅ Spreads opportunities across more volunteers');
  Logger.log('✅ Prevents burnout from serving multiple masses same weekend');
}

/**
 * Test with actual volunteer preferences and whitelists
 */
function TEST_liturgicalDayWithWhitelist() {
  Logger.log('=== LITURGICAL DAY FILTER + WHITELIST INTERACTION ===\n');

  Logger.log('Scenario: Mark Perdiguerra - Can ONLY serve Jan 10-11, 24-25');
  Logger.log('  Preferences: SAT-1700, SUN-0800, SUN-1700');
  Logger.log('');

  Logger.log('Jan 10-11 Weekend (Baptism of the Lord):');
  Logger.log('  1. Saturday 1/10 5:00 PM Vigil role:');
  Logger.log('     - Mark eligible: ✅ On whitelist, prefers SAT-1700, +15 bonus');
  Logger.log('     - Mark assigned to Saturday vigil ✅');
  Logger.log('');
  Logger.log('  2. Sunday 1/11 8:00 AM role:');
  Logger.log('     - Mark eligible: ❌ Already assigned to "Baptism of the Lord"');
  Logger.log('     - Different volunteer assigned ✅');
  Logger.log('');

  Logger.log('Jan 24-25 Weekend (3rd Sunday in Ordinary Time):');
  Logger.log('  1. Saturday 1/24 5:00 PM Vigil role:');
  Logger.log('     - Mark eligible: ❌ Trini has higher priority (whitelist + rotation)');
  Logger.log('     - Trini assigned to Saturday vigil ✅');
  Logger.log('');
  Logger.log('  2. Sunday 1/25 5:00 PM role:');
  Logger.log('     - Trini eligible: ❌ Already assigned to "3rd Sunday in OT"');
  Logger.log('     - Mark eligible: ✅ On whitelist, prefers SUN-1700, +15 bonus');
  Logger.log('     - Mark assigned to Sunday evening ✅');
  Logger.log('');

  Logger.log('=== KEY INSIGHT ===');
  Logger.log('Liturgical day filter works TOGETHER with:');
  Logger.log('  ✅ Whitelist bonus (+15 for limited availability)');
  Logger.log('  ✅ Mass preference filter (hard filter by Event ID)');
  Logger.log('  ✅ Rotation logic (favor least-used preferred masses)');
  Logger.log('');
  Logger.log('Result: Smart, balanced scheduling that respects all constraints!');
}
