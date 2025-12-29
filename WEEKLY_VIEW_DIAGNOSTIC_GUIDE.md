# Weekly View Diagnostic Guide

## Issue
The weekly view for December 28, 2025 - January 4, 2026 is not showing assignments for 12/31/2025 and 1/1/2026, even though they exist in the Assignments sheet.

## Diagnostic Steps

### Step 1: Run Diagnostic Test

1. Open the Google Apps Script editor (Extensions > Apps Script)
2. In the Script Editor, select the function `TEST_checkWeeklyViewData` from the dropdown
3. Click the Run button (▶️)
4. Grant permissions if prompted
5. Wait for it to complete

### Step 2: View Execution Logs

1. In the Script Editor, click View > Executions
2. Click on the most recent execution
3. Review the logs for:
   - Week boundaries being calculated
   - Which dates are "IN WEEK" vs "NOT IN WEEK"
   - How many assignments found in Assignments sheet for each date
   - How many assignments loaded into weekly schedule data
   - Any ERROR messages

### Step 3: Share Logs

Copy the relevant log output and share it. Key things to look for:

**Expected results:**
```
Date filtering tests:
  Dec 31, 2025 (Wed): ✓ IN WEEK
  Jan 1, 2026 (Thu): ✓ IN WEEK
  Jan 3, 2026 (Sat): ✓ IN WEEK
  Jan 4, 2026 (Sun): ✓ IN WEEK

Assignments in Assignments sheet:
  Dec 31, 2025 (Wed): 2 assignments (Month-Year: 2025-12)
  Jan 1, 2026 (Thu): 10 assignments (Month-Year: 2025-12)
  Jan 3, 2026 (Sat): 2 assignments (Month-Year: 2026-01)
  Jan 4, 2026 (Sun): 10 assignments (Month-Year: 2026-01)

  Assignments by date:
    Dec 31, 2025 (Wed): 2 assignments
    Jan 1, 2026 (Thu): 10 assignments
    Jan 3, 2026 (Sat): 2 assignments
    Jan 4, 2026 (Sun): 10 assignments
```

**If you see different results**, that will help identify the issue.

### Step 4: Check Enhanced Logs in Weekly View Generation

After running the diagnostic test, try generating the weekly view again:

1. Go to the sidebar
2. Select "Weekly View"
3. Generate the view
4. Go back to Script Editor > View > Executions
5. Look for the detailed logs that now include:
   - "Filtering X assignments to week range"
   - Individual assignment checks showing "inWeek: true/false"
   - "Total assignments: X, Weekend: Y, Weekday: Z"

## Common Issues

### Issue 1: Date Filtering
**Symptom:** Logs show "NOT IN WEEK" for 12/31 or 1/1

**Cause:** Week boundary calculation issue

**Solution:** Check that week boundaries are correct (Sunday to Saturday)

### Issue 2: No Assignments Found
**Symptom:** Logs show "NO ASSIGNMENTS FOUND" for 12/31 or 1/1

**Possible causes:**
- Assignments not in Assignments sheet
- Month-Year column has unexpected value
- Assignments were deleted

**Solution:**
- Check Assignments sheet directly
- Filter by Date column for 12/31/2025 and 1/1/2026
- Check Month-Year column value (should be "2025-12")

### Issue 3: Assignments Loaded but Not Displayed
**Symptom:** Logs show assignments loaded but they don't appear in weekly view

**Cause:** Categorization or rendering issue

**Solution:** Check the weekend/weekday categorization in logs

### Issue 4: Month-Year Mismatch
**Symptom:** Assignments have Month-Year "2026-01" instead of "2025-12"

**Cause:** Schedule was regenerated and assignments were moved to January

**Solution:**
- The assignments should have Month-Year "2025-12" since they're part of the December/Christmas season
- If they're in "2026-01", you may need to regenerate the December schedule to include the 1/1/2026 masses

## Next Steps

Based on the diagnostic results, we can:
1. Identify the exact point of failure
2. Create a targeted fix
3. Verify the fix resolves the issue

Please run the diagnostic test and share the logs!
