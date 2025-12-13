/**
 * ====================================================================
 * CONSOLIDATED PRINT SCHEDULE FUNCTION
 * ====================================================================
 * This replaces both generatePrintableSchedule() and PRINT_generateLiturgicalSchedule()
 * with a single, configurable function that eliminates 80% code duplication.
 */

/**
 * Enhanced printable schedule generator with configurable output options.
 * @param {string} monthString The selected month (e.g., "2026-01").
 * @param {object} options Configuration options for output customization.
 * @returns {string} A success message.
 */
function generatePrintableSchedule(monthString, options = {}) {
  try {
    // Validate input
    const { year, month } = HELPER_validateMonthString(monthString);
    
    // Set default options
    const config = {
      sheetName: options.sheetName || 'MonthlyView',
      ministryFilter: options.ministryFilter || null,  // NEW: Array of ministry names to filter by
      layoutStyle: options.layoutStyle || 'liturgical', // 'liturgical' or 'chronological'
      includeColors: options.includeColors !== false, // Default true
      includeSummary: options.includeSummary === true, // Default false (user can enable if needed)
      columnWidths: options.columnWidths || 'auto',
      groupByLiturgy: options.groupByLiturgy !== false, // Default true
      showRankInfo: options.showRankInfo !== false, // Default true
      ...options
    };
    
    Logger.log(`Starting enhanced print schedule generation for ${monthString}`);
    Logger.log(`Config: ${JSON.stringify(config)}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or get the target sheet
    let scheduleSheet = ss.getSheetByName(config.sheetName);
    const isNewSheet = !scheduleSheet;

    if (!scheduleSheet) {
      scheduleSheet = ss.insertSheet(config.sheetName);
    } else {
      // Clear entire sheet (including header rows 1-3) so header can be regenerated from config
      if (scheduleSheet.getLastRow() >= 1) {
        scheduleSheet.clear();
      }
    }

    // Note: Header setup is now done in createScheduleHeader() using Config "Logo URL"
    // No need to copy from MonthlyView - everything is programmatically created
    
    // Get month display name
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');
    
    // Build the required data
    const scheduleData = buildScheduleData(monthString, config);

    Logger.log(`Found ${scheduleData.liturgicalData.size} liturgical celebrations and ${scheduleData.assignments.length} assignments`);

    // Generate the schedule using modular approach
    let currentRow = createScheduleHeader(scheduleSheet, scheduleData.parishName, displayName, config, scheduleData.printConfig);
    currentRow = createScheduleContent(scheduleSheet, scheduleData, currentRow, config);
    
    if (config.includeSummary) {
      currentRow = createScheduleSummary(scheduleSheet, scheduleData.assignments, currentRow, config);
    }
    
    // Apply final formatting
    applyScheduleFormatting(scheduleSheet, config);
    
    Logger.log(`Enhanced schedule created successfully in '${config.sheetName}' sheet`);
    return `Enhanced schedule for ${displayName} has been created in the '${config.sheetName}' sheet. Ready for printing or PDF export.`;
    
  } catch (e) {
    Logger.log(`Error generating printable schedule: ${e}`);
    throw new Error(`Could not generate printable schedule: ${e.message}`);
  }
}

/**
 * Builds all required data for schedule generation.
 * @param {string} monthString The month to process.
 * @param {object} config Configuration options.
 * @returns {object} Complete data structure for schedule generation.
 */
function buildScheduleData(monthString, config) {
  // Get parish name from config
  let parishName = "Parish Ministry Schedule";
  try {
    const configData = HELPER_readConfigSafe();
    parishName = configData["Parish Name"] || parishName;
  } catch (e) {
    Logger.log(`Could not read parish name: ${e.message}`);
  }

  // Read print schedule configuration
  const printConfig = HELPER_readPrintScheduleConfig();

  // Build liturgical data map (extracted from PRINT_generateLiturgicalSchedule)
  const liturgicalData = buildLiturgicalDataMap(monthString);

  // Load liturgical notes
  const liturgicalNotes = loadLiturgicalNotes();

  // Get assignment data
  let assignments = getAssignmentDataForMonth(monthString);

  // NEW: Apply ministry filter if specified
  if (config.ministryFilter && config.ministryFilter.length > 0) {
    const ministrySet = new Set(
      config.ministryFilter.map(m => m.toLowerCase())
    );

    const originalCount = assignments.length;
    assignments = assignments.filter(a =>
      ministrySet.has(a.ministry.toLowerCase())
    );

    Logger.log(`Ministry filter applied: ${originalCount} → ${assignments.length} assignments`);
    Logger.log(`Filtered to: ${config.ministryFilter.join(', ')}`);
  }

  // Group assignments by liturgical celebration
  const assignmentsByLiturgy = groupAssignmentsByLiturgy(assignments);

  return {
    parishName,
    liturgicalData,
    liturgicalNotes,
    assignments,
    assignmentsByLiturgy,
    printConfig
  };
}

/**
 * Builds liturgical data map with enhanced error handling.
 * This consolidates the logic from PRINT_buildLiturgicalData().
 */
function buildLiturgicalDataMap(monthString) {
  const liturgicalMap = new Map();
  
  try {
    const calendarData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.CALENDAR);
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
        
        if (!liturgicalMap.has(celebration)) {
          liturgicalMap.set(celebration, {
            celebration: celebration,
            rank: row[calCols.RANK - 1],
            color: row[calCols.COLOR - 1], 
            season: row[calCols.SEASON - 1],
            dates: []
          });
        }
        
        liturgicalMap.get(celebration).dates.push(calDate);
      }
    }
    
    // Sort dates within each celebration
    for (const celebrationData of liturgicalMap.values()) {
      celebrationData.dates.sort((a, b) => a.getTime() - b.getTime());
    }
    
  } catch (error) {
    Logger.log(`Warning: Could not read liturgical calendar: ${error}`);
  }
  
  return liturgicalMap;
}

/**
 * Loads liturgical notes from the LiturgicalNotes sheet.
 * @returns {Map} Map of celebration name to notes.
 */
function loadLiturgicalNotes() {
  const notesMap = new Map();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const notesSheet = ss.getSheetByName(CONSTANTS.SHEETS.LITURGICAL_NOTES);

    if (!notesSheet) {
      Logger.log('LiturgicalNotes sheet not found - skipping notes');
      return notesMap;
    }

    const data = notesSheet.getDataRange().getValues();
    const notesCols = CONSTANTS.COLS.LITURGICAL_NOTES;

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const celebration = HELPER_safeArrayAccess(row, notesCols.CELEBRATION - 1);
      const notes = HELPER_safeArrayAccess(row, notesCols.NOTES - 1);

      if (celebration && notes) {
        notesMap.set(celebration, notes);
      }
    }

    Logger.log(`Loaded ${notesMap.size} liturgical notes`);

  } catch (error) {
    Logger.log(`Warning: Could not read liturgical notes: ${error}`);
  }

  return notesMap;
}

/**
 * Gets assignment data with enhanced filtering.
 */
function getAssignmentDataForMonth(monthString) {
  const assignments = [];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    const data = assignmentsSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
    data.shift(); // Remove header

    for (const row of data) {
      const rowMonthYear = HELPER_safeArrayAccess(row, assignCols.MONTH_YEAR - 1);

      if (rowMonthYear === monthString && row[assignCols.DATE - 1]) {
        // Create date object with validation
        const dateValue = row[assignCols.DATE - 1];
        const date = new Date(dateValue);

        // Create time object with validation - handle invalid/empty times
        const timeValue = row[assignCols.TIME - 1];
        let time;
        if (timeValue && timeValue instanceof Date && !isNaN(timeValue.getTime())) {
          time = timeValue;
        } else if (timeValue) {
          time = new Date(timeValue);
          // If conversion failed, set to midnight as fallback
          if (isNaN(time.getTime())) {
            Logger.log(`Warning: Invalid time value for assignment on ${date}: ${timeValue}. Using midnight as fallback.`);
            time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
          }
        } else {
          // No time value - use midnight as fallback
          Logger.log(`Warning: Missing time value for assignment on ${date}. Using midnight as fallback.`);
          time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        }

        assignments.push({
          date: date,
          time: time,
          massName: HELPER_safeArrayAccess(row, assignCols.DESCRIPTION - 1),
          liturgicalCelebration: HELPER_safeArrayAccess(row, assignCols.LITURGICAL_CELEBRATION - 1),
          ministry: HELPER_safeArrayAccess(row, assignCols.MINISTRY - 1),     // NEW: Ministry category
          role: HELPER_safeArrayAccess(row, assignCols.ROLE - 1),             // UPDATED: was ministryRole
          assignedGroup: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_GROUP - 1),
          assignedVolunteerName: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_NAME - 1) || 'UNASSIGNED',
          status: HELPER_safeArrayAccess(row, assignCols.STATUS - 1, 'Pending'),
          eventId: HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1)
        });
      }
    }

    // Sort assignments by date, then time, then role
    // Now safe because we've validated all date/time objects
    assignments.sort((a, b) => {
      const aTime = a.date.getTime();
      const bTime = b.date.getTime();

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      const aTimeOfDay = a.time.getTime();
      const bTimeOfDay = b.time.getTime();

      if (aTimeOfDay !== bTimeOfDay) {
        return aTimeOfDay - bTimeOfDay;
      }

      return a.role.localeCompare(b.role);  // UPDATED: was ministryRole
    });

  } catch (error) {
    Logger.log(`Error reading assignment data: ${error}`);
    throw error; // Re-throw to surface the actual error
  }

  return assignments;
}

/**
 * Groups assignments by liturgical celebration.
 */
function groupAssignmentsByLiturgy(assignments) {
  const assignmentsByLiturgy = new Map();
  
  for (const assignment of assignments) {
    const celebration = assignment.liturgicalCelebration;
    if (!assignmentsByLiturgy.has(celebration)) {
      assignmentsByLiturgy.set(celebration, []);
    }
    assignmentsByLiturgy.get(celebration).push(assignment);
  }
  
  return assignmentsByLiturgy;
}

/**
 * Creates the schedule header section.
 * Sets up logo (from Config "Logo URL"), parish/ministry name, schedule title, and timestamp.
 * IMPORTANT: Uses =IMAGE() formula for logo so it can be copied programmatically.
 */
function createScheduleHeader(sheet, parishName, displayName, config, printConfig) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Read config for logo URL and header text
  let logoUrl = '';
  let parish = 'Parish';
  let ministry = 'Ministry';

  try {
    const configData = HELPER_readConfigSafe();
    logoUrl = configData['Logo URL'] || '';
    parish = configData['Parish Name'] || parish;
    ministry = configData['Ministry Name'] || ministry;
  } catch (e) {
    Logger.log(`Could not read config: ${e.message}`);
  }

  // Row 1: Logo in merged cell A1:C1
  try {
    // Merge A1:C1 for logo
    const logoRange = sheet.getRange(1, 1, 1, 3);
    logoRange.merge();

    if (logoUrl) {
      // Set =IMAGE() formula with logo URL from config
      const imageFormula = `=IMAGE("${logoUrl}", 1)`;  // Mode 1 = fit to cell
      sheet.getRange(1, 1).setFormula(imageFormula);
      Logger.log(`Set logo formula in A1 with URL: ${logoUrl}`);
    } else {
      // No logo URL configured - leave A1:C1 empty but merged
      Logger.log('No Logo URL in config - A1:C1 merged but empty');
    }

    // Set row height for logo (adjust as needed)
    sheet.setRowHeight(1, 80);

  } catch (e) {
    Logger.log(`Could not set up logo: ${e.message}`);
  }

  // Row 1, Columns D-F: Parish and Ministry Name
  try {
    const headerText = `${parish} - ${ministry}`;
    const headerRange = sheet.getRange(1, 4, 1, 3);  // D1:F1
    headerRange.merge();
    headerRange.setValue(headerText);
    headerRange.setFontSize(16)
                .setFontWeight('bold')
                .setHorizontalAlignment('left')
                .setVerticalAlignment('middle');
    Logger.log(`Set parish/ministry header in D1: ${headerText}`);
  } catch (e) {
    Logger.log(`Could not set parish/ministry header: ${e.message}`);
  }

  // Row 2: Schedule title spanning all columns
  try {
    const scheduleTitle = `${displayName} Schedule`;
    const titleRange = sheet.getRange(2, 1, 1, 6);  // A2:F2
    titleRange.merge();
    titleRange.setValue(scheduleTitle);
    titleRange.setFontSize(14)
              .setFontWeight('bold')
              .setHorizontalAlignment('center')
              .setVerticalAlignment('middle');
    Logger.log(`Set schedule title in row 2: ${scheduleTitle}`);
  } catch (e) {
    Logger.log(`Could not set schedule title: ${e.message}`);
  }

  // Row 3: Timestamp spanning all columns
  try {
    const timestamp = `Generated: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
    const timestampRange = sheet.getRange(3, 1, 1, 6);  // A3:F3
    timestampRange.merge();
    timestampRange.setValue(timestamp);
    timestampRange.setFontSize(10)
                  .setFontStyle('italic')
                  .setHorizontalAlignment('center')
                  .setVerticalAlignment('middle');
    Logger.log(`Set timestamp in row 3`);
  } catch (e) {
    Logger.log(`Could not set timestamp: ${e.message}`);
  }

  // Row 4 is blank, schedule content starts at row 5
  return 5;
}

/**
 * Creates the main schedule content with configurable layout.
 */
function createScheduleContent(sheet, scheduleData, startRow, config) {
  let currentRow = startRow;
  
  if (config.groupByLiturgy) {
    currentRow = createLiturgicalContent(sheet, scheduleData, currentRow, config);
  } else {
    currentRow = createChronologicalContent(sheet, scheduleData, currentRow, config);
  }
  
  return currentRow;
}

/**
 * Creates content grouped by liturgical celebrations.
 */
function createLiturgicalContent(sheet, scheduleData, startRow, config) {
  let currentRow = startRow;
  const { liturgicalData, liturgicalNotes, assignmentsByLiturgy, printConfig } = scheduleData;

  // Get celebrations in chronological order
  const sortedCelebrations = Array.from(liturgicalData.keys()).sort((a, b) => {
    const aFirstDate = liturgicalData.get(a).dates[0];
    const bFirstDate = liturgicalData.get(b).dates[0];
    return aFirstDate.getTime() - bFirstDate.getTime();
  });

  for (const celebration of sortedCelebrations) {
    const liturgyInfo = liturgicalData.get(celebration);
    const celebrationAssignments = assignmentsByLiturgy.get(celebration) || [];

    if (celebrationAssignments.length === 0) continue;

    currentRow = createCelebrationSection(sheet, celebration, liturgyInfo, celebrationAssignments, currentRow, config, printConfig, liturgicalNotes);
  }

  return currentRow;
}

/**
 * Creates a section for a single liturgical celebration.
 * PERFORMANCE: Batch write celebration header data
 */
function createCelebrationSection(sheet, celebration, liturgyInfo, assignments, startRow, config, printConfig, liturgicalNotes) {
  let currentRow = startRow;

  // Celebration header with color coding - use configured liturgical colors
  const liturgicalColorOverrides = (printConfig && printConfig.liturgicalColors) || {};
  const bgColor = config.includeColors ? HELPER_getLiturgicalColorHex(liturgyInfo.color, liturgicalColorOverrides) : '#d9ead3';

  // PERFORMANCE: Batch write header data
  const headerData = [[celebration]];
  let headerRows = 1;

  // Add rank info row if enabled
  if (config.showRankInfo && liturgyInfo) {
    let rankInfo = `${liturgyInfo.rank} • ${liturgyInfo.season} • ${liturgyInfo.color}`;
    if (liturgicalNotes && liturgicalNotes.has(celebration)) {
      rankInfo += ` | ${liturgicalNotes.get(celebration)}`;
    }
    headerData.push([rankInfo]);
    headerRows = 2;
  }

  // Write both header rows in one call
  sheet.getRange(currentRow, 1, headerRows, 1).setValues(headerData);

  // Apply formatting to celebration title
  const titleRange = sheet.getRange(currentRow, 1);
  titleRange.setFontSize(14).setFontWeight('bold');
  if (config.includeColors) {
    titleRange.setBackground(bgColor);
  }
  sheet.getRange(currentRow, 1, 1, 5).merge();
  currentRow++;

  // Apply formatting to rank info row if it exists
  if (headerRows === 2) {
    const rankRange = sheet.getRange(currentRow, 1);
    rankRange.setFontSize(10).setFontStyle('italic');
    if (config.includeColors) {
      rankRange.setBackground(bgColor);
    }
    sheet.getRange(currentRow, 1, 1, 5).merge();
    currentRow++;
  }

  // Table headers
  currentRow = createTableHeaders(sheet, currentRow, config);

  // Assignment rows - pass printConfig for ministry group colors
  currentRow = createAssignmentRows(sheet, assignments, currentRow, config, printConfig);

  currentRow++; // Space between celebrations
  return currentRow;
}

/**
 * Creates table headers for assignment data.
 * PERFORMANCE: Use batch write instead of individual setValue() calls
 * UPDATED: Show Ministry + Role columns (or just Role if single ministry filtered)
 */
function createTableHeaders(sheet, startRow, config) {
  // Decide columns based on filter
  let headers;

  if (config.ministryFilter && config.ministryFilter.length === 1) {
    // Single ministry filter: hide redundant Ministry column
    headers = ['Date', 'Time', 'Description', 'Role', 'Assigned Volunteer'];
  } else {
    // Full schedule or multi-ministry: show both Ministry and Role
    headers = ['Date', 'Time', 'Description', 'Ministry', 'Role', 'Assigned Volunteer'];
  }

  // PERFORMANCE: Write all headers in one API call
  sheet.getRange(startRow, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(startRow, 1, 1, headers.length);
  headerRange.setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
  headerRange.setBorder(true, true, true, true, true, true);

  return startRow + 1;
}

/**
 * Creates assignment rows with optimized batch operations.
 * PERFORMANCE: Collects all data first, then writes in bulk operations
 */
function createAssignmentRows(sheet, assignments, startRow, config, printConfig) {
  // Group assignments by mass for cleaner display
  const massByDateTime = new Map();

  for (const assignment of assignments) {
    const massKey = `${assignment.date.toDateString()}_${assignment.time.toTimeString()}_${assignment.massName}`;
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

  // Sort masses chronologically
  const sortedMasses = Array.from(massByDateTime.values()).sort((a, b) => {
    const aDateTime = a.date.getTime();
    const bDateTime = b.date.getTime();

    if (aDateTime !== bDateTime) {
      return aDateTime - bDateTime;
    }

    const aTimeOfDay = a.time.getTime();
    const bTimeOfDay = b.time.getTime();

    return aTimeOfDay - bTimeOfDay;
  });

  // Determine if we should show ministry column
  const showMinistryColumn = !(config.ministryFilter && config.ministryFilter.length === 1);

  // PERFORMANCE: Collect all row data before writing
  const rowData = [];
  const formattingInfo = []; // Track special formatting needs

  let rowIndex = 0;
  for (const mass of sortedMasses) {
    // Sort assignments within the mass by role
    mass.assignments.sort((a, b) => a.role.localeCompare(b.role));

    for (let i = 0; i < mass.assignments.length; i++) {
      const assignment = mass.assignments[i];

      // Build row data based on configuration
      const row = showMinistryColumn ? [
        i === 0 ? mass.date : '',  // Only show date on first row of mass
        i === 0 ? HELPER_formatTime(mass.time) : '',  // Only show time on first row
        i === 0 ? mass.massName : '',  // Only show mass name on first row
        assignment.ministry,       // Show ministry
        assignment.role,           // Show role
        assignment.assignedVolunteerName
      ] : [
        i === 0 ? mass.date : '',  // Only show date on first row of mass
        i === 0 ? HELPER_formatTime(mass.time) : '',  // Only show time on first row
        i === 0 ? mass.massName : '',  // Only show mass name on first row
        assignment.role,           // Just show role (ministry is implied by filter)
        assignment.assignedVolunteerName
      ];

      rowData.push(row);

      // Track formatting needs
      formattingInfo.push({
        rowOffset: rowIndex,
        isUnassigned: assignment.assignedVolunteerName === 'UNASSIGNED',
        assignedGroup: assignment.assignedGroup,
        hasDate: i === 0  // Need to apply date format to first row
      });

      rowIndex++;
    }
  }

  // PERFORMANCE: Write all data in ONE API call
  if (rowData.length > 0) {
    const numCols = showMinistryColumn ? 6 : 5;
    sheet.getRange(startRow, 1, rowData.length, numCols).setValues(rowData);
    Logger.log(`✅ PERFORMANCE: Batch wrote ${rowData.length} assignment rows in 1 API call (saved ${rowData.length * numCols - 1} calls)`);

    // Apply formatting in batches
    // 1. Apply borders to all rows at once
    sheet.getRange(startRow, 1, rowData.length, numCols).setBorder(true, true, true, true, false, false);

    // 2. Apply date formatting to date cells (first row of each mass)
    // 3. Apply background colors where needed
    for (let i = 0; i < formattingInfo.length; i++) {
      const info = formattingInfo[i];
      const actualRow = startRow + info.rowOffset;

      // Apply date format to first row of each mass
      if (info.hasDate) {
        sheet.getRange(actualRow, 1).setNumberFormat('M/d/yyyy');
      }

      // Apply background colors
      const volunteerColIndex = showMinistryColumn ? 6 : 5;

      if (info.isUnassigned) {
        // Highlight unassigned volunteer name cell
        sheet.getRange(actualRow, volunteerColIndex).setBackground('#fce8e6');
      } else if (info.assignedGroup && printConfig && printConfig.ministryGroupColors) {
        const groupColor = printConfig.ministryGroupColors[info.assignedGroup];
        if (groupColor) {
          // Apply ministry group color to entire row
          sheet.getRange(actualRow, 1, 1, numCols).setBackground(groupColor);
        }
      }
    }
  }

  return startRow + rowData.length;
}

/**
 * Creates chronological content (alternative layout).
 */
function createChronologicalContent(sheet, scheduleData, startRow, config) {
  let currentRow = startRow;
  const { printConfig } = scheduleData;

  // Create single table with all assignments in date order
  currentRow = createTableHeaders(sheet, currentRow, config);
  currentRow = createAssignmentRows(sheet, scheduleData.assignments, currentRow, config, printConfig);

  return currentRow;
}

/**
 * Creates the summary section.
 * PERFORMANCE: Batch write summary data
 */
function createScheduleSummary(sheet, assignments, startRow, config) {
  let currentRow = startRow + 1;

  // Calculate statistics
  const stats = calculateAssignmentStatistics(assignments);

  // PERFORMANCE: Batch write all summary data
  const summaryData = [
    ['MINISTRY ASSIGNMENT SUMMARY'],
    [`Total Ministry Assignments: ${stats.totalRoles}`],
    [`✓ Assigned: ${stats.assignedRoles} (${Math.round(stats.assignedRoles/stats.totalRoles*100)}%)`],
    [`⚠ Still Needed: ${stats.unassignedRoles} (${Math.round(stats.unassignedRoles/stats.totalRoles*100)}%)`]
  ];

  sheet.getRange(currentRow, 1, summaryData.length, 1).setValues(summaryData);

  // Apply formatting to header
  sheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#fff2cc');
  sheet.getRange(currentRow, 1, 1, 5).merge();
  currentRow++;

  // Skip total row (no special background)
  currentRow++;

  // Apply green background to assigned row
  if (stats.assignedRoles > 0) {
    sheet.getRange(currentRow, 1).setBackground('#e6f4ea');
  }
  currentRow++;

  // Apply red background to unassigned row
  if (stats.unassignedRoles > 0) {
    sheet.getRange(currentRow, 1).setBackground('#fce8e6');
  }

  return currentRow + 2;
}

/**
 * Calculates assignment statistics.
 */
function calculateAssignmentStatistics(assignments) {
  let totalRoles = assignments.length;
  let assignedRoles = 0;
  let unassignedRoles = 0;
  
  for (const assignment of assignments) {
    if (assignment.assignedVolunteerName === 'UNASSIGNED') {
      unassignedRoles++;
    } else {
      assignedRoles++;
    }
  }
  
  return { totalRoles, assignedRoles, unassignedRoles };
}

/**
 * Applies final formatting to the schedule sheet.
 * UPDATED: Handle variable column count based on ministry filter
 */
function applyScheduleFormatting(sheet, config) {
  // Determine number of columns based on filter
  const showMinistryColumn = !(config.ministryFilter && config.ministryFilter.length === 1);
  const numCols = showMinistryColumn ? 6 : 5;

  // Auto-resize columns
  sheet.autoResizeColumns(1, numCols);

  // Set optimal column widths
  if (config.columnWidths === 'auto' || !config.columnWidths) {
    sheet.setColumnWidth(1, 100);  // Date
    sheet.setColumnWidth(2, 90);   // Time
    sheet.setColumnWidth(3, 200);  // Description

    if (showMinistryColumn) {
      // 6 columns: Date, Time, Description, Ministry, Role, Volunteer
      sheet.setColumnWidth(4, 150);  // Ministry
      sheet.setColumnWidth(5, 150);  // Role
      sheet.setColumnWidth(6, 200);  // Assigned Volunteer
    } else {
      // 5 columns: Date, Time, Description, Role, Volunteer
      sheet.setColumnWidth(4, 180);  // Role (wider since no Ministry column)
      sheet.setColumnWidth(5, 200);  // Assigned Volunteer
    }
  } else if (typeof config.columnWidths === 'object') {
    // Custom column widths
    Object.keys(config.columnWidths).forEach(col => {
      const colNum = parseInt(col);
      if (colNum > 0 && colNum <= numCols) {
        sheet.setColumnWidth(colNum, config.columnWidths[col]);
      }
    });
  }

  // Set font family
  const dataRange = sheet.getRange(1, 1, sheet.getLastRow(), numCols);
  dataRange.setFontFamily('Arial');

  Logger.log('Applied final formatting to schedule sheet');
}

/**
 * Legacy function wrapper for backward compatibility.
 * This replaces the old PRINT_generateLiturgicalSchedule function.
 */
function PRINT_generateLiturgicalSchedule(monthString) {
  return generatePrintableSchedule(monthString, {
    sheetName: 'LiturgicalSchedule',
    layoutStyle: 'liturgical',
    showRankInfo: true,
    includeColors: true
  });
}

/**
 * Quick print function for menu integration.
 */
function generateCurrentMonthSchedule() {
  try {
    const now = new Date();
    const monthString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const result = generatePrintableSchedule(monthString);
    HELPER_showSuccess('Print Schedule Generated', result);
  } catch (e) {
    HELPER_showError('Generate Print Schedule Failed', e, 'print');
  }
}

/**
 * Enhanced print with custom options.
 */
function generateCustomPrintSchedule(monthString, customOptions = {}) {
  const defaultOptions = {
    sheetName: 'CustomSchedule',
    layoutStyle: 'liturgical',
    includeColors: true,
    includeSummary: true,
    showRankInfo: true
  };
  
  const mergedOptions = { ...defaultOptions, ...customOptions };
  return generatePrintableSchedule(monthString, mergedOptions);
}
