    /**
 * ====================================================================
 * PARISH LITURGICAL SCHEDULER - ENHANCED WITH LITURGICAL PRINT
 * ====================================================================
 * File Structure:
 * - constants.gs - Global constants and column maps
 * - helper.gs - Reusable helper functions
 * - main.gs - Menu, sidebar, and wrapper functions (THIS FILE)
 * - 1_calendarlogic.gs - Liturgical calendar generation
 * - 1a_calendardates.gs - Date calculations
 * - 1b_calendarseasons.gs - Seasonal celebrations
 * - 2_schedulelogic.gs - Mass schedule generation
 * - 3_assignmentlogic.gs - Volunteer auto-assignment
 * - 4_timeoffslogic.gs - Timeoff request management
 * - 5_printschedule.gs - Enhanced liturgical print schedules
 * - debug.gs - Diagnostic and testing functions
 * - sidebar.html - Enhanced user interface
 */

/**
 * OAuth Scopes:
 * This script requires the following permissions:
 *
 * @customfunction
 *
 * Required scopes:
 * - https://www.googleapis.com/auth/spreadsheets (full access to create/edit spreadsheets)
 *   Needed for: Archive system (creates new spreadsheet files), all sheet operations
 *
 * - https://www.googleapis.com/auth/forms (access to Google Forms)
 *   Needed for: Timeoff form updates (dynamic date checkboxes)
 *
 * - https://www.googleapis.com/auth/drive.file (access to Drive files created by this app)
 *   Needed for: Archive file organization (moving archives to folders)
 *
 * Note: @OnlyCurrentDoc is NOT used because the archive system requires
 * the ability to create new spreadsheet files for year-end archives.
 */

/**
 * Force authorization for all required permissions.
 * Run this function once to trigger the authorization dialog.
 *
 * This function requests:
 * - Spreadsheet access (including ability to create new spreadsheets)
 * - Google Forms access (for timeoff form updates)
 * - Google Drive access (for archive file organization)
 */
/**
 * Simple function to trigger OAuth authorization.
 * Just uses the APIs we need - this triggers the permission dialog.
 */
/**
 * Dummy function to trigger OAuth authorization.
 * The scopes in appsscript.json will trigger the auth dialog automatically.
 */
function authorizeAllPermissions() {
  // Don't call any restricted APIs - just return
  // The auth dialog will appear automatically because of appsscript.json
  return "Authorization dialog should appear. Please approve the requested permissions.";
}
/**
 * This script manages the Parish Liturgical Scheduler with enhanced liturgical print features.
 * It adds a custom menu on open and shows the enhanced sidebar.
 */

/**
 * Runs when the spreadsheet is opened. Adds a custom menu.
 * @param {object} e The event object.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('Parish Scheduler')
      .addItem('Show Sidebar', 'showSidebar')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Admin Tools')
          .addItem('Authorize Permissions', 'authorizeAllPermissions')
          .addSeparator()
          .addItem('Validate Data', 'showDataValidation')
          .addItem('Setup Timeoff Validation', 'TIMEOFFS_setupValidation')
          .addItem('Setup Assignment Validation', 'ONEDIT_setupConditionalFormatting')
          .addItem('Format Assignment Checkboxes', 'setupAssignmentCheckboxes')
          .addSeparator()
          .addItem('Update Timeoff Form', 'promptUpdateTimeoffForm')
          .addSeparator()
          .addItem('Archive Current Year', 'ARCHIVE_promptArchiveCurrentYear')
          .addItem('View Archives', 'ARCHIVE_showArchiveList')
          .addItem('Clear Old Data', 'ARCHIVE_promptClearOldData')
          .addSeparator()
          .addSubMenu(SpreadsheetApp.getUi().createMenu('Public Schedule')
              .addItem('Publish Schedule...', 'publishCurrentMonthSchedule')
              .addItem('Get Public Schedule Link', 'getPublicScheduleLink')
              .addSeparator()
              .addItem('Enable Auto-Publish', 'enableAutoPublish')
              .addItem('Disable Auto-Publish', 'disableAutoPublish')
              .addItem('Auto-Publish Status', 'showAutoPublishStatus'))
          .addSeparator()
          .addItem('Diagnose Assignment Issues', 'runAssignmentDiagnostic')
          .addItem('Debug Functions', 'showDebugPanel')
          .addItem('Export Data', 'exportCurrentSchedule'))
      .addToUi();
}

/**
 * Shows the enhanced HTML sidebar.
 * This function is called by the menu item.
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Parish Scheduler')
      .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Fetches the list of months from the LiturgicalCalendar sheet.
 * Returns objects with both display names and values for better UX.
 * This function is called by the sidebar's JavaScript.
 * @returns {Array<object>} A list of month objects with {value: "2026-01", display: "January 2026"}.
 */
function getMonthsForSidebar() {
  try {
    const calendarData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    if (calendarData.length === 0) {
      return [];
    }
    
    const calendarCols = CONSTANTS.COLS.CALENDAR;
    const monthsSet = new Set();
    
    for (const row of calendarData) {
      const date = new Date(row[calendarCols.DATE - 1]);
      if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        monthsSet.add(`${year}-${month}`);
      }
    }
    
    // Convert to array and sort
    const sortedMonths = Array.from(monthsSet).sort();
    
    // Convert to objects with display names
    const monthObjects = sortedMonths.map(monthValue => {
      const [year, month] = monthValue.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const displayName = date.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      return {
        value: monthValue,    // "2026-01" for backend processing
        display: displayName  // "January 2026" for user display
      };
    });
    
    Logger.log(`Returning ${monthObjects.length} month objects`);
    return monthObjects;
    
  } catch (e) {
    Logger.log(`Error in getMonthsForSidebar: ${e}`);
    throw new Error(`Could not load months. Error: ${e.message}`);
  }
}

/**
 * Get unique active ministry names from Ministries sheet for sidebar dropdown.
 * @returns {string[]} Sorted array of ministry names
 */
function getActiveMinistries() {
  try {
    const data = HELPER_readSheetData(CONSTANTS.SHEETS.MINISTRIES);
    const cols = CONSTANTS.COLS.MINISTRIES;

    const ministries = new Set();

    for (const row of data) {
      const ministry = HELPER_safeArrayAccess(row, cols.MINISTRY_NAME - 1);
      const isActive = HELPER_safeArrayAccess(row, cols.IS_ACTIVE - 1, true);

      if (ministry && isActive === true) {
        ministries.add(ministry);
      }
    }

    const sortedMinistries = Array.from(ministries).sort();
    Logger.log(`Loaded ${sortedMinistries.length} active ministries: ${sortedMinistries.join(', ')}`);

    return sortedMinistries;
  } catch (e) {
    Logger.log(`Error in getActiveMinistries: ${e.message}`);
    // Return fallback ministries if sheet cannot be read
    return ['Lector', 'Eucharistic Minister'];
  }
}

/**
 * Gets the count of pending timeoff requests.
 * @returns {number} Number of pending timeoff requests.
 */
function getPendingTimeoffsCount() {
  try {
    if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONSTANTS.SHEETS.TIMEOFFS)) {
      return 0; // No timeoffs sheet exists
    }
    
    const pending = TIMEOFFS_getPendingRequests();
    Logger.log(`Found ${pending.length} pending timeoff requests`);
    return pending.length;
  } catch (e) {
    Logger.log(`Error getting pending timeoffs count: ${e}`);
    return 0;
  }
}

/**
 * Gets the count of unassigned roles for the specified month.
 * @param {string} monthString The month to check (e.g., "2026-01").
 * @returns {number} Number of unassigned roles.
 */
function getUnassignedRolesCount(monthString) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    
    if (!assignmentsSheet) {
      return 0;
    }
    
    const data = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    const header = data.shift(); // Remove header
    
    let unassignedCount = 0;
    
    for (const row of data) {
      if (row[0] === "") continue; // Skip blank rows
      
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      const assignedVolunteerId = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
      const assignedVolunteerName = row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1];
      
      // Count as unassigned if it's the right month and has no volunteer assigned
      if (rowMonthYear === monthString && !assignedVolunteerId && !assignedVolunteerName) {
        unassignedCount++;
      }
    }
    
    Logger.log(`Found ${unassignedCount} unassigned roles for ${monthString}`);
    return unassignedCount;
  } catch (e) {
    Logger.log(`Error getting unassigned roles count: ${e}`);
    return 0;
  }
}

// ---================================---
//      SIDEBAR TRIGGER FUNCTIONS
// ---================================---

/**
 * (SIDEBAR) Triggers the calendar generation.
 * @returns {string} A success message.
 */
function triggerCalendarGeneration() {
  return CALENDAR_generateLiturgicalCalendar();
}

/**
 * (SIDEBAR) Triggers the schedule generation.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerScheduleGeneration(monthString) {
  return SCHEDULE_generateScheduleForMonth(monthString);
}

/**
 * (SIDEBAR) Analyzes pending timeoffs relevant to the selected month and opens the sheet.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A summary message.
 */
function reviewTimeoffs(monthString) {
  try {
    // STEP 1: Update the Google Form with masses for this month
    try {
      const updateResult = TIMEOFFS_updateFormForMonth(monthString);
      Logger.log(`Form update: ${updateResult}`);
    } catch (formError) {
      // Non-critical error - continue even if form update fails
      Logger.log(`Warning: Could not update form: ${formError.message}`);
    }

    // STEP 2: Get pending requests
    const pending = TIMEOFFS_getPendingRequests();

    if (pending.length === 0) {
      // Still open the sheet so user can see all timeoffs
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
      if (timeoffsSheet) {
        ss.setActiveSheet(timeoffsSheet);
      }
      return "No pending timeoff requests to review. Timeoff form has been updated with current month's masses.";
    }

    // Parse the month to get date range
    const [year, month] = monthString.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59); // Last day of month

    // Analyze which timeoffs affect this month
    const affectingMonth = [];
    const outsideMonth = [];

    for (const request of pending) {
      const timeoffStart = new Date(request.startDate);
      const timeoffEnd = new Date(request.endDate);

      // Check if timeoff overlaps with the month
      const overlaps = (timeoffStart <= monthEnd && timeoffEnd >= monthStart);

      if (overlaps) {
        // Calculate which dates in the month are affected
        const effectiveStart = timeoffStart > monthStart ? timeoffStart : monthStart;
        const effectiveEnd = timeoffEnd < monthEnd ? timeoffEnd : monthEnd;

        affectingMonth.push({
          name: request.name,
          start: request.startDate,
          end: request.endDate,
          effectiveStart: effectiveStart,
          effectiveEnd: effectiveEnd,
          hasWarnings: request.reviewNotes && request.reviewNotes.includes("⚠️"),
          warnings: request.reviewNotes || ""
        });
      } else {
        outsideMonth.push({
          name: request.name,
          start: request.startDate,
          end: request.endDate
        });
      }
    }

    // Build summary message
    const monthName = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    let summary = `Timeoff Analysis for ${monthName}:\n\n`;

    if (affectingMonth.length > 0) {
      summary += `✓ ${affectingMonth.length} pending timeoff${affectingMonth.length > 1 ? 's' : ''} affect this month:\n`;

      affectingMonth.forEach(timeoff => {
        const startStr = HELPER_formatDate(timeoff.start, 'short');
        const endStr = HELPER_formatDate(timeoff.end, 'short');
        const warningFlag = timeoff.hasWarnings ? ' ⚠️' : '';
        summary += `  • ${timeoff.name}: ${startStr} to ${endStr}${warningFlag}\n`;
      });
    } else {
      summary += `✓ No pending timeoffs affect ${monthName}\n`;
    }

    if (outsideMonth.length > 0) {
      summary += `\n📋 ${outsideMonth.length} other pending timeoff${outsideMonth.length > 1 ? 's' : ''} outside this month\n`;
    }

    // Count how many have warnings vs clean
    const cleanRequests = pending.filter(req => !req.reviewNotes || !req.reviewNotes.includes("⚠️"));
    const warningRequests = pending.length - cleanRequests.length;

    summary += `\n${cleanRequests.length} clean request${cleanRequests.length !== 1 ? 's' : ''}, ${warningRequests} with warning${warningRequests !== 1 ? 's' : ''}`;

    Logger.log(summary);

    // Ask user if they want to bulk approve clean timeoffs
    const promptMessage = summary + "\n\n" +
                          "Do you want to BULK APPROVE all clean timeoffs (without ⚠️ warnings)?\n\n" +
                          "• YES = Auto-approve " + cleanRequests.length + " clean request" + (cleanRequests.length !== 1 ? 's' : '') + "\n" +
                          "• NO = Open sheet for manual review";

    const confirmed = HELPER_confirmAction(
      'Review Timeoffs',
      promptMessage,
      { type: 'info' }
    );

    if (confirmed) {
      // Bulk approve clean requests
      const result = TIMEOFFS_bulkApprovePending();
      Logger.log(result);

      // Open the sheet to show what was approved (clear filters to see approved status)
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
      if (timeoffsSheet) {
        ss.setActiveSheet(timeoffsSheet);

        // Clear any existing filters so user can see approved requests
        try {
          const existingFilter = timeoffsSheet.getFilter();
          if (existingFilter) {
            existingFilter.remove();
          }
        } catch (e) {
          Logger.log(`Note: Could not clear filter: ${e.message}`);
        }
      }

      return result + "\n\nTimeoffs sheet opened. Check Status column for approved requests.";
    } else {
      // Manual review - open the sheet with filter showing only pending
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
      if (timeoffsSheet) {
        ss.setActiveSheet(timeoffsSheet);

        // Apply filter to show only pending requests
        const lastRow = timeoffsSheet.getLastRow();
        if (lastRow > 1) {
          const dataRange = timeoffsSheet.getRange(1, 1, lastRow, timeoffsSheet.getLastColumn());
          const filter = dataRange.getFilter() || dataRange.createFilter();

          // Filter Status column to show only "Pending"
          const statusCol = CONSTANTS.COLS.TIMEOFFS.STATUS;
          filter.setColumnFilterCriteria(statusCol,
            SpreadsheetApp.newFilterCriteria().whenTextEqualTo("Pending").build());
        }
      }

      return "Opening Timeoffs sheet for manual review...\n\nFiltered to show only 'Pending' requests. Update Status column to 'Approved' or 'Rejected'.";
    }

  } catch (e) {
    Logger.log(`Error in reviewTimeoffs: ${e}`);
    throw new Error(`Could not analyze timeoffs: ${e.message}`);
  }
}

/**
 * (MENU) Prompts user to select a month and updates the timeoff form with that month's masses.
 * Accessed via: Admin Tools > Update Timeoff Form
 */
function promptUpdateTimeoffForm() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Get available months
    const months = getMonthsForSidebar();

    if (months.length === 0) {
      HELPER_showError(
        'No Calendar Data',
        'Please generate the liturgical calendar first.',
        'calendar'
      );
      return;
    }

    // Build prompt with month options
    let promptText = 'Select a month to update the timeoff form:\n\n';
    months.forEach((m, idx) => {
      promptText += `${idx + 1}. ${m.display}\n`;
    });
    promptText += '\nEnter the number (1-' + months.length + '):';

    const result = HELPER_promptUser(
      'Update Timeoff Form',
      promptText,
      {
        required: true,
        validator: (value) => {
          const selection = parseInt(value);
          if (isNaN(selection) || selection < 1 || selection > months.length) {
            return { valid: false, error: `Please enter a number between 1 and ${months.length}` };
          }
          return { valid: true };
        }
      }
    );

    if (!result.success) {
      return; // User cancelled
    }

    const selection = parseInt(result.value);
    const selectedMonth = months[selection - 1].value;

    // Update the form
    const updateResult = TIMEOFFS_updateFormForMonth(selectedMonth);
    HELPER_showSuccess('Timeoff Form Updated', updateResult);

  } catch (e) {
    HELPER_showError('Update Form Failed', e, 'form');
    Logger.log(`ERROR in promptUpdateTimeoffForm: ${e.message}\n${e.stack}`);
  }
}

/**
 * Setup function to format IS_ANTICIPATED column as checkboxes for all existing data.
 * Run once after adding the IS_ANTICIPATED column to convert text TRUE/FALSE to checkboxes.
 * Accessed via: Admin Tools > Format Assignment Checkboxes
 */
function setupAssignmentCheckboxes() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!assignmentsSheet) {
      throw new Error('Assignments sheet not found');
    }

    const lastRow = assignmentsSheet.getLastRow();

    if (lastRow <= 1) {
      HELPER_showAlert('No Data', 'No assignment data found to format.', 'info');
      return;
    }

    // Format IS_ANTICIPATED column (column 7) as checkboxes for all data rows
    const checkboxRange = assignmentsSheet.getRange(
      2, // Start from row 2 (skip header)
      CONSTANTS.COLS.ASSIGNMENTS.IS_ANTICIPATED,
      lastRow - 1, // All data rows
      1 // Single column
    );

    const checkboxValidation = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .setAllowInvalid(false)
      .build();

    checkboxRange.setDataValidation(checkboxValidation);

    HELPER_showSuccess(
      'Checkboxes Formatted',
      `Formatted ${lastRow - 1} rows in the IS_ANTICIPATED column as checkboxes.`
    );

    Logger.log(`Successfully formatted IS_ANTICIPATED column as checkboxes for ${lastRow - 1} rows`);

  } catch (e) {
    HELPER_showError('Format Checkboxes Failed', e, 'schedule');
    Logger.log(`ERROR in setupAssignmentCheckboxes: ${e.message}\n${e.stack}`);
  }
}

/**
 * (SIDEBAR) Triggers the auto-assignment - FIXED FUNCTION CALL.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerAssignment(monthString) {
  return ASSIGNMENT_autoAssignRolesForMonthOptimized(monthString);
}

/**
 * (SIDEBAR) Finds and helps assign substitutes for unassigned roles.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function findSubstituteAssignments(monthString) {
  try {
    const unassignedCount = getUnassignedRolesCount(monthString);
    
    if (unassignedCount === 0) {
      return `All roles are assigned for ${monthString}. No substitutes needed.`;
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if SubstituteHelp sheet exists, create if not
    let substituteSheet = ss.getSheetByName('SubstituteHelp');
    if (!substituteSheet) {
      substituteSheet = ss.insertSheet('SubstituteHelp');
      
      // Add headers
      substituteSheet.getRange('A1').setValue('Unassigned Roles - Substitute Help');
      substituteSheet.getRange('A2').setValue('Month: ' + monthString);
      substituteSheet.getRange('A4').setValue('Date');
      substituteSheet.getRange('B4').setValue('Time');
      substituteSheet.getRange('C4').setValue('Mass');
      substituteSheet.getRange('D4').setValue('Ministry Role');
      substituteSheet.getRange('E4').setValue('Suggested Volunteers');
      substituteSheet.getRange('F4').setValue('Action Needed');
      
      // Format headers
      const headerRange = substituteSheet.getRange('A4:F4');
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#fff2cc');
    }
    
    // Get unassigned roles and suggest volunteers
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    const assignData = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    assignData.shift(); // Remove header
    
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const volunteers = buildVolunteerMapOptimized(volunteerData);
    
    const substituteData = [];
    
    for (const row of assignData) {
      if (row[0] === "") continue;
      
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      const assignedVolunteerId = row[assignCols.ASSIGNED_VOLUNTEER_ID - 1];
      const assignedVolunteerName = row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1];
      
      if (rowMonthYear === monthString && !assignedVolunteerId && !assignedVolunteerName) {
        const roleNeeded = row[assignCols.MINISTRY_ROLE - 1];
        const roleLower = roleNeeded.toLowerCase();
        
        // Find volunteers who can do this role
        const suggestions = [];
        for (const vol of volunteers.values()) {
          if (vol.ministries.includes(roleLower)) {
            suggestions.push(vol.name);
          }
        }
        
        substituteData.push([
          row[assignCols.DATE - 1],
          row[assignCols.TIME - 1],
          row[assignCols.DESCRIPTION - 1],
          roleNeeded,
          suggestions.slice(0, 3).join(', ') || 'No qualified volunteers found',
          'Manual assignment needed'
        ]);
      }
    }
    
    // Clear old data and write new data
    if (substituteData.length > 0) {
      const lastRow = substituteSheet.getLastRow();
      if (lastRow > 4) {
        substituteSheet.getRange(5, 1, lastRow - 4, 6).clearContent();
      }
      
      substituteSheet.getRange(5, 1, substituteData.length, 6).setValues(substituteData);
      
      // Format the data
      const dataRange = substituteSheet.getRange(5, 1, substituteData.length, 6);
      dataRange.setBorder(true, true, true, true, true, true);
    }
    
    return `Found ${unassignedCount} unassigned roles. Substitute suggestions have been prepared in the 'SubstituteHelp' sheet.`;
    
  } catch (e) {
    Logger.log(`Error finding substitute assignments: ${e}`);
    throw new Error(`Could not find substitute assignments: ${e.message}`);
  }
}

// ---================================---
//      MENU HELPER FUNCTIONS
// ---================================---

/**
 * Exports the current schedule to a new spreadsheet.
 */
function exportCurrentSchedule() {
  try {
    const config = HELPER_readConfig();
    const scheduleYear = config["Year to Schedule"];
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    
    // Create new spreadsheet for export
    const newSs = SpreadsheetApp.create(`Parish Schedule Export - ${scheduleYear}`);
    const newSheet = newSs.getActiveSheet();
    newSheet.setName('Schedule');
    
    // Copy assignment data
    const data = assignmentsSheet.getDataRange().getValues();
    newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    
    // Format
    const headerRange = newSheet.getRange(1, 1, 1, data[0].length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#e6f4ea');
    
    const url = newSs.getUrl();
    HELPER_showSuccess(
      'Export Complete',
      `Schedule exported successfully!\n\nNew spreadsheet created:\n${url}`
    );

  } catch (e) {
    HELPER_showError('Export Failed', e, 'schedule');
  }
}

/**
 * Shows data validation results in a dialog.
 */
function showDataValidation() {
  try {
    const message = runDataValidation();
    // runDataValidation() returns a formatted string, so we'll show it as-is
    HELPER_showAlert('Data Validation', message, 'info');
  } catch (e) {
    HELPER_showError('Validation Failed', e, 'validation');
  }
}

/**
 * Shows debug panel information.
 */
function showDebugPanel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let message = 'DEBUG INFORMATION:\n\n';
  
  // Check sheet existence
  const requiredSheets = Object.values(CONSTANTS.SHEETS);
  message += 'SHEET STATUS:\n';
  
  for (const sheetName of requiredSheets) {
    const sheet = ss.getSheetByName(sheetName);
    message += `${sheetName}: ${sheet ? '✓ Exists' : '✗ Missing'}\n`;
  }
  
  message += '\nDATA STATUS:\n';
  
  try {
    const config = HELPER_readConfig();
    message += `Year to Schedule: ${config["Year to Schedule"] || 'Not set'}\n`;
    
    const calendarData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    message += `Calendar entries: ${calendarData.length}\n`;
    
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    message += `Volunteers: ${volunteerData.length}\n`;
    
    const assignmentData = HELPER_readSheetData(CONSTANTS.SHEETS.ASSIGNMENTS);
    message += `Assignments: ${assignmentData.length}\n`;
    
  } catch (e) {
    message += `Error reading data: ${e.message}\n`;
  }

  HELPER_showAlert('Debug Information', message, 'info');
}
