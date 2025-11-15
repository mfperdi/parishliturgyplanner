# Testing Checklist - Pre-Production Validation

Use this checklist to test the Parish Liturgical Scheduler with your own parish data before going live.

---

## Pre-Testing Setup

- [ ] All code files uploaded to Google Apps Script
- [ ] All required sheets created
- [ ] Config sheet populated
- [ ] Volunteer data entered
- [ ] Mass templates defined
- [ ] Weekly Masses configured
- [ ] Data validation passed (no critical errors)

---

## Test 1: Data Validation ✓

**Goal**: Ensure all data is valid before generating anything

1. [ ] Click `Parish Scheduler` > `Admin Tools` > `Validate Data`
2. [ ] Review results dialog
3. [ ] **Fix all errors** (marked with ❌)
4. [ ] **Consider fixing warnings** (marked with ⚠️)
5. [ ] Re-run validation until no errors

**Expected Result**: "All validation checks passed!" or "No critical errors found"

**If Failed**: Review error messages and fix data issues

---

## Test 2: Liturgical Calendar Generation ✓

**Goal**: Generate accurate liturgical calendar

1. [ ] Open sidebar: `Parish Scheduler` > `Show Sidebar`
2. [ ] Click **"Generate Calendar"** button
3. [ ] Confirm the action
4. [ ] Wait for completion (10-30 seconds)
5. [ ] Check LiturgicalCalendar sheet exists and is populated
6. [ ] Verify 365 rows (or 366 for leap year)

**Spot Checks** (using CALENDAR_VALIDATION.md):
- [ ] Easter Sunday date is correct for your year
- [ ] December 25 shows "The Nativity of the Lord" (White)
- [ ] First Sunday of Advent is correct
- [ ] Ash Wednesday date is correct
- [ ] Liturgical colors look reasonable (White, Green, Violet, Red)

**Expected Result**: Full calendar for the year with correct major dates

**If Failed**:
- Check Config "Year to Schedule" is set
- Review calendar accuracy in CALENDAR_VALIDATION.md
- Check execution logs for errors

---

## Test 3: Monthly Schedule Generation ✓

**Goal**: Generate Mass schedule with ministry roles

**Pick a test month** (suggest current month + 1)

1. [ ] In sidebar, select your test month from dropdown
2. [ ] Click **"Generate Schedule"** button
3. [ ] **Read the confirmation** carefully
4. [ ] Confirm the action
5. [ ] Wait for completion
6. [ ] Check Assignments sheet

**Verify**:
- [ ] Assignments sheet has new rows for your month
- [ ] Each Mass has multiple ministry roles listed
- [ ] All roles show Status = "Unassigned"
- [ ] Liturgical Celebration column is populated
- [ ] Month-Year column matches your selected month
- [ ] Event IDs match your Weekly/Monthly/Yearly Masses

**Count Check**:
- Expected roles = (Number of Masses) × (Roles per template)
- Example: 4 Sunday Masses × 7 roles = 28 unassigned roles minimum

**Expected Result**: All ministry roles created as "Unassigned" for the month

**If Failed**:
- Check mass configuration sheets (Weekly/Monthly/Yearly)
- Verify templates exist
- Check Event IDs are unique
- Review logs for specific errors

---

## Test 4: Auto-Assignment ✓

**Goal**: Assign volunteers to ministry roles automatically

**Prerequisites**:
- At least 5-10 active volunteers entered
- Volunteers have ministry roles that match template roles
- Schedule already generated for test month

1. [ ] In sidebar, **same month** as Test 3
2. [ ] Click **"Auto-Assign Volunteers"** button
3. [ ] Wait for completion
4. [ ] Review Assignments sheet

**Verify**:
- [ ] Some roles now have volunteer names assigned
- [ ] Status changed from "Unassigned" to "Assigned"
- [ ] Assigned Volunteer ID and Name columns populated
- [ ] No volunteer assigned to same Mass twice
- [ ] Volunteers assigned to roles they're qualified for

**Expected Assignment Rate**:
- **Good**: 60-80% of roles assigned
- **Excellent**: 80%+ of roles assigned
- **Needs attention**: <50% assigned

**Reasons for unassigned roles**:
- Not enough qualified volunteers for that role
- All qualified volunteers on timeoff that day
- Volunteer already assigned to another role same Mass
- Volunteer already assigned that day

**Expected Result**: Majority of roles assigned to qualified volunteers

**If Failed**:
- Check volunteer Status = "Active"
- Verify Ministry Role field matches template roles (case-insensitive)
- Add more volunteers for underserved roles
- Check logs for specific assignment decisions

---

## Test 5: Timeoff Handling ✓

**Goal**: Ensure system respects volunteer availability

1. [ ] Add a test timeoff in Timeoffs sheet:
   - Timestamp: Now
   - Volunteer Name: (Pick an active volunteer)
   - Start Date: (A date in your test month)
   - End Date: (Same or next day)
   - Status: Approved
2. [ ] **Re-run** "Auto-Assign Volunteers" for same month
3. [ ] Check Assignments sheet

**Verify**:
- [ ] Volunteer is NOT assigned on their timeoff dates
- [ ] Volunteer may still be assigned on other dates

**Expected Result**: System respects approved timeoffs

**If Failed**:
- Check timeoff Status = "Approved" (not Pending or Rejected)
- Verify volunteer name exactly matches Volunteers sheet
- Check date format is valid

---

## Test 6: Print Schedule ✓

**Goal**: Generate formatted printable schedule

1. [ ] In sidebar, select your test month
2. [ ] Click **"Print Schedule"** button
3. [ ] Wait for completion
4. [ ] Check MonthlyView sheet

**Verify**:
- [ ] New sheet "MonthlyView" created
- [ ] Parish name appears at top
- [ ] Month and year shown
- [ ] Masses grouped by liturgical celebration
- [ ] Liturgical colors visible (colored backgrounds)
- [ ] Rank/Season/Color information shown
- [ ] Ministry roles and assigned volunteers listed
- [ ] Unassigned roles highlighted (pink background)
- [ ] Summary statistics at bottom

**Print Test**:
- [ ] File > Print > Preview
- [ ] Check if it fits on standard pages
- [ ] Readable font size
- [ ] Colors print clearly (or switch to black & white)

**Expected Result**: Professional-looking schedule ready for distribution

**If Failed**:
- Check assignments exist for the month
- Verify print schedule code has no errors
- Try regenerating

---

## Test 7: Data Protection ✓

**Goal**: Verify version history provides data recovery

**Test Version History Access**:
1. [ ] Click `File` > `Version History` > `See version history`
2. [ ] Verify you can see past versions with timestamps
3. [ ] Browse through recent changes
4. [ ] Verify you can see who made changes (if shared spreadsheet)

**Test Recovery (Optional)**:
1. [ ] Make a small test change (e.g., edit a volunteer name)
2. [ ] Open version history
3. [ ] Find version before the change
4. [ ] Click "Restore this version"
5. [ ] Verify change was reverted

**Expected Result**: Version history accessible and can restore previous versions

**Note**: This is Google Sheets' built-in feature, not custom code

---

## Test 8: Edge Cases ✓

**Goal**: Test system handles unusual scenarios

**Empty Month Test**:
- [ ] Select a month with no Masses configured
- [ ] Generate schedule
- [ ] Should complete with "0 roles created" message

**All Volunteers on Timeoff**:
- [ ] Mark all volunteers on timeoff for one day
- [ ] Generate and assign for that month
- [ ] Roles for that day should remain unassigned

**Duplicate Event ID** (should fail validation):
- [ ] Temporarily add duplicate Event ID in WeeklyMasses
- [ ] Run data validation
- [ ] Should show error
- [ ] Fix before proceeding

**Invalid Date**:
- [ ] Enter invalid date in Volunteers "Date Cleared"
- [ ] Run validation
- [ ] Should show error

**Expected Result**: System handles errors gracefully without crashing

---

## Test 9: Multi-Month Workflow ✓

**Goal**: Test full workflow for multiple months

1. [ ] Generate schedule for Month 1
2. [ ] Auto-assign volunteers
3. [ ] Generate schedule for Month 2
4. [ ] Auto-assign volunteers
5. [ ] Generate schedule for Month 3
6. [ ] Auto-assign volunteers

**Verify**:
- [ ] All three months have assignments
- [ ] Volunteers distributed fairly across months
- [ ] No single volunteer over-burdened
- [ ] Family teams served together when possible

**Check Assignment Distribution**:
- Review Assignments sheet
- Count how many times each volunteer assigned
- Should be reasonably balanced (±2 assignments)

**Expected Result**: Fair distribution across multiple months

---

## Test 10: User Workflow ✓

**Goal**: Test the complete monthly scheduling routine

**Simulate monthly workflow**:
1. [ ] Select next month
2. [ ] Review timeoffs (if any)
3. [ ] Generate schedule
4. [ ] Auto-assign volunteers
5. [ ] Review unassigned roles
6. [ ] Manually assign 1-2 substitutes (edit Assignments sheet)
7. [ ] Generate print schedule
8. [ ] Review and export

**Time yourself**: Should take < 15 minutes for routine month

**Expected Result**: Complete workflow smooth and intuitive

**If Slow or Confusing**:
- Note what was unclear
- Check if validation helps
- Review Quick Start guide

---

## Performance Tests

**Large Dataset Test** (if you have 50+ volunteers):
- [ ] Generate schedule for full month
- [ ] Should complete in < 2 minutes
- [ ] Auto-assignment should complete in < 1 minute

**Full Year Test**:
- [ ] Generate calendar (once)
- [ ] Generate schedule for 3-4 months
- [ ] Check no timeout errors
- [ ] Review execution logs for performance

**Expected Result**: No timeout errors, reasonable speed

---

## Final Pre-Production Checklist

Before using for real scheduling:

- [ ] All critical tests passed
- [ ] Calendar dates verified accurate
- [ ] Schedule generation works reliably
- [ ] Auto-assignment produces good results
- [ ] Print schedule looks professional
- [ ] Backup system working
- [ ] Full spreadsheet backup created (`File` > `Make a copy`)
- [ ] Comfortable with the workflow
- [ ] Know how to check logs if errors occur
- [ ] Understand manual assignment process

---

## Post-Production Monitoring

**First Week**:
- [ ] Check execution logs daily
- [ ] Note any errors or warnings
- [ ] Review volunteer feedback
- [ ] Track time to complete monthly workflow

**First Month**:
- [ ] Verify all Masses covered
- [ ] Check volunteer distribution fairness
- [ ] Note any assignment issues
- [ ] Adjust volunteer preferences if needed

**Ongoing**:
- [ ] Run validation before each schedule generation
- [ ] Review timeoffs before auto-assignment
- [ ] Export backup before major changes
- [ ] Keep notes on improvements needed

---

## Troubleshooting During Testing

**Problem**: Test fails
**Action**:
1. Check execution logs (`Extensions` > `Apps Script` > `Executions`)
2. Note exact error message
3. Run data validation
4. Check QUICK_START.md troubleshooting section
5. Review CLAUDE.md for technical details

**Problem**: Results unexpected
**Action**:
1. Re-read what the function should do
2. Check your input data
3. Verify configuration
4. Try with minimal test data first

**Problem**: System slow
**Action**:
1. Check dataset size (100+ volunteers may be slower)
2. Review logs for bottlenecks
3. Consider processing fewer months at once

---

## Test Results Log

Document your test results:

| Test | Date | Result | Notes |
|------|------|--------|-------|
| Data Validation | | ☐ Pass ☐ Fail | |
| Calendar Generation | | ☐ Pass ☐ Fail | |
| Schedule Generation | | ☐ Pass ☐ Fail | |
| Auto-Assignment | | ☐ Pass ☐ Fail | |
| Timeoff Handling | | ☐ Pass ☐ Fail | |
| Print Schedule | | ☐ Pass ☐ Fail | |
| Data Protection | | ☐ Pass ☐ Fail | |
| Edge Cases | | ☐ Pass ☐ Fail | |
| Multi-Month | | ☐ Pass ☐ Fail | |
| User Workflow | | ☐ Pass ☐ Fail | |

**Overall System Status**: ☐ READY FOR PRODUCTION ☐ NEEDS FIXES

---

## Success Criteria

**Minimum for Production:**
- ✅ Data validation passes
- ✅ Calendar generates with correct Easter date
- ✅ Schedule generates without errors
- ✅ Auto-assignment works (even if <100% coverage)
- ✅ Print schedule looks acceptable
- ✅ Backups working

**Ideal for Production:**
- All minimum criteria +
- ✅ 80%+ auto-assignment coverage
- ✅ Timeoffs respected
- ✅ Fair volunteer distribution
- ✅ Professional print output
- ✅ < 15 minute monthly workflow

---

**🎯 Once all critical tests pass, you're ready for production!**

Start with one real month, verify results with parish staff, then expand to full schedule.
