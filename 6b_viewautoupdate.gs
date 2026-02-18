/**
 * ====================================================================
 * AUTO-UPDATE VIEWS - DUAL MONTHLY VIEWS SYSTEM
 * ====================================================================
 * Automatically regenerates TWO monthly view sheets when the Assignments sheet changes:
 * - MonthlyView-Current (e.g., January 2026)
 * - MonthlyView-Next (e.g., February 2026)
 *
 * Uses onChange installable trigger (fires after batched changes).
 * Can be enabled/disabled via Admin Tools menu.
 *
 * Month Selection:
 * - Current month auto-calculated from today's date (not stored)
 * - Next month is current month + 1
 * - Ministry filter read from Config: "MonthlyView Ministry Filter"
 */

/**
 * Main onChange handler - automatically regenerates dual monthly views when Assignments changes.
 * This function is called by the installable onChange trigger.
 * @param {object} e - Change event object
 */
function AUTOVIEW_onChangeHandler(e) {
  try {
    Logger.log('Auto-update trigger fired');

    // Skip if this change was triggered by a view-sheet write-back (onEdit → Assignments).
    // The write-back sets a timestamp property; if it's recent (< 30 s), skip regeneration.
    try {
      const writebackTs = PropertiesService.getScriptProperties()
        .getProperty('VIEWEDIT_WRITEBACK_TS');
      if (writebackTs) {
        const elapsedMs = Date.now() - parseInt(writebackTs, 10);
        PropertiesService.getScriptProperties().deleteProperty('VIEWEDIT_WRITEBACK_TS');
        if (elapsedMs < 30000) {
          Logger.log(`Skipping auto-update: triggered by view write-back ${elapsedMs}ms ago`);
          return;
        }
      }
    } catch (propErr) {
      Logger.log(`Warning: Could not read write-back flag: ${propErr.message}`);
    }

    // Check if auto-update is enabled in Config
    const isEnabled = AUTOVIEW_getConfigValue('Auto-Update Views Enabled');
    if (!isEnabled) {
      Logger.log('Auto-update is disabled in Config, skipping');
      return;
    }

    // Check if the change was to Assignments sheet
    if (e && e.changeType) {
      Logger.log(`Change type: ${e.changeType}`);
    }

    // Calculate current and next months
    const monthStrings = AUTOVIEW_calculateCurrentAndNextMonths();
    Logger.log(`Auto-updating dual monthly views: ${monthStrings.current} and ${monthStrings.next}`);

    // Get ministry filter from Config
    const ministryFilter = AUTOVIEW_getMinistryFilter();
    Logger.log(`Ministry filter: ${ministryFilter || 'All Ministries'}`);

    // Track which views were updated
    const updatedViews = [];
    const errors = [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Regenerate MonthlyView-Current
    try {
      Logger.log(`Regenerating MonthlyView-Current for ${monthStrings.currentDisplay}...`);

      const options = {
        sheetName: 'MonthlyView-Current'
      };

      // Add ministry filter if specified
      if (ministryFilter && ministryFilter !== 'All Ministries') {
        options.ministryFilter = [ministryFilter];
      }

      generatePrintableSchedule(monthStrings.current, options);
      updatedViews.push('MonthlyView-Current');
      Logger.log('✅ MonthlyView-Current updated');
    } catch (e) {
      Logger.log(`⚠️ Failed to update MonthlyView-Current: ${e.message}`);
      errors.push(`MonthlyView-Current: ${e.message}`);
    }

    // 2. Regenerate MonthlyView-Next
    try {
      Logger.log(`Regenerating MonthlyView-Next for ${monthStrings.nextDisplay}...`);

      const options = {
        sheetName: 'MonthlyView-Next'
      };

      // Add ministry filter if specified
      if (ministryFilter && ministryFilter !== 'All Ministries') {
        options.ministryFilter = [ministryFilter];
      }

      generatePrintableSchedule(monthStrings.next, options);
      updatedViews.push('MonthlyView-Next');
      Logger.log('✅ MonthlyView-Next updated');
    } catch (e) {
      Logger.log(`⚠️ Failed to update MonthlyView-Next: ${e.message}`);
      errors.push(`MonthlyView-Next: ${e.message}`);
    }

    // 3. Regenerate WeeklyView if it exists (unchanged logic)
    const weeklyViewSheet = ss.getSheetByName('WeeklyView');
    if (weeklyViewSheet) {
      try {
        Logger.log('Regenerating WeeklyView...');
        generateWeeklyView(null, { sheetName: 'WeeklyView' });
        updatedViews.push('WeeklyView');
        Logger.log('✅ WeeklyView updated');
      } catch (e) {
        Logger.log(`⚠️ Failed to update WeeklyView: ${e.message}`);
        errors.push(`WeeklyView: ${e.message}`);
      }
    }

    // Log summary
    if (updatedViews.length > 0) {
      Logger.log(`Auto-update complete: ${updatedViews.join(', ')}`);
    } else {
      Logger.log('No views were updated');
    }

    if (errors.length > 0) {
      Logger.log(`Auto-update completed with errors: ${errors.join('; ')}`);
    }

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_onChangeHandler: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    // Don't throw - we don't want to disrupt the user's workflow
  }
}

/**
 * Calculates current and next month strings based on today's date.
 * @returns {object} Object with current and next month strings and display names
 */
function AUTOVIEW_calculateCurrentAndNextMonths() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Current month string
  const currentMonthString = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  const currentDisplay = HELPER_formatDate(new Date(currentYear, currentMonth - 1, 1), 'month-year');

  // Next month calculation (handle year boundary)
  let nextYear = currentYear;
  let nextMonth = currentMonth + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  const nextMonthString = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
  const nextDisplay = HELPER_formatDate(new Date(nextYear, nextMonth - 1, 1), 'month-year');

  return {
    current: currentMonthString,
    next: nextMonthString,
    currentDisplay: currentDisplay,
    nextDisplay: nextDisplay
  };
}

/**
 * Gets the ministry filter from Config (defaults to null = All Ministries).
 * @returns {string|null} Ministry name or null for all ministries
 */
function AUTOVIEW_getMinistryFilter() {
  const filter = AUTOVIEW_getConfigValue('MonthlyView Ministry Filter');

  // Validate filter exists in Ministries sheet
  if (filter && filter !== 'All Ministries') {
    try {
      const ministries = getActiveMinistries();
      if (!ministries.includes(filter)) {
        Logger.log(`Warning: Configured ministry filter "${filter}" not found in Ministries sheet. Falling back to All Ministries.`);
        return null;
      }
    } catch (e) {
      Logger.log(`Warning: Could not validate ministry filter: ${e.message}. Falling back to All Ministries.`);
      return null;
    }
  }

  return (filter === 'All Ministries' || !filter) ? null : filter;
}

/**
 * Sets up the auto-update trigger and performs first-time migration.
 * Creates an installable onChange trigger that fires when the spreadsheet changes.
 * @returns {string} Success message
 */
function AUTOVIEW_setupTrigger() {
  try {
    // First, remove any existing auto-update triggers
    AUTOVIEW_removeTrigger();

    // Perform one-time migration of old MonthlyView sheet
    AUTOVIEW_migrateOldMonthlyView();

    // Create new onChange trigger
    ScriptApp.newTrigger('AUTOVIEW_onChangeHandler')
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onChange()
      .create();

    Logger.log('Auto-update trigger created');

    // Enable auto-update in Config
    AUTOVIEW_setConfigValue('Auto-Update Views Enabled', true);

    // Set default ministry filter if not already set
    const currentFilter = AUTOVIEW_getConfigValue('MonthlyView Ministry Filter');
    if (!currentFilter) {
      AUTOVIEW_setConfigValue('MonthlyView Ministry Filter', 'All Ministries');
      Logger.log('Set default ministry filter to All Ministries');
    }

    // Generate both monthly views immediately
    const monthStrings = AUTOVIEW_calculateCurrentAndNextMonths();
    const ministryFilter = AUTOVIEW_getMinistryFilter();

    const options = {};
    if (ministryFilter) {
      options.ministryFilter = [ministryFilter];
    }

    // Generate Current month
    try {
      generatePrintableSchedule(monthStrings.current, { ...options, sheetName: 'MonthlyView-Current' });
      Logger.log(`Generated MonthlyView-Current for ${monthStrings.currentDisplay}`);
    } catch (e) {
      Logger.log(`Warning: Could not generate MonthlyView-Current: ${e.message}`);
    }

    // Generate Next month
    try {
      generatePrintableSchedule(monthStrings.next, { ...options, sheetName: 'MonthlyView-Next' });
      Logger.log(`Generated MonthlyView-Next for ${monthStrings.nextDisplay}`);
    } catch (e) {
      Logger.log(`Warning: Could not generate MonthlyView-Next: ${e.message}`);
    }

    return '✅ Auto-update enabled!\n\n' +
           `MonthlyView-Current (${monthStrings.currentDisplay}) and MonthlyView-Next (${monthStrings.nextDisplay}) will automatically regenerate when assignments change.\n\n` +
           `Ministry filter: ${ministryFilter || 'All Ministries'}`;

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_setupTrigger: ${e.message}`);
    throw new Error(`Could not set up auto-update: ${e.message}`);
  }
}

/**
 * Migrates the old single MonthlyView sheet to MonthlyView-OLD-BACKUP.
 * Only runs once - if backup already exists, does nothing.
 */
function AUTOVIEW_migrateOldMonthlyView() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const oldSheet = ss.getSheetByName('MonthlyView');
    const backupSheet = ss.getSheetByName('MonthlyView-OLD-BACKUP');

    if (oldSheet && !backupSheet) {
      // Rename old MonthlyView to backup
      oldSheet.setName('MonthlyView-OLD-BACKUP');
      Logger.log('Migrated old MonthlyView sheet to MonthlyView-OLD-BACKUP');
    } else if (oldSheet && backupSheet) {
      // Both exist - delete the old MonthlyView (backup already exists)
      ss.deleteSheet(oldSheet);
      Logger.log('Deleted MonthlyView sheet (backup already existed)');
    } else {
      Logger.log('No migration needed - old MonthlyView sheet not found');
    }
  } catch (e) {
    Logger.log(`Warning: Could not migrate old MonthlyView sheet: ${e.message}`);
    // Non-fatal - continue setup
  }
}

/**
 * Removes the auto-update trigger.
 * @returns {string} Success message
 */
function AUTOVIEW_removeTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'AUTOVIEW_onChangeHandler') {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
      }
    }

    Logger.log(`Removed ${removedCount} auto-update trigger(s)`);

    // Disable in Config
    AUTOVIEW_setConfigValue('Auto-Update Views Enabled', false);

    if (removedCount > 0) {
      return `✅ Auto-update disabled.\n\nRemoved ${removedCount} trigger(s). Views will no longer update automatically.`;
    } else {
      return 'No auto-update triggers found.';
    }

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_removeTrigger: ${e.message}`);
    throw new Error(`Could not remove auto-update trigger: ${e.message}`);
  }
}

/**
 * Gets the current auto-update status.
 * @returns {object} Status information
 */
function AUTOVIEW_getStatus() {
  try {
    const configEnabled = AUTOVIEW_getConfigValue('Auto-Update Views Enabled');

    // Check for actual trigger
    const triggers = ScriptApp.getProjectTriggers();
    let triggerExists = false;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'AUTOVIEW_onChangeHandler') {
        triggerExists = true;
        break;
      }
    }

    // Check which views exist
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hasMonthlyViewCurrent = ss.getSheetByName('MonthlyView-Current') !== null;
    const hasMonthlyViewNext = ss.getSheetByName('MonthlyView-Next') !== null;
    const hasWeeklyView = ss.getSheetByName('WeeklyView') !== null;

    // Get current month info
    const monthStrings = AUTOVIEW_calculateCurrentAndNextMonths();

    // Get ministry filter
    const ministryFilter = AUTOVIEW_getConfigValue('MonthlyView Ministry Filter') || 'All Ministries';

    return {
      enabled: configEnabled && triggerExists,
      configEnabled: configEnabled,
      triggerExists: triggerExists,
      hasMonthlyViewCurrent: hasMonthlyViewCurrent,
      hasMonthlyViewNext: hasMonthlyViewNext,
      hasWeeklyView: hasWeeklyView,
      currentMonth: monthStrings.currentDisplay,
      nextMonth: monthStrings.nextDisplay,
      ministryFilter: ministryFilter
    };

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_getStatus: ${e.message}`);
    return {
      enabled: false,
      configEnabled: false,
      triggerExists: false,
      hasMonthlyViewCurrent: false,
      hasMonthlyViewNext: false,
      hasWeeklyView: false,
      error: e.message
    };
  }
}

/**
 * Helper: Gets a config value.
 * @param {string} settingName - The setting name
 * @returns {*} The config value, or null if not found
 */
function AUTOVIEW_getConfigValue(settingName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);

    if (!configSheet) {
      return null;
    }

    const configData = configSheet.getDataRange().getValues();

    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === settingName) {
        return configData[i][1];
      }
    }

    return null;

  } catch (e) {
    Logger.log(`ERROR reading config value ${settingName}: ${e.message}`);
    return null;
  }
}

/**
 * Helper: Sets a config value.
 * @param {string} settingName - The setting name
 * @param {*} value - The value to set
 */
function AUTOVIEW_setConfigValue(settingName, value) {
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
    Logger.log(`ERROR setting config value ${settingName}: ${e.message}`);
  }
}

// =============================================================================
// MENU FUNCTIONS (called from 0_code.gs)
// =============================================================================

/**
 * Menu function: Enable auto-update with user prompt.
 */
function enableAutoUpdateViews() {
  const ui = SpreadsheetApp.getUi();

  try {
    // Show confirmation
    const monthStrings = AUTOVIEW_calculateCurrentAndNextMonths();
    const response = ui.alert(
      'Enable Auto-Update Views?',
      `This will automatically regenerate MonthlyView-Current (${monthStrings.currentDisplay}) and MonthlyView-Next (${monthStrings.nextDisplay}) whenever assignments change.\n\n` +
      `⚠️ Note: Auto-update can be resource-intensive if you make frequent changes.\n\n` +
      `Enable auto-update?`,
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      const result = AUTOVIEW_setupTrigger();
      ui.alert('Auto-Update Enabled', result, ui.ButtonSet.OK);
    }

  } catch (e) {
    Logger.log(`ERROR in enableAutoUpdateViews: ${e.message}\n${e.stack}`);
    ui.alert(
      'Error',
      `Could not enable auto-update:\n\n${e.message}`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Menu function: Disable auto-update with confirmation.
 */
function disableAutoUpdateViews() {
  const ui = SpreadsheetApp.getUi();

  try {
    const response = ui.alert(
      'Disable Auto-Update Views?',
      'MonthlyView-Current and MonthlyView-Next will no longer update automatically.\n\n' +
      'You can still regenerate them manually from the sidebar.\n\n' +
      'Disable auto-update?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      const result = AUTOVIEW_removeTrigger();
      ui.alert('Auto-Update Disabled', result, ui.ButtonSet.OK);
    }

  } catch (e) {
    Logger.log(`ERROR in disableAutoUpdateViews: ${e.message}\n${e.stack}`);
    ui.alert(
      'Error',
      `Could not disable auto-update:\n\n${e.message}`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Menu function: Show auto-update status.
 */
function showAutoUpdateViewsStatus() {
  const ui = SpreadsheetApp.getUi();

  try {
    const status = AUTOVIEW_getStatus();

    let message = '📊 AUTO-UPDATE STATUS\n\n';

    if (status.error) {
      message += `❌ Error: ${status.error}`;
    } else {
      message += `Status: ${status.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n`;
      message += `Currently Displaying:\n`;
      message += `• Current: ${status.currentMonth}\n`;
      message += `• Next: ${status.nextMonth}\n\n`;
      message += `Ministry Filter: ${status.ministryFilter}\n\n`;
      message += `Views Found:\n`;
      message += `• MonthlyView-Current: ${status.hasMonthlyViewCurrent ? '✅ Exists' : '❌ Not found'}\n`;
      message += `• MonthlyView-Next: ${status.hasMonthlyViewNext ? '✅ Exists' : '❌ Not found'}\n`;
      message += `• WeeklyView: ${status.hasWeeklyView ? '✅ Exists' : '❌ Not found'}\n\n`;

      if (status.enabled) {
        message += `Auto-update is active. Views will regenerate when assignments change.`;
      } else {
        message += `Auto-update is disabled. Use the sidebar to regenerate views manually.`;
      }

      // Debug info
      if (status.configEnabled !== status.triggerExists) {
        message += `\n\n⚠️ Debug: Config=${status.configEnabled}, Trigger=${status.triggerExists}`;
      }
    }

    ui.alert('Auto-Update Status', message, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(`ERROR in showAutoUpdateViewsStatus: ${e.message}\n${e.stack}`);
    ui.alert(
      'Error',
      `Could not check auto-update status:\n\n${e.message}`,
      ui.ButtonSet.OK
    );
  }
}