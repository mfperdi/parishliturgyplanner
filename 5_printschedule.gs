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
      layoutStyle: options.layoutStyle || 'liturgical', // 'liturgical' or 'chronological'
      includeColors: options.includeColors !== false, // Default true
      includeSummary: options.includeSummary !== false, // Default true
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
    if (!scheduleSheet) {
      scheduleSheet = ss.insertSheet(config.sheetName);
    } else {
      // Clear only from row 4 onward, preserving the manual header setup in rows 1-3
      if (scheduleSheet.getLastRow() >= 4) {
        scheduleSheet.getRange(4, 1, scheduleSheet.getLastRow() - 3, scheduleSheet.getMaxColumns()).clear();
      }
    }
    
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
  const assignments = getAssignmentDataForMonth(monthString);

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
        assignments.push({
          date: new Date(row[assignCols.DATE - 1]),
          time: new Date(row[assignCols.TIME - 1]), // Ensure this is a Date object for sorting
          massName: HELPER_safeArrayAccess(row, assignCols.MASS_NAME - 1),
          liturgicalCelebration: HELPER_safeArrayAccess(row, assignCols.LITURGICAL_CELEBRATION - 1),
          ministryRole: HELPER_safeArrayAccess(row, assignCols.MINISTRY_ROLE - 1),
          assignedGroup: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_GROUP - 1),
          assignedVolunteerName: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_NAME - 1) || 'UNASSIGNED',
          status: HELPER_safeArrayAccess(row, assignCols.STATUS - 1, 'Pending'),
          notes: HELPER_safeArrayAccess(row, assignCols.NOTES - 1),
          eventId: HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1)
        });
      }
    }
    
    // Sort assignments by date, then time, then role
    assignments.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      // *** FIX 1: Compare time objects directly, not as strings ***
      if (a.time.getTime() !== b.time.getTime()) {
        return a.time.getTime() - b.time.getTime();
      }
      return a.ministryRole.localeCompare(b.ministryRole);
    });
    
  } catch (error) {
    Logger.log(`Error reading assignment data: ${error}`);
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
 * ASSUMES: Rows 1-2 are manually set up with logo and header text.
 * UPDATES: Only cell B3 with the current generated timestamp.
 */
function createScheduleHeader(sheet, parishName, displayName, config, printConfig) {
  // Rows 1-2 are manually set up by the user with:
  // - A1:A3 merged with logo image
  // - B1: Parish Name
  // - B2: Schedule Title

  // Update only the generated timestamp in B3
  const generatedText = `Generated: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
  sheet.getRange(3, 2).setValue(generatedText);
  sheet.getRange(3, 2).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('left');

  Logger.log('Updated generated timestamp in cell B3');

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
 */
function createCelebrationSection(sheet, celebration, liturgyInfo, assignments, startRow, config, printConfig, liturgicalNotes) {
  let currentRow = startRow;

  // Celebration header with color coding - use configured liturgical colors
  const liturgicalColorOverrides = (printConfig && printConfig.liturgicalColors) || {};
  const bgColor = config.includeColors ? HELPER_getLiturgicalColorHex(liturgyInfo.color, liturgicalColorOverrides) : '#d9ead3';

  sheet.getRange(currentRow, 1).setValue(celebration);
  sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold');
  if (config.includeColors) {
    sheet.getRange(currentRow, 1).setBackground(bgColor);
  }
  sheet.getRange(currentRow, 1, 1, 5).merge();
  currentRow++;

  // Rank/Season/Color info (if enabled)
  if (config.showRankInfo && liturgyInfo) {
    // Build rank info line
    let rankInfo = `${liturgyInfo.rank} • ${liturgyInfo.season} • ${liturgyInfo.color}`;

    // Append liturgical notes if they exist for this celebration
    if (liturgicalNotes && liturgicalNotes.has(celebration)) {
      const notes = liturgicalNotes.get(celebration);
      rankInfo += ` | ${notes}`;
    }

    sheet.getRange(currentRow, 1).setValue(rankInfo);
    sheet.getRange(currentRow, 1).setFontSize(10).setFontStyle('italic');
    if (config.includeColors) {
      sheet.getRange(currentRow, 1).setBackground(bgColor);
    }
    sheet.getRange(currentRow, 1, 1, 5).merge();
    currentRow++;
  }

  // Table headers
  currentRow = createTableHeaders(sheet, currentRow);

  // Assignment rows - pass printConfig for ministry group colors
  currentRow = createAssignmentRows(sheet, assignments, currentRow, config, printConfig);

  currentRow++; // Space between celebrations
  return currentRow;
}

/**
 * Creates table headers for assignment data.
 */
function createTableHeaders(sheet, startRow) {
  const headers = ['Date', 'Time', 'Mass Name', 'Ministry Role', 'Assigned Volunteer'];
  
  for (let i = 0; i < headers.length; i++) {
    sheet.getRange(startRow, i + 1).setValue(headers[i]);
  }
  
  const headerRange = sheet.getRange(startRow, 1, 1, headers.length);
  headerRange.setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
  headerRange.setBorder(true, true, true, true, true, true);
  
  return startRow + 1;
}

/**
 * Creates assignment rows with optimized grouping and ministry group colors.
 */
function createAssignmentRows(sheet, assignments, startRow, config, printConfig) {
  let currentRow = startRow;

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
    if (a.date.getTime() !== b.date.getTime()) {
      return a.date.getTime() - b.date.getTime();
    }
    // *** FIX 2: Compare time objects directly, not as strings ***
    return a.time.getTime() - b.time.getTime();
  });

  // Create rows for each mass
  for (const mass of sortedMasses) {
    // Sort assignments within the mass by role
    mass.assignments.sort((a, b) => a.ministryRole.localeCompare(b.ministryRole));

    for (let i = 0; i < mass.assignments.length; i++) {
      const assignment = mass.assignments[i];

      // Only show date/time/mass name on first row of each mass
      if (i === 0) {
        // *** FIX 3: Bypass helper and use direct formatting for the date ***
        sheet.getRange(currentRow, 1).setValue(mass.date).setNumberFormat('M/d/yyyy');
        sheet.getRange(currentRow, 2).setValue(HELPER_formatTime(mass.time));
        sheet.getRange(currentRow, 3).setValue(mass.massName);
      }

      sheet.getRange(currentRow, 4).setValue(assignment.ministryRole);
      sheet.getRange(currentRow, 5).setValue(assignment.assignedVolunteerName);

      // Format the row
      const rowRange = sheet.getRange(currentRow, 1, 1, 5);
      rowRange.setBorder(true, true, true, true, false, false);

      // Apply background color based on assignment status and ministry group
      if (assignment.assignedVolunteerName === 'UNASSIGNED') {
        // Highlight unassigned roles in red
        sheet.getRange(currentRow, 5).setBackground('#fce8e6');
      } else if (assignment.assignedGroup && printConfig && printConfig.ministryGroupColors) {
        // Check if there's a configured color for this ministry group
        const groupColor = printConfig.ministryGroupColors[assignment.assignedGroup];
        if (groupColor) {
          // Apply ministry group color to the entire row
          rowRange.setBackground(groupColor);
        }
      }

      currentRow++;
    }
  }

  return currentRow;
}

/**
 * Creates chronological content (alternative layout).
 */
function createChronologicalContent(sheet, scheduleData, startRow, config) {
  let currentRow = startRow;
  const { printConfig } = scheduleData;

  // Create single table with all assignments in date order
  currentRow = createTableHeaders(sheet, currentRow);
  currentRow = createAssignmentRows(sheet, scheduleData.assignments, currentRow, config, printConfig);

  return currentRow;
}

/**
 * Creates the summary section.
 */
function createScheduleSummary(sheet, assignments, startRow, config) {
  let currentRow = startRow + 1;
  
  // Summary header
  sheet.getRange(currentRow, 1).setValue('MINISTRY ASSIGNMENT SUMMARY');
  sheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold').setBackground('#fff2cc');
  sheet.getRange(currentRow, 1, 1, 5).merge();
  currentRow++;
  
  // Calculate statistics
  const stats = calculateAssignmentStatistics(assignments);
  
  // Basic statistics
  sheet.getRange(currentRow, 1).setValue(`Total Ministry Assignments: ${stats.totalRoles}`);
  currentRow++;
  
  sheet.getRange(currentRow, 1).setValue(`✓ Assigned: ${stats.assignedRoles} (${Math.round(stats.assignedRoles/stats.totalRoles*100)}%)`);
  if (stats.assignedRoles > 0) {
    sheet.getRange(currentRow, 1).setBackground('#e6f4ea');
  }
  currentRow++;
  
  sheet.getRange(currentRow, 1).setValue(`⚠ Still Needed: ${stats.unassignedRoles} (${Math.round(stats.unassignedRoles/stats.totalRoles*100)}%)`);
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
 */
function applyScheduleFormatting(sheet, config) {
  // Auto-resize columns
  sheet.autoResizeColumns(1, 5);
  
  // Set optimal column widths
  if (config.columnWidths === 'auto' || !config.columnWidths) {
    sheet.setColumnWidth(1, 80);  // Date
    sheet.setColumnWidth(2, 70);  // Time  
    sheet.setColumnWidth(3, 140); // Mass Name
    sheet.setColumnWidth(4, 130); // Ministry Role
    sheet.setColumnWidth(5, 140); // Assigned Volunteer
  } else if (typeof config.columnWidths === 'object') {
    // Custom column widths
    Object.keys(config.columnWidths).forEach(col => {
      const colNum = parseInt(col);
      if (colNum > 0 && colNum <= 5) {
        sheet.setColumnWidth(colNum, config.columnWidths[col]);
      }
    });
  }
  
  // Set font family
  const dataRange = sheet.getRange(1, 1, sheet.getLastRow(), 5);
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
    SpreadsheetApp.getUi().alert('Success', result, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error', `Could not generate schedule: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
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
