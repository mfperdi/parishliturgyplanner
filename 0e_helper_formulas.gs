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
 * - If not found in Volunteers sheet:
 *   - Check if J (Assigned Group) has a value → return "Group"
 *   - Otherwise → return "⚠️ NOT FOUND"
 * - Check if ministry (E) appears in volunteer's MINISTRIES (column J)
 * - OR check if role (F) appears in volunteer's ROLES (column K)
 * - Return ✓ if qualified, ✗ if not qualified
 *
 * @param {number} row - Row number for the formula
 * @returns {string} Google Sheets formula
 */
function buildQualifiedFormula(row) {
  return `=IF(L${row}="", "", ` +
    `IF(ISERROR(MATCH(L${row}, Volunteers!D:D, 0)), ` +
      `IF(J${row}<>"", "Group", "⚠️ NOT FOUND"), ` +
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
 * - If not found in Volunteers sheet:
 *   - Check if J (Assigned Group) has a value → return "Group"
 *   - Otherwise → return "⚠️ NOT FOUND"
 * - Get status from column I
 * - Return ✓ if "Active", otherwise show warning with actual status
 *
 * @param {number} row - Row number for the formula
 * @returns {string} Google Sheets formula
 */
function buildActiveFormula(row) {
  return `=IF(L${row}="", "", ` +
    `IF(ISERROR(MATCH(L${row}, Volunteers!D:D, 0)), ` +
      `IF(J${row}<>"", "Group", "⚠️ NOT FOUND"), ` +
    `IF(INDEX(Volunteers!I:I, MATCH(L${row}, Volunteers!D:D, 0))="Active", "✓", ` +
    `"⚠️ " & INDEX(Volunteers!I:I, MATCH(L${row}, Volunteers!D:D, 0)))))`;
}

/**
 * Builds the "Free?" formula for a given row.
 * Checks for approved timeoff conflicts with proper blacklist/whitelist handling.
 *
 * Logic:
 * - If no volunteer assigned (L is blank) → return blank
 * - If J (Assigned Group) has a value → return "Group" (group assignments don't have individual timeoffs)
 * - Check BLACKLIST: Count approved timeoffs where TYPE = "I CANNOT serve these dates"
 *   AND date appears in SELECTED_DATES AND SCHEDULING_PERIOD matches
 *   - If found → return "⚠️ BLACKLIST"
 * - Check WHITELIST: Count approved timeoffs where TYPE = "I can ONLY serve these dates"
 *   AND SCHEDULING_PERIOD matches
 *   - If whitelist exists for this period AND date NOT in SELECTED_DATES → return "⚠️ NOT ON WHITELIST"
 * - Otherwise → return "✓"
 *
 * This properly handles:
 * - Group assignments: Shows "Group" (no individual timeoff checking)
 * - Blacklists: Warns when volunteer said they CANNOT serve this date (in this period)
 * - Whitelists: Warns when volunteer has whitelist for this period but this date is NOT on it
 * - No timeoffs: Shows ✓ (available)
 * - Period-limited whitelists: Only applies whitelist if SCHEDULING_PERIOD matches assignment date's month
 *
 * Implementation Notes:
 * - Uses COUNTIFS with wildcard matching ("*"&date&"*") instead of SEARCH in SUMPRODUCT
 * - SEARCH inside SUMPRODUCT with column ranges is unreliable in Google Sheets
 * - COUNTIFS properly handles text search across all rows and is more efficient
 *
 * Limitations:
 * - Doesn't account for vigil vs non-vigil mass type distinctions (relies on notes field)
 * - Uses simple substring matching for dates (good for standard M/D/YYYY format)
 *
 * @param {number} row - Row number for the formula
 * @returns {string} Google Sheets formula
 */
function buildFreeFormula(row) {
  // Complex logic with COUNTIFS checks that include SCHEDULING_PERIOD matching
  // Timeoffs sheet column F contains SCHEDULING_PERIOD (e.g., "February 2026")
  // Assignment date (column A) is converted to same format using TEXT(A, "MMMM YYYY")
  //
  // FIXED: Replaced SUMPRODUCT+SEARCH (unreliable with column ranges) with COUNTIFS+wildcards

  return `=IF(L${row}="", "", ` +
    `IF(J${row}<>"", "Group", ` +
    // Check 1: Blacklist conflict (date appears in "I CANNOT serve" list for this period)
    `IF(COUNTIFS(` +
      `Timeoffs!B:B,L${row},` +
      `Timeoffs!G:G,"Approved",` +
      `Timeoffs!C:C,"I CANNOT serve these dates",` +
      `Timeoffs!F:F,TEXT(A${row},"MMMM YYYY"),` +  // SCHEDULING_PERIOD matches
      `Timeoffs!D:D,"*"&TEXT(A${row},"M/D/YYYY")&"*"` +  // Date found using wildcard
    `)>0, "⚠️ BLACKLIST", ` +
    // Check 2: Whitelist exists for this period but date not on it
    `IF(AND(` +
      // Has whitelist for this scheduling period
      `COUNTIFS(Timeoffs!B:B,L${row},Timeoffs!G:G,"Approved",Timeoffs!C:C,"I can ONLY serve these dates",Timeoffs!F:F,TEXT(A${row},"MMMM YYYY"))>0, ` +
      // Date NOT in whitelist (using wildcard match)
      `COUNTIFS(Timeoffs!B:B,L${row},Timeoffs!G:G,"Approved",Timeoffs!C:C,"I can ONLY serve these dates",Timeoffs!F:F,TEXT(A${row},"MMMM YYYY"),Timeoffs!D:D,"*"&TEXT(A${row},"M/D/YYYY")&"*")=0` +
    `), "⚠️ NOT ON WHITELIST", "✓"))))`;
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
