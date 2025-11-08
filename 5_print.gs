/**
 * ENHANCED Print Schedule Function
 * Improved version with better formatting, grouping, and layout options
 */

/**
 * (SIDEBAR) Generates an enhanced printable schedule with improved formatting.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @returns {string} A success message.
 */
function generateEnhancedPrintableSchedule(monthString) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or get the enhanced monthly view sheet
    let monthlySheet = ss.getSheetByName('MonthlyView_Enhanced');
    if (!monthlySheet) {
      monthlySheet = ss.insertSheet('MonthlyView_Enhanced');
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
    let parishName = "Parish Name"; // Default
    try {
      const config = HELPER_readConfig();
      parishName = config["Parish Name"] || "Parish Name";
    } catch (e) {
      // Use default if config not available
    }
    
    // Create header section
    let currentRow = 1;
    
    // Parish header
    monthlySheet.getRange(currentRow, 1).setValue(parishName);
    monthlySheet.getRange(currentRow, 1).setFontSize(16).setFontWeight('bold');
    currentRow++;
    
    // Schedule title
    monthlySheet.getRange(currentRow, 1).setValue(`Ministry Schedule - ${displayName}`);
    monthlySheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold');
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
    
    // Format the entire sheet
    monthlySheet.autoResizeColumns(1, 4);
    
    // Set column widths for better printing
    monthlySheet.setColumnWidth(1, 150); // Ministry Role
    monthlySheet.setColumnWidth(2, 120); // Volunteer  
    monthlySheet.setColumnWidth(3, 80);  // Status
    monthlySheet.setColumnWidth(4, 150); // Notes
    
    return `Enhanced schedule for ${displayName} has been prepared in the 'MonthlyView_Enhanced' sheet. Ready for printing or PDF export.`;
    
  } catch (e) {
    Logger.log(`Error generating enhanced printable schedule: ${e}`);
    throw new Error(`Could not generate enhanced printable schedule: ${e.message}`);
  }
}

/**
 * Alternative: Generate PDF directly (requires additional setup)
 */
function generateSchedulePDF(monthString) {
  try {
    // First generate the enhanced schedule
    generateEnhancedPrintableSchedule(monthString);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('MonthlyView_Enhanced');
    
    // Get the sheet as PDF blob
    const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?'
      + 'format=pdf'
      + '&size=letter'
      + '&portrait=false'  // Landscape
      + '&fitw=true'
      + '&top_margin=0.5'
      + '&bottom_margin=0.5'
      + '&left_margin=0.5'
      + '&right_margin=0.5'
      + '&gid=' + sheet.getSheetId();
    
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    // Save PDF to Drive (optional)
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const displayName = date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    const blob = response.getBlob();
    blob.setName(`Parish_Schedule_${displayName.replace(' ', '_')}.pdf`);
    
    const pdfFile = DriveApp.createFile(blob);
    
    return `PDF schedule created: ${pdfFile.getUrl()}`;
    
  } catch (e) {
    Logger.log(`Error generating PDF: ${e}`);
    throw new Error(`Could not generate PDF: ${e.message}`);
  }
}
