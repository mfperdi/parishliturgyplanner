/**
 * ====================================================================
 * AUTO-UPDATE VIEWS - AUTOMATICALLY REGENERATE MONTHLY/WEEKLY VIEWS
 * ====================================================================
 * Automatically regenerates MonthlyView and WeeklyView sheets when
 * the Assignments sheet changes.
 *
 * Uses onChange installable trigger (fires after batched changes).
 * Can be enabled/disabled via Admin Tools menu.
 *
 * Similar architecture to auto-publish system in 6_publicschedule.gs.
 */

/**
 * Main onChange handler - automatically regenerates views when Assignments changes.
 * This function is called by the installable onChange trigger.
 * @param {object} e - Change event object
 */
function AUTOVIEW_onChangeHandler(e) {
  try {
    Logger.log('Auto-update trigger fired');

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

    // Get current month from Config or use current date
    let monthString;
    try {
      const config = HELPER_readConfigSafe();
      const year = config['Year to Schedule'];
      const now = new Date();
      const month = now.getMonth() + 1; // 1-indexed
      monthString = `${year || now.getFullYear()}-${month.toString().padStart(2, '0')}`;
    } catch (e) {
      // Fallback to current month
      const now = new Date();
      monthString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    Logger.log(`Auto-updating views for month: ${monthString}`);

    // Track which views were updated
    const updatedViews = [];
    const errors = [];

    // 1. Check if MonthlyView exists and regenerate it
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const monthlyViewSheet = ss.getSheetByName('MonthlyView');

    if (monthlyViewSheet) {
      try {
        Logger.log('Regenerating MonthlyView...');
        generatePrintableSchedule(monthString, { sheetName: 'MonthlyView' });
        updatedViews.push('MonthlyView');
        Logger.log('✅ MonthlyView updated');
      } catch (e) {
        Logger.log(`⚠️ Failed to update MonthlyView: ${e.message}`);
        errors.push(`MonthlyView: ${e.message}`);
      }
    }

    // 2. Check if WeeklyView exists and regenerate it
    const weeklyViewSheet = ss.getSheetByName('WeeklyView');

    if (weeklyViewSheet) {
      try {
        Logger.log('Regenerating WeeklyView...');
        // Regenerate for current week (no specific date = current week)
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
      Logger.log('No views found to update (MonthlyView and WeeklyView do not exist)');
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
 * Sets up the auto-update trigger.
 * Creates an installable onChange trigger that fires when the spreadsheet changes.
 * @returns {string} Success message
 */
function AUTOVIEW_setupTrigger() {
  try {
    // First, remove any existing auto-update triggers
    AUTOVIEW_removeTrigger();

    // Create new onChange trigger
    ScriptApp.newTrigger('AUTOVIEW_onChangeHandler')
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onChange()
      .create();

    Logger.log('Auto-update trigger created');

    // Enable auto-update in Config
    AUTOVIEW_setConfigValue('Auto-Update Views Enabled', true);

    return '✅ Auto-update enabled!\n\n' +
           'MonthlyView and WeeklyView will automatically regenerate when assignments change.\n\n' +
           'Note: Only views that already exist will be updated.';

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_setupTrigger: ${e.message}`);
    throw new Error(`Could not set up auto-update: ${e.message}`);
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
    const hasMonthlyView = ss.getSheetByName('MonthlyView') !== null;
    const hasWeeklyView = ss.getSheetByName('WeeklyView') !== null;

    return {
      enabled: configEnabled && triggerExists,
      configEnabled: configEnabled,
      triggerExists: triggerExists,
      hasMonthlyView: hasMonthlyView,
      hasWeeklyView: hasWeeklyView
    };

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_getStatus: ${e.message}`);
    return {
      enabled: false,
      configEnabled: false,
      triggerExists: false,
      hasMonthlyView: false,
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
    // Check which views exist
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hasMonthlyView = ss.getSheetByName('MonthlyView') !== null;
    const hasWeeklyView = ss.getSheetByName('WeeklyView') !== null;

    if (!hasMonthlyView && !hasWeeklyView) {
      ui.alert(
        'No Views Found',
        'MonthlyView and WeeklyView sheets do not exist yet.\n\n' +
        'Generate these views first using the sidebar:\n' +
        '• Step 8: Print Schedule (creates MonthlyView)\n' +
        '• Step 9: Weekly View (creates WeeklyView)\n\n' +
        'Then enable auto-update.',
        ui.ButtonSet.OK
      );
      return;
    }

    // Show confirmation
    let viewsList = [];
    if (hasMonthlyView) viewsList.push('MonthlyView');
    if (hasWeeklyView) viewsList.push('WeeklyView');

    const response = ui.alert(
      'Enable Auto-Update Views?',
      `This will automatically regenerate ${viewsList.join(' and ')} whenever assignments change.\n\n` +
      '⚠️ Note: Auto-update can be resource-intensive if you make frequent changes.\n\n' +
      'Enable auto-update?',
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
      'MonthlyView and WeeklyView will no longer update automatically.\n\n' +
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
      message += `Views Found:\n`;
      message += `• MonthlyView: ${status.hasMonthlyView ? '✅ Exists' : '❌ Not found'}\n`;
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
