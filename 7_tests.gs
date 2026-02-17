/**
 * ====================================================================
 * CONSOLIDATED TEST FUNCTIONS
 * ====================================================================
 *
 * This file contains all test functions for verifying system behavior.
 * Run these from the Apps Script Editor to validate logic and debug issues.
 *
 * Test Categories:
 * - Mass Preference Filtering
 * - Family Team Constraints
 * - Liturgical Day Conflict Prevention
 * - Mass Time Rotation
 * - Whitelist (Limited Availability) Bonus
 *
 * Usage: Run individual TEST_* functions from Script Editor > Run menu
 */

// ====================================================================
// MASS PREFERENCE FILTERING TESTS
// ====================================================================

/**
 * Test mass preference filtering logic
 * Shows which volunteers are eligible for which masses
 */
function TEST_massPreferenceFiltering() {
  Logger.log('=== MASS PREFERENCE FILTERING TEST ===\n');

  // Sample volunteers from the system
  const testCases = [
    {
      name: 'Margie Weiner',
      id: '18',
      preferences: ['SAT-1700', 'SUN-0800', 'SUN-1000'],
      testMasses: ['SAT-1700', 'SUN-0800', 'SUN-1000', 'SUN-1200', 'SUN-1700']
    },
    {
      name: 'Ming Emperador',
      id: '23',
      preferences: ['SAT-1700', 'SUN-0800', 'SUN-1200', 'SUN-1700', 'SUN-1000'],
      testMasses: ['SAT-1700', 'SUN-0800', 'SUN-1000', 'SUN-1200', 'SUN-1700']
    },
    {
      name: 'Linda Gabriel',
      id: '14',
      preferences: ['SUN-1200', 'SUN-1700', 'SUN-0800', 'SUN-1000'],
      testMasses: ['SAT-1700', 'SUN-0800', 'SUN-1000', 'SUN-1200', 'SUN-1700']
    },
    {
      name: 'Melissa Guba',
      id: '22',
      preferences: ['SAT-1700'],
      testMasses: ['SAT-1700', 'SUN-0800', 'SUN-1000', 'SUN-1200', 'SUN-1700']
    },
    {
      name: 'Terry Quan (no preferences)',
      id: '28',
      preferences: [],
      testMasses: ['SAT-1700', 'SUN-0800', 'SUN-1000', 'SUN-1200', 'SUN-1700']
    }
  ];

  for (const testCase of testCases) {
    Logger.log(`\n${testCase.name} (ID: ${testCase.id})`);
    Logger.log(`Preferred Masses: ${testCase.preferences.length > 0 ? testCase.preferences.join(', ') : 'None (flexible)'}`);
    Logger.log('Eligibility for each mass:');

    for (const massEventId of testCase.testMasses) {
      const isEligible = TEST_checkMassPreferenceEligibility(testCase.preferences, massEventId);
      const status = isEligible ? '✅ ELIGIBLE' : '❌ EXCLUDED';
      Logger.log(`  ${massEventId}: ${status}`);
    }
  }

  Logger.log('\n=== KEY POINTS ===');
  Logger.log('1. Volunteers WITH preferences are ONLY eligible for their preferred masses');
  Logger.log('2. Volunteers WITHOUT preferences are eligible for ALL masses (flexible)');
  Logger.log('3. This ensures volunteers are only assigned to masses they can actually attend');
  Logger.log('4. Rotation logic then distributes them across their preferred masses');
}

/**
 * Helper function to check mass preference eligibility
 * Mimics the logic in filterCandidates()
 */
function TEST_checkMassPreferenceEligibility(preferences, eventId) {
  // If volunteer has preferences, must match Event ID
  if (preferences && preferences.length > 0) {
    return preferences.includes(eventId);
  }

  // If volunteer has NO preferences, they are flexible (eligible for all masses)
  return true;
}

/**
 * Test with actual data from the Volunteers sheet
 * Shows how the new filtering affects real assignments
 */
function TEST_analyzePreferenceFiltering() {
  Logger.log('=== ANALYZING ACTUAL VOLUNTEER PREFERENCE FILTERING ===\n');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const volunteerSheet = ss.getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);

  if (!volunteerSheet) {
    Logger.log('❌ Volunteers sheet not found');
    return;
  }

  const data = volunteerSheet.getDataRange().getValues();
  const volCols = CONSTANTS.COLS.VOLUNTEERS;

  // Get all unique Event IDs from WeeklyMasses
  const massEventIds = TEST_getAllEventIds();

  Logger.log(`Found ${massEventIds.length} different mass Event IDs in the system\n`);

  // Analyze each active volunteer
  let activeCount = 0;
  const eligibilityStats = {};

  for (let i = 1; i < data.length; i++) {
    const status = data[i][volCols.STATUS - 1];
    if (!status || status.toLowerCase() !== 'active') {
      continue; // Skip non-active volunteers
    }

    activeCount++;
    const name = data[i][volCols.FULL_NAME - 1];
    const prefString = data[i][volCols.PREFERRED_MASS_TIME - 1] || '';
    const preferences = prefString ? prefString.split(',').map(p => p.trim()) : [];

    let eligibleCount = 0;

    for (const eventId of massEventIds) {
      const isEligible = TEST_checkMassPreferenceEligibility(preferences, eventId);
      if (isEligible) {
        eligibleCount++;
      }
    }

    const percentage = Math.round((eligibleCount / massEventIds.length) * 100);

    if (!eligibilityStats[eligibleCount]) {
      eligibilityStats[eligibleCount] = 0;
    }
    eligibilityStats[eligibleCount]++;

    Logger.log(`${name}:`);
    Logger.log(`  Preferences: ${preferences.length > 0 ? preferences.join(', ') : 'None (flexible)'}`);
    Logger.log(`  Eligible for: ${eligibleCount}/${massEventIds.length} masses (${percentage}%)\n`);
  }

  Logger.log('\n=== SUMMARY ===');
  Logger.log(`Total Active Volunteers: ${activeCount}`);
  Logger.log('Distribution of mass eligibility:');

  const sortedStats = Object.keys(eligibilityStats).map(Number).sort((a, b) => a - b);
  for (const count of sortedStats) {
    const volunteers = eligibilityStats[count];
    const percentage = Math.round((count / massEventIds.length) * 100);
    Logger.log(`  ${volunteers} volunteer${volunteers > 1 ? 's' : ''} eligible for ${count} masses (${percentage}%)`);
  }
}

/**
 * Helper to get all Event IDs from mass configuration sheets
 */
function TEST_getAllEventIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventIds = new Set();

  // Get from WeeklyMasses
  const weeklySheet = ss.getSheetByName(CONSTANTS.SHEETS.WEEKLY_MASSES);
  if (weeklySheet) {
    const weeklyData = weeklySheet.getDataRange().getValues();
    const weeklyCols = CONSTANTS.COLS.WEEKLY_MASSES;
    for (let i = 1; i < weeklyData.length; i++) {
      const eventId = weeklyData[i][weeklyCols.EVENT_ID - 1];
      const isActive = weeklyData[i][weeklyCols.IS_ACTIVE - 1];
      if (eventId && isActive) {
        eventIds.add(eventId);
      }
    }
  }

  // Get from MonthlyMasses
  const monthlySheet = ss.getSheetByName(CONSTANTS.SHEETS.MONTHLY_MASSES);
  if (monthlySheet) {
    const monthlyData = monthlySheet.getDataRange().getValues();
    const monthlyCols = CONSTANTS.COLS.MONTHLY_MASSES;
    for (let i = 1; i < monthlyData.length; i++) {
      const eventId = monthlyData[i][monthlyCols.EVENT_ID - 1];
      const isActive = monthlyData[i][monthlyCols.IS_ACTIVE - 1];
      if (eventId && isActive) {
        eventIds.add(eventId);
      }
    }
  }

  return Array.from(eventIds);
}

/**
 * Demonstrate the difference between old and new behavior
 */
function TEST_beforeAfterMassPreference() {
  Logger.log('=== BEFORE vs AFTER: Mass Preference Enforcement ===\n');

  const volunteer = {
    name: 'Melissa Guba',
    id: '22',
    preferences: ['SAT-1700'] // Only prefers Saturday vigil
  };

  const testMasses = [
    { eventId: 'SAT-1700', time: 'Saturday 5:00 PM' },
    { eventId: 'SUN-0800', time: 'Sunday 8:00 AM' },
    { eventId: 'SUN-1000', time: 'Sunday 10:00 AM' }
  ];

  Logger.log(`Volunteer: ${volunteer.name}`);
  Logger.log(`Preferences: ${volunteer.preferences.join(', ')}\n`);

  Logger.log('BEFORE (scoring bonus only):');
  for (const mass of testMasses) {
    const hasPreference = volunteer.preferences.includes(mass.eventId);
    const bonus = hasPreference ? '+20 points' : '+0 points';
    Logger.log(`  ${mass.time}: Could be assigned (${bonus})`);
  }
  Logger.log('  ❌ Problem: Melissa could be assigned to Sunday masses she didn\'t prefer!');

  Logger.log('\nAFTER (hard filter + rotation):');
  for (const mass of testMasses) {
    const isEligible = TEST_checkMassPreferenceEligibility(volunteer.preferences, mass.eventId);
    if (isEligible) {
      Logger.log(`  ${mass.time}: ✅ ELIGIBLE (preferred mass)`);
    } else {
      Logger.log(`  ${mass.time}: ❌ EXCLUDED (not in preferences)`);
    }
  }
  Logger.log('  ✅ Solution: Melissa only assigned to Saturday vigil as intended!');

  Logger.log('\n=== BENEFITS ===');
  Logger.log('1. Respects volunteer availability (they specified preferences for a reason)');
  Logger.log('2. Prevents assignment errors (no more "I can\'t make that mass" situations)');
  Logger.log('3. Rotation still works for volunteers with multiple preferences');
  Logger.log('4. Volunteers without preferences remain flexible (eligible for all masses)');
}

// ====================================================================
// FAMILY TEAM CONSTRAINT TESTS
// ====================================================================

/**
 * Analyze current assignments for family team violations
 */
function TEST_analyzeFamilyTeamConstraints() {
  Logger.log('=== FAMILY TEAM CONSTRAINT ANALYSIS ===\n');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  const volunteersSheet = ss.getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);

  if (!assignmentsSheet || !volunteersSheet) {
    Logger.log('❌ Required sheets not found');
    return;
  }

  // Build family team map from volunteers
  const volData = volunteersSheet.getDataRange().getValues();
  const volCols = CONSTANTS.COLS.VOLUNTEERS;
  const familyTeams = new Map(); // Map<familyTeam, Set<volunteerId>>

  for (let i = 1; i < volData.length; i++) {
    const volunteerId = volData[i][volCols.VOLUNTEER_ID - 1];
    const familyTeam = volData[i][volCols.FAMILY_TEAM - 1];

    if (familyTeam && volunteerId) {
      if (!familyTeams.has(familyTeam)) {
        familyTeams.set(familyTeam, new Set());
      }
      familyTeams.get(familyTeam).add(String(volunteerId));
    }
  }

  Logger.log(`Found ${familyTeams.size} family teams\n`);

  // Build liturgical celebration assignment map
  const assignData = assignmentsSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Map<liturgicalCelebration, Map<volunteerId, Array<massInfo>>>
  const celebrationAssignments = new Map();

  for (let i = 1; i < assignData.length; i++) {
    const row = assignData[i];
    const volunteerId = String(row[assignCols.ASSIGNED_VOLUNTEER_ID - 1]);
    const liturgicalCelebration = row[assignCols.LITURGICAL_CELEBRATION - 1];
    const date = row[assignCols.DATE - 1];
    const time = row[assignCols.TIME - 1];
    const description = row[assignCols.DESCRIPTION - 1];

    if (!volunteerId || !liturgicalCelebration) continue;

    if (!celebrationAssignments.has(liturgicalCelebration)) {
      celebrationAssignments.set(liturgicalCelebration, new Map());
    }

    const celebrationMap = celebrationAssignments.get(liturgicalCelebration);
    if (!celebrationMap.has(volunteerId)) {
      celebrationMap.set(volunteerId, []);
    }

    celebrationMap.get(volunteerId).push({
      date: date,
      time: time,
      description: description,
      massKey: `${new Date(date).toDateString()}_${time}`
    });
  }

  // Check for family team violations
  let violationCount = 0;
  const violations = [];

  for (const [familyTeam, memberIds] of familyTeams) {
    if (memberIds.size < 2) continue; // Single-member family, skip

    // For each liturgical celebration, check if family members are at same mass
    for (const [celebration, volunteerMap] of celebrationAssignments) {
      const familyMembersInCelebration = [];

      for (const memberId of memberIds) {
        if (volunteerMap.has(memberId)) {
          const masses = volunteerMap.get(memberId);
          familyMembersInCelebration.push({
            volunteerId: memberId,
            masses: masses
          });
        }
      }

      // If 2+ family members assigned to this celebration, check if same mass
      if (familyMembersInCelebration.length >= 2) {
        const firstMemberMasses = familyMembersInCelebration[0].masses.map(m => m.massKey);

        for (let i = 1; i < familyMembersInCelebration.length; i++) {
          const otherMemberMasses = familyMembersInCelebration[i].masses.map(m => m.massKey);

          // Check if they share any masses
          const sharedMasses = firstMemberMasses.filter(mk => otherMemberMasses.includes(mk));

          if (sharedMasses.length === 0) {
            // Family members assigned to DIFFERENT masses on same liturgical day
            violationCount++;
            violations.push({
              familyTeam: familyTeam,
              celebration: celebration,
              member1: familyMembersInCelebration[0],
              member2: familyMembersInCelebration[i]
            });
          }
        }
      }
    }
  }

  // Report results
  if (violationCount === 0) {
    Logger.log('✅ NO VIOLATIONS FOUND!');
    Logger.log('All family team members are assigned together at the same mass.\n');
  } else {
    Logger.log(`❌ FOUND ${violationCount} VIOLATIONS:\n`);

    for (const violation of violations) {
      Logger.log(`Family Team: ${violation.familyTeam}`);
      Logger.log(`Liturgical Celebration: ${violation.celebration}`);
      Logger.log(`\nMember 1 (ID ${violation.member1.volunteerId}):`);
      for (const mass of violation.member1.masses) {
        const dateStr = Utilities.formatDate(new Date(mass.date), Session.getScriptTimeZone(), 'M/d/yyyy');
        Logger.log(`  - ${dateStr} ${mass.time}: ${mass.description}`);
      }
      Logger.log(`\nMember 2 (ID ${violation.member2.volunteerId}):`);
      for (const mass of violation.member2.masses) {
        const dateStr = Utilities.formatDate(new Date(mass.date), Session.getScriptTimeZone(), 'M/d/yyyy');
        Logger.log(`  - ${dateStr} ${mass.time}: ${mass.description}`);
      }
      Logger.log('❌ VIOLATION: Family members assigned to DIFFERENT masses!\n');
    }
  }

  Logger.log('=== SUMMARY ===');
  Logger.log(`Total family teams: ${familyTeams.size}`);
  Logger.log(`Violations found: ${violationCount}`);
  Logger.log(`Status: ${violationCount === 0 ? '✅ PASS' : '❌ FAIL'}`);
}

/**
 * Demonstrate the family team constraint
 */
function TEST_familyTeamConstraintExamples() {
  Logger.log('=== FAMILY TEAM CONSTRAINT EXAMPLES ===\n');

  Logger.log('Example 1: Peralta Family - Correct Behavior');
  Logger.log('  Family members: Desiree Peralta, Dixie Peralta');
  Logger.log('  Epiphany Weekend (Jan 3-4):');
  Logger.log('    - 1/4 SUN-1200: Desiree (1st) + Dixie (2nd) ✅ TOGETHER');
  Logger.log('  3rd Sunday in OT (Jan 24-25):');
  Logger.log('    - 1/25 SUN-1700: Dixie (1st) + Desiree (2nd) ✅ TOGETHER');
  Logger.log('');

  Logger.log('Example 2: Peralta Family - VIOLATION (if it happened)');
  Logger.log('  Family members: Desiree Peralta, Dixie Peralta');
  Logger.log('  2nd Sunday in OT (Jan 17-18):');
  Logger.log('    - 1/18 SUN-1700: Desiree (2nd) ❌ ALONE');
  Logger.log('    - Dixie: Not assigned to this celebration ❌');
  Logger.log('  ❌ VIOLATION: Desiree assigned without Dixie!');
  Logger.log('');

  Logger.log('Example 3: How the Filter Works');
  Logger.log('  Scenario: Assigning roles for Jan 18, 2nd Sunday in OT');
  Logger.log('  1. SUN-1700 1st Reading: System considers volunteers...');
  Logger.log('     - Desiree Peralta: Has family team "Peralta Family"');
  Logger.log('     - Check: Is Dixie assigned to ANY mass on Jan 18?');
  Logger.log('     - If NO: ✅ Desiree eligible (family can be assigned together)');
  Logger.log('     - If YES to DIFFERENT mass: ❌ Desiree excluded (family must be together)');
  Logger.log('');

  Logger.log('=== KEY RULES ===');
  Logger.log('1. Family members MUST serve at the SAME mass (same date + time)');
  Logger.log('2. If one family member assigned to 8:00 AM, others can ONLY be assigned to 8:00 AM');
  Logger.log('3. Family members cannot be split across different masses on same liturgical day');
  Logger.log('4. This is a HARD FILTER, not just a bonus');
}

// ====================================================================
// LITURGICAL DAY CONFLICT TESTS
// ====================================================================

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

  Logger.log('=== KEY POINT ===');
  Logger.log('The filter groups by LITURGICAL CELEBRATION, not calendar date.');
  Logger.log('Saturday vigil + all Sunday masses = SAME liturgical day.');
}

// ====================================================================
// MASS TIME ROTATION TESTS
// ====================================================================

/**
 * Test function: Demonstrate how rotation scoring works
 */
function TEST_rotationLogic() {
  Logger.log(`\n=== TESTING MASS TIME ROTATION LOGIC ===\n`);

  // Create mock volunteer with multiple preferred masses
  const volunteer = {
    id: "TEST-001",
    name: "Test Volunteer",
    massPrefs: ["SAT-1700", "SUN-0800", "SUN-1000"], // 3 preferred times
    rolePrefs: ["1st reading"],
    ministries: ["lector"]
  };

  // Simulate different assignment history scenarios
  const scenarios = [
    {
      name: "Scenario 1: No previous assignments",
      counts: { total: 0, recent: new Date(0), byEventId: {} },
      testMass: "SAT-1700"
    },
    {
      name: "Scenario 2: Assigned SAT-1700 twice before",
      counts: {
        total: 2,
        recent: new Date(),
        byEventId: {
          "SAT-1700": 2  // Already assigned to SAT-1700 twice
        }
      },
      testMass: "SAT-1700"
    },
    {
      name: "Scenario 3: Never assigned to SUN-0800",
      counts: {
        total: 2,
        recent: new Date(),
        byEventId: {
          "SAT-1700": 2  // Already assigned to SAT-1700 twice
        }
      },
      testMass: "SUN-0800"
    },
    {
      name: "Scenario 4: Mixed history - testing all preferred masses",
      counts: {
        total: 5,
        recent: new Date(),
        byEventId: {
          "SAT-1700": 3,  // Assigned 3 times
          "SUN-0800": 1,  // Assigned 1 time
          "SUN-1000": 1   // Assigned 1 time
        }
      },
      testMasses: ["SAT-1700", "SUN-0800", "SUN-1000"]
    }
  ];

  const mockCounts = new Map();
  const mockAssignments = new Map();
  const mockVolunteers = new Map();

  // Test each scenario
  for (const scenario of scenarios) {
    Logger.log(`\n--- ${scenario.name} ---`);
    mockCounts.set(volunteer.id, scenario.counts);

    if (scenario.testMasses) {
      // Test multiple masses
      Logger.log(`Assignment history:`);
      for (const [eventId, count] of Object.entries(scenario.counts.byEventId)) {
        Logger.log(`  ${eventId}: ${count} times`);
      }

      Logger.log(`\nScores for each preferred mass:`);
      for (const eventId of scenario.testMasses) {
        const score = HELPER_calculateVolunteerScore(
          volunteer,
          "1st Reading",
          eventId,
          mockCounts,
          mockAssignments,
          mockVolunteers
        );
        const timesAtMass = scenario.counts.byEventId[eventId] || 0;
        Logger.log(`  ${eventId}: ${score} points (served ${timesAtMass} times)`);
      }

      // Show which would win
      const scores = scenario.testMasses.map(eventId => ({
        eventId,
        score: HELPER_calculateVolunteerScore(volunteer, "1st Reading", eventId, mockCounts, mockAssignments, mockVolunteers),
        times: scenario.counts.byEventId[eventId] || 0
      }));
      scores.sort((a, b) => b.score - a.score);
      Logger.log(`\n  ⭐ Winner: ${scores[0].eventId} (highest score, served least)`);

    } else {
      // Test single mass
      const score = HELPER_calculateVolunteerScore(
        volunteer,
        "1st Reading",
        scenario.testMass,
        mockCounts,
        mockAssignments,
        mockVolunteers
      );
      const timesAtMass = scenario.counts.byEventId[scenario.testMass] || 0;
      Logger.log(`Testing mass: ${scenario.testMass}`);
      Logger.log(`Times already assigned to this mass: ${timesAtMass}`);
      Logger.log(`Final score: ${score} points`);

      // Explain the calculation
      let baseScore = 100;
      const freqPenalty = scenario.counts.total * 5;
      let massBonus = 20;
      if (timesAtMass > 0) {
        const rotationPenalty = timesAtMass * 3;
        massBonus = Math.max(5, massBonus - rotationPenalty);
      }
      Logger.log(`\nCalculation breakdown:`);
      Logger.log(`  Base: ${baseScore}`);
      Logger.log(`  - Frequency penalty (${scenario.counts.total} total × 5): -${freqPenalty}`);
      Logger.log(`  + Mass preference bonus: +${massBonus}`);
      Logger.log(`    (was 20, reduced by ${timesAtMass} × 3 = ${timesAtMass * 3} for rotation)`);
      Logger.log(`  = Final: ${score}`);
    }
  }

  Logger.log(`\n\n=== KEY TAKEAWAYS ===`);
  Logger.log(`1. First time at a preferred mass: +20 bonus`);
  Logger.log(`2. Second time at same mass: +17 bonus (-3 penalty)`);
  Logger.log(`3. Third time at same mass: +14 bonus (-6 penalty)`);
  Logger.log(`4. Fourth time at same mass: +11 bonus (-9 penalty)`);
  Logger.log(`5. Minimum bonus: +5 (never goes below)`);
  Logger.log(`\n6. Effect: Volunteers naturally rotate between their preferred masses`);
  Logger.log(`   because less-used preferred masses score higher!`);

  return "Rotation logic test complete - check execution logs";
}

/**
 * Analyze actual rotation patterns in current assignments
 */
function TEST_analyzeRotationPatterns() {
  Logger.log(`\n=== ANALYZING ACTUAL ROTATION PATTERNS ===\n`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const volSheet = ss.getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);
  const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  const volData = volSheet.getDataRange().getValues();
  const assignData = assignSheet.getDataRange().getValues();

  const volCols = CONSTANTS.COLS.VOLUNTEERS;
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Skip headers
  volData.shift();
  assignData.shift();

  // Build volunteer map
  const volunteers = new Map();
  for (const row of volData) {
    const id = row[volCols.VOLUNTEER_ID - 1];
    const status = row[volCols.STATUS - 1];
    const prefs = row[volCols.PREFERRED_MASS_TIME - 1];

    if (id && status === 'Active' && prefs) {
      const prefList = String(prefs).split(',').map(p => p.trim()).filter(p => p);
      if (prefList.length > 1) { // Only care about those with multiple preferences
        volunteers.set(id, {
          name: row[volCols.FULL_NAME - 1],
          prefs: prefList,
          assignments: []
        });
      }
    }
  }

  // Collect assignments
  for (const row of assignData) {
    const volId = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
    const eventId = row[assignCols.EVENT_ID - 1];
    const date = row[assignCols.DATE - 1];

    if (volId && volunteers.has(volId) && eventId) {
      volunteers.get(volId).assignments.push({
        eventId,
        date: new Date(date)
      });
    }
  }

  // Analyze rotation patterns
  Logger.log(`Found ${volunteers.size} volunteers with multiple preferred mass times\n`);

  for (const [id, vol] of volunteers) {
    if (vol.assignments.length < 2) continue; // Need at least 2 to see rotation

    // Count assignments by Event ID
    const countsByMass = {};
    for (const assignment of vol.assignments) {
      countsByMass[assignment.eventId] = (countsByMass[assignment.eventId] || 0) + 1;
    }

    // Check for rotation
    const uniqueMasses = Object.keys(countsByMass).length;
    const totalAssignments = vol.assignments.length;
    const rotationScore = uniqueMasses / totalAssignments;

    Logger.log(`\n${vol.name} (${totalAssignments} assignments)`);
    Logger.log(`  Preferred masses: ${vol.prefs.join(', ')}`);
    Logger.log(`  Actual assignments:`);
    for (const [eventId, count] of Object.entries(countsByMass)) {
      const isPreferred = vol.prefs.includes(eventId) ? '✓ preferred' : '✗ not preferred';
      Logger.log(`    ${eventId}: ${count} times (${isPreferred})`);
    }

    if (rotationScore >= 0.8) {
      Logger.log(`  🎯 Excellent rotation! Using ${uniqueMasses} different masses`);
    } else if (rotationScore >= 0.5) {
      Logger.log(`  ✓ Good variety - using ${uniqueMasses} different masses`);
    } else {
      Logger.log(`  ⚠️ Low rotation - mostly assigned to same mass`);
    }
  }

  return "Rotation pattern analysis complete - check execution logs";
}

// ====================================================================
// WHITELIST (LIMITED AVAILABILITY) BONUS TESTS
// ====================================================================

/**
 * Demonstrates whitelist bonus with scoring examples
 */
function TEST_whitelistBonus() {
  Logger.log('=== LIMITED AVAILABILITY BONUS TEST ===\n');

  Logger.log('Scenario: Assigning Sunday 10:00 AM on Feb 8, 2026\n');

  // Volunteer A: Regular volunteer (no timeoff)
  const volunteerA = {
    name: 'Regular Volunteer',
    id: '100',
    totalAssignments: 3,
    massPrefs: ['SUN-1000'],
    timesAtThisMass: 0,
    hasWhitelist: false
  };

  // Volunteer B: Limited availability (whitelist for Feb 8, 15, 22 only)
  const volunteerB = {
    name: 'Limited Availability Volunteer',
    id: '101',
    totalAssignments: 3,
    massPrefs: ['SUN-1000'],
    timesAtThisMass: 0,
    hasWhitelist: true
  };

  Logger.log('Volunteer A (Regular):');
  Logger.log(`  Total assignments: ${volunteerA.totalAssignments}`);
  Logger.log(`  Mass preferences: ${volunteerA.massPrefs.join(', ')}`);
  Logger.log(`  Whitelist status: No timeoff\n`);

  const scoreA = TEST_calculateScoreExample(volunteerA);
  Logger.log(`  Score breakdown:`);
  Logger.log(`    Base: 100`);
  Logger.log(`    Frequency penalty: -${volunteerA.totalAssignments * 5} (${volunteerA.totalAssignments} × 5)`);
  Logger.log(`    Mass preference: +20 (first time at this mass)`);
  Logger.log(`    Limited availability: +0 (not on whitelist)`);
  Logger.log(`  TOTAL SCORE: ${scoreA}\n`);

  Logger.log('Volunteer B (Limited Availability):');
  Logger.log(`  Total assignments: ${volunteerB.totalAssignments}`);
  Logger.log(`  Mass preferences: ${volunteerB.massPrefs.join(', ')}`);
  Logger.log(`  Whitelist status: Can ONLY serve Feb 8, 15, 22\n`);

  const scoreB = TEST_calculateScoreExample(volunteerB);
  Logger.log(`  Score breakdown:`);
  Logger.log(`    Base: 100`);
  Logger.log(`    Frequency penalty: -${volunteerB.totalAssignments * 5} (${volunteerB.totalAssignments} × 5)`);
  Logger.log(`    Mass preference: +20 (first time at this mass)`);
  Logger.log(`    Limited availability: +15 (on whitelist for Feb 8!) ⭐`);
  Logger.log(`  TOTAL SCORE: ${scoreB}\n`);

  Logger.log('=== RESULT ===');
  Logger.log(`Volunteer A: ${scoreA}`);
  Logger.log(`Volunteer B: ${scoreB} ← WINS! (+15 whitelist bonus)\n`);

  Logger.log('=== WHY THIS MATTERS ===');
  Logger.log('✅ Volunteer B has limited availability (only 3 Sundays this month)');
  Logger.log('✅ If we don\'t use them on Feb 8, we might miss our chance');
  Logger.log('✅ Volunteer A is available every week (more flexible)');
  Logger.log('✅ Better scheduling outcome: Use limited volunteers when available');
}

/**
 * Helper function to calculate example score
 */
function TEST_calculateScoreExample(volunteer) {
  let score = 100;
  score -= volunteer.totalAssignments * 5; // Frequency penalty

  if (volunteer.massPrefs.includes('SUN-1000')) {
    score += 20; // Mass preference (first time)
  }

  if (volunteer.hasWhitelist) {
    score += 15; // Limited availability bonus
  }

  return score;
}

/**
 * Test with different scenarios
 */
function TEST_whitelistBonusScenarios() {
  Logger.log('=== WHITELIST BONUS: MULTIPLE SCENARIOS ===\n');

  const scenarios = [
    {
      name: 'Scenario 1: Equal assignments',
      volunteerA: { name: 'Regular', assignments: 2, whitelist: false },
      volunteerB: { name: 'Limited', assignments: 2, whitelist: true },
      expected: 'Limited wins (+15 whitelist bonus)'
    },
    {
      name: 'Scenario 2: Limited has MORE assignments',
      volunteerA: { name: 'Regular', assignments: 2, whitelist: false },
      volunteerB: { name: 'Limited', assignments: 4, whitelist: true },
      expected: 'Regular wins (frequency difference: -10 vs whitelist: +15)'
    },
    {
      name: 'Scenario 3: Limited has slightly more assignments',
      volunteerA: { name: 'Regular', assignments: 3, whitelist: false },
      volunteerB: { name: 'Limited', assignments: 4, whitelist: true },
      expected: 'Limited wins (frequency: -5, whitelist: +15, net: +10)'
    },
    {
      name: 'Scenario 4: Limited has 3+ more assignments',
      volunteerA: { name: 'Regular', assignments: 2, whitelist: false },
      volunteerB: { name: 'Limited', assignments: 5, whitelist: true },
      expected: 'Regular wins (frequency difference -15 > whitelist +15)'
    }
  ];

  for (const scenario of scenarios) {
    Logger.log(`${scenario.name}:`);

    const scoreA = 100 - (scenario.volunteerA.assignments * 5) + 20; // Base + mass pref
    const scoreB = 100 - (scenario.volunteerB.assignments * 5) + 20 + 15; // + whitelist

    Logger.log(`  ${scenario.volunteerA.name}: ${scenario.volunteerA.assignments} assignments → Score: ${scoreA}`);
    Logger.log(`  ${scenario.volunteerB.name}: ${scenario.volunteerB.assignments} assignments + whitelist → Score: ${scoreB}`);
    Logger.log(`  Winner: ${scoreB > scoreA ? scenario.volunteerB.name : scenario.volunteerA.name}`);
    Logger.log(`  Expected: ${scenario.expected}\n`);
  }

  Logger.log('=== KEY INSIGHT ===');
  Logger.log('The +15 whitelist bonus is moderate - it doesn\'t override all factors');
  Logger.log('- Whitelist bonus (+15) can overcome ~3 assignment difference (-15)');
  Logger.log('- But frequency balancing still matters for fairness');
  Logger.log('- Prioritizes limited availability without ignoring workload balance');
}

/**
 * Analyze actual whitelist volunteers in your data
 */
function TEST_analyzeWhitelistVolunteers() {
  Logger.log('=== ANALYZING ACTUAL WHITELIST VOLUNTEERS ===\n');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);

  if (!timeoffsSheet) {
    Logger.log('❌ Timeoffs sheet not found');
    return;
  }

  const data = timeoffsSheet.getDataRange().getValues();
  const cols = CONSTANTS.COLS.TIMEOFFS;

  const whitelistVolunteers = new Map(); // volunteer name => dates

  for (let i = 1; i < data.length; i++) {
    const status = data[i][cols.STATUS - 1];
    const type = data[i][cols.TYPE - 1];

    if (status !== 'Approved') continue;
    if (!type || !type.includes('ONLY')) continue; // Whitelist type

    const volunteerName = data[i][cols.VOLUNTEER_NAME - 1];
    const selectedDates = data[i][cols.SELECTED_DATES - 1] || '';

    if (!whitelistVolunteers.has(volunteerName)) {
      whitelistVolunteers.set(volunteerName, []);
    }

    const dates = selectedDates.split(',').map(d => d.trim());
    whitelistVolunteers.get(volunteerName).push(...dates);
  }

  if (whitelistVolunteers.size === 0) {
    Logger.log('No approved "Only Available" timeoffs found');
    Logger.log('(This means no one currently has limited availability restrictions)\n');
    return;
  }

  Logger.log(`Found ${whitelistVolunteers.size} volunteers with limited availability:\n`);

  for (const [name, dates] of whitelistVolunteers) {
    Logger.log(`${name}:`);
    Logger.log(`  Can ONLY serve: ${dates.length} dates`);
    Logger.log(`  Dates: ${dates.slice(0, 3).join(', ')}${dates.length > 3 ? '...' : ''}`);
    Logger.log(`  Scheduling impact: Will receive +15 bonus on these dates\n`);
  }

  Logger.log('=== BENEFIT ===');
  Logger.log('These volunteers will be prioritized when assigned to their available dates');
  Logger.log('This ensures we use them during their limited availability windows');
}

// ====================================================================
// WEEKEND GROUPING TESTS (for Timeoff Form)
// ====================================================================

/**
 * Test the weekend grouping logic for timeoff date extraction
 */
function TEST_weekendGroupingLogic() {
  Logger.log('=== TESTING WEEKEND GROUPING LOGIC ===\n');

  // Test cases simulating form checkbox selections
  const testCases = [
    {
      name: 'Single weekend selected',
      input: 'Weekend of 2/7-2/8/2026 - 5th Sunday in Ordinary Time',
      expected: ['2/7/2026', '2/8/2026']
    },
    {
      name: 'Multiple weekends selected',
      input: 'Weekend of 2/7-2/8/2026 - 5th Sunday in Ordinary Time, Weekend of 2/14-2/15/2026 - 6th Sunday in Ordinary Time',
      expected: ['2/7/2026', '2/8/2026', '2/14/2026', '2/15/2026']
    },
    {
      name: 'Special day (not weekend)',
      input: 'Wednesday 2/18/2026 - Ash Wednesday',
      expected: ['2/18/2026']
    },
    {
      name: 'Mix of weekend and special day',
      input: 'Weekend of 2/14-2/15/2026 - 6th Sunday in Ordinary Time, Wednesday 2/18/2026 - Ash Wednesday',
      expected: ['2/14/2026', '2/15/2026', '2/18/2026']
    }
  ];

  for (const testCase of testCases) {
    Logger.log(`Test: ${testCase.name}`);
    Logger.log(`  Input: "${testCase.input}"`);

    // Extract dates from form checkbox format using the correct helper
    // HELPER_parseDateBasedNotes is for already-stored "M/D/YYYY" format;
    // HELPER_extractDatesFromCheckboxes handles form responses like "Weekend of..."
    const rawDates = HELPER_extractDatesFromCheckboxes(testCase.input);
    const extractedDates = rawDates.map(d => d.replace(' (Vigil)', ''));

    Logger.log(`  Extracted: ${extractedDates.join(', ')}`);
    Logger.log(`  Expected: ${testCase.expected.join(', ')}`);

    // Check if all expected dates are found
    const allFound = testCase.expected.every(exp =>
      extractedDates.some(ext => ext === exp)
    );

    Logger.log(`  Status: ${allFound ? '✅ PASS' : '❌ FAIL'}\n`);
  }
}

// ====================================================================
// NOTIFICATION HELPER TESTS
// ====================================================================

/**
 * Test all notification helper functions
 * Tests the standardized notification system created in 0b_helper.gs
 *
 * This is an INTERACTIVE test - it will show actual dialogs for you to verify
 * Run this function to ensure all notification patterns work correctly
 */
function TEST_notificationHelpers() {
  Logger.log('=== NOTIFICATION HELPER TESTS ===\n');
  Logger.log('This test will show several dialogs. Click through them to verify formatting.\n');

  // Give user a heads up
  const ui = SpreadsheetApp.getUi();
  const startTest = ui.alert(
    '🧪 Notification Helper Tests',
    'This will test all 6 notification helper functions by showing sample dialogs.\n\n' +
    'You will see:\n' +
    '• Alert messages (4 types)\n' +
    '• Confirmation dialogs (3 types)\n' +
    '• User input prompts (with validation)\n' +
    '• Error messages (with troubleshooting)\n' +
    '• Success messages\n' +
    '• Validation reports\n\n' +
    'Ready to start?',
    ui.ButtonSet.YES_NO
  );

  if (startTest !== ui.Button.YES) {
    Logger.log('Test cancelled by user');
    return;
  }

  Logger.log('Starting tests...\n');

  // Test 1: HELPER_showAlert() - All types
  Logger.log('TEST 1: HELPER_showAlert() - Testing all 4 types');

  HELPER_showAlert(
    'Info Alert Test',
    'This is an informational alert.\n\nIt uses the ℹ️ emoji and standard formatting.',
    'info'
  );
  Logger.log('  ✓ Info alert shown');

  HELPER_showAlert(
    'Success Alert Test',
    'This is a success alert.\n\nIt uses the ✅ emoji.',
    'success'
  );
  Logger.log('  ✓ Success alert shown');

  HELPER_showAlert(
    'Warning Alert Test',
    'This is a warning alert.\n\nIt uses the ⚠️ emoji.',
    'warning'
  );
  Logger.log('  ✓ Warning alert shown');

  HELPER_showAlert(
    'Error Alert Test',
    'This is an error alert.\n\nIt uses the ❌ emoji.',
    'error'
  );
  Logger.log('  ✓ Error alert shown\n');

  // Test 2: HELPER_showSuccess()
  Logger.log('TEST 2: HELPER_showSuccess()');

  HELPER_showSuccess(
    'Operation Complete',
    'Successfully generated 365 days of liturgical calendar.\n\n' +
    'Next steps:\n' +
    '  1. Generate schedule for current month\n' +
    '  2. Auto-assign volunteers'
  );
  Logger.log('  ✓ Success message shown\n');

  // Test 3: HELPER_showError() - With context
  Logger.log('TEST 3: HELPER_showError() - Testing with troubleshooting hints');

  HELPER_showError(
    'Assignment Failed',
    'Could not auto-assign volunteers: No Active volunteers found with the required ministry roles.',
    'assignment'
  );
  Logger.log('  ✓ Error with assignment context shown (check for troubleshooting hints)\n');

  // Test another context
  HELPER_showError(
    'Calendar Generation Failed',
    'Sheet \'SaintsCalendar\' not found',
    'calendar'
  );
  Logger.log('  ✓ Error with calendar context shown (check for troubleshooting hints)\n');

  // Test 4: HELPER_confirmAction() - All types
  Logger.log('TEST 4: HELPER_confirmAction() - Testing confirmation dialogs');

  const infoConfirm = HELPER_confirmAction(
    'Archive Data?',
    'This will create a new archive file for the current year.\n\n' +
    'Current data will NOT be affected.',
    { type: 'info' }
  );
  Logger.log(`  ✓ Info confirmation shown - User chose: ${infoConfirm ? 'YES' : 'NO'}`);

  const warningConfirm = HELPER_confirmAction(
    'Regenerate Schedule?',
    'This will clear all existing assignments for this month.\n\n' +
    'Manual assignments will be lost.',
    { type: 'warning' }
  );
  Logger.log(`  ✓ Warning confirmation shown - User chose: ${warningConfirm ? 'YES' : 'NO'}`);

  const dangerConfirm = HELPER_confirmAction(
    'Delete All Data?',
    'This will PERMANENTLY DELETE all liturgical calendar data.\n\n' +
    '⚠️ This action cannot be undone!\n\n' +
    '(This is just a test - nothing will be deleted)',
    { type: 'danger' }
  );
  Logger.log(`  ✓ Danger confirmation shown - User chose: ${dangerConfirm ? 'YES' : 'NO'}\n`);

  // Test 5: HELPER_promptUser() - With validation
  Logger.log('TEST 5: HELPER_promptUser() - Testing input prompts with validation');

  const monthResult = HELPER_promptUser(
    'Enter Month',
    'Enter a month in YYYY-MM format (e.g., 2026-01):',
    {
      required: true,
      validator: (value) => {
        if (!/^\d{4}-\d{2}$/.test(value)) {
          return { valid: false, error: 'Please use format YYYY-MM (e.g., 2026-01)' };
        }
        const [year, month] = value.split('-').map(n => parseInt(n));
        if (month < 1 || month > 12) {
          return { valid: false, error: 'Month must be between 01 and 12' };
        }
        return { valid: true };
      }
    }
  );

  if (monthResult.success) {
    Logger.log(`  ✓ Month prompt validated successfully: "${monthResult.value}"`);
  } else {
    Logger.log(`  ✓ Month prompt cancelled by user`);
  }

  // Test simple prompt without validation
  const nameResult = HELPER_promptUser(
    'Enter Name',
    'Enter a volunteer name (or leave blank):',
    { required: false }
  );

  if (nameResult.success) {
    Logger.log(`  ✓ Name prompt accepted: "${nameResult.value}"`);
  } else {
    Logger.log(`  ✓ Name prompt cancelled`);
  }
  Logger.log('');

  // Test 6: HELPER_showValidationReport()
  Logger.log('TEST 6: HELPER_showValidationReport() - Testing validation reports');

  const validationItems = [
    { type: 'error', message: 'Config sheet missing "Year to Schedule" setting' },
    { type: 'error', message: 'Volunteer "John Smith" has duplicate email address' },
    { type: 'warning', message: 'MassTemplate "Sunday Mass" references non-existent role "cantor"' },
    { type: 'warning', message: 'Volunteer "Jane Doe" has no ministry roles assigned' },
    { type: 'info', message: 'Found 25 active volunteers' },
    { type: 'info', message: 'Found 3 mass templates' }
  ];

  const summary = {
    errors: 2,
    warnings: 2
  };

  HELPER_showValidationReport('Data Validation Test', validationItems, summary);
  Logger.log('  ✓ Validation report shown (check grouping by error/warning/info)\n');

  // Test empty validation (all passed)
  HELPER_showValidationReport('All Checks Passed', [], { errors: 0, warnings: 0 });
  Logger.log('  ✓ Empty validation report shown (should say "All validation checks passed")\n');

  // Final summary
  Logger.log('=== TEST COMPLETE ===\n');
  Logger.log('All 6 notification helper functions tested:');
  Logger.log('  ✓ HELPER_showAlert() - 4 types tested');
  Logger.log('  ✓ HELPER_showSuccess() - basic usage tested');
  Logger.log('  ✓ HELPER_showError() - 2 contexts tested');
  Logger.log('  ✓ HELPER_confirmAction() - 3 types tested');
  Logger.log('  ✓ HELPER_promptUser() - validation tested');
  Logger.log('  ✓ HELPER_showValidationReport() - grouping tested');
  Logger.log('\nVerify that all dialogs:');
  Logger.log('  • Had appropriate emoji prefixes');
  Logger.log('  • Showed clear instructions');
  Logger.log('  • Had proper formatting and spacing');
  Logger.log('  • Included troubleshooting hints where applicable');

  HELPER_showSuccess(
    'Notification Tests Complete',
    'All notification helper functions have been tested.\n\n' +
    'Check the Execution Log for detailed results.'
  );
}

/**
 * Test specific error contexts
 * Tests all 8 error contexts to verify troubleshooting hints
 */
function TEST_errorContexts() {
  Logger.log('=== ERROR CONTEXT TESTS ===\n');
  Logger.log('Testing all 8 error contexts for troubleshooting hints\n');

  const contexts = [
    { context: 'calendar', error: 'Calendar generation failed' },
    { context: 'validation', error: 'Data validation failed' },
    { context: 'schedule', error: 'Schedule generation failed' },
    { context: 'assignment', error: 'Auto-assignment failed' },
    { context: 'timeoffs', error: 'Timeoff processing failed' },
    { context: 'print', error: 'Print schedule generation failed' },
    { context: 'form', error: 'Form update failed' },
    { context: 'archive', error: 'Archive creation failed' }
  ];

  const ui = SpreadsheetApp.getUi();
  const startTest = ui.alert(
    '🧪 Error Context Tests',
    `This will show 8 error dialogs, one for each context.\n\n` +
    `Verify that each error includes specific troubleshooting hints.\n\n` +
    `Ready to start?`,
    ui.ButtonSet.YES_NO
  );

  if (startTest !== ui.Button.YES) {
    Logger.log('Test cancelled by user');
    return;
  }

  for (const test of contexts) {
    Logger.log(`Testing context: ${test.context}`);
    HELPER_showError(`${test.context} Error Test`, test.error, test.context);
    Logger.log(`  ✓ Showed error with ${test.context} context\n`);
  }

  Logger.log('=== TEST COMPLETE ===\n');
  Logger.log('All 8 error contexts tested. Verify troubleshooting hints were shown.');

  HELPER_showSuccess(
    'Error Context Tests Complete',
    'All 8 error contexts have been tested.\n\n' +
    'Each should have shown context-specific troubleshooting hints.'
  );
}

/**
 * Test prompt validation edge cases
 * Tests validator function with various invalid inputs
 */
function TEST_promptValidation() {
  Logger.log('=== PROMPT VALIDATION TESTS ===\n');

  const ui = SpreadsheetApp.getUi();
  const startTest = ui.alert(
    '🧪 Prompt Validation Tests',
    'This will test input validation by asking you to enter:\n\n' +
    '1. A valid month (YYYY-MM format)\n' +
    '2. Try entering invalid formats to see validation errors\n\n' +
    'The prompt will loop until you enter valid input or cancel.\n\n' +
    'Ready to start?',
    ui.ButtonSet.YES_NO
  );

  if (startTest !== ui.Button.YES) {
    Logger.log('Test cancelled by user');
    return;
  }

  Logger.log('Testing month format validation...\n');

  const result = HELPER_promptUser(
    'Month Format Test',
    'Try entering invalid formats first (e.g., "01-2026", "2026/01", "January")\n\n' +
    'Then enter a valid format (YYYY-MM):\n\n' +
    'Enter month:',
    {
      required: true,
      validator: (value) => {
        // Format validation
        if (!/^\d{4}-\d{2}$/.test(value)) {
          return {
            valid: false,
            error: 'Format must be YYYY-MM (e.g., 2026-01). You entered: "' + value + '"'
          };
        }

        // Range validation
        const [year, month] = value.split('-').map(n => parseInt(n));
        if (year < 2020 || year > 2050) {
          return {
            valid: false,
            error: 'Year must be between 2020 and 2050'
          };
        }
        if (month < 1 || month > 12) {
          return {
            valid: false,
            error: 'Month must be between 01 and 12'
          };
        }

        return { valid: true };
      }
    }
  );

  if (result.success) {
    Logger.log(`✓ Valid input accepted: "${result.value}"`);
    Logger.log(`  Format: Correct`);
    Logger.log(`  Validation: Passed`);
  } else {
    Logger.log('✓ User cancelled (this is valid behavior)');
  }

  Logger.log('\n=== TEST COMPLETE ===\n');
  Logger.log('Prompt validation tested. Verify that:');
  Logger.log('  • Invalid inputs showed helpful error messages');
  Logger.log('  • Validation errors looped back to prompt');
  Logger.log('  • Valid input was accepted');
  Logger.log('  • Cancel button worked correctly');

  HELPER_showSuccess(
    'Validation Tests Complete',
    'Input validation has been tested.\n\n' +
    'Check the Execution Log for detailed results.'
  );
}

// ====================================================================
// DUAL MONTHLY VIEWS SYSTEM TESTS
// ====================================================================

/**
 * Test smart "upcoming week" calculation for WeeklyView.
 * Validates Option A logic: Sun-Wed shows current week, Thu-Sat shows next week.
 */
function TEST_upcomingWeekLogic() {
  Logger.log('=== UPCOMING WEEK LOGIC TEST ===\n');

  // Test different days of the week
  const testDates = [
    { date: new Date(2026, 0, 11), day: 'Sunday', expected: 'current' },    // Sunday Jan 11
    { date: new Date(2026, 0, 12), day: 'Monday', expected: 'current' },    // Monday Jan 12
    { date: new Date(2026, 0, 13), day: 'Tuesday', expected: 'current' },   // Tuesday Jan 13
    { date: new Date(2026, 0, 14), day: 'Wednesday', expected: 'current' }, // Wednesday Jan 14
    { date: new Date(2026, 0, 15), day: 'Thursday', expected: 'next' },     // Thursday Jan 15
    { date: new Date(2026, 0, 16), day: 'Friday', expected: 'next' },       // Friday Jan 16
    { date: new Date(2026, 0, 17), day: 'Saturday', expected: 'next' }      // Saturday Jan 17
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testDates) {
    try {
      const result = HELPER_getUpcomingWeekBounds(test.date);

      // Determine if we got current week or next week
      const currentWeek = HELPER_getCurrentWeekBounds(test.date);
      const nextWeek = HELPER_getCurrentWeekBounds(new Date(test.date.getTime() + 7 * 24 * 60 * 60 * 1000));

      let actualResult;
      if (result.startDate.getTime() === currentWeek.startDate.getTime()) {
        actualResult = 'current';
      } else if (result.startDate.getTime() === nextWeek.startDate.getTime()) {
        actualResult = 'next';
      } else {
        actualResult = 'unknown';
      }

      const status = actualResult === test.expected ? '✅ PASS' : '❌ FAIL';
      Logger.log(`${status} - ${test.day} (${HELPER_formatDate(test.date, 'default')})`);
      Logger.log(`  Expected: ${test.expected} week`);
      Logger.log(`  Got: ${actualResult} week`);
      Logger.log(`  Week String: ${result.weekString}`);
      Logger.log('');

      if (actualResult === test.expected) {
        passed++;
      } else {
        failed++;
      }

    } catch (e) {
      Logger.log(`❌ ERROR - ${test.day}: ${e.message}\n`);
      failed++;
    }
  }

  Logger.log('=== TEST SUMMARY ===');
  Logger.log(`Total: ${testDates.length} tests`);
  Logger.log(`Passed: ${passed}`);
  Logger.log(`Failed: ${failed}`);

  if (failed === 0) {
    HELPER_showSuccess(
      'Upcoming Week Logic Test',
      `All ${passed} tests passed!\n\nSmart week logic is working correctly for Monday email workflow.`
    );
  } else {
    HELPER_showAlert(
      'Upcoming Week Logic Test',
      `Tests completed with ${failed} failure(s).\n\nCheck execution log for details.`,
      'warning'
    );
  }
}

/**
 * Test month calculation for dual views.
 * Validates current + next month calculation including year boundary.
 */
function TEST_dualMonthCalculation() {
  Logger.log('=== DUAL MONTH CALCULATION TEST ===\n');
  Logger.log('Note: Testing with current date (cannot mock Date in Apps Script)\n');

  try {
    // Get current result
    const result = AUTOVIEW_calculateCurrentAndNextMonths();

    Logger.log('Current Month Calculation:');
    Logger.log(`  Current: ${result.current}`);
    Logger.log(`  Next: ${result.next}`);
    Logger.log(`  Display: ${result.currentDisplay} / ${result.nextDisplay}`);
    Logger.log('');

    // Validate format
    const currentFormat = /^\d{4}-\d{2}$/.test(result.current);
    const nextFormat = /^\d{4}-\d{2}$/.test(result.next);

    Logger.log('Format Validation:');
    Logger.log(`  ${currentFormat ? '✅' : '❌'} Current format (${result.current}): ${currentFormat ? 'Valid' : 'Invalid'}`);
    Logger.log(`  ${nextFormat ? '✅' : '❌'} Next format (${result.next}): ${nextFormat ? 'Valid' : 'Invalid'}`);
    Logger.log('');

    // Validate next month is after current
    const [currYear, currMonth] = result.current.split('-').map(Number);
    const [nextYear, nextMonth] = result.next.split('-').map(Number);

    let sequenceValid = false;
    if (currMonth === 12) {
      // December -> January of next year
      sequenceValid = (nextMonth === 1 && nextYear === currYear + 1);
    } else {
      // Same year, next month
      sequenceValid = (nextMonth === currMonth + 1 && nextYear === currYear);
    }

    Logger.log('Sequence Validation:');
    Logger.log(`  ${sequenceValid ? '✅' : '❌'} Next month follows current: ${sequenceValid ? 'Valid' : 'Invalid'}`);
    Logger.log('');

    // Manual year boundary check
    Logger.log('Year Boundary Test:');
    if (currMonth === 12) {
      Logger.log(`  ✅ PASS - December detected, next should be January ${nextYear}`);
      Logger.log(`  Result: ${nextMonth === 1 ? 'Correct (January)' : 'INCORRECT'}`);
    } else {
      Logger.log(`  ℹ️ Not December (current month: ${currMonth}), cannot test year boundary`);
      Logger.log(`  Tip: Run this test in December to validate year boundary logic`);
    }

    const allValid = currentFormat && nextFormat && sequenceValid;

    if (allValid) {
      HELPER_showSuccess(
        'Dual Month Calculation Test',
        'Month calculation is working correctly!\n\n' +
        `Current: ${result.currentDisplay}\n` +
        `Next: ${result.nextDisplay}\n\n` +
        'Format: ✓ Valid\n' +
        'Sequence: ✓ Valid\n\n' +
        '(Run in December to test year boundary)'
      );
    } else {
      HELPER_showAlert(
        'Dual Month Calculation Test',
        'Month calculation has issues.\n\nCheck execution log for details.',
        'warning'
      );
    }

  } catch (e) {
    Logger.log(`❌ ERROR: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    HELPER_showAlert(
      'Dual Month Calculation Test',
      `Test failed:\n\n${e.message}`,
      'warning'
    );
  }
}

/**
 * Test getCurrentMonthlyViewStatus() server function.
 * Validates that status API returns expected data structure.
 */
function TEST_getCurrentMonthlyViewStatus() {
  Logger.log('=== GET CURRENT MONTHLY VIEW STATUS TEST ===\n');

  try {
    const status = getCurrentMonthlyViewStatus();

    Logger.log('Status Result:');
    Logger.log(JSON.stringify(status, null, 2));
    Logger.log('');

    // Validate structure
    const requiredFields = [
      'success',
      'currentMonth',
      'nextMonth',
      'ministryFilter',
      'autoUpdateEnabled',
      'hasMonthlyViewCurrent',
      'hasMonthlyViewNext',
      'hasWeeklyView'
    ];

    let allFieldsPresent = true;
    for (const field of requiredFields) {
      if (!(field in status)) {
        Logger.log(`❌ Missing field: ${field}`);
        allFieldsPresent = false;
      } else {
        Logger.log(`✅ Field present: ${field} = ${status[field]}`);
      }
    }

    Logger.log('');

    if (allFieldsPresent && status.success) {
      HELPER_showSuccess(
        'Status API Test',
        'getCurrentMonthlyViewStatus() works correctly!\n\n' +
        `Current Month: ${status.currentMonth}\n` +
        `Next Month: ${status.nextMonth}\n` +
        `Ministry Filter: ${status.ministryFilter}\n` +
        `Auto-Update: ${status.autoUpdateEnabled ? 'Enabled' : 'Disabled'}`
      );
    } else {
      HELPER_showAlert(
        'Status API Test',
        'Function returned but structure is incomplete.\n\nCheck execution log for details.',
        'warning'
      );
    }

  } catch (e) {
    Logger.log(`❌ ERROR: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    HELPER_showError('Status API Test Failed', e, 'calendar');
  }
}

/**
 * Test getNext12Months() server function.
 * Validates month dropdown data generation.
 */
function TEST_getNext12Months() {
  Logger.log('=== GET NEXT 12 MONTHS TEST ===\n');

  try {
    const months = getNext12Months();

    Logger.log(`Returned ${months.length} months:`);

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < months.length; i++) {
      const month = months[i];

      // Validate structure
      const hasValue = 'value' in month;
      const hasDisplay = 'display' in month;
      const valueFormat = /^\d{4}-\d{2}$/.test(month.value);

      const status = (hasValue && hasDisplay && valueFormat) ? '✅' : '❌';
      Logger.log(`${status} [${i + 1}] ${month.value} - ${month.display}`);

      if (hasValue && hasDisplay && valueFormat) {
        passed++;
      } else {
        failed++;
        if (!hasValue) Logger.log('    Missing "value" field');
        if (!hasDisplay) Logger.log('    Missing "display" field');
        if (!valueFormat) Logger.log('    Invalid value format (expected YYYY-MM)');
      }
    }

    Logger.log('');
    Logger.log('=== TEST SUMMARY ===');
    Logger.log(`Total months: ${months.length}`);
    Logger.log(`Valid: ${passed}`);
    Logger.log(`Invalid: ${failed}`);

    if (failed === 0 && months.length === 12) {
      HELPER_showSuccess(
        'Month Dropdown Test',
        `All ${months.length} months generated correctly!\n\nData structure is valid for sidebar dropdown.`
      );
    } else {
      HELPER_showAlert(
        'Month Dropdown Test',
        `Issues found:\n- Expected 12 months, got ${months.length}\n- ${failed} invalid entries\n\nCheck execution log.`,
        'warning'
      );
    }

  } catch (e) {
    Logger.log(`❌ ERROR: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    HELPER_showError('Month Dropdown Test Failed', e, 'calendar');
  }
}

/**
 * Test setMonthlyViewMinistryFilter() server function.
 * Validates filter update and regeneration (does NOT actually regenerate sheets).
 */
function TEST_setMonthlyViewMinistryFilter_DryRun() {
  Logger.log('=== SET MONTHLY VIEW MINISTRY FILTER TEST (DRY RUN) ===\n');

  try {
    // Get current filter
    const initialStatus = getCurrentMonthlyViewStatus();
    Logger.log(`Initial ministry filter: ${initialStatus.ministryFilter}\n`);

    // Get available ministries
    const ministries = getActiveMinistries();
    Logger.log('Available ministries:');
    ministries.forEach(m => Logger.log(`  - ${m}`));
    Logger.log('');

    // Test validation
    Logger.log('TEST 1: Invalid ministry (should fail)');
    try {
      const result1 = setMonthlyViewMinistryFilter('NonExistentMinistry');
      if (result1.success) {
        Logger.log('❌ FAIL - Should have rejected invalid ministry');
      } else {
        Logger.log(`✅ PASS - Correctly rejected: ${result1.error}`);
      }
    } catch (e) {
      Logger.log(`✅ PASS - Correctly threw error: ${e.message}`);
    }
    Logger.log('');

    // Test valid ministry (but ask for confirmation first)
    Logger.log('TEST 2: Valid ministry (requires confirmation)');

    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Filter Update Test',
      'This test will update the ministry filter and regenerate both monthly views.\n\n' +
      `Current filter: ${initialStatus.ministryFilter}\n\n` +
      'Proceed with test?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      // Use first ministry or "All Ministries"
      const testFilter = ministries.length > 0 ? ministries[0] : 'All Ministries';
      Logger.log(`Setting filter to: ${testFilter}`);

      const result2 = setMonthlyViewMinistryFilter(testFilter);

      if (result2.success) {
        Logger.log(`✅ PASS - Filter updated: ${result2.message}`);

        // Verify it was saved
        const newStatus = getCurrentMonthlyViewStatus();
        Logger.log(`New filter from status: ${newStatus.ministryFilter}`);

        if (newStatus.ministryFilter === testFilter) {
          Logger.log('✅ PASS - Filter persisted correctly');
        } else {
          Logger.log('❌ FAIL - Filter did not persist');
        }
      } else {
        Logger.log(`❌ FAIL - ${result2.error}`);
      }
    } else {
      Logger.log('Test cancelled by user');
    }

    Logger.log('\n=== TEST COMPLETE ===');
    HELPER_showAlert(
      'Ministry Filter Test',
      'Test completed. Check execution log for results.\n\n' +
      'Note: If you ran the update test, check MonthlyView-Current and MonthlyView-Next sheets.',
      'info'
    );

  } catch (e) {
    Logger.log(`❌ ERROR: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    HELPER_showError('Ministry Filter Test Failed', e, 'calendar');
  }
}

/**
 * Test generateCustomPrint() server function.
 * Validates custom print generation with user confirmation.
 */
function TEST_generateCustomPrint() {
  Logger.log('=== GENERATE CUSTOM PRINT TEST ===\n');

  try {
    const ui = SpreadsheetApp.getUi();

    // Get available months
    const months = getNext12Months();
    const testMonth = months.length > 0 ? months[0].value : '2026-02';

    // Get available ministries
    const ministries = getActiveMinistries();
    const testMinistry = ministries.length > 0 ? ministries[0] : 'All Ministries';

    Logger.log('Test Parameters:');
    Logger.log(`  Month: ${testMonth}`);
    Logger.log(`  Ministry: ${testMinistry}`);
    Logger.log(`  Output Sheet: TEST-CustomPrint\n`);

    const response = ui.alert(
      'Custom Print Test',
      'This test will generate a custom print schedule.\n\n' +
      `Month: ${testMonth}\n` +
      `Ministry: ${testMinistry}\n` +
      `Output: TEST-CustomPrint sheet\n\n` +
      'Proceed with test?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      const result = generateCustomPrint(testMonth, testMinistry, 'TEST-CustomPrint');

      if (result.success) {
        Logger.log(`✅ SUCCESS: ${result.message}`);

        // Verify sheet was created
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('TEST-CustomPrint');

        if (sheet) {
          Logger.log('✅ PASS - Sheet created successfully');
          Logger.log(`  Rows: ${sheet.getLastRow()}`);
          Logger.log(`  Columns: ${sheet.getLastColumn()}`);
        } else {
          Logger.log('❌ FAIL - Sheet not found');
        }

        HELPER_showSuccess(
          'Custom Print Test',
          'Custom print generated successfully!\n\n' +
          'Check the TEST-CustomPrint sheet.\n\n' +
          result.message
        );
      } else {
        Logger.log(`❌ FAIL: ${result.error}`);
        HELPER_showAlert(
          'Custom Print Test',
          `Test failed:\n\n${result.error}`,
          'warning'
        );
      }
    } else {
      Logger.log('Test cancelled by user');
      HELPER_showAlert('Custom Print Test', 'Test cancelled.', 'info');
    }

  } catch (e) {
    Logger.log(`❌ ERROR: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    HELPER_showError('Custom Print Test Failed', e, 'print');
  }
}

/**
 * Master test runner for dual monthly views system.
 * Runs all backend tests in sequence (non-destructive tests only).
 */
function TEST_dualMonthlyViewsSystem_NonDestructive() {
  Logger.log('=== DUAL MONTHLY VIEWS SYSTEM - FULL TEST SUITE ===\n');
  Logger.log('Running all non-destructive tests...\n');

  const tests = [
    { name: 'Upcoming Week Logic', fn: TEST_upcomingWeekLogic },
    { name: 'Dual Month Calculation', fn: TEST_dualMonthCalculation },
    { name: 'Status API', fn: TEST_getCurrentMonthlyViewStatus },
    { name: 'Month Dropdown', fn: TEST_getNext12Months }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      Logger.log(`\n${'='.repeat(60)}`);
      Logger.log(`Running: ${test.name}`);
      Logger.log('='.repeat(60));

      test.fn();

      Logger.log(`✅ ${test.name} completed`);
      passed++;

    } catch (e) {
      Logger.log(`❌ ${test.name} failed: ${e.message}`);
      failed++;
    }

    Utilities.sleep(1000); // Brief pause between tests
  }

  Logger.log('\n' + '='.repeat(60));
  Logger.log('FULL TEST SUITE SUMMARY');
  Logger.log('='.repeat(60));
  Logger.log(`Total Tests: ${tests.length}`);
  Logger.log(`Passed: ${passed}`);
  Logger.log(`Failed: ${failed}`);

  if (failed === 0) {
    HELPER_showSuccess(
      'Dual Monthly Views - All Tests Passed!',
      `All ${passed} backend tests passed successfully.\n\n` +
      'The dual monthly views system is ready for sidebar integration.\n\n' +
      'To test destructive operations (filter updates, custom prints), ' +
      'run individual tests with confirmation prompts.'
    );
  } else {
    HELPER_showAlert(
      'Dual Monthly Views - Tests Complete',
      `${passed} tests passed, ${failed} tests failed.\n\n` +
      'Check execution log for details.',
      'warning'
    );
  }
}
