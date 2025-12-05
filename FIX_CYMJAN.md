# How to Fix CYMJAN Mass Not Showing Up

## Problem
The CYMJAN (Catholic Youth Ministry Mass in January) is not appearing when you generate the schedule for January 2026, even though it's configured with Override Type "Append".

## Root Cause
The CYMJAN entry has a **static date (1/11/2025)** instead of using the correct MonthlyMasses format.

## Fix Steps

### Option 1: Fix MonthlyMasses Entry (RECOMMENDED)

If CYMJAN should occur **every year on the 2nd Saturday of January**:

1. Open the **MonthlyMasses** sheet
2. Find the CYMJAN row
3. Update these columns:

| Column | Old Value | New Value |
|--------|-----------|-----------|
| Week of Month | 1/11/2025 | **2** |
| Day of Week | (blank) | **Saturday** |
| Start Date | (check this) | (blank or valid future date) |
| End Date | (check this) | (blank or valid future date) |

4. Save and regenerate the schedule

**Why this works**: The system will now calculate "2nd Saturday of January" for whatever year you're scheduling (2026, 2027, etc.)

---

### Option 2: Move to YearlyMasses (if it's a one-time event)

If CYMJAN should only occur on **specific dates each year** (not always the 2nd Saturday):

1. **Delete** the row from MonthlyMasses
2. Go to **YearlyMasses** sheet
3. Add a new row:

| Event ID | Date | Liturgical Celebration | Time | Is Active | Is Anticipated | Override Type | Description | Template Name | Assigned Group | Notes |
|----------|------|------------------------|------|-----------|----------------|---------------|-------------|---------------|----------------|-------|
| CYMJAN | (leave blank) | **The Baptism of the Lord** | 5:00 PM | TRUE | FALSE | Append | Catholic Youth Ministry Mass | Weekend/HDO | Catholic Youth Ministry | Kelise Winters, Madi Quintana |

**Why this works**: Using "The Baptism of the Lord" as the Liturgical Celebration will automatically lookup the correct date each year from the LiturgicalCalendar (which varies - it's always the Sunday after Epiphany).

**Note**: If Baptism of the Lord isn't the right liturgical date, you can use a static date like "1/11/2026" but you'll need to update it each year.

---

## How to Verify the Fix

1. Run the diagnostic tool:
   - In Apps Script Editor, run `DEBUG_findCYMJAN()`
   - Check the Execution Log for recommendations

2. Regenerate the schedule:
   - Open the sidebar
   - Select "January 2026"
   - Click "Generate Schedule"
   - Check if CYMJAN appears in the Assignments sheet

3. Expected result:
   - You should see rows like:
   ```
   1/11/2026 | 5:00 PM | Catholic Youth Ministry Mass | The Baptism of the Lord | [roles] | CYMJAN | ...
   ```

---

## Understanding MonthlyMasses vs YearlyMasses

### Use **MonthlyMasses** when:
- Event repeats on the **same week/day each month** (e.g., "1st Friday", "Last Sunday")
- Format: Week of Month = "1", "2", "3", "4", "Last" | Day of Week = "Monday", "Tuesday", etc.

### Use **YearlyMasses** when:
- Event occurs on a **specific liturgical celebration** (e.g., "Christmas", "Ash Wednesday")
- Event occurs on a **fixed date** (e.g., "December 8" for Immaculate Conception)
- Format: Date = static date OR Liturgical Celebration = celebration name

---

## Common Mistakes to Avoid

❌ **Don't** put dates like "1/11/2025" in MonthlyMasses Week of Month column
✅ **Do** use numbers like "2" for week and "Saturday" for day

❌ **Don't** forget to check Start Date/End Date - old end dates will prevent scheduling
✅ **Do** leave Start/End dates blank for "active all year"

❌ **Don't** use YearlyMasses with static dates if the event should repeat automatically
✅ **Do** use Liturgical Celebration lookups for moveable feasts

---

## Need More Help?

Run the diagnostic tool to see exactly what's wrong:
```javascript
DEBUG_findCYMJAN()
```

This will check your configuration and provide specific recommendations.
