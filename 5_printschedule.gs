/**
 * ====================================================================
 * 5. ENHANCED PRINT SCHEDULE LOGIC
 * ====================================================================
 * This file contains functions for creating professional, liturgically-organized
 * printable schedules grouped by liturgical celebrations.
 */

/**
 * Main function to generate an enhanced liturgical schedule grouped by celebrations.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function PRINT_generateLiturgicalSchedule(monthString) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or get the liturgical schedule sheet
    let scheduleSheet = ss.getSheetByName('LiturgicalSchedule');
    if (!scheduleSheet) {
      scheduleSheet = ss.insertSheet('LiturgicalSchedule');
    } else {
      scheduleSheet.clear();
    }
    
    Logger.log(`Starting liturgical schedule generation for ${monthString}`);
    
    // Get month display name
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    // Get parish name from config
    let parishName = "Parish Ministry Schedule";
    try {
      const config = HELPER_readConfig();
      parishName = config["Parish Name"] || "Parish Ministry Schedule";
    } catch (e) {
      Logger.log(`Could not read parish name from config: ${e}`);
    }
    
    // Build the data structures
    const liturgicalData = PRINT_buildLiturgicalData(monthString);
    const assignmentData = PRINT_getAssignmentData(monthString);
    
    Logger.log(`Found ${liturgicalData.size} liturgical celebrations and ${assignmentData.length} assignments`);
    
    // Generate the schedule
    let currentRow = PRINT_createHeader(scheduleSheet, parishName, displayName);
    currentRow = PRINT_createLiturgicalScheduleContent(scheduleSheet, liturgicalData, assignmentData, currentRow);
    currentRow = PRINT_createSummarySection(scheduleSheet, assignmentData, currentRow);
    
    // Apply final formatting
    PRINT_formatScheduleSheet(scheduleSheet);
    
    Logger.log(`Enhanced liturgical schedule created successfully`);
    return `Enhanced liturgical schedule for ${displayName} has been created in the 'LiturgicalSchedule' sheet. Organized by liturgical celebrations.`;
    
  } catch (e) {
    Logger.log(`Error generating liturgical schedule: ${e}`);
    throw new Error(`Could not generate liturgical schedule: ${e.message}`);
  }
}

/**
 * Builds a map of liturgical celebrations with their details for the month.
 * @param {string} monthString The month to process (e.g., "2026-01").
 * @returns {Map} Map of liturgical celebrations with rank, color, and dates.
 */
function PRINT_buildLiturgicalData(monthString) {
  const liturgicalMap = new Map();
  
  try {
    const calendarData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    const calCols = CONSTANTS.COLS.CALENDAR;
    
    const [targetYear, targetMonth] = monthString.split('-').map(n => parseInt(n));
    
    for (const row of calendarData) {
      const calDate = new Date(row[calCols.DATE - 1]);
      
      // Include this month and spillover Sunday if needed
      const includeDate = (
        (calDate.getMonth() === targetMonth - 1 && calDate.getFullYear() === targetYear) ||
        (calDate.getMonth() === targetMonth % 12 && calDate.getDate() <= 7 && 
         calDate.getFullYear() === (targetMonth === 12 ? targetYear + 1 : targetYear) &&
         calDate.getDay() === 0) // Only Sunday spillover
      );
      
      if (includeDate) {
        const celebration = row[calCols.LITURGICAL_CELEBRATION - 1];
        const rank = row[calCols.RANK - 1];
        const color = row[calCols.COLOR - 1];
        const season = row[calCols.SEASON - 1];
        
        if (!liturgicalMap.has(celebration)) {
          liturgicalMap.set(celebration, {
            celebration: celebration,
            rank: rank,
            color: color,
            season: season,
            dates: [],
            masses: []
          });
        }
        
        liturgicalMap.get(celebration).dates.push(calDate);
      }
    }
    
    // Sort dates within each celebration
    for (const celebrationData of liturgicalMap.values()) {
      celebrationData.dates.sort((a, b) => a.getTime() - b.getTime());
    }
    
    Logger.log(`Built liturgical map with ${liturgicalMap.size} celebrations`);
    
  } catch (error) {
    Logger.log(`Warning: Could not read liturgical calendar: ${error}`);
  }
  
  return liturgicalMap;
}

/**
 * Gets all assignment data for the specified month.
 * @param {string} monthString The month to process.
 * @returns {Array} Array of assignment objects.
 */
function PRINT_getAssignmentData(monthString) {
  const assignments = [];
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    const data = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    const header = data.shift();
    
    for (const row of data) {
      if (row[0] === "") continue;
      
      const rowMonthYear = row[assignCols.MONTH_YEAR - 1];
      
      if (rowMonthYear === monthString) {
        assignments.push({
          date: new Date(row[assignCols.DATE - 1]),
          time: row[assignCols.TIME - 1],
          massName: row[assignCols.MASS_NAME - 1],
          liturgicalCelebration: row[assignCols.LITURGICAL_CELEBRATION - 1],
          ministryRole: row[assignCols.MINISTRY_ROLE - 1],
          assignedVolunteerName: row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] || 'UNASSIGNED',
          status: row[assignCols.STATUS - 1] || 'Pending',
          notes: row[assignCols.NOTES - 1] || '',
          eventId: row[assignCols.EVENT_ID - 1] || ''
        });
      }
    }
    
    // Sort assignments by date, then time, then role
    assignments.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      if (a.time !== b.time) {
        return a.time.localeCompare(b.time);
      }
      return a.ministryRole.localeCompare(b.ministryRole);
    });
    
    Logger.log(`Retrieved ${assignments.length} assignments for ${monthString}`);
    
  } catch (error) {
    Logger.log(`Error reading assignment data: ${error}`);
  }
  
  return assignments;
}

/**
 * Creates the header section of the schedule.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The target sheet.
 * @param {string} parishName The parish name.
 * @param {string} displayName The month display name.
 * @returns {number} The next available row number.
 */
function PRINT_createHeader(sheet, parishName, displayName) {
  let currentRow = 1;
  
  // Parish header
  sheet.getRange(currentRow, 1).setValue(parishName);
  sheet.getRange(currentRow, 1).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(currentRow, 1, 1, 6).merge();
  currentRow++;
  
  // Schedule title
  sheet.getRange(currentRow, 1).setValue(`Ministry Schedule - ${displayName}`);
  sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(currentRow, 1, 1, 6).merge();
  currentRow++;
  
  // Subtitle
  sheet.getRange(currentRow, 1).setValue('Organized by Liturgical Celebrations');
  sheet.getRange(currentRow, 1).setFontSize(12).setFontStyle('italic').setHorizontalAlignment('center');
  sheet.getRange(currentRow, 1, 1, 6).merge();
  currentRow++;
  
  // Generation info
  sheet.getRange(currentRow, 1).setValue(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
  sheet.getRange(currentRow, 1).setFontSize(9).setFontStyle('italic').setHorizontalAlignment('center');
  sheet.getRange(currentRow, 1, 1, 6).merge();
  currentRow += 2; // Skip a row
  
  return currentRow;
}

/**
 * Creates the main content section organized by liturgical celebrations.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The target sheet.
 * @param {Map} liturgicalData The liturgical celebrations data.
 * @param {Array} assignments The assignment data.
 * @param {number} startRow The starting row number.
 * @returns {number} The next available row number.
 */
function PRINT_createLiturgicalScheduleContent(sheet, liturgicalData, assignments, startRow) {
  let currentRow = startRow;
  
  // Group assignments by liturgical celebration
  const assignmentsByLiturgy = new Map();
  
  for (const assignment of assignments) {
    const celebration = assignment.liturgicalCelebration;
    if (!assignmentsByLiturgy.has(celebration)) {
      assignmentsByLiturgy.set(celebration, []);
    }
    assignmentsByLiturgy.get(celebration).push(assignment);
  }
  
  // Get liturgical celebrations in chronological order by first occurrence
  const sortedCelebrations = Array.from(liturgicalData.keys()).sort((a, b) => {
    const aFirstDate = liturgicalData.get(a).dates[0];
    const bFirstDate = liturgicalData.get(b).dates[0];
    return aFirstDate.getTime() - bFirstDate.getTime();
  });
  
  // Process each liturgical celebration
  for (const celebration of sortedCelebrations) {
    const liturgyInfo = liturgicalData.get(celebration);
    const celebrationAssignments = assignmentsByLiturgy.get(celebration) || [];
    
    if (celebrationAssignments.length === 0) continue; // Skip if no masses scheduled
    
    Logger.log(`Processing celebration: ${celebration} with ${celebrationAssignments.length} assignments`);
    
    // Liturgical Celebration Header
    sheet.getRange(currentRow, 1).setValue(celebration);
    sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setBackground('#d9ead3');
    sheet.getRange(currentRow, 1, 1, 6).merge();
    currentRow++;
    
    // Rank and Color
    const rankColorText = `${liturgyInfo.rank} • ${liturgyInfo.color} • ${liturgyInfo.season}`;
    sheet.getRange(currentRow, 1).setValue(rankColorText);
    sheet.getRange(currentRow, 1).setFontSize(10).setFontStyle('italic').setBackground('#e6f4ea');
    sheet.getRange(currentRow, 1, 1, 6).merge();
    currentRow++;
    
    // Table headers for this celebration
    const headers = ['Date', 'Time', 'Mass Name', 'Ministry Role', 'Assigned Volunteer', 'Status'];
    for (let i = 0; i < headers.length; i++) {
      sheet.getRange(currentRow, i + 1).setValue(headers[i]);
    }
    
    const headerRange = sheet.getRange(currentRow, 1, 1, 6);
    headerRange.setFontWeight('bold').setBackground('#f1f3f4').setBorder(true, true, true, true, true, true);
    currentRow++;
    
    // Group assignments by date and time within this celebration
    const massesByDateTime = new Map();
    
    for (const assignment of celebrationAssignments) {
      const massKey = `${assignment.date.toDateString()}_${assignment.time}_${assignment.massName}`;
      if (!massesByDateTime.has(massKey)) {
        massesByDateTime.set(massKey, {
          date: assignment.date,
          time: assignment.time,
          massName: assignment.massName,
          assignments: []
        });
      }
      massesByDateTime.get(massKey).assignments.push(assignment);
    }
    
    // Sort masses chronologically
    const sortedMasses = Array.from(massesByDateTime.values()).sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      return a.time.localeCompare(b.time);
    });
    
    // Process each mass within this celebration
    for (const mass of sortedMasses) {
      // Sort roles in logical order
      const ministryOrder = [
        'lector 1', '1st reading', 'lector 2', '2nd reading', 'psalm', 'responsorial psalm',
        'universal prayer', 'prayers of the faithful', 'intercessions',
        'em - captain', 'eucharistic minister - captain', 'em captain',
        'em 1', 'em 2', 'em 3', 'em 4', 'em 5', 'em 6',
        'eucharistic minister 1', 'eucharistic minister 2', 'eucharistic minister 3', 'eucharistic minister 4',
        'usher captain', 'usher 1', 'usher 2', 'usher 3', 'usher 4',
        'greeter', 'collection', 'counting',
        'altar server 1', 'altar server 2', 'altar servers',
        'music director', 'music', 'cantor', 'organist', 'choir'
      ];
      
      mass.assignments.sort((a, b) => {
        const aIndex = ministryOrder.indexOf(a.ministryRole.toLowerCase());
        const bIndex = ministryOrder.indexOf(b.ministryRole.toLowerCase());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.ministryRole.localeCompare(b.ministryRole);
      });
      
      // Add each assignment row
      for (let i = 0; i < mass.assignments.length; i++) {
        const assignment = mass.assignments[i];
        
        // Format date for better readability
        const dateStr = assignment.date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
        
        // Format time
        const timeStr = typeof assignment.time === 'string' ? assignment.time : 
                       assignment.time instanceof Date ? assignment.time.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) : 
                       String(assignment.time);
        
        // Only show date/time/mass for first role of each mass
        if (i === 0) {
          sheet.getRange(currentRow, 1).setValue(dateStr);
          sheet.getRange(currentRow, 2).setValue(timeStr);
          sheet.getRange(currentRow, 3).setValue(assignment.massName);
        }
        
        sheet.getRange(currentRow, 4).setValue(assignment.ministryRole);
        sheet.getRange(currentRow, 5).setValue(assignment.assignedVolunteerName);
        sheet.getRange(currentRow, 6).setValue(assignment.status);
        
        // Format the row
        const rowRange = sheet.getRange(currentRow, 1, 1, 6);
        rowRange.setBorder(true, true, true, true, false, false);
        
        // Highlight unassigned roles
        if (assignment.assignedVolunteerName === 'UNASSIGNED') {
          sheet.getRange(currentRow, 5).setBackground('#fce8e6');
        }
        
        // Alternate row coloring for readability
        if (Math.floor(currentRow / 2) % 2 === 0) {
          rowRange.setBackground('#fafafa');
        }
        
        currentRow++;
      }
    }
    
    currentRow++; // Space between celebrations
  }
  
  return currentRow;
}

/**
 * Creates a summary section at the end of the schedule.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The target sheet.
 * @param {Array} assignments The assignment data.
 * @param {number} startRow The starting row number.
 * @returns {number} The next available row number.
 */
function PRINT_createSummarySection(sheet, assignments, startRow) {
  let currentRow = startRow + 1;
  
  // Summary header
  sheet.getRange(currentRow, 1).setValue('MINISTRY ASSIGNMENT SUMMARY');
  sheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#fff2cc');
  sheet.getRange(currentRow, 1, 1, 6).merge();
  currentRow++;
  
  // Count assignments by status
  let totalRoles = assignments.length;
  let assignedRoles = 0;
  let unassignedRoles = 0;
  let pendingRoles = 0;
  
  const volunteerCounts = new Map();
  const roleCounts = new Map();
  const liturgyStats = new Map();
  
  for (const assignment of assignments) {
    // Count by status
    if (assignment.assignedVolunteerName === 'UNASSIGNED') {
      unassignedRoles++;
    } else {
      assignedRoles++;
      
      // Count assignments per volunteer
      const volunteer = assignment.assignedVolunteerName;
      volunteerCounts.set(volunteer, (volunteerCounts.get(volunteer) || 0) + 1);
    }
    
    if (assignment.status === 'Pending') {
      pendingRoles++;
    }
    
    // Count by role type
    const role = assignment.ministryRole;
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    
    // Count by liturgical celebration
    const liturgy = assignment.liturgicalCelebration;
    if (!liturgyStats.has(liturgy)) {
      liturgyStats.set(liturgy, { total: 0, assigned: 0 });
    }
    liturgyStats.get(liturgy).total++;
    if (assignment.assignedVolunteerName !== 'UNASSIGNED') {
      liturgyStats.get(liturgy).assigned++;
    }
  }
  
  // Basic statistics
  sheet.getRange(currentRow, 1).setValue(`Total Ministry Assignments: ${totalRoles}`);
  currentRow++;
  sheet.getRange(currentRow, 1).setValue(`✓ Assigned: ${assignedRoles} (${Math.round(assignedRoles/totalRoles*100)}%)`);
  if (assignedRoles > 0) {
    sheet.getRange(currentRow, 1).setBackground('#e6f4ea');
  }
  currentRow++;
  sheet.getRange(currentRow, 1).setValue(`⚠ Still Needed: ${unassignedRoles} (${Math.round(unassignedRoles/totalRoles*100)}%)`);
  if (unassignedRoles > 0) {
    sheet.getRange(currentRow, 1).setBackground('#fce8e6');
  }
  currentRow += 2;
  
  // Top volunteers (if any assigned)
  if (volunteerCounts.size > 0) {
    sheet.getRange(currentRow, 1).setValue('Most Active Volunteers:');
    sheet.getRange(currentRow, 1).setFontWeight('bold');
    currentRow++;
    
    const topVolunteers = Array.from(volunteerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Top 8 volunteers
    
    for (const [volunteer, count] of topVolunteers) {
      sheet.getRange(currentRow, 1).setValue(`${volunteer}: ${count} assignments`);
      currentRow++;
    }
    currentRow++;
  }
  
  // Completion by liturgical celebration
  if (liturgyStats.size > 1) {
    sheet.getRange(currentRow, 1).setValue('Completion by Liturgical Celebration:');
    sheet.getRange(currentRow, 1).setFontWeight('bold');
    currentRow++;
    
    for (const [liturgy, stats] of liturgyStats) {
      const completion = Math.round(stats.assigned / stats.total * 100);
      sheet.getRange(currentRow, 1).setValue(`${liturgy}: ${stats.assigned}/${stats.total} (${completion}%)`);
      if (completion < 80) {
        sheet.getRange(currentRow, 1).setBackground('#fce8e6');
      } else if (completion === 100) {
        sheet.getRange(currentRow, 1).setBackground('#e6f4ea');
      }
      currentRow++;
    }
  }
  
  return currentRow;
}

/**
 * Applies final formatting to the schedule sheet for professional appearance.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The target sheet.
 */
function PRINT_formatScheduleSheet(sheet) {
  // Auto-resize columns
  sheet.autoResizeColumns(1, 6);
  
  // Set optimal column widths for printing
  sheet.setColumnWidth(1, 90);  // Date
  sheet.setColumnWidth(2, 70);  // Time  
  sheet.setColumnWidth(3, 120); // Mass Name
  sheet.setColumnWidth(4, 140); // Ministry Role
  sheet.setColumnWidth(5, 140); // Assigned Volunteer
  sheet.setColumnWidth(6, 80);  // Status
  
  // Set print margins and options
  sheet.getRange(1, 1, sheet.getLastRow(), 6).setFontFamily('Arial');
  
  // Freeze header rows
  sheet.setFrozenRows(5);
  
  // Set page orientation and margins for printing
  // Note: These settings may not be fully supported in Google Sheets via Apps Script
  // Users should manually adjust print settings as needed
  
  Logger.log('Applied final formatting to liturgical schedule sheet');
}

/**
 * Generates and exports a PDF version of the liturgical schedule.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message with PDF information.
 */
function PRINT_exportLiturgicalSchedulePDF(monthString) {
  try {
    // First generate the liturgical schedule
    PRINT_generateLiturgicalSchedule(monthString);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('LiturgicalSchedule');
    
    if (!sheet) {
      throw new Error('LiturgicalSchedule sheet not found. Please generate the schedule first.');
    }
    
    // Create PDF export URL with liturgical schedule-specific settings
    const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?'
      + 'format=pdf'
      + '&size=letter'
      + '&portrait=true'    // Portrait for better liturgical layout
      + '&fitw=true'        // Fit to width
      + '&top_margin=0.75'
      + '&bottom_margin=0.75'
      + '&left_margin=0.5'
      + '&right_margin=0.5'
      + '&gridlines=true'   // Keep gridlines for liturgical schedule
      + '&printtitle=true'  // Include sheet name
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
    blob.setName(`Liturgical_Schedule_${displayName}.pdf`);
    
    // Save to Drive
    const pdfFile = DriveApp.createFile(blob);
    
    // Make the file shareable
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileUrl = pdfFile.getUrl();
    Logger.log(`Liturgical schedule PDF created: ${fileUrl}`);
    
    return `Liturgical schedule PDF created and saved to Google Drive. Access at: ${fileUrl}`;
    
  } catch (e) {
    Logger.log(`Error generating liturgical schedule PDF: ${e}`);
    return `PDF generation encountered an issue: ${e.message}. Please use the LiturgicalSchedule sheet for printing.`;
  }
}

/**
 * Enhanced printable schedule with liturgical grouping and professional formatting.
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
    monthlySheet.getRange(currentRow, 1, 1, 5).merge();
    currentRow++;
    
    // Schedule title
    monthlySheet.getRange(currentRow, 1).setValue(`Ministry Schedule - ${displayName}`);
    monthlySheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold');
    monthlySheet.getRange(currentRow, 1, 1, 5).merge();
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
    
    // Define liturgical color mapping
    const liturgicalColors = {
      'White': '#edce47',
      'Violet': '#805977', 
      'Rose': '#cf7f93',
      'Green': '#2c926c',
      'Red': '#e06666'
    };
    
    // Generate the formatted schedule grouped by liturgical celebrations
    for (const celebration of sortedCelebrations) {
      const celebrationAssignments = assignmentsByLiturgy.get(celebration) || [];
      
      if (celebrationAssignments.length === 0) continue; // Skip if no masses scheduled
      
      const liturgyInfo = liturgicalData.get(celebration);
      
      // Get the background color for this liturgical color
      const bgColor = liturgyInfo && liturgicalColors[liturgyInfo.color] 
        ? liturgicalColors[liturgyInfo.color] 
        : '#d9ead3'; // Default green if color not found
      
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
          
          // Format the row with selective borders
          const rowRange = monthlySheet.getRange(currentRow, 1, 1, 5);
          
          // Only add borders between different masses, not between assignments within the same mass
          const isFirstRowOfMass = (i === 0);
          const isLastRowOfMass = (i === mass.assignments.length - 1);
          
          // Set borders: top border only on first row of mass, bottom border only on last row of mass
          // Always keep left and right borders for table structure
          rowRange.setBorder(
            isFirstRowOfMass,  // top
            false,             // left (will be set by table structure)
            isLastRowOfMass,   // bottom  
            false,             // right (will be set by table structure)
            false,             // vertical (no internal vertical lines)
            false              // horizontal (no internal horizontal lines)
          );
          
          // Add left and right borders for table structure
          if (i === 0) {
            monthlySheet.getRange(currentRow, 1).setBorder(null, true, null, null, null, null); // Left border
          }
          monthlySheet.getRange(currentRow, 5).setBorder(null, null, null, true, null, null); // Right border
          
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
 * Creates a simplified one-page summary of the liturgical schedule.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function PRINT_createLiturgyOverview(monthString) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or get the overview sheet
    let overviewSheet = ss.getSheetByName('LiturgyOverview');
    if (!overviewSheet) {
      overviewSheet = ss.insertSheet('LiturgyOverview');
    } else {
      overviewSheet.clear();
    }
    
    const liturgicalData = PRINT_buildLiturgicalData(monthString);
    const assignments = PRINT_getAssignmentData(monthString);
    
    // Group assignments by celebration
    const celebrationCounts = new Map();
    for (const assignment of assignments) {
      const celebration = assignment.liturgicalCelebration;
      if (!celebrationCounts.has(celebration)) {
        celebrationCounts.set(celebration, { total: 0, assigned: 0, masses: new Set() });
      }
      celebrationCounts.get(celebration).total++;
      celebrationCounts.get(celebration).masses.add(`${assignment.date.toDateString()} ${assignment.time}`);
      if (assignment.assignedVolunteerName !== 'UNASSIGNED') {
        celebrationCounts.get(celebration).assigned++;
      }
    }
    
    // Create overview header
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    let row = 1;
    overviewSheet.getRange(row, 1).setValue(`Liturgical Overview - ${displayName}`);
    overviewSheet.getRange(row, 1).setFontSize(16).setFontWeight('bold');
    overviewSheet.getRange(row, 1, 1, 5).merge();
    row += 2;
    
    // Headers
    const headers = ['Liturgical Celebration', 'Rank', 'Color', 'Masses', 'Completion'];
    for (let i = 0; i < headers.length; i++) {
      overviewSheet.getRange(row, i + 1).setValue(headers[i]);
    }
    overviewSheet.getRange(row, 1, 1, 5).setFontWeight('bold').setBackground('#e6f4ea');
    row++;
    
    // Add celebration data
    const sortedCelebrations = Array.from(liturgicalData.keys()).sort((a, b) => {
      const aFirstDate = liturgicalData.get(a).dates[0];
      const bFirstDate = liturgicalData.get(b).dates[0];
      return aFirstDate.getTime() - bFirstDate.getTime();
    });
    
    for (const celebration of sortedCelebrations) {
      const liturgyInfo = liturgicalData.get(celebration);
      const counts = celebrationCounts.get(celebration);
      
      if (counts) {
        overviewSheet.getRange(row, 1).setValue(celebration);
        overviewSheet.getRange(row, 2).setValue(liturgyInfo.rank);
        overviewSheet.getRange(row, 3).setValue(liturgyInfo.color);
        overviewSheet.getRange(row, 4).setValue(counts.masses.size);
        
        const completion = `${counts.assigned}/${counts.total} (${Math.round(counts.assigned/counts.total*100)}%)`;
        overviewSheet.getRange(row, 5).setValue(completion);
        
        // Color code completion
        if (counts.assigned === counts.total) {
          overviewSheet.getRange(row, 5).setBackground('#e6f4ea');
        } else if (counts.assigned < counts.total * 0.8) {
          overviewSheet.getRange(row, 5).setBackground('#fce8e6');
        }
        
        row++;
      }
    }
    
    // Format the overview
    overviewSheet.autoResizeColumns(1, 5);
    overviewSheet.setColumnWidth(1, 200);
    
    return `Liturgical overview created in 'LiturgyOverview' sheet.`;
    
  } catch (e) {
    Logger.log(`Error creating liturgy overview: ${e}`);
    throw new Error(`Could not create liturgy overview: ${e.message}`);
  }
}
