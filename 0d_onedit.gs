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

    // Only validate edits in Assignments sheet
    if (sheetName !== CONSTANTS.SHEETS.ASSIGNMENTS) return;

    const row = e.range.getRow();
    const col = e.range.getColumn();

    // Only validate when Volunteer ID or Name columns are edited
    const volIdCol = CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_ID;
    const volNameCol = CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_NAME;

    if (col !== volIdCol && col !== volNameCol) return;

    // Skip header row
    if (row === 1) return;

    // Get the edited value
    const editedValue = e.value || "";

    // If cell was cleared, just return (no validation needed)
    if (!editedValue || editedValue.trim() === "") {
      return;
    }

    // Perform validation
    ONEDIT_validateAssignment(sheet, row);

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
 */
function ONEDIT_validateAssignment(sheet, row) {
  try {
    const cols = CONSTANTS.COLS.ASSIGNMENTS;

    // Get assignment data from the row
    const rowData = sheet.getRange(row, 1, 1, 13).getValues()[0];

    const date = rowData[cols.DATE - 1];
    const ministryRole = rowData[cols.MINISTRY_ROLE - 1];
    const eventId = rowData[cols.EVENT_ID - 1];
    const volunteerId = rowData[cols.ASSIGNED_VOLUNTEER_ID - 1];
    const volunteerName = rowData[cols.ASSIGNED_VOLUNTEER_NAME - 1];
    const currentNotes = rowData[cols.NOTES - 1] || "";

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
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        '❌ Volunteer Not Found',
        `Cannot find volunteer "${volunteerName || volunteerId}" in the Volunteers sheet.\n\nPlease check the spelling or Volunteer ID.`,
        ui.ButtonSet.OK
      );

      // Clear the invalid assignment (safe for typed columns)
      ONEDIT_safeClearContent(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_ID));
      ONEDIT_safeClearContent(sheet.getRange(row, cols.ASSIGNED_VOLUNTEER_NAME));
      return;
    }

    // Get the required ministry skill from templates
    const requiredSkill = ONEDIT_getRequiredSkill(ministryRole);

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
      // Clear any previous override notes
      const cleanedNotes = currentNotes.replace(/\[Override:.*?\]\s*/g, '').trim();
      if (cleanedNotes !== currentNotes) {
        ONEDIT_safeSetValue(sheet.getRange(row, cols.NOTES), cleanedNotes);
      }
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

    // User confirmed override - document it in Notes
    ONEDIT_addWarningNote(sheet, row, warnings, currentNotes);

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
 * Gets the required ministry skill for a role from MassTemplates
 * @param {string} ministryRole - The ministry role name
 * @returns {string} The required skill or empty string
 */
function ONEDIT_getRequiredSkill(ministryRole) {
  try {
    const templateData = HELPER_readSheetData(CONSTANTS.SHEETS.TEMPLATES);
    const cols = CONSTANTS.COLS.TEMPLATES;

    for (const row of templateData) {
      const rowRole = HELPER_safeArrayAccess(row, cols.MINISTRY_NAME - 1, '');
      if (rowRole.toLowerCase() === ministryRole.toLowerCase()) {
        return HELPER_safeArrayAccess(row, cols.ROLE_NAME - 1, '');
      }
    }

    return '';
  } catch (error) {
    Logger.log(`Error getting required skill: ${error.message}`);
    return '';
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
  const ui = SpreadsheetApp.getUi();

  let message = `⚠️  Assignment Warnings for ${volunteerName}:\n\n`;
  message += warnings.join('\n\n');
  message += '\n\n────────────────────────────\n';
  message += 'Do you want to assign this volunteer anyway?\n\n';
  message += '• Click YES to proceed with override\n';
  message += '• Click NO to cancel assignment';

  const response = ui.alert(
    '⚠️  Assignment Validation Warning',
    message,
    ui.ButtonSet.YES_NO
  );

  return response === ui.Button.YES;
}

/**
 * Adds warning documentation to Notes column
 * @param {Sheet} sheet - The Assignments sheet
 * @param {number} row - Row number
 * @param {array} warnings - Array of warning messages
 * @param {string} currentNotes - Current notes content
 */
function ONEDIT_addWarningNote(sheet, row, warnings, currentNotes) {
  const cols = CONSTANTS.COLS.ASSIGNMENTS;

  // Create summary of warnings
  const warningTypes = [];
  warnings.forEach(w => {
    if (w.includes('status')) warningTypes.push('Inactive');
    if (w.includes('ministry role') || w.includes('skill')) warningTypes.push('Missing Role');
    if (w.includes('unavailable')) warningTypes.push('Unavailable');
    if (w.includes('only available')) warningTypes.push('Not in Whitelist');
  });

  // Remove any previous override notes
  let cleanedNotes = currentNotes.replace(/\[Override:.*?\]\s*/g, '').trim();

  // Add new override note
  const overrideNote = `[Override: ${warningTypes.join(', ')}]`;
  const newNotes = overrideNote + (cleanedNotes ? ' ' + cleanedNotes : '');

  // Use safe write for typed columns
  ONEDIT_safeSetValue(sheet.getRange(row, cols.NOTES), newNotes);
}

/**
 * Sets up conditional formatting to highlight overridden assignments
 * Call this once from menu or manually to set up the formatting rules
 */
function ONEDIT_setupConditionalFormatting() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!sheet) {
      throw new Error('Assignments sheet not found');
    }

    // Clear existing conditional formatting rules on this sheet
    const existingRules = sheet.getConditionalFormatRules();
    const otherRules = existingRules.filter(rule => {
      // Keep rules that don't apply to our notes column
      const ranges = rule.getRanges();
      return !ranges.some(range => range.getColumn() === CONSTANTS.COLS.ASSIGNMENTS.NOTES);
    });

    // Create new rule: Highlight rows where Notes contains "[Override:"
    const notesCol = CONSTANTS.COLS.ASSIGNMENTS.NOTES;
    const lastRow = Math.max(sheet.getLastRow(), 100); // At least 100 rows

    // Rule applies to entire row
    const range = sheet.getRange(2, 1, lastRow - 1, 13);

    // Formula checks if Notes column (column 12) contains "[Override:"
    const formula = `=REGEXMATCH($L2, "\\[Override:")`;

    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground('#FCE5CD') // Light orange background
      .setRanges([range])
      .build();

    // Apply rules
    sheet.setConditionalFormatRules([...otherRules, rule]);

    SpreadsheetApp.getUi().alert(
      '✓ Conditional Formatting Set Up',
      'Assignments with validation overrides will now be highlighted in light orange.\n\n' +
      'This highlighting will automatically update as you make assignments.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return 'Conditional formatting set up successfully';

  } catch (error) {
    Logger.log(`Error setting up conditional formatting: ${error.message}`);
    throw new Error(`Could not set up conditional formatting: ${error.message}`);
  }
}
