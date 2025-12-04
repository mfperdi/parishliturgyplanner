/**
 * TEST: Family Team Constraint - Hard Filter
 *
 * Verifies that family/team members are ONLY assigned together at the same mass,
 * never to different masses on the same liturgical day.
 *
 * Example: If Desiree Peralta (Peralta Family) is assigned to 1/4 SUN-1200,
 * then Dixie Peralta (Peralta Family) should ONLY be assigned to 1/4 SUN-1200,
 * NOT to 1/4 SUN-1700 or any other mass on that day.
 */

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

/**
 * Before/After comparison
 */
function TEST_beforeAfterFamilyConstraint() {
  Logger.log('=== BEFORE vs AFTER: Family Team Hard Filter ===\n');

  Logger.log('Scenario: Peralta Family on 2nd Sunday in OT (Jan 17-18)');
  Logger.log('  Desiree: Prefers SUN-1200, SUN-1700');
  Logger.log('  Dixie: Prefers SUN-1200, SUN-1700');
  Logger.log('');

  Logger.log('BEFORE (family bonus only, +25 points):');
  Logger.log('  SUN-1200 roles:');
  Logger.log('    - 1st Reading: Jeriel (score: 100)');
  Logger.log('    - 2nd Reading: Lita (score: 100)');
  Logger.log('  SUN-1700 roles:');
  Logger.log('    - 1st Reading: Tom (score: 100)');
  Logger.log('    - 2nd Reading: Desiree (score: 100)');
  Logger.log('  Result: Desiree at SUN-1700, Dixie NOT assigned');
  Logger.log('  ❌ Problem: Family split - Desiree alone at 5pm mass\n');

  Logger.log('AFTER (family hard filter):');
  Logger.log('  SUN-1200 roles:');
  Logger.log('    - 1st Reading: Desiree assigned');
  Logger.log('    - 2nd Reading: System checks... Dixie eligible? ✅ YES (family member at same mass)');
  Logger.log('    - 2nd Reading: Dixie assigned');
  Logger.log('  SUN-1700 roles:');
  Logger.log('    - 1st Reading: System checks Desiree...');
  Logger.log('    - Desiree excluded: ❌ Dixie already at SUN-1200');
  Logger.log('    - Tom assigned instead');
  Logger.log('  Result: Desiree + Dixie TOGETHER at SUN-1200 ✅\n');

  Logger.log('=== BENEFITS ===');
  Logger.log('✅ Families serve together (better experience)');
  Logger.log('✅ Prevents split assignments on same liturgical day');
  Logger.log('✅ Works with family team bonus (+25 to encourage assignment)');
  Logger.log('✅ Enforced automatically (no manual checking needed)');
}
