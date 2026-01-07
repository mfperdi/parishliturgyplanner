/**
 * ====================================================================
 * DASHBOARD ANALYTICS - SIMPLIFIED PURE FORMULA APPROACH
 * ====================================================================
 *
 * Generates dashboard analytics using pure Google Sheets formulas.
 * Creates three separate dashboard sheets for better organization:
 * - Volunteer Dashboard: Service frequency and utilization
 * - Mass Coverage Dashboard: Assignment coverage by mass
 * - Unassigned Dashboard: Breakdown of unassigned roles
 *
 * All formulas pull directly from source sheets for real-time updates.
 */

/**
 * Generate simplified dashboard analytics with three separate sheets.
 * @param {string} monthString - Month in YYYY-MM format (e.g., "2026-01")
 * @returns {string} Success message
 */
function DASHBOARD_generateSimplified(monthString) {
  try {
    Logger.log(`Generating simplified dashboard for ${monthString}`);

    // Validate month format
    const { year, month } = HELPER_validateMonthString(monthString);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create or clear the three dashboard sheets
    const volunteerSheet = createOrClearSheet(ss, 'Volunteer Dashboard');
    const coverageSheet = createOrClearSheet(ss, 'Mass Coverage Dashboard');
    const unassignedSheet = createOrClearSheet(ss, 'Unassigned Dashboard');

    // Generate each dashboard
    generateVolunteerDashboard(volunteerSheet, monthString);
    generateMassCoverageDashboard(coverageSheet, monthString);
    generateUnassignedDashboard(unassignedSheet, monthString);

    // Open the Volunteer Dashboard
    ss.setActiveSheet(volunteerSheet);

    Logger.log('Simplified dashboard generated successfully');
    return `✅ Dashboard generated for ${monthString} using pure formulas`;

  } catch (e) {
    Logger.log(`ERROR in DASHBOARD_generateSimplified: ${e.message}\n${e.stack}`);
    throw new Error(`Failed to generate dashboard: ${e.message}`);
  }
}

/**
 * Create or clear a sheet.
 * @param {Spreadsheet} ss - The spreadsheet
 * @param {string} sheetName - Name of sheet to create/clear
 * @returns {Sheet} The sheet
 */
function createOrClearSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    // Clear existing content
    sheet.clear();
    sheet.clearFormats();
    sheet.clearConditionalFormatRules();
  } else {
    // Create new sheet
    sheet = ss.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * Generate Annual Volunteer Summary showing all 12 months.
 * Replaces monthly Volunteer Dashboard with year-at-a-glance view.
 */
function generateVolunteerDashboard(sheet, monthString) {
  // Get year from Config sheet
  const config = HELPER_readConfigSafe();
  const year = config["Year to Schedule"];

  if (!year) {
    throw new Error('Year to Schedule not configured in Config sheet');
  }

  let currentRow = 1;

  // Title
  sheet.getRange(currentRow, 1).setValue(`👥 ANNUAL VOLUNTEER SUMMARY - ${year}`);
  sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setBackground('#1a73e8').setFontColor('white');
  sheet.getRange(currentRow, 1, 1, 15).merge();
  currentRow += 2;

  // Headers
  const headers = ['Volunteer Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total', 'Avg'];
  sheet.getRange(currentRow, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(currentRow, 1, 1, headers.length).setFontWeight('bold').setBackground('#E8F0FE');
  currentRow++;

  // Get all Active volunteers from Volunteers sheet
  const volunteersFormula = `=QUERY(
    Volunteers!$D$2:$D,
    "SELECT D WHERE I = 'Active' ORDER BY D",
    0
  )`;
  sheet.getRange(currentRow, 1).setFormula(volunteersFormula);

  // Month columns (Jan-Dec)
  for (let monthNum = 1; monthNum <= 12; monthNum++) {
    const monthStr = `${year}-${monthNum.toString().padStart(2, '0')}`;
    const colNum = monthNum + 1; // Column B = Jan (2), C = Feb (3), etc.

    const monthFormula = `=ARRAYFORMULA(
      IF(
        A${currentRow}:A = "",
        "",
        COUNTIFS(
          Assignments!$L$2:$L, A${currentRow}:A,
          Assignments!$I$2:$I, "${monthStr}",
          Assignments!$M$2:$M, "Assigned"
        ) +
        COUNTIFS(
          Assignments!$L$2:$L, A${currentRow}:A,
          Assignments!$I$2:$I, "${monthStr}",
          Assignments!$M$2:$M, "Substitute Assigned"
        ) +
        COUNTIFS(
          Assignments!$L$2:$L, A${currentRow}:A,
          Assignments!$I$2:$I, "${monthStr}",
          Assignments!$M$2:$M, "Confirmed"
        ) +
        COUNTIFS(
          Assignments!$L$2:$L, A${currentRow}:A,
          Assignments!$I$2:$I, "${monthStr}",
          Assignments!$M$2:$M, "Substitute Confirmed"
        )
      )
    )`;
    sheet.getRange(currentRow, colNum).setFormula(monthFormula);
  }

  // Total column (sum of all months)
  const totalFormula = `=ARRAYFORMULA(IF(A${currentRow}:A = "", "", B${currentRow}:B + C${currentRow}:C + D${currentRow}:D + E${currentRow}:E + F${currentRow}:F + G${currentRow}:G + H${currentRow}:H + I${currentRow}:I + J${currentRow}:J + K${currentRow}:K + L${currentRow}:L + M${currentRow}:M))`;
  sheet.getRange(currentRow, 14).setFormula(totalFormula);

  // Average column (total / 12)
  const avgFormula = `=ARRAYFORMULA(IF(A${currentRow}:A = "", "", ROUND(N${currentRow}:N / 12, 1)))`;
  sheet.getRange(currentRow, 15).setFormula(avgFormula);

  // Apply conditional formatting to month columns (B:M)
  const monthsRange = sheet.getRange(currentRow, 2, 100, 12);
  const monthRules = [
    // Red: 0 assignments (under-utilized)
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberEqualTo(0)
      .setBackground('#F8D7DA')
      .setRanges([monthsRange])
      .build(),
    // Yellow: 1 assignment (minimal)
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberEqualTo(1)
      .setBackground('#FFF3CD')
      .setRanges([monthsRange])
      .build(),
    // Light Green: 2-3 assignments (balanced)
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(2, 3)
      .setBackground('#D4EDDA')
      .setRanges([monthsRange])
      .build(),
    // Orange: 4+ assignments (over-utilized)
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(4)
      .setBackground('#FFE5CC')
      .setRanges([monthsRange])
      .build()
  ];
  sheet.setConditionalFormatRules(monthRules);

  // Formatting
  sheet.setFrozenRows(3); // Freeze title and headers
  sheet.setFrozenColumns(1); // Freeze volunteer name column
  sheet.autoResizeColumns(1, 15);

  // Delete unused columns (keep only 15 columns: Name + 12 months + Total + Avg)
  deleteUnusedColumns(sheet, 15);
}

/**
 * Generate Mass Coverage Dashboard showing assignment coverage by mass.
 */
function generateMassCoverageDashboard(sheet, monthString) {
  let currentRow = 1;

  // Title
  sheet.getRange(currentRow, 1).setValue('📅 MASS COVERAGE DASHBOARD');
  sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setBackground('#1a73e8').setFontColor('white');
  sheet.getRange(currentRow, 1, 1, 5).merge();
  currentRow++;

  // Month info
  const monthName = HELPER_formatMonthYear(monthString);
  sheet.getRange(currentRow, 1).setValue(`Month: ${monthName}`);
  sheet.getRange(currentRow, 1).setFontWeight('bold');
  currentRow += 2;

  // Headers
  const headers = ['Event ID', 'Total Roles', 'Assigned', 'Coverage %', 'Status'];
  sheet.getRange(currentRow, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(currentRow, 1, 1, headers.length).setFontWeight('bold').setBackground('#E8F0FE');
  currentRow++;

  // Formula: Group assignments by Event ID
  // Count all assignment statuses: Assigned, Substitute Assigned, Confirmed, Substitute Confirmed
  const massFormula = `=QUERY(
    Assignments!$A$2:$M,
    "SELECT G, COUNT(G),
            COUNTIF(M, 'Assigned') + COUNTIF(M, 'Substitute Assigned') + COUNTIF(M, 'Confirmed') + COUNTIF(M, 'Substitute Confirmed'),
            (COUNTIF(M, 'Assigned') + COUNTIF(M, 'Substitute Assigned') + COUNTIF(M, 'Confirmed') + COUNTIF(M, 'Substitute Confirmed')) / COUNT(G)
     WHERE I = '${monthString}'
     GROUP BY G
     ORDER BY G",
    0
  )`;

  sheet.getRange(currentRow, 1).setFormula(massFormula);

  // Format coverage % as percentage
  sheet.getRange(currentRow, 4, 100, 1).setNumberFormat('0%');

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
  sheet.getRange(currentRow, 5).setFormula(coverageStatusFormula);

  // Apply conditional formatting
  const coverageRange = sheet.getRange(currentRow, 5, 100, 1);
  const coverageRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Good')
      .setBackground('#D4EDDA')
      .setRanges([coverageRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Warning')
      .setBackground('#FFF3CD')
      .setRanges([coverageRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Critical')
      .setBackground('#F8D7DA')
      .setRanges([coverageRange])
      .build()
  ];
  sheet.setConditionalFormatRules(coverageRules);

  // Formatting
  sheet.setFrozenRows(4);
  sheet.autoResizeColumns(1, 5);

  // Delete unused columns (keep only 5 columns)
  deleteUnusedColumns(sheet, 5);
}

/**
 * Generate Unassigned Dashboard showing breakdown of unassigned roles.
 */
function generateUnassignedDashboard(sheet, monthString) {
  let currentRow = 1;

  // Title
  sheet.getRange(currentRow, 1).setValue('⚠️ UNASSIGNED ROLES DASHBOARD');
  sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setBackground('#1a73e8').setFontColor('white');
  sheet.getRange(currentRow, 1, 1, 2).merge();
  currentRow++;

  // Month info
  const monthName = HELPER_formatMonthYear(monthString);
  sheet.getRange(currentRow, 1).setValue(`Month: ${monthName}`);
  sheet.getRange(currentRow, 1).setFontWeight('bold');
  currentRow += 2;

  // Summary section
  sheet.getRange(currentRow, 1).setValue('Total Unassigned Roles:');
  sheet.getRange(currentRow, 1).setFontWeight('bold');

  const totalFormula = `=COUNTIFS(
    Assignments!$I$2:$I, "${monthString}",
    Assignments!$M$2:$M, "Unassigned"
  )`;
  sheet.getRange(currentRow, 2).setFormula(totalFormula);
  sheet.getRange(currentRow, 2).setFontWeight('bold').setFontSize(12).setBackground('#FFF3CD');
  currentRow += 3;

  // Breakdown by ministry
  sheet.getRange(currentRow, 1).setValue('Breakdown by Ministry:');
  sheet.getRange(currentRow, 1).setFontWeight('bold');
  currentRow++;

  // Headers
  const headers = ['Ministry', 'Unassigned Count'];
  sheet.getRange(currentRow, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(currentRow, 1, 1, headers.length).setFontWeight('bold').setBackground('#E8F0FE');
  currentRow++;

  // Formula: Count unassigned by ministry
  const unassignedFormula = `=QUERY(
    Assignments!$A$2:$M,
    "SELECT E, COUNT(E)
     WHERE I = '${monthString}'
       AND M = 'Unassigned'
       AND E <> ''
     GROUP BY E
     ORDER BY COUNT(E) DESC",
    0
  )`;

  sheet.getRange(currentRow, 1).setFormula(unassignedFormula);

  // Formatting
  sheet.setFrozenRows(7);
  sheet.autoResizeColumns(1, 2);

  // Delete unused columns (keep only 2 columns)
  deleteUnusedColumns(sheet, 2);
}

/**
 * Delete unused columns from a sheet, keeping only the specified number.
 * @param {Sheet} sheet - The sheet to modify
 * @param {number} columnsToKeep - Number of columns to keep (delete the rest)
 */
function deleteUnusedColumns(sheet, columnsToKeep) {
  const maxColumns = sheet.getMaxColumns();

  if (maxColumns > columnsToKeep) {
    const columnsToDelete = maxColumns - columnsToKeep;
    sheet.deleteColumns(columnsToKeep + 1, columnsToDelete);
  }
}

/**
 * Helper function to format month string as readable month name.
 * @param {string} monthString - Month in YYYY-MM format
 * @returns {string} Formatted month (e.g., "January 2026")
 */
function HELPER_formatMonthYear(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Test function for simplified dashboard generation.
 * Run this from the Apps Script editor to test the dashboard.
 */
function TEST_simplifiedDashboard() {
  try {
    // Change this to test different months
    const monthString = "2026-01";

    Logger.log('=== TESTING SIMPLIFIED DASHBOARD ===');
    Logger.log(`Month: ${monthString}`);

    const result = DASHBOARD_generateSimplified(monthString);

    Logger.log('✅ SUCCESS!');
    Logger.log(result);

    return result;

  } catch (e) {
    Logger.log('❌ ERROR:');
    Logger.log(e.message);
    Logger.log(e.stack);
    throw e;
  }
}
