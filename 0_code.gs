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
 * @OnlyCurrentDoc
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
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Print Schedules')
          .addItem('Liturgical Schedule', 'showLiturgicalScheduleMenu')
          .addItem('Standard Schedule', 'generateCurrentMonthSchedule')
          .addItem('Export PDF', 'exportCurrentMonthPDF'))
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Admin Tools')
          .addItem('Validate Data', 'showDataValidation')
          .addSeparator()
          .addItem('Review Timeoffs', 'showTimeoffReview')
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
 * (SIDEBAR) Triggers the auto-assignment - FIXED FUNCTION CALL.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function triggerAssignment(monthString) {
  return ASSIGNMENT_autoAssignRolesForMonthOptimized(monthString);
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
    
    // Group data by liturgical celebration
    const liturgicalData = PRINT_buildLiturgicalData(monthString);
    const assignmentsByLiturgy = new Map();
    
    for (const row of data) {
      if (row[0] === "") continue;
      
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      
      if (rowMonthYear === monthString) {
        const assignment = {
          date: new Date(row[assignCols.DATE - 1]),
          time: row[assignCols.TIME - 1],
          massName: row[assignCols.MASS_NAME - 1],
          liturgicalCelebration: row[assignCols.LITURGICAL_CELEBRATION - 1],
          role: row[assignCols.MINISTRY_ROLE - 1],
          volunteer: row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED',
          status: row[assignCols.STATUS - 1] || 'Pending',
          notes: row[assignCols.NOTES - 1] || ''
        };
        
        const celebration = assignment.liturgicalCelebration;
        if (!assignmentsByLiturgy.has(celebration)) {
          assignmentsByLiturgy.set(celebration, []);
        }
        assignmentsByLiturgy.get(celebration).push(assignment);
      }
    }
    
    // Get liturgical celebrations in chronological order
    const sortedCelebrations = Array.from(liturgicalData.keys()).sort((a, b) => {
      const aFirstDate = liturgicalData.get(a).dates[0];
      const bFirstDate = liturgicalData.get(b).dates[0];
      return aFirstDate.getTime() - bFirstDate.getTime();
    });
    
    // Generate the formatted schedule grouped by liturgical celebrations
    for (const celebration of sortedCelebrations) {
      const celebrationAssignments = assignmentsByLiturgy.get(celebration) || [];
      
      if (celebrationAssignments.length === 0) continue; // Skip if no masses scheduled
      
      const liturgyInfo = liturgicalData.get(celebration);
      
      // Get the background color using the consolidated liturgical color system
      const bgColor = liturgyInfo && liturgyInfo.color 
        ? HELPER_getLiturgicalColorHex(liturgyInfo.color)
        : HELPER_getLiturgicalColorHex('White'); // Default to white
      
      // Liturgical Celebration header
      monthlySheet.getRange(currentRow, 1).setValue(celebration);
      monthlySheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setBackground(bgColor);
      monthlySheet.getRange(currentRow, 1, 1, 5).merge();
      currentRow++;
      
      // Rank / Season / Color info - same background color as celebration
      if (liturgyInfo) {
        const rankSeasonColor = `${liturgyInfo.rank} / ${liturgyInfo.season} / ${liturgyInfo.color}`;
        monthlySheet.getRange(currentRow, 1).setValue(rankSeasonColor);
        monthlySheet.getRange(currentRow, 1).setFontSize(10).setFontStyle('italic').setBackground(bgColor);
        monthlySheet.getRange(currentRow, 1, 1, 5).merge();
        currentRow++;
      }
      
      // Table headers - black background with white text
      monthlySheet.getRange(currentRow, 1).setValue('Date');
      monthlySheet.getRange(currentRow, 2).setValue('Time');
      monthlySheet.getRange(currentRow, 3).setValue('Mass Name');
      monthlySheet.getRange(currentRow, 4).setValue('Ministry Role');
      monthlySheet.getRange(currentRow, 5).setValue('Assigned Volunteer');
      
      const headerRange = monthlySheet.getRange(currentRow, 1, 1, 5);
      headerRange.setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
      headerRange.setBorder(true, true, true, true, true, true);
      currentRow++;
      
      // Group assignments by date/time/mass for cleaner display
      const massByDateTime = new Map();
      
      for (const assignment of celebrationAssignments) {
        const massKey = `${assignment.date.toDateString()}_${assignment.time}_${assignment.massName}`;
        if (!massByDateTime.has(massKey)) {
          massByDateTime.set(massKey, {
            date: assignment.date,
            time: assignment.time,
            massName: assignment.massName,
            assignments: []
          });
        }
        massByDateTime.get(massKey).assignments.push(assignment);
      }
      
      // Sort masses by date and time
      const sortedMasses = Array.from(massByDateTime.values()).sort((a, b) => {
        if (a.date.getTime() !== b.date.getTime()) {
          return a.date.getTime() - b.date.getTime();
        }
        
        // Convert times to comparable 24-hour format for proper sorting
        const convertTimeToMinutes = (time) => {
          let timeStr = typeof time === 'string' ? time : 
                       time instanceof Date ? time.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) :
                       String(time);
          
          // Handle different time formats
          timeStr = timeStr.trim().toUpperCase();
          
          // Parse time string (supports formats like "8:00 AM", "12:00 PM", "17:00", etc.)
          let match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
          if (!match) {
            // If no match, try just hour
            match = timeStr.match(/(\d{1,2})\s*(AM|PM)?/);
            if (match) {
              match = [match[0], match[1], '00', match[2]]; // Add minutes as '00'
            } else {
              return 0; // Default if can't parse
            }
          }
          
          let hours = parseInt(match[1]);
          let minutes = parseInt(match[2]);
          let meridiem = match[3];
          
          // Convert to 24-hour format
          if (meridiem === 'AM' && hours === 12) {
            hours = 0;
          } else if (meridiem === 'PM' && hours !== 12) {
            hours += 12;
          }
          
          return hours * 60 + minutes;
        };
        
        const timeA = convertTimeToMinutes(a.time);
        const timeB = convertTimeToMinutes(b.time);
        
        return timeA - timeB;
      });
      
      // Add assignment rows with grouped formatting
      for (const mass of sortedMasses) {
        // Sort assignments within the mass by role
        mass.assignments.sort((a, b) => a.role.localeCompare(b.role));
        
        for (let i = 0; i < mass.assignments.length; i++) {
          const assignment = mass.assignments[i];
          
          // Only show date/time/mass name on first row of each mass
          if (i === 0) {
            // Format date
            const dateStr = mass.date.toLocaleDateString('en-US', { 
              month: 'numeric', 
              day: 'numeric',
              year: 'numeric'
            });
            
            // Format time
            const timeStr = typeof mass.time === 'string' ? mass.time : 
                           mass.time instanceof Date ? mass.time.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) : 
                           String(mass.time);
            
            monthlySheet.getRange(currentRow, 1).setValue(dateStr);
            monthlySheet.getRange(currentRow, 2).setValue(timeStr);
            monthlySheet.getRange(currentRow, 3).setValue(mass.massName);
          }
          // Leave date/time/mass name blank for subsequent rows of the same mass
          
          monthlySheet.getRange(currentRow, 4).setValue(assignment.role);
          monthlySheet.getRange(currentRow, 5).setValue(assignment.volunteer);
          
          // Format the row
          const rowRange = monthlySheet.getRange(currentRow, 1, 1, 5);
          rowRange.setBorder(true, true, true, true, false, false);
          
          // Highlight unassigned roles
          if (assignment.volunteer === 'UNASSIGNED') {
            monthlySheet.getRange(currentRow, 5).setBackground('#fce8e6');
          }
          
          currentRow++;
        }
      }
      
      currentRow++; // Space between celebrations
    }
    
    // Add summary section
    currentRow++;
    monthlySheet.getRange(currentRow, 1).setValue('SUMMARY');
    monthlySheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold');
    monthlySheet.getRange(currentRow, 1, 1, 5).merge();
    currentRow++;
    
    // Count assignments
    let totalRoles = 0;
    let assignedRoles = 0;
    let unassignedRoles = 0;
    
    for (const assignments of assignmentsByLiturgy.values()) {
      for (const assignment of assignments) {
        totalRoles++;
        if (assignment.volunteer === 'UNASSIGNED') {
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
    monthlySheet.autoResizeColumns(1, 5);
    
    // Set column widths for optimal printing (5 columns)
    monthlySheet.setColumnWidth(1, 80);  // Date
    monthlySheet.setColumnWidth(2, 70);  // Time  
    monthlySheet.setColumnWidth(3, 140); // Mass Name
    monthlySheet.setColumnWidth(4, 130); // Ministry Role
    monthlySheet.setColumnWidth(5, 140); // Assigned Volunteer
    
    return `Enhanced schedule for ${displayName} has been prepared in the 'MonthlyView' sheet. Ready for printing or PDF export.`;
    
  } catch (e) {
    Logger.log(`Error generating enhanced printable schedule: ${e}`);
    throw new Error(`Could not generate enhanced printable schedule: ${e.message}`);
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
//      MENU HELPER FUNCTIONS
// ---================================---

/**
 * Shows the liturgical schedule generation menu.
 */
function showLiturgicalScheduleMenu() {
  const ui = SpreadsheetApp.getUi();
  
  // Get available months
  try {
    const months = getMonthsForSidebar();
    if (months.length === 0) {
      ui.alert('No calendar data found. Please generate the liturgical calendar first.');
      return;
    }
    
    // Simple dialog for month selection
    const response = ui.prompt(
      'Generate Liturgical Schedule',
      `Enter month (YYYY-MM format, e.g., ${months[0].value}):`,
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() === ui.Button.OK) {
      const monthString = response.getResponseText().trim();
      
      // Validate format
      if (!/^\d{4}-\d{2}$/.test(monthString)) {
        ui.alert('Invalid format. Please use YYYY-MM (e.g., 2026-01).');
        return;
      }
      
      try {
        const result = PRINT_generateLiturgicalSchedule(monthString);
        ui.alert('Success', result, ui.ButtonSet.OK);
      } catch (e) {
        ui.alert('Error', `Could not generate liturgical schedule: ${e.message}`, ui.ButtonSet.OK);
      }
    }
    
  } catch (e) {
    ui.alert('Error', `Could not load months: ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Generates schedule for current month.
 */
function generateCurrentMonthSchedule() {
  try {
    const now = new Date();
    const monthString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const result = generatePrintableSchedule(monthString);
    SpreadsheetApp.getUi().alert('Success', result, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error', `Could not generate schedule: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Exports PDF for current month.
 */
function exportCurrentMonthPDF() {
  try {
    const now = new Date();
    const monthString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const result = PRINT_exportLiturgicalSchedulePDF(monthString);
    SpreadsheetApp.getUi().alert('PDF Export', result, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error', `Could not export PDF: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

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
 * Shows data validation results in a dialog.
 */
function showDataValidation() {
  try {
    const message = runDataValidation();
    SpreadsheetApp.getUi().alert('Data Validation', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Validation Error', `Could not run validation: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
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
