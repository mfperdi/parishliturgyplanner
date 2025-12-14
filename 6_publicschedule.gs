/**
 * ====================================================================
 * PUBLIC SCHEDULE SYNC - WITH MINISTRY FILTERING
 * ====================================================================
 * Syncs schedules to separate public spreadsheets for volunteer access.
 * - Supports multiple public spreadsheets (one per ministry + one for all)
 * - Generates filtered print schedules on-the-fly
 * - Manual trigger or optional auto-publish after assignment
 * - Access managed manually via Google Sheets sharing
 */

/**
 * Main function to sync schedule to public spreadsheet with optional ministry filtering.
 * @param {string} monthString The month to publish (e.g., "2026-02").
 * @param {object} options Options including ministryFilter
 * @returns {string} Success message with link to public spreadsheet.
 */
function PUBLISH_syncMonthlyViewToPublic(monthString, options = {}) {
  try {
    // Validate input
    const { year, month } = HELPER_validateMonthString(monthString);
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');
    const { ministryFilter } = options; // Array like ["Lector"] or null

    const ministryName = ministryFilter && ministryFilter.length > 0 ? ministryFilter[0] : null;
    const filterDesc = ministryName ? ` (${ministryName})` : ' (All Ministries)';

    Logger.log(`Starting public schedule sync for ${displayName}${filterDesc}`);

    // Get or create appropriate public spreadsheet
    const publicSpreadsheet = PUBLISH_getOrCreatePublicSpreadsheet(ministryName);

    // Generate and copy filtered schedule to public spreadsheet
    const publicUrl = PUBLISH_copyFilteredScheduleToPublic(monthString, publicSpreadsheet, ministryFilter);

    Logger.log(`Successfully synced ${displayName}${filterDesc} to public spreadsheet`);
    return `✅ Successfully published ${displayName}${filterDesc}!\n\nPublic URL:\n${publicUrl}\n\nVolunteers can view the "${displayName}" tab.`;

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_syncMonthlyViewToPublic: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw new Error(`Could not publish schedule: ${e.message}`);
  }
}

/**
 * Publishes schedules to all ministry spreadsheets at once.
 * Creates main schedule (all ministries) + individual ministry schedules.
 * @param {string} monthString The month to publish
 * @returns {object} Results with URLs for each published schedule
 */
function PUBLISH_publishAllMinistries(monthString) {
  try {
    const { year, month } = HELPER_validateMonthString(monthString);
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');

    Logger.log(`Publishing all ministries for ${displayName}`);

    const results = [];

    // 1. Publish main schedule (all ministries)
    Logger.log('Publishing main schedule (all ministries)...');
    const mainResult = PUBLISH_syncMonthlyViewToPublic(monthString, { ministryFilter: null });
    results.push({ ministry: 'All Ministries', result: mainResult });

    // 2. Get all active ministries and publish each
    const ministries = getActiveMinistries();
    Logger.log(`Publishing ${ministries.length} individual ministry schedules...`);

    for (const ministry of ministries) {
      Logger.log(`Publishing ${ministry} schedule...`);
      const ministryResult = PUBLISH_syncMonthlyViewToPublic(monthString, { ministryFilter: [ministry] });
      results.push({ ministry, result: ministryResult });
    }

    // Build success message with all URLs
    const count = results.length;
    let message = `✅ Published ${count} schedules for ${displayName}:\n\n`;

    for (const { ministry } of results) {
      message += `📄 ${ministry}\n`;
    }

    message += `\nAll schedules updated successfully!`;

    Logger.log(`Successfully published all ${count} schedules`);
    return message;

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_publishAllMinistries: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw new Error(`Could not publish all ministries: ${e.message}`);
  }
}

/**
 * Gets or creates the public spreadsheet for a specific ministry (or main schedule).
 * Stores spreadsheet ID in Config sheet for reuse.
 * @param {string|null} ministry Ministry name (e.g., "Lector") or null for main schedule
 * @returns {Spreadsheet} The public spreadsheet object.
 */
function PUBLISH_getOrCreatePublicSpreadsheet(ministry = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Determine config key for this ministry
    const configKey = ministry ? `Public Spreadsheet ID - ${ministry}` : 'Public Spreadsheet ID';

    // Try to get existing public spreadsheet ID from Config
    let publicSpreadsheetId = null;
    try {
      const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);
      if (configSheet) {
        const configData = configSheet.getDataRange().getValues();
        for (let i = 1; i < configData.length; i++) {
          if (configData[i][0] === configKey) {
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
    Logger.log(`Creating new public spreadsheet for ${ministry || 'all ministries'}...`);

    // Get parish name from Config (Ministry Name will be empty per user preference)
    const config = HELPER_readConfigSafe();
    const parishName = config['Parish Name'] || 'Parish';

    // Build spreadsheet name
    const spreadsheetName = ministry
      ? `${parishName} - ${ministry} Schedule`
      : `${parishName} - Schedule`;

    // Create spreadsheet (will have default "Sheet1")
    const publicSpreadsheet = SpreadsheetApp.create(spreadsheetName);

    Logger.log(`Created new public spreadsheet: ${spreadsheetName}`);

    // Store spreadsheet ID in Config
    PUBLISH_storePublicSpreadsheetId(configKey, publicSpreadsheet.getId());

    return publicSpreadsheet;

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_getOrCreatePublicSpreadsheet: ${e.message}`);
    throw new Error(`Could not get or create public spreadsheet: ${e.message}`);
  }
}

/**
 * Stores a public spreadsheet ID in Config sheet.
 * @param {string} configKey The config key (e.g., "Public Spreadsheet ID - Lector")
 * @param {string} spreadsheetId The spreadsheet ID to store.
 */
function PUBLISH_storePublicSpreadsheetId(configKey, spreadsheetId) {
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
      if (configData[i][0] === configKey) {
        rowIndex = i + 1;
        break;
      }
    }

    // Add new row if not found
    if (rowIndex === -1) {
      rowIndex = configData.length + 1;
      configSheet.getRange(rowIndex, 1).setValue(configKey);
    }

    // Store ID
    configSheet.getRange(rowIndex, 2).setValue(spreadsheetId);
    Logger.log(`Stored public spreadsheet ID in Config: ${configKey}`);

  } catch (e) {
    Logger.log(`WARNING: Could not store public spreadsheet ID: ${e.message}`);
    // Non-fatal error - continue
  }
}

/**
 * Generates filtered print schedule and copies to public spreadsheet.
 * Uses generatePrintableSchedule with ministryFilter to create schedule on-the-fly.
 * @param {string} monthString The month to copy.
 * @param {Spreadsheet} publicSpreadsheet The public spreadsheet object.
 * @param {Array|null} ministryFilter Ministry filter array or null for all
 * @returns {string} URL to the public spreadsheet.
 */
function PUBLISH_copyFilteredScheduleToPublic(monthString, publicSpreadsheet, ministryFilter) {
  try {
    const { year, month } = HELPER_validateMonthString(monthString);
    const displayName = HELPER_formatDate(new Date(year, month, 1), 'month-year');

    Logger.log(`Generating filtered schedule for ${displayName} to public spreadsheet`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Generate filtered print schedule to a temporary sheet
    const tempSheetName = `__TEMP_PUBLISH_${Date.now()}`;
    Logger.log(`Generating filtered schedule to temp sheet: ${tempSheetName}`);

    generatePrintableSchedule(monthString, {
      sheetName: tempSheetName,
      ministryFilter: ministryFilter
    });

    const tempSheet = ss.getSheetByName(tempSheetName);

    if (!tempSheet) {
      throw new Error(`Failed to generate temp schedule sheet: ${tempSheetName}`);
    }

    // Check if temp sheet has data
    if (tempSheet.getLastRow() < 5) {
      ss.deleteSheet(tempSheet); // Clean up
      throw new Error('Generated schedule appears empty. Please check assignments and try again.');
    }

    // Copy the temp sheet to public spreadsheet
    Logger.log(`Copying temp sheet to public spreadsheet`);
    const copiedSheet = tempSheet.copyTo(publicSpreadsheet);

    // Rename to temporary unique name to avoid conflicts
    const tempName = `${displayName}_${Date.now()}`;
    copiedSheet.setName(tempName);

    // NOW safe to delete existing sheet with same name
    const existingSheet = publicSpreadsheet.getSheetByName(displayName);
    if (existingSheet) {
      Logger.log(`Sheet "${displayName}" already exists, deleting it`);
      publicSpreadsheet.deleteSheet(existingSheet);
    }

    // Rename to final name
    copiedSheet.setName(displayName);

    // Update timestamp in cell B4 to show when it was published (row 4 after liturgical year row was added)
    try {
      const publishedText = `Published: ${HELPER_formatDate(new Date(), 'default')} at ${HELPER_formatTime(new Date())}`;
      copiedSheet.getRange(4, 2).setValue(publishedText);
      Logger.log('Updated published timestamp in B4');
    } catch (e) {
      Logger.log(`Could not update timestamp: ${e.message}`);
      // Non-fatal
    }

    // Trim the copied sheet for clean print/PDF output
    try {
      const numColumns = ministryFilter && ministryFilter.length === 1 ? 5 : 6;
      const lastRow = copiedSheet.getLastRow();
      const bufferRows = 2;
      const bufferCols = 0;  // No buffer - trim to exact content width for clean print
      const targetRows = lastRow + bufferRows;
      const targetCols = numColumns + bufferCols;

      const maxRows = copiedSheet.getMaxRows();
      if (maxRows > targetRows) {
        copiedSheet.deleteRows(targetRows + 1, maxRows - targetRows);
        Logger.log(`Trimmed public sheet to ${targetRows} rows`);
      }

      const maxCols = copiedSheet.getMaxColumns();
      if (maxCols > targetCols) {
        copiedSheet.deleteColumns(targetCols + 1, maxCols - targetCols);
        Logger.log(`Trimmed public sheet to ${targetCols} columns`);
      }
    } catch (e) {
      Logger.log(`Warning: Could not trim public sheet: ${e.message}`);
      // Non-fatal
    }

    // Clean up temp sheet from source spreadsheet
    ss.deleteSheet(tempSheet);
    Logger.log(`Deleted temp sheet: ${tempSheetName}`);

    Logger.log(`Successfully copied filtered schedule to "${displayName}" sheet in public spreadsheet`);
    return publicSpreadsheet.getUrl();

  } catch (e) {
    Logger.log(`ERROR in PUBLISH_copyFilteredScheduleToPublic: ${e.message}`);

    // Try to clean up temp sheet if it exists
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const allSheets = ss.getSheets();
      for (const sheet of allSheets) {
        if (sheet.getName().startsWith('__TEMP_PUBLISH_')) {
          ss.deleteSheet(sheet);
          Logger.log(`Cleaned up temp sheet: ${sheet.getName()}`);
        }
      }
    } catch (cleanupError) {
      Logger.log(`Could not clean up temp sheets: ${cleanupError.message}`);
    }

    throw new Error(`Could not copy schedule: ${e.message}`);
  }
}

/**
 * Helper function: Gets the public spreadsheet URL for a ministry.
 * Returns URL or error message if not created yet.
 * @param {string|null} ministry Ministry name or null for main schedule
 */
function getPublicScheduleLink(ministry = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);

    if (!configSheet) {
      throw new Error('Config sheet not found');
    }

    const configKey = ministry ? `Public Spreadsheet ID - ${ministry}` : 'Public Spreadsheet ID';
    const configData = configSheet.getDataRange().getValues();
    let publicSpreadsheetId = null;

    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === configKey) {
        publicSpreadsheetId = configData[i][1];
        break;
      }
    }

    if (!publicSpreadsheetId) {
      const scheduleType = ministry ? `${ministry} schedule` : 'any schedules';
      HELPER_showAlert(
        'No Public Schedule Yet',
        `You haven't published ${scheduleType} yet.\n\nUse the sidebar to publish schedules.`,
        'info'
      );
      return;
    }

    const publicSpreadsheet = SpreadsheetApp.openById(publicSpreadsheetId);
    const url = publicSpreadsheet.getUrl();
    const scheduleType = ministry ? `${ministry} Schedule` : 'Main Schedule';

    HELPER_showAlert(
      `Public ${scheduleType} Link`,
      `Share this link with your volunteers:\n\n${url}\n\nYou can manage access via File > Share in the public spreadsheet.`,
      'info'
    );

  } catch (e) {
    HELPER_showError('Get Link Failed', e, 'print');
  }
}

/**
 * ====================================================================
 * AUTO-PUBLISH FUNCTIONALITY
 * ====================================================================
 * Automatically publishes current and next month's schedules to public
 * spreadsheet on a timer. Designed for mobile workflow where admin
 * can't manually run scripts.
 *
 * NOTE: Auto-publish currently only publishes the main "All Ministries"
 * schedule. Individual ministry schedules must be published manually.
 */

/**
 * Auto-publish function that runs on a timer.
 * Publishes main schedule (all ministries) only.
 * Safe to run repeatedly - only publishes if assignments exist.
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

    // Determine current month to publish
    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    Logger.log(`Auto-publishing current month: ${monthString}`);

    // Publish main schedule (all ministries)
    const result = PUBLISH_syncMonthlyViewToPublic(monthString, { ministryFilter: null });

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

    return `✅ Auto-publish enabled!\n\nMain schedule will automatically publish every ${intervalMinutes} minutes.\n\nIndividual ministry schedules must be published manually.`;

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
    const confirmed = HELPER_confirmAction(
      'Enable Auto-Publish',
      'This will automatically publish the main schedule (all ministries) to the public spreadsheet on a timer.\n\n' +
      'Perfect for mobile editing - make changes anytime and they\'ll appear in the public schedule automatically.\n\n' +
      'Individual ministry schedules must be published manually.',
      { type: 'info' }
    );

    if (!confirmed) {
      return;
    }

    // Ask for interval
    const intervalResult = HELPER_promptUser(
      'Select Interval',
      'How often should schedules auto-publish?\n\n' +
      'Options: 15, 30, 60, 120, 180, 360 (minutes)\n' +
      'Recommended: 30 minutes\n\n' +
      'Enter number of minutes:',
      {
        required: true,
        validator: (value) => {
          const interval = parseInt(value);
          const validIntervals = [15, 30, 60, 120, 180, 360];
          if (isNaN(interval) || !validIntervals.includes(interval)) {
            return { valid: false, error: `Please enter one of: ${validIntervals.join(', ')}` };
          }
          return { valid: true };
        }
      }
    );

    if (!intervalResult.success) {
      return;
    }

    const interval = parseInt(intervalResult.value);

    // Set up trigger
    const result = AUTOPUBLISH_setupTrigger(interval);
    HELPER_showSuccess('Auto-Publish Enabled', result);

  } catch (e) {
    HELPER_showError('Enable Auto-Publish Failed', e, 'form');
    Logger.log(`ERROR in enableAutoPublish: ${e.message}\n${e.stack}`);
  }
}

/**
 * Menu wrapper: Disable auto-publish.
 */
function disableAutoPublish() {
  try {
    const confirmed = HELPER_confirmAction(
      'Disable Auto-Publish',
      'This will stop automatic publishing to the public spreadsheet.\n\n' +
      'You\'ll need to manually publish schedules using the sidebar.',
      { type: 'warning' }
    );

    if (!confirmed) {
      return;
    }

    const result = AUTOPUBLISH_removeTrigger();
    HELPER_showSuccess('Auto-Publish Disabled', result);

  } catch (e) {
    HELPER_showError('Disable Auto-Publish Failed', e, 'form');
    Logger.log(`ERROR in disableAutoPublish: ${e.message}\n${e.stack}`);
  }
}

/**
 * Menu wrapper: Show auto-publish status.
 */
function showAutoPublishStatus() {
  try {
    const status = AUTOPUBLISH_getStatus();

    let message = '';
    let type = 'info';

    if (status.enabled && status.triggerExists) {
      message = `✅ Enabled - Publishing every ${status.interval} minutes\n\n` +
                `Your main schedule (all ministries) will automatically sync to the public spreadsheet. ` +
                `Individual ministry schedules must be published manually.`;
      type = 'success';
    } else if (status.enabled && !status.triggerExists) {
      message = `⚠️ Config says enabled, but no trigger found.\n\n` +
                `Use "Enable Auto-Publish" to fix this.`;
      type = 'warning';
    } else {
      message = `❌ Disabled\n\n` +
                `You must manually publish schedules using the sidebar.\n\n` +
                `Use "Enable Auto-Publish" to turn on automatic publishing.`;
      type = 'info';
    }

    HELPER_showAlert('Auto-Publish Status', message, type);

  } catch (e) {
    HELPER_showError('Status Check Failed', e, 'form');
    Logger.log(`ERROR in showAutoPublishStatus: ${e.message}\n${e.stack}`);
  }
}
