/**
 * ====================================================================
 * ARCHIVE LOGIC - EXTERNAL FILE ARCHIVING SYSTEM
 * ====================================================================
 * Creates separate Google Sheets files for year-end archives
 * Keeps main spreadsheet lean and focused on current year
 */

/**
 * Main archive function - creates external archive file for a year
 * @param {number} year - Year to archive (e.g., 2024)
 * @returns {object} Result with success status, file URL, and metadata
 */
function ARCHIVE_createArchiveFile(year) {
  try {
    Logger.log(`Starting archive process for year ${year}`);

    // Validation
    const validation = ARCHIVE_validatePreArchive(year);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // Get parish name for file naming
    const config = HELPER_readConfigSafe();
    const parishName = config["Parish Name"] || "Parish";
    const archiveFileName = `${parishName} - ${year} Archive`;

    // Check if archive already exists
    const existingArchive = ARCHIVE_findExistingArchive(archiveFileName);
    if (existingArchive) {
      throw new Error(`Archive already exists: ${archiveFileName}. If you want to recreate it, delete the existing archive file first.`);
    }

    // Create new spreadsheet
    Logger.log(`Creating new archive file: ${archiveFileName}`);
    const archiveSpreadsheet = SpreadsheetApp.create(archiveFileName);
    const archiveId = archiveSpreadsheet.getId();

    // Copy sheets to archive
    const copiedSheets = ARCHIVE_copyDataToArchive(archiveSpreadsheet, year);

    // Add metadata sheet
    ARCHIVE_createMetadataSheet(archiveSpreadsheet, year, copiedSheets);

    // Delete the default "Sheet1" that comes with new spreadsheets
    const defaultSheet = archiveSpreadsheet.getSheetByName("Sheet1");
    if (defaultSheet) {
      archiveSpreadsheet.deleteSheet(defaultSheet);
    }

    // Move archive file to same folder as current spreadsheet (optional)
    const archiveFile = DriveApp.getFileById(archiveId);
    const currentFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
    const parentFolders = currentFile.getParents();

    if (parentFolders.hasNext()) {
      const parentFolder = parentFolders.next();
      archiveFile.moveTo(parentFolder);
      Logger.log(`Moved archive to folder: ${parentFolder.getName()}`);
    }

    // Get file URL
    const archiveUrl = archiveSpreadsheet.getUrl();

    Logger.log(`✅ Archive created successfully: ${archiveFileName}`);
    Logger.log(`Archive URL: ${archiveUrl}`);

    return {
      success: true,
      fileName: archiveFileName,
      fileId: archiveId,
      url: archiveUrl,
      year: year,
      sheets: copiedSheets,
      message: `Archive created: ${archiveFileName}`
    };

  } catch (e) {
    Logger.log(`❌ ERROR creating archive: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    return {
      success: false,
      message: `Failed to create archive: ${e.message}`
    };
  }
}

/**
 * Validates data before archiving
 * @param {number} year - Year to validate
 * @returns {object} Validation result with valid flag and message
 */
function ARCHIVE_validatePreArchive(year) {
  const errors = [];
  const warnings = [];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check if required sheets exist
    const requiredSheets = CONSTANTS.ARCHIVE.SHEETS_TO_ARCHIVE;
    for (const sheetName of requiredSheets) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        errors.push(`Required sheet '${sheetName}' not found`);
      } else {
        // Check if sheet has data
        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) {
          warnings.push(`Sheet '${sheetName}' appears empty (only header row)`);
        }
      }
    }

    // Validate year is reasonable
    if (year < 2000 || year > 2100) {
      errors.push(`Invalid year: ${year}. Must be between 2000-2100.`);
    }

    // Check if Assignments sheet has data for this year
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (assignmentsSheet) {
      const data = assignmentsSheet.getDataRange().getValues();
      const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

      let countForYear = 0;
      for (let i = 1; i < data.length; i++) {
        const monthYear = data[i][assignCols.MONTH_YEAR - 1];
        if (monthYear && monthYear.toString().includes(year.toString())) {
          countForYear++;
        }
      }

      if (countForYear === 0) {
        warnings.push(`No assignments found for year ${year}. Archive will be empty.`);
      } else {
        Logger.log(`Found ${countForYear} assignments for year ${year}`);
      }
    }

    // Return validation result
    if (errors.length > 0) {
      return {
        valid: false,
        message: `Validation failed:\n${errors.join('\n')}`,
        errors: errors,
        warnings: warnings
      };
    }

    if (warnings.length > 0) {
      Logger.log(`⚠️ Validation warnings:\n${warnings.join('\n')}`);
    }

    return {
      valid: true,
      message: 'Validation passed',
      errors: [],
      warnings: warnings
    };

  } catch (e) {
    Logger.log(`ERROR in validation: ${e.message}`);
    return {
      valid: false,
      message: `Validation error: ${e.message}`,
      errors: [e.message],
      warnings: []
    };
  }
}

/**
 * Copies year-specific data sheets to archive spreadsheet
 * @param {Spreadsheet} archiveSpreadsheet - Target archive spreadsheet
 * @param {number} year - Year to archive
 * @returns {Array} List of copied sheet metadata
 */
function ARCHIVE_copyDataToArchive(archiveSpreadsheet, year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const copiedSheets = [];
  const sheetsToArchive = CONSTANTS.ARCHIVE.SHEETS_TO_ARCHIVE;

  for (const sheetName of sheetsToArchive) {
    try {
      const sourceSheet = ss.getSheetByName(sheetName);
      if (!sourceSheet) {
        Logger.log(`⚠️ Sheet '${sheetName}' not found, skipping`);
        continue;
      }

      Logger.log(`Copying sheet: ${sheetName}`);

      // For year-specific sheets, filter data by year
      if (sheetName === CONSTANTS.SHEETS.ASSIGNMENTS) {
        const rowCount = ARCHIVE_copyAssignments(sourceSheet, archiveSpreadsheet, year);
        copiedSheets.push({ name: sheetName, rows: rowCount });
      } else if (sheetName === CONSTANTS.SHEETS.CALENDAR) {
        const rowCount = ARCHIVE_copyCalendar(sourceSheet, archiveSpreadsheet, year);
        copiedSheets.push({ name: sheetName, rows: rowCount });
      } else if (sheetName === CONSTANTS.SHEETS.TIMEOFFS) {
        const rowCount = ARCHIVE_copyTimeoffs(sourceSheet, archiveSpreadsheet, year);
        copiedSheets.push({ name: sheetName, rows: rowCount });
      } else {
        // For other sheets, copy entire sheet
        const copiedSheet = sourceSheet.copyTo(archiveSpreadsheet);
        copiedSheet.setName(`${sheetName}_${year}`);
        const rowCount = copiedSheet.getLastRow() - 1; // Exclude header
        copiedSheets.push({ name: sheetName, rows: rowCount });
      }

      Logger.log(`✓ Copied ${sheetName}`);

    } catch (e) {
      Logger.log(`❌ Error copying ${sheetName}: ${e.message}`);
    }
  }

  return copiedSheets;
}

/**
 * Copies assignment data filtered by year
 * @param {Sheet} sourceSheet - Source Assignments sheet
 * @param {Spreadsheet} archiveSpreadsheet - Target archive spreadsheet
 * @param {number} year - Year to filter
 * @returns {number} Number of rows copied
 */
function ARCHIVE_copyAssignments(sourceSheet, archiveSpreadsheet, year) {
  const data = sourceSheet.getDataRange().getValues();
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  // Filter rows for this year
  const header = data[0];
  const yearData = [header];

  for (let i = 1; i < data.length; i++) {
    const monthYear = data[i][assignCols.MONTH_YEAR - 1];
    if (monthYear && monthYear.toString().includes(year.toString())) {
      yearData.push(data[i]);
    }
  }

  // Create sheet in archive
  const archiveSheet = archiveSpreadsheet.insertSheet(`Assignments_${year}`);

  if (yearData.length > 1) {
    archiveSheet.getRange(1, 1, yearData.length, header.length).setValues(yearData);

    // Apply header formatting
    const headerRange = archiveSheet.getRange(1, 1, 1, header.length);
    headerRange.setFontWeight('bold').setBackground('#d9d9d9');
  } else {
    // Empty archive - just add header
    archiveSheet.getRange(1, 1, 1, header.length).setValues([header]);
    archiveSheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#d9d9d9');
  }

  return yearData.length - 1; // Exclude header
}

/**
 * Copies calendar data filtered by year
 * @param {Sheet} sourceSheet - Source LiturgicalCalendar sheet
 * @param {Spreadsheet} archiveSpreadsheet - Target archive spreadsheet
 * @param {number} year - Year to filter
 * @returns {number} Number of rows copied
 */
function ARCHIVE_copyCalendar(sourceSheet, archiveSpreadsheet, year) {
  const data = sourceSheet.getDataRange().getValues();
  const calCols = CONSTANTS.COLS.CALENDAR;

  // Filter rows for this year
  const header = data[0];
  const yearData = [header];

  for (let i = 1; i < data.length; i++) {
    const dateValue = data[i][calCols.DATE - 1];
    if (dateValue instanceof Date && dateValue.getFullYear() === year) {
      yearData.push(data[i]);
    }
  }

  // Create sheet in archive
  const archiveSheet = archiveSpreadsheet.insertSheet(`LiturgicalCalendar_${year}`);

  if (yearData.length > 1) {
    archiveSheet.getRange(1, 1, yearData.length, header.length).setValues(yearData);

    // Apply header formatting
    const headerRange = archiveSheet.getRange(1, 1, 1, header.length);
    headerRange.setFontWeight('bold').setBackground('#d9d9d9');
  } else {
    archiveSheet.getRange(1, 1, 1, header.length).setValues([header]);
    archiveSheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#d9d9d9');
  }

  return yearData.length - 1;
}

/**
 * Copies timeoff data filtered by year
 * @param {Sheet} sourceSheet - Source Timeoffs sheet
 * @param {Spreadsheet} archiveSpreadsheet - Target archive spreadsheet
 * @param {number} year - Year to filter
 * @returns {number} Number of rows copied
 */
function ARCHIVE_copyTimeoffs(sourceSheet, archiveSpreadsheet, year) {
  const data = sourceSheet.getDataRange().getValues();
  const timeoffCols = CONSTANTS.COLS.TIMEOFFS;

  // Filter rows for this year (check Month column which should contain year)
  const header = data[0];
  const yearData = [header];

  for (let i = 1; i < data.length; i++) {
    // Check if Month column contains the year
    const monthValue = data[i][timeoffCols.MONTH - 1];
    if (monthValue && monthValue.toString().includes(year.toString())) {
      yearData.push(data[i]);
    }
  }

  // Create sheet in archive
  const archiveSheet = archiveSpreadsheet.insertSheet(`Timeoffs_${year}`);

  if (yearData.length > 1) {
    archiveSheet.getRange(1, 1, yearData.length, header.length).setValues(yearData);

    // Apply header formatting
    const headerRange = archiveSheet.getRange(1, 1, 1, header.length);
    headerRange.setFontWeight('bold').setBackground('#d9d9d9');
  } else {
    archiveSheet.getRange(1, 1, 1, header.length).setValues([header]);
    archiveSheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#d9d9d9');
  }

  return yearData.length - 1;
}

/**
 * Creates a metadata sheet in the archive with archive information
 * @param {Spreadsheet} archiveSpreadsheet - Target archive spreadsheet
 * @param {number} year - Year archived
 * @param {Array} copiedSheets - List of copied sheet metadata
 */
function ARCHIVE_createMetadataSheet(archiveSpreadsheet, year, copiedSheets) {
  const metadataSheet = archiveSpreadsheet.insertSheet('Archive_Info', 0);

  // Build metadata content
  const config = HELPER_readConfigSafe();
  const parishName = config["Parish Name"] || "Parish";

  const metadata = [
    ['ARCHIVE INFORMATION'],
    [''],
    ['Parish Name', parishName],
    ['Archived Year', year],
    ['Archive Created', new Date()],
    ['Created By', 'Parish Administrator'],
    [''],
    ['ARCHIVED SHEETS'],
    ['Sheet Name', 'Rows Archived']
  ];

  // Add sheet details
  for (const sheet of copiedSheets) {
    metadata.push([sheet.name, sheet.rows]);
  }

  // Write metadata
  metadataSheet.getRange(1, 1, metadata.length, 2).setValues(metadata);

  // Format metadata sheet
  metadataSheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  metadataSheet.getRange(8, 1).setFontSize(12).setFontWeight('bold');
  metadataSheet.getRange(9, 1, 1, 2).setFontWeight('bold').setBackground('#d9d9d9');

  metadataSheet.setColumnWidth(1, 200);
  metadataSheet.setColumnWidth(2, 150);
}

/**
 * Finds existing archive file by name
 * @param {string} fileName - Archive file name to search for
 * @returns {File|null} Google Drive File object or null if not found
 */
function ARCHIVE_findExistingArchive(fileName) {
  try {
    const files = DriveApp.getFilesByName(fileName);
    if (files.hasNext()) {
      return files.next();
    }
    return null;
  } catch (e) {
    Logger.log(`Error searching for existing archive: ${e.message}`);
    return null;
  }
}

/**
 * Lists all archive files in the same folder as current spreadsheet
 * @returns {Array} List of archive file metadata
 */
function ARCHIVE_listArchives() {
  try {
    const currentFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
    const parentFolders = currentFile.getParents();

    if (!parentFolders.hasNext()) {
      return [];
    }

    const parentFolder = parentFolders.next();
    const config = HELPER_readConfigSafe();
    const parishName = config["Parish Name"] || "Parish";

    // Search for archive files
    const searchQuery = `title contains "${parishName}" and title contains "Archive"`;
    const files = parentFolder.searchFiles(searchQuery);

    const archives = [];
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Extract year from filename (e.g., "St. Catherine - 2024 Archive")
      const yearMatch = fileName.match(/(\d{4})\s*Archive/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;

      archives.push({
        name: fileName,
        year: year,
        id: file.getId(),
        url: file.getUrl(),
        lastModified: file.getLastUpdated(),
        size: file.getSize()
      });
    }

    // Sort by year descending (most recent first)
    archives.sort((a, b) => (b.year || 0) - (a.year || 0));

    Logger.log(`Found ${archives.length} archive files`);
    return archives;

  } catch (e) {
    Logger.log(`Error listing archives: ${e.message}`);
    return [];
  }
}

/**
 * Clears year-specific data from current sheets (optional, destructive)
 * Use after archiving to start fresh for new year
 * @param {Array} sheetsToRestart - Array of sheet names to clear (optional)
 * @returns {object} Result with success status and message
 */
function ARCHIVE_clearOldData(sheetsToRestart) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const defaultSheets = [
      CONSTANTS.SHEETS.CALENDAR,
      CONSTANTS.SHEETS.ASSIGNMENTS,
      CONSTANTS.SHEETS.TIMEOFFS
    ];

    const sheetsToClear = sheetsToRestart || defaultSheets;
    const clearedSheets = [];

    for (const sheetName of sheetsToClear) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`Sheet '${sheetName}' not found, skipping`);
        continue;
      }

      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Clear all data except header row
        sheet.getRange(2, 1, lastRow - 1, sheet.getMaxColumns()).clear();
        clearedSheets.push(sheetName);
        Logger.log(`✓ Cleared ${sheetName} (${lastRow - 1} rows)`);
      }
    }

    return {
      success: true,
      message: `Cleared ${clearedSheets.length} sheets: ${clearedSheets.join(', ')}`,
      clearedSheets: clearedSheets
    };

  } catch (e) {
    Logger.log(`❌ ERROR clearing old data: ${e.message}`);
    return {
      success: false,
      message: `Failed to clear data: ${e.message}`
    };
  }
}

/**
 * Wrapper function to prompt user and archive current year from Config
 */
function ARCHIVE_promptArchiveCurrentYear() {
  try {
    const config = HELPER_readConfigSafe();
    const currentYear = config["Year to Schedule"];

    if (!currentYear) {
      SpreadsheetApp.getUi().alert(
        'Error',
        'Cannot determine year to archive. Please set "Year to Schedule" in Config sheet.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    // Confirmation dialog
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      `Archive ${currentYear} Data?`,
      `This will:\n\n` +
      `✓ Create a new spreadsheet: "${config["Parish Name"] || "Parish"} - ${currentYear} Archive"\n` +
      `✓ Copy year-specific data (Assignments, Calendar, Timeoffs)\n` +
      `✓ Store in the same Google Drive folder\n\n` +
      `Current sheets will NOT be cleared.\n\n` +
      `Continue?`,
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    // Show processing message
    SpreadsheetApp.getActive().toast('Creating archive file...', 'Archiving', -1);

    // Create archive
    const result = ARCHIVE_createArchiveFile(currentYear);

    // Dismiss toast
    SpreadsheetApp.getActive().toast('', '', 1);

    if (result.success) {
      ui.alert(
        '✓ Archive Complete!',
        `Archive created: ${result.fileName}\n\n` +
        `Archived sheets:\n` +
        result.sheets.map(s => `  • ${s.name}: ${s.rows} rows`).join('\n') + '\n\n' +
        `Archive URL:\n${result.url}\n\n` +
        `Next steps:\n` +
        `  1. Update Config: "Year to Schedule" → ${currentYear + 1}\n` +
        `  2. Generate ${currentYear + 1} liturgical calendar\n` +
        `  3. Optionally: Clear current data (Admin Tools → Clear Old Data)`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'Archive Failed',
        result.message,
        ui.ButtonSet.OK
      );
    }

  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'Error',
      `Archive failed: ${e.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Wrapper function to show list of existing archives
 */
function ARCHIVE_showArchiveList() {
  try {
    const archives = ARCHIVE_listArchives();

    if (archives.length === 0) {
      SpreadsheetApp.getUi().alert(
        'No Archives Found',
        'No archive files found in this folder.\n\nArchives will appear here after you create your first year-end archive.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    // Build message
    let message = 'Available Archives:\n\n';
    for (const archive of archives) {
      const dateStr = HELPER_formatDate(archive.lastModified, 'default');
      message += `📦 ${archive.name}\n`;
      message += `   Last modified: ${dateStr}\n`;
      message += `   URL: ${archive.url}\n\n`;
    }

    message += `\nClick any URL above to open the archive file.`;

    SpreadsheetApp.getUi().alert(
      'Archive Files',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'Error',
      `Could not list archives: ${e.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Wrapper function to prompt user and clear old data
 */
function ARCHIVE_promptClearOldData() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Warning dialog
    const response = ui.alert(
      '⚠️ Clear Old Data?',
      `This will permanently DELETE all data from:\n\n` +
      `  • LiturgicalCalendar\n` +
      `  • Assignments\n` +
      `  • Timeoffs\n\n` +
      `Only the header rows will remain.\n\n` +
      `⚠️ Make sure you archived the data first!\n\n` +
      `This action cannot be undone (except via Version History).\n\n` +
      `Continue?`,
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    // Second confirmation
    const response2 = ui.alert(
      'Final Confirmation',
      'Are you absolutely sure you want to clear all data?',
      ui.ButtonSet.YES_NO
    );

    if (response2 !== ui.Button.YES) {
      return;
    }

    // Clear data
    SpreadsheetApp.getActive().toast('Clearing old data...', 'Processing', -1);
    const result = ARCHIVE_clearOldData();
    SpreadsheetApp.getActive().toast('', '', 1);

    if (result.success) {
      ui.alert(
        '✓ Data Cleared',
        result.message + '\n\nYou can now generate a new calendar and schedule for the new year.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'Error',
        result.message,
        ui.ButtonSet.OK
      );
    }

  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'Error',
      `Could not clear data: ${e.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
