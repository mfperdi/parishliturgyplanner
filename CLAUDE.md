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
0_*.gs        - Core infrastructure (entry point, constants, helpers, debug)
1_*.gs        - Liturgical calendar generation
2_*.gs        - Schedule generation
3_*.gs        - Assignment logic
4_*.gs        - Timeoff management
5_*.gs        - Print/export functionality
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
| `0_debug.gs` | Debugging and diagnostic tools | Debug functions |
| `1_calendarlogic.gs` | Liturgical calendar generation orchestration | `CALENDAR_generateLiturgicalCalendar()` |
| `1a_calendardates.gs` | Moveable feast date calculations | `CALENDAR_calculateLiturgicalDates()` |
| `1b_calendarseasons.gs` | Seasonal celebration logic | `CALENDAR_getSeasonalCelebration()` |
| `2_schedulelogic.gs` | Mass schedule generation with 3-layer logic | `SCHEDULE_generateScheduleForMonth()` |
| `3_assignmentlogic.gs` | Volunteer auto-assignment algorithm | `ASSIGNMENT_autoAssignRolesForMonthOptimized()` |
| `4_timeoff-form.gs` | Timeoff request handling | `TIMEOFFS_*()` functions |
| `5_printschedule.gs` | Print schedule generation | `generatePrintableSchedule()` |
| `Sidebar.html` | HTML/CSS/JavaScript UI | Sidebar interface |

## Data Model

### Google Sheets Structure

The system uses multiple interconnected sheets within a single spreadsheet:

#### Configuration Sheets

**Config** - System settings
- `Setting` (Column A): Setting name
- `Value` (Column B): Setting value
- Key settings: `Year to Schedule`, `Calendar Region`, `Parish Name`

**SaintsCalendar** - Fixed feast days and saints
- Columns: Month, Day, Liturgical Celebration, Rank, Color, Calendar
- Filtered by region (General Roman Calendar, USA, Parish, Diocese)

**CalendarOverrides** - Manual liturgical calendar adjustments
- Columns: Month, Day, Liturgical Celebration, Rank, Color, Calendar, Notes
- Overrides both saints and seasonal celebrations

#### Mass Configuration Sheets

**MassTemplates** - Ministry role definitions
- Columns: Template Name, Ministry Role, Ministry Skill
- Defines which roles are needed for each type of Mass

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
  - **Ministry Sponsor**: Ministry coordinators (manual assignment only)
  - **Parent/Guardian**: Adults accompanying youth (manual assignment only)
- Ministry Role: Comma-separated list (e.g., "Lector, Eucharistic Minister")
- Preferred Mass Time: Event IDs (e.g., "SUN-1000, SAT-1700")
- Ministry Role Preference: Specific roles (e.g., "1st reading, psalm")

**Timeoffs** - Timeoff request tracking with blacklist and whitelist support
- Columns: Timestamp, Volunteer Name, Email, Type, Start Date, End Date, Notes, Status, Reviewed Date, Review Notes
- **Status**: Pending, Approved, Rejected
- **Type** (dropdown):
  - **Unavailable** (blacklist): Volunteer cannot serve on specified dates
  - **Only Available For** (whitelist): Volunteer can ONLY serve on specified Event IDs/dates during the specified period
- **Notes field format** (for "Only Available For" type only):
  - Comma-separated Event IDs and/or specific dates (e.g., "SUN-1000, SAT-1700" or "12/25/2025, 1/1/2026")

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
1. Read active volunteers with ministry qualifications
2. **Build timeoff maps** (approved timeoffs only):
   - **Blacklist** map: Unavailable dates
   - **Whitelist** map: Only Available For dates/Event IDs
   - **Special Availability** map: Override dates/Event IDs
3. Process group assignments first (family teams)
4. Group individual assignments by Mass
5. For each Mass, for each role:
   - **Find eligible volunteers** using enhanced logic:
     1. Must have required ministry skill
     2. Must be Active status
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
6. Mark assignments with status "Assigned"

**Timeoff Logic**:
- **Whitelist** (Only Available For): If a volunteer has a whitelist, they can ONLY be assigned to specified Event IDs or dates during the specified period
- **Blacklist** (Unavailable): Volunteer is excluded from assignment on specified dates
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
2. Validate Volunteers sheet:
   - Unique Volunteer IDs
   - Valid email formats
   - Valid status values (Active, Inactive, Substitute Only, Ministry Sponsor, Parent/Guardian)
   - Valid date formats and logical date ordering
   - No duplicate emails
3. Validate Mass Templates:
   - Template Name and Ministry Role required
   - No empty templates
4. Validate Mass Configuration:
   - Event IDs unique across all three sheets
   - Valid day of week, time formats
   - Templates referenced actually exist
   - Date ranges logical
5. Cross-sheet consistency:
   - Event IDs in preferences exist
   - Volunteer names in timeoffs exist
   - Templates referenced in mass configs exist

**Validation Results**:
- **Errors (❌)**: Critical issues that will cause failures
- **Warnings (⚠️)**: Non-critical issues, recommended to fix
- User-friendly dialog with all findings
- Grouped by category for easy review

**Best Practice**: Run validation before generating calendars or schedules to catch data issues early.

### Workflow 5a: Timeoff Management

**Initial Setup**: Run once to add dropdown validation
- Menu: Admin Tools → Setup Timeoff Validation
- Adds dropdown to TYPE column in Timeoffs sheet

**Workflow Overview**:
The timeoff system supports two request types for managing volunteer availability:

#### 1. Unavailable (Blacklist)
**Use case**: Volunteer cannot serve on specified dates

**Process**:
1. Enter timeoff with TYPE = "Unavailable"
2. Set Start Date and End Date
3. Submit (Status = "Pending")
4. Admin approves request
5. **Result**: Volunteer excluded from auto-assignment for those dates

**Example**: "I'm on vacation 7/1-7/15"
- Type: `Unavailable`
- Start Date: `7/1/2026`
- End Date: `7/15/2026`
- Notes: (optional description)

#### 2. Only Available For (Whitelist)
**Use case**: Volunteer can ONLY serve specific masses or dates during a period

**Process**:
1. Enter timeoff with TYPE = "Only Available For"
2. Set Start Date and End Date (the period this restriction applies)
3. **Notes field**: Enter Event IDs and/or specific dates (e.g., "SUN-1000, SAT-1700" or "12/25/2025, 1/1/2026")
4. Submit and get approved
5. **Result**: During the specified period, volunteer can ONLY be assigned to masses matching the specified Event IDs or dates

**Example**: "I can only serve Saturday 5pm vigil masses this summer"
- Type: `Only Available For`
- Start Date: `6/1/2026`
- End Date: `8/31/2026`
- Notes: `SAT-1700`

**Example**: "I'm only available for Christmas and New Year masses"
- Type: `Only Available For`
- Start Date: `12/1/2025`
- End Date: `1/15/2026`
- Notes: `12/25/2025, 1/1/2026`

**Notes Field Format**:
- Event IDs: 3+ letters, hyphen, 4 digits (e.g., `SUN-1000`, `SAT-1700`)
- Dates: Any standard date format (e.g., `12/25/2025`, `1/1/2026`)
- Multiple values: Comma-separated (e.g., `SUN-1000, SAT-1700, 12/25/2025`)

**Best Practices**:
1. Run Admin Tools → Setup Timeoff Validation once to add TYPE dropdown
2. System validates requests and adds warnings to Review Notes
3. For preference changes (e.g., changing preferred mass times), edit the Volunteers sheet directly
4. For status changes (e.g., marking volunteer as Inactive), edit the Volunteers sheet directly
5. For special event assignments (e.g., manually assigning someone despite unavailability), use the Assignments sheet directly

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
- **Blacklist (Unavailable)**: Volunteer cannot serve on specified dates
- **Whitelist (Only Available For)**: Volunteer can ONLY serve specified Event IDs/dates

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

**Last Updated**: 2025-11-18

**Codebase Version**: Production-ready with real-time assignment validation

**Recent Changes**:
- **Real-Time Assignment Validation System** (0d_onedit.gs, 0_code.gs):
  - Added onEdit trigger for automatic validation when manually assigning volunteers
  - Validates volunteer status (must be Active), ministry roles/skills, and timeoff conflicts
  - Warning mode: allows overrides with confirmation dialog and automatic documentation
  - Conditional formatting highlights override assignments in light orange
  - Comprehensive documentation in ASSIGNMENT_VALIDATION.md
  - Menu item: Admin Tools → Setup Assignment Validation
- **Simplified Timeoff Management System** (0a_constants.gs, 0b_helper.gs, 3_assignmentlogic.gs, 4_timeoff-form.gs):
  - Reduced from 5 to 2 timeoff request types: Unavailable (blacklist) and Only Available For (whitelist)
  - Removed Special Availability, Preference Update, and Status Change types (handled manually in respective sheets)
  - Simplified validation logic and removed auto-processing features
  - Clearer separation of concerns: timeoffs = availability only, preferences/status = manual edits
- Added comprehensive data validation system (0c_validation.gs)
- Implemented automatic backup/restore mechanism for data protection
- Fixed critical bugs in schedule generation and print functions
- Created production deployment documentation (QUICK_START.md, CALENDAR_VALIDATION.md, TESTING_CHECKLIST.md)
- Reorganized liturgical color utilities (0_liturgicalcolors.gs)

**Maintainer Notes**: This is a living document. Update when making significant architectural changes or adding new modules.
