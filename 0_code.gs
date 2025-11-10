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
 * (SIDEBAR) Generates an enhanced printable schedule with professional formatting.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function generatePrintableSchedule(monthString) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or get the enhanced monthly view sheet
    let monthlySheet = ss.getSheetByName('MonthlyView');
    if (!monthlySheet) {
      monthlySheet = ss.insertSheet('MonthlyView');
    } else {
      // Clear existing content
      monthlySheet.clear();
    }
    
    // Set up the month display name
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    // Get parish name from config (if available)
    let parishName = "Parish Ministry Schedule"; // Default
    try {
      const config = HELPER_readConfig();
      parishName = config["Parish Name"] || "Parish Ministry Schedule";
    } catch (e) {
      // Use default if config not available
    }
    
    // Create header section
    let currentRow = 1;
    
    // Parish header
    monthlySheet.getRange(currentRow, 1).setValue(parishName);
    monthlySheet.getRange(currentRow, 1).setFontSize(16).setFontWeight('bold');
    monthlySheet.getRange(currentRow, 1, 1, 4).merge();
    currentRow++;
    
    // Schedule title
    monthlySheet.getRange(currentRow, 1).setValue(`Ministry Schedule - ${displayName}`);
    monthlySheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold');
    monthlySheet.getRange(currentRow, 1, 1, 4).merge();
    currentRow++;
    
    // Generation date
    monthlySheet.getRange(currentRow, 1).setValue(`Generated: ${new Date().toLocaleDateString()}`);
    monthlySheet.getRange(currentRow, 1).setFontSize(10).setFontStyle('italic');
    currentRow += 2; // Skip a row
    
    // Get assignment data for the month
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    const data = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    const header = data.shift();
    
    // Filter and group data by date and time
    const groupedData = new Map();
    
    for (const row of data) {
      if (row[0] === "") continue;
      
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      
      if (rowMonthYear === monthString) {
        const massDate = new Date(row[assignCols.DATE - 1]);
        const massTime = row[assignCols.TIME - 1];
        const massName = row[assignCols.MASS_NAME - 1];
        const liturgicalCelebration = row[assignCols.LITURGICAL_CELEBRATION - 1];
        
        // Create a unique key for each Mass
        const massKey = `${massDate.toDateString()}_${massTime}`;
        
        if (!groupedData.has(massKey)) {
          groupedData.set(massKey, {
            date: massDate,
            time: massTime,
            massName: massName,
            liturgicalCelebration: liturgicalCelebration,
            ministries: []
          });
        }
        
        // Add ministry role to this mass
        groupedData.get(massKey).ministries.push({
          role: row[assignCols.MINISTRY_ROLE - 1],
          volunteer: row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED',
          status: row[assignCols.STATUS - 1] || 'Pending',
          notes: row[assignCols.NOTES - 1] || ''
        });
      }
    }
    
    // Sort masses by date and time
    const sortedMasses = Array.from(groupedData.values()).sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      return a.time.localeCompare(b.time);
    });
    
    // Generate the formatted schedule
    for (const mass of sortedMasses) {
      // Date header
      const dateStr = mass.date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      
      monthlySheet.getRange(currentRow, 1).setValue(dateStr);
      monthlySheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#e6f4ea');
      monthlySheet.getRange(currentRow, 1, 1, 4).merge();
      currentRow++;
      
      // Mass details
      const timeStr = typeof mass.time === 'string' ? mass.time : 
                     mass.time instanceof Date ? mass.time.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) : 
                     String(mass.time);
      
      monthlySheet.getRange(currentRow, 1).setValue(`${timeStr} - ${mass.massName}`);
      monthlySheet.getRange(currentRow, 1).setFontWeight('bold');
      currentRow++;
      
      // Liturgical celebration (if different from mass name)
      if (mass.liturgicalCelebration && mass.liturgicalCelebration !== mass.massName) {
        monthlySheet.getRange(currentRow, 1).setValue(`Liturgy: ${mass.liturgicalCelebration}`);
        monthlySheet.getRange(currentRow, 1).setFontStyle('italic').setFontSize(10);
        currentRow++;
      }
      
      // Ministry roles table header
      monthlySheet.getRange(currentRow, 1).setValue('Ministry Role');
      monthlySheet.getRange(currentRow, 2).setValue('Volunteer');
      monthlySheet.getRange(currentRow, 3).setValue('Status');
      monthlySheet.getRange(currentRow, 4).setValue('Notes');
      
      const headerRange = monthlySheet.getRange(currentRow, 1, 1, 4);
      headerRange.setFontWeight('bold').setBackground('#f1f3f4');
      headerRange.setBorder(true, true, true, true, true, true);
      currentRow++;
      
      // Sort ministries in a logical order
      const ministryOrder = [
        'lector 1', 'lector 2', 'psalm', 'universal prayer', 'prayers of the faithful',
        'em - captain', 'eucharistic minister - captain', 'em 1', 'em 2', 'em 3', 'em 4',
        'eucharistic minister 1', 'eucharistic minister 2', 'eucharistic minister 3',
        'usher captain', 'usher 1', 'usher 2', 'greeter', 'collection',
        'altar server 1', 'altar server 2', 'music', 'cantor', 'organist'
      ];
      
      mass.ministries.sort((a, b) => {
        const aIndex = ministryOrder.indexOf(a.role.toLowerCase());
        const bIndex = ministryOrder.indexOf(b.role.toLowerCase());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.role.localeCompare(b.role);
      });
      
      // Add ministry roles
      for (const ministry of mass.ministries) {
        monthlySheet.getRange(currentRow, 1).setValue(ministry.role);
        monthlySheet.getRange(currentRow, 2).setValue(ministry.volunteer);
        monthlySheet.getRange(currentRow, 3).setValue(ministry.status);
        monthlySheet.getRange(currentRow, 4).setValue(ministry.notes);
        
        // Format the row
        const rowRange = monthlySheet.getRange(currentRow, 1, 1, 4);
        rowRange.setBorder(true, true, true, true, false, false);
        
        // Highlight unassigned roles
        if (ministry.volunteer === 'UNASSIGNED') {
          monthlySheet.getRange(currentRow, 2).setBackground('#fce8e6');
        }
        
        currentRow++;
      }
      
      currentRow++; // Space between masses
    }
    
    // Add summary section
    currentRow++;
    monthlySheet.getRange(currentRow, 1).setValue('SUMMARY');
    monthlySheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold');
    monthlySheet.getRange(currentRow, 1, 1, 4).merge();
    currentRow++;
    
    // Count assignments
    let totalRoles = 0;
    let assignedRoles = 0;
    let unassignedRoles = 0;
    
    for (const mass of sortedMasses) {
      for (const ministry of mass.ministries) {
        totalRoles++;
        if (ministry.volunteer === 'UNASSIGNED') {
          unassignedRoles++;
        } else {
          assignedRoles++;
        }
      }
    }
    
    monthlySheet.getRange(currentRow, 1).setValue(`Total Ministry Roles: ${totalRoles}`);
    currentRow++;
    monthlySheet.getRange(currentRow, 1).setValue(`Assigned: ${assignedRoles}`);
    currentRow++;
    monthlySheet.getRange(currentRow, 1).setValue(`Still Needed: ${unassignedRoles}`);
    if (unassignedRoles > 0) {
      monthlySheet.getRange(currentRow, 1).setBackground('#fce8e6');
    }
    
    // Format the entire sheet for better printing
    monthlySheet.autoResizeColumns(1, 4);
    
    // Set column widths for optimal printing
    monthlySheet.setColumnWidth(1, 150); // Ministry Role
    monthlySheet.setColumnWidth(2, 120); // Volunteer  
    monthlySheet.setColumnWidth(3, 80);  // Status
    monthlySheet.setColumnWidth(4, 150); // Notes
    
    return `Enhanced schedule for ${displayName} has been prepared in the 'MonthlyView' sheet. Ready for printing or PDF export.`;
    
  } catch (e) {
    Logger.log(`Error generating enhanced printable schedule: ${e}`);
    throw new Error(`Could not generate enhanced printable schedule: ${e.message}`);
  }
}

/**
 * (SIDEBAR) Generates and saves a PDF version of the enhanced schedule.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message with PDF link.
 */
function generateSchedulePDF(monthString) {
  try {
    // First generate the enhanced schedule
    generatePrintableSchedule(monthString);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('MonthlyView');
    
    if (!sheet) {
      throw new Error('MonthlyView sheet not found. Please generate the schedule first.');
    }
    
    // Create PDF export URL
    const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?'
      + 'format=pdf'
      + '&size=letter'
      + '&portrait=false'  // Landscape for better fit
      + '&fitw=true'       // Fit to width
      + '&top_margin=0.5'
      + '&bottom_margin=0.5'
      + '&left_margin=0.5'
      + '&right_margin=0.5'
      + '&gridlines=false' // Cleaner appearance
      + '&gid=' + sheet.getSheetId();
    
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    // Create filename
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(' ', '_');
    
    const blob = response.getBlob();
    blob.setName(`Parish_Schedule_${displayName}.pdf`);
    
    // Save to Drive
    const pdfFile = DriveApp.createFile(blob);
    
    // Make the file shareable (view access)
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileUrl = pdfFile.getUrl();
    Logger.log(`PDF created: ${fileUrl}`);
    
    return `PDF schedule created and saved to Google Drive. Access at: ${fileUrl}`;
    
  } catch (e) {
    Logger.log(`Error generating PDF: ${e}`);
    // Fallback to regular schedule if PDF generation fails
    return `PDF generation unavailable. Please use the MonthlyView sheet for printing. ${e.message}`;
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
