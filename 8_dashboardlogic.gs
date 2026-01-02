/**
 * ====================================================================
 * DASHBOARD ANALYTICS - HYBRID FORMULA/SCRIPT APPROACH
 * ====================================================================
 *
 * This module generates analytics dashboard with 3-layer architecture:
 *
 * 1. DATA LAYER (Columns A-M, hidden): Raw data written by Apps Script
 * 2. CALCULATION LAYER (Columns N-Z, hidden): Formulas do calculations
 * 3. PRESENTATION LAYER (Columns AA+, visible): Formatted display
 *
 * Key Features:
 * - Volunteer service frequency analysis
 * - Coverage percentage by mass and ministry
 * - Unassigned role tracking
 * - Timeoff pattern analysis
 * - Burnout risk indicators
 * - Month-over-month trend analysis
 * - Configurable thresholds via Config sheet
 * - Auto-refresh after assignment completion
 *
 * Created: 2026-01-02
 */

/**
 * Main entry point for dashboard generation
 * Orchestrates all analytics and writes to Dashboard sheet
 *
 * @param {string} monthString - Month to analyze (format: "YYYY-MM")
 * @param {Object} options - Optional settings
 * @param {boolean} options.silent - If true, suppress UI messages (for auto-refresh)
 * @returns {string} Success message or null if silent
 */
function DASHBOARD_generateAnalytics(monthString, options = {}) {
  const silent = options.silent || false;

  try {
    Logger.log(`Starting dashboard analytics generation for ${monthString}`);

    // Validate month string
    const { year, month } = HELPER_validateMonthString(monthString);

    // Check if calendar exists
    const calendarData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.CALENDAR);
    if (calendarData.length === 0) {
      throw new Error('No liturgical calendar found. Please generate calendar first.');
    }

    // Check if assignments exist
    const assignmentsData = HELPER_readSheetDataCached(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (assignmentsData.length === 0) {
      throw new Error('No assignments found. Please generate schedule first.');
    }

    // Aggregate all analytics data
    const analyticsData = {
      monthString: monthString,
      generated: new Date(),
      volunteerFrequency: DASHBOARD_analyzeVolunteerFrequency(monthString),
      coverageByMass: DASHBOARD_analyzeCoverageByMass(monthString),
      coverageByMinistry: DASHBOARD_analyzeCoverageByMinistry(monthString),
      unassignedRoles: DASHBOARD_analyzeUnassignedRoles(monthString),
      timeoffPatterns: DASHBOARD_analyzeTimeoffPatterns(monthString),
      burnoutRisk: DASHBOARD_calculateBurnoutRisk(monthString)
    };

    // Get trend data (if historical data exists)
    analyticsData.trends = DASHBOARD_getTrendData(monthString, 3); // 3 months lookback

    // Write to Dashboard sheet
    DASHBOARD_writeToSheet(analyticsData);

    // Store historical snapshot
    DASHBOARD_storeHistoricalSnapshot(monthString, analyticsData);

    const result = `Dashboard analytics generated for ${monthString}`;
    Logger.log(result);

    if (!silent) {
      return result;
    } else {
      return null; // Silent mode for auto-refresh
    }

  } catch (e) {
    Logger.log(`ERROR in DASHBOARD_generateAnalytics: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);

    if (!silent) {
      throw new Error(`Dashboard generation failed: ${e.message}`);
    } else {
      Logger.log(`Silent auto-refresh failed: ${e.message}`);
      return null;
    }
  }
}

/**
 * Read configurable thresholds from Config sheet
 * Returns object with all threshold values (with defaults if not set)
 *
 * @returns {Object} Threshold configuration
 */
function DASHBOARD_getThresholds() {
  const config = HELPER_readConfigSafe();

  return {
    underUtilized: parseFloat(config['Dashboard_UnderUtilized_Threshold'] || 50),
    overUtilized: parseFloat(config['Dashboard_OverUtilized_Threshold'] || 150),
    burnoutAssignments: parseFloat(config['Dashboard_Burnout_Assignments_Threshold'] || 150),
    burnoutSpacing: parseInt(config['Dashboard_Burnout_Spacing_Days'] || 7),
    coverageWarning: parseFloat(config['Dashboard_Coverage_Warning_Threshold'] || 80),
    coverageCritical: parseFloat(config['Dashboard_Coverage_Critical_Threshold'] || 50),
    timeoffHigh: parseInt(config['Dashboard_Timeoff_HighImpact_Threshold'] || 5),
    timeoffMedium: parseInt(config['Dashboard_Timeoff_MediumImpact_Threshold'] || 3)
  };
}

/**
 * Analyze volunteer service frequency for the month
 * Returns assignment counts, last service dates, and utilization stats
 *
 * @param {string} monthString - Month to analyze
 * @returns {Object} Volunteer frequency data
 */
function DASHBOARD_analyzeVolunteerFrequency(monthString) {
  Logger.log(`Analyzing volunteer frequency for ${monthString}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  const volunteersSheet = ss.getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);

  if (!assignmentsSheet || !volunteersSheet) {
    throw new Error('Required sheets not found');
  }

  // Read data
  const assignData = assignmentsSheet.getDataRange().getValues();
  const volData = volunteersSheet.getDataRange().getValues();

  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;
  const volCols = CONSTANTS.COLS.VOLUNTEERS;

  // Build volunteer map (Active volunteers only)
  const volunteerMap = new Map();

  for (let i = 1; i < volData.length; i++) {
    const volId = volData[i][volCols.VOLUNTEER_ID - 1];
    const status = String(volData[i][volCols.STATUS - 1] || '').toLowerCase();

    if (volId && status === 'active') {
      volunteerMap.set(volId, {
        id: volId,
        name: volData[i][volCols.FULL_NAME - 1],
        monthCount: 0,
        ytdCount: 0,
        lastDate: null
      });
    }
  }

  // Count assignments
  const { year } = HELPER_validateMonthString(monthString);
  const monthYearStr = monthString;

  for (let i = 1; i < assignData.length; i++) {
    const volId = assignData[i][assignCols.ASSIGNED_VOLUNTEER_ID - 1];
    const rowMonthYear = assignData[i][assignCols.MONTH_YEAR - 1];
    const date = assignData[i][assignCols.DATE - 1];

    if (!volId || !volunteerMap.has(volId)) continue;

    const vol = volunteerMap.get(volId);

    // Count for this month
    if (rowMonthYear === monthYearStr) {
      vol.monthCount++;

      // Track last service date
      const assignDate = new Date(date);
      if (!vol.lastDate || assignDate > vol.lastDate) {
        vol.lastDate = assignDate;
      }
    }

    // Count YTD (same year)
    const assignYear = new Date(date).getFullYear();
    if (assignYear === year) {
      vol.ytdCount++;
    }
  }

  // Convert to array and calculate stats
  const volunteers = Array.from(volunteerMap.values());
  const totalAssignments = volunteers.reduce((sum, v) => sum + v.monthCount, 0);
  const activeCount = volunteers.length;
  const average = activeCount > 0 ? totalAssignments / activeCount : 0;

  // Count utilization categories
  const thresholds = DASHBOARD_getThresholds();
  let underUtilizedCount = 0;
  let overUtilizedCount = 0;
  let balancedCount = 0;

  for (const vol of volunteers) {
    const percentage = average > 0 ? (vol.monthCount / average) * 100 : 0;
    if (percentage < thresholds.underUtilized) {
      underUtilizedCount++;
    } else if (percentage > thresholds.overUtilized) {
      overUtilizedCount++;
    } else {
      balancedCount++;
    }
  }

  Logger.log(`Analyzed ${volunteers.length} active volunteers, ${totalAssignments} total assignments`);

  return {
    volunteers: volunteers,
    totalAssignments: totalAssignments,
    activeCount: activeCount,
    average: average,
    underUtilizedCount: underUtilizedCount,
    overUtilizedCount: overUtilizedCount,
    balancedCount: balancedCount
  };
}

/**
 * Analyze coverage percentage by mass (Event ID)
 *
 * @param {string} monthString - Month to analyze
 * @returns {Object} Coverage by mass data
 */
function DASHBOARD_analyzeCoverageByMass(monthString) {
  Logger.log(`Analyzing coverage by mass for ${monthString}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  const assignData = assignmentsSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Build mass coverage map
  const massMap = new Map();

  for (let i = 1; i < assignData.length; i++) {
    const rowMonthYear = assignData[i][assignCols.MONTH_YEAR - 1];
    if (rowMonthYear !== monthString) continue;

    const eventId = assignData[i][assignCols.EVENT_ID - 1];
    const description = assignData[i][assignCols.DESCRIPTION - 1];
    const status = assignData[i][assignCols.STATUS - 1];

    if (!eventId) continue;

    if (!massMap.has(eventId)) {
      massMap.set(eventId, {
        eventId: eventId,
        description: description,
        totalRoles: 0,
        assignedRoles: 0
      });
    }

    const mass = massMap.get(eventId);
    mass.totalRoles++;

    if (status === 'Assigned') {
      mass.assignedRoles++;
    }
  }

  // Convert to array and calculate percentages
  const masses = Array.from(massMap.values());

  let totalRoles = 0;
  let totalAssigned = 0;

  for (const mass of masses) {
    totalRoles += mass.totalRoles;
    totalAssigned += mass.assignedRoles;
  }

  const overallPercentage = totalRoles > 0 ? (totalAssigned / totalRoles) * 100 : 0;

  Logger.log(`Analyzed ${masses.length} masses, overall coverage: ${overallPercentage.toFixed(1)}%`);

  return {
    masses: masses,
    totalRoles: totalRoles,
    totalAssigned: totalAssigned,
    overallPercentage: overallPercentage
  };
}

/**
 * Analyze coverage percentage by ministry
 *
 * @param {string} monthString - Month to analyze
 * @returns {Object} Coverage by ministry data
 */
function DASHBOARD_analyzeCoverageByMinistry(monthString) {
  Logger.log(`Analyzing coverage by ministry for ${monthString}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  const assignData = assignmentsSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Build ministry coverage map
  const ministryMap = new Map();

  for (let i = 1; i < assignData.length; i++) {
    const rowMonthYear = assignData[i][assignCols.MONTH_YEAR - 1];
    if (rowMonthYear !== monthString) continue;

    const ministry = assignData[i][assignCols.MINISTRY - 1];
    const status = assignData[i][assignCols.STATUS - 1];

    if (!ministry) continue;

    if (!ministryMap.has(ministry)) {
      ministryMap.set(ministry, {
        ministry: ministry,
        totalRoles: 0,
        assignedRoles: 0
      });
    }

    const min = ministryMap.get(ministry);
    min.totalRoles++;

    if (status === 'Assigned') {
      min.assignedRoles++;
    }
  }

  // Convert to array
  const ministries = Array.from(ministryMap.values());

  Logger.log(`Analyzed ${ministries.length} ministries`);

  return {
    ministries: ministries
  };
}

/**
 * Analyze unassigned roles
 *
 * @param {string} monthString - Month to analyze
 * @returns {Object} Unassigned roles data
 */
function DASHBOARD_analyzeUnassignedRoles(monthString) {
  Logger.log(`Analyzing unassigned roles for ${monthString}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

  const assignData = assignmentsSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  let totalUnassigned = 0;
  const byMinistry = new Map();
  const byWeek = new Map();

  const { year, month } = HELPER_validateMonthString(monthString);

  for (let i = 1; i < assignData.length; i++) {
    const rowMonthYear = assignData[i][assignCols.MONTH_YEAR - 1];
    if (rowMonthYear !== monthString) continue;

    const status = assignData[i][assignCols.STATUS - 1];
    if (status !== 'Unassigned') continue;

    totalUnassigned++;

    // Count by ministry
    const ministry = assignData[i][assignCols.MINISTRY - 1];
    if (ministry) {
      byMinistry.set(ministry, (byMinistry.get(ministry) || 0) + 1);
    }

    // Count by week
    const date = new Date(assignData[i][assignCols.DATE - 1]);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = HELPER_formatDate(weekStart, 'default');

    byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + 1);
  }

  Logger.log(`Found ${totalUnassigned} unassigned roles`);

  return {
    totalCount: totalUnassigned,
    byMinistry: Array.from(byMinistry.entries()).map(([k, v]) => ({ ministry: k, count: v })),
    byWeek: Array.from(byWeek.entries()).map(([k, v]) => ({ week: k, count: v }))
  };
}

/**
 * Analyze timeoff patterns
 *
 * @param {string} monthString - Month to analyze
 * @returns {Object} Timeoff pattern data
 */
function DASHBOARD_analyzeTimeoffPatterns(monthString) {
  Logger.log(`Analyzing timeoff patterns for ${monthString}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);

  if (!timeoffsSheet) {
    Logger.log('Timeoffs sheet not found, skipping timeoff analysis');
    return {
      dates: [],
      totalRequests: 0,
      highImpactCount: 0,
      mediumImpactCount: 0
    };
  }

  const timeoffData = timeoffsSheet.getDataRange().getValues();
  const timeoffCols = CONSTANTS.COLS.TIMEOFFS;

  const { year, month } = HELPER_validateMonthString(monthString);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Build date map: date => { volunteers: Set, masses: Set }
  const dateMap = new Map();

  for (let i = 1; i < timeoffData.length; i++) {
    const status = timeoffData[i][timeoffCols.STATUS - 1];
    if (status !== 'Approved') continue;

    const volunteerName = timeoffData[i][timeoffCols.VOLUNTEER_NAME - 1];
    const selectedDates = timeoffData[i][timeoffCols.SELECTED_DATES - 1];

    // Parse dates from Selected Dates column
    const dates = HELPER_parseDateBasedNotes(selectedDates);

    for (const dateInfo of dates) {
      if (dateInfo.date >= monthStart && dateInfo.date <= monthEnd) {
        const dateKey = dateInfo.dateString;

        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: dateInfo.date,
            dateString: dateKey,
            volunteers: new Set(),
            masses: new Set()
          });
        }

        dateMap.get(dateKey).volunteers.add(volunteerName);
      }
    }
  }

  // Convert to array and calculate impact levels
  const thresholds = DASHBOARD_getThresholds();
  const dates = Array.from(dateMap.values()).map(d => ({
    date: d.date,
    dateString: d.dateString,
    volunteerCount: d.volunteers.size,
    massCount: d.masses.size // Will be populated by formula in sheet
  }));

  // Sort by volunteer count (descending)
  dates.sort((a, b) => b.volunteerCount - a.volunteerCount);

  // Count impact levels
  let highImpactCount = 0;
  let mediumImpactCount = 0;

  for (const d of dates) {
    if (d.volunteerCount >= thresholds.timeoffHigh) {
      highImpactCount++;
    } else if (d.volunteerCount >= thresholds.timeoffMedium) {
      mediumImpactCount++;
    }
  }

  Logger.log(`Analyzed ${dates.length} dates with timeoffs`);

  return {
    dates: dates,
    totalRequests: dates.length,
    highImpactCount: highImpactCount,
    mediumImpactCount: mediumImpactCount
  };
}

/**
 * Calculate burnout risk for volunteers
 *
 * @param {string} monthString - Month to analyze
 * @returns {Object} Burnout risk data
 */
function DASHBOARD_calculateBurnoutRisk(monthString) {
  Logger.log(`Calculating burnout risk for ${monthString}`);

  // Get volunteer frequency data (already calculated)
  const volunteerFreq = DASHBOARD_analyzeVolunteerFrequency(monthString);
  const thresholds = DASHBOARD_getThresholds();

  const atRisk = [];
  let highRiskCount = 0;
  let mediumRiskCount = 0;

  const today = new Date();

  for (const vol of volunteerFreq.volunteers) {
    const percentage = volunteerFreq.average > 0 ? (vol.monthCount / volunteerFreq.average) * 100 : 0;
    const isOverworked = percentage > thresholds.burnoutAssignments;

    let daysSince = null;
    if (vol.lastDate) {
      daysSince = Math.floor((today - vol.lastDate) / (1000 * 60 * 60 * 24));
    }

    const isFrequent = daysSince !== null && daysSince < thresholds.burnoutSpacing;

    let riskLevel = 'Low';
    if (isOverworked && isFrequent) {
      riskLevel = 'High';
      highRiskCount++;
    } else if (isOverworked || isFrequent) {
      riskLevel = 'Medium';
      mediumRiskCount++;
    }

    if (riskLevel !== 'Low') {
      atRisk.push({
        volunteerId: vol.id,
        name: vol.name,
        monthCount: vol.monthCount,
        daysSince: daysSince,
        riskLevel: riskLevel
      });
    }
  }

  // Sort by risk level (High first) then by assignment count
  atRisk.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) {
      return a.riskLevel === 'High' ? -1 : 1;
    }
    return b.monthCount - a.monthCount;
  });

  Logger.log(`Found ${atRisk.length} volunteers at risk (${highRiskCount} high, ${mediumRiskCount} medium)`);

  return {
    volunteers: atRisk,
    highRiskCount: highRiskCount,
    mediumRiskCount: mediumRiskCount
  };
}

/**
 * Get trend data from DashboardHistory sheet
 *
 * @param {string} monthString - Current month
 * @param {number} lookbackMonths - How many months back to analyze (default 3)
 * @returns {Array|null} Array of historical data or null if not available
 */
function DASHBOARD_getTrendData(monthString, lookbackMonths = 3) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let historySheet = ss.getSheetByName('DashboardHistory');

  if (!historySheet) {
    Logger.log('DashboardHistory sheet not found, no trend data available');
    return null;
  }

  const data = historySheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('No historical data available yet');
    return null;
  }

  const { year, month } = HELPER_validateMonthString(monthString);
  const trends = [];

  // Find data for current month and previous months
  for (let i = 0; i < lookbackMonths; i++) {
    const targetDate = new Date(year, month - i, 1);
    const targetMonthString = HELPER_formatDate(targetDate, 'month-year');

    for (let j = 1; j < data.length; j++) {
      if (data[j][0] === targetMonthString) {
        trends.push({
          monthYear: data[j][0],
          activeVolunteers: data[j][2],
          totalAssignments: data[j][3],
          avgAssignments: data[j][4],
          coverage: data[j][8],
          unassigned: data[j][9],
          burnoutHigh: data[j][10]
        });
        break;
      }
    }
  }

  return trends.length > 0 ? trends : null;
}

/**
 * Store monthly dashboard snapshot to DashboardHistory sheet
 *
 * @param {string} monthString - Month identifier
 * @param {Object} analyticsData - Complete analytics data object
 */
function DASHBOARD_storeHistoricalSnapshot(monthString, analyticsData) {
  Logger.log(`Storing historical snapshot for ${monthString}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let historySheet = ss.getSheetByName('DashboardHistory');

  // Create sheet if it doesn't exist
  if (!historySheet) {
    historySheet = ss.insertSheet('DashboardHistory');

    // Add headers
    const headers = [
      'Month-Year', 'Generated Date', 'Active Volunteers', 'Total Assignments',
      'Avg Assignments/Volunteer', 'Under-Utilized Count', 'Over-Utilized Count',
      'Balanced Count', 'Coverage % (Overall)', 'Unassigned Roles',
      'High Burnout Count', 'Medium Burnout Count', 'Timeoff Requests',
      'High Impact Dates', 'Medium Impact Dates', 'Notes'
    ];

    historySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    historySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    historySheet.setFrozenRows(1);

    Logger.log('Created DashboardHistory sheet');
  }

  // Check if snapshot for this month already exists
  const data = historySheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === monthString) {
      rowIndex = i + 1; // Found existing row (1-based)
      break;
    }
  }

  // Build snapshot row
  const snapshot = [
    monthString,
    new Date(),
    analyticsData.volunteerFrequency.activeCount,
    analyticsData.volunteerFrequency.totalAssignments,
    analyticsData.volunteerFrequency.average,
    analyticsData.volunteerFrequency.underUtilizedCount,
    analyticsData.volunteerFrequency.overUtilizedCount,
    analyticsData.volunteerFrequency.balancedCount,
    analyticsData.coverageByMass.overallPercentage,
    analyticsData.unassignedRoles.totalCount,
    analyticsData.burnoutRisk.highRiskCount,
    analyticsData.burnoutRisk.mediumRiskCount,
    analyticsData.timeoffPatterns.totalRequests,
    analyticsData.timeoffPatterns.highImpactCount,
    analyticsData.timeoffPatterns.mediumImpactCount,
    '' // Notes (admin can add manually)
  ];

  // Update or append
  if (rowIndex > 0) {
    historySheet.getRange(rowIndex, 1, 1, snapshot.length).setValues([snapshot]);
    Logger.log(`Updated existing snapshot at row ${rowIndex}`);
  } else {
    historySheet.appendRow(snapshot);
    Logger.log('Appended new snapshot');
  }

  // Clean up old data (keep rolling 12 months)
  const { year, month } = HELPER_validateMonthString(monthString);
  const cutoffDate = new Date(year, month - 12, 1);
  const cutoffString = HELPER_formatDate(cutoffDate, 'month-year');

  const allData = historySheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let i = 1; i < allData.length; i++) {
    const rowMonthString = allData[i][0];
    if (rowMonthString < cutoffString) {
      rowsToDelete.push(i + 1); // 1-based row index
    }
  }

  // Delete old rows (in reverse order to maintain indices)
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    historySheet.deleteRow(rowsToDelete[i]);
    Logger.log(`Deleted historical data for month before ${cutoffString}`);
  }
}

/**
 * Write dashboard to sheet with 3-layer architecture
 * DATA LAYER (A-M hidden) + CALCULATION LAYER (N-Z hidden) + PRESENTATION LAYER (AA+ visible)
 *
 * @param {Object} analyticsData - Complete analytics data
 */
function DASHBOARD_writeToSheet(analyticsData) {
  Logger.log('Writing dashboard to sheet...');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashboardSheet = ss.getSheetByName(CONSTANTS.SHEETS.DASHBOARD);

  // Create sheet if it doesn't exist
  if (!dashboardSheet) {
    dashboardSheet = ss.insertSheet(CONSTANTS.SHEETS.DASHBOARD);
    Logger.log('Created Dashboard sheet');
  } else {
    // Clear existing content
    dashboardSheet.clear();
    Logger.log('Cleared existing Dashboard sheet');
  }

  // STEP 1: Write DATA LAYER (Columns A-M, hidden)
  DASHBOARD_writeDataLayer(dashboardSheet, analyticsData);

  // STEP 2: Write CALCULATION LAYER formulas (Columns N-Z, hidden) - ONE TIME SETUP
  DASHBOARD_writeCalculationFormulas(dashboardSheet, analyticsData);

  // STEP 3: Write PRESENTATION LAYER formulas (Columns AA+, visible) - ONE TIME SETUP
  DASHBOARD_writePresentationLayer(dashboardSheet, analyticsData);

  // STEP 4: Apply conditional formatting
  DASHBOARD_applyConditionalFormatting(dashboardSheet);

  // STEP 5: Hide data and calculation layers
  dashboardSheet.hideColumns(1, 26); // Hide A-Z

  // STEP 6: Format and protect
  dashboardSheet.setFrozenRows(5); // Freeze header section
  dashboardSheet.autoResizeColumns(27, 10); // Auto-resize presentation columns (AA-AJ)

  Logger.log('Dashboard sheet written successfully');
}

/**
 * Write DATA LAYER to columns A-M
 * Apps Script writes raw data here, formulas read from it
 *
 * @param {Sheet} sheet - Dashboard sheet
 * @param {Object} data - Analytics data
 */
function DASHBOARD_writeDataLayer(sheet, data) {
  Logger.log('Writing data layer...');

  // Row 1-2: Metadata
  sheet.getRange('B1').setValue(data.monthString);
  sheet.getRange('C1').setValue(data.generated);
  sheet.getRange('D1').setValue(true); // Auto-refresh enabled flag

  // Rows 5+: Volunteer frequency data (Columns A-F)
  const volRows = [['Vol ID', 'Vol Name', 'Month', 'YTD', 'Last Date', 'Reserved']];

  for (const vol of data.volunteerFrequency.volunteers) {
    volRows.push([
      vol.id,
      vol.name,
      vol.monthCount,
      vol.ytdCount,
      vol.lastDate || '',
      '' // Reserved column
    ]);
  }

  if (volRows.length > 1) {
    sheet.getRange(5, 1, volRows.length, 6).setValues(volRows);
  }

  // Coverage by mass data (Columns G-J)
  const massRows = [['Event ID', 'Mass Desc', 'Total', 'Assigned']];

  for (const mass of data.coverageByMass.masses) {
    massRows.push([
      mass.eventId,
      mass.description,
      mass.totalRoles,
      mass.assignedRoles
    ]);
  }

  if (massRows.length > 1) {
    sheet.getRange(5, 7, massRows.length, 4).setValues(massRows);
  }

  // Timeoff pattern data (Columns K-M)
  const timeoffRows = [['Timeoff Date', 'Vols', 'Masses']];

  for (const date of data.timeoffPatterns.dates) {
    timeoffRows.push([
      date.date,
      date.volunteerCount,
      '' // Mass count will be calculated by formula
    ]);
  }

  if (timeoffRows.length > 1) {
    sheet.getRange(5, 11, timeoffRows.length, 3).setValues(timeoffRows);
  }

  Logger.log(`Data layer written: ${volRows.length-1} volunteers, ${massRows.length-1} masses, ${timeoffRows.length-1} timeoff dates`);
}

/**
 * Write CALCULATION LAYER formulas (Columns N-Z, hidden)
 * These formulas do the math based on data layer
 *
 * @param {Sheet} sheet - Dashboard sheet
 * @param {Object} data - Analytics data (for row counts)
 */
function DASHBOARD_writeCalculationFormulas(sheet, data) {
  Logger.log('Writing calculation formulas...');

  const volCount = data.volunteerFrequency.volunteers.length;

  if (volCount === 0) {
    Logger.log('No volunteers, skipping calculation formulas');
    return;
  }

  // Column N: Days Since Last Assignment
  // Formula: =IF(E6="","",TODAY()-E6)
  const daysSinceFormulas = [];
  for (let i = 0; i < volCount; i++) {
    const row = 6 + i;
    daysSinceFormulas.push([`=IF(E${row}="","",TODAY()-E${row})`]);
  }
  if (daysSinceFormulas.length > 0) {
    sheet.getRange(6, 14, daysSinceFormulas.length, 1).setFormulas(daysSinceFormulas); // Column N
  }

  // Column O: Utilization %
  // Formula: =IF(C6="","",TEXT(C6/AVERAGE($C$6:$C$), "0%"))
  const utilizationFormulas = [];
  for (let i = 0; i < volCount; i++) {
    const row = 6 + i;
    utilizationFormulas.push([`=IF(C${row}="","",TEXT(C${row}/AVERAGE($C$6:$C$${5+volCount}),"0%"))`]);
  }
  if (utilizationFormulas.length > 0) {
    sheet.getRange(6, 15, utilizationFormulas.length, 1).setFormulas(utilizationFormulas); // Column O
  }

  // Column P: Status Classification
  // Formula: =IF(C6="","",IF((C6/AVERAGE($C$6:$C$))<(Config!$B$10/100),"Under-utilized",IF((C6/AVERAGE($C$6:$C$))>(Config!$B$11/100),"Over-utilized","Balanced")))
  const statusFormulas = [];
  for (let i = 0; i < volCount; i++) {
    const row = 6 + i;
    const avgRange = `$C$6:$C$${5+volCount}`;
    statusFormulas.push([
      `=IF(C${row}="","",IF((C${row}/AVERAGE(${avgRange}))<(0.5),"Under-utilized",IF((C${row}/AVERAGE(${avgRange}))>(1.5),"Over-utilized","Balanced")))`
    ]);
  }
  if (statusFormulas.length > 0) {
    sheet.getRange(6, 16, statusFormulas.length, 1).setFormulas(statusFormulas); // Column P
  }

  Logger.log('Calculation formulas written');
}

/**
 * Write PRESENTATION LAYER (Columns AA+, visible)
 * This is what users see
 *
 * @param {Sheet} sheet - Dashboard sheet
 * @param {Object} data - Analytics data
 */
function DASHBOARD_writePresentationLayer(sheet, data) {
  Logger.log('Writing presentation layer...');

  const monthDisplay = HELPER_formatDate(new Date(data.monthString + '-01'), 'long');

  // === HEADER SECTION (Rows 1-4) ===
  sheet.getRange('AA1').setValue('PARISH SCHEDULER - DASHBOARD ANALYTICS');
  sheet.getRange('AA1').setFontSize(14).setFontWeight('bold');

  sheet.getRange('AA2').setFormula(`="Month: " & TEXT(B1,"MMMM YYYY") & "     Generated: " & TEXT(C1,"M/D/YYYY h:mm AM/PM")`);
  sheet.getRange('AA3').setFormula(`="Last Refreshed: " & TEXT(NOW(),"M/D/YYYY h:mm AM/PM") & "     Auto-refresh: " & IF(D1=TRUE,"✓ Enabled","○ Disabled")`);

  // === SECTION 1: VOLUNTEER FREQUENCY (Row 6+) ===
  sheet.getRange('AA6').setValue('📊 VOLUNTEER SERVICE FREQUENCY');
  sheet.getRange('AA6').setFontSize(12).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');

  // Headers (Row 7)
  const volHeaders = ['Volunteer Name', 'This Month', 'YTD', 'Last Served', 'Days Since', 'Utilization %', 'Status'];
  sheet.getRange(7, 27, 1, volHeaders.length).setValues([volHeaders]);
  sheet.getRange(7, 27, 1, volHeaders.length).setFontWeight('bold').setBackground('#E8F0FE');

  // Data formulas (Row 8+)
  const volCount = data.volunteerFrequency.volunteers.length;
  if (volCount > 0) {
    for (let i = 0; i < volCount; i++) {
      const row = 8 + i;
      const dataRow = 6 + i;

      sheet.getRange(row, 27).setFormula(`=B${dataRow}`); // AA: Name
      sheet.getRange(row, 28).setFormula(`=C${dataRow}`); // AB: This Month
      sheet.getRange(row, 29).setFormula(`=D${dataRow}`); // AC: YTD
      sheet.getRange(row, 30).setFormula(`=TEXT(E${dataRow},"M/D/YYYY")`); // AD: Last Served
      sheet.getRange(row, 31).setFormula(`=N${dataRow}`); // AE: Days Since
      sheet.getRange(row, 32).setFormula(`=O${dataRow}`); // AF: Utilization %
      sheet.getRange(row, 33).setFormula(`=P${dataRow} & " " & IF(P${dataRow}="Over-utilized","⚠️",IF(P${dataRow}="Under-utilized","💡","✓"))`); // AG: Status
    }
  }

  // Summary row
  const summaryRow = 8 + volCount + 1;
  sheet.getRange(summaryRow, 27).setValue('SUMMARY').setFontWeight('bold');
  sheet.getRange(summaryRow, 28).setFormula(`=SUM(AB8:AB${7+volCount})`); // Total this month
  sheet.getRange(summaryRow, 29).setFormula(`=SUM(AC8:AC${7+volCount})`); // Total YTD
  sheet.getRange(summaryRow, 33).setFormula(`=COUNTIF(AG8:AG${7+volCount},"*Under*") & " Under, " & COUNTIF(AG8:AG${7+volCount},"*Over*") & " Over"`);

  // === SECTION 2: COVERAGE BY MASS (starts after volunteer section + 2 blank rows) ===
  const massStartRow = summaryRow + 3;
  sheet.getRange(massStartRow, 27).setValue('📅 COVERAGE BY MASS');
  sheet.getRange(massStartRow, 27).setFontSize(12).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');

  // Headers
  const massHeaders = ['Event ID', 'Mass Description', 'Total Roles', 'Assigned', 'Coverage %', 'Status'];
  sheet.getRange(massStartRow + 1, 27, 1, massHeaders.length).setValues([massHeaders]);
  sheet.getRange(massStartRow + 1, 27, 1, massHeaders.length).setFontWeight('bold').setBackground('#E8F0FE');

  // Data (simplified - pulls from data layer)
  const massCount = data.coverageByMass.masses.length;
  if (massCount > 0) {
    for (let i = 0; i < massCount; i++) {
      const row = massStartRow + 2 + i;
      const dataRow = 6 + i;

      sheet.getRange(row, 27).setFormula(`=G${dataRow}`); // Event ID
      sheet.getRange(row, 28).setFormula(`=H${dataRow}`); // Description
      sheet.getRange(row, 29).setFormula(`=I${dataRow}`); // Total
      sheet.getRange(row, 30).setFormula(`=J${dataRow}`); // Assigned
      sheet.getRange(row, 31).setFormula(`=TEXT(J${dataRow}/I${dataRow},"0%")`); // Coverage %
      sheet.getRange(row, 32).setFormula(`=IF((J${dataRow}/I${dataRow})>=0.8,"Good ✓",IF((J${dataRow}/I${dataRow})>=0.5,"Warning ⚠️","Critical 🚨"))`); // Status
    }
  }

  // === SECTION 3: UNASSIGNED ROLES SUMMARY ===
  const unassignedStartRow = massStartRow + massCount + 4;
  sheet.getRange(unassignedStartRow, 27).setValue('⚠️ UNASSIGNED ROLES');
  sheet.getRange(unassignedStartRow, 27).setFontSize(12).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');

  sheet.getRange(unassignedStartRow + 1, 27).setValue('Total Unassigned Roles:').setFontWeight('bold');
  sheet.getRange(unassignedStartRow + 1, 28).setValue(data.unassignedRoles.totalCount).setFontWeight('bold').setFontSize(14);

  // By Ministry
  let unassignedRow = unassignedStartRow + 3;
  sheet.getRange(unassignedRow, 27).setValue('BY MINISTRY').setFontWeight('bold');
  unassignedRow++;

  for (const item of data.unassignedRoles.byMinistry) {
    sheet.getRange(unassignedRow, 27).setValue(item.ministry);
    sheet.getRange(unassignedRow, 28).setValue(item.count);
    unassignedRow++;
  }

  // By Week
  unassignedRow += 2;
  sheet.getRange(unassignedRow, 27).setValue('BY WEEK').setFontWeight('bold');
  unassignedRow++;

  for (const item of data.unassignedRoles.byWeek) {
    sheet.getRange(unassignedRow, 27).setValue(`Week of ${item.week}`);
    sheet.getRange(unassignedRow, 28).setValue(item.count);
    unassignedRow++;
  }

  Logger.log('Presentation layer written');
}

/**
 * Apply conditional formatting to presentation layer
 *
 * @param {Sheet} sheet - Dashboard sheet
 */
function DASHBOARD_applyConditionalFormatting(sheet) {
  Logger.log('Applying conditional formatting...');

  // Rule 1: Utilization Status (Column AG) - Green/Yellow/Red
  const volCount = 50; // Max expected volunteers (will apply to more rows than needed, which is fine)

  // Green for "Balanced"
  const balancedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Balanced')
    .setBackground('#D4EDDA')
    .setRanges([sheet.getRange(8, 33, volCount, 1)]) // Column AG, rows 8+
    .build();

  // Yellow for "Under-utilized"
  const underRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Under-utilized')
    .setBackground('#FFF3CD')
    .setRanges([sheet.getRange(8, 33, volCount, 1)])
    .build();

  // Red for "Over-utilized"
  const overRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Over-utilized')
    .setBackground('#F8D7DA')
    .setRanges([sheet.getRange(8, 33, volCount, 1)])
    .build();

  // Rule 2: Coverage Status (Column AF/32) - starting around row 30+
  const coverageGoodRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Good')
    .setBackground('#D4EDDA')
    .setRanges([sheet.getRange(30, 32, 30, 1)]) // Approximate range for mass coverage
    .build();

  const coverageWarningRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Warning')
    .setBackground('#FFF3CD')
    .setRanges([sheet.getRange(30, 32, 30, 1)])
    .build();

  const coverageCriticalRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Critical')
    .setBackground('#F8D7DA')
    .setRanges([sheet.getRange(30, 32, 30, 1)])
    .build();

  // Apply all rules
  const rules = [balancedRule, underRule, overRule, coverageGoodRule, coverageWarningRule, coverageCriticalRule];
  sheet.setConditionalFormatRules(rules);

  Logger.log('Conditional formatting applied');
}

/**
 * Show dashboard dialog from menu
 * Prompts user for month selection, then generates dashboard
 */
function DASHBOARD_showDashboardDialog() {
  const ui = SpreadsheetApp.getUi();

  try {
    // Get available months
    const months = getMonthsForSidebar();

    if (months.length === 0) {
      HELPER_showError(
        'No Calendar Data',
        new Error('Please generate liturgical calendar first.'),
        'calendar'
      );
      return;
    }

    // Create month options for dropdown
    const monthOptions = months.map(m => m.display);

    // Show prompt
    const result = ui.prompt(
      'Generate Dashboard Analytics',
      `Select month (enter number 1-${months.length}):\n\n` + monthOptions.map((m, i) => `${i+1}. ${m}`).join('\n'),
      ui.ButtonSet.OK_CANCEL
    );

    if (result.getSelectedButton() === ui.Button.OK) {
      const selectedIndex = parseInt(result.getResponseText()) - 1;

      if (selectedIndex >= 0 && selectedIndex < months.length) {
        const monthString = months[selectedIndex].value;

        HELPER_showAlert(
          'Generating Dashboard',
          `Generating analytics for ${months[selectedIndex].display}...\n\nThis may take 10-30 seconds.`,
          'info'
        );

        const message = DASHBOARD_generateAnalytics(monthString);

        HELPER_showSuccess('Dashboard Generated', message);

        // Open Dashboard sheet
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const dashboardSheet = ss.getSheetByName(CONSTANTS.SHEETS.DASHBOARD);
        if (dashboardSheet) {
          ss.setActiveSheet(dashboardSheet);
        }
      } else {
        HELPER_showError('Invalid Selection', new Error('Please enter a valid number.'), 'dashboard');
      }
    }
  } catch (e) {
    HELPER_showError('Dashboard Error', e, 'dashboard');
  }
}
