# Parish Liturgical Scheduler - Quick Start Deployment Guide

## 🚀 Production Deployment in 30 Minutes

This guide will help you deploy the Parish Liturgical Scheduler to Google Sheets and start using it with your parish data.

---

## Prerequisites

- Google Account with Google Sheets access
- Basic familiarity with Google Sheets
- Your parish volunteer and Mass schedule data

---

## Deployment Steps

### Step 1: Create New Google Sheets Project (5 minutes)

1. **Go to Google Sheets**: https://sheets.google.com
2. **Create a new spreadsheet**
3. **Name it**: `[Your Parish Name] - Liturgical Scheduler`
4. **Open the Apps Script Editor**:
   - Click `Extensions` > `Apps Script`
   - This opens the Apps Script editor in a new tab

### Step 2: Upload Code Files (10 minutes)

In the Apps Script editor, you need to add all the code files from this repository:

**Required Files (add in this order):**

1. **0_liturgicalcolors.gs** - Liturgical color definitions
2. **0a_constants.gs** - System constants
3. **0b_helper.gs** - Helper functions
4. **0c_validation.gs** - Data validation
5. **0_code.gs** - Main entry point
6. **0_debug.gs** - Debug functions
7. **1_calendarlogic.gs** - Calendar generation
8. **1a_calendardates.gs** - Date calculations
9. **1b_calendarseasons.gs** - Seasonal celebrations
10. **2_schedulelogic.gs** - Schedule generation
11. **3_assignmentlogic.gs** - Volunteer assignment
12. **4_timeoff-form.gs** - Timeoff management
13. **5_printschedule.gs** - Print schedules
14. **Sidebar.html** - User interface

**How to add files:**
- Click the `+` next to "Files" in the left sidebar
- Choose "Script" for .gs files, "HTML" for .html files
- Copy the contents from each file in this repository
- Paste into the Apps Script editor
- Rename the file to match (remove .gs/.html extension in Apps Script)
- Click the disk icon or Ctrl+S to save

**⚠️ IMPORTANT:** Save each file after adding it!

### Step 3: Create Required Sheets (5 minutes)

Go back to your Google Sheets spreadsheet and create these sheets (tabs) with exact names:

**Configuration Sheets:**
1. **Config** - System settings
2. **SaintsCalendar** - Fixed feast days
3. **CalendarOverrides** - Manual calendar adjustments

**Mass Configuration:**
4. **MassTemplates** - Ministry role definitions
5. **WeeklyMasses** - Recurring weekly Masses
6. **MonthlyMasses** - Monthly special Masses
7. **YearlyMasses** - Annual special Masses

**Volunteer Management:**
8. **Volunteers** - Volunteer database
9. **Timeoffs** - Timeoff requests

**Output Sheets:**
10. **LiturgicalCalendar** - Generated calendar (system creates this)
11. **Assignments** - Generated assignments (system creates this)

**How to create sheets:**
- Click the `+` button at the bottom left to add a new sheet
- Right-click the sheet tab > `Rename` to set the name

### Step 4: Set Up Config Sheet (2 minutes)

In the **Config** sheet, add this structure:

| Setting | Value |
|---------|-------|
| Year to Schedule | 2025 |
| Parish Name | St. Example Parish |
| Calendar Region | USA |

**Column A:** Setting names (text)
**Column B:** Values (text or number)

**Required Settings:**
- `Year to Schedule`: The year you want to schedule (e.g., 2025, 2026)
- `Parish Name`: Your parish name (appears on print schedules)
- `Calendar Region`: USA, General Roman Calendar, Canada, etc.

### Step 5: Add Sheet Headers (5 minutes)

Each sheet needs column headers. Here are the most important ones:

**Volunteers Sheet Headers (Row 1):**
```
Volunteer ID | First Name | Last Name | Full Name | Email | Phone | Parent/Guardian Name | Family Team | Status | Ministry Role | Preferred Mass Time | Ministry Role Preference | Date Cleared | Date Trained
```

**MassTemplates Sheet Headers:**
```
Template Name | Ministry Role | Ministry Skill
```

**WeeklyMasses Sheet Headers:**
```
Event ID | Day of Week | Time | Start Date | End Date | Is Active | Is Anticipated | Description | Template Name | Assigned Group | Notes
```

**MonthlyMasses Sheet Headers:**
```
Event ID | Week of Month | Day of Week | Time | Start Date | End Date | Is Active | Is Anticipated | Override Type | Description | Template Name | Assigned Group | Notes
```

**YearlyMasses Sheet Headers:**
```
Event ID | Date | Liturgical Celebration | Time | Is Active | Is Anticipated | Override Type | Description | Template Name | Assigned Group | Notes
```

**Timeoffs Sheet Headers:**
```
Timestamp | Volunteer Name | Email | Type | Start Date | End Date | Notes | Status | Reviewed Date | Review Notes
```

**📝 Tip:** The system will create LiturgicalCalendar and Assignments sheets automatically when you run the first generation.

### Step 6: Reload and Test (3 minutes)

1. **Refresh your Google Sheets tab**
2. **You should see a new menu**: `Parish Scheduler`
3. **Click** `Parish Scheduler` > `Show Sidebar`
4. **The sidebar should appear** on the right side

**If you don't see the menu:**
- Close and reopen the spreadsheet
- Wait 10 seconds after reopening
- Check the Apps Script project has all files saved

### Step 7: Validate Your Data (2 minutes)

Before generating anything:

1. Click `Parish Scheduler` menu > `Admin Tools` > `Validate Data`
2. Review any errors or warnings
3. Fix critical errors (marked with ❌)
4. Warnings (⚠️) are optional but recommended to fix

**Common Issues:**
- Missing required settings in Config
- Duplicate Volunteer IDs
- Invalid email formats
- Templates referenced but not defined

---

## First Use Workflow

### Generate Liturgical Calendar (Once per year)

1. Open sidebar: `Parish Scheduler` > `Show Sidebar`
2. Click **"Generate Calendar"** button
3. Confirm the action (it takes 10-30 seconds)
4. Success! You should see the LiturgicalCalendar sheet populated

**What this does:**
- Calculates Easter and all moveable feasts
- Generates liturgical calendar for the entire year
- Assigns proper liturgical colors and seasons
- Handles regional variations (USA, Canada, etc.)

### Generate Monthly Schedule

1. In the sidebar, **select a month** from the dropdown
2. Click **"Generate Schedule"** button
3. **Confirm** the action (IMPORTANT: This deletes existing assignments for that month)
4. Review the Assignments sheet - you'll see all ministry roles listed as "Unassigned"

**What this does:**
- Creates ministry assignments for all Masses in the month
- Uses 3-layer logic: Weekly → Monthly → Yearly Masses
- Handles anticipated Masses (Saturday vigils)
- Creates unassigned placeholders for all roles

### Auto-Assign Volunteers

1. **Review timeoffs** (click "Review Timeoffs" button) - optional but recommended
2. Click **"Auto-Assign Volunteers"** button
3. The system assigns volunteers based on:
   - Ministry qualifications
   - Availability (not on timeoff)
   - Preferences (Mass times, specific roles)
   - Family team assignments
   - Fair distribution (balances assignments)

**What this does:**
- Finds qualified volunteers for each role
- Respects timeoff requests
- Prefers volunteers with matching preferences
- Tries to assign families together
- Distributes assignments fairly

### Print Schedule

1. Click **"Print Schedule"** button
2. A new sheet "MonthlyView" is created
3. Review the formatted schedule
4. Print or export to PDF

**What you get:**
- Liturgical color-coded sections
- Grouped by liturgical celebration
- Professional formatting
- Summary statistics
- Easy to read and distribute

---

## Data Entry Tips

### Volunteers

**Minimum Required:**
- Volunteer ID (unique, e.g., V001, V002)
- Full Name
- Status (Active, Inactive, or Training)
- Ministry Role (comma-separated: "Lector, Eucharistic Minister")

**Optional but Recommended:**
- Email (for future notifications)
- Preferred Mass Time (Event IDs like "SUN-1000")
- Ministry Role Preference ("1st reading, psalm")
- Family Team ("Smith Family" - keeps families together)

**Example Row:**
```
V001 | John | Smith | John Smith | john@email.com | 555-1234 | | Smith Family | Active | Lector, Eucharistic Minister | SUN-1000 | 1st reading | 1/1/2024 | 1/15/2024
```

### Mass Templates

Define what roles are needed for each type of Mass.

**Example: Sunday Family Mass**
```
Template Name      | Ministry Role          | Ministry Skill
Sunday Family Mass | Lector                | Reading
Sunday Family Mass | Eucharistic Minister 1 | Distribution
Sunday Family Mass | Eucharistic Minister 2 | Distribution
Sunday Family Mass | Altar Server 1        | Serving
Sunday Family Mass | Altar Server 2        | Serving
Sunday Family Mass | Usher 1               | Hospitality
Sunday Family Mass | Usher 2               | Hospitality
```

**Example: Weekday Mass**
```
Template Name | Ministry Role         | Ministry Skill
Weekday Mass  | Lector               | Reading
Weekday Mass  | Eucharistic Minister | Distribution
Weekday Mass  | Altar Server         | Serving
```

### Weekly Masses

**Example: Sunday 10:00 AM Mass**
```
Event ID  | Day of Week | Time     | Start Date | End Date | Is Active | Is Anticipated | Description        | Template Name      | Assigned Group | Notes
SUN-1000  | Sunday      | 10:00 AM |           |          | TRUE      | FALSE          | Sunday Family Mass | Sunday Family Mass |               |
```

**Example: Saturday Vigil**
```
Event ID  | Day of Week | Time    | Start Date | End Date | Is Active | Is Anticipated | Description      | Template Name      | Assigned Group | Notes
SAT-1700  | Saturday    | 5:00 PM |           |          | TRUE      | TRUE           | Saturday Vigil   | Sunday Family Mass |               |
```

**Tips:**
- Leave Start Date/End Date blank for "all year"
- Is Anticipated = TRUE for Saturday vigils (uses next day's liturgy)
- Event ID should be unique and memorable (used in preferences)

---

## Troubleshooting

### Problem: Menu doesn't appear
**Solution:**
- Close and reopen the spreadsheet
- Wait 10-20 seconds after opening
- Check that all code files are saved in Apps Script

### Problem: "Sheet not found" error
**Solution:**
- Verify all required sheets exist
- Check spelling exactly matches (case-sensitive)
- Run `Admin Tools` > `Debug Functions` to see which sheets are missing

### Problem: Calendar generation fails
**Solution:**
- Check Config sheet has "Year to Schedule" set
- Year must be between 2020-2050
- Run `Admin Tools` > `Validate Data` first

### Problem: No volunteers assigned
**Solution:**
- Check volunteers have Status = "Active"
- Verify Ministry Role matches template roles (case-insensitive)
- Check for timeoff conflicts
- Review assignment logs: `Extensions` > `Apps Script` > `Executions`

### Problem: Wrong liturgical dates
**Solution:**
- Verify Calendar Region is set correctly in Config
- Check CalendarOverrides sheet for manual adjustments
- Easter calculation is automatic and should be accurate

### Problem: Accidentally deleted assignments
**Solution:**
- The system auto-backs up before deletion
- Backups stored in hidden sheet `_AssignmentBackups`
- Can restore from Apps Script: Run `SCHEDULE_restoreBackup("2025-01")`

---

## Data Backup Strategy

**Automatic Backups:**
- System backs up assignments before regenerating schedule
- Keeps last 5 backups per month
- Stored in hidden `_AssignmentBackups` sheet

**Manual Backups:**
- Use `Admin Tools` > `Export Data` to create full copy
- Recommend weekly exports during active scheduling

**Best Practice:**
- Make a copy of the entire spreadsheet before major changes
- `File` > `Make a copy` in Google Sheets

---

## Next Steps

1. ✅ **Enter your parish data** (volunteers, mass times, templates)
2. ✅ **Run validation** (`Admin Tools` > `Validate Data`)
3. ✅ **Generate calendar** for your year
4. ✅ **Test with one month** first before doing the whole year
5. ✅ **Review auto-assignments** - adjust volunteer preferences if needed
6. ✅ **Print and distribute** your first schedule!

---

## Getting Help

**Check Logs:**
- `Extensions` > `Apps Script` > `Executions`
- Shows detailed logs of what happened
- Look for errors in red

**Debug Panel:**
- `Parish Scheduler` > `Admin Tools` > `Debug Functions`
- Shows sheet status and data counts

**Common Issues:**
- Most errors are data validation issues
- Run validation first to catch problems early
- Check CLAUDE.md for detailed technical documentation

---

## Advanced Features

### Family Teams
- Set the same "Family Team" name for family members
- System tries to assign families to same Masses (+25 point bonus)

### Timeoff Management
- Volunteers can submit timeoff requests
- Review with "Review Timeoffs" button
- System respects approved timeoffs during assignment

### Print Options
- **Liturgical Schedule**: Groups by liturgical celebration (color-coded)
- **Standard Schedule**: Chronological order
- Both show unassigned roles highlighted

### Manual Adjustments
- Edit assignments directly in Assignments sheet
- Change "Unassigned" to volunteer name
- Update Status to "Assigned"

---

## Production Checklist

Before going live:

- [ ] All code files uploaded to Apps Script
- [ ] All required sheets created with correct names
- [ ] Config sheet populated (year, parish name, region)
- [ ] Volunteer data entered and validated
- [ ] Mass templates defined
- [ ] Weekly Masses configured
- [ ] Data validation passed (no errors)
- [ ] Test calendar generated successfully
- [ ] Test schedule generated for one month
- [ ] Test auto-assignment works
- [ ] Print schedule looks correct
- [ ] Backup created (`File` > `Make a copy`)

---

**🎉 You're ready to schedule!**

Start with one month, verify the results, then expand to your full schedule. The system handles the complex liturgical calendar calculations and volunteer optimization automatically.

For technical details and troubleshooting, see **CLAUDE.md**.
