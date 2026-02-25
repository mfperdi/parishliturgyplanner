/**
 * ====================================================================
 * ONEDIT TRIGGER - REAL-TIME ASSIGNMENT VALIDATION
 * ====================================================================
 * This file implements real-time validation when manually assigning
 * volunteers in the Assignments sheet. It validates against:
 * - Volunteer status (must be Active)
 * - Ministry role and skill requirements
 * - Timeoff conflicts (blacklist/whitelist)
 *
 * Warnings allow overrides with confirmation and documentation.
 *
 * NOTE: Compatible with Google Sheets typed columns.
 */

/**
 * Safely writes a value to a cell, handling typed columns
 * @param {Range} range - The range to write to
 * @param {*} value - The value to write
 * @returns {boolean} True if successful, false otherwise
 */
function ONEDIT_safeSetValue(range, value) {
  try {
    // Convert to string for text-typed columns
    const stringValue = value !== null && value !== undefined ? String(value) : "";
    range.setValue(stringValue);
    return true;
  } catch (e) {
    Logger.log(`Warning: Could not write to cell (typed column?): ${e.message}`);
    try {
      // Fallback: try with setValues() and 2D array
      range.setValues([[String(value || "")]]);
      return true;
    } catch (e2) {
      Logger.log(`Error: Both setValue and setValues failed: ${e2.message}`);
      return false;
    }
  }
}

/**
 * Safely clears a cell, handling typed columns
 * @param {Range} range - The range to clear
 * @returns {boolean} True if successful, false otherwise
 */
function ONEDIT_safeClearContent(range) {
  try {
    range.clearContent();
    return true;
  } catch (e) {
    Logger.log(`Warning: Could not clear cell (typed column?): ${e.message}`);
    try {
      // Fallback: set to empty string
      range.setValue("");
      return true;
    } catch (e2) {
      Logger.log(`Error: Both clearContent and setValue failed: ${e2.message}`);
      return false;
    }
  }
}

/**
 * Main onEdit trigger function
 * Automatically runs when any cell in the spreadsheet is edited
 * @param {object} e - Edit event object
 */
function onEdit(e) {
  try {
    // Only process if we have an event object
    if (!e || !e.range) return;

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    const row = e.range.getRow();
    const col = e.range.getColumn();

    // Handle write-back from view sheets (not the Assignments sheet itself)
    if (sheetName !== CONSTANTS.SHEETS.ASSIGNMENTS) {
      ONEDIT_handleViewSheetEdit(e, sheet, row, col);
      return;
    }

    // Only validate edits in Assignments sheet
    if (sheetName !== CONSTANTS.SHEETS.ASSIGNMENTS) return;

    // Only validate when Volunteer ID or Name columns are edited
    const volIdCol = CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_ID;
    const volNameCol = CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_NAME;

    if (col !== volIdCol && col !== volNameCol) return;

    // Skip header row
    if (row === 1) return;

    // Get the edited value
    const editedValue = e.value || "";

    // If cell was cleared, clear both ID and Name
    if (!editedValue || editedValue.trim() === "") {
      ONEDIT_safeClearContent(sheet.getRange(row, volIdCol));
      ONEDIT_safeClearContent(sheet.getRange(row, volNameCol));
      return;
    }

    // Perform validation, passing which column was edited
    ONEDIT_validateAssignment(sheet, row, col);

  } catch (error) {
    // Log errors but don't disrupt user workflow
    Logger.log(`onEdit validation error: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
  }
}

/**
 * Validates a volunteer assignment in the Assignments sheet
 * @param {Sheet} sheet - The Assignments sheet
 * @param {number} row - The row number being validated
 * @param {number} editedCol - The column number that was edited
 */
function ONEDIT_validateAssignment(sheet, row, editedCol) {
  try {
    const cols = CONSTANTS.COLS.ASSIGNMENTS;

    // Get assignment data from the row
    const rowData = sheet.getRange(row, 1, 1, 13).getValues()[0];

    const date = rowData[cols.DATE - 1];
    const ministryRole = rowData[cols.ROLE - 1];  // Fixed: Use ROLE not MINISTRY_ROLE
    const eventId = rowData[cols.EVENT_ID - 1];
    let volunteerId = rowData[cols.ASSIGNED_VOLUNTEER_ID - 1];
    let volunteerName = rowData[cols.ASSIGNED_VOLUNTEER_NAME - 1];
    // Notes column removed - validation shown in formula columns M-O instead

    // Determine which value to prioritize based on which column was edited
    if (editedCol === cols.ASSIGNED_VOLUNTEER_ID) {
      // User edited ID, so ignore any mismatched name
      volunteerName = null;
    } else if (editedCol === cols.ASSIGNED_VOLUNTEER_NAME) {
      // User edited name, so ignore any mismatched ID
      volunteerId = null;
    }

    // Must have either volunteer ID or name
    if (!volunteerId && !volunteerName) {
      return;
    }

    // Must have date and ministry role to validate
    if (!date || !ministryRole) {
      return;
    }

    // Look up the volunteer
    const volunteer = ONEDIT_findVolunteer(volunteerId, volunteerName);

    if (!volunteer) {
      HELPER_showError(
        'Volunteer Not Found',
        `Cannot find volunteer "${volunteerName || volunteerId}" in the Volunteers sheet.\n\nPlease check the spelling or Volunteer ID.`,
        'assignment'
      );

      // Clear the invalid assignment (safe for typed columns)
      ONEDIT_safeClearContent(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_ID));
      ONEDIT_safeClearContent(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_NAME));
      return;
    }

    // Get the required ministry category from role (using centralized mapping)
    const skillToMinistryMap = HELPER_buildSkillToMinistryMap();
    const requiredSkill = skillToMinistryMap.get(ministryRole.toLowerCase()) || '';

    // Validate the assignment
    const warnings = [];

    // Check 1: Volunteer status
    const statusWarning = ONEDIT_checkVolunteerStatus(volunteer);
    if (statusWarning) warnings.push(statusWarning);

    // Check 2: Ministry role and skill match
    const roleWarning = ONEDIT_checkMinistryMatch(volunteer, ministryRole, requiredSkill);
    if (roleWarning) warnings.push(roleWarning);

    // Check 3: Timeoff conflicts
    const timeoffWarning = ONEDIT_checkTimeoffConflicts(volunteer, date, eventId);
    if (timeoffWarning) warnings.push(timeoffWarning);

    // If no warnings, we're good
    if (warnings.length === 0) {
      // Fill in both ID and Name for consistency (safe for typed columns)
      ONEDIT_safeSetValue(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_ID), volunteer.volunteerId);
      ONEDIT_safeSetValue(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_NAME), volunteer.fullName);
      return;
    }

    // Show warnings and ask for confirmation
    const shouldOverride = ONEDIT_showValidationDialog(volunteer.fullName, warnings);

    if (!shouldOverride) {
      // User cancelled - clear the assignment (safe for typed columns)
      ONEDIT_safeClearContent(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_ID));
      ONEDIT_safeClearContent(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_NAME));
      return;
    }

    // User confirmed override - warnings will show in formula columns M-O
    // (Notes column removed - override documentation no longer needed)

    // Fill in both ID and Name for consistency (safe for typed columns)
    ONEDIT_safeSetValue(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_ID), volunteer.volunteerId);
    ONEDIT_safeSetValue(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_NAME), volunteer.fullName);

  } catch (error) {
    Logger.log(`Error validating assignment: ${error.message}`);
    throw error;
  }
}

/**
 * Finds a volunteer by ID or name
 * @param {string} volunteerId - Volunteer ID
 * @param {string} volunteerName - Volunteer name
 * @returns {object|null} Volunteer object or null if not found
 */
function ONEDIT_findVolunteer(volunteerId, volunteerName) {
  try {
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    for (const row of volunteerData) {
      const rowId = HELPER_safeArrayAccess(row, cols.VOLUNTEER_ID - 1, '').toString();
      const rowName = HELPER_safeArrayAccess(row, cols.FULL_NAME - 1, '').toString();

      // Match by ID (preferred) or by name
      if ((volunteerId && rowId === volunteerId.toString()) ||
          (volunteerName && rowName.toLowerCase() === volunteerName.toLowerCase())) {

        return {
          volunteerId: rowId,
          fullName: rowName,
          status: HELPER_safeArrayAccess(row, cols.STATUS - 1, ''),
          ministryRoles: HELPER_safeArrayAccess(row, cols.MINISTRIES - 1, ''),
          preferredMasses: HELPER_safeArrayAccess(row, cols.PREFERRED_MASS_TIME - 1, ''),
          rolePreferences: HELPER_safeArrayAccess(row, cols.ROLES - 1, '')
        };
      }
    }

    return null;
  } catch (error) {
    Logger.log(`Error finding volunteer: ${error.message}`);
    return null;
  }
}

/**
 * Checks if volunteer has valid status
 * @param {object} volunteer - Volunteer object
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkVolunteerStatus(volunteer) {
  if (volunteer.status !== 'Active') {
    return `❌ Volunteer status is "${volunteer.status}" (not Active)`;
  }
  return null;
}

/**
 * Checks if volunteer has required ministry roles and skills
 * @param {object} volunteer - Volunteer object
 * @param {string} requiredRole - Required ministry role
 * @param {string} requiredSkill - Required ministry skill
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkMinistryMatch(volunteer, requiredRole, requiredSkill) {
  const warnings = [];

  // Parse volunteer's ministry roles (comma-separated)
  const volunteerRoles = volunteer.ministryRoles
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(r => r !== '');

  // Check if volunteer has the general ministry role
  const hasRole = volunteerRoles.some(r =>
    requiredRole.toLowerCase().includes(r) || r.includes(requiredRole.toLowerCase())
  );

  // Check if volunteer has the specific ministry skill
  let hasSkill = true;
  if (requiredSkill && requiredSkill.trim() !== '') {
    hasSkill = volunteerRoles.some(r =>
      requiredSkill.toLowerCase().includes(r) || r.includes(requiredSkill.toLowerCase())
    );
  }

  if (!hasRole && !hasSkill) {
    return `❌ Volunteer does not have required ministry role "${requiredRole}"${requiredSkill ? ` or skill "${requiredSkill}"` : ''}\n   (Has: ${volunteer.ministryRoles || 'none'})`;
  } else if (!hasSkill && requiredSkill) {
    warnings.push(`⚠️  Volunteer has role "${requiredRole}" but not specific skill "${requiredSkill}"`);
  }

  return warnings.length > 0 ? warnings.join('\n') : null;
}

/**
 * Checks for timeoff conflicts using the SELECTED_DATES and MONTH columns.
 * Handles both blacklist ("I CANNOT serve these dates") and
 * whitelist ("I can ONLY serve these dates") timeoff types.
 * @param {object} volunteer - Volunteer object
 * @param {Date} date - Assignment date
 * @param {string} eventId - Event ID (unused but kept for API compatibility)
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkTimeoffConflicts(volunteer, date, eventId) {
  try {
    const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
    const cols = CONSTANTS.COLS.TIMEOFFS;

    const assignmentDate = date instanceof Date ? date : new Date(date);
    assignmentDate.setHours(12, 0, 0, 0);

    // Format for matching against SELECTED_DATES strings: "M/D/YYYY" (no leading zeros)
    const dateStr = `${assignmentDate.getMonth() + 1}/${assignmentDate.getDate()}/${assignmentDate.getFullYear()}`;
    // Format for matching against MONTH field: "February 2026"
    const monthStr = HELPER_formatDate(assignmentDate, 'month-year');

    const warnings = [];
    let hasWhitelistForMonth = false;
    let whitelistIncludesDate = false;

    for (const row of timeoffData) {
      const volName = HELPER_safeArrayAccess(row, cols.VOLUNTEER_NAME - 1, '');
      const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, '');

      // Only check approved timeoffs for this volunteer
      if (volName.toLowerCase() !== volunteer.fullName.toLowerCase()) continue;
      if (status !== 'Approved') continue;

      const type = HELPER_safeArrayAccess(row, cols.TYPE - 1, '').toString();
      const selectedDates = HELPER_safeArrayAccess(row, cols.SELECTED_DATES - 1, '').toString();
      const timeoffMonth = HELPER_safeArrayAccess(row, cols.MONTH - 1, '').toString();

      // Only apply timeoffs that match this assignment's month
      if (timeoffMonth && timeoffMonth !== monthStr) continue;

      // Check if this date appears in the selected dates string
      const dateInSelected = selectedDates.toLowerCase().includes(dateStr.toLowerCase());

      if (type === CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE) {
        // Blacklist: volunteer cannot serve on this date
        if (dateInSelected) {
          warnings.push(`❌ Volunteer has an approved "I CANNOT serve" request for ${dateStr}\n   (Timeoff for ${timeoffMonth || 'this period'})`);
        }
      } else if (type === CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE) {
        // Whitelist: volunteer can ONLY serve on listed dates
        hasWhitelistForMonth = true;
        if (dateInSelected) whitelistIncludesDate = true;
      }
    }

    // If volunteer has a whitelist for this month but this date is not on it, they can't serve
    if (hasWhitelistForMonth && !whitelistIncludesDate) {
      warnings.push(`❌ Volunteer has an approved "I can ONLY serve" request for ${monthStr}\n   ${dateStr} is not on their available dates list`);
    }

    return warnings.length > 0 ? warnings.join('\n\n') : null;

  } catch (error) {
    Logger.log(`Error checking timeoff conflicts: ${error.message}`);
    return null;
  }
}


/**
 * Shows validation warning dialog and asks for confirmation
 * @param {string} volunteerName - Name of volunteer
 * @param {array} warnings - Array of warning messages
 * @returns {boolean} True if user wants to override, false if cancelled
 */
function ONEDIT_showValidationDialog(volunteerName, warnings) {
  const message = `⚠️  Assignment Warnings for ${volunteerName}:\n\n` +
                 warnings.join('\n\n') + '\n\n' +
                 'Do you want to assign this volunteer anyway?\n\n' +
                 '• YES: Proceed with override\n' +
                 '• NO: Cancel assignment';

  return HELPER_confirmAction(
    'Assignment Validation Warning',
    message,
    { type: 'warning' }
  );
}

// ============================================================================
// VIEW SHEET WRITE-BACK
// ============================================================================

/**
 * Handles edits in generated view sheets (MonthlyView, custom prints).
 * When the user changes a volunteer name in the volunteer column of a view sheet,
 * this writes the change back to the corresponding row in the Assignments sheet.
 *
 * Detection: view sheets created by generatePrintableSchedule() have a hidden
 * column (last column) with '_ROW_' in row 1 and Assignments row indices in data rows.
 *
 * @param {object} e - Edit event
 * @param {Sheet} sheet - The edited sheet
 * @param {number} row - Row number of the edit
 * @param {number} col - Column number of the edit
 */
function ONEDIT_handleViewSheetEdit(e, sheet, row, col) {
  try {
    // Skip header rows (rows 1-6 are the schedule header + content header)
    if (row <= 6) return;

    const lastCol = sheet.getLastColumn();
    if (lastCol < 2) return;

    // Check if this is a view sheet: row 1 of the last column must contain '_ROW_'
    const marker = sheet.getRange(1, lastCol).getValue();
    if (marker !== '_ROW_') return;

    // The volunteer column is one before the hidden column
    const volunteerCol = lastCol - 1;
    if (col !== volunteerCol) return;

    // Get the Assignments sheet row index from the hidden column
    const assignmentsRow = sheet.getRange(row, lastCol).getValue();
    if (!assignmentsRow || isNaN(Number(assignmentsRow))) return;

    const newVolunteerName = (e.value || '').toString().trim();

    // If clearing or setting to UNASSIGNED, no validation needed
    if (!newVolunteerName || newVolunteerName === 'UNASSIGNED') {
      ONEDIT_writeVolunteerToAssignments(Number(assignmentsRow), newVolunteerName);
      return;
    }

    // Validate before writing back
    const shouldProceed = ONEDIT_validateViewAssignment(
      sheet, row, volunteerCol, Number(assignmentsRow), newVolunteerName, e.oldValue
    );
    if (!shouldProceed) return;

    // Write the change back to the Assignments sheet
    ONEDIT_writeVolunteerToAssignments(Number(assignmentsRow), newVolunteerName);

  } catch (error) {
    Logger.log(`View sheet write-back error: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    // Non-fatal: don't disrupt the user
  }
}

/**
 * Writes a volunteer name (and matching ID + status) back to the Assignments sheet.
 * @param {number} assignmentsRow - 1-based row number in the Assignments sheet.
 * @param {string} volunteerName - The selected volunteer name (empty string to clear).
 */
function ONEDIT_writeVolunteerToAssignments(assignmentsRow, volunteerName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  if (!assignmentsSheet) return;

  const cols = CONSTANTS.COLS.ASSIGNMENTS;

  if (!volunteerName || volunteerName === 'UNASSIGNED') {
    // Clear assignment (also clear group column in case it held a group name)
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_GROUP), '');
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_ID), '');
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_NAME), '');
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.STATUS), 'Unassigned');
    Logger.log(`Cleared assignment in Assignments row ${assignmentsRow}`);
    return;
  }

  // Look up the volunteer to get their ID
  let volunteerId = '';
  try {
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const volCols = CONSTANTS.COLS.VOLUNTEERS;
    for (const volRow of volunteerData) {
      const name = HELPER_safeArrayAccess(volRow, volCols.FULL_NAME - 1, '');
      if (name.toLowerCase() === volunteerName.toLowerCase()) {
        volunteerId = HELPER_safeArrayAccess(volRow, volCols.VOLUNTEER_ID - 1, '');
        break;
      }
    }
  } catch (e) {
    Logger.log(`Warning: Could not look up volunteer ID: ${e.message}`);
  }

  if (volunteerId) {
    // Individual volunteer found — clear group column, write ID + name
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_GROUP), '');
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_ID), volunteerId);
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_NAME), volunteerName);
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.STATUS), 'Assigned');
    Logger.log(`Write-back: row ${assignmentsRow} → "${volunteerName}" (ID: ${volunteerId})`);
  } else {
    // Name not found in Volunteers — treat as a group assignment
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_GROUP), volunteerName);
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_ID), '');
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_NAME), volunteerName);
    ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.STATUS), 'Assigned');
    Logger.log(`Write-back: row ${assignmentsRow} → group "${volunteerName}"`);
  }
}

// ============================================================================
// VIEW SHEET ASSIGNMENT VALIDATION
// ============================================================================

/**
 * Validates a volunteer assignment entered in a view sheet (MonthlyView, etc.)
 * before writing it back to the Assignments sheet. Runs six checks:
 *   1. Volunteer status (must be Active)
 *   2. Ministry/role qualification
 *   3. Same mass conflict (already assigned to this EventID)
 *   4. Same liturgical day conflict (serving a different mass on the same date)
 *   5. Timeoff conflicts (blacklist/whitelist)
 *   6. Monthly frequency and spacing (>2 times in month, or <7 days from another assignment)
 *
 * Shows a confirmation dialog on warnings. If the user cancels, reverts the cell.
 *
 * @param {Sheet} viewSheet - The view sheet being edited
 * @param {number} viewRow - The row being edited in the view sheet
 * @param {number} volunteerCol - The column index of the volunteer cell
 * @param {number} assignmentsRow - The 1-based row in the Assignments sheet
 * @param {string} volunteerName - The volunteer name being assigned
 * @param {string} oldValue - The previous cell value (to revert on cancel)
 * @returns {boolean} True if assignment should proceed, false if cancelled
 */
function ONEDIT_validateViewAssignment(viewSheet, viewRow, volunteerCol, assignmentsRow, volunteerName, oldValue) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (!assignmentsSheet) return true; // Can't validate without Assignments sheet

    const cols = CONSTANTS.COLS.ASSIGNMENTS;

    // Read the full assignment row from the Assignments sheet
    const rowData = assignmentsSheet.getRange(assignmentsRow, 1, 1, 13).getValues()[0];
    const date      = rowData[cols.DATE - 1];
    const eventId   = rowData[cols.EVENT_ID - 1];
    const ministry  = rowData[cols.MINISTRY - 1];
    const role      = rowData[cols.ROLE - 1];
    const monthYear = rowData[cols.MONTH_YEAR - 1];

    if (!date || !role) return true; // Insufficient data — allow without validation

    // Look up the volunteer by name
    const volunteer = ONEDIT_findVolunteer(null, volunteerName);
    if (!volunteer) {
      HELPER_showError(
        'Volunteer Not Found',
        `"${volunteerName}" was not found in the Volunteers sheet. Please check the spelling.`,
        'assignment'
      );
      ONEDIT_safeSetValue(viewSheet.getRange(viewRow, volunteerCol), oldValue || 'UNASSIGNED');
      return false;
    }

    // Read all assignments once for the conflict checks
    const allAssignmentsData = HELPER_readSheetData(CONSTANTS.SHEETS.ASSIGNMENTS);

    const warnings = [];

    // Check 1: Volunteer must be Active
    const statusWarning = ONEDIT_checkVolunteerStatus(volunteer);
    if (statusWarning) warnings.push(statusWarning);

    // Check 2: Must have the required ministry/role qualification
    const skillToMinistryMap = HELPER_buildSkillToMinistryMap();
    const requiredSkill = skillToMinistryMap.get(role.toLowerCase()) || ministry || '';
    const roleWarning = ONEDIT_checkMinistryMatch(volunteer, role, requiredSkill);
    if (roleWarning) warnings.push(roleWarning);

    // Check 3: Not already assigned to this same mass (same EventID)
    const sameMassWarning = ONEDIT_checkSameMassConflict(volunteer, allAssignmentsData, eventId, assignmentsRow);
    if (sameMassWarning) warnings.push(sameMassWarning);

    // Check 4: Not already serving a different mass on the same liturgical day
    const sameDayWarning = ONEDIT_checkSameDayConflict(volunteer, allAssignmentsData, date, assignmentsRow);
    if (sameDayWarning) warnings.push(sameDayWarning);

    // Check 5: No approved timeoff conflicts (blacklist/whitelist)
    const timeoffWarning = ONEDIT_checkTimeoffConflicts(volunteer, date, eventId);
    if (timeoffWarning) warnings.push(timeoffWarning);

    // Check 6: Not over-scheduled (>2 assignments this month, or <7 days from another)
    const frequencyWarning = ONEDIT_checkMonthlyFrequency(volunteer, allAssignmentsData, monthYear, date, assignmentsRow);
    if (frequencyWarning) warnings.push(frequencyWarning);

    if (warnings.length === 0) return true; // All clear — proceed

    // Show warnings and ask whether to override
    const shouldOverride = ONEDIT_showValidationDialog(volunteer.fullName, warnings);
    if (!shouldOverride) {
      // Revert the MonthlyView cell to its previous value
      ONEDIT_safeSetValue(viewSheet.getRange(viewRow, volunteerCol), oldValue || 'UNASSIGNED');
      return false;
    }

    return true; // User confirmed override — allow write-back

  } catch (error) {
    Logger.log(`Error in view assignment validation: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return true; // On unexpected error, allow rather than blocking
  }
}

/**
 * Checks if the volunteer is already assigned to another role at this same mass (same EventID).
 * @param {object} volunteer - Volunteer object
 * @param {Array} allAssignmentsData - All rows from the Assignments sheet (no header)
 * @param {string} eventId - EventID of the mass being assigned
 * @param {number} currentAssignmentsRow - 1-based row being edited (skip this row)
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkSameMassConflict(volunteer, allAssignmentsData, eventId, currentAssignmentsRow) {
  if (!eventId) return null;

  const cols = CONSTANTS.COLS.ASSIGNMENTS;

  for (let i = 0; i < allAssignmentsData.length; i++) {
    const row = allAssignmentsData[i];
    const rowNum = i + 2; // 1-indexed (+1 for header row)
    if (rowNum === currentAssignmentsRow) continue;

    const rowEventId = HELPER_safeArrayAccess(row, cols.EVENT_ID - 1, '');
    const rowVolName = HELPER_safeArrayAccess(row, cols.ASSIGNED_VOLUNTEER_NAME - 1, '');

    if (rowEventId !== eventId) continue;
    if (!rowVolName || rowVolName.toLowerCase() !== volunteer.fullName.toLowerCase()) continue;

    const rowRole = HELPER_safeArrayAccess(row, cols.ROLE - 1, '');
    return `⚠️ Already assigned to this same Mass: "${rowRole}"`;
  }

  return null;
}

/**
 * Checks if the volunteer is already serving at a different mass on the same liturgical day.
 * @param {object} volunteer - Volunteer object
 * @param {Array} allAssignmentsData - All rows from the Assignments sheet (no header)
 * @param {Date} date - Date of the assignment
 * @param {number} currentAssignmentsRow - 1-based row being edited (skip this row)
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkSameDayConflict(volunteer, allAssignmentsData, date, currentAssignmentsRow) {
  if (!date) return null;

  const cols = CONSTANTS.COLS.ASSIGNMENTS;
  const assignDate = new Date(date);
  assignDate.setHours(12, 0, 0, 0);

  const conflicts = [];

  for (let i = 0; i < allAssignmentsData.length; i++) {
    const row = allAssignmentsData[i];
    const rowNum = i + 2;
    if (rowNum === currentAssignmentsRow) continue;

    const rowVolName = HELPER_safeArrayAccess(row, cols.ASSIGNED_VOLUNTEER_NAME - 1, '');
    if (!rowVolName || rowVolName.toLowerCase() !== volunteer.fullName.toLowerCase()) continue;

    const rowDate = HELPER_safeArrayAccess(row, cols.DATE - 1);
    if (!rowDate) continue;

    const rowDateObj = new Date(rowDate);
    rowDateObj.setHours(12, 0, 0, 0);
    if (rowDateObj.getTime() !== assignDate.getTime()) continue;

    const rowEventId = HELPER_safeArrayAccess(row, cols.EVENT_ID - 1, '');
    const rowRole    = HELPER_safeArrayAccess(row, cols.ROLE - 1, '');
    conflicts.push(`${rowRole} (${rowEventId})`);
  }

  if (conflicts.length > 0) {
    return `⚠️ Already serving on this liturgical day:\n   ${conflicts.join(', ')}`;
  }

  return null;
}

/**
 * Checks if the volunteer is scheduled too frequently:
 *   - More than 2 assignments already in this month (adding this would be 3+)
 *   - Any existing assignment is within 7 days of this one
 *
 * @param {object} volunteer - Volunteer object
 * @param {Array} allAssignmentsData - All rows from the Assignments sheet (no header)
 * @param {*} monthYear - Month-year of this assignment (string "YYYY-MM" or Date)
 * @param {Date} date - Date of this assignment
 * @param {number} currentAssignmentsRow - 1-based row being edited (skip this row)
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkMonthlyFrequency(volunteer, allAssignmentsData, monthYear, date, currentAssignmentsRow) {
  const cols = CONSTANTS.COLS.ASSIGNMENTS;
  const newDate = new Date(date);
  newDate.setHours(12, 0, 0, 0);

  const monthYearStr = ONEDIT_normalizeMonthYear(monthYear);

  let monthCount = 0;
  let closestDaysDiff = Infinity;
  let closestDate = null;

  for (let i = 0; i < allAssignmentsData.length; i++) {
    const row = allAssignmentsData[i];
    const rowNum = i + 2;
    if (rowNum === currentAssignmentsRow) continue;

    const rowVolName = HELPER_safeArrayAccess(row, cols.ASSIGNED_VOLUNTEER_NAME - 1, '');
    if (!rowVolName || rowVolName.toLowerCase() !== volunteer.fullName.toLowerCase()) continue;

    const rowMonthYear = HELPER_safeArrayAccess(row, cols.MONTH_YEAR - 1);
    if (ONEDIT_normalizeMonthYear(rowMonthYear) !== monthYearStr) continue;

    monthCount++;

    const rowDate = HELPER_safeArrayAccess(row, cols.DATE - 1);
    if (!rowDate) continue;

    const rowDateObj = new Date(rowDate);
    rowDateObj.setHours(12, 0, 0, 0);

    const daysDiff = Math.abs(newDate.getTime() - rowDateObj.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < closestDaysDiff) {
      closestDaysDiff = daysDiff;
      closestDate = rowDateObj;
    }
  }

  const warnings = [];

  if (monthCount >= 2) {
    warnings.push(`⚠️ Already serving ${monthCount} time(s) this month — this would be assignment #${monthCount + 1}`);
  }

  if (closestDaysDiff < 7) {
    warnings.push(`⚠️ Too close to another assignment:\n   ${HELPER_formatDate(closestDate, 'default')} is only ${Math.round(closestDaysDiff)} day(s) away\n   (Recommended: at least 7 days between assignments)`);
  }

  return warnings.length > 0 ? warnings.join('\n\n') : null;
}

/**
 * Normalizes a month-year value to "YYYY-MM" string format.
 * Handles both string values (already "YYYY-MM") and Date objects
 * (which Google Sheets sometimes returns for date-formatted cells).
 * @param {*} monthYear - The month-year value to normalize
 * @returns {string} Normalized "YYYY-MM" string, or empty string if invalid
 */
function ONEDIT_normalizeMonthYear(monthYear) {
  if (!monthYear) return '';
  if (typeof monthYear === 'string') return monthYear;
  if (monthYear instanceof Date && !isNaN(monthYear.getTime())) {
    const yr = monthYear.getFullYear();
    const mo = String(monthYear.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}`;
  }
  return String(monthYear);
}
