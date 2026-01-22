/**
 * ====================================================================
 * HELPER FORMULAS SETUP - Assignment Sheet Helper Columns
 * ====================================================================
 *
 * Adds pure Google Sheets formulas to columns N-P of Assignments sheet
 * to help with manual volunteer assignments.
 *
 * Column N: Qualified? - Checks if volunteer has required ministry/role
 * Column O: Active? - Checks if volunteer status is "Active"
 * Column P: Free? - Checks for timeoff conflicts
 */

/**
 * Main function to setup or refresh helper formulas in Assignments sheet.
 * Adds formulas to columns N, O, P starting from row 2 (after header).
 *
 * @returns {string} Success message with count of rows updated
 */
function HELPER_FORMULAS_setup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!sheet) {
      throw new Error("Assignments sheet not found. Generate schedule first.");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error("No assignments found. Generate schedule first.");
    }

    // Column numbers for helper columns (N=14, O=15, P=16)
    const COL_QUALIFIED = 14;
    const COL_ACTIVE = 15;
    const COL_FREE = 16;

    // Add or update header row
    sheet.getRange(1, COL_QUALIFIED).setValue("Qualified?");
    sheet.getRange(1, COL_ACTIVE).setValue("Active?");
    sheet.getRange(1, COL_FREE).setValue("Free?");

    // Build formulas for row 2 (will be copied down)
    const qualifiedFormula = buildQualifiedFormula(2);
    const activeFormula = buildActiveFormula(2);
    const freeFormula = buildFreeFormula(2);

    Logger.log("Adding helper formulas to Assignments sheet...");
    Logger.log(`  Qualified formula: ${qualifiedFormula}`);
    Logger.log(`  Active formula: ${activeFormula}`);
    Logger.log(`  Free formula: ${freeFormula}`);

    // Set formulas in row 2
    sheet.getRange(2, COL_QUALIFIED).setFormula(qualifiedFormula);
    sheet.getRange(2, COL_ACTIVE).setFormula(activeFormula);
    sheet.getRange(2, COL_FREE).setFormula(freeFormula);

    // Copy formulas down to all data rows
    if (lastRow > 2) {
      const sourceRange = sheet.getRange(2, COL_QUALIFIED, 1, 3);
      const targetRange = sheet.getRange(3, COL_QUALIFIED, lastRow - 2, 3);
      sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    }

    // Format columns
    sheet.getRange(2, COL_QUALIFIED, lastRow - 1, 3).setHorizontalAlignment("center");
    sheet.getRange(1, COL_QUALIFIED, 1, 3).setFontWeight("bold").setBackground("#f3f3f3");

    // Auto-resize columns
    sheet.autoResizeColumn(COL_QUALIFIED);
    sheet.autoResizeColumn(COL_ACTIVE);
    sheet.autoResizeColumn(COL_FREE);

    const rowCount = lastRow - 1;
    return `✓ Helper formulas added to ${rowCount} rows in Assignments sheet (columns N-P)`;

  } catch (e) {
    Logger.log(`ERROR in HELPER_FORMULAS_setup: ${e.message}`);
    throw new Error(`Failed to setup helper formulas: ${e.message}`);
  }
}

/**
 * Builds the "Qualified?" formula for a given row.
 * Checks if volunteer has the required ministry (column E) OR role (column F).
 *
 * Logic:
 * - If no volunteer assigned (L is blank) → return blank
 * - Find volunteer in Volunteers sheet by name (column D)
 * - Check if ministry (E) appears in volunteer's MINISTRIES (column J)
 * - OR check if role (F) appears in volunteer's ROLES (column K)
 * - Return ✓ if qualified, ✗ if not qualified
 *
 * @param {number} row - Row number for the formula
 * @returns {string} Google Sheets formula
 */
function buildQualifiedFormula(row) {
  return `=IF(L${row}="", "", ` +
    `IF(ISERROR(MATCH(L${row}, Volunteers!D:D, 0)), "⚠️ NOT FOUND", ` +
    `IF(OR(` +
      `NOT(ISERROR(SEARCH(E${row}, INDEX(Volunteers!J:J, MATCH(L${row}, Volunteers!D:D, 0))))), ` +
      `NOT(ISERROR(SEARCH(F${row}, INDEX(Volunteers!K:K, MATCH(L${row}, Volunteers!D:D, 0)))))` +
    `), "✓", "✗")))`;
}

/**
 * Builds the "Active?" formula for a given row.
 * Checks if volunteer status is "Active".
 *
 * Logic:
 * - If no volunteer assigned (L is blank) → return blank
 * - Find volunteer in Volunteers sheet by name (column D)
 * - Get status from column I
 * - Return ✓ if "Active", otherwise show warning with actual status
 *
 * @param {number} row - Row number for the formula
 * @returns {string} Google Sheets formula
 */
function buildActiveFormula(row) {
  return `=IF(L${row}="", "", ` +
    `IF(ISERROR(MATCH(L${row}, Volunteers!D:D, 0)), "⚠️ NOT FOUND", ` +
    `IF(INDEX(Volunteers!I:I, MATCH(L${row}, Volunteers!D:D, 0))="Active", "✓", ` +
    `"⚠️ " & INDEX(Volunteers!I:I, MATCH(L${row}, Volunteers!D:D, 0)))))`;
}

/**
 * Builds the "Free?" formula for a given row.
 * Checks for approved timeoff conflicts.
 *
 * Logic:
 * - If no volunteer assigned (L is blank) → return blank
 * - Search Timeoffs sheet for approved timeoffs (status = "Approved")
 * - Check if volunteer name matches (column B in Timeoffs)
 * - Check if mass date (A) appears in SELECTED_DATES (column D in Timeoffs)
 * - If any approved timeoffs found containing this date → show warning
 * - Otherwise → show ✓
 *
 * Note: This is a simplified check. Admin should manually verify:
 * - Whether it's a blacklist ("I CANNOT serve") or whitelist ("I can ONLY serve")
 * - Whether vigil vs non-vigil mass type matters
 * - Exact date matching and date range parsing
 *
 * @param {number} row - Row number for the formula
 * @returns {string} Google Sheets formula
 */
function buildFreeFormula(row) {
  // Use SUMPRODUCT to count approved timeoffs that contain this date
  return `=IF(L${row}="", "", ` +
    `IF(SUMPRODUCT(` +
      `(Timeoffs!B:B=L${row})*` +  // Volunteer name matches
      `(Timeoffs!G:G="Approved")*` +  // Status is Approved
      `(ISNUMBER(SEARCH(TEXT(A${row},"M/D/YYYY"),Timeoffs!D:D)))` +  // Date appears in SELECTED_DATES
    `)>0, "⚠️ CHECK TIMEOFFS", "✓"))`;
}

/**
 * Wrapper function for menu item.
 * Shows user-friendly success/error messages.
 */
function setupAssignmentHelperFormulas() {
  try {
    const result = HELPER_FORMULAS_setup();
    HELPER_showSuccess('Helper Formulas Setup', result);
  } catch (e) {
    HELPER_showError('Helper Formulas Setup Failed', e, 'assignment');
    throw e;
  }
}

/**
 * Test function to verify formula logic.
 * Run from Script Editor to test without modifying sheet.
 */
function TEST_helperFormulas() {
  Logger.log("=== Testing Helper Formula Generation ===");

  Logger.log("\n--- Qualified Formula (Row 2) ---");
  Logger.log(buildQualifiedFormula(2));

  Logger.log("\n--- Active Formula (Row 2) ---");
  Logger.log(buildActiveFormula(2));

  Logger.log("\n--- Free Formula (Row 2) ---");
  Logger.log(buildFreeFormula(2));

  Logger.log("\n--- Testing formula setup (dry run) ---");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  if (!sheet) {
    Logger.log("ERROR: Assignments sheet not found");
    return "ERROR: No Assignments sheet";
  }

  const lastRow = sheet.getLastRow();
  Logger.log(`Assignments sheet has ${lastRow} rows (including header)`);
  Logger.log(`Would add formulas to rows 2-${lastRow}`);

  return "Test complete - check logs for formula details";
}
