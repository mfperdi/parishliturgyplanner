# January 2026 Schedule Regeneration Guide

## Overview

This guide walks you through regenerating the January 2026 schedule to respect the newly approved timeoffs. The current assignments were created **before** the timeoffs were approved, which is why volunteers with approved timeoffs are currently assigned.

## Why Regeneration is Needed

**Root Cause**: Auto-assignment only fills in "Unassigned" slots. It **does not update existing assignments** to respect new timeoffs.

**Current Situation**:
- Timeoffs approved: 12/2/2025 (today)
- Assignments created: Before 12/2/2025
- Result: 5 volunteers assigned despite approved timeoffs

**Violations**:
1. Margie Weiner - Assigned 1/3/2026 (blacklisted)
2. Melissa Guba - Assigned 1/10/2026 (blacklisted)
3. Melissa Guba - Assigned 1/31/2026 (blacklisted)
4. Hanalei Savala - Assigned 1/25/2026 (blacklisted)
5. Mark Perdiguerra - Assigned 1/31/2026 (not in whitelist)

## Bugs Fixed

Before regenerating, the following bugs have been fixed in `3_assignmentlogic.gs`:

### Bug #1: Month Boundary Comparison (Jan 31 Bug)
- **Problem**: `monthEnd` was set to midnight (00:00:00) of the last day, but parsed dates are at noon (12:00:00)
- **Result**: Last-day-of-month timeoffs were excluded from blacklist/whitelist maps
- **Fix**: `monthEnd` now set to 23:59:59.999 (end of day)
- **Impact**: Jan 31 timeoffs will now be properly respected

### Bug #2: Spillover Date Handling
- **Problem**: January assignments include Feb 1 (spillover Sunday), but Feb 1 timeoffs were excluded from January's timeoff map
- **Result**: Feb 1 timeoffs ignored when running auto-assignment for January
- **Fix**: Function now detects spillover dates from Assignments sheet and includes them in timeoff maps
- **Impact**: Spillover dates will now respect timeoffs

## Regeneration Workflow

### Step 1: Generate Schedule for January 2026

**Action**: In the Parish Scheduler sidebar, select "January 2026" and click "Generate Schedule"

**What This Does**:
- **DESTRUCTIVE**: Clears ALL existing assignments for January 2026
- Creates fresh unassigned slots for all Masses in January
- Includes spillover dates (Feb 1) if applicable
- Preserves all other data (liturgical calendar, volunteers, timeoffs)

**Warning**: Any manual adjustments made to January assignments will be lost. If you have manual assignments you want to preserve, note them down before proceeding.

### Step 2: Auto-Assign Volunteers

**Action**: Click "Auto-Assign Volunteers"

**What This Does**:
- Reads all approved timeoffs (including the 4 newly approved ones)
- Builds blacklist and whitelist maps with the FIXED logic (includes Jan 31, spillovers)
- Assigns volunteers to unassigned roles while respecting:
  - Blacklists (cannot serve dates)
  - Whitelists (can only serve specific dates)
  - Ministry qualifications
  - Volunteer preferences
  - Family team bonuses

**Expected Results**:
- ✅ Margie Weiner will NOT be assigned to 1/3 or 1/4 (blacklisted)
- ✅ Melissa Guba will NOT be assigned to 1/10, 1/11, 1/31, or 2/1 (blacklisted)
- ✅ Hanalei Savala will NOT be assigned to 1/17, 1/18, 1/24, or 1/25 (blacklisted)
- ✅ Mark Perdiguerra will ONLY be assigned to 1/10, 1/11, 1/24, or 1/25 (whitelisted)

### Step 3: Review Assignments

**Action**: Check the Assignments sheet for January 2026

**What to Verify**:
1. All 5 previously violating assignments should now have different volunteers
2. Volunteers with approved timeoffs should not appear on their blacklisted dates
3. Mark Perdiguerra should only appear on 1/10, 1/11, 1/24, or 1/25
4. No "Unassigned" slots remain (or understand why if some do)

### Step 4: Handle Any Remaining Unassigned Slots

**Possible Reasons for Unassigned Slots**:
- Not enough qualified volunteers available (due to timeoffs)
- All qualified volunteers already assigned that day
- Whitelist restrictions too strict (no eligible volunteers)

**Solutions**:
- Manually assign a qualified volunteer
- Assign a "Substitute Only" volunteer (requires manual assignment)
- Contact volunteers to see if anyone can make an exception
- Adjust Mass templates if role requirements are too strict

## Testing the Fix (Optional)

If you want to verify the fix before regenerating, run these debug functions in Google Apps Script:

### Test Month Boundary Fix
```javascript
DEBUG_testMonthBoundaryFix()
```

**Expected Output**:
- Melissa's blacklist includes Jan 31 with "vigil" mass type
- Mark's whitelist does NOT include Jan 31

### Test Full Timeoff Enforcement
```javascript
DEBUG_analyzeTimeoffEnforcement()
```

**Expected Output**:
- All timeoff maps show correct dates
- All 5 violations show "SHOULD BE BLOCKED"

## Best Practices Going Forward

### Workflow Recommendations

1. **Approve Timeoffs BEFORE Running Auto-Assignment**
   - Review and approve all pending timeoffs first
   - Then generate schedule and run auto-assignment
   - This ensures timeoffs are respected from the start

2. **Update Timeoff Form Monthly**
   - Before opening timeoff submissions, update the form with current month's dates
   - Use: Sidebar → "Update Timeoff Form" → Select month
   - This keeps form date checkboxes current

3. **Review Timeoffs Promptly**
   - Set a deadline for timeoff submissions (e.g., 2 weeks before month start)
   - Review and approve/reject within 2-3 days
   - Generate schedule only after timeoff review is complete

4. **Manual Assignment Overrides**
   - If you need to manually override an assignment after auto-assignment runs
   - Use the real-time validation feature (Admin Tools → Setup Assignment Validation)
   - System will warn you about conflicts and let you confirm overrides

### Monthly Checklist

**Week 1 (3-4 weeks before month)**:
1. Update timeoff form for upcoming month
2. Email link to volunteers with submission deadline

**Week 2 (2-3 weeks before month)**:
3. Review pending timeoff requests
4. Approve/reject with notes
5. Generate schedule for the month (clears old assignments)
6. Run auto-assignment (respects approved timeoffs)

**Week 3 (1-2 weeks before month)**:
7. Review assignments for any issues
8. Make manual adjustments if needed
9. Generate printable schedule
10. Distribute to volunteers

**Week 4 (week before month)**:
11. Handle any last-minute changes
12. Final review and distribution

## Troubleshooting

### Issue: "No active volunteers found"
**Cause**: All volunteers in Volunteers sheet have non-Active status
**Solution**: Check Volunteers sheet Status column - ensure you have volunteers marked as "Active"

### Issue: Many unassigned roles after auto-assignment
**Cause**: Too many timeoffs or not enough qualified volunteers
**Solution**:
- Review timeoff approvals - can any be rejected with reason?
- Check if volunteers are properly qualified (Ministry Role column)
- Consider recruiting more volunteers for high-demand roles
- Manually assign Substitute Only volunteers

### Issue: Family members not being assigned together
**Cause**: Family Team field not populated or preferences conflict
**Solution**:
- Check Family Team column in Volunteers sheet
- Ensure family members have compatible ministry qualifications
- Family bonus is +25 points but doesn't guarantee assignment

### Issue: Volunteer assigned despite timeoff
**Cause**: Timeoff status is "Pending" or "Rejected", not "Approved"
**Solution**:
- Check Timeoffs sheet Status column
- Only "Approved" timeoffs are enforced
- Approve the timeoff and regenerate the schedule

## Summary

✅ **Fixes Applied**: Month boundary and spillover date bugs resolved
✅ **Root Cause Identified**: Assignments created before timeoffs approved
✅ **Solution**: Regenerate schedule to respect approved timeoffs
✅ **Testing Available**: Debug functions to verify fix
✅ **Workflow Documented**: Best practices to prevent future issues

**Next Step**: Generate Schedule for January 2026 → Auto-Assign Volunteers → Review Results

---

**Questions?** Check the execution logs in Google Apps Script for detailed debugging info, or review the code comments in `3_assignmentlogic.gs` for implementation details.
