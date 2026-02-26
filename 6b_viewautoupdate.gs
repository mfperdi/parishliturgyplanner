/**
 * ====================================================================
 * AUTO-UPDATE VIEWS SYSTEM
 * ====================================================================
 * Automatically regenerates MonthlyView and WeeklyView sheets whenever
 * the Assignments sheet changes. Uses an installable onChange trigger.
 *
 * Setup:
 *   Admin Tools → Auto-Update Views → Enable Auto-Update
 *
 * The trigger fires after batched changes (not on every keystroke),
 * so it works for both manual edits and script-generated updates.
 * Only regenerates views that already exist (non-intrusive).
 * Errors are logged silently so they don't disrupt the user's workflow.
 */

/**
 * Core handler called by the installable onChange trigger.
 * Regenerates MonthlyView and/or WeeklyView if they exist and auto-update is enabled.
 * @param {Object} e The onChange event object from Apps Script.
 */
function AUTOVIEW_onChangeHandler(e) {
  try {
    Logger.log('=== Auto-Update Views: onChange fired ===');

    // Check if auto-update is enabled in Config
    const config = HELPER_readConfigSafe();
    const enabled = config['Auto-Update Views Enabled'];

    if (enabled !== true && enabled !== 'TRUE' && enabled !== 'Yes') {
      Logger.log('Auto-Update Views is disabled in Config. Skipping.');
      return;
    }

    // Get current month from Config
    const monthString = config['Current Month'] || null;
    if (!monthString) {
      Logger.log('Auto-Update Views: No "Current Month" set in Config. Skipping.');
      return;
    }

    // Validate month string format
    let year, month;
    try {
      const parsed = HELPER_validateMonthString(monthString);
      year = parsed.year;
      month = parsed.month;
    } catch (validationError) {
      Logger.log(`Auto-Update Views: Invalid month "${monthString}" in Config: ${validationError.message}`);
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = [];

    // Regenerate MonthlyView if it exists
    const monthlyViewSheet = ss.getSheetByName('MonthlyView');
    if (monthlyViewSheet) {
      try {
        Logger.log(`Auto-Update Views: Regenerating MonthlyView for ${monthString}...`);
        generatePrintableSchedule(monthString, { sheetName: 'MonthlyView' });
        results.push('MonthlyView ✓');
        Logger.log('Auto-Update Views: MonthlyView regenerated successfully.');
      } catch (monthlyErr) {
        results.push('MonthlyView ✗');
        Logger.log(`Auto-Update Views: Error regenerating MonthlyView: ${monthlyErr.message}`);
      }
    } else {
      Logger.log('Auto-Update Views: MonthlyView does not exist. Skipping.');
    }

    // Regenerate WeeklyView if it exists
    const weeklyViewSheet = ss.getSheetByName('WeeklyView');
    if (weeklyViewSheet) {
      try {
        Logger.log(`Auto-Update Views: Regenerating WeeklyView for ${monthString}...`);
        generateWeeklyView(null, { sheetName: 'WeeklyView' });
        results.push('WeeklyView ✓');
        Logger.log('Auto-Update Views: WeeklyView regenerated successfully.');
      } catch (weeklyErr) {
        results.push('WeeklyView ✗');
        Logger.log(`Auto-Update Views: Error regenerating WeeklyView: ${weeklyErr.message}`);
      }
    } else {
      Logger.log('Auto-Update Views: WeeklyView does not exist. Skipping.');
    }

    if (results.length > 0) {
      Logger.log(`Auto-Update Views complete: ${results.join(', ')}`);
    } else {
      Logger.log('Auto-Update Views: No existing views found to update.');
    }

  } catch (e) {
    // Log silently — do not throw, so the trigger does not spam error emails
    Logger.log(`ERROR in AUTOVIEW_onChangeHandler: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
  }
}

/**
 * Sets up the installable onChange trigger for auto-updating views.
 * Removes any existing AUTOVIEW triggers first to prevent duplicates.
 * @returns {string} Success message.
 */
function AUTOVIEW_setupTrigger() {
  try {
    // Remove any existing AUTOVIEW triggers first
    AUTOVIEW_removeTrigger();

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create new onChange trigger
    ScriptApp.newTrigger('AUTOVIEW_onChangeHandler')
      .forSpreadsheet(ss)
      .onChange()
      .create();

    Logger.log('AUTOVIEW: onChange trigger created successfully.');

    // Enable in Config
    AUTOVIEW_setConfigValue('Auto-Update Views Enabled', true);

    return '✅ Auto-Update Views enabled!\n\nMonthlyView and WeeklyView will automatically regenerate whenever the Assignments sheet changes.\n\nNote: Views must already exist (generate them manually first).';

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_setupTrigger: ${e.message}`);
    throw new Error(`Could not set up auto-update trigger: ${e.message}`);
  }
}

/**
 * Removes the installable onChange trigger for auto-updating views.
 * @returns {string} Success message.
 */
function AUTOVIEW_removeTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;

    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'AUTOVIEW_onChangeHandler') {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
      }
    }

    Logger.log(`AUTOVIEW: Removed ${removedCount} trigger(s).`);

    // Disable in Config
    AUTOVIEW_setConfigValue('Auto-Update Views Enabled', false);

    if (removedCount > 0) {
      return `✅ Auto-Update Views disabled.\n\nRemoved ${removedCount} trigger(s). Views will no longer auto-regenerate.`;
    } else {
      return 'No Auto-Update Views triggers were found to remove.';
    }

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_removeTrigger: ${e.message}`);
    throw new Error(`Could not remove auto-update trigger: ${e.message}`);
  }
}

/**
 * Helper: Writes a key/value pair to the Config sheet.
 * @param {string} settingName - The setting name (Column A).
 * @param {*} value - The value to write (Column B).
 */
function AUTOVIEW_setConfigValue(settingName, value) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG);

    if (!configSheet) {
      Logger.log('AUTOVIEW: Config sheet not found, cannot save setting.');
      return;
    }

    const data = configSheet.getDataRange().getValues();

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === settingName) {
        configSheet.getRange(i + 1, 2).setValue(value);
        Logger.log(`AUTOVIEW: Config updated — "${settingName}" = ${value}`);
        return;
      }
    }

    // Setting not found — append a new row
    configSheet.appendRow([settingName, value]);
    Logger.log(`AUTOVIEW: Config appended — "${settingName}" = ${value}`);

  } catch (e) {
    Logger.log(`WARNING: AUTOVIEW_setConfigValue could not update config: ${e.message}`);
  }
}

/**
 * Returns the current status of the auto-update views system.
 * @returns {Object} Status with enabled flag and triggerExists flag.
 */
function AUTOVIEW_getStatus() {
  try {
    const config = HELPER_readConfigSafe();
    const enabled = config['Auto-Update Views Enabled'];

    // Check if the trigger actually exists in the project
    const triggers = ScriptApp.getProjectTriggers();
    let triggerExists = false;

    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'AUTOVIEW_onChangeHandler') {
        triggerExists = true;
        break;
      }
    }

    return {
      enabled: enabled === true || enabled === 'TRUE' || enabled === 'Yes',
      triggerExists
    };

  } catch (e) {
    Logger.log(`ERROR in AUTOVIEW_getStatus: ${e.message}`);
    return { enabled: false, triggerExists: false };
  }
}

// ====================================================================
// MENU WRAPPERS
// ====================================================================

/**
 * Menu wrapper: Enable auto-update views.
 * Accessed via: Admin Tools → Auto-Update Views → Enable Auto-Update
 */
function enableAutoUpdateViews() {
  try {
    const confirmed = HELPER_confirmAction(
      'Enable Auto-Update Views',
      'This will automatically regenerate MonthlyView and WeeklyView whenever the Assignments sheet changes.\n\n' +
      'Requirements:\n' +
      '• MonthlyView and/or WeeklyView sheets must already exist\n' +
      '• "Current Month" must be set in the Config sheet\n\n' +
      'Performance note: Each view takes 5–10 seconds to regenerate. Disable during bulk editing sessions.',
      { confirmLabel: 'Enable', type: 'default' }
    );

    if (!confirmed) {
      Logger.log('enableAutoUpdateViews: User cancelled.');
      return;
    }

    const result = AUTOVIEW_setupTrigger();
    HELPER_showSuccess('Auto-Update Views Enabled', result);

  } catch (e) {
    HELPER_showError('Enable Auto-Update Views Failed', e, 'schedule');
    Logger.log(`ERROR in enableAutoUpdateViews: ${e.message}\n${e.stack}`);
  }
}

/**
 * Menu wrapper: Disable auto-update views.
 * Accessed via: Admin Tools → Auto-Update Views → Disable Auto-Update
 */
function disableAutoUpdateViews() {
  try {
    const confirmed = HELPER_confirmAction(
      'Disable Auto-Update Views',
      'This will stop MonthlyView and WeeklyView from auto-regenerating.\n\nYou can still regenerate them manually from the sidebar.',
      { confirmLabel: 'Disable', type: 'default' }
    );

    if (!confirmed) {
      Logger.log('disableAutoUpdateViews: User cancelled.');
      return;
    }

    const result = AUTOVIEW_removeTrigger();
    HELPER_showSuccess('Auto-Update Views Disabled', result);

  } catch (e) {
    HELPER_showError('Disable Auto-Update Views Failed', e, 'schedule');
    Logger.log(`ERROR in disableAutoUpdateViews: ${e.message}\n${e.stack}`);
  }
}

/**
 * Menu wrapper: Show current auto-update views status.
 * Accessed via: Admin Tools → Auto-Update Views → Auto-Update Status
 */
function showAutoUpdateViewsStatus() {
  try {
    const status = AUTOVIEW_getStatus();

    let message = '';
    let type = 'info';

    if (status.enabled && status.triggerExists) {
      message = '✅ Enabled — Views will auto-regenerate on Assignments changes.\n\n' +
                'MonthlyView and WeeklyView regenerate automatically whenever a change is detected.\n\n' +
                'To stop: Admin Tools → Auto-Update Views → Disable Auto-Update';
      type = 'success';
    } else if (status.enabled && !status.triggerExists) {
      message = '⚠️ Config says Enabled, but no trigger was found.\n\n' +
                'The trigger may have been deleted manually in the Apps Script editor.\n\n' +
                'To fix: Admin Tools → Auto-Update Views → Enable Auto-Update';
      type = 'warning';
    } else if (!status.enabled && status.triggerExists) {
      message = '⚠️ Trigger exists but Config says Disabled.\n\n' +
                'The trigger is still active but the handler will skip regeneration.\n\n' +
                'To fix: Admin Tools → Auto-Update Views → Disable Auto-Update (to clean up the trigger), then re-enable if needed.';
      type = 'warning';
    } else {
      message = 'ℹ️ Disabled — Views must be regenerated manually from the sidebar.\n\n' +
                'To enable: Admin Tools → Auto-Update Views → Enable Auto-Update';
      type = 'info';
    }

    HELPER_showAlert('Auto-Update Views Status', message, type);

  } catch (e) {
    HELPER_showError('Status Check Failed', e, 'schedule');
    Logger.log(`ERROR in showAutoUpdateViewsStatus: ${e.message}\n${e.stack}`);
  }
}
