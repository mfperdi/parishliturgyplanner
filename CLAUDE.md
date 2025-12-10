# Parish Liturgical Scheduler - Developer Guide for AI Assistants

## Project Overview

**Parish Liturgical Scheduler** is a Google Apps Script add-in for Google Sheets that automates liturgical ministry scheduling for Catholic parishes. It generates liturgical calendars, creates Mass schedules, and automatically assigns volunteers to ministry roles while respecting liturgical seasons, timeoffs, and volunteer preferences.

**Primary Use Case**: Parish administrators use this tool to:
1. Generate a liturgical calendar for the entire year
2. Create monthly Mass schedules with all required ministry roles
3. Auto-assign qualified volunteers to roles based on availability and preferences
4. Handle timeoff requests and substitute assignments
5. Export printable schedules for distribution

## Technology Stack

- **Platform**: Google Apps Script (JavaScript-based)
- **Runtime**: V8 Engine
- **Integration**: Google Sheets API
- **Architecture**: Server-side script with HTML sidebar interface
- **Data Storage**: Google Sheets (multiple interconnected sheets)

## Codebase Structure

### File Naming Convention

Files use a numeric prefix system to indicate loading order and functional grouping:

```
0_*.gs        - Core infrastructure (entry point, constants, helpers, debug, diagnostics)
1_*.gs        - Liturgical calendar generation
2_*.gs        - Schedule generation
3_*.gs        - Assignment logic
4_*.gs        - Timeoff management
5_*.gs        - Print/export functionality
6_*.gs        - Archive and public schedule features
7_*.gs        - Test functions (run from Script Editor)
Sidebar.html  - User interface
```

### File Inventory

| File | Purpose | Key Functions |
|------|---------|---------------|
| `0_code.gs` | Main entry point, menu system, sidebar integration | `onOpen()`, `showSidebar()`, wrapper functions |
| `0_liturgicalcolors.gs` | Liturgical color definitions and utilities | `LITURGICAL_COLORS`, `HELPER_getLiturgicalColorHex()` |
| `0a_constants.gs` | Global constants, sheet names, column mappings | `CONSTANTS` object |
| `0b_helper.gs` | Reusable utility functions, liturgical helpers | `HELPER_*()`, `PRECEDENCE` |
| `0c_validation.gs` | Comprehensive data validation system | `VALIDATE_all()`, `VALIDATE_*()`, `runDataValidation()` |
| `0d_onedit.gs` | Real-time assignment validation with onEdit trigger | `onEdit()`, `ONEDIT_*()` functions |
| `0_debug.gs` | Debugging and diagnostic tools | `DEBUG_*()` functions |
| `0_diagnostic.gs` | Assignment troubleshooting diagnostics | `DIAGNOSTIC_checkAssignmentReadiness()` |
| `1_calendarlogic.gs` | Liturgical calendar generation orchestration | `CALENDAR_generateLiturgicalCalendar()` |
| `1a_calendardates.gs` | Moveable feast date calculations | `CALENDAR_calculateLiturgicalDates()` |
| `1b_calendarseasons.gs` | Seasonal celebration logic | `CALENDAR_getSeasonalCelebration()` |
| `2_schedulelogic.gs` | Mass schedule generation with 3-layer logic | `SCHEDULE_generateScheduleForMonth()` |
| `3_assignmentlogic.gs` | Volunteer auto-assignment algorithm | `ASSIGNMENT_autoAssignRolesForMonthOptimized()` |
| `4_timeoff-form.gs` | Timeoff request handling | `TIMEOFFS_*()` functions |
| `5_printschedule.gs` | Print schedule generation | `generatePrintableSchedule()` |
| `6_archivelogic.gs` | Archive completed schedules | Archive functions |
| `6_publicschedule.gs` | Public schedule generation | Public schedule functions |
| `7_tests.gs` | Consolidated test functions | `TEST_*()` functions |
| `Sidebar.html` | HTML/CSS/JavaScript UI | Sidebar interface |

## Data Model

### Google Sheets Structure

The system uses multiple interconnected sheets within a single spreadsheet:

#### Configuration Sheets

**Config** - System settings
- `Setting` (Column A): Setting name
- `Value` (Column B): Setting value
- Key settings: `Year to Schedule`, `Calendar Region`, `Parish Name`, `Ministry Name`, `Ministry Coordinator`
- `Parish Name`: Used in form titles (e.g., "St. Catherine of Siena")
- `Ministry Name`: Used in form titles (e.g., "Word Ministry")
- `Ministry Coordinator`: Contact person referenced in form help text and messages (e.g., "Word Ministry Coordinator")

**SaintsCalendar** - Fixed feast days and saints
- Columns: Month, Day, Liturgical Celebration, Rank, Color, Calendar
- Filtered by region (General Roman Calendar, USA, Parish, Diocese)

**CalendarOverrides** - Manual liturgical calendar adjustments
- Columns: Month, Day, Liturgical Celebration, Rank, Color, Calendar, Notes
- Overrides both saints and seasonal celebrations

#### Mass Configuration Sheets

**Ministries** - Master reference for all ministry roles
- Columns: Ministry Name, Role Name, Description, Is Active
- Central registry of all ministry roles available in the parish
- Example rows:
  - Lector, 1st reading, "First reading from Scripture", TRUE
  - Lector, 2nd reading, "Second reading from Scripture", TRUE
  - Eucharistic Minister, Bread, "Distribute communion bread", TRUE
- Referenced by MassTemplates and Volunteers sheets for validation
- Is Active flag allows retiring roles without deleting data

**MassTemplates** - Ministry role definitions for Mass types
- Columns: Template Name, Description, Roles
- Defines which roles are needed for each type of Mass
- Roles: Comma-separated list of role names (e.g., "1st reading, 2nd reading, Psalm, Bread, Chalice")
- Example: "Sunday Family Mass" with description "Regular Sunday morning Mass with full participation"
- All role names must exist in Ministries sheet (validated)

**WeeklyMasses** - Recurring weekly Masses (Layer 1)
- Columns: Event ID, Day of Week, Time, Start Date, End Date, Is Active, Is Anticipated, Description, Template Name, Assigned Group, Notes
- Example: Sunday 10:00 AM Mass every week

**MonthlyMasses** - Monthly special Masses (Layer 2)
- Columns: Event ID, Week of Month, Day of Week, Time, Start Date, End Date, Is Active, Is Anticipated, Override Type, Description, Template Name, Assigned Group, Notes
- Example: First Friday Mass, Last Sunday special Mass
- Override Type: `overrideday` (replace all masses that day) or append

**YearlyMasses** - Annual special Masses (Layer 3)
- Columns: Event ID, Date, Liturgical Celebration, Time, Is Active, Is Anticipated, Override Type, Description, Template Name, Assigned Group, Notes
- Can reference liturgical celebrations or static dates
- Example: Christmas Vigil, Easter Sunday Masses

#### Volunteer Management Sheets

**Volunteers** - Volunteer database
- Columns: Volunteer ID, First Name, Last Name, Full Name, Email, Phone, Parent/Guardian Name, Family Team, Status, Ministry Role, Preferred Mass Time, Ministry Role Preference, Date Cleared, Date Trained
- Status: Active, Inactive, Substitute Only, Ministry Sponsor, Parent/Guardian
  - **Active**: Regular volunteers included in auto-assignment
  - **Inactive**: Volunteers not currently available
  - **Substitute Only**: Backup volunteers (manual assignment only)
  - **Ministry Sponsor**: Ministry coordinators (auto-assigned to designated group masses, excluded from individual auto-assignment)
  - **Parent/Guardian**: Adults accompanying youth (manual assignment only)
- Ministry Role: Comma-separated list (e.g., "Lector, Eucharistic Minister") - must exist in Ministries sheet
- Preferred Mass Time: Event IDs (e.g., "SUN-1000, SAT-1700")
- Ministry Role Preference: Specific roles (e.g., "1st reading, psalm") - must exist in Ministries sheet

**Timeoffs** - Timeoff request tracking via Google Form with blacklist and whitelist support
- Columns: Timestamp, Volunteer Name, Type, Selected Dates, Volunteer Notes, Status, Reviewed Date, Review Notes
- **Status**: Pending, Approved, Rejected
- **Type** (dropdown):
  - **"I CANNOT serve these dates"** (blacklist): Volunteer unavailable on checked dates
  - **"I can ONLY serve these dates"** (whitelist): Volunteer can ONLY be assigned to checked dates
- **Selected Dates**: Parsed from form checkboxes (e.g., "2/7/2026 (Vigil), 2/8/2026, 2/15/2026")
- **Volunteer Notes**: Optional additional details from form (mass time restrictions, context, etc.)
- **Review Notes**: System-generated warnings + admin review notes

#### Output Sheets

**LiturgicalCalendar** - Generated liturgical calendar
- Columns: Date, Weekday, Liturgical Celebration, Optional Memorial, Season, Rank, Color
- Generated by Step 1 (Calendar Generation)
- Covers entire year

**Assignments** - Generated ministry assignments
- Columns: Date, Time, Mass Name, Liturgical Celebration, Ministry Role, Event ID, Month-Year, Assigned Group, Assigned Volunteer ID, Assigned Volunteer Name, Status, Notes, Family Group
- Generated by Step 2 (Schedule Generation)
- Populated by Step 3 (Auto-Assignment)
- Status: Unassigned, Assigned, Substitute Needed

## Core Workflows

### Workflow 1: Liturgical Calendar Generation

**Trigger**: User clicks "Generate Calendar" (runs once per year)

**Process** (`CALENDAR_generateLiturgicalCalendar()`):
1. Read configuration (year, region)
2. Calculate moveable feast dates (Easter-based calculations)
3. Build override map from CalendarOverrides sheet
4. Build saint map from SaintsCalendar sheet (filtered by region)
5. For each day of the year:
   - Get seasonal celebration (from 1b_calendarseasons.gs)
   - Get saint celebration (from map)
   - Apply precedence rules to determine winning celebration
   - Write to LiturgicalCalendar sheet

**Precedence System**:
- Uses numerical ranking (lower number = higher priority)
- Defined in `PRECEDENCE` constant in 0b_helper.gs
- Hierarchy: Overrides > Saints/Seasonal (by rank) > Seasonal default
- Optional Memorials listed separately when they lose to seasonal days

**Key Dates Calculated** (in 1a_calendardates.gs):
- Easter Sunday (Computus algorithm)
- Ash Wednesday (46 days before Easter)
- Pentecost (50 days after Easter)
- Advent Sundays (4 Sundays before Christmas)
- All dependent moveable feasts

### Workflow 2: Monthly Schedule Generation

**Trigger**: User selects month and clicks "Generate Schedule"

**Process** (`SCHEDULE_generateScheduleForMonth()`):
1. Validate month is in configured year
2. **DESTRUCTIVE**: Clear all existing assignments for the month
3. Read Mass templates
4. Find all Masses using 3-layer logic:
   - **Layer 1**: Weekly recurring Masses (baseline)
   - **Layer 2**: Monthly special Masses (override or append)
   - **Layer 3**: Yearly special Masses (override or append)
5. Build liturgical celebration map from LiturgicalCalendar
6. For each Mass found:
   - Determine liturgical celebration (handle anticipated Masses)
   - Get ministry roles from template
   - Create unassigned assignment rows
7. Write to Assignments sheet

**3-Layer Mass Scheduling Logic**:

```
Layer 1 (Weekly):
  - Every Sunday 10:00 AM → Template: "Sunday Family Mass"

Layer 2 (Monthly):
  - 1st Friday 7:00 PM → Template: "First Friday Mass"
  - Override Type: append (adds to weekly, doesn't replace day)

Layer 3 (Yearly):
  - Christmas Day → Liturgical Celebration: "The Nativity of the Lord"
  - Multiple Masses with different times
  - Override Type: override (replaces all weekly/monthly for that day)
```

**Spillover Weekend Handling**:
- If month ends on Saturday, includes following Sunday
- Prevents duplicate scheduling when month transitions
- Day 1 skipping logic if it's a spillover Sunday

**Anticipated Mass Logic**:
- If `Is Anticipated` is true, liturgical celebration comes from next day
- Example: Saturday 5:00 PM vigil Mass uses Sunday's liturgy

### Workflow 3: Auto-Assignment

**Trigger**: User clicks "Auto-Assign Volunteers"

**Process** (`ASSIGNMENT_autoAssignRolesForMonthOptimized()`):
1. Read volunteers with ministry qualifications (Active and Ministry Sponsor status)
2. **Build skill-to-ministry mapping** from Ministries sheet:
   - Maps specific skills (e.g., "1st reading") to general ministry categories (e.g., "Lector")
   - Only includes active roles (Is Active = TRUE)
   - Allows volunteers with "Lector" ministry to be matched to "1st reading" assignments
3. **Build timeoff maps** (approved timeoffs only):
   - **Blacklist** map: Not Available dates
   - **Whitelist** map: Only Available dates/Event IDs
   - **Special Availability** map: Override dates/Event IDs
4. Process group assignments first (family teams)
   - **Group assignments** (e.g., "Knights of Columbus"): Finds volunteers with matching Family Team
   - Allows both **Active** and **Ministry Sponsor** status for group assignments
   - If matching volunteer found, assigns specific volunteer name; otherwise assigns group name
5. Group individual assignments by Mass
6. For each Mass, for each role:
   - **Find eligible volunteers** using enhanced logic:
     1. Must have required ministry skill
     2. Must be Active status (Ministry Sponsors excluded from individual auto-assignment)
     3. Check **Special Availability** (overrides blacklist/whitelist if present)
     4. Check **Whitelist** (if exists, must match Event ID or date)
     5. Check **Blacklist** (exclude if date matches)
     6. Must not be already assigned that day or to this Mass
   - Score volunteers based on:
     - Assignment frequency (fewer = higher score)
     - Mass preference match (+20 points)
     - Role preference match (+15 points)
     - Family team bonus (+25 points if family member already assigned)
     - Flexibility bonus (+3 points for no preferences)
   - Assign highest-scoring volunteer
   - Update assignment counts
7. Mark assignments with status "Assigned"

**Timeoff Logic**:
- **Whitelist** (Only Available): If a volunteer has a whitelist, they can ONLY be assigned to specified Event IDs or dates during the specified period
- **Blacklist** (Not Available): Volunteer is excluded from assignment on specified dates
- Whitelist takes precedence: if a whitelist exists for a volunteer, they must match the whitelist to be eligible

**Volunteer Scoring Algorithm** (in `HELPER_calculateVolunteerScore()`):
```javascript
Base score: 100
- Frequency penalty: -5 per previous assignment
+ Mass preference match: +20
+ Role preference match: +15
+ Family team serving together: +25
+ Flexibility (no preferences): +3
```

### Workflow 4: Print Schedule Generation

**Trigger**: User clicks "Print Schedule"

**Process** (`generatePrintableSchedule()`):
1. Build liturgical data map for the month
2. Get all assignments for the month
3. Group assignments by liturgical celebration
4. Create formatted sheet with:
   - Parish header
   - Liturgical celebration sections (color-coded)
   - Rank/Season/Color information
   - Mass details grouped by date/time
   - Ministry roles and assigned volunteers
   - Summary statistics
5. Apply formatting and column widths
6. Output to MonthlyView or LiturgicalSchedule sheet

### Workflow 5: Data Validation

**Trigger**: User clicks "Admin Tools" > "Validate Data"

**Process** (`VALIDATE_all()` in 0c_validation.gs):
1. Validate Config sheet:
   - Year to Schedule (must be 2020-2050)
   - Parish Name (required)
   - Calendar Region (recommended)
2. Validate Ministries sheet:
   - Ministry Name and Role Name required
   - No duplicate Ministry-Role combinations
   - Is Active field is TRUE/FALSE
   - Sheet exists and has data
3. Validate Volunteers sheet:
   - Unique Volunteer IDs
   - Valid email formats
   - Valid status values (Active, Inactive, Substitute Only, Ministry Sponsor, Parent/Guardian)
   - Valid date formats and logical date ordering
   - No duplicate emails
4. Validate Mass Templates:
   - Template Name and Ministry Role required
   - No empty templates
5. Validate Mass Configuration:
   - Event IDs unique across all three sheets
   - Valid day of week, time formats
   - Templates referenced actually exist
   - Date ranges logical
6. Cross-sheet consistency:
   - Event IDs in preferences exist
   - Volunteer names in timeoffs exist
   - Templates referenced in mass configs exist
   - **MassTemplates ministry-role combinations exist in Ministries sheet**
   - **Volunteers ministries and roles exist in Ministries sheet**

**Validation Results**:
- **Errors (❌)**: Critical issues that will cause failures
- **Warnings (⚠️)**: Non-critical issues, recommended to fix
- User-friendly dialog with all findings
- Grouped by category for easy review

**Best Practice**: Run validation before generating calendars or schedules to catch data issues early.

### Workflow 5a: Timeoff Management

**Overview**: Volunteers submit temporary availability changes via Google Form. Admin updates form monthly with current dates, volunteers fill it out, admin approves/rejects, and system respects timeoffs during auto-assignment.

**Initial Setup** (one-time):
1. Create Google Form linked to Timeoffs sheet (Tools > Create a new form)
2. Admin menu: Admin Tools → Setup Timeoff Validation (adds TYPE dropdown to sheet)

**Monthly Workflow**:
1. **Admin: Update Form** (before volunteers submit)
   - Sidebar: Select month → "Update Timeoff Form"
   - System populates form with all mass dates for the month in chronological order
   - **Weekends grouped**: "Weekend of 2/7-2/8/2026 - 5th Sunday in Ordinary Time" (combines Saturday vigil + Sunday masses)
   - **Special liturgical days**: "Wednesday 2/18/2026 - Ash Wednesday" (individual dates)
   - Volunteers can specify mass time restrictions in "Additional Details" field if needed

2. **Volunteers: Submit Requests**
   - Open Google Form (share link via email/bulletin)
   - Select name from dropdown
   - Choose request type (see below)
   - Check applicable dates
   - Add optional notes for special circumstances
   - Submit form

3. **System: Validate Submission**
   - Checks volunteer name exists
   - Validates date selections
   - Parses checkbox responses into clean date format
   - Adds warnings to Review Notes if issues found
   - Sets Status = "Pending"

4. **Admin: Review and Approve**
   - Menu: Admin Tools → Review Timeoff Requests
   - Review pending requests with context
   - Approve or reject with optional notes
   - System timestamps review

5. **Auto-Assignment: Respects Timeoffs**
   - Only approved timeoffs are enforced
   - See "Timeoff Logic" section below for details

---

#### Timeoff Request Types

The system supports two types for managing temporary availability:

**Type 1: "I CANNOT serve these dates"** (Blacklist)
- **Use case**: Volunteer unavailable on specific dates
- **Common reasons**: Vacation, family event, work conflict, illness
- **Process**: Volunteer checks all dates they CANNOT serve
- **Result**: Volunteer excluded from auto-assignment on those dates
- **Example**: "I'm on vacation Feb 10-17"
  - Select type: "I CANNOT serve these dates"
  - Check all dates from Feb 10-17 (each individual date)
  - Optional notes: "Family vacation"

**Type 2: "I can ONLY serve these dates"** (Whitelist)
- **Use case**: Volunteer restricted to specific dates (unavailable all other dates this month)
- **Common reasons**: Temporary schedule conflict, limited availability period
- **Process**: Volunteer checks ONLY the dates they CAN serve
- **Result**: Volunteer can ONLY be assigned to checked dates (excluded from all other dates)
- **Example**: "I can only help Feb 8 and Feb 22 this month"
  - Select type: "I can ONLY serve these dates"
  - Check ONLY Feb 8 and Feb 22 (do not check other dates)
  - Optional notes: "New work schedule - only free these 2 Sundays"

**Important Distinction**:
- **"I CANNOT serve"**: Most common type (90% of requests). Check dates you're UNavailable.
- **"I can ONLY serve"**: Rare. Check dates you CAN serve, implies you're unavailable all other dates.

---

#### Special Cases

**Scenario: Weekend Unavailability (Most Common)**
- Weekends are grouped: "Weekend of 2/7-2/8/2026 - 5th Sunday in Ordinary Time"
- Example: Unavailable for entire weekend
  - Check the weekend checkbox
  - Leave "Additional Details" blank
  - **Result**: Blocked from ALL masses that weekend (Saturday vigil + all Sunday masses)

**Scenario: Specific Mass Time Restrictions on Weekends**
- Example: "I can only do Saturday vigil, not Sunday" OR "I can only do Sunday 10am"
- Solution:
  - Check the weekend checkbox
  - In "Additional Details" field: "Weekend 2/7: Saturday vigil only" OR "Weekend 2/7: Sunday 10am only"
  - Admin reviews and can manually adjust if needed

**Scenario: Temporary Mass Time Preferences**
- Example: "I can only serve evening masses this month"
- Solution: Use "I can ONLY serve" type + check all applicable weekends/dates + add note "Evening masses only"
- Admin reviews note and can manually adjust if needed

**Scenario: Holy Days with Multiple Mass Times**
- Example: "I can only serve the 7pm mass on Assumption Day"
- Solution: Check Assumption date + add note "7pm evening mass only"
- Admin may need to manually verify assignment or add Event ID to Notes field

**Scenario: Permanent Preference Changes**
- Example: "I want to permanently change to Saturday evening masses"
- **Do NOT use timeoff form** - this is a permanent change
- Instruct volunteer to contact admin directly
- Admin updates Volunteers sheet → Preferred Mass Time column

---

#### Form User Experience Improvements

**Clear Type Names**: Active voice makes distinction obvious
- ❌ Old: "Not Available" / "Only Available" (ambiguous)
- ✅ New: "I CANNOT serve these dates" / "I can ONLY serve these dates"

**Comprehensive Help Text**: Each form question includes:
- When to use each option
- Examples with real scenarios
- Tips for common situations (vigil masses, date ranges, etc.)
- Guidance on permanent vs. temporary changes

**Form Description**: Top of form sets expectations
- What the form is for (temporary changes only)
- Common examples with type selection guidance
- What NOT to use it for (permanent changes)
- Admin contact info

**Confirmation Message**: After submission
- What happens next (review timeline, email notification)
- How to make changes or cancel
- When schedule will be published

---

#### Best Practices

1. **Update form monthly** before volunteers start submitting (use Sidebar → Update Timeoff Form)
2. **Communicate form link** via email/bulletin with submission deadline
3. **Review requests promptly** - volunteers appreciate quick feedback
4. **For permanent changes**: Update Volunteers sheet directly (Preferred Mass Time, Status, Ministry Roles)
5. **For edge cases**: Manual assignment in Assignments sheet with override is acceptable
6. **Run validation setup once**: Admin Tools → Setup Timeoff Validation (adds TYPE dropdown)

### Workflow 5b: Real-Time Assignment Validation

**Trigger**: Automatic - fires when manually editing Volunteer ID or Name in Assignments sheet

**Process** (`onEdit()` in 0d_onedit.gs):
1. User types volunteer name or ID in Assignments sheet (columns I or J)
2. System validates assignment in real-time:
   - **Status check**: Volunteer must be Active
   - **Ministry match**: Volunteer must have required role AND skill
   - **Timeoff check**: No blacklist conflicts, whitelist compliance
3. If warnings found:
   - Show dialog with detailed warning messages
   - User chooses: Cancel assignment OR Override with confirmation
4. If override confirmed:
   - Assignment stays in place
   - Notes column updated with override documentation
   - Row highlighted via conditional formatting
5. If no warnings:
   - Assignment accepted silently
   - Both ID and Name auto-filled

**Validation Checks**:
- **Status**: Must be "Active" (not Inactive, Substitute Only, etc.)
- **Ministry Role**: General category from Volunteers sheet
- **Ministry Skill**: Specific skill from MassTemplates sheet
- **Blacklist (Not Available)**: Volunteer cannot serve on specified dates
- **Whitelist (Only Available)**: Volunteer can ONLY serve specified Event IDs/dates

**Override Documentation**:
When user overrides warnings, Notes column is automatically updated:
```
[Override: Inactive, Missing Role] Original notes...
```

**Conditional Formatting**:
- One-time setup: Admin Tools → Setup Assignment Validation
- Rows with overrides highlighted in light orange
- Visual audit trail for quality control

**Best Practices**:
1. Run Admin Tools → Setup Assignment Validation once to enable visual highlighting
2. Respect warnings when possible - they prevent scheduling errors
3. Use overrides for legitimate exceptions (emergencies, training, special events)
4. Review orange-highlighted assignments periodically
5. Keep Volunteers and Timeoffs sheets up to date to minimize false warnings

**See Also**: ASSIGNMENT_VALIDATION.md for complete documentation, troubleshooting, and common scenarios

### Workflow 6: Data Protection

**Google Sheets Version History**:
The system relies on Google Sheets' built-in version history for data protection:
- Access via: File > Version History > See version history
- Automatic saves every few minutes
- Can restore entire spreadsheet to any previous state
- Provides rollback capability for accidental changes
- No additional backup system needed

**Recovery Process**:
1. Open File > Version History
2. Browse to time before unwanted change
3. Click "Restore this version"
4. All sheets restored to that point in time

**Note**: Schedule generation is destructive (clears assignments for the month). Use confirmation dialogs carefully and rely on version history if recovery is needed.

## Development Conventions

### Naming Patterns

**Function Names**:
- `PREFIX_actionDescription()` format
- Prefixes indicate module:
  - `HELPER_*()` - Utility functions
  - `CALENDAR_*()` - Calendar generation
  - `SCHEDULE_*()` - Schedule generation
  - `ASSIGNMENT_*()` - Assignment logic
  - `TIMEOFFS_*()` - Timeoff management
  - `PRINT_*()` - Print/export functions

**Variable Names**:
- camelCase for variables
- UPPER_SNAKE_CASE for constants
- Descriptive names (avoid abbreviations except common ones)

**Constants**:
- All constants defined in `CONSTANTS` object in 0a_constants.gs
- Access via: `CONSTANTS.SHEETS.CALENDAR`, `CONSTANTS.COLS.ASSIGNMENTS`, etc.
- Never hardcode sheet names or column numbers

### Column Access Pattern

Always use column constants, never hardcode numbers:

```javascript
// GOOD
const date = row[assignCols.DATE - 1];
const role = row[assignCols.MINISTRY_ROLE - 1];

// BAD
const date = row[0];
const role = row[4];
```

Note: Subtract 1 because columns are 1-indexed but arrays are 0-indexed.

### Data Reading Pattern

Use helper functions for consistent data access:

```javascript
// Standard data reading
const data = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);

// Cached data reading (for frequently accessed data)
const data = HELPER_readSheetDataCached(CONSTANTS.SHEETS.CALENDAR);

// Config reading with validation
const config = HELPER_readConfigSafe();
```

### Safe Array Access

Use helper to prevent index errors:

```javascript
const value = HELPER_safeArrayAccess(row, colIndex - 1, 'default');
```

### Date Handling

**Critical**: Always set dates to noon to avoid timezone issues:

```javascript
// GOOD
const date = new Date(year, month, day, 12, 0, 0);

// BAD (can shift dates due to timezone)
const date = new Date(year, month, day);
```

Use helper functions for consistent formatting:

```javascript
HELPER_formatDate(date, 'default')    // "1/15/2026"
HELPER_formatDate(date, 'long')       // "Wednesday, January 15, 2026"
HELPER_formatDate(date, 'month-year') // "January 2026"
HELPER_formatDate(date, 'iso')        // "2026-01-15"
```

### Liturgical Color System

Colors defined in `LITURGICAL_COLORS` constant in 0_liturgicalcolors.gs:

```javascript
const bgColor = HELPER_getLiturgicalColorHex('White');  // Returns hex code
```

Available colors: White, Red, Green, Violet, Rose, Black

**Note**: The `HELPER_getLiturgicalColorHex()` function is defined in 0_liturgicalcolors.gs. A reference note exists in 0b_helper.gs for historical reasons.

### Notification Standards

The codebase uses a **standardized notification system** for consistent user experience.

**Helper Functions** (in `0b_helper.gs` lines 824-1124):
- `HELPER_showAlert(title, message, type)` - Informational alerts
- `HELPER_showSuccess(title, message)` - Success confirmations
- `HELPER_showError(title, error, context)` - Errors with troubleshooting hints
- `HELPER_confirmAction(title, message, options)` - YES/NO confirmations
- `HELPER_promptUser(title, message, options)` - User input with validation
- `HELPER_showValidationReport(title, items, summary)` - Validation results

**When to Use**:
- **Sidebar operations**: Use `Sidebar.html` JavaScript functions (`showLoading`, `showSuccess`, `showError`)
- **Menu operations**: Use HELPER notification functions
- **Confirmations before destructive actions**: Use `HELPER_confirmAction()` with `type: 'danger'`
- **Errors**: Always include `context` parameter for troubleshooting hints
  - Contexts: `'calendar'`, `'validation'`, `'schedule'`, `'assignment'`, `'timeoffs'`, `'print'`, `'form'`, `'archive'`

**Example**:
```javascript
try {
  const result = ARCHIVE_createArchiveFile(year);
  HELPER_showSuccess('Archive Complete', result.message);
} catch (e) {
  HELPER_showError('Archive Failed', e, 'archive');
  throw e;
}
```

**Full Documentation**: See `NOTIFICATION_STANDARDS.md` for complete usage guide, error message best practices, and migration patterns.

### Error Handling Pattern

```javascript
try {
  // Validate inputs first
  const { year, month } = HELPER_validateMonthString(monthString);

  // Main logic
  const result = processData();

  return `Success: ${result}`;
} catch (e) {
  Logger.log(`ERROR in functionName: ${e.message}`);
  Logger.log(`Stack trace: ${e.stack}`);
  throw new Error(`User-friendly error: ${e.message}`);
}
```

### Performance Patterns

**Caching**:
- Use `HELPER_readSheetDataCached()` for frequently accessed sheets
- Cache expires after 5 minutes
- Clear with `HELPER_clearCache()`

**Batch Operations**:
- Read sheet data once, not per row
- Build maps/lookups before processing loops
- Write data in bulk using `setValues()`

**Timing**:
- Use `HELPER_timeFunction()` for performance monitoring

```javascript
return HELPER_timeFunction('MyOperation', () => {
  return performExpensiveOperation();
});
```

## Key Concepts

### Liturgical Precedence

The system uses a numerical precedence system to determine which celebration "wins" on any given day:

**Rank 1-4: Solemnities**
- Triduum (1)
- High Solemnities like Easter, Pentecost (2.1)
- Advent/Lent Sundays (2.2)
- General Solemnities (3)
- Proper Solemnities like Patron (4)

**Rank 5-8: Feasts**
- Feasts of the Lord (5)
- Sundays of Ordinary/Christmas Time (6)
- General Feasts (7)
- Proper Feasts (8)

**Rank 9-13: Weekdays and Memorials**
- High Weekdays (Advent Dec 17-24, Lent) (9)
- Obligatory Memorials (10)
- Proper Memorials (11)
- Optional Memorials (12)
- Ordinary Weekdays (13)

**Implementation**:
- Detailed ranks stored in `PRECEDENCE` constant
- Comparison via `HELPER_getPrecedence(rankText)`
- Output simplified via `HELPER_simplifyRank(detailedRank)`

### Mass Scheduling Layers

**Why 3 layers?**
- Layer 1: Baseline recurring schedule
- Layer 2: Monthly exceptions (e.g., First Friday)
- Layer 3: Annual major feasts (e.g., Christmas)

**Override Types**:
- `append`: Add Mass to existing schedule
- `overrideday`: Replace all Masses for that day
- `override` (yearly): Replace all Masses for that day

**Date Range Logic** (`HELPER_isDateInRange()`):
- Blank Start/End dates = active all year
- Allows seasonal activation (e.g., summer schedule)

### Family Team System

Volunteers can be grouped into family teams to maximize family serving together:

1. Volunteer has `Family Team` field (e.g., "Smith Family")
2. When assigning, system checks if family member already assigned to same Mass
3. Applies +25 point bonus to encourage family assignments
4. Groups can be pre-assigned to specific Masses via `Assigned Group` field

### Anticipated Masses

Anticipated Masses (usually Saturday evening vigils) use the liturgy from the following day:

```javascript
if (mass.isAnticipated) {
  const nextDay = new Date(mass.date.getTime() + 24 * 60 * 60 * 1000);
  liturgicalCelebration = lookupLiturgyForDate(nextDay);
}
```

This ensures Saturday vigil Masses are properly labeled with Sunday's liturgy.

## Modification Guidelines

### Adding a New Feature

1. **Identify the module**: Determine which file(s) need changes
2. **Check constants**: Add any new sheet names, columns to `CONSTANTS`
3. **Add helper functions**: Place reusable logic in 0b_helper.gs
4. **Follow naming conventions**: Use module prefix (e.g., `NEWMODULE_*`)
5. **Add error handling**: Wrap in try-catch with logging
6. **Update menu**: Add menu items in `onOpen()` if user-facing
7. **Update sidebar**: Modify Sidebar.html if UI changes needed
8. **Test thoroughly**: Use debug functions in 0_debug.gs

### Modifying Schedule Logic

**Location**: 2_schedulelogic.gs

**Common modifications**:
- Adding new override type: Update `SCHEDULE_findMassesForMonth()`
- Changing spillover logic: Modify weekend handling section
- Adding validation: Update `HELPER_isDateInRange()`

**Warning**: Schedule generation is destructive - it deletes existing assignments for the month. Be cautious with changes.

### Modifying Assignment Logic

**Location**: 3_assignmentlogic.gs

**Common modifications**:
- Changing scoring algorithm: Update `HELPER_calculateVolunteerScore()` in 0b_helper.gs
- Adding eligibility rules: Modify `filterCandidates()`
- Handling new preference types: Update `buildVolunteerMapOptimized()`

**Key points**:
- Preferences read from columns 11-12 (see CONSTANTS.COLS.VOLUNTEERS)
- Mass preferences are Event IDs (e.g., "SUN-1000")
- Role preferences are role names (e.g., "lector", "eucharistic minister")
- All matching is case-insensitive

### Modifying Liturgical Calendar

**Location**: 1_calendarlogic.gs, 1a_calendardates.gs, 1b_calendarseasons.gs

**Common modifications**:
- Adding moveable feasts: Update `CALENDAR_calculateLiturgicalDates()`
- Changing seasonal logic: Update `CALENDAR_getSeasonalCelebration()`
- Adding calendar regions: Update `CALENDAR_buildSaintMap()` filtering
- Adjusting precedence: Modify `PRECEDENCE` constant in 0b_helper.gs

**Key points**:
- Easter calculation uses Computus algorithm
- All moveable feasts derive from Easter
- Ordinary Time calculation handles gaps (after Baptism of Lord, after Pentecost)

### Adding New Sheets

1. Add sheet name to `CONSTANTS.SHEETS`
2. Add column map to `CONSTANTS.COLS`
3. Create read/write functions following naming convention
4. Update documentation

Example:
```javascript
// In 0a_constants.gs
SHEETS: {
  // existing sheets...
  NEW_SHEET: "NewSheetName"
}

COLS: {
  NEW_SHEET: {
    COLUMN_A: 1,
    COLUMN_B: 2
  }
}
```

## Common Tasks

### Debugging

**Enable logging**:
```javascript
Logger.log(`Debug info: ${variable}`);
```

View logs: View > Executions in Apps Script editor

**Use debug functions**:
- Located in 0_debug.gs
- Call from Debug menu (if configured)
- Check sheet existence, data status, configuration

### Adding Menu Items

Edit `onOpen()` in 0_code.gs:

```javascript
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Parish Scheduler')
    .addItem('Show Sidebar', 'showSidebar')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('My Submenu')
      .addItem('My Function', 'myFunctionName'))
    .addToUi();
}
```

### Adding Sidebar Functions

1. Create server function in 0_code.gs (or appropriate module file)
2. Add button/element to Sidebar.html
3. Wire up with `google.script.run`:

```javascript
// In Sidebar.html
google.script.run
  .withSuccessHandler((result) => {
    showSuccess(result);
  })
  .withFailureHandler(showError)
  .myServerFunction(param);
```

### Performance Optimization

**Symptoms of slow performance**:
- Timeout errors
- Long processing times

**Solutions**:
1. Use cached data reading for frequently accessed sheets
2. Build lookup maps before loops (Map/Set faster than array search)
3. Minimize sheet API calls (read once, write once)
4. Use `HELPER_timeFunction()` to identify bottlenecks
5. Consider batch processing for large datasets

### Testing Changes

1. **Test with small dataset first**: Create test volunteer with 1-2 assignments
2. **Use debug functions**: Verify data reads correctly
3. **Check logs**: Use Logger.log extensively
4. **Test edge cases**: Empty data, invalid dates, missing volunteers
5. **Verify output**: Check generated sheets for correctness
6. **Test user flow**: Walk through sidebar operations in order

## Git Workflow

### Current Branch

Development is on branch: `claude/claude-md-mhz0jv6zz49xw27x-01RcM2f8HFfiykgAPhkgyVSg`

### Commit Conventions

Based on recent history:
- Direct file updates: "Update [filename]"
- Keep commits focused on single file/feature when possible
- Frequent small commits preferred over large monolithic commits

### Making Changes

1. Work on designated branch
2. Commit changes with clear messages
3. Push when ready: `git push -u origin <branch-name>`
4. Branch name must start with 'claude/' for proper permissions

## Common Pitfalls to Avoid

### 1. Hardcoded Values

**Don't**:
```javascript
const date = row[0];
const sheetName = "LiturgicalCalendar";
```

**Do**:
```javascript
const date = row[CONSTANTS.COLS.CALENDAR.DATE - 1];
const sheetName = CONSTANTS.SHEETS.CALENDAR;
```

### 2. Timezone Issues

**Don't**:
```javascript
const date = new Date(year, month, day);
```

**Do**:
```javascript
const date = new Date(year, month, day, 12, 0, 0);
```

### 3. Array Index Errors

**Don't**:
```javascript
const value = row[colIndex];
```

**Do**:
```javascript
const value = HELPER_safeArrayAccess(row, colIndex - 1, 'default');
```

### 4. Missing Error Handling

**Don't**:
```javascript
function myFunction() {
  const data = sheet.getData();
  return data.process();
}
```

**Do**:
```javascript
function myFunction() {
  try {
    const data = sheet.getData();
    return data.process();
  } catch (e) {
    Logger.log(`ERROR in myFunction: ${e.message}`);
    throw new Error(`Could not process data: ${e.message}`);
  }
}
```

### 5. Inefficient Data Access

**Don't**:
```javascript
for (let i = 0; i < 100; i++) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');
  const value = sheet.getRange(i, 1).getValue();
}
```

**Do**:
```javascript
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');
const data = sheet.getRange(1, 1, 100, 1).getValues();
for (let i = 0; i < data.length; i++) {
  const value = data[i][0];
}
```

### 6. Case-Sensitive Comparisons

Remember: Ministry roles and preferences are case-insensitive. Always use `.toLowerCase()` when comparing:

```javascript
const roleLower = roleToFill.toLowerCase();
if (volunteer.ministries.includes(roleLower)) { ... }
```

### 7. Destructive Operations Without Warning

Schedule generation (`SCHEDULE_generateScheduleForMonth()`) is destructive - it deletes all assignments for the month. The sidebar includes a confirmation dialog, but programmatic calls should be careful.

## Security & Permissions

**Google Apps Script Scopes**:
- `@OnlyCurrentDoc` directive limits script to current spreadsheet only
- Script requires permissions for:
  - SpreadsheetApp (reading/writing sheets)
  - HtmlService (displaying sidebar)
  - Logger (diagnostics)

**No External API Calls**:
- System is self-contained within Google Sheets
- No external authentication needed
- No sensitive data transmission

## Future Enhancement Ideas

Based on codebase structure, potential enhancements:

1. **Email Notifications**: Notify volunteers of assignments
2. **Calendar Integration**: Sync to Google Calendar
3. **Mobile Forms**: Better timeoff request form
4. **Conflict Detection**: Warn when volunteer double-booked
5. **Historical Analytics**: Track volunteer participation over time
6. **Template Management**: UI for creating/editing Mass templates
7. **Substitute Automation**: Auto-find substitutes for timeoffs
8. **Multi-parish Support**: Scale to multiple parishes

## Production Documentation

The system includes comprehensive documentation to support deployment and testing:

### QUICK_START.md
**Purpose**: 30-minute deployment guide for getting the system into production

**Contents**:
- Step-by-step code file upload instructions
- Required sheets creation and configuration
- Initial setup and first-use workflow
- Data entry tips and examples
- Troubleshooting common issues
- Production checklist

**Target Audience**: Parish administrators deploying the system for the first time

### CALENDAR_VALIDATION.md
**Purpose**: Liturgical calendar accuracy verification

**Contents**:
- Official liturgical dates for 2025-2026
- Easter dates and moveable feast calculations
- Fixed solemnities and USA regional variations
- Manual verification checklist
- Sources for verification (USCCB)

**Target Audience**: Parish administrators validating calendar accuracy before production use

### TESTING_CHECKLIST.md
**Purpose**: Comprehensive pre-production testing suite

**Contents**:
- 10 detailed test scenarios covering all major features
- Pre-testing setup requirements
- Expected results and success criteria
- Performance testing guidelines
- Edge case testing
- Test results log template
- Production readiness criteria

**Target Audience**: Parish administrators and developers validating system before production deployment

### ASSIGNMENT_VALIDATION.md
**Purpose**: Real-time assignment validation system guide

**Contents**:
- How the onEdit validation system works
- Setup instructions for conditional formatting
- Validation checks (status, ministry roles/skills, timeoffs)
- Override workflow and documentation
- Common scenarios and troubleshooting
- Integration with auto-assignment
- Visual feedback and audit trails

**Target Audience**: Parish administrators manually assigning volunteers

**Usage Pattern**:
1. Follow QUICK_START.md to deploy the system
2. Use CALENDAR_VALIDATION.md to verify liturgical accuracy
3. Complete TESTING_CHECKLIST.md with parish data before going live
4. Reference ASSIGNMENT_VALIDATION.md when manually assigning volunteers

## Additional Resources

**Google Apps Script Documentation**:
- [SpreadsheetApp](https://developers.google.com/apps-script/reference/spreadsheet)
- [HtmlService](https://developers.google.com/apps-script/reference/html)
- [Best Practices](https://developers.google.com/apps-script/guides/sheets)

**Liturgical Calendar Resources**:
- General Roman Calendar
- USCCB (United States Conference of Catholic Bishops)
- Table of Liturgical Days (for precedence)

## Questions to Ask When Modifying Code

1. **Which module does this affect?** (Calendar, Schedule, Assignment, Print)
2. **Are there constants to update?** (Sheet names, column indices)
3. **Will this break existing data?** (Schema changes require migration)
4. **Is error handling adequate?** (Try-catch, validation)
5. **Does this affect performance?** (API calls, loop complexity)
6. **Is this user-facing?** (Menu, sidebar, error messages)
7. **Are there edge cases?** (Empty data, invalid dates, missing sheets)
8. **Does this need testing?** (Always yes, but especially for core workflows)

---

**Last Updated**: 2025-12-06

**Codebase Version**: Production-ready with reorganized code structure

**Recent Changes**:
- **Notification System Standardization** (0b_helper.gs, 6_archivelogic.gs, 6_publicschedule.gs, NOTIFICATION_STANDARDS.md):
  - Created standardized notification helper functions in 0b_helper.gs (lines 824-1124)
  - Six helper functions: `HELPER_showAlert()`, `HELPER_showSuccess()`, `HELPER_showError()`, `HELPER_confirmAction()`, `HELPER_promptUser()`, `HELPER_showValidationReport()`
  - Context-aware error messages with automatic troubleshooting hints
  - 8 error contexts supported: calendar, validation, schedule, assignment, timeoffs, print, form, archive
  - Refactored 68 notification calls across high-notification files (6_archivelogic.gs, 6_publicschedule.gs)
  - Consistent emoji usage, formatting, and tone across all user-facing messages
  - Comprehensive documentation in NOTIFICATION_STANDARDS.md (decision trees, examples, migration guide)
  - Hybrid notification architecture: Sidebar for workflows, dialogs for admin tools
  - Added Notification Standards section to CLAUDE.md
- **Code Structure Reorganization** (7_tests.gs, 0_debug.gs):
  - Consolidated all TEST_*.gs files into single `7_tests.gs` file
  - Merged DEBUG functions from `DEBUG_timeoff_analysis.gs` into `0_debug.gs`
  - Deleted obsolete FIX_timeoff_logic.gs (fixes already applied to main code)
  - Added `0_diagnostic.gs` and `6_*.gs` files to file inventory
  - Updated file naming convention to include prefixes 6_ and 7_
  - Reduced file count while maintaining all functionality
- **Ministries Sheet - Master Reference System** (0a_constants.gs, 2_schedulelogic.gs, 3_assignmentlogic.gs, 0c_validation.gs):
  - Added centralized Ministries sheet as master reference for all ministry roles
  - 4 columns: Ministry Name, Role Name, Description, Is Active
  - Serves as single source of truth for what ministries/roles exist in the parish
  - Assignment logic updated to build skill-to-ministry mapping from Ministries sheet
  - Only active roles (Is Active = TRUE) are used in auto-assignment
  - Added comprehensive validation: no duplicate ministry-role combinations
  - Cross-reference validation: MassTemplates and Volunteers must reference valid Ministries entries
  - Supports future multi-ministry expansion (Music, Hospitality, etc.)
  - **MassTemplates simplified to 3 columns**: Template Name, Description, Roles (comma-separated)
  - Removed redundant Ministry Name column from MassTemplates
  - Templates now much more compact (one row per template instead of many)
- **Weekend Grouping for Timeoff Forms** (4_timeoff-form.gs):
  - Saturday vigil and Sunday masses now grouped into single "Weekend of M/D-M/D/YYYY" checkbox
  - Chronological order for all dates (weekends and special liturgical days)
  - Simplified form reduces checkbox count while maintaining granularity via "Additional Details" field
  - Volunteers can specify mass time restrictions (e.g., "Saturday vigil only", "Sunday 10am only") in optional text field
  - System automatically expands weekend selections to both Saturday vigil and Sunday dates
  - Backward compatible with legacy format for existing timeoff data
  - Updated form help text to clarify weekend blocking behavior and mass time restriction options
  - Added TEST_weekendGroupingLogic() function for verifying date extraction logic
- **Real-Time Assignment Validation System** (0d_onedit.gs, 0_code.gs):
  - Added onEdit trigger for automatic validation when manually assigning volunteers
  - Validates volunteer status (must be Active), ministry roles/skills, and timeoff conflicts
  - Warning mode: allows overrides with confirmation dialog and automatic documentation
  - Conditional formatting highlights override assignments in light orange
  - Comprehensive documentation in ASSIGNMENT_VALIDATION.md
  - Menu item: Admin Tools → Setup Assignment Validation
- **Simplified Timeoff Management System** (0a_constants.gs, 0b_helper.gs, 3_assignmentlogic.gs, 4_timeoff-form.gs):
  - Reduced from 5 to 2 timeoff request types: Not Available (blacklist) and Only Available (whitelist)
  - Removed Special Availability, Preference Update, and Status Change types (handled manually in respective sheets)
  - Simplified validation logic and removed auto-processing features
  - Clearer separation of concerns: timeoffs = availability only, preferences/status = manual edits
- Added comprehensive data validation system (0c_validation.gs)
- Implemented automatic backup/restore mechanism for data protection
- Fixed critical bugs in schedule generation and print functions
- Created production deployment documentation (QUICK_START.md, CALENDAR_VALIDATION.md, TESTING_CHECKLIST.md)
- Reorganized liturgical color utilities (0_liturgicalcolors.gs)

**Maintainer Notes**: This is a living document. Update when making significant architectural changes or adding new modules.
