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

      // Unfreeze rows/columns to avoid "can't merge frozen and non-frozen rows" error
      scheduleSheet.setFrozenRows(0);
      scheduleSheet.setFrozenColumns(0);
    }

    // Note: Header setup is now done in createScheduleHeader() using Config "Logo URL"
    // No need to copy from MonthlyView - everything is programmatically created
    
    // Get month display name
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');
    
    // Build the required data
    const scheduleData = buildScheduleData(monthString, config);

    Logger.log(`Found ${scheduleData.liturgicalData.size} liturgical celebrations and ${scheduleData.assignments.length} assignments`);

    // Determine number of columns based on ministry filter
    const showMinistryColumn = !(config.ministryFilter && config.ministryFilter.length === 1);
    const numColumns = showMinistryColumn ? 6 : 5;

    // Generate the schedule using modular approach
    let currentRow = createScheduleHeader(scheduleSheet, scheduleData, displayName, config, numColumns);
    currentRow = createScheduleContent(scheduleSheet, scheduleData, currentRow, config, numColumns);
    
    if (config.includeSummary) {
      currentRow = createScheduleSummary(scheduleSheet, scheduleData.assignments, currentRow, config);
    }
    
    // Apply final formatting
    applyScheduleFormatting(scheduleSheet, config);

    // Freeze header rows (rows 1-5) to keep them visible when scrolling
    // Row 5 is blank, content starts at row 6
    scheduleSheet.setFrozenRows(5);

    // Trim excess rows and columns for clean print/PDF output
    trimSheet(scheduleSheet, numColumns);

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
          eventId: HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1),
          isAnticipated: HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1) === true || HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1) === 'TRUE'
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
 * Determines the liturgical year based on Advent date and Mass dates in the schedule.
 * Liturgical year starts on 1st Sunday of Advent (late November/early December).
 * If month spans two liturgical years, returns the year with the majority of Masses.
 * @param {Array} assignments - Array of assignment objects with date property
 * @returns {number} The liturgical year (e.g., 2026 for Advent 2025 - Advent 2026)
 */
function determineLiturgicalYear(assignments) {
  if (!assignments || assignments.length === 0) {
    return new Date().getFullYear();
  }

  try {
    // Get all unique Mass dates from assignments
    const massDates = [...new Set(assignments.map(a => a.date))].filter(d => d instanceof Date);

    if (massDates.length === 0) {
      return new Date().getFullYear();
    }

    // Read LiturgicalCalendar to find Advent dates
    const calendarData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.CALENDAR);
    const calCols = CONSTANTS.COLS.CALENDAR;

    // Find all "1st Sunday of Advent" dates
    const adventDates = [];
    for (const row of calendarData) {
      const celebration = row[calCols.LITURGICAL_CELEBRATION - 1];
      if (celebration && celebration.toLowerCase().includes("1st sunday of advent")) {
        const date = new Date(row[calCols.DATE - 1]);
        adventDates.push(date);
      }
    }

    // Sort Advent dates chronologically
    adventDates.sort((a, b) => a.getTime() - b.getTime());

    if (adventDates.length === 0) {
      // Fallback: if no Advent dates found, use calendar year of first Mass
      return massDates[0].getFullYear();
    }

    // Count masses in each liturgical year
    const liturgicalYearCounts = {};

    for (const massDate of massDates) {
      let liturgicalYear = null;

      // Find which liturgical year this Mass belongs to
      for (let i = 0; i < adventDates.length; i++) {
        const adventStart = adventDates[i];
        const nextAdvent = adventDates[i + 1];

        // Check if massDate is in this liturgical year
        // Liturgical year runs from Advent to day before next Advent
        if (massDate >= adventStart && (!nextAdvent || massDate < nextAdvent)) {
          // Liturgical year is the year AFTER Advent starts
          // e.g., Advent Nov 30, 2025 → Liturgical Year 2026
          liturgicalYear = adventStart.getFullYear() + 1;
          break;
        }
      }

      // If no Advent boundary found, check if before first Advent
      if (!liturgicalYear && massDate < adventDates[0]) {
        liturgicalYear = adventDates[0].getFullYear(); // Before first Advent in calendar
      }

      // Fallback to calendar year if still not determined
      if (!liturgicalYear) {
        liturgicalYear = massDate.getFullYear();
      }

      // Count this mass for its liturgical year
      liturgicalYearCounts[liturgicalYear] = (liturgicalYearCounts[liturgicalYear] || 0) + 1;
    }

    // Return the liturgical year with the most Masses
    let maxYear = null;
    let maxCount = 0;

    for (const [year, count] of Object.entries(liturgicalYearCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxYear = parseInt(year);
      }
    }

    Logger.log(`Determined liturgical year: ${maxYear} (based on ${maxCount} masses)`);
    return maxYear;

  } catch (e) {
    Logger.log(`Error determining liturgical year: ${e.message}, falling back to calendar year`);
    // Fallback: use calendar year of first Mass
    const firstDate = assignments[0].date;
    return firstDate instanceof Date ? firstDate.getFullYear() : new Date().getFullYear();
  }
}

/**
 * Creates the schedule header section.
 * Sets up logo (from Config "Logo URL"), parish/ministry name, schedule title, liturgical year/cycle, and timestamp.
 * IMPORTANT: Uses =IMAGE() formula for logo so it can be copied programmatically.
 * Layout: Logo in A1:A4 (vertical merge), content in B1:numColumns
 * @param {object} scheduleData - Complete schedule data including assignments
 * @param {number} numColumns - Total number of columns in the schedule (5 or 6)
 */
function createScheduleHeader(sheet, scheduleData, displayName, config, numColumns = 6) {
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

  // Determine liturgical year based on Advent date and actual Mass dates
  const liturgicalYear = determineLiturgicalYear(scheduleData.assignments);

  // Calculate Sunday Cycle (A, B, C) based on LITURGICAL year
  // Year A: year % 3 = 1, Year B: year % 3 = 2, Year C: year % 3 = 0
  const sundayCycle = liturgicalYear % 3 === 1 ? 'A' : (liturgicalYear % 3 === 2 ? 'B' : 'C');

  // Calculate Weekday Cycle (I or II) based on odd/even LITURGICAL year
  const weekdayCycle = liturgicalYear % 2 === 0 ? 'II' : 'I';

  // Calculate header merge width (from column B to last column)
  const headerMergeWidth = numColumns - 1;  // Exclude column A (logo column)

  // Logo: A1:A4 vertical merge (extended to 4 rows)
  try {
    // Merge A1:A4 vertically for logo
    const logoRange = sheet.getRange(1, 1, 4, 1);  // A1:A4 (4 rows)
    logoRange.merge();

    // Center the logo in the cell
    logoRange.setHorizontalAlignment('center');
    logoRange.setVerticalAlignment('middle');

    if (logoUrl) {
      // Set =IMAGE() formula with logo URL from config
      const imageFormula = `=IMAGE("${logoUrl}", 1)`;  // Mode 1 = fit to cell
      sheet.getRange(1, 1).setFormula(imageFormula);
      Logger.log(`Set logo formula in A1:A4 with URL: ${logoUrl}`);
    } else {
      // No logo URL configured - leave A1:A4 empty but merged
      Logger.log('No Logo URL in config - A1:A4 merged but empty');
    }

  } catch (e) {
    Logger.log(`Could not set up logo: ${e.message}`);
  }

  // Row 1, Columns B to last column: Parish and Ministry Name
  try {
    const headerText = `${parish} - ${ministry}`;
    const headerRange = sheet.getRange(1, 2, 1, headerMergeWidth);
    headerRange.merge();
    headerRange.setValue(headerText);
    headerRange.setFontSize(16)
                .setFontWeight('bold')
                .setHorizontalAlignment('left')
                .setVerticalAlignment('middle');
    Logger.log(`Set parish/ministry header in row 1, cols 2-${numColumns}: ${headerText}`);
  } catch (e) {
    Logger.log(`Could not set parish/ministry header: ${e.message}`);
  }

  // Row 2, Columns B to last column: Schedule title
  try {
    const scheduleTitle = `${displayName} Schedule`;
    const titleRange = sheet.getRange(2, 2, 1, headerMergeWidth);
    titleRange.merge();
    titleRange.setValue(scheduleTitle);
    titleRange.setFontSize(14)
              .setFontWeight('bold')
              .setHorizontalAlignment('left')
              .setVerticalAlignment('middle');
    Logger.log(`Set schedule title in row 2, cols 2-${numColumns}: ${scheduleTitle}`);
  } catch (e) {
    Logger.log(`Could not set schedule title: ${e.message}`);
  }

  // Row 3, Columns B to last column: Liturgical Year and Reading Cycles (NEW)
  try {
    const liturgicalInfo = `Liturgical Year ${liturgicalYear}: Sunday Cycle ${sundayCycle}, Weekday Cycle ${weekdayCycle}`;
    const liturgicalRange = sheet.getRange(3, 2, 1, headerMergeWidth);
    liturgicalRange.merge();
    liturgicalRange.setValue(liturgicalInfo);
    liturgicalRange.setFontSize(11)
                   .setFontWeight('normal')
                   .setHorizontalAlignment('left')
                   .setVerticalAlignment('middle');
    Logger.log(`Set liturgical year info in row 3, cols 2-${numColumns}: ${liturgicalInfo}`);
  } catch (e) {
    Logger.log(`Could not set liturgical year info: ${e.message}`);
  }

  // Row 4, Columns B to last column: Timestamp (moved from row 3)
  try {
    const timestamp = `Generated: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
    const timestampRange = sheet.getRange(4, 2, 1, headerMergeWidth);
    timestampRange.merge();
    timestampRange.setValue(timestamp);
    timestampRange.setFontSize(10)
                  .setFontStyle('italic')
                  .setHorizontalAlignment('left')
                  .setVerticalAlignment('middle');
    Logger.log(`Set timestamp in row 4, cols 2-${numColumns}`);
  } catch (e) {
    Logger.log(`Could not set timestamp: ${e.message}`);
  }

  // Row 5 is blank, schedule content starts at row 6
  return 6;
}

/**
 * Creates the main schedule content with configurable layout.
 */
function createScheduleContent(sheet, scheduleData, startRow, config, numColumns = 6) {
  let currentRow = startRow;

  if (config.groupByLiturgy) {
    currentRow = createLiturgicalContent(sheet, scheduleData, currentRow, config, numColumns);
  } else {
    currentRow = createChronologicalContent(sheet, scheduleData, currentRow, config, numColumns);
  }

  return currentRow;
}

/**
 * Creates content grouped by liturgical celebrations.
 */
function createLiturgicalContent(sheet, scheduleData, startRow, config, numColumns = 6) {
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

    currentRow = createCelebrationSection(sheet, celebration, liturgyInfo, celebrationAssignments, currentRow, config, printConfig, liturgicalNotes, numColumns);
  }

  return currentRow;
}

/**
 * Creates a section for a single liturgical celebration.
 * PERFORMANCE: Batch write celebration header data
 */
function createCelebrationSection(sheet, celebration, liturgyInfo, assignments, startRow, config, printConfig, liturgicalNotes, numColumns = 6) {
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
  sheet.getRange(currentRow, 1, 1, numColumns).merge();
  currentRow++;

  // Apply formatting to rank info row if it exists
  if (headerRows === 2) {
    const rankRange = sheet.getRange(currentRow, 1);
    rankRange.setFontSize(10).setFontStyle('italic');
    if (config.includeColors) {
      rankRange.setBackground(bgColor);
    }
    sheet.getRange(currentRow, 1, 1, numColumns).merge();
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
  let massIndex = 0;
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
        hasDate: i === 0,  // Need to apply date format to first row
        massIndex: massIndex  // Track which mass this row belongs to for alternating colors
      });

      rowIndex++;
    }
    massIndex++;
  }

  // PERFORMANCE: Write all data in ONE API call
  if (rowData.length > 0) {
    const numCols = showMinistryColumn ? 6 : 5;
    sheet.getRange(startRow, 1, rowData.length, numCols).setValues(rowData);
    Logger.log(`✅ PERFORMANCE: Batch wrote ${rowData.length} assignment rows in 1 API call (saved ${rowData.length * numCols - 1} calls)`);

    // Apply formatting in batches
    // 1. Apply borders to all rows at once
    sheet.getRange(startRow, 1, rowData.length, numCols).setBorder(true, true, true, true, false, false);

    // 2. Apply date formatting and background colors
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
        // Highlight unassigned volunteer name cell only
        sheet.getRange(actualRow, volunteerColIndex).setBackground('#fce8e6');
      } else if (info.assignedGroup && printConfig && printConfig.ministryGroupColors) {
        const groupColor = printConfig.ministryGroupColors[info.assignedGroup];
        if (groupColor) {
          // Apply ministry group color to entire row
          sheet.getRange(actualRow, 1, 1, numCols).setBackground(groupColor);
        }
      } else {
        // Alternating white/light gray for each mass time (no ministry color)
        const bgColor = info.massIndex % 2 === 0 ? '#ffffff' : '#f3f3f3';
        sheet.getRange(actualRow, 1, 1, numCols).setBackground(bgColor);
      }
    }
  }

  return startRow + rowData.length;
}

/**
 * Creates chronological content (alternative layout).
 */
function createChronologicalContent(sheet, scheduleData, startRow, config, numColumns = 6) {
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
 * Trims excess rows and columns from a sheet for clean print/PDF output.
 * Keeps content + buffer rows, but exact content columns for clean appearance.
 * @param {Sheet} sheet - The sheet to trim
 * @param {number} numColumns - The number of content columns (5 or 6)
 */
function trimSheet(sheet, numColumns) {
  try {
    // Step 1: Get actual content dimensions
    const lastRow = sheet.getLastRow();  // Last row with content
    const lastCol = numColumns;  // We know this from our layout

    // Step 2: Calculate target dimensions with buffer
    const bufferRows = 2;  // Room for manual notes
    const bufferCols = 0;  // No buffer - trim to exact content width for clean print
    const targetRows = lastRow + bufferRows;
    const targetCols = lastCol + bufferCols;

    // Step 3: Delete excess rows (if any)
    const maxRows = sheet.getMaxRows();
    if (maxRows > targetRows) {
      const rowsToDelete = maxRows - targetRows;
      sheet.deleteRows(targetRows + 1, rowsToDelete);
      Logger.log(`Trimmed ${rowsToDelete} excess rows (kept ${targetRows} rows)`);
    }

    // Step 4: Delete excess columns (if any)
    const maxCols = sheet.getMaxColumns();
    if (maxCols > targetCols) {
      const colsToDelete = maxCols - targetCols;
      sheet.deleteColumns(targetCols + 1, colsToDelete);
      Logger.log(`Trimmed ${colsToDelete} excess columns (kept ${targetCols} columns)`);
    }

    Logger.log(`Sheet trimmed to ${targetRows} rows x ${targetCols} columns for clean print output`);
  } catch (e) {
    Logger.log(`Warning: Could not trim sheet: ${e.message}`);
    // Non-fatal - continue even if trim fails
  }
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


// =============================================================================
// WEEKLY VIEW GENERATION
// =============================================================================

/**
 * Generate simplified weekly view optimized for email copy-paste.
 * Creates a "WeeklyView" sheet showing assignments for the current liturgical week (Sunday-Saturday).
 *
 * @param {Date} weekStartDate - Sunday of the target week (default: current week)
 * @param {object} options - Configuration options
 * @param {Array} options.ministryFilter - Array of ministry names to filter (e.g., ['Lector'])
 * @param {string} options.sheetName - Target sheet name (default: 'WeeklyView')
 * @param {boolean} options.includeColors - Use background colors (default: false for email compatibility)
 * @param {string} options.weekRange - Week range ('current', 'next', '2weeks', '3weeks', '4weeks')
 * @returns {string} Success message
 *
 * @example
 * // Generate current week
 * generateWeeklyView();
 *
 * // Generate with ministry filter
 * generateWeeklyView(null, { ministryFilter: ['Lector'] });
 *
 * // Generate next 2 weeks
 * generateWeeklyView(null, { weekRange: '2weeks' });
 *
 * // Generate specific week
 * generateWeeklyView(new Date(2026, 0, 5)); // Week of Jan 5-11, 2026
 */
function generateWeeklyView(weekStartDate = null, options = {}) {
  try {
    // Calculate week boundaries based on range option
    let weekBounds;
    const weekRange = options.weekRange || 'current';

    if (weekStartDate) {
      // Specific date provided - use single week
      weekBounds = HELPER_getCurrentWeekBounds(weekStartDate);
    } else if (weekRange) {
      // Use multi-week range helper
      weekBounds = HELPER_getWeekRangeBounds(weekRange);
    } else {
      // Default to current week
      weekBounds = HELPER_getCurrentWeekBounds();
    }

    const { startDate, endDate, weekString } = weekBounds;
    Logger.log(`Generating weekly view for: ${weekString}`);
    Logger.log(`Week range: ${startDate} to ${endDate}`);

    // Set default options
    const config = {
      sheetName: options.sheetName || 'WeeklyView',
      ministryFilter: options.ministryFilter || null,
      includeColors: options.includeColors || false, // Email-friendly: no colors
      ...options
    };

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create or clear the target sheet
    let weeklySheet = ss.getSheetByName(config.sheetName);
    if (!weeklySheet) {
      weeklySheet = ss.insertSheet(config.sheetName);
      Logger.log(`Created new sheet: ${config.sheetName}`);
    } else {
      weeklySheet.clear();
      weeklySheet.setFrozenRows(0);
      weeklySheet.setFrozenColumns(0);
      SpreadsheetApp.flush(); // Ensure clear operation completes
      Utilities.sleep(500); // Small delay to prevent API rate limit
      Logger.log(`Cleared existing sheet: ${config.sheetName}`);
    }

    // Build weekly schedule data
    const scheduleData = buildWeeklyScheduleData(startDate, endDate, config);

    Logger.log(`Found ${scheduleData.assignments.length} assignments for the week`);

    // If range was extended due to vigil spillover, regenerate week string
    let finalWeekString = weekString;
    if (scheduleData.rangeExtended) {
      finalWeekString = HELPER_getWeekString(scheduleData.weekStart, scheduleData.weekEnd);
      Logger.log(`Week string updated to reflect extended range: ${finalWeekString}`);
    }

    // Determine number of columns (5 for email-friendly format)
    const numColumns = 5; // Date | Time | Mass | Role | Volunteer

    // Generate the schedule
    let currentRow = createWeeklyScheduleHeader(weeklySheet, scheduleData, finalWeekString, config, numColumns);
    currentRow = createWeeklyScheduleContent(weeklySheet, scheduleData, currentRow, config, numColumns);

    // Apply simple formatting (email-friendly)
    applyWeeklyScheduleFormatting(weeklySheet, numColumns);

    // Trim excess rows and columns
    trimSheet(weeklySheet, numColumns);

    Logger.log(`Weekly view created successfully in '${config.sheetName}' sheet`);

    // Use finalWeekString in success message (reflects any range extension)
    return `Weekly view for ${finalWeekString} has been created in the '${config.sheetName}' sheet. Ready to copy into email.`;

  } catch (e) {
    Logger.log(`ERROR in generateWeeklyView: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw new Error(`Could not generate weekly view: ${e.message}`);
  }
}


/**
 * Build schedule data filtered to one liturgical week.
 * Handles weeks that span multiple months or years.
 *
 * @param {Date} weekStart - Sunday of the week
 * @param {Date} weekEnd - Saturday of the week
 * @param {object} config - Configuration options
 * @returns {object} Weekly schedule data
 */
function buildWeeklyScheduleData(weekStart, weekEnd, config) {
  try {
    // Get parish name
    let parishName = "Parish Ministry Schedule";
    try {
      const configData = HELPER_readConfigSafe();
      parishName = configData["Parish Name"] || parishName;
    } catch (e) {
      Logger.log(`Could not read parish name: ${e.message}`);
    }

    // Determine which months are touched by this week
    const monthStrings = [];
    const startMonthString = `${weekStart.getFullYear()}-${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
    monthStrings.push(startMonthString);

    // If week spans into next month, add that month too
    if (weekEnd.getMonth() !== weekStart.getMonth() || weekEnd.getFullYear() !== weekStart.getFullYear()) {
      const endMonthString = `${weekEnd.getFullYear()}-${(weekEnd.getMonth() + 1).toString().padStart(2, '0')}`;
      monthStrings.push(endMonthString);
    }

    Logger.log(`Reading assignments from months: ${monthStrings.join(', ')}`);

    // Read ALL assignments from Assignments sheet (ignore Month-Year filter)
    // This ensures manually added assignments are included even if Month-Year is incorrect
    Logger.log(`Also reading assignments by date range (${HELPER_formatDate(weekStart, 'default')} - ${HELPER_formatDate(weekEnd, 'default')}) to catch manually added assignments`);

    let assignments = [];

    // Method 1: Read by Month-Year (standard approach)
    for (const monthString of monthStrings) {
      try {
        const monthAssignments = getAssignmentDataForMonth(monthString);
        assignments = assignments.concat(monthAssignments);
      } catch (e) {
        Logger.log(`No assignments found for ${monthString}: ${e.message}`);
      }
    }

    // Method 2: Read ALL assignments and filter by date (catches manually added with wrong Month-Year)
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
      if (assignSheet) {
        const allData = assignSheet.getDataRange().getValues();
        const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
        allData.shift(); // Remove header

        // Create extended date range (week start to extended end)
        const rangeStart = new Date(weekStart.getTime());
        const rangeEnd = new Date(weekEnd.getTime());
        rangeEnd.setDate(rangeEnd.getDate() + 7); // Extend by 1 week to catch spillover

        for (const row of allData) {
          const dateValue = row[assignCols.DATE - 1];
          if (!dateValue) continue;

          const date = new Date(dateValue);
          if (date >= rangeStart && date <= rangeEnd) {
            // Check if already loaded by Month-Year method
            const isDuplicate = assignments.some(a =>
              a.date.getTime() === date.getTime() &&
              a.role === row[assignCols.ROLE - 1] &&
              a.assignedVolunteerName === row[assignCols.ASSIGNED_VOLUNTEER_NAME - 1]
            );

            if (!isDuplicate) {
              // Add this assignment (wasn't caught by Month-Year filter)
              const timeValue = row[assignCols.TIME - 1];
              let time;
              if (timeValue && timeValue instanceof Date && !isNaN(timeValue.getTime())) {
                time = timeValue;
              } else if (timeValue) {
                time = new Date(timeValue);
                if (isNaN(time.getTime())) {
                  time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
                }
              } else {
                time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
              }

              assignments.push({
                date: date,
                time: time,
                massName: HELPER_safeArrayAccess(row, assignCols.DESCRIPTION - 1),
                liturgicalCelebration: HELPER_safeArrayAccess(row, assignCols.LITURGICAL_CELEBRATION - 1),
                ministry: HELPER_safeArrayAccess(row, assignCols.MINISTRY - 1),
                role: HELPER_safeArrayAccess(row, assignCols.ROLE - 1),
                assignedGroup: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_GROUP - 1),
                assignedVolunteerName: HELPER_safeArrayAccess(row, assignCols.ASSIGNED_VOLUNTEER_NAME - 1) || 'UNASSIGNED',
                status: HELPER_safeArrayAccess(row, assignCols.STATUS - 1, 'Pending'),
                eventId: HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1),
                isAnticipated: HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1) === true || HELPER_safeArrayAccess(row, assignCols.IS_ANTICIPATED - 1) === 'TRUE'
              });

              Logger.log(`  ✓ Added manually-added assignment: ${HELPER_formatDate(date, 'default')} ${row[assignCols.ROLE - 1]}`);
            }
          }
        }
      }
    } catch (e) {
      Logger.log(`Warning: Could not read assignments by date range: ${e.message}`);
      // Non-fatal - continue with assignments loaded by Month-Year
    }

    // Filter to week range (initial pass)
    Logger.log(`Filtering ${assignments.length} assignments to week range: ${HELPER_formatDate(weekStart, 'default')} - ${HELPER_formatDate(weekEnd, 'default')}`);

    let filteredAssignments = assignments.filter(a =>
      HELPER_isDateInWeek(a.date, weekStart, weekEnd)
    );

    Logger.log(`Found ${filteredAssignments.length} assignments in initial week range`);

    // SMART LITURGICAL COMPLETION: Check for vigil spillover on last day
    // If week ends with a vigil Mass, extend range to include the following day
    let extendedEnd = new Date(weekEnd.getTime());
    let rangeExtended = false;

    // Check if last day has any vigil masses
    const lastDayStart = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 0, 0, 0);
    const lastDayEnd = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59);

    const hasVigilOnLastDay = filteredAssignments.some(a => {
      const assignmentDate = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate());
      const lastDay = new Date(lastDayStart.getFullYear(), lastDayStart.getMonth(), lastDayStart.getDate());
      return assignmentDate.getTime() === lastDay.getTime() && a.isAnticipated === true;
    });

    if (hasVigilOnLastDay) {
      // Extend range to include the following day (Sunday or liturgical celebration)
      const nextDay = new Date(weekEnd.getTime());
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(23, 59, 59, 999);

      extendedEnd = nextDay;
      rangeExtended = true;

      Logger.log(`✅ VIGIL SPILLOVER DETECTED on ${HELPER_formatDate(weekEnd, 'default')}`);
      Logger.log(`   Extending range to ${HELPER_formatDate(nextDay, 'default')} to complete liturgical celebration`);

      // Check if we need to read from next month
      const nextDayMonthString = `${nextDay.getFullYear()}-${(nextDay.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!monthStrings.includes(nextDayMonthString)) {
        try {
          Logger.log(`   Reading additional month: ${nextDayMonthString}`);
          const nextMonthAssignments = getAssignmentDataForMonth(nextDayMonthString);
          assignments = assignments.concat(nextMonthAssignments);
          monthStrings.push(nextDayMonthString);
        } catch (e) {
          Logger.log(`   Warning: Could not read next month for spillover: ${e.message}`);
        }
      }

      // Add assignments from the extended day
      const nextDayAssignments = assignments.filter(a => {
        const assignmentDate = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate());
        const targetDate = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate());
        return assignmentDate.getTime() === targetDate.getTime();
      });

      filteredAssignments = filteredAssignments.concat(nextDayAssignments);
      Logger.log(`   Added ${nextDayAssignments.length} assignments from ${HELPER_formatDate(nextDay, 'default')}`);
    }

    // Use filtered assignments
    assignments = filteredAssignments;
    Logger.log(`Total assignments after liturgical completion: ${assignments.length}`);

    // Apply ministry filter if specified
    if (config.ministryFilter && config.ministryFilter.length > 0) {
      const ministrySet = new Set(
        config.ministryFilter.map(m => m.toLowerCase())
      );

      const originalCount = assignments.length;
      assignments = assignments.filter(a =>
        ministrySet.has(a.ministry.toLowerCase())
      );

      Logger.log(`Ministry filter applied: ${originalCount} → ${assignments.length} assignments`);
    }

    // Sort by date, then time, then role
    assignments.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }

      // Handle time comparison (can be Date object or string)
      if (a.time !== b.time) {
        const timeA = a.time instanceof Date ? a.time.getTime() : a.time;
        const timeB = b.time instanceof Date ? b.time.getTime() : b.time;

        if (typeof timeA === 'number' && typeof timeB === 'number') {
          return timeA - timeB; // Numeric comparison for Date objects
        } else if (typeof timeA === 'string' && typeof timeB === 'string') {
          return timeA.localeCompare(timeB); // String comparison for time strings
        }
      }

      return a.role.localeCompare(b.role);
    });

    // Build liturgical data map for the week (use extended range if applicable)
    const liturgicalData = new Map();
    for (const monthString of monthStrings) {
      try {
        const monthLiturgicalData = buildLiturgicalDataMap(monthString);
        for (const [key, value] of monthLiturgicalData) {
          // Only include if date is in week range (use extended end if range was extended)
          const datesInWeek = value.dates.filter(d =>
            HELPER_isDateInWeek(d, weekStart, extendedEnd)
          );
          if (datesInWeek.length > 0) {
            liturgicalData.set(key, {
              ...value,
              dates: datesInWeek
            });
          }
        }
      } catch (e) {
        Logger.log(`Could not load liturgical data for ${monthString}: ${e.message}`);
      }
    }

    return {
      parishName,
      assignments,
      liturgicalData,
      weekStart,
      weekEnd: extendedEnd,  // Use extended end date
      originalWeekEnd: weekEnd,  // Keep original for reference
      rangeExtended: rangeExtended,  // Flag indicating if range was extended
      ministryFilterText: config.ministryFilter ? config.ministryFilter.join(', ') : 'All Ministries'
    };

  } catch (e) {
    Logger.log(`ERROR in buildWeeklyScheduleData: ${e.message}`);
    throw new Error(`Could not build weekly schedule data: ${e.message}`);
  }
}


/**
 * Create weekly schedule header (simplified for email).
 *
 * @param {Sheet} sheet - Target sheet
 * @param {object} scheduleData - Weekly schedule data
 * @param {string} weekString - Formatted week range
 * @param {object} config - Configuration options
 * @param {number} numColumns - Number of columns
 * @returns {number} Starting content row
 */
function createWeeklyScheduleHeader(sheet, scheduleData, weekString, config, numColumns) {
  try {
    let currentRow = 1;

    // Row 1: Parish name + Ministry filter
    const headerTitle = config.ministryFilter && config.ministryFilter.length > 0
      ? `${scheduleData.parishName} - ${scheduleData.ministryFilterText}`
      : scheduleData.parishName;

    sheet.getRange(currentRow, 1, 1, numColumns).merge();
    sheet.getRange(currentRow, 1).setValue(headerTitle);
    sheet.getRange(currentRow, 1).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
    currentRow++;

    // Row 2: Week range (automatically extended if vigil spillover detected)
    sheet.getRange(currentRow, 1, 1, numColumns).merge();
    sheet.getRange(currentRow, 1).setValue(weekString);
    sheet.getRange(currentRow, 1).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    currentRow++;

    // Row 3: Generation timestamp
    const timestamp = `Generated: ${HELPER_formatDate(new Date(), 'long')}`;
    sheet.getRange(currentRow, 1, 1, numColumns).merge();
    sheet.getRange(currentRow, 1).setValue(timestamp);
    sheet.getRange(currentRow, 1).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center');
    currentRow++;

    // Blank separator
    currentRow++;

    return currentRow; // Content starts after blank separator

  } catch (e) {
    Logger.log(`ERROR in createWeeklyScheduleHeader: ${e.message}`);
    throw new Error(`Could not create weekly schedule header: ${e.message}`);
  }
}


/**
 * Create weekly schedule content with weekend grouping.
 * Groups Saturday vigil + Sunday masses together, keeps weekday masses in table format.
 *
 * @param {Sheet} sheet - Target sheet
 * @param {object} scheduleData - Weekly schedule data
 * @param {number} startRow - Starting row number
 * @param {object} config - Configuration options
 * @param {number} numColumns - Number of columns (not used in new format, kept for compatibility)
 * @returns {number} Final row number
 */
function createWeeklyScheduleContent(sheet, scheduleData, startRow, config, numColumns) {
  try {
    let currentRow = startRow;

    // Check if there are assignments
    if (!scheduleData.assignments || scheduleData.assignments.length === 0) {
      // No assignments message
      sheet.getRange(currentRow, 1, 1, 5).merge();
      sheet.getRange(currentRow, 1).setValue('No assignments found for this week. Please generate the schedule first.');
      sheet.getRange(currentRow, 1).setFontStyle('italic').setHorizontalAlignment('center');
      return currentRow;
    }

    // Separate weekend and weekday assignments
    const weekendAssignments = [];
    const weekdayAssignments = [];

    for (const assignment of scheduleData.assignments) {
      const dayOfWeek = assignment.date.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = (dayOfWeek === 0) || (dayOfWeek === 6 && assignment.isAnticipated);

      if (isWeekend) {
        weekendAssignments.push(assignment);
      } else {
        weekdayAssignments.push(assignment);
      }
    }

    Logger.log(`Total assignments: ${scheduleData.assignments.length}, Weekend: ${weekendAssignments.length}, Weekday: ${weekdayAssignments.length}`);

    // WEEKEND SECTION (Saturday vigil + Sunday masses)
    if (weekendAssignments.length > 0) {
      try {
        currentRow = createWeekendSection(sheet, weekendAssignments, scheduleData.liturgicalData, currentRow);
        currentRow += 2; // Add spacing after weekend section
      } catch (e) {
        Logger.log(`Error creating weekend section: ${e.message}. Retrying...`);
        Utilities.sleep(1000); // Wait 1 second
        currentRow = createWeekendSection(sheet, weekendAssignments, scheduleData.liturgicalData, currentRow);
        currentRow += 2;
      }
    }

    // WEEKDAY SECTION (Monday-Friday)
    if (weekdayAssignments.length > 0) {
      try {
        // Section header
        sheet.getRange(currentRow, 1).setValue('Weekday Masses');
        sheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold');
        currentRow += 2;

        currentRow = createWeekdayTableSection(sheet, weekdayAssignments, scheduleData.liturgicalData, currentRow);
      } catch (e) {
        Logger.log(`Error creating weekday section: ${e.message}. Retrying...`);
        Utilities.sleep(1000); // Wait 1 second

        // Section header
        sheet.getRange(currentRow, 1).setValue('Weekday Masses');
        sheet.getRange(currentRow, 1).setFontSize(12).setFontWeight('bold');
        currentRow += 2;

        currentRow = createWeekdayTableSection(sheet, weekdayAssignments, scheduleData.liturgicalData, currentRow);
      }
    }

    return currentRow;

  } catch (e) {
    Logger.log(`ERROR in createWeeklyScheduleContent: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    throw new Error(`Could not create weekly schedule content: ${e.message}`);
  }
}


/**
 * Create weekend section with grouped Saturday vigil + Sunday masses.
 *
 * @param {Sheet} sheet - Target sheet
 * @param {Array} weekendAssignments - Weekend assignments
 * @param {Map} liturgicalData - Liturgical celebration data
 * @param {number} startRow - Starting row number
 * @returns {number} Final row number
 */
function createWeekendSection(sheet, weekendAssignments, liturgicalData, startRow) {
  let currentRow = startRow;

  // Group assignments by Mass (date + time)
  const massesByDateTime = new Map();
  for (const assignment of weekendAssignments) {
    const massKey = `${assignment.date.getTime()}_${assignment.time}`;
    if (!massesByDateTime.has(massKey)) {
      massesByDateTime.set(massKey, {
        date: assignment.date,
        time: assignment.time,
        description: assignment.description,
        liturgicalCelebration: assignment.liturgicalCelebration,
        isAnticipated: assignment.isAnticipated,
        assignments: []
      });
    }
    massesByDateTime.get(massKey).assignments.push(assignment);
  }

  // Sort masses by date, then time
  const masses = Array.from(massesByDateTime.values()).sort((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) {
      return a.date.getTime() - b.date.getTime();
    }
    // Handle time comparison (can be Date object or string)
    if (a.time instanceof Date && b.time instanceof Date) {
      return a.time.getTime() - b.time.getTime();
    } else if (typeof a.time === 'string' && typeof b.time === 'string') {
      return a.time.localeCompare(b.time);
    }
    return 0; // Fallback if types don't match
  });

  // Get weekend date range and liturgical celebration
  const saturdayMass = masses.find(m => m.date.getDay() === 6);
  const sundayMass = masses.find(m => m.date.getDay() === 0);

  let weekendTitle = 'Weekend Masses';
  if (saturdayMass && sundayMass) {
    // Format: Weekend of M/D - M/D/YYYY - Celebration
    const satDate = HELPER_formatDate(saturdayMass.date, 'default');
    const sunDate = HELPER_formatDate(sundayMass.date, 'default');
    const celebration = sundayMass.liturgicalCelebration || saturdayMass.liturgicalCelebration;

    // Extract M/D from Saturday (remove year)
    const satDateParts = satDate.split('/');
    const satMonthDay = `${satDateParts[0]}/${satDateParts[1]}`;

    weekendTitle = `Weekend of ${satMonthDay} - ${sunDate} - ${celebration}`;
  } else if (sundayMass) {
    const celebration = sundayMass.liturgicalCelebration;
    weekendTitle = `${HELPER_formatDate(sundayMass.date, 'default')} - ${celebration}`;
  } else if (saturdayMass) {
    const celebration = saturdayMass.liturgicalCelebration;
    weekendTitle = `${HELPER_formatDate(saturdayMass.date, 'default')} - ${celebration}`;
  }

  // Weekend header
  sheet.getRange(currentRow, 1, 1, 5).merge();
  sheet.getRange(currentRow, 1).setValue(weekendTitle);
  sheet.getRange(currentRow, 1)
    .setFontSize(12)
    .setFontWeight('bold')
    .setBackground('#e8f0fe');
  currentRow++;

  // Add liturgical information line (rank, season, color)
  // Get liturgical info from the Sunday celebration (or Saturday vigil if no Sunday)
  const liturgicalCelebration = sundayMass ? sundayMass.liturgicalCelebration : (saturdayMass ? saturdayMass.liturgicalCelebration : null);
  if (liturgicalCelebration && liturgicalData && liturgicalData.has(liturgicalCelebration)) {
    const liturgyInfo = liturgicalData.get(liturgicalCelebration);
    const rankInfo = `${liturgyInfo.rank} • ${liturgyInfo.season} • ${liturgyInfo.color}`;

    sheet.getRange(currentRow, 1, 1, 5).merge();
    sheet.getRange(currentRow, 1).setValue(rankInfo);
    sheet.getRange(currentRow, 1)
      .setFontSize(10)
      .setFontStyle('italic')
      .setBackground('#e8f0fe');
    currentRow++;
  }

  currentRow++; // Blank line before Mass times

  // Write each Mass
  for (const mass of masses) {
    const dayName = mass.date.getDay() === 6 ? 'Saturday' : 'Sunday';
    const dateStr = HELPER_formatDate(mass.date, 'default');
    const timeStr = formatTimeDisplay(mass.time);
    const massType = mass.isAnticipated ? 'Vigil' : '';

    // Mass header (e.g., "Saturday January 4 - 5:00 PM Vigil")
    const massHeader = `${dayName} ${dateStr} - ${timeStr}${massType ? ' ' + massType : ''}`;
    sheet.getRange(currentRow, 1).setValue(massHeader);
    sheet.getRange(currentRow, 1).setFontWeight('bold');
    currentRow++;

    // Write assignments for this Mass (indented)
    for (const assignment of mass.assignments) {
      const volunteerName = assignment.assignedVolunteerName || assignment.volunteerName || 'UNASSIGNED';
      const assignmentText = `  ${assignment.role}: ${volunteerName}`;

      sheet.getRange(currentRow, 1).setValue(assignmentText);

      // Highlight unassigned
      if (volunteerName === 'UNASSIGNED') {
        sheet.getRange(currentRow, 1).setBackground('#fce8e6');
      }

      currentRow++;
    }

    currentRow++; // Blank line between masses
  }

  return currentRow;
}


/**
 * Create weekday table section (Monday-Friday).
 *
 * @param {Sheet} sheet - Target sheet
 * @param {Array} weekdayAssignments - Weekday assignments
 * @param {Map} liturgicalData - Liturgical celebration data
 * @param {number} startRow - Starting row number
 * @returns {number} Final row number
 */
function createWeekdayTableSection(sheet, weekdayAssignments, liturgicalData, startRow) {
  let currentRow = startRow;

  // Group assignments by liturgical celebration first
  const assignmentsByCelebration = new Map();
  for (const assignment of weekdayAssignments) {
    const celebration = assignment.liturgicalCelebration || 'Other';
    if (!assignmentsByCelebration.has(celebration)) {
      assignmentsByCelebration.set(celebration, []);
    }
    assignmentsByCelebration.get(celebration).push(assignment);
  }

  // Sort celebrations chronologically (by first assignment date)
  const sortedCelebrations = Array.from(assignmentsByCelebration.keys()).sort((a, b) => {
    const aFirstDate = assignmentsByCelebration.get(a)[0].date.getTime();
    const bFirstDate = assignmentsByCelebration.get(b)[0].date.getTime();
    return aFirstDate - bFirstDate;
  });

  // Process each liturgical celebration
  for (const celebration of sortedCelebrations) {
    const celebrationAssignments = assignmentsByCelebration.get(celebration);

    // Celebration header with liturgical information
    if (celebration && celebration !== 'Other') {
      sheet.getRange(currentRow, 1, 1, 5).merge();
      sheet.getRange(currentRow, 1).setValue(celebration);
      sheet.getRange(currentRow, 1)
        .setFontSize(11)
        .setFontWeight('bold')
        .setBackground('#f3f3f3');
      currentRow++;

      // Add liturgical information line (rank, season, color)
      if (liturgicalData && liturgicalData.has(celebration)) {
        const liturgyInfo = liturgicalData.get(celebration);
        const rankInfo = `${liturgyInfo.rank} • ${liturgyInfo.season} • ${liturgyInfo.color}`;

        sheet.getRange(currentRow, 1, 1, 5).merge();
        sheet.getRange(currentRow, 1).setValue(rankInfo);
        sheet.getRange(currentRow, 1)
          .setFontSize(9)
          .setFontStyle('italic')
          .setBackground('#f3f3f3');
        currentRow++;
      }

      currentRow++; // Blank line before table
    }

    // Table headers
    const headers = ['Date', 'Time', 'Mass', 'Role', 'Volunteer'];
    for (let col = 0; col < headers.length; col++) {
      sheet.getRange(currentRow, col + 1).setValue(headers[col]);
    }
    sheet.getRange(currentRow, 1, 1, 5)
      .setFontWeight('bold')
      .setBackground('#f0f0f0')
      .setHorizontalAlignment('center');
    currentRow++;

    // Group by Mass within this celebration
    const massesByDateTime = new Map();
    for (const assignment of celebrationAssignments) {
      const massKey = `${assignment.date.getTime()}_${assignment.time}`;
      if (!massesByDateTime.has(massKey)) {
        massesByDateTime.set(massKey, {
          date: assignment.date,
          time: assignment.time,
          description: assignment.description,
          assignments: []
        });
      }
      massesByDateTime.get(massKey).assignments.push(assignment);
    }

    // Sort masses by date, then time
    const masses = Array.from(massesByDateTime.values()).sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      // Handle time comparison (can be Date object or string)
      if (a.time instanceof Date && b.time instanceof Date) {
        return a.time.getTime() - b.time.getTime();
      } else if (typeof a.time === 'string' && typeof b.time === 'string') {
        return a.time.localeCompare(b.time);
      }
      return 0; // Fallback if types don't match
    });

    // Write table rows
    const tableStartRow = currentRow;
    for (const mass of masses) {
      const massAssignments = mass.assignments;

      for (let i = 0; i < massAssignments.length; i++) {
        const assignment = massAssignments[i];
        const volunteerName = assignment.assignedVolunteerName || assignment.volunteerName || 'UNASSIGNED';

        const rowData = [
          i === 0 ? HELPER_formatDate(mass.date, 'default') : '',
          i === 0 ? formatTimeDisplay(mass.time) : '',
          i === 0 ? mass.description : '',
          assignment.role,
          volunteerName
        ];

        for (let col = 0; col < rowData.length; col++) {
          sheet.getRange(currentRow, col + 1).setValue(rowData[col]);
        }

        // Highlight unassigned
        if (volunteerName === 'UNASSIGNED') {
          sheet.getRange(currentRow, 5).setBackground('#fce8e6');
        }

        currentRow++;
      }
    }

    // Apply borders to table
    const tableRange = sheet.getRange(tableStartRow - 1, 1, currentRow - tableStartRow + 1, 5);
    tableRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

    currentRow += 2; // Spacing between celebrations
  }

  return currentRow;
}


/**
 * Format time for display (handles both Date objects and string times).
 *
 * @param {Date|string} time - Time to format
 * @returns {string} Formatted time (e.g., "5:00 PM")
 */
function formatTimeDisplay(time) {
  if (time instanceof Date) {
    return Utilities.formatDate(time, Session.getScriptTimeZone(), 'h:mm a');
  }
  return time; // Already a string
}


/**
 * Apply email-friendly formatting to weekly schedule sheet.
 *
 * @param {Sheet} sheet - Target sheet
 * @param {number} numColumns - Number of columns
 */
function applyWeeklyScheduleFormatting(sheet, numColumns) {
  try {
    // Set column widths (optimized for email)
    sheet.setColumnWidth(1, 500); // Date/Content (wide for weekend list format)
    sheet.setColumnWidth(2, 80);  // Time
    sheet.setColumnWidth(3, 200); // Mass
    sheet.setColumnWidth(4, 150); // Role
    sheet.setColumnWidth(5, 150); // Volunteer

    // Set default font
    const dataRange = sheet.getDataRange();
    dataRange.setFontFamily('Arial').setFontSize(11);

    // Set text alignment
    sheet.getRange(5, 1, sheet.getLastRow() - 4, 1).setHorizontalAlignment('left'); // Date column
    sheet.getRange(5, 2, sheet.getLastRow() - 4, 1).setHorizontalAlignment('center'); // Time column
    sheet.getRange(5, 3, sheet.getLastRow() - 4, 1).setHorizontalAlignment('left'); // Mass column
    sheet.getRange(5, 4, sheet.getLastRow() - 4, 2).setHorizontalAlignment('left'); // Role and Volunteer columns

    Logger.log('Weekly schedule formatting applied');

  } catch (e) {
    Logger.log(`ERROR in applyWeeklyScheduleFormatting: ${e.message}`);
  }
}
