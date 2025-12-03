/**
 * ====================================================================
 * MASS TIME ROTATION - TESTING AND DEMONSTRATION
 * ====================================================================
 *
 * Test functions to verify and demonstrate the mass time rotation logic.
 */

/**
 * Test function: Demonstrate how rotation scoring works
 *
 * Shows how volunteers with multiple preferred mass times get scored differently
 * based on their assignment history to specific Event IDs.
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
 *
 * Shows which volunteers are getting variety in their preferred masses
 * vs. those being assigned to the same mass repeatedly.
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
    const rotationScore = uniqueMasses / totalAssignments; // 1.0 = perfect rotation, 0.5 = some variety, <0.5 = stuck at one mass

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
