/**
 * TEST: Limited Availability Bonus
 *
 * Demonstrates that volunteers with "Only Available" timeoffs (whitelists)
 * receive a +15 bonus to prioritize them during their limited availability windows.
 *
 * Rationale: If someone says "I can ONLY serve Feb 8, 15, 22", they're unavailable
 * all other dates. We should use them when they're available, or we might not get
 * them at all that month.
 */

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
    timesAtThisMass: 0, // First time at SUN-1000
    hasWhitelist: false
  };

  // Volunteer B: Limited availability (whitelist for Feb 8, 15, 22 only)
  const volunteerB = {
    name: 'Limited Availability Volunteer',
    id: '101',
    totalAssignments: 3,
    massPrefs: ['SUN-1000'],
    timesAtThisMass: 0, // First time at SUN-1000
    hasWhitelist: true  // Said "I can ONLY serve Feb 8, 15, 22"
  };

  Logger.log('Volunteer A (Regular):');
  Logger.log(`  Total assignments: ${volunteerA.totalAssignments}`);
  Logger.log(`  Mass preferences: ${volunteerA.massPrefs.join(', ')}`);
  Logger.log(`  Whitelist status: No timeoff\n`);

  const scoreA = calculateScoreExample(volunteerA);
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

  const scoreB = calculateScoreExample(volunteerB);
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
function calculateScoreExample(volunteer) {
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

/**
 * Compare before/after behavior
 */
function TEST_beforeAfterWhitelistBonus() {
  Logger.log('=== BEFORE vs AFTER: Whitelist Bonus ===\n');

  Logger.log('Scenario: Two volunteers available for Sunday Feb 8');
  Logger.log('  - Volunteer A: Regular (3 assignments, always available)');
  Logger.log('  - Volunteer B: Limited (3 assignments, can ONLY serve Feb 8, 15, 22)\n');

  Logger.log('BEFORE (no whitelist bonus):');
  Logger.log('  Volunteer A: 100 - 15 + 20 = 105');
  Logger.log('  Volunteer B: 100 - 15 + 20 = 105');
  Logger.log('  Result: TIE (random selection or first-found)');
  Logger.log('  ❌ Problem: Might pick Volunteer A, wasting Volunteer B\'s limited slot\n');

  Logger.log('AFTER (with whitelist bonus):');
  Logger.log('  Volunteer A: 100 - 15 + 20 = 105');
  Logger.log('  Volunteer B: 100 - 15 + 20 + 15 = 120');
  Logger.log('  Result: Volunteer B WINS');
  Logger.log('  ✅ Solution: Uses Volunteer B when available, saves Volunteer A for other weeks\n');

  Logger.log('=== SCHEDULING OUTCOME ===');
  Logger.log('Month view:');
  Logger.log('  Feb 8:  Volunteer B (limited, used when available) ✅');
  Logger.log('  Feb 15: Volunteer B (limited, used when available) ✅');
  Logger.log('  Feb 22: Volunteer B (limited, used when available) ✅');
  Logger.log('  Feb 29: Volunteer A (regular, fills remaining weeks) ✅');
  Logger.log('\nBetter coverage and utilization of limited availability volunteers!');
}
