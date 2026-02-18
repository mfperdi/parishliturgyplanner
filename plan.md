# Plan: Monthly Assignments View — Editable + Printable

## Goal

Replace the current split workflow (edit in Assignments sheet, view in MonthlyView) with a single per-month sheet that serves as **both the editing surface and the print output**. The Assignments sheet becomes invisible infrastructure.

## User Workflow (After)

1. Generate Schedule (Step 2) — populates Assignments as before
2. Auto-Assign (Step 3) — fills volunteers in Assignments as before
3. **Generate "April 2026" sheet** — creates an editable, formatted monthly sheet
4. **Edit directly in that sheet** — type volunteer names, swap assignments
5. Edits sync back to Assignments automatically (via onEdit)
6. When ready to print, hide helper columns and print/export from same sheet
7. Sheet persists as permanent record

## Sheet Layout: "April 2026"

```
Row 1-4:  Header (logo, parish name, schedule title, liturgical year — same as current MonthlyView)
Row 5:    Blank spacer
Row 6+:   Content grouped by liturgical celebration

For each celebration:
  [Celebration Header]  — merged, liturgical color background
  [Rank Info]           — italic, season/color info
  [Table Headers]       — Date | Time | Description | Ministry | Role | Volunteer | Qualified? | Active? | Free?

  Assignment rows:
  Col A: Date           (shown only on first role per mass, protected)
  Col B: Time           (shown only on first role per mass, protected)
  Col C: Description    (shown only on first role per mass, protected)
  Col D: Ministry       (protected)
  Col E: Role           (protected)
  Col F: Volunteer      ← EDITABLE (user types/selects here)
  Col G: Qualified?     ← live formula (✓/✗)
  Col H: Active?        ← live formula (✓/⚠️)
  Col I: Free?          ← live formula (✓/⚠️)
  Col J: Assignments Row# ← HIDDEN (maps back to Assignments sheet row)
```

- Columns A-E are protected (schedule structure, not editable)
- Column F is the only editable column (volunteer names)
- Columns G-I are formula-based helper indicators (auto-update when F changes)
- Column J is hidden and stores the Assignments sheet row number for sync

## Implementation Steps

### Step 1: Add constants and configuration
**File: `0a_constants.gs`**

- Add column map for the monthly assignments sheet layout (DATE through ASSIGNMENTS_ROW)
- Add helper constant for month name pattern matching

### Step 2: Create the monthly assignments sheet generator
**New file: `5b_monthlyassignments.gs`**

Core function: `MONTHLY_generateAssignmentsView(monthString)`

1. Validate the month and check Assignments sheet has data for it
2. Create (or recreate with warning) a sheet named like "April 2026"
3. Reuse existing `buildScheduleData()` from `5_printschedule.gs` to get formatted data
4. Write the header section (reuse `createScheduleHeader()` logic)
5. Write celebration sections with the same grouped layout as MonthlyView
6. **Key difference from MonthlyView**: For each assignment row, also write:
   - The Assignments sheet row number in the hidden column J
   - Helper formulas in columns G-I referencing Volunteers/Timeoffs sheets
7. Protect columns A-E and G-I (schedule structure + formulas) — column F left editable
8. Hide column J (row mapping)
9. Apply formatting: unassigned rows highlighted, liturgical colors, alternating backgrounds

**Finding the Assignments row number**: When reading assignment data, track which row each assignment came from in the Assignments sheet (array index + 2 for header offset). Store this in column J.

### Step 3: Implement the onEdit sync-back mechanism
**File: `0d_onedit.gs`**

Extend the existing `onEdit()` function to handle edits in monthly assignment sheets:

1. Check if edited sheet name matches a monthly pattern (e.g., "April 2026")
2. Check if edited column is the Volunteer column (F, column 6)
3. Read the hidden Assignments row number from column J of the edited row
4. If valid, update the Assignments sheet:
   - Column L (ASSIGNED_VOLUNTEER_NAME) = new value from column F
   - Column K (ASSIGNED_VOLUNTEER_ID) = looked up from Volunteers sheet
   - Column M (STATUS) = "Assigned" if name entered, "Unassigned" if cleared
5. Run the same validation logic as existing `ONEDIT_validateAssignment()` (status, ministry, timeoff checks)
6. Show warning dialog if validation issues found, allow override

### Step 4: Add "Prepare for Print" toggle
**File: `5b_monthlyassignments.gs`**

Function: `MONTHLY_togglePrintMode(sheetName)`

- Hides columns G-J (helper indicators + row mapping) for clean print output
- Or unhides them to return to editing mode
- Simple toggle

### Step 5: Add sidebar integration
**File: `Sidebar.html`**

Add to the workflow after auto-assignment:

- **"Generate Monthly Sheet" button** — calls `MONTHLY_generateAssignmentsView(month)`
- **"Prepare for Print" toggle button** — hides/shows helper columns
- Uses existing month dropdown

### Step 6: Add menu items and wrapper functions
**File: `0_code.gs`**

- Add wrapper function `generateMonthlyAssignmentsView()` for sidebar
- Add "Toggle Print Mode" menu item
- Add to Admin Tools or main Parish Scheduler menu

### Step 7: Handle re-generation safely
**File: `5b_monthlyassignments.gs`**

When generating a monthly sheet that already exists:
1. Warn: "April 2026 already exists. Regenerating will overwrite manual edits. Continue?"
2. If confirmed, clear and regenerate
3. If cancelled, abort

## What Stays the Same

- **Assignments sheet**: Still the data backend. Schedule generation and auto-assignment write here.
- **Schedule generation (Step 2)**: No changes.
- **Auto-assignment (Step 3)**: No changes.
- **Existing onEdit validation on Assignments sheet**: Backward compatible.
- **Helper formulas (0e_helper_formulas.gs)**: Still works on Assignments sheet.
- **WeeklyView**: Can still be generated separately.

## What Changes

- **MonthlyView**: No longer the primary workflow. Kept for backward compatibility.
- **User's primary editing surface**: Shifts from Assignments sheet to the named monthly sheet.

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `5b_monthlyassignments.gs` | **CREATE** | Core generation, print toggle, utilities |
| `0a_constants.gs` | Modify | Add monthly sheet column map |
| `0d_onedit.gs` | Modify | Add sync-back handler for monthly sheet edits |
| `0_code.gs` | Modify | Add menu items and wrapper functions |
| `Sidebar.html` | Modify | Add monthly sheet generation UI |

## Edge Cases

1. **Sheet already exists**: Warn before overwriting
2. **Assignments rows shifted**: Only if schedule regenerated — monthly sheet must be regenerated too
3. **Volunteer name typo**: Helper formulas show ⚠️ immediately; onEdit shows error dialog
4. **Single ministry filter**: Support 5-column layout (hide Ministry column) same as current system
5. **Month naming**: Full month name + year (e.g., "April 2026")
