/**
 * Debug test for weekly view issue with missing 1/1/2026 assignments
 */
function TEST_weeklyViewDebug() {
  Logger.log('=== WEEKLY VIEW DEBUG TEST ===');

  // Test week: December 28, 2025 - January 4, 2026
  const testDate = new Date(2025, 11, 29, 12, 0, 0); // December 29, 2025 (Monday)

  // Get week bounds
  const weekBounds = HELPER_getCurrentWeekBounds(testDate);
  Logger.log(`Week bounds: ${weekBounds.startDate} to ${weekBounds.endDate}`);
  Logger.log(`Week string: ${weekBounds.weekString}`);

  // Test date filtering
  const testDates = [
    new Date(2025, 11, 28, 12, 0, 0), // Dec 28 (Sunday)
    new Date(2025, 11, 31, 12, 0, 0), // Dec 31 (Wednesday)
    new Date(2026, 0, 1, 12, 0, 0),   // Jan 1 (Thursday)
    new Date(2026, 0, 3, 12, 0, 0),   // Jan 3 (Saturday)
    new Date(2026, 0, 4, 12, 0, 0)    // Jan 4 (Sunday)
  ];

  Logger.log('\n=== Date Filter Tests ===');
  for (const testDate of testDates) {
    const isInWeek = HELPER_isDateInWeek(testDate, weekBounds.startDate, weekBounds.endDate);
    Logger.log(`${HELPER_formatDate(testDate, 'default')} - In week: ${isInWeek}`);
  }

  // Read assignments from relevant months
  Logger.log('\n=== Assignment Loading ===');
  const dec2025 = '2025-12';
  const jan2026 = '2026-01';

  try {
    const decAssignments = getAssignmentDataForMonth(dec2025);
    Logger.log(`Assignments from ${dec2025}: ${decAssignments.length}`);
    for (const a of decAssignments) {
      Logger.log(`  - ${HELPER_formatDate(a.date, 'default')} ${a.time instanceof Date ? HELPER_formatTime(a.time) : a.time} ${a.liturgicalCelebration}`);
    }
  } catch (e) {
    Logger.log(`Error reading ${dec2025}: ${e.message}`);
  }

  try {
    const janAssignments = getAssignmentDataForMonth(jan2026);
    Logger.log(`Assignments from ${jan2026}: ${janAssignments.length}`);
    for (const a of janAssignments) {
      Logger.log(`  - ${HELPER_formatDate(a.date, 'default')} ${a.time instanceof Date ? HELPER_formatTime(a.time) : a.time} ${a.liturgicalCelebration}`);
    }
  } catch (e) {
    Logger.log(`Error reading ${jan2026}: ${e.message}`);
  }

  // Build weekly schedule data
  Logger.log('\n=== Building Weekly Schedule Data ===');
  try {
    const config = { ministryFilter: null };
    const scheduleData = buildWeeklyScheduleData(weekBounds.startDate, weekBounds.endDate, config);

    Logger.log(`Total assignments in week: ${scheduleData.assignments.length}`);
    Logger.log(`Assignments by date:`);
    const byDate = new Map();
    for (const a of scheduleData.assignments) {
      const dateStr = HELPER_formatDate(a.date, 'default');
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, []);
      }
      byDate.get(dateStr).push(a);
    }

    for (const [dateStr, assignments] of byDate) {
      Logger.log(`  ${dateStr}: ${assignments.length} assignments`);
      for (const a of assignments) {
        const dayOfWeek = a.date.getDay();
        const isWeekend = (dayOfWeek === 0) || (dayOfWeek === 6 && a.isAnticipated);
        Logger.log(`    - ${a.time instanceof Date ? HELPER_formatTime(a.time) : a.time} ${a.role} → ${a.assignedVolunteerName} (day=${dayOfWeek}, anticipated=${a.isAnticipated}, weekend=${isWeekend})`);
      }
    }

    // Check weekend vs weekday categorization
    Logger.log('\n=== Weekend vs Weekday Categorization ===');
    const weekendAssignments = [];
    const weekdayAssignments = [];

    for (const assignment of scheduleData.assignments) {
      const dayOfWeek = assignment.date.getDay();
      const isWeekend = (dayOfWeek === 0) || (dayOfWeek === 6 && assignment.isAnticipated);

      if (isWeekend) {
        weekendAssignments.push(assignment);
      } else {
        weekdayAssignments.push(assignment);
      }
    }

    Logger.log(`Weekend assignments: ${weekendAssignments.length}`);
    Logger.log(`Weekday assignments: ${weekdayAssignments.length}`);

    if (weekdayAssignments.length > 0) {
      Logger.log('\nWeekday assignments:');
      for (const a of weekdayAssignments) {
        Logger.log(`  - ${HELPER_formatDate(a.date, 'default')} ${a.time instanceof Date ? HELPER_formatTime(a.time) : a.time} ${a.role} → ${a.assignedVolunteerName}`);
      }
    }

  } catch (e) {
    Logger.log(`ERROR in buildWeeklyScheduleData: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
  }

  Logger.log('\n=== TEST COMPLETE ===');
  return 'Check execution logs for results';
}
