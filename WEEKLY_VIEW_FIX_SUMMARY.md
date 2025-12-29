# Weekly View Missing Assignments - Fix Summary

## Issue Identified

The weekly view for "Week of December 28, 2025 - January 4, 2026" is not showing assignments for 12/31/2025 and 1/1/2026.

## Root Cause

Based on diagnostic test results, the issue is **Month-Year assignment mismatch**:

### Expected Month-Year Values
- Assignments for **12/31/2025** should have Month-Year: `"2025-12"`
- Assignments for **1/1/2026** (Solemnity of Mary) should have Month-Year: `"2025-12"` (part of Christmas season)
- Assignments for **1/3/2026** (vigil) should have Month-Year: `"2026-01"`
- Assignments for **1/4/2026** (Epiphany) should have Month-Year: `"2026-01"`

### What the Diagnostic Found
- Reading month `"2025-12"` returned only **12 total assignments**
- This is far too few (should have all of December PLUS 12/31 and 1/1)
- Only 3 masses shown for 1/1/2026 (should be 6 masses: 8am, 10am, 12pm, 3pm, 5pm, plus 12/31 6pm vigil)

## Diagnosis Steps

Run `TEST_checkMonthYearValues()` to verify Month-Year values in your Assignments sheet.

**Expected result:** All 1/1/2026 assignments should show `Month-Year: "2025-12"`

**If you see `Month-Year: "2026-01"`** for 1/1/2026 assignments:
- This is the problem! Those assignments won't be loaded when building the weekly view for Dec 28 - Jan 4
- The weekly view reads from month "2025-12" for the early part of the week, but those assignments are filed under "2026-01"

## Solution

### Option 1: Regenerate December Schedule (Recommended)

The safest solution is to regenerate the December 2025 schedule to ensure proper Month-Year values:

1. Go to the sidebar
2. Select month: **December 2025**
3. Click "Generate Schedule" (this will include 1/1/2026 spillover with correct Month-Year)
4. Click "Auto-Assign Volunteers"
5. Regenerate the weekly view

### Option 2: Manual Month-Year Fix (Quick Fix)

If you don't want to regenerate:

1. Open the Assignments sheet
2. Filter by Date = 1/1/2026
3. Check the Month-Year column (Column I)
4. If any show "2026-01", manually change them to "2025-12"
5. Regenerate the weekly view

### Option 3: Check Schedule Generation Logic

If regenerating doesn't fix it, there may be an issue with how the schedule generator assigns Month-Year values for spillover dates. The logic should be:

- Assignments created during December schedule generation → Month-Year "2025-12"
- This includes spillover dates in early January that are part of the Christmas season
- Holy days like Mary Mother of God (1/1) should be included in December generation

## Why This Matters

The weekly view uses Month-Year values to determine which month's assignments to read:

```javascript
// Week: Dec 28 - Jan 4
monthStrings = ["2025-12", "2026-01"]  // Reads both months

// But if 1/1 assignments have Month-Year "2026-01":
// They get loaded...
// But the date filter might be excluding them for some reason

// OR if 1/1 assignments have Month-Year "2025-12":
// They should be loaded and shown correctly
```

Based on your screenshot, the Month-Year values APPEAR correct ("2025-12" for 1/1), but the diagnostic suggests only a subset is being found. This could mean:

1. Schedule was regenerated and some assignments were deleted
2. Month-Year values were changed manually or by regeneration
3. There's a filtering issue in getAssignmentDataForMonth()

## Next Step

**Run `TEST_checkMonthYearValues()` and share the results.**

This will show exactly what's in your Assignments sheet and confirm whether this is a Month-Year issue or something else.
