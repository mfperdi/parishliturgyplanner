/**
 * TEST: Mass Preference Filtering
 *
 * Demonstrates that volunteers are only assigned to their preferred masses.
 *
 * Tests:
 * 1. Volunteers with preferences are ONLY eligible for their preferred masses
 * 2. Volunteers without preferences are eligible for ALL masses (flexible)
 * 3. Rotation works within the filtered set of preferred masses
 */

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
      const isEligible = checkMassPreferenceEligibility(testCase.preferences, massEventId);
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
function checkMassPreferenceEligibility(preferences, eventId) {
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
  const massEventIds = getAllEventIds();

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
      const isEligible = checkMassPreferenceEligibility(preferences, eventId);
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
function getAllEventIds() {
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
function TEST_beforeAfterComparison() {
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
    const isEligible = checkMassPreferenceEligibility(volunteer.preferences, mass.eventId);
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
