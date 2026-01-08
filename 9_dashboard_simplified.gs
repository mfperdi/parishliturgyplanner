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
  // Get year and config from Config sheet
  const config = HELPER_readConfigSafe();
  const year = config["Year to Schedule"];
  const logoUrl = config['Logo URL'] || '';
  const parish = config['Parish Name'] || 'Parish';
  const ministry = config['Ministry Name'] || 'Ministry';

  if (!year) {
    throw new Error('Year to Schedule not configured in Config sheet');
  }

  let currentRow = 1;

  // === HEADER SECTION (matching monthly view format) ===

  // Logo: A1:A4 vertical merge
  try {
    const logoRange = sheet.getRange(1, 1, 4, 1);  // A1:A4
    logoRange.merge();
    logoRange.setHorizontalAlignment('center');
    logoRange.setVerticalAlignment('middle');

    if (logoUrl) {
      const imageFormula = `=IMAGE("${logoUrl}", 1)`;  // Mode 1 = fit to cell
      sheet.getRange(1, 1).setFormula(imageFormula);
    }
  } catch (e) {
    Logger.log(`Could not set up logo: ${e.message}`);
  }

  // Row 1, Columns B to O: Parish and Ministry Name
  const headerText = `${parish} - ${ministry}`;
  const headerRange = sheet.getRange(1, 2, 1, 14);  // B1:O1
  headerRange.merge();
  headerRange.setValue(headerText);
  headerRange.setFontSize(16)
              .setFontWeight('bold')
              .setHorizontalAlignment('left')
              .setVerticalAlignment('middle');

  // Row 2, Columns B to O: Dashboard title
  const titleText = `Annual Volunteer Summary - ${year}`;
  const titleRange = sheet.getRange(2, 2, 1, 14);  // B2:O2
  titleRange.merge();
  titleRange.setValue(titleText);
  titleRange.setFontSize(14)
            .setFontWeight('bold')
            .setHorizontalAlignment('left')
            .setVerticalAlignment('middle');

  // Row 3, Columns B to O: Description
  const descText = `Year-at-a-glance volunteer participation by month`;
  const descRange = sheet.getRange(3, 2, 1, 14);  // B3:O3
  descRange.merge();
  descRange.setValue(descText);
  descRange.setFontSize(11)
           .setFontWeight('normal')
           .setHorizontalAlignment('left')
           .setVerticalAlignment('middle');

  // Row 4, Columns B to O: Timestamp
  const timestamp = `Generated: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
  const timestampRange = sheet.getRange(4, 2, 1, 14);  // B4:O4
  timestampRange.merge();
  timestampRange.setValue(timestamp);
  timestampRange.setFontSize(10)
                .setFontStyle('italic')
                .setHorizontalAlignment('left')
                .setVerticalAlignment('middle');

  // Row 5 is blank, headers start at row 6
  currentRow = 6;

  // Headers
  const headers = ['Volunteer Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total', 'Avg'];
  sheet.getRange(currentRow, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(currentRow, 1, 1, headers.length).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
  currentRow++;

  // Get all Active volunteers from Volunteers sheet
  // Range D:I includes columns: D=Full Name, E=Email, F=Phone, G=Parent/Guardian, H=Family Team, I=Status
  const volunteersFormula = `=QUERY(
    Volunteers!$D$2:$I,
    "SELECT Col1 WHERE Col6 = 'Active' ORDER BY Col1",
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
  sheet.setFrozenRows(6); // Freeze header section and column headers (rows 1-6)

  // Set column widths: A=auto, B-O=30
  sheet.autoResizeColumns(1, 1); // Auto-resize column A (Volunteer Name)
  for (let col = 2; col <= 15; col++) {
    sheet.setColumnWidth(col, 30); // Columns B-O (Jan-Avg)
  }

  // Delete unused columns (keep only 15 columns: Name + 12 months + Total + Avg)
  deleteUnusedColumns(sheet, 15);
}

/**
 * Generate Mass Coverage Dashboard showing assignment coverage by mass.
 */
function generateMassCoverageDashboard(sheet, monthString) {
  // Get config from Config sheet
  const config = HELPER_readConfigSafe();
  const logoUrl = config['Logo URL'] || '';
  const parish = config['Parish Name'] || 'Parish';
  const ministry = config['Ministry Name'] || 'Ministry';

  let currentRow = 1;

  // === HEADER SECTION (matching monthly view format) ===

  // Logo: A1:A4 vertical merge
  try {
    const logoRange = sheet.getRange(1, 1, 4, 1);  // A1:A4
    logoRange.merge();
    logoRange.setHorizontalAlignment('center');
    logoRange.setVerticalAlignment('middle');

    if (logoUrl) {
      const imageFormula = `=IMAGE("${logoUrl}", 1)`;  // Mode 1 = fit to cell
      sheet.getRange(1, 1).setFormula(imageFormula);
    }
  } catch (e) {
    Logger.log(`Could not set up logo: ${e.message}`);
  }

  // Row 1, Columns B to E: Parish and Ministry Name
  const headerText = `${parish} - ${ministry}`;
  const headerRange = sheet.getRange(1, 2, 1, 4);  // B1:E1
  headerRange.merge();
  headerRange.setValue(headerText);
  headerRange.setFontSize(16)
              .setFontWeight('bold')
              .setHorizontalAlignment('left')
              .setVerticalAlignment('middle');

  // Row 2, Columns B to E: Dashboard title
  const monthName = HELPER_formatMonthYear(monthString);
  const titleText = `Mass Coverage Dashboard - ${monthName}`;
  const titleRange = sheet.getRange(2, 2, 1, 4);  // B2:E2
  titleRange.merge();
  titleRange.setValue(titleText);
  titleRange.setFontSize(14)
            .setFontWeight('bold')
            .setHorizontalAlignment('left')
            .setVerticalAlignment('middle');

  // Row 3, Columns B to E: Description
  const descText = `Volunteer preference coverage by Event ID`;
  const descRange = sheet.getRange(3, 2, 1, 4);  // B3:E3
  descRange.merge();
  descRange.setValue(descText);
  descRange.setFontSize(11)
           .setFontWeight('normal')
           .setHorizontalAlignment('left')
           .setVerticalAlignment('middle');

  // Row 4, Columns B to E: Timestamp
  const timestamp = `Generated: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
  const timestampRange = sheet.getRange(4, 2, 1, 4);  // B4:E4
  timestampRange.merge();
  timestampRange.setValue(timestamp);
  timestampRange.setFontSize(10)
                .setFontStyle('italic')
                .setHorizontalAlignment('left')
                .setVerticalAlignment('middle');

  // Row 5 is blank, headers start at row 6
  currentRow = 6;

  // Headers
  const headers = ['Event ID', 'Total Roles', 'Volunteers Preferring', 'Coverage Ratio', 'Status'];
  sheet.getRange(currentRow, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(currentRow, 1, 1, headers.length).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
  currentRow++;

  // Formula: Group assignments by Event ID - get Event ID and Total Roles
  const massFormula = `=QUERY(
    Assignments!$A$2:$M,
    "SELECT G, COUNT(G)
     WHERE I = '${monthString}'
     GROUP BY G
     ORDER BY G",
    0
  )`;

  sheet.getRange(currentRow, 1).setFormula(massFormula);

  // Column C: Count Active volunteers who prefer this Event ID
  // Use wildcard matching to find Event ID in comma-separated Preferred Mass Time field (Column L)
  const volunteersFormula = `=ARRAYFORMULA(
    IF(
      A${currentRow}:A = "",
      "",
      COUNTIFS(Volunteers!$I$2:$I, "Active", Volunteers!$L$2:$L, "*" & A${currentRow}:A & "*")
    )
  )`;
  sheet.getRange(currentRow, 3).setFormula(volunteersFormula);

  // Column D: Calculate coverage ratio (Volunteers/Roles)
  const coverageFormula = `=ARRAYFORMULA(
    IF(
      B${currentRow}:B = "",
      "",
      C${currentRow}:C / B${currentRow}:B
    )
  )`;
  sheet.getRange(currentRow, 4).setFormula(coverageFormula);

  // Format coverage ratio with 1 decimal place
  sheet.getRange(currentRow, 4, 100, 1).setNumberFormat('0.0');

  // Status column
  // Good: ≥ 2.0 volunteers per role, Warning: ≥ 1.0, Critical: < 1.0
  const coverageStatusFormula = `=ARRAYFORMULA(
    IF(
      D${currentRow}:D = "",
      "",
      IF(
        D${currentRow}:D >= 2.0,
        "Good ✓",
        IF(
          D${currentRow}:D >= 1.0,
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
  sheet.setFrozenRows(6); // Freeze header section and column headers (rows 1-6)
  sheet.autoResizeColumns(1, 5);

  // Delete unused columns (keep only 5 columns)
  deleteUnusedColumns(sheet, 5);
}

/**
 * Generate Unassigned Dashboard showing breakdown of unassigned roles.
 */
function generateUnassignedDashboard(sheet, monthString) {
  // Get config from Config sheet
  const config = HELPER_readConfigSafe();
  const logoUrl = config['Logo URL'] || '';
  const parish = config['Parish Name'] || 'Parish';
  const ministry = config['Ministry Name'] || 'Ministry';

  let currentRow = 1;

  // === HEADER SECTION (matching monthly view format) ===

  // Logo: A1:A4 vertical merge
  try {
    const logoRange = sheet.getRange(1, 1, 4, 1);  // A1:A4
    logoRange.merge();
    logoRange.setHorizontalAlignment('center');
    logoRange.setVerticalAlignment('middle');

    if (logoUrl) {
      const imageFormula = `=IMAGE("${logoUrl}", 1)`;  // Mode 1 = fit to cell
      sheet.getRange(1, 1).setFormula(imageFormula);
    }
  } catch (e) {
    Logger.log(`Could not set up logo: ${e.message}`);
  }

  // Row 1, Columns B to B: Parish and Ministry Name
  const headerText = `${parish} - ${ministry}`;
  const headerRange = sheet.getRange(1, 2, 1, 1);  // B1
  headerRange.setValue(headerText);
  headerRange.setFontSize(16)
              .setFontWeight('bold')
              .setHorizontalAlignment('left')
              .setVerticalAlignment('middle');

  // Row 2, Columns B to B: Dashboard title
  const monthName = HELPER_formatMonthYear(monthString);
  const titleText = `Unassigned Roles Dashboard - ${monthName}`;
  const titleRange = sheet.getRange(2, 2, 1, 1);  // B2
  titleRange.setValue(titleText);
  titleRange.setFontSize(14)
            .setFontWeight('bold')
            .setHorizontalAlignment('left')
            .setVerticalAlignment('middle');

  // Row 3, Columns B to B: Description
  const descText = `Breakdown of unassigned roles by ministry`;
  const descRange = sheet.getRange(3, 2, 1, 1);  // B3
  descRange.setValue(descText);
  descRange.setFontSize(11)
           .setFontWeight('normal')
           .setHorizontalAlignment('left')
           .setVerticalAlignment('middle');

  // Row 4, Columns B to B: Timestamp
  const timestamp = `Generated: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
  const timestampRange = sheet.getRange(4, 2, 1, 1);  // B4
  timestampRange.setValue(timestamp);
  timestampRange.setFontSize(10)
                .setFontStyle('italic')
                .setHorizontalAlignment('left')
                .setVerticalAlignment('middle');

  // Row 5 is blank, content starts at row 6
  currentRow = 6;

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
  sheet.getRange(currentRow, 1, 1, headers.length).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
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
