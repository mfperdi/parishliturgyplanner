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

/**
 * ====================================================================
 * AUTO-PUBLISH FUNCTIONALITY
 * ====================================================================
 * Automatically publishes current and next month's schedules to public
 * spreadsheet on a timer. Designed for mobile workflow where admin
 * can't manually run scripts.
 */

/**
 * Auto-publish function that runs on a timer.
 * Publishes current month and next month (if available).
 * Safe to run repeatedly - only publishes if MonthlyView exists.
 * This is the function that gets triggered automatically.
 */
function AUTOPUBLISH_runScheduledPublish() {
  try {
    Logger.log('=== Auto-Publish Starting ===');

    // Check if auto-publish is enabled
    const config = HELPER_readConfigSafe();
    const autoPublishEnabled = config['Auto-Publish Enabled'];

    if (autoPublishEnabled !== true && autoPublishEnabled !== 'TRUE' && autoPublishEnabled !== 'Yes') {
      Logger.log('Auto-publish is disabled in Config. Skipping.');
      return 'Auto-publish disabled';
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const monthlyViewSheet = ss.getSheetByName('MonthlyView');

    if (!monthlyViewSheet) {
      Logger.log('MonthlyView sheet not found. Nothing to publish.');
      return 'No MonthlyView found';
    }

    if (monthlyViewSheet.getLastRow() < 5) {
      Logger.log('MonthlyView appears empty. Nothing to publish.');
      return 'MonthlyView is empty';
    }

    // Get the month that MonthlyView represents
    // Check cell B2 which typically contains the month name
    let monthString = null;
    try {
      const titleCell = monthlyViewSheet.getRange(2, 2).getValue();
      monthString = AUTOPUBLISH_extractMonthFromTitle(titleCell);
    } catch (e) {
      Logger.log(`Could not determine month from MonthlyView: ${e.message}`);
    }

    if (!monthString) {
      // Fallback: use current month
      const now = new Date();
      monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      Logger.log(`Using current month as fallback: ${monthString}`);
    }

    // Publish the month
    Logger.log(`Auto-publishing ${monthString}...`);
    const result = PUBLISH_syncMonthlyViewToPublic(monthString);

    Logger.log('=== Auto-Publish Complete ===');
    return result;

  } catch (e) {
    Logger.log(`ERROR in AUTOPUBLISH_runScheduledPublish: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    // Don't throw - let trigger continue running
    return `Error: ${e.message}`;
  }
}

/**
 * Extracts month string (YYYY-MM) from MonthlyView title.
 * @param {string} titleText - The title text from MonthlyView (e.g., "February 2026")
 * @returns {string|null} - Month string like "2026-02" or null if can't parse
 */
function AUTOPUBLISH_extractMonthFromTitle(titleText) {
  try {
    if (!titleText || typeof titleText !== 'string') {
      return null;
    }

    // Try to parse "February 2026" format
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let i = 0; i < monthNames.length; i++) {
      if (titleText.includes(monthNames[i])) {
        // Found month name, now find year
        const yearMatch = titleText.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          const year = yearMatch[1];
          const month = String(i + 1).padStart(2, '0');
          return `${year}-${month}`;
        }
      }
    }

    return null;
  } catch (e) {
    Logger.log(`Error extracting month from title: ${e.message}`);
    return null;
  }
}

/**
 * Sets up the auto-publish time-based trigger.
 * @param {number} intervalMinutes - How often to publish (15, 30, 60, etc.)
 * @returns {string} Success message
 */
function AUTOPUBLISH_setupTrigger(intervalMinutes) {
  try {
    // First, remove any existing auto-publish triggers
    AUTOPUBLISH_removeTrigger();

    // Validate interval
    const validIntervals = [15, 30, 60, 120, 180, 360];
    if (!validIntervals.includes(intervalMinutes)) {
      throw new Error(`Invalid interval. Choose from: ${validIntervals.join(', ')} minutes`);
    }

    // Create new trigger
    ScriptApp.newTrigger('AUTOPUBLISH_runScheduledPublish')
      .timeBased()
      .everyMinutes(intervalMinutes)
      .create();

    Logger.log(`Auto-publish trigger created: every ${intervalMinutes} minutes`);

    // Enable auto-publish in Config
    AUTOPUBLISH_setConfigValue('Auto-Publish Enabled', true);
    AUTOPUBLISH_setConfigValue('Auto-Publish Interval (Minutes)', intervalMinutes);

    return `✅ Auto-publish enabled!\n\nSchedules will automatically publish every ${intervalMinutes} minutes.\n\nEdit on mobile and changes will appear in the public spreadsheet shortly.`;

  } catch (e) {
    Logger.log(`ERROR in AUTOPUBLISH_setupTrigger: ${e.message}`);
    throw new Error(`Could not set up auto-publish: ${e.message}`);
  }
}

/**
 * Removes the auto-publish trigger.
 * @returns {string} Success message
 */
function AUTOPUBLISH_removeTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'AUTOPUBLISH_runScheduledPublish') {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
      }
    }

    Logger.log(`Removed ${removedCount} auto-publish trigger(s)`);

    // Disable in Config
    AUTOPUBLISH_setConfigValue('Auto-Publish Enabled', false);

    if (removedCount > 0) {
      return `✅ Auto-publish disabled.\n\nRemoved ${removedCount} trigger(s). You can now publish manually only.`;
    } else {
      return 'No auto-publish triggers found.';
    }

  } catch (e) {
    Logger.log(`ERROR in AUTOPUBLISH_removeTrigger: ${e.message}`);
    throw new Error(`Could not remove auto-publish trigger: ${e.message}`);
  }
}

/**
 * Helper: Sets a config value.
 * @param {string} settingName - The setting name
 * @param {*} value - The value to set
 */
function AUTOPUBLISH_setConfigValue(settingName, value) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);

    if (!configSheet) {
      Logger.log('Config sheet not found');
      return;
    }

    const configData = configSheet.getDataRange().getValues();
    let rowIndex = -1;

    // Find existing row
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === settingName) {
        rowIndex = i + 1;
        break;
      }
    }

    // Add new row if not found
    if (rowIndex === -1) {
      rowIndex = configData.length + 1;
      configSheet.getRange(rowIndex, 1).setValue(settingName);
    }

    // Set value
    configSheet.getRange(rowIndex, 2).setValue(value);
    Logger.log(`Config updated: ${settingName} = ${value}`);

  } catch (e) {
    Logger.log(`WARNING: Could not update config: ${e.message}`);
  }
}

/**
 * Gets the current auto-publish status.
 * @returns {Object} Status object with enabled flag and interval
 */
function AUTOPUBLISH_getStatus() {
  try {
    const config = HELPER_readConfigSafe();
    const enabled = config['Auto-Publish Enabled'];
    const interval = config['Auto-Publish Interval (Minutes)'] || 30;

    // Check if trigger actually exists
    const triggers = ScriptApp.getProjectTriggers();
    let triggerExists = false;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'AUTOPUBLISH_runScheduledPublish') {
        triggerExists = true;
        break;
      }
    }

    return {
      enabled: enabled === true || enabled === 'TRUE' || enabled === 'Yes',
      interval: interval,
      triggerExists: triggerExists
    };

  } catch (e) {
    Logger.log(`Error getting auto-publish status: ${e.message}`);
    return {
      enabled: false,
      interval: 30,
      triggerExists: false
    };
  }
}

/**
 * Menu wrapper: Enable auto-publish with user-selected interval.
 */
function enableAutoPublish() {
  try {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
      'Enable Auto-Publish',
      'This will automatically publish your MonthlyView to the public spreadsheet on a timer.\n\n' +
      'Perfect for mobile editing - make changes anytime and they\'ll appear in the public schedule automatically.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    // Ask for interval
    const intervalResponse = ui.prompt(
      'Select Interval',
      'How often should schedules auto-publish?\n\n' +
      'Options: 15, 30, 60, 120, 180, 360 (minutes)\n' +
      'Recommended: 30 minutes\n\n' +
      'Enter number of minutes:',
      ui.ButtonSet.OK_CANCEL
    );

    if (intervalResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const interval = parseInt(intervalResponse.getResponseText());

    if (isNaN(interval)) {
      ui.alert('Invalid Input', 'Please enter a number.', ui.ButtonSet.OK);
      return;
    }

    // Set up trigger
    const result = AUTOPUBLISH_setupTrigger(interval);
    ui.alert('✅ Success', result, ui.ButtonSet.OK);

  } catch (e) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('❌ Error', `Could not enable auto-publish:\n\n${e.message}`, ui.ButtonSet.OK);
    Logger.log(`ERROR in enableAutoPublish: ${e.message}\n${e.stack}`);
  }
}

/**
 * Menu wrapper: Disable auto-publish.
 */
function disableAutoPublish() {
  try {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
      'Disable Auto-Publish',
      'This will stop automatic publishing to the public spreadsheet.\n\n' +
      'You\'ll need to manually publish schedules using "Publish Current Month".\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    const result = AUTOPUBLISH_removeTrigger();
    ui.alert('✅ Success', result, ui.ButtonSet.OK);

  } catch (e) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('❌ Error', `Could not disable auto-publish:\n\n${e.message}`, ui.ButtonSet.OK);
    Logger.log(`ERROR in disableAutoPublish: ${e.message}\n${e.stack}`);
  }
}

/**
 * Menu wrapper: Show auto-publish status.
 */
function showAutoPublishStatus() {
  try {
    const ui = SpreadsheetApp.getUi();
    const status = AUTOPUBLISH_getStatus();

    let message = '';
    if (status.enabled && status.triggerExists) {
      message = `✅ Auto-Publish is ENABLED\n\n` +
                `Publishing every ${status.interval} minutes\n\n` +
                `Your MonthlyView will automatically sync to the public spreadsheet. ` +
                `Edit assignments on mobile and changes will appear shortly!`;
    } else if (status.enabled && !status.triggerExists) {
      message = `⚠️ Auto-Publish is PARTIALLY ENABLED\n\n` +
                `Config says enabled, but no trigger found.\n\n` +
                `Use "Enable Auto-Publish" to fix this.`;
    } else {
      message = `❌ Auto-Publish is DISABLED\n\n` +
                `You must manually publish schedules using "Publish Current Month".\n\n` +
                `Use "Enable Auto-Publish" to turn on automatic publishing.`;
    }

    ui.alert('Auto-Publish Status', message, ui.ButtonSet.OK);

  } catch (e) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('❌ Error', `Could not check status:\n\n${e.message}`, ui.ButtonSet.OK);
    Logger.log(`ERROR in showAutoPublishStatus: ${e.message}\n${e.stack}`);
  }
}
