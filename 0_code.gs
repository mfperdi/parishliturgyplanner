/**
 * ====================================================================
 * PARISH LITURGICAL SCHEDULER - GROUPED WORKFLOW VERSION
 * ====================================================================
 * File Structure:
 * - constants.gs - Global constants and column maps
 * - helper.gs - Reusable helper functions
 * - main.gs - Menu, sidebar, and wrapper functions
 * - 1_calendarlogic.gs - Liturgical calendar generation
 * - 1a_calendardates.gs - Date calculations
 * - 1b_calendarseasons.gs - Seasonal celebrations
 * - 2_schedulelogic.gs - Mass schedule generation
 * - 3_assignmentlogic.gs - Volunteer auto-assignment
 * - 4_timeoffslogic.gs - Timeoff request management
 * - debug.gs - Diagnostic and testing functions
 * - Sidebar.html - User interface
 */

/**
 * @OnlyCurrentDoc
 * This script manages the Parish Liturgical Scheduler with grouped workflow.
 * It adds a custom menu on open and shows the sidebar.
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
          .addItem('Review Timeoffs', 'showTimeoffReview')
          .addItem('Export Schedule', 'exportCurrentSchedule')
          .addItem('Debug Functions', 'showDebugPanel'))
      .addToUi();
}

/**
 * Shows the main HTML sidebar.
 * This function is called by the menu item.
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Parish Scheduler')
      .setWidth(320);
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
 * (SIDEBAR) Opens timeoff review interface.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function reviewTimeoffs(monthString) {
  try {
    const pending = TIMEOFFS_getPendingRequests();
    
    if (pending.length === 0) {
      return "No pending timeoff requests to review.";
    }
    
    // For now, auto-approve non-problematic requests
    let approved = 0;
    let needsReview = 0;
    
    for (const request of pending) {
      // Auto-approve if no warning flags in review notes
      if (!request.reviewNotes || !request.reviewNotes.includes("⚠️")) {
        TIMEOFFS_approveRequest(request.rowNumber);
        approved++;
      } else {
        needsReview++;
      }
    }
    
    if (needsReview > 0) {
      return `Processed ${approved} timeoff requests automatically. ${needsReview} requests need manual review in the Timeoffs sheet.`;
    } else {
      return `Successfully approved ${approved} timeoff requests.`;
    }
  } catch (e) {
    Logger.log(`Error in reviewTimeoffs: ${e}`);
    throw new Error(`Could not process timeoffs: ${e.message}`);
  }
}

/**
 * (SIDEBAR) Triggers the auto-assignment.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerAssignment(monthString) {
  return ASSIGNMENT_autoAssignRolesForMonth(monthString);
}

/**
 * (SIDEBAR) Generates a printable schedule.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function generatePrintableSchedule(monthString) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if MonthlyView sheet exists
    let monthlySheet = ss.getSheetByName('MonthlyView');
    if (!monthlySheet) {
      // Create MonthlyView sheet if it doesn't exist
      monthlySheet = ss.insertSheet('MonthlyView');
      
      // Add headers
      monthlySheet.getRange('A1').setValue('Month to View:');
      monthlySheet.getRange('B1').setValue('Select Month');
      monthlySheet.getRange('A3').setValue('Date');
      monthlySheet.getRange('B3').setValue('Time');
      monthlySheet.getRange('C3').setValue('Mass');
      monthlySheet.getRange('D3').setValue('Ministry');
      monthlySheet.getRange('E3').setValue('Volunteer');
      monthlySheet.getRange('F3').setValue('Status');
      monthlySheet.getRange('G3').setValue('Notes');
      
      // Format headers
      const headerRange = monthlySheet.getRange('A3:G3');
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e6f4ea');
    }
    
    // Set the month to view
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    monthlySheet.getRange('B1').setValue(displayName);
    
    // Get assignment data for the month
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    const data = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    const header = data.shift();
    
    const monthData = [];
    
    for (const row of data) {
      if (row[0] === "") continue;
      
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      
      if (rowMonthYear === monthString) {
        monthData.push([
          row[assignCols.DATE - 1],
          row[assignCols.TIME - 1],
          row[assignCols.MASS_NAME - 1],
          row[assignCols.MINISTRY_ROLE - 1],
          row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED',
          row[assignCols.STATUS - 1] || 'Pending',
          row[assignCols.NOTES - 1] || ''
        ]);
      }
    }
    
    // Clear old data and write new data
    if (monthData.length > 0) {
      // Clear old data (keep headers)
      const lastRow = monthlySheet.getLastRow();
      if (lastRow > 3) {
        monthlySheet.getRange(4, 1, lastRow - 3, 7).clearContent();
      }
      
      // Write new data
      monthlySheet.getRange(4, 1, monthData.length, 7).setValues(monthData);
      
      // Format the data
      const dataRange = monthlySheet.getRange(4, 1, monthData.length, 7);
      dataRange.setBorder(true, true, true, true, true, true);
      
      // Highlight unassigned roles
      const conditionalFormatRules = monthlySheet.getConditionalFormatRules();
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([monthlySheet.getRange(4, 5, monthData.length, 1)])
        .whenTextEqualTo('UNASSIGNED')
        .setBackground('#fce8e6')
        .build();
      conditionalFormatRules.push(rule);
      monthlySheet.setConditionalFormatRules(conditionalFormatRules);
    }
    
    return `Schedule for ${displayName} has been prepared in the 'MonthlyView' sheet. You can print or export this sheet.`;
    
  } catch (e) {
    Logger.log(`Error generating printable schedule: ${e}`);
    throw new Error(`Could not generate printable schedule: ${e.message}`);
  }
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
    const volunteers = ASSIGNMENT_buildVolunteerMap(volunteerData);
    
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
          row[assignCols.MASS_NAME - 1],
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
//      ADMIN HELPER FUNCTIONS
// ---================================---

/**
 * Shows a timeoff review dialog.
 */
function showTimeoffReview() {
  const pending = TIMEOFFS_getPendingRequests();
  
  if (pending.length === 0) {
    SpreadsheetApp.getUi().alert('No pending timeoff requests to review.');
    return;
  }
  
  let message = `Found ${pending.length} pending timeoff requests:\n\n`;
  
  for (let i = 0; i < Math.min(5, pending.length); i++) {
    const req = pending[i];
    message += `${i + 1}. ${req.name} (${req.startDate} - ${req.endDate})\n`;
    if (req.reviewNotes) {
      message += `   Notes: ${req.reviewNotes}\n`;
    }
    message += '\n';
  }
  
  if (pending.length > 5) {
    message += `... and ${pending.length - 5} more requests.\n\n`;
  }
  
  message += 'Go to the Timeoffs sheet to review and approve/reject requests.';
  
  SpreadsheetApp.getUi().alert('Timeoff Review', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

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
    SpreadsheetApp.getUi().alert(
      'Export Complete', 
      `Schedule exported successfully!\n\nNew spreadsheet created:\n${url}`, 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('Export Error', `Could not export schedule: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
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
  
  SpreadsheetApp.getUi().alert('Debug Information', message, SpreadsheetApp.getUi().ButtonSet.OK);
}
