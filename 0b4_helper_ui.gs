/**
 * ====================================================================
 * HELPER FUNCTIONS - USER INTERFACE & NOTIFICATIONS
 * ====================================================================
 *
 * PURPOSE:
 * Provides standardized user interface functions for dialogs, alerts,
 * confirmations, prompts, and error messages. Ensures consistent UX
 * across the entire application.
 *
 * FUNCTIONS IN THIS FILE:
 * - Alert dialogs (showAlert, showSuccess, showError)
 * - Confirmation dialogs (confirmAction)
 * - User input prompts (promptUser)
 * - Validation reports (showValidationReport)
 * - Error troubleshooting hints (getErrorTroubleshootingHints)
 *
 * DEPENDENCIES:
 * - Google Apps Script UI (SpreadsheetApp.getUi())
 * - No other helper dependencies
 *
 * USED BY:
 * - All modules that interact with users
 * - Menu functions (0_code.gs)
 * - Validation functions (0c_validation.gs)
 * - All major workflows
 *
 * DECISION TREE - Add new functions here if they:
 * ✅ Show dialogs or alerts to users
 * ✅ Collect user input via prompts
 * ✅ Display validation results
 * ✅ Format error messages for users
 * ❌ Read sheet data → Use 0b1_helper_data.gs
 * ❌ Validate data logic → Use 0b2_helper_ministry.gs or 0c_validation.gs
 * ❌ Format dates/times → Use 0b3_helper_formatting.gs
 *
 * LOADING ORDER: Fourth helper file (loads after 0b1, 0b2, 0b3)
 * ====================================================================
 */

/**
 * Show a standardized alert/info dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message (supports line breaks with \n)
 * @param {string} type - Optional type: 'info', 'success', 'warning', 'error' (default: 'info')
 * @returns {void}
 */
function HELPER_showAlert(title, message, type = 'info') {
  const ui = SpreadsheetApp.getUi();

  // Add emoji prefix based on type for visual clarity
  const prefixes = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  };

  const prefix = prefixes[type] || prefixes['info'];
  const formattedTitle = `${prefix} ${title}`;

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}

/**
 * Show a standardized confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {object} options - Optional configuration
 *   - type: 'warning', 'info', 'danger' (default: 'warning')
 *   - confirmText: Custom text for yes button (default: 'Yes')
 *   - cancelText: Custom text for no button (default: 'No')
 * @returns {boolean} true if user confirmed, false if canceled
 */
function HELPER_confirmAction(title, message, options = {}) {
  const ui = SpreadsheetApp.getUi();

  // Default options
  const type = options.type || 'warning';
  const confirmText = options.confirmText || 'Yes';
  const cancelText = options.cancelText || 'No';

  // Add emoji prefix based on type
  const prefixes = {
    'warning': '⚠️',
    'info': 'ℹ️',
    'danger': '🛑'
  };

  const prefix = prefixes[type] || prefixes['warning'];
  const formattedTitle = `${prefix} ${title}`;

  // Add instruction text at bottom
  const instruction = `\n────────────────────────────\nClick "${confirmText}" to proceed or "${cancelText}" to cancel.`;
  const formattedMessage = message + instruction;

  const response = ui.alert(formattedTitle, formattedMessage, ui.ButtonSet.YES_NO);

  return response === ui.Button.YES;
}

/**
 * Show a standardized user input prompt
 * @param {string} title - Dialog title
 * @param {string} message - Prompt message
 * @param {object} options - Optional configuration
 *   - defaultValue: Pre-filled default value
 *   - required: If true, rejects empty input (default: false)
 *   - validator: Function to validate input, returns {valid: boolean, error: string}
 * @returns {object} {success: boolean, value: string, cancelled: boolean}
 */
function HELPER_promptUser(title, message, options = {}) {
  const ui = SpreadsheetApp.getUi();

  const defaultValue = options.defaultValue || '';
  const required = options.required || false;
  const validator = options.validator || null;

  const formattedTitle = `📝 ${title}`;

  while (true) {
    const response = ui.prompt(formattedTitle, message, ui.ButtonSet.OK_CANCEL);

    // User cancelled
    if (response.getSelectedButton() !== ui.Button.OK) {
      return { success: false, value: '', cancelled: true };
    }

    const value = response.getResponseText().trim();

    // Check if required and empty
    if (required && value === '') {
      ui.alert('⚠️ Input Required', 'This field cannot be empty. Please enter a value.', ui.ButtonSet.OK);
      continue;
    }

    // Run custom validator if provided
    if (validator && value !== '') {
      const validation = validator(value);
      if (!validation.valid) {
        ui.alert('⚠️ Invalid Input', validation.error, ui.ButtonSet.OK);
        continue;
      }
    }

    return { success: true, value: value, cancelled: false };
  }
}

/**
 * Show a standardized error dialog with troubleshooting hints
 * @param {string} title - Error title
 * @param {string} error - Error message or Error object
 * @param {string} context - Context for troubleshooting hints (optional)
 *   - 'calendar', 'validation', 'schedule', 'assignment', 'timeoffs', 'print', 'form', 'archive'
 * @returns {void}
 */
function HELPER_showError(title, error, context = null) {
  const ui = SpreadsheetApp.getUi();

  // Extract error message from Error object if needed
  const errorMessage = (error instanceof Error) ? error.message : String(error);

  // Build troubleshooting hints based on context
  const hints = HELPER_getErrorTroubleshootingHints(context, errorMessage);

  const formattedTitle = `❌ ${title}`;

  let message = errorMessage;

  if (hints && hints.length > 0) {
    message += '\n\n📋 Troubleshooting Tips:\n';
    message += hints.map((hint, i) => `${i + 1}. ${hint}`).join('\n');
  }

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}

/**
 * Show a standardized success dialog
 * @param {string} title - Success title
 * @param {string} message - Success message
 * @param {object} options - Optional configuration
 *   - autoClose: Not supported in Apps Script, included for API consistency
 *   - showStats: If true and message contains numbers, formats nicely (default: false)
 * @returns {void}
 */
function HELPER_showSuccess(title, message, options = {}) {
  const ui = SpreadsheetApp.getUi();

  const formattedTitle = `✅ ${title}`;

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}

/**
 * Get context-specific troubleshooting hints for error messages
 * @param {string} context - Error context
 * @param {string} errorMessage - The error message
 * @returns {Array<string>} Array of troubleshooting hints
 */
function HELPER_getErrorTroubleshootingHints(context, errorMessage) {
  const hints = [];

  // Common hints based on error message patterns
  if (errorMessage.toLowerCase().includes('sheet') && errorMessage.toLowerCase().includes('not found')) {
    hints.push('Verify all required sheets exist in your spreadsheet');
    hints.push('Check sheet names match exactly (case-sensitive)');
  }

  if (errorMessage.toLowerCase().includes('config')) {
    hints.push('Check the Config sheet has all required settings');
    hints.push('Ensure "Year to Schedule" is set to a valid year (2020-2050)');
  }

  // Context-specific hints
  switch (context) {
    case 'calendar':
      hints.push('Run Admin Tools → Validate Data to check for configuration issues');
      hints.push('Verify the SaintsCalendar sheet has data for your calendar region');
      hints.push('Check that "Year to Schedule" in Config is set correctly');
      break;

    case 'validation':
      hints.push('Review the validation errors listed above');
      hints.push('Fix errors (❌) before warnings (⚠️) for best results');
      hints.push('Check the CLAUDE.md file for data requirements');
      break;

    case 'schedule':
      hints.push('Verify you have generated the liturgical calendar first');
      hints.push('Check that MassTemplates exist and have valid roles');
      hints.push('Ensure WeeklyMasses, MonthlyMasses, or YearlyMasses have entries');
      hints.push('Run Admin Tools → Validate Data to check mass configuration');
      break;

    case 'assignment':
      hints.push('Check that you have Active volunteers with the required ministry roles');
      hints.push('Verify the Ministries sheet has all roles used in your templates');
      hints.push('Generate the schedule for this month before assigning volunteers');
      hints.push('Run Admin Tools → Validate Data to check volunteer configuration');
      break;

    case 'timeoffs':
      hints.push('Verify the volunteer name matches exactly with the Volunteers sheet');
      hints.push('Check that dates are in the correct format');
      hints.push('Ensure the Timeoffs sheet has the correct column structure');
      hints.push('Review the timeoff type: "I CANNOT serve" vs "I can ONLY serve"');
      break;

    case 'print':
      hints.push('Ensure you have generated assignments for this month');
      hints.push('Check that the liturgical calendar exists for this date range');
      hints.push('Verify the Config sheet has Parish Name configured');
      break;

    case 'form':
      hints.push('Check that the Google Form is properly linked to the Timeoffs sheet');
      hints.push('Verify you have edit permissions for the form');
      hints.push('Ensure the form has the correct question structure');
      break;

    case 'archive':
      hints.push('Verify you have completed schedules to archive');
      hints.push('Check that you have permissions to create new files in Google Drive');
      hints.push('Ensure the source sheet has data in the expected format');
      break;
  }

  return hints;
}

/**
 * Show a multi-line validation report dialog
 * Specifically designed for displaying validation results with proper formatting
 * @param {string} title - Report title
 * @param {Array<object>} items - Array of validation items {type: 'error'|'warning'|'info', message: string}
 * @param {object} summary - Optional summary stats {errors: number, warnings: number}
 * @returns {void}
 */
function HELPER_showValidationReport(title, items, summary = null) {
  const ui = SpreadsheetApp.getUi();

  let message = '';

  // Add summary at top if provided
  if (summary) {
    const emoji = summary.errors > 0 ? '❌' : (summary.warnings > 0 ? '⚠️' : '✅');
    message += `${emoji} Validation Results:\n`;
    message += `Errors: ${summary.errors || 0} | Warnings: ${summary.warnings || 0}\n\n`;
  }

  // Group items by type
  const errors = items.filter(item => item.type === 'error');
  const warnings = items.filter(item => item.type === 'warning');
  const infos = items.filter(item => item.type === 'info');

  // Add errors
  if (errors.length > 0) {
    message += '❌ ERRORS (must fix):\n';
    errors.forEach((item, i) => {
      message += `${i + 1}. ${item.message}\n`;
    });
    message += '\n';
  }

  // Add warnings
  if (warnings.length > 0) {
    message += '⚠️ WARNINGS (recommended to fix):\n';
    warnings.forEach((item, i) => {
      message += `${i + 1}. ${item.message}\n`;
    });
    message += '\n';
  }

  // Add info items
  if (infos.length > 0) {
    message += 'ℹ️ INFO:\n';
    infos.forEach((item, i) => {
      message += `${i + 1}. ${item.message}\n`;
    });
  }

  // If no items, show success
  if (items.length === 0) {
    message = '✅ All validation checks passed!\n\nYour data is configured correctly and ready to use.';
  }

  const formattedTitle = summary && summary.errors > 0 ? `❌ ${title}` :
                        summary && summary.warnings > 0 ? `⚠️ ${title}` :
                        `✅ ${title}`;

  ui.alert(formattedTitle, message, ui.ButtonSet.OK);
}
