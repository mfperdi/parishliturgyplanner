/**
 * ====================================================================
 * MONTHLY ASSIGNMENTS VIEW
 * ====================================================================
 * Generates a per-month editable sheet (e.g. "April 2026") that serves
 * as both the editing surface AND the print output.
 *
 * Layout (10 columns):
 *   A  Date          — protected (schedule structure)
 *   B  Time          — protected
 *   C  Description   — protected
 *   D  Ministry      — protected
 *   E  Role          — protected
 *   F  Volunteer     — EDITABLE (user types name here)
 *   G  Qualified?    — live formula (✓/✗)
 *   H  Active?       — live formula (✓/⚠️)
 *   I  Free?         — live formula (✓/⚠️)
 *   J  _row          — HIDDEN, stores Assignments sheet row # for sync
 *
 * The onEdit handler in 0d_onedit.gs watches Column F of these sheets
 * and syncs changes back to the Assignments sheet automatically.
 */

/**
 * Generates (or regenerates) the monthly assignments view sheet.
 * Called from sidebar or wrapper function.
 *
 * @param {string} monthString  e.g. "2026-04"
 * @returns {string} Success message
 */
function MONTHLY_generateAssignmentsView(monthString) {
  try {
    const { year, month } = HELPER_validateMonthString(monthString);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const displayName = HELPER_formatDate(new Date(year, month - 1, 1, 12), 'month-year'); // e.g. "April 2026"

    // --- Warn before overwriting existing sheet ---
    let targetSheet = ss.getSheetByName(displayName);
    if (targetSheet) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Sheet Already Exists',
        `"${displayName}" already exists. Regenerating will overwrite any manual edits in that sheet.\n\nThe Assignments sheet (backend data) is not affected.\n\nContinue?`,
        ui.ButtonSet.YES_NO
      );
      if (response !== ui.Button.YES) {
        return 'Cancelled — existing sheet was not changed.';
      }
      // Remove protection before clearing so we can recreate it
      const protections = targetSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      protections.forEach(p => p.remove());
      targetSheet.clear();
      targetSheet.setFrozenRows(0);
      targetSheet.setFrozenColumns(0);
    } else {
      targetSheet = ss.insertSheet(displayName);
    }

    // --- Read Assignments sheet data for this month ---
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (!assignmentsSheet) {
      throw new Error('Assignments sheet not found. Please generate the schedule first (Step 4).');
    }

    const allAssignmentData = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

    // Build list of assignments for this month, keeping their original row numbers
    const monthAssignments = [];
    for (let i = 1; i < allAssignmentData.length; i++) {
      const row = allAssignmentData[i];
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];

      let matches = false;
      if (typeof rowMonthYear === 'string') {
        matches = rowMonthYear === monthString;
      } else if (rowMonthYear instanceof Date && !isNaN(rowMonthYear.getTime())) {
        const y = rowMonthYear.getFullYear();
        const m = String(rowMonthYear.getMonth() + 1).padStart(2, '0');
        matches = `${y}-${m}` === monthString;
      }

      if (matches && row[assignCols.DATE - 1]) {
        const dateVal = row[assignCols.DATE - 1];
        const timeVal = row[assignCols.TIME - 1];

        let date = dateVal instanceof Date ? dateVal : new Date(dateVal);
        let time;
        if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
          time = timeVal;
        } else if (timeVal) {
          time = new Date(timeVal);
          if (isNaN(time.getTime())) {
            time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
          }
        } else {
          time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        }

        monthAssignments.push({
          sheetRow: i + 1,  // 1-indexed (header is row 1, data starts row 2)
          date: date,
          time: time,
          description: HELPER_safeArrayAccess(row, assignCols.DESCRIPTION - 1, ''),
          liturgicalCelebration: HELPER_safeArrayAccess(row, assignCols.LITURGICAL_CELEBRATION - 1, ''),
          ministry: HELPER_safeArrayAccess(row, assignCols.MINISTRY - 1, ''),
          role: HELPER_safeArrayAccess(row, assignCols.ROLE - 1, ''),
          eventId: HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1, ''),
          isAnticipated: HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1, false),
          assignedGroup: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_GROUP - 1, ''),
          assignedVolunteerName: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_NAME - 1, ''),
          status: HELPER_safeArrayAccess(row, assignCols.STATUS - 1, 'Unassigned')
        });
      }
    }

    if (monthAssignments.length === 0) {
      ss.deleteSheet(targetSheet);
      throw new Error(`No assignments found for ${displayName}. Please generate the schedule first (Step 4).`);
    }

    // Sort by date, then time, then role
    monthAssignments.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      const timeDiff = a.time.getTime() - b.time.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.role.localeCompare(b.role);
    });

    // --- Build liturgical data map for celebration info ---
    const liturgicalData = buildLiturgicalDataMap(monthString);

    // --- Write header (reuse existing print header logic) ---
    const scheduleData = {
      assignments: monthAssignments,
      liturgicalData: liturgicalData,
      liturgicalNotes: new Map(),
      parishName: '',
      printConfig: {}
    };

    const numColumns = 10; // A through J
    let currentRow = createScheduleHeader(targetSheet, scheduleData, displayName, { includeColors: true, showRankInfo: true }, numColumns);

    // --- Write content grouped by liturgical celebration ---
    currentRow = MONTHLY_writeContent(targetSheet, monthAssignments, liturgicalData, currentRow);

    // --- Apply protection: protect A-E and G-J, leave F editable ---
    MONTHLY_applyProtection(targetSheet, currentRow - 1);

    // --- Hide column J (row mapping) ---
    targetSheet.hideColumns(CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW.ASSIGNMENTS_ROW);

    // --- Freeze header rows ---
    targetSheet.setFrozenRows(5);

    // --- Auto-resize visible columns ---
    targetSheet.autoResizeColumns(1, 9); // A through I (J is hidden)

    // Set a reasonable width for the volunteer column (F)
    targetSheet.setColumnWidth(CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW.VOLUNTEER, 180);

    // Set narrow widths for formula helper columns
    targetSheet.setColumnWidth(CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW.QUALIFIED, 80);
    targetSheet.setColumnWidth(CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW.ACTIVE, 70);
    targetSheet.setColumnWidth(CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW.FREE, 70);

    // --- Navigate to the new sheet ---
    ss.setActiveSheet(targetSheet);

    Logger.log(`Monthly assignments view created: "${displayName}" with ${monthAssignments.length} assignment rows`);
    return `"${displayName}" sheet created with ${monthAssignments.length} assignments. Edit volunteer names in Column F — changes sync automatically to the Assignments sheet.`;

  } catch (e) {
    Logger.log(`Error in MONTHLY_generateAssignmentsView: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    throw new Error(`Could not generate monthly assignments view: ${e.message}`);
  }
}

/**
 * Writes the editable assignment rows grouped by liturgical celebration.
 * Each row includes a hidden column J with the Assignments sheet row number.
 *
 * @param {Sheet} sheet  Target sheet
 * @param {Array} assignments  Sorted assignment objects (include .sheetRow)
 * @param {Map} liturgicalData  From buildLiturgicalDataMap()
 * @param {number} startRow  Row to start writing at
 * @returns {number} Next available row
 */
function MONTHLY_writeContent(sheet, assignments, liturgicalData, startRow) {
  const viewCols = CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW;
  let currentRow = startRow;

  // Group by liturgical celebration in chronological order
  const celebrationOrder = [];
  const assignmentsByCelebration = new Map();

  for (const assignment of assignments) {
    const cel = assignment.liturgicalCelebration || '(Unknown)';
    if (!assignmentsByCelebration.has(cel)) {
      assignmentsByCelebration.set(cel, []);
      celebrationOrder.push(cel);
    }
    assignmentsByCelebration.get(cel).push(assignment);
  }

  for (const celebration of celebrationOrder) {
    const celebrationAssignments = assignmentsByCelebration.get(celebration);
    const liturgyInfo = liturgicalData.get(celebration);

    // --- Celebration header row ---
    const bgColor = (liturgyInfo && liturgyInfo.color)
      ? HELPER_getLiturgicalColorHex(liturgyInfo.color, {})
      : '#d9ead3';

    const headerRange = sheet.getRange(currentRow, 1, 1, 10);
    headerRange.merge();
    headerRange.setValue(celebration);
    headerRange.setFontSize(13).setFontWeight('bold');
    headerRange.setBackground(bgColor);
    currentRow++;

    // --- Rank info row ---
    if (liturgyInfo) {
      const rankInfo = `${liturgyInfo.rank} • ${liturgyInfo.season} • ${liturgyInfo.color}`;
      const rankRange = sheet.getRange(currentRow, 1, 1, 10);
      rankRange.merge();
      rankRange.setValue(rankInfo);
      rankRange.setFontSize(10).setFontStyle('italic').setBackground(bgColor);
      currentRow++;
    }

    // --- Table header row ---
    const tableHeaders = [
      ['Date', 'Time', 'Description', 'Ministry', 'Role', 'Assigned Volunteer', 'Qualified?', 'Active?', 'Free?', '_row']
    ];
    sheet.getRange(currentRow, 1, 1, 10).setValues(tableHeaders);
    const headerRowRange = sheet.getRange(currentRow, 1, 1, 9); // Don't style hidden col
    headerRowRange.setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    headerRowRange.setBorder(true, true, true, true, true, true);
    currentRow++;

    // --- Group assignments by mass (date + time + description) ---
    const massByKey = new Map();
    for (const a of celebrationAssignments) {
      const key = `${a.date.toDateString()}_${a.time.toTimeString()}_${a.description}`;
      if (!massByKey.has(key)) {
        massByKey.set(key, { date: a.date, time: a.time, description: a.description, rows: [] });
      }
      massByKey.get(key).rows.push(a);
    }

    // Sort masses within celebration chronologically
    const sortedMasses = Array.from(massByKey.values()).sort((a, b) => {
      const d = a.date.getTime() - b.date.getTime();
      return d !== 0 ? d : a.time.getTime() - b.time.getTime();
    });

    // --- Build all row data for this celebration (batch write) ---
    const rowData = [];
    const rowMeta = []; // {sheetRow, isUnassigned, massIndex, isFirstInMass}

    let massIndex = 0;
    for (const mass of sortedMasses) {
      // Sort roles within mass
      mass.rows.sort((a, b) => a.role.localeCompare(b.role));

      for (let i = 0; i < mass.rows.length; i++) {
        const a = mass.rows[i];
        const volunteerName = (a.assignedVolunteerName && a.assignedVolunteerName !== 'UNASSIGNED')
          ? a.assignedVolunteerName : '';

        // Build formula strings for columns G, H, I
        // These reference the Volunteers and Timeoffs sheets for live eligibility checking
        const rowNum = currentRow + rowData.length; // Actual sheet row this will land on
        const qualifiedFormula = MONTHLY_buildQualifiedFormula(rowNum);
        const activeFormula = MONTHLY_buildActiveFormula(rowNum);
        const freeFormula = MONTHLY_buildFreeFormula(rowNum);

        rowData.push([
          i === 0 ? a.date : '',      // A: Date (only on first role per mass)
          i === 0 ? HELPER_formatTime(a.time) : '',  // B: Time
          i === 0 ? a.description : '',              // C: Description
          a.ministry,                 // D: Ministry
          a.role,                     // E: Role
          volunteerName,              // F: Volunteer (editable)
          qualifiedFormula,           // G: Qualified? (formula)
          activeFormula,              // H: Active? (formula)
          freeFormula,                // I: Free? (formula)
          a.sheetRow                  // J: Hidden row mapping
        ]);

        rowMeta.push({
          sheetRow: a.sheetRow,
          isUnassigned: !volunteerName,
          massIndex: massIndex,
          isFirstInMass: i === 0,
          date: a.date
        });
      }
      massIndex++;
    }

    // Write all rows for this celebration in one batch
    if (rowData.length > 0) {
      // Write non-formula columns first (A-F, J)
      const nonFormulaData = rowData.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], '', '', '', r[9]]);
      sheet.getRange(currentRow, 1, rowData.length, 10).setValues(nonFormulaData);

      // Write formula columns one by one (setFormula per cell)
      for (let i = 0; i < rowData.length; i++) {
        const sheetRowNum = currentRow + i;
        sheet.getRange(sheetRowNum, viewCols.QUALIFIED).setFormula(rowData[i][6]);
        sheet.getRange(sheetRowNum, viewCols.ACTIVE).setFormula(rowData[i][7]);
        sheet.getRange(sheetRowNum, viewCols.FREE).setFormula(rowData[i][8]);
      }

      // Apply borders
      sheet.getRange(currentRow, 1, rowData.length, 9).setBorder(true, true, true, true, false, false);

      // Apply date format and row backgrounds
      for (let i = 0; i < rowMeta.length; i++) {
        const actualRow = currentRow + i;
        const meta = rowMeta[i];

        if (meta.isFirstInMass) {
          sheet.getRange(actualRow, 1).setNumberFormat('M/d/yyyy');
        }

        // Background: unassigned = pink, otherwise alternating
        const bgRowColor = meta.isUnassigned
          ? '#fce8e6'
          : meta.massIndex % 2 === 0 ? '#ffffff' : '#f3f3f3';

        sheet.getRange(actualRow, 1, 1, 9).setBackground(bgRowColor);

        // Center-align the formula helper columns
        sheet.getRange(actualRow, viewCols.QUALIFIED, 1, 3).setHorizontalAlignment('center');
      }

      currentRow += rowData.length;
    }

    currentRow++; // Spacer between celebrations
  }

  return currentRow;
}

/**
 * Builds the "Qualified?" formula for a given sheet row.
 * Checks if volunteer in col F has the required ministry (col D) or role (col E).
 */
function MONTHLY_buildQualifiedFormula(rowNum) {
  const f = rowNum; // Row number in this sheet
  return `=IF(F${f}="","",IF(ISERROR(MATCH(F${f},Volunteers!D:D,0)),IF(J${f}<>"","Group","⚠️ NOT FOUND"),IF(OR(NOT(ISERROR(SEARCH(D${f},INDEX(Volunteers!J:J,MATCH(F${f},Volunteers!D:D,0))))),NOT(ISERROR(SEARCH(E${f},INDEX(Volunteers!K:K,MATCH(F${f},Volunteers!D:D,0)))))),\"✓\",\"✗\")))`;
}

/**
 * Builds the "Active?" formula for a given sheet row.
 * Checks if the volunteer's status is "Active".
 */
function MONTHLY_buildActiveFormula(rowNum) {
  const f = rowNum;
  return `=IF(F${f}="","",IF(ISERROR(MATCH(F${f},Volunteers!D:D,0)),IF(J${f}<>"","Group","⚠️ NOT FOUND"),IF(INDEX(Volunteers!I:I,MATCH(F${f},Volunteers!D:D,0))="Active","✓","⚠️ "&INDEX(Volunteers!I:I,MATCH(F${f},Volunteers!D:D,0)))))`;
}

/**
 * Builds the "Free?" formula for a given sheet row.
 * Checks for approved timeoff conflicts (blacklist / whitelist).
 */
function MONTHLY_buildFreeFormula(rowNum) {
  const f = rowNum;
  const blacklistType = CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE;    // "I CANNOT serve these dates"
  const whitelistType = CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE;   // "I can ONLY serve these dates"

  return `=IF(F${f}="","",IF(J${f}<>"","Group",IF(SUMPRODUCT((Timeoffs!B:B=F${f})*(Timeoffs!G:G="Approved")*(Timeoffs!C:C="${blacklistType}")*(Timeoffs!F:F=TEXT(A${f},"MMMM YYYY"))*(ISNUMBER(SEARCH(TEXT(A${f},"M/D/YYYY"),Timeoffs!D:D))))>0,"⚠️ BLACKLIST",IF(AND(SUMPRODUCT((Timeoffs!B:B=F${f})*(Timeoffs!G:G="Approved")*(Timeoffs!C:C="${whitelistType}")*(Timeoffs!F:F=TEXT(A${f},"MMMM YYYY")))>0,SUMPRODUCT((Timeoffs!B:B=F${f})*(Timeoffs!G:G="Approved")*(Timeoffs!C:C="${whitelistType}")*(Timeoffs!F:F=TEXT(A${f},"MMMM YYYY"))*(ISNUMBER(SEARCH(TEXT(A${f},"M/D/YYYY"),Timeoffs!D:D))))=0),"⚠️ NOT ON WHITELIST","✓"))))`;
}

/**
 * Protects the schedule structure columns (A-E, G-J), leaving F (Volunteer) editable.
 * Also protects header rows 1-5.
 *
 * @param {Sheet} sheet  The monthly assignments sheet
 * @param {number} lastDataRow  Last row with data
 */
function MONTHLY_applyProtection(sheet, lastDataRow) {
  try {
    // Protect header rows 1-5
    const headerProtection = sheet.getRange(1, 1, 5, 10).protect();
    headerProtection.setDescription('Schedule header — do not edit');
    headerProtection.setWarningOnly(true);

    // Protect columns A-E (Date through Role) for data rows
    if (lastDataRow >= 6) {
      const structureProtection = sheet.getRange(6, 1, lastDataRow - 5, 5).protect();
      structureProtection.setDescription('Schedule structure — edit via Assignments sheet');
      structureProtection.setWarningOnly(true);

      // Protect G-J (formulas + hidden row mapping)
      const formulaProtection = sheet.getRange(6, 7, lastDataRow - 5, 4).protect();
      formulaProtection.setDescription('Helper formulas — auto-calculated');
      formulaProtection.setWarningOnly(true);
    }

    Logger.log('Protection applied (warning mode) to structure and formula columns');
  } catch (e) {
    // Protection is nice-to-have, not critical
    Logger.log(`Could not apply protection: ${e.message}`);
  }
}

/**
 * Toggles print mode on a monthly assignments sheet.
 * Print mode hides helper columns G-J for a clean printout.
 * Calling again restores them.
 *
 * @param {string} sheetName  e.g. "April 2026"
 * @returns {string} Status message
 */
function MONTHLY_togglePrintMode(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = sheetName
      ? ss.getSheetByName(sheetName)
      : ss.getActiveSheet();

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }

    const viewCols = CONSTANTS.COLS.MONTHLY_ASSIGNMENTS_VIEW;

    // Check current state of column G (first helper column)
    const isHidden = sheet.isColumnHiddenByUser(viewCols.QUALIFIED);

    if (isHidden) {
      // Restore editing mode — show G, H, I (J stays hidden)
      sheet.showColumns(viewCols.QUALIFIED, 3);
      return `Editing mode restored on "${sheet.getName()}". Columns G-I (helper formulas) are visible.`;
    } else {
      // Enter print mode — hide G, H, I, J
      sheet.hideColumns(viewCols.QUALIFIED, 4);
      return `Print mode enabled on "${sheet.getName()}". Columns G-J hidden. Use File > Print or File > Download > PDF.`;
    }
  } catch (e) {
    Logger.log(`Error in MONTHLY_togglePrintMode: ${e.message}`);
    throw new Error(`Could not toggle print mode: ${e.message}`);
  }
}

/**
 * Returns the name of the currently active sheet if it looks like a monthly
 * assignments view sheet (matches "Month YYYY" pattern).
 * Used by the sidebar to determine the active monthly sheet name.
 *
 * @returns {string|null} Sheet name or null
 */
function MONTHLY_getActiveSheetName() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const name = sheet.getName();
    // Match patterns like "April 2026", "December 2025", etc.
    if (/^[A-Za-z]+ \d{4}$/.test(name)) {
      return name;
    }
    return null;
  } catch (e) {
    return null;
  }
}
