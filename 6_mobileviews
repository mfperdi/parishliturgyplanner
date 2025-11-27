/**
 * ====================================================================
 * MOBILE VIEWS - iOS GOOGLE SHEETS APP OPTIMIZATION
 * ====================================================================
 * Creates formula-based view sheets optimized for viewing and editing
 * on mobile devices (Google Sheets iOS app)
 *
 * View Sheets Created:
 * - WeeklyView: Shows current + next week's assignments
 * - UnassignedRoles: Shows only unassigned roles
 * - VolunteerLookup: Searchable by volunteer name
 *
 * All views use formulas and auto-update when source data changes.
 * No need to regenerate from desktop - always current.
 */

/**
 * Main function to set up all mobile view sheets
 * Callable from sidebar or menu
 * @returns {string} Success message
 */
function MOBILE_setupAllViews() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create/update each view sheet
    MOBILE_createWeeklyView(ss);
    MOBILE_createUnassignedRolesView(ss);
    MOBILE_createVolunteerLookupView(ss);

    // Add data validation to Assignments sheet for mobile editing
    MOBILE_addAssignmentsValidation(ss);

    // Add conditional formatting for visual feedback
    MOBILE_addConditionalFormatting(ss);

    return 'Mobile view sheets created successfully!\n\n' +
           'Sheets created:\n' +
           '• WeeklyView - Current + next week\n' +
           '• UnassignedRoles - All unassigned roles\n' +
           '• VolunteerLookup - Search by volunteer\n\n' +
           'Assignments sheet enhanced with:\n' +
           '• Dropdown menus for easy editing\n' +
           '• Color-coded status (green=assigned, red=unassigned)';

  } catch (error) {
    Logger.log(`Error in MOBILE_setupAllViews: ${error.message}`);
    throw new Error(`Could not set up mobile views: ${error.message}`);
  }
}

/**
 * Creates the WeeklyView sheet showing current + next 7 days
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function MOBILE_createWeeklyView(ss) {
  try {
    const sheetName = 'WeeklyView';
    let sheet = ss.getSheetByName(sheetName);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      // Clear existing content
      sheet.clear();
    }

    // Set up header row
    const headers = [
      'Date', 'Weekday', 'Time', 'Mass',
      'Ministry Role', 'Volunteer', 'Status'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#4A86E8')
      .setFontColor('#FFFFFF')
      .setFontSize(12);

    // Freeze header row
    sheet.setFrozenRows(1);

    // Add formula to pull data from Assignments sheet
    // Shows assignments from today through next 7 days
    const formula = `=QUERY(Assignments!A:L,
      "SELECT A, B, C, D, E, K, L
       WHERE A >= date '"&TEXT(TODAY(),"yyyy-mm-dd")&"'
       AND A <= date '"&TEXT(TODAY()+7,"yyyy-mm-dd")&"'
       ORDER BY A, B", 1)`;

    sheet.getRange(2, 1).setFormula(formula);

    // Format date column
    sheet.getRange('A:A').setNumberFormat('M/d/yyyy');

    // Set column widths for mobile viewing
    sheet.setColumnWidth(1, 100);  // Date
    sheet.setColumnWidth(2, 100);  // Weekday
    sheet.setColumnWidth(3, 80);   // Time
    sheet.setColumnWidth(4, 150);  // Mass
    sheet.setColumnWidth(5, 120);  // Ministry Role
    sheet.setColumnWidth(6, 150);  // Volunteer
    sheet.setColumnWidth(7, 100);  // Status

    // Add alternating row colors for readability
    const lastRow = Math.max(sheet.getLastRow(), 10);
    sheet.getRange(2, 1, lastRow - 1, headers.length)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);

    Logger.log('WeeklyView sheet created successfully');

  } catch (error) {
    Logger.log(`Error creating WeeklyView: ${error.message}`);
    throw error;
  }
}

/**
 * Creates the UnassignedRoles sheet showing only unassigned ministry roles
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function MOBILE_createUnassignedRolesView(ss) {
  try {
    const sheetName = 'UnassignedRoles';
    let sheet = ss.getSheetByName(sheetName);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      // Clear existing content
      sheet.clear();
    }

    // Set up header row
    const headers = [
      'Date', 'Time', 'Mass', 'Ministry Role', 'Event ID'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#E06666')
      .setFontColor('#FFFFFF')
      .setFontSize(12);

    // Freeze header row
    sheet.setFrozenRows(1);

    // Add formula to pull only unassigned rows
    const formula = `=QUERY(Assignments!A:L,
      "SELECT A, B, C, E, F
       WHERE L = 'Unassigned'
       ORDER BY A, B", 1)`;

    sheet.getRange(2, 1).setFormula(formula);

    // Format date column
    sheet.getRange('A:A').setNumberFormat('M/d/yyyy');

    // Set column widths for mobile viewing
    sheet.setColumnWidth(1, 100);  // Date
    sheet.setColumnWidth(2, 80);   // Time
    sheet.setColumnWidth(3, 150);  // Mass
    sheet.setColumnWidth(4, 120);  // Ministry Role
    sheet.setColumnWidth(5, 100);  // Event ID

    // Add light red background to emphasize these need attention
    const lastRow = Math.max(sheet.getLastRow(), 10);
    sheet.getRange(2, 1, lastRow - 1, headers.length)
      .setBackground('#F4CCCC');

    Logger.log('UnassignedRoles sheet created successfully');

  } catch (error) {
    Logger.log(`Error creating UnassignedRoles: ${error.message}`);
    throw error;
  }
}

/**
 * Creates the VolunteerLookup sheet for searching assignments by volunteer
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function MOBILE_createVolunteerLookupView(ss) {
  try {
    const sheetName = 'VolunteerLookup';
    let sheet = ss.getSheetByName(sheetName);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      // Clear existing content
      sheet.clear();
    }

    // Instructions row
    sheet.getRange(1, 1, 1, 4)
      .merge()
      .setValue('Select a volunteer name below to see their assignments')
      .setFontWeight('bold')
      .setBackground('#FFF2CC')
      .setFontSize(11)
      .setWrap(true);

    // Volunteer name dropdown label
    sheet.getRange(2, 1)
      .setValue('Volunteer Name:')
      .setFontWeight('bold');

    // Get list of active volunteers for dropdown
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    const activeVolunteers = volunteerData
      .filter(row => {
        const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, '');
        return status === 'Active' || status === 'Ministry Sponsor';
      })
      .map(row => HELPER_safeArrayAccess(row, cols.FULL_NAME - 1, ''))
      .filter(name => name !== '')
      .sort();

    // Add dropdown in B2
    const dropdownCell = sheet.getRange(2, 2);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(activeVolunteers, true)
      .setAllowInvalid(false)
      .build();
    dropdownCell.setDataValidation(rule);
    dropdownCell.setBackground('#FFFFFF');

    // Set up header row for results
    const headers = [
      'Date', 'Time', 'Mass', 'Ministry Role', 'Status'
    ];

    sheet.getRange(4, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#6AA84F')
      .setFontColor('#FFFFFF')
      .setFontSize(12);

    // Freeze header rows
    sheet.setFrozenRows(4);

    // Add formula to filter by selected volunteer
    const formula = `=IF(ISBLANK(B2), "Select a volunteer above",
      QUERY(Assignments!A:L,
        "SELECT A, B, C, E, L
         WHERE K = '"&B2&"'
         ORDER BY A, B", 1))`;

    sheet.getRange(5, 1).setFormula(formula);

    // Format date column
    sheet.getRange('A:A').setNumberFormat('M/d/yyyy');

    // Set column widths
    sheet.setColumnWidth(1, 100);  // Date
    sheet.setColumnWidth(2, 80);   // Time
    sheet.setColumnWidth(3, 150);  // Mass
    sheet.setColumnWidth(4, 120);  // Ministry Role
    sheet.setColumnWidth(5, 100);  // Status

    Logger.log('VolunteerLookup sheet created successfully');

  } catch (error) {
    Logger.log(`Error creating VolunteerLookup: ${error.message}`);
    throw error;
  }
}

/**
 * Adds dropdown data validation to Assignments sheet for mobile editing
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function MOBILE_addAssignmentsValidation(ss) {
  try {
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (!sheet) {
      throw new Error('Assignments sheet not found');
    }

    const lastRow = Math.max(sheet.getLastRow(), 100);

    // Add volunteer name dropdown (Column K - Assigned Volunteer Name)
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    const activeVolunteers = volunteerData
      .filter(row => {
        const status = HELPER_safeArrayAccess(row, cols.STATUS - 1, '');
        return status === 'Active' || status === 'Ministry Sponsor';
      })
      .map(row => HELPER_safeArrayAccess(row, cols.FULL_NAME - 1, ''))
      .filter(name => name !== '')
      .sort();

    if (activeVolunteers.length > 0) {
      const volunteerRange = sheet.getRange(2, CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_NAME, lastRow - 1);
      const volunteerRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(activeVolunteers, true)
        .setAllowInvalid(true)  // Allow manual entry for edge cases
        .setHelpText('Select a volunteer or type a name')
        .build();
      volunteerRange.setDataValidation(volunteerRule);
    }

    // Add status dropdown (Column L - Status)
    const statusValues = CONSTANTS.STATUS.ASSIGNMENT;
    const statusRange = sheet.getRange(2, CONSTANTS.COLS.ASSIGNMENTS.STATUS, lastRow - 1);
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(statusValues, true)
      .setAllowInvalid(false)
      .setHelpText('Select assignment status')
      .build();
    statusRange.setDataValidation(statusRule);

    Logger.log('Data validation added to Assignments sheet');

  } catch (error) {
    Logger.log(`Error adding validation to Assignments: ${error.message}`);
    throw error;
  }
}

/**
 * Adds conditional formatting to Assignments sheet for visual feedback
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function MOBILE_addConditionalFormatting(ss) {
  try {
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (!sheet) {
      throw new Error('Assignments sheet not found');
    }

    const lastRow = Math.max(sheet.getLastRow(), 100);
    const range = sheet.getRange(2, 1, lastRow - 1, 13);

    // Clear existing conditional formatting
    sheet.clearConditionalFormatRules();

    const rules = [];

    // Rule 1: Highlight unassigned rows in light red
    const unassignedFormula = `=$L2="Unassigned"`;
    const unassignedRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(unassignedFormula)
      .setBackground('#F4CCCC')  // Light red
      .setRanges([range])
      .build();
    rules.push(unassignedRule);

    // Rule 2: Highlight assigned rows in light green
    const assignedFormula = `=$L2="Assigned"`;
    const assignedRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(assignedFormula)
      .setBackground('#D9EAD3')  // Light green
      .setRanges([range])
      .build();
    rules.push(assignedRule);

    // Rule 3: Highlight substitute needed in light orange
    const substituteFormula = `=$L2="Substitute Needed"`;
    const substituteRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(substituteFormula)
      .setBackground('#FCE5CD')  // Light orange
      .setRanges([range])
      .build();
    rules.push(substituteRule);

    // Rule 4: Highlight override warnings (from existing onEdit validation)
    const overrideFormula = `=REGEXMATCH($M2, "\\[Override:")`;
    const overrideRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(overrideFormula)
      .setBackground('#FFD966')  // Yellow
      .setRanges([range])
      .build();
    rules.push(overrideRule);

    // Apply all rules
    sheet.setConditionalFormatRules(rules);

    Logger.log('Conditional formatting added to Assignments sheet');

  } catch (error) {
    Logger.log(`Error adding conditional formatting: ${error.message}`);
    throw error;
  }
}

/**
 * Refreshes all mobile view sheets
 * Usually not needed since formulas auto-update, but useful for troubleshooting
 * @returns {string} Success message
 */
function MOBILE_refreshViews() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Force recalculation by touching the formula cells
    const sheets = ['WeeklyView', 'UnassignedRoles', 'VolunteerLookup'];

    sheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        SpreadsheetApp.flush();
      }
    });

    return 'Mobile views refreshed successfully';

  } catch (error) {
    Logger.log(`Error refreshing views: ${error.message}`);
    throw new Error(`Could not refresh mobile views: ${error.message}`);
  }
}
