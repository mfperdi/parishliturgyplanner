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
 * Checks for timeoff conflicts
 * @param {object} volunteer - Volunteer object
 * @param {Date} date - Assignment date
 * @param {string} eventId - Event ID
 * @returns {string|null} Warning message or null
 */
function ONEDIT_checkTimeoffConflicts(volunteer, date, eventId) {
  try {
    const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
    const cols = CONSTANTS.COLS.TIMEOFFS;

    // Convert date to Date object if needed
    const assignmentDate = date instanceof Date ? date : new Date(date);
    assignmentDate.setHours(12, 0, 0, 0); // Normalize to noon

    const warnings = [];

    for (const row of timeoffData) {
      const volName = HELPER_safeArrayAccess(row, cols.VOLUNTEER_NAME - 1, '');
      const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, '');
      const type = HELPER_safeArrayAccess(row, cols.TYPE - 1, '');

      // Only check approved timeoffs for this volunteer
      if (volName.toLowerCase() !== volunteer.fullName.toLowerCase()) continue;
      if (status !== 'Approved') continue;

      const startDate = new Date(HELPER_safeArrayAccess(row, cols.START_DATE - 1));
      const endDate = new Date(HELPER_safeArrayAccess(row, cols.END_DATE - 1));
      const notes = HELPER_safeArrayAccess(row, cols.NOTES - 1, '');

      startDate.setHours(12, 0, 0, 0);
      endDate.setHours(12, 0, 0, 0);

      // Check if assignment date falls within timeoff range
      if (assignmentDate >= startDate && assignmentDate <= endDate) {

        if (type === CONSTANTS.TIMEOFF_TYPES.UNAVAILABLE) {
          // Blacklist - volunteer is unavailable
          warnings.push(`❌ Volunteer is unavailable on ${HELPER_formatDate(assignmentDate, 'default')}\n   (Timeoff: ${type} from ${HELPER_formatDate(startDate, 'default')} to ${HELPER_formatDate(endDate, 'default')})`);

        } else if (type === CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE) {
          // Whitelist - check if this mass/date is allowed
          const isAllowed = ONEDIT_checkWhitelistMatch(notes, eventId, assignmentDate);

          if (!isAllowed) {
            warnings.push(`❌ Volunteer is only available for specific masses during this period\n   (${type} from ${HELPER_formatDate(startDate, 'default')} to ${HELPER_formatDate(endDate, 'default')})\n   (Allowed: ${notes || 'none specified'})\n   (This assignment: ${eventId || 'unknown event'})`);
          }
        }
      }
    }

    return warnings.length > 0 ? warnings.join('\n\n') : null;

  } catch (error) {
    Logger.log(`Error checking timeoff conflicts: ${error.message}`);
    return null;
  }
}

/**
 * Checks if assignment matches whitelist criteria
 * @param {string} notes - Notes field containing allowed Event IDs/dates
 * @param {string} eventId - Current assignment Event ID
 * @param {Date} date - Current assignment date
 * @returns {boolean} True if assignment is allowed
 */
function ONEDIT_checkWhitelistMatch(notes, eventId, date) {
  if (!notes || notes.trim() === '') return false;

  // Parse notes for Event IDs and dates
  const items = notes.split(',').map(item => item.trim().toUpperCase());

  // Check if eventId matches
  if (eventId && items.includes(eventId.toUpperCase())) {
    return true;
  }

  // Check if date matches
  const dateStr = HELPER_formatDate(date, 'default');
  for (const item of items) {
    try {
      const itemDate = new Date(item);
      if (!isNaN(itemDate.getTime())) {
        itemDate.setHours(12, 0, 0, 0);
        if (itemDate.getTime() === date.getTime()) {
          return true;
        }
      }
    } catch (e) {
      // Not a valid date, skip
    }
  }

  return false;
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

  // Set a flag so AUTOVIEW_onChangeHandler knows to skip regeneration.
  // The onChange trigger fires asynchronously after our setValue() calls;
  // it reads this flag and skips the view refresh for write-backs.
  try {
    PropertiesService.getScriptProperties()
      .setProperty('VIEWEDIT_WRITEBACK_TS', Date.now().toString());
  } catch (e) {
    Logger.log(`Warning: Could not set write-back flag: ${e.message}`);
  }

  if (!volunteerName || volunteerName === 'UNASSIGNED') {
    // Clear assignment
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

  // Write volunteer ID, name, and status
  ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_ID), volunteerId);
  ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.ASSIGNED_VOLUNTEER_NAME), volunteerName);
  ONEDIT_safeSetValue(assignmentsSheet.getRange(assignmentsRow, cols.STATUS), 'Assigned');

  Logger.log(`Write-back: row ${assignmentsRow} → "${volunteerName}" (ID: ${volunteerId || 'not found'})`);
}
