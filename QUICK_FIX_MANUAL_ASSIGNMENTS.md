# Quick Fix: Manually Added Assignments Missing from Weekly View

## The Problem

You manually copied assignments from an older spreadsheet. When you did this, the **Month-Year values** (Column I in Assignments sheet) likely didn't get set correctly for those dates.

The weekly view relies on Month-Year values to load assignments:
- Week of Dec 28 - Jan 4 reads months `"2025-12"` and `"2026-01"`
- If 1/1/2026 assignments have the wrong Month-Year, they won't appear in the weekly view

## The Solution (3 Easy Steps)

### Step 1: Preview What Will Be Fixed

1. Reload the spreadsheet to get the new code
2. Go to **Admin Tools** > **Fix Month-Year Values**
3. Or run `FIX_previewMonthYearCorrections()` from Script Editor
4. Check the execution logs (View > Executions) to see what will change

**Expected output:**
```
Row 123: 1/1/2026 1st Reading
  Liturgy: Solemnity of Mary, the Mother of God
  Current: "2026-01" → Correct: "2025-12"
```

### Step 2: Apply the Fix

1. Go to **Admin Tools** > **Fix Month-Year Values**
2. The script will automatically correct all Month-Year values
3. You'll see a confirmation dialog showing how many were corrected

**What it does:**
- ✓ Scans all assignments in the Assignments sheet
- ✓ Calculates the correct Month-Year based on the date
- ✓ **Special handling for 1/1/2026**: Sets Month-Year to `"2025-12"` (part of Christmas season)
- ✓ Updates the Month-Year column automatically
- ✓ Logs all changes for your review

### Step 3: Regenerate Weekly View

After the fix is applied:

1. Go to the sidebar
2. Select "Weekly View"
3. Click "Generate Weekly View"
4. The 12/31 and 1/1 assignments should now appear!

## Why This Happened

When you manually copy assignments:
- ❌ Month-Year values from the old sheet may not match the new calendar year
- ❌ Dates might have been in a different month's schedule in the old sheet
- ❌ The schedule generator wasn't run, so Month-Year wasn't auto-calculated

The schedule generator (Step 2: Generate Schedule) automatically sets correct Month-Year values, but manual copying bypasses this.

## Special Case: January 1st

**January 1st (Solemnity of Mary, Mother of God)** is tricky:
- It's a **January date** (1/1/2026)
- But it's part of the **Christmas season** (liturgically)
- So it should have Month-Year: `"2025-12"` (December's schedule)

The fix script handles this automatically by checking the liturgical celebration.

## Verification

After running the fix, check the Assignments sheet:

1. Filter by Date = 1/1/2026
2. Check Column I (Month-Year)
3. Should show: `"2025-12"` ✓

Then regenerate the weekly view and confirm 1/1 assignments appear.

## Alternative: Regenerate Schedule Properly

If you want a cleaner solution:

1. **Delete the manually added assignments** from Assignments sheet
2. Go to sidebar > **Step 2: Generate Schedule**
3. Select **December 2025**
4. Click "Generate Schedule" (this will include 1/1/2026 automatically as spillover)
5. Go to **Step 3: Auto-Assign Volunteers**
6. Regenerate the weekly view

This ensures everything is generated with correct Month-Year values from the start.

## Need Help?

If the fix doesn't work:
1. Run `TEST_checkMonthYearValues()` to see actual values
2. Check execution logs for any errors
3. Share the logs if you need assistance

---

**Quick Start: Just run Admin Tools > Fix Month-Year Values and you're done!**
