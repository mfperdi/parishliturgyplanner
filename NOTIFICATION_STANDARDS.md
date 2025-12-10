# Notification Standards - Parish Liturgical Scheduler

## Overview

This document defines standardized notification patterns for consistent user experience across the Parish Liturgical Scheduler codebase.

**Purpose**: Ensure all user-facing notifications (dialogs, alerts, prompts, sidebar messages) follow consistent formatting, tone, and behavior patterns.

**Last Updated**: 2025-12-10

---

## Notification Architecture

### Two-Tier System

The codebase uses a **hybrid notification approach** that respects the existing architecture:

1. **Sidebar Notifications** (HTML/JavaScript in `Sidebar.html`)
   - **Purpose**: Primary user workflow feedback
   - **When**: Operations triggered from the sidebar UI
   - **Characteristics**: Modern, context-aware, auto-hiding success messages, loading spinners
   - **Examples**: Calendar generation, schedule creation, auto-assignment

2. **Dialog Notifications** (Google Apps Script UI in `.gs` files)
   - **Purpose**: Admin tools, menu operations, confirmations
   - **When**: Operations triggered from menu or requiring explicit confirmation
   - **Characteristics**: Standard Google Sheets dialogs, require manual dismissal
   - **Examples**: Archive operations, data validation, public schedule publishing

---

## Helper Functions Reference

All notification helper functions are located in `/home/user/parishliturgyplanner/0b_helper.gs` (lines 824-1124).

### 1. `HELPER_showAlert(title, message, type)`

**Purpose**: Display informational alerts with consistent formatting

**Parameters**:
- `title` (string): Dialog title
- `message` (string): Message content (supports `\n` for line breaks)
- `type` (string): Optional - 'info', 'success', 'warning', 'error' (default: 'info')

**Returns**: void

**Example**:
```javascript
HELPER_showAlert(
  'Configuration Saved',
  'Your settings have been updated successfully.',
  'success'
);
```

**Visual Format**:
- Title has emoji prefix based on type (ℹ️ 📋 ⚠️ ❌ ✅)
- Single OK button
- Non-blocking (user must dismiss)

**When to Use**:
- Informational messages that don't require action
- Success confirmations
- Non-critical warnings
- Error messages (use `HELPER_showError()` for errors with troubleshooting)

---

### 2. `HELPER_confirmAction(title, message, options)`

**Purpose**: Display confirmation dialogs with YES/NO options

**Parameters**:
- `title` (string): Dialog title
- `message` (string): Confirmation question/context
- `options` (object): Optional configuration
  - `type`: 'warning', 'info', 'danger' (default: 'warning')
  - `confirmText`: Custom yes button text (default: 'Yes')
  - `cancelText`: Custom no button text (default: 'No')

**Returns**: boolean (true if confirmed, false if cancelled)

**Example**:
```javascript
const confirmed = HELPER_confirmAction(
  'Regenerate Calendar',
  'This will clear the existing liturgical calendar for the entire year. All manual adjustments will be lost.',
  { type: 'danger' }
);

if (confirmed) {
  // Proceed with destructive operation
}
```

**Visual Format**:
- Title has emoji prefix (⚠️ = warning, ℹ️ = info, 🛑 = danger)
- Instruction text at bottom explaining YES/NO options
- Horizontal line separator before instructions

**When to Use**:
- Before destructive operations (delete, clear, regenerate)
- Before operations that can't be easily undone
- When user needs to explicitly opt-in
- When there are significant consequences to the action

---

### 3. `HELPER_promptUser(title, message, options)`

**Purpose**: Collect user input with validation

**Parameters**:
- `title` (string): Dialog title
- `message` (string): Prompt question/instructions
- `options` (object): Optional configuration
  - `defaultValue`: Pre-filled value
  - `required`: If true, rejects empty input (default: false)
  - `validator`: Function that returns `{valid: boolean, error: string}`

**Returns**: object `{success: boolean, value: string, cancelled: boolean}`

**Example**:
```javascript
const result = HELPER_promptUser(
  'Archive Interval',
  'Enter the number of months to archive (1-12):',
  {
    required: true,
    validator: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 1 || num > 12) {
        return { valid: false, error: 'Please enter a number between 1 and 12.' };
      }
      return { valid: true };
    }
  }
);

if (result.success) {
  const months = parseInt(result.value);
  // Proceed with operation
} else if (result.cancelled) {
  // User cancelled
}
```

**Visual Format**:
- Title has 📝 emoji prefix
- Text input field
- OK/CANCEL buttons
- Loops until valid input or cancellation

**When to Use**:
- Collecting month selection
- Collecting numeric intervals (e.g., archive months)
- Collecting file names or identifiers
- Any operation requiring user input beyond YES/NO

**Validation Best Practices**:
- Always validate critical inputs (dates, numbers, IDs)
- Provide clear error messages in validator
- Use `required: true` for mandatory fields
- Loop until valid or cancelled (built-in)

---

### 4. `HELPER_showError(title, error, context)`

**Purpose**: Display errors with context-specific troubleshooting hints

**Parameters**:
- `title` (string): Error title
- `error` (string or Error object): Error message
- `context` (string): Optional context for hints
  - Contexts: 'calendar', 'validation', 'schedule', 'assignment', 'timeoffs', 'print', 'form', 'archive'

**Returns**: void

**Example**:
```javascript
try {
  const result = SCHEDULE_generateScheduleForMonth(monthString);
  return result;
} catch (e) {
  HELPER_showError('Schedule Generation Failed', e, 'schedule');
  throw e; // Re-throw for logging
}
```

**Visual Format**:
- Title: ❌ prefix
- Error message first
- Blank line separator
- 📋 Troubleshooting Tips: numbered list
- Context-specific hints (3-5 items)

**Troubleshooting Hint Categories**:

1. **Common hints** (appear automatically):
   - Sheet not found errors
   - Config-related errors

2. **Context-specific hints**:
   - `'calendar'`: Config issues, SaintsCalendar data, year validation
   - `'schedule'`: Calendar prerequisite, templates, mass configuration
   - `'assignment'`: Volunteer data, ministry roles, schedule prerequisite
   - `'timeoffs'`: Volunteer names, date formats, form structure
   - `'print'`: Assignment data, liturgical calendar, parish config
   - `'form'`: Google Form permissions, form structure
   - `'archive'`: Source data, Drive permissions, data format
   - `'validation'`: Fix priorities, data requirements

**When to Use**:
- Catch blocks for user-facing operations
- When operation fails and user needs guidance
- When there are clear next steps to resolve the issue
- NEVER for silent/background operations (use Logger.log instead)

**Best Practices**:
- Always include context parameter when known
- Let function handle Error object extraction
- Re-throw error after showing dialog for logging
- Keep error messages user-friendly (no stack traces in message)

---

### 5. `HELPER_showSuccess(title, message, options)`

**Purpose**: Display success messages

**Parameters**:
- `title` (string): Success title
- `message` (string): Success details/summary
- `options` (object): Optional configuration (currently unused, for API consistency)

**Returns**: void

**Example**:
```javascript
const result = CALENDAR_generateLiturgicalCalendar(year);
HELPER_showSuccess('Calendar Generated', result);
```

**Visual Format**:
- Title: ✅ prefix
- Success message
- Single OK button

**When to Use**:
- Operations completed successfully
- User needs confirmation of completion
- Results include summary stats
- NOT for sidebar operations (use `showSuccess()` in Sidebar.html instead)

**Best Practices**:
- Include stats in message when relevant (e.g., "Generated 365 days...")
- Keep message concise (1-2 sentences)
- Focus on outcome, not process

---

### 6. `HELPER_showValidationReport(title, items, summary)`

**Purpose**: Display multi-category validation results

**Parameters**:
- `title` (string): Report title
- `items` (Array): Validation items `[{type: 'error'|'warning'|'info', message: string}]`
- `summary` (object): Optional summary `{errors: number, warnings: number}`

**Returns**: void

**Example**:
```javascript
const items = [
  { type: 'error', message: 'Config sheet missing "Year to Schedule" setting' },
  { type: 'warning', message: 'Volunteer "John Smith" has no email address' },
  { type: 'info', message: 'Found 25 active volunteers' }
];

const summary = { errors: 1, warnings: 1 };

HELPER_showValidationReport('Data Validation', items, summary);
```

**Visual Format**:
```
✅/⚠️/❌ [Title]

[Emoji] Validation Results:
Errors: X | Warnings: Y

❌ ERRORS (must fix):
1. [error message]
2. [error message]

⚠️ WARNINGS (recommended to fix):
1. [warning message]

ℹ️ INFO:
1. [info message]
```

**When to Use**:
- Data validation workflows (`VALIDATE_all()` in 0c_validation.gs)
- Multi-step verification processes
- When grouping errors/warnings/info is helpful
- Diagnostic reports

**Best Practices**:
- Always provide summary for context
- Group by severity (errors first, then warnings, then info)
- Use numbered lists for easy reference
- Title emoji matches highest severity level

---

## Sidebar Notifications (JavaScript)

### Location
`Sidebar.html` - lines 950-1030

### Functions

#### 1. `showLoading(message)`

**Purpose**: Show loading state during async operations

**When to Use**:
- Before calling `google.script.run` functions
- Long-running operations (calendar generation, assignment)
- Any operation that takes >1 second

**Example**:
```javascript
document.getElementById('generateCalendarBtn').addEventListener('click', () => {
  showLoading('Generating liturgical calendar...');

  google.script.run
    .withSuccessHandler(showSuccess)
    .withFailureHandler((error) => showError(error, 'calendar'))
    .triggerCalendarGeneration();
});
```

**Visual Behavior**:
- Displays message with spinning loader icon
- Disables all sidebar buttons
- Accessible: Sets `aria-busy="true"` and `aria-live="polite"`

---

#### 2. `showSuccess(message)`

**Purpose**: Show success feedback after operations complete

**When to Use**:
- `withSuccessHandler()` callback for sidebar operations
- After operation returns success message from server

**Example**:
```javascript
google.script.run
  .withSuccessHandler(showSuccess)
  .withFailureHandler((error) => showError(error, 'schedule'))
  .triggerScheduleGeneration(monthString);
```

**Visual Behavior**:
- Green background with checkmark icon ✅
- Auto-hides after 5 seconds
- Re-enables sidebar buttons
- Special handling: Refreshes month dropdown when calendar is generated

---

#### 3. `showError(error, context)`

**Purpose**: Show error feedback with context-specific troubleshooting

**Parameters**:
- `error` (string or Error): Error message
- `context` (string): Same contexts as `HELPER_showError()`

**When to Use**:
- `withFailureHandler()` callback for sidebar operations
- Any sidebar operation that can fail

**Example**:
```javascript
google.script.run
  .withSuccessHandler(showSuccess)
  .withFailureHandler((error) => showError(error, 'assignment'))
  .triggerAutoAssignment(monthString);
```

**Visual Behavior**:
- Red background with warning icon ⚠️
- Shows error message + troubleshooting hints
- Re-enables sidebar buttons
- Does NOT auto-hide (user must read)

**Context-Specific Troubleshooting**:
The function includes 7 context handlers that provide targeted help:

1. **'calendar'**: Config/calendar sheet issues
2. **'validation'**: Data validation guidance
3. **'schedule'**: Mass scheduling prerequisites
4. **'form-update'**: Google Forms API issues
5. **'timeoffs'**: Timeoff management issues
6. **'assignment'**: Volunteer assignment problems
7. **'print'**: Print schedule generation errors

---

## When to Use Each Notification Type

### Decision Tree

```
Is this a sidebar-triggered operation?
├─ YES → Use Sidebar notifications (showLoading/Success/Error)
└─ NO → Continue...

Does the operation require user input?
├─ YES → Use HELPER_promptUser()
└─ NO → Continue...

Is this a destructive/irreversible operation?
├─ YES → Use HELPER_confirmAction()
└─ NO → Continue...

Did an error occur?
├─ YES → Use HELPER_showError() with context
└─ NO → Continue...

Is this a validation report with multiple categories?
├─ YES → Use HELPER_showValidationReport()
└─ NO → Continue...

Is this a success message?
├─ YES → Use HELPER_showSuccess()
└─ NO → Use HELPER_showAlert()
```

---

## Notification Patterns by Workflow

| Workflow | Entry Point | Notifications Used |
|----------|-------------|-------------------|
| **Calendar Generation** | Sidebar button | `showLoading()` → `showSuccess()` / `showError()` |
| **Schedule Generation** | Sidebar button | `showLoading()` → `showSuccess()` / `showError()` |
| **Auto-Assignment** | Sidebar button | `showLoading()` → `showSuccess()` / `showError()` |
| **Timeoff Form Update** | Sidebar button | `showLoading()` → `showSuccess()` / `showError()` |
| **Timeoff Review** | Menu → 0_code.gs | `HELPER_showAlert()` (progress) → Result summary |
| **Data Validation** | Menu → 0_code.gs | `HELPER_showValidationReport()` |
| **Archive Creation** | Menu → 6_archivelogic.gs | `HELPER_confirmAction()` → `HELPER_showSuccess()` / `HELPER_showError()` |
| **Public Schedule Publish** | Menu → 6_publicschedule.gs | `HELPER_promptUser()` → `HELPER_confirmAction()` → Result |
| **Real-time Assignment Validation** | onEdit trigger → 0d_onedit.gs | `ui.alert()` with YES/NO (special case, keep as-is) |

---

## Error Message Best Practices

### Format Guidelines

1. **Be Specific**: "MassTemplates sheet not found" > "Error reading data"
2. **Include Context**: "Could not assign volunteers: No Active volunteers found"
3. **Suggest Next Steps**: Use troubleshooting hints via context parameter
4. **Avoid Technical Jargon**: "Calendar not generated yet" > "LiturgicalCalendar dependency missing"
5. **Use Complete Sentences**: Start with capital letter, end with period

### Tone Guidelines

- **Professional but Friendly**: Avoid overly formal language
- **Helpful, Not Blaming**: "Please generate the calendar first" > "You forgot to generate the calendar"
- **Action-Oriented**: Focus on what user should do next
- **Consistent Emoji Use**: ❌ for errors, ⚠️ for warnings, ✅ for success, ℹ️ for info

### Examples

**❌ Bad**:
```javascript
throw new Error('fail');
```

**✅ Good**:
```javascript
throw new Error('Could not generate schedule: No mass templates found. Please create at least one mass template in the MassTemplates sheet.');
```

**❌ Bad**:
```javascript
ui.alert('Error', 'Something went wrong', ui.ButtonSet.OK);
```

**✅ Good**:
```javascript
HELPER_showError(
  'Assignment Failed',
  'Could not auto-assign volunteers: No Active volunteers found with the required ministry roles.',
  'assignment'
);
```

---

## Confirmation Dialog Best Practices

### When to Confirm

**Always Confirm**:
- Deleting data (schedules, assignments, calendar)
- Regenerating data (overwrites existing)
- Archive operations (creates files)
- Publishing operations (external visibility)
- Batch updates affecting multiple records

**Never Confirm**:
- Read-only operations (viewing, exporting)
- Undoable edits (single cell changes)
- Informational dialogs
- Operations that already have confirmation in sidebar

### Confirmation Message Structure

```javascript
HELPER_confirmAction(
  '[Action] [Object]',                    // Title: Short, imperative
  '[Context + Consequences]\n\n' +        // Body: What happens, why it matters
  '[Data Loss Warning if applicable]',    // Warning: What can't be undone
  { type: 'danger' }                      // Options: Match severity
);
```

**Example**:
```javascript
const confirmed = HELPER_confirmAction(
  'Clear All Assignments',
  'This will permanently delete all volunteer assignments for December 2025.\n\n' +
  'All auto-assignments and manual assignments will be lost.\n\n' +
  'This action cannot be undone. Use File > Version History to restore if needed.',
  { type: 'danger' }
);
```

---

## Migration Guide

### Refactoring Existing Notifications

**Pattern 1: Simple Alert**

Before:
```javascript
const ui = SpreadsheetApp.getUi();
ui.alert('Success', result, ui.ButtonSet.OK);
```

After:
```javascript
HELPER_showSuccess('Success', result);
```

---

**Pattern 2: Error in Catch Block**

Before:
```javascript
catch (e) {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Error', e.message, ui.ButtonSet.OK);
  throw e;
}
```

After:
```javascript
catch (e) {
  HELPER_showError('Operation Failed', e, 'schedule');
  throw e;
}
```

---

**Pattern 3: Confirmation Dialog**

Before:
```javascript
const ui = SpreadsheetApp.getUi();
const response = ui.alert(
  'Warning',
  'Are you sure you want to continue?',
  ui.ButtonSet.YES_NO
);

if (response === ui.Button.YES) {
  // Proceed
}
```

After:
```javascript
const confirmed = HELPER_confirmAction(
  'Confirm Action',
  'Are you sure you want to continue? This will overwrite existing data.',
  { type: 'warning' }
);

if (confirmed) {
  // Proceed
}
```

---

**Pattern 4: User Input Prompt**

Before:
```javascript
const ui = SpreadsheetApp.getUi();
const response = ui.prompt('Enter month', 'Month (YYYY-MM):', ui.ButtonSet.OK_CANCEL);

if (response.getSelectedButton() === ui.Button.OK) {
  const value = response.getResponseText();
  // Use value
}
```

After:
```javascript
const result = HELPER_promptUser(
  'Enter Month',
  'Month (YYYY-MM):',
  {
    required: true,
    validator: (value) => {
      if (!/^\d{4}-\d{2}$/.test(value)) {
        return { valid: false, error: 'Please use format YYYY-MM (e.g., 2025-12)' };
      }
      return { valid: true };
    }
  }
);

if (result.success) {
  // Use result.value
}
```

---

## Testing Notifications

### Manual Test Checklist

For each refactored notification:

- [ ] Visual formatting matches standard (emoji, spacing, formatting)
- [ ] Button labels are clear and actionable
- [ ] Error messages include troubleshooting hints (when context provided)
- [ ] Confirmations prevent accidental destructive actions
- [ ] Prompts validate input correctly
- [ ] Success messages summarize results
- [ ] Sidebar notifications auto-hide appropriately

### Example Test Script

Located in `7_tests.gs`:

```javascript
function TEST_notificationHelpers() {
  // Test alert
  HELPER_showAlert('Test Info', 'This is an informational message', 'info');

  // Test confirmation
  const confirmed = HELPER_confirmAction(
    'Test Confirmation',
    'This is a test confirmation. Click Yes to continue.',
    { type: 'warning' }
  );
  Logger.log(`User confirmed: ${confirmed}`);

  // Test prompt
  const result = HELPER_promptUser(
    'Test Prompt',
    'Enter a number:',
    {
      required: true,
      validator: (value) => {
        if (isNaN(value)) {
          return { valid: false, error: 'Please enter a valid number' };
        }
        return { valid: true };
      }
    }
  );
  Logger.log(`User input: ${result.value}, cancelled: ${result.cancelled}`);

  // Test validation report
  const items = [
    { type: 'error', message: 'Test error 1' },
    { type: 'warning', message: 'Test warning 1' },
    { type: 'info', message: 'Test info 1' }
  ];
  HELPER_showValidationReport('Test Report', items, { errors: 1, warnings: 1 });
}
```

---

## File Reference

| File | Notification Method | Lines |
|------|---------------------|-------|
| **0b_helper.gs** | Helper functions | 824-1124 |
| **Sidebar.html** | Sidebar functions | 950-1030 |
| **0_code.gs** | Menu trigger wrappers | Various |
| **0d_onedit.gs** | Real-time validation | 418+ |
| **6_archivelogic.gs** | Archive operations | Various |
| **6_publicschedule.gs** | Publishing operations | Various |

---

## Future Enhancements

### Potential Improvements

1. **Toast Notifications** (Google Apps Script `.toast()`)
   - Non-blocking, auto-dismissing notifications
   - Currently NOT used in codebase
   - Could complement dialogs for quick feedback
   - Example: "Validation complete" when running background checks

2. **Progress Bars**
   - For long-running operations (auto-assignment across full year)
   - Google Apps Script doesn't have built-in progress bars
   - Could use sidebar with JavaScript progress updates

3. **Email Notifications**
   - Send summary emails after major operations
   - Example: "December 2025 schedule published - 42 volunteers assigned"
   - Would require MailApp integration

4. **Notification History Log**
   - Track all notifications shown to user
   - Useful for debugging user issues
   - Could log to separate sheet or Logger

---

## Summary

### Key Principles

1. **Consistency**: Use helper functions, not ad-hoc dialogs
2. **Context**: Always provide troubleshooting hints for errors
3. **Clarity**: Emoji prefixes, clear titles, actionable messages
4. **Tone**: Professional, helpful, action-oriented
5. **Accessibility**: ARIA attributes in sidebar, clear button labels
6. **Hybrid Architecture**: Sidebar for workflows, dialogs for admin tools

### Quick Reference

- **Info/Success**: `HELPER_showAlert()` or `HELPER_showSuccess()`
- **Error**: `HELPER_showError()` with context
- **Confirmation**: `HELPER_confirmAction()`
- **User Input**: `HELPER_promptUser()` with validation
- **Validation Report**: `HELPER_showValidationReport()`
- **Sidebar Operations**: `showLoading()` → `showSuccess()` / `showError()`

---

**Maintainer Notes**: Update this document when adding new notification patterns or contexts. Keep examples aligned with actual codebase usage.
