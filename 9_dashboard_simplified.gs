/**
 * ====================================================================
 * DASHBOARD ANALYTICS - SIMPLIFIED FORMULA-BASED APPROACH
 * ====================================================================
 *
 * This creates a dashboard using pure Google Sheets formulas
 * - No hidden data layers
 * - Pulls directly from Assignments, Volunteers, Timeoffs sheets
 * - Always up-to-date (formulas recalculate automatically)
 * - Much simpler than hybrid approach
 *
 * Trade-off: No historical tracking (can't store monthly snapshots)
 */

/**
 * Generate simplified formula-based dashboard
 * This writes formulas only - no data caching
 *
 * @param {string} monthString - Month to analyze (format: "YYYY-MM")
 */
function DASHBOARD_generateSimplified(monthString) {
  try {
    Logger.log(`Generating simplified dashboard for ${monthString}`);

    // Validate month
    const { year, month } = HELPER_validateMonthString(monthString);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let dashboardSheet = ss.getSheetByName('Dashboard');

    // Create or clear sheet
    if (!dashboardSheet) {
      dashboardSheet = ss.insertSheet('Dashboard');
    } else {
      dashboardSheet.clear();
    }

    // Write header
    dashboardSheet.getRange('A1').setValue('PARISH SCHEDULER - DASHBOARD ANALYTICS');
    dashboardSheet.getRange('A1').setFontSize(14).setFontWeight('bold');

    dashboardSheet.getRange('A2').setValue(`Month: ${monthString}`);
    dashboardSheet.getRange('A2').setFontWeight('bold');

    // === SECTION 1: VOLUNTEER FREQUENCY ===
    let currentRow = 4;

    dashboardSheet.getRange(currentRow, 1).setValue('📊 VOLUNTEER SERVICE FREQUENCY');
    dashboardSheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');
    currentRow++;

    // Headers
    const volHeaders = ['Volunteer Name', 'Assignments This Month', 'Status'];
    dashboardSheet.getRange(currentRow, 1, 1, volHeaders.length).setValues([volHeaders]);
    dashboardSheet.getRange(currentRow, 1, 1, volHeaders.length).setFontWeight('bold').setBackground('#E8F0FE');
    currentRow++;

    // Formula: Pull volunteers and their assignment counts
    const volFormula = `=QUERY(
      {
        Volunteers!D2:D & "",
        ARRAYFORMULA(
          COUNTIFS(
            Assignments!$K$2:$K, Volunteers!A2:A,
            Assignments!$I$2:$I, "${monthString}",
            Assignments!$M$2:$M, "Assigned"
          )
        )
      },
      "SELECT Col1, Col2
       WHERE Col1 <> ''
       ORDER BY Col2 DESC",
      0
    )`;

    dashboardSheet.getRange(currentRow, 1).setFormula(volFormula);

    // Status column (based on average)
    // This will appear in column C next to the data
    const statusFormula = `=ARRAYFORMULA(
      IF(
        B${currentRow}:B = "",
        "",
        IF(
          B${currentRow}:B < AVERAGE(B${currentRow}:B) * 0.5,
          "Under-utilized 💡",
          IF(
            B${currentRow}:B > AVERAGE(B${currentRow}:B) * 1.5,
            "Over-utilized ⚠️",
            "Balanced ✓"
          )
        )
      )
    )`;
    dashboardSheet.getRange(currentRow, 3).setFormula(statusFormula);

    currentRow += 30; // Leave space for volunteers

    // === SECTION 2: COVERAGE BY MASS ===
    currentRow += 2;
    dashboardSheet.getRange(currentRow, 1).setValue('📅 COVERAGE BY MASS');
    dashboardSheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');
    currentRow++;

    // Headers
    const massHeaders = ['Event ID', 'Total Roles', 'Assigned', 'Coverage %', 'Status'];
    dashboardSheet.getRange(currentRow, 1, 1, massHeaders.length).setValues([massHeaders]);
    dashboardSheet.getRange(currentRow, 1, 1, massHeaders.length).setFontWeight('bold').setBackground('#E8F0FE');
    currentRow++;

    // Formula: Group assignments by Event ID
    const massFormula = `=QUERY(
      Assignments!$A$2:$M,
      "SELECT G, COUNT(G),
              COUNTIF(M, 'Assigned'),
              COUNTIF(M, 'Assigned') / COUNT(G)
       WHERE I = '${monthString}'
       GROUP BY G
       ORDER BY G",
      0
    )`;

    dashboardSheet.getRange(currentRow, 1).setFormula(massFormula);

    // Status column
    const coverageStatusFormula = `=ARRAYFORMULA(
      IF(
        D${currentRow}:D = "",
        "",
        IF(
          D${currentRow}:D >= 0.8,
          "Good ✓",
          IF(
            D${currentRow}:D >= 0.5,
            "Warning ⚠️",
            "Critical 🚨"
          )
        )
      )
    )`;
    dashboardSheet.getRange(currentRow, 5).setFormula(coverageStatusFormula);

    currentRow += 20; // Leave space for masses

    // === SECTION 3: UNASSIGNED ROLES ===
    currentRow += 2;
    dashboardSheet.getRange(currentRow, 1).setValue('⚠️ UNASSIGNED ROLES');
    dashboardSheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');
    currentRow++;

    // Total unassigned count
    dashboardSheet.getRange(currentRow, 1).setValue('Total Unassigned:');
    dashboardSheet.getRange(currentRow, 1).setFontWeight('bold');

    const unassignedFormula = `=COUNTIFS(Assignments!$I$2:$I, "${monthString}", Assignments!$M$2:$M, "Unassigned")`;
    dashboardSheet.getRange(currentRow, 2).setFormula(unassignedFormula);
    dashboardSheet.getRange(currentRow, 2).setFontWeight('bold').setFontSize(14);
    currentRow += 2;

    // By Ministry
    dashboardSheet.getRange(currentRow, 1).setValue('BY MINISTRY:');
    dashboardSheet.getRange(currentRow, 1).setFontWeight('bold');
    currentRow++;

    const unassignedByMinistryFormula = `=QUERY(
      Assignments!$A$2:$M,
      "SELECT E, COUNT(E)
       WHERE I = '${monthString}' AND M = 'Unassigned'
       GROUP BY E
       ORDER BY COUNT(E) DESC",
      0
    )`;
    dashboardSheet.getRange(currentRow, 1).setFormula(unassignedByMinistryFormula);

    // Apply conditional formatting
    applySimplifiedConditionalFormatting(dashboardSheet);

    // Auto-resize columns
    dashboardSheet.autoResizeColumns(1, 5);
    dashboardSheet.setFrozenRows(3);

    Logger.log('Simplified dashboard generated successfully');

    return `Dashboard generated for ${monthString} using pure formulas`;

  } catch (e) {
    Logger.log(`ERROR in DASHBOARD_generateSimplified: ${e.message}`);
    throw new Error(`Dashboard generation failed: ${e.message}`);
  }
}

/**
 * Apply conditional formatting to simplified dashboard
 */
function applySimplifiedConditionalFormatting(sheet) {
  // Status column formatting (volunteer section)
  const balancedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Balanced')
    .setBackground('#D4EDDA')
    .setRanges([sheet.getRange('C6:C100')])
    .build();

  const underRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Under-utilized')
    .setBackground('#FFF3CD')
    .setRanges([sheet.getRange('C6:C100')])
    .build();

  const overRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Over-utilized')
    .setBackground('#F8D7DA')
    .setRanges([sheet.getRange('C6:C100')])
    .build();

  // Coverage status formatting
  const goodRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Good')
    .setBackground('#D4EDDA')
    .setRanges([sheet.getRange('E40:E100')])
    .build();

  const warningRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Warning')
    .setBackground('#FFF3CD')
    .setRanges([sheet.getRange('E40:E100')])
    .build();

  const criticalRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Critical')
    .setBackground('#F8D7DA')
    .setRanges([sheet.getRange('E40:E100')])
    .build();

  const rules = [balancedRule, underRule, overRule, goodRule, warningRule, criticalRule];
  sheet.setConditionalFormatRules(rules);
}

/**
 * TEST FUNCTION for simplified dashboard
 */
function TEST_simplifiedDashboard() {
  const monthString = "2026-02"; // Change to your month

  try {
    const result = DASHBOARD_generateSimplified(monthString);
    Logger.log('✅ ' + result);

    // Open the sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheetByName('Dashboard').activate();

  } catch (e) {
    Logger.log('❌ ERROR: ' + e.message);
    throw e;
  }
}
