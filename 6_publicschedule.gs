/**
 * ====================================================================
 * PUBLIC SCHEDULE SYNC
 * ====================================================================
 * Syncs MonthlyView to a separate public spreadsheet for volunteer access.
 * - Creates single spreadsheet with monthly tabs
 * - Clones MonthlyView exactly (formatting, colors, unassigned slots)
 * - Manual trigger only (admin controls when to publish)
 * - Access managed manually via Google Sheets sharing
 * - No automatic Instructions sheet (admin can create manually if desired)
 */

/**
 * Main function to sync MonthlyView to public spreadsheet.
 * @param {string} monthString The month to publish (e.g., "2026-02").
 * @returns {string} Success message with link to public spreadsheet.
 */
function PUBLISH_syncMonthlyViewToPublic(monthString) {
  try {
    // Validate input
    const { year, month } = HELPER_validateMonthString(monthString);
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');

    Logger.log(`Starting public schedule sync for ${displayName}`);

    // Get or create public spreadsheet
    const publicSpreadsheet = PUBLISH_getOrCreatePublicSpreadsheet();

    // Copy MonthlyView to public spreadsheet
    const publicUrl = PUBLISH_copyMonthlyViewToPublic(monthString, publicSpreadsheet);

    Logger.log(`Successfully synced ${displayName} to public spreadsheet`);
    return `✅ Successfully published ${displayName} schedule!\n\nPublic URL:\n${publicUrl}\n\nVolunteers can view the "${displayName}" tab in the public spreadsheet.`;

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_syncMonthlyViewToPublic: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw new Error(`Could not publish schedule: ${e.message}`);
  }
}

/**
 * Gets or creates the public spreadsheet.
 * Stores spreadsheet ID in Config sheet for reuse.
 * @returns {Spreadsheet} The public spreadsheet object.
 */
function PUBLISH_getOrCreatePublicSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Try to get existing public spreadsheet ID from Config
    let publicSpreadsheetId = null;
    try {
      const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);
      if (configSheet) {
        const configData = configSheet.getDataRange().getValues();
        for (let i = 1; i < configData.length; i++) {
          if (configData[i][0] === 'Public Spreadsheet ID') {
            publicSpreadsheetId = configData[i][1];
            break;
          }
        }
      }
    } catch (e) {
      Logger.log(`Could not read public spreadsheet ID from Config: ${e.message}`);
    }

    // Try to open existing spreadsheet
    if (publicSpreadsheetId) {
      try {
        const publicSpreadsheet = SpreadsheetApp.openById(publicSpreadsheetId);
        Logger.log(`Opened existing public spreadsheet: ${publicSpreadsheet.getName()}`);
        return publicSpreadsheet;
      } catch (e) {
        Logger.log(`Could not open existing public spreadsheet (may have been deleted): ${e.message}`);
        // Will create new one below
      }
    }

    // Create new public spreadsheet
    Logger.log('Creating new public spreadsheet...');

    // Get parish and ministry names from Config
    const config = HELPER_readConfigSafe();
    const parishName = config['Parish Name'] || 'Parish';
    const ministryName = config['Ministry Name'] || 'Ministry';
    const spreadsheetName = `${parishName} ${ministryName} Schedule`;

    // Create spreadsheet (will have default "Sheet1")
    const publicSpreadsheet = SpreadsheetApp.create(spreadsheetName);

    Logger.log(`Created new public spreadsheet: ${spreadsheetName}`);

    // Store spreadsheet ID in Config
    PUBLISH_storePublicSpreadsheetId(publicSpreadsheet.getId());

    return publicSpreadsheet;

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_getOrCreatePublicSpreadsheet: ${e.message}`);
    throw new Error(`Could not get or create public spreadsheet: ${e.message}`);
  }
}

/**
 * Stores the public spreadsheet ID in Config sheet.
 * @param {string} spreadsheetId The spreadsheet ID to store.
 */
function PUBLISH_storePublicSpreadsheetId(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);

    if (!configSheet) {
      throw new Error('Config sheet not found');
    }

    const configData = configSheet.getDataRange().getValues();
    let rowIndex = -1;

    // Find existing row
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === 'Public Spreadsheet ID') {
        rowIndex = i + 1;
        break;
      }
    }

    // Add new row if not found
    if (rowIndex === -1) {
      rowIndex = configData.length + 1;
      configSheet.getRange(rowIndex, 1).setValue('Public Spreadsheet ID');
    }

    // Store ID
    configSheet.getRange(rowIndex, 2).setValue(spreadsheetId);
    Logger.log(`Stored public spreadsheet ID in Config sheet`);

  } catch (e) {
    Logger.log(`WARNING: Could not store public spreadsheet ID: ${e.message}`);
    // Non-fatal error - continue
  }
}

/**
 * Copies MonthlyView to public spreadsheet (exact clone with formatting).
 * Uses sheet duplication for reliable copying of complex formatting.
 * @param {string} monthString The month to copy.
 * @param {Spreadsheet} publicSpreadsheet The public spreadsheet object.
 * @returns {string} URL to the public spreadsheet.
 */
function PUBLISH_copyMonthlyViewToPublic(monthString, publicSpreadsheet) {
  try {
    const { year, month } = HELPER_validateMonthString(monthString);
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');

    Logger.log(`Copying MonthlyView for ${displayName} to public spreadsheet`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('MonthlyView');

    if (!sourceSheet) {
      throw new Error('MonthlyView sheet not found. Please generate the print schedule first.');
    }

    // Check if MonthlyView has data
    if (sourceSheet.getLastRow() < 5) {
      throw new Error('MonthlyView appears empty. Please generate the print schedule first.');
    }

    // Copy the entire sheet to public spreadsheet (this preserves all formatting)
    // Creates "Copy of MonthlyView" automatically
    Logger.log(`Duplicating MonthlyView sheet to public spreadsheet`);
    const copiedSheet = sourceSheet.copyTo(publicSpreadsheet);

    // Rename to temporary unique name to avoid conflicts
    const tempName = `${displayName}_${Date.now()}`;
    copiedSheet.setName(tempName);

    // NOW safe to delete existing sheet (we have at least 2 sheets)
    const existingSheet = publicSpreadsheet.getSheetByName(displayName);
    if (existingSheet) {
      Logger.log(`Sheet "${displayName}" already exists, deleting it`);
      publicSpreadsheet.deleteSheet(existingSheet);
    }

    // Rename to final name
    copiedSheet.setName(displayName);

    // Update timestamp in cell B3 to show when it was published
    try {
      const publishedText = `Published: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
      copiedSheet.getRange(3, 2).setValue(publishedText);
      Logger.log('Updated published timestamp in B3');
    } catch (e) {
      Logger.log(`Could not update timestamp: ${e.message}`);
      // Non-fatal
    }

    Logger.log(`Successfully copied MonthlyView to "${displayName}" sheet in public spreadsheet`);
    return publicSpreadsheet.getUrl();

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_copyMonthlyViewToPublic: ${e.message}`);
    throw new Error(`Could not copy schedule: ${e.message}`);
  }
}

/**
 * Menu wrapper: Prompts user to select a month and publishes that month's schedule.
 * Accessed via: Admin Tools > Public Schedule > Publish Current Month
 */
function publishCurrentMonthSchedule() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Get available months from calendar
    const months = getMonthsForSidebar();

    if (months.length === 0) {
      ui.alert('No Calendar Data',
               'Please generate the liturgical calendar first (Show Sidebar > Generate Calendar)',
               ui.ButtonSet.OK);
      return;
    }

    // Build prompt with month options
    let promptText = 'Select a month to publish:\n\n';
    months.forEach((m, idx) => {
      promptText += `${idx + 1}. ${m.display}\n`;
    });
    promptText += '\nEnter the number (1-' + months.length + '):';

    const response = ui.prompt('Publish Schedule', promptText, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() !== ui.Button.OK) {
      return; // User cancelled
    }

    const selection = parseInt(response.getResponseText());

    if (isNaN(selection) || selection < 1 || selection > months.length) {
      ui.alert('Invalid Selection', 'Please enter a number between 1 and ' + months.length, ui.ButtonSet.OK);
      return;
    }

    const selectedMonth = months[selection - 1].value;
    const selectedMonthName = months[selection - 1].display;

    // Publish the selected month
    const result = PUBLISH_syncMonthlyViewToPublic(selectedMonth);
    ui.alert('✅ Schedule Published', result, ui.ButtonSet.OK);

  } catch (e) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('❌ Error', `Could not publish schedule:\n\n${e.message}`, ui.ButtonSet.OK);
    Logger.log(`ERROR in publishCurrentMonthSchedule: ${e.message}\n${e.stack}`);
  }
}

/**
 * Helper function: Gets the public spreadsheet URL.
 * Returns URL or error message if not created yet.
 */
function getPublicScheduleLink() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);

    if (!configSheet) {
      throw new Error('Config sheet not found');
    }

    const configData = configSheet.getDataRange().getValues();
    let publicSpreadsheetId = null;

    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === 'Public Spreadsheet ID') {
        publicSpreadsheetId = configData[i][1];
        break;
      }
    }

    if (!publicSpreadsheetId) {
      SpreadsheetApp.getUi().alert(
        'No Public Schedule Yet',
        'You haven\'t published any schedules yet.\n\nUse "Admin Tools > Public Schedule > Publish Current Month" to create your first public schedule.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    const publicSpreadsheet = SpreadsheetApp.openById(publicSpreadsheetId);
    const url = publicSpreadsheet.getUrl();

    SpreadsheetApp.getUi().alert(
      '📋 Public Schedule Link',
      `Share this link with your volunteers:\n\n${url}\n\nYou can manage access via File > Share in the public spreadsheet.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (e) {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      `Could not get public schedule link:\n\n${e.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
