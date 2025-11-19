# Assignment Validation System

## Overview

The Assignment Validation System provides real-time validation when manually assigning volunteers in the **Assignments** sheet. It helps prevent assignment errors by checking volunteer eligibility based on:

1. **Volunteer Status** - Must be "Active"
2. **Ministry Role & Skill** - Must have required ministry capabilities
3. **Timeoff Conflicts** - Must not have blacklist/whitelist restrictions

## How It Works

### Automatic Validation

When you manually type a volunteer name or ID in the Assignments sheet (columns I or J):

1. **System validates immediately** after you finish editing the cell
2. **If warnings are found**, a dialog appears showing all issues
3. **You can choose** to:
   - **Cancel** - Clear the assignment and try someone else
   - **Assign Anyway** - Override the warnings (documented in Notes column)
4. **Visual feedback** - Override assignments are highlighted in light orange

### Validation Checks

#### ✓ Check 1: Volunteer Status

**Requirement**: Volunteer must have Status = "Active" in Volunteers sheet

**Why**: Inactive, Substitute Only, Ministry Sponsor, and Parent/Guardian volunteers should not be auto-assigned through manual entry

**Warning Example**:
```
❌ Volunteer status is "Inactive" (not Active)
```

**Resolution**:
- Change volunteer's Status to "Active" in Volunteers sheet, OR
- Choose a different volunteer, OR
- Override if this is intentional (e.g., emergency substitute)

---

#### ✓ Check 2: Ministry Role & Skill Match

**Requirement**: Volunteer must have the required ministry capabilities

The system checks **both**:
- **Ministry Role** (general category from Volunteers sheet column J)
- **Ministry Skill** (specific skill from MassTemplates sheet column C)

**Warning Examples**:
```
❌ Volunteer does not have required ministry role "Lector" or skill "Reader"
   (Has: Eucharistic Minister, Usher)
```

```
⚠️  Volunteer has role "Lector" but not specific skill "Psalm Leader"
```

**Resolution**:
- Add missing role to volunteer's Ministry Role in Volunteers sheet, OR
- Verify the MassTemplates requirements are correct, OR
- Override if volunteer is cross-training or has equivalent skills

---

#### ✓ Check 3: Timeoff Conflicts

**Requirement**: Volunteer must not have conflicting timeoff requests

The system checks **both** timeoff types:

##### Not Available (Blacklist)
Volunteer cannot serve on specified dates

**Warning Example**:
```
❌ Volunteer is unavailable on 12/25/2025
   (Timeoff: Not Available from 12/20/2025 to 12/30/2025)
```

##### Only Available (Whitelist)
Volunteer can ONLY serve specified masses/dates during the period

**Warning Example**:
```
❌ Volunteer is only available for specific masses during this period
   (Only Available from 6/1/2026 to 8/31/2026)
   (Allowed: SUN-1000, SAT-1700)
   (This assignment: SUN-0800)
```

**Resolution**:
- Respect the timeoff and choose a different volunteer, OR
- Update/cancel the timeoff request if it's incorrect, OR
- Override if situation has changed (document reason in dialog)

---

## Setup Instructions

### One-Time Setup

**Step 1: Set up Conditional Formatting**
1. Go to menu: **Parish Scheduler → Admin Tools → Setup Assignment Validation**
2. Click "OK" when confirmation dialog appears
3. Conditional formatting is now active

**Result**: Assignment rows with overrides will be highlighted in light orange

**Note**: You only need to do this once. The onEdit trigger is automatically active.

### No Additional Configuration Needed

The onEdit trigger (`onEdit()` function in `0d_onedit.gs`) is automatically installed when you:
- Open the spreadsheet
- Refresh the page
- Run any script function

Google Apps Script automatically detects the `onEdit()` function and triggers it on cell edits.

---

## Using the System

### Normal Manual Assignment Flow

1. Open the **Assignments** sheet
2. Find the row you want to assign
3. Type the volunteer name in **Column J** (Assigned Volunteer Name)
   - OR type the volunteer ID in **Column I** (Assigned Volunteer ID)
4. **Press Enter**
5. System validates immediately:
   - **No warnings**: Assignment accepted, both ID and Name filled in automatically
   - **Warnings found**: Dialog appears (see below)

### When Warnings Appear

**Dialog Format**:
```
⚠️  Assignment Warnings for John Smith:

❌ Volunteer status is "Substitute Only" (not Active)

❌ Volunteer does not have required ministry role "Lector"
   (Has: Eucharistic Minister, Usher)

────────────────────────────────
Do you want to assign this volunteer anyway?

• Click YES to proceed with override
• Click NO to cancel assignment
```

**Your Options**:

**Option A: Click NO (Recommended)**
- Assignment is cleared
- You can try a different volunteer
- No documentation added

**Option B: Click YES (Override)**
- Assignment stays in place
- Both Volunteer ID and Name are filled in
- **Notes column** updated with override documentation
- Row highlighted in light orange

**Override Documentation Example**:
```
[Override: Inactive, Missing Role] Original notes here...
```

---

## Visual Feedback: Conditional Formatting

### Color Coding

| Background Color | Meaning |
|-----------------|---------|
| **Light Orange** | Assignment has validation overrides |
| Normal/White | Clean assignment (no warnings) |

### What It Shows

- Any row where you chose "Assign Anyway" despite warnings
- Visible at a glance across the entire Assignments sheet
- Helps you quickly identify assignments that need attention
- Useful for auditing and quality control

---

## Best Practices

### ✓ DO

- **Respect warnings** when possible - they exist to prevent scheduling errors
- **Update source data** (Volunteers sheet, Timeoffs sheet) if warnings indicate outdated info
- **Document overrides** - The system does this automatically, but make notes if needed
- **Review highlighted rows** - Check orange-highlighted assignments periodically
- **Run data validation** - Use Admin Tools → Validate Data before generating schedules

### ✗ DON'T

- **Ignore repeated warnings** - If the same volunteer keeps triggering warnings, investigate
- **Override timeoffs casually** - Respect volunteer availability when possible
- **Forget to set up formatting** - Run Setup Assignment Validation once
- **Delete override notes** - Keep the audit trail in the Notes column

---

## Common Scenarios

### Scenario 1: Emergency Substitute Needed

**Situation**: Regular volunteer calls in sick, need immediate substitute

**Steps**:
1. Try to assign primary substitute
2. If no one available, assign any qualified volunteer
3. System may warn "Substitute Only" status
4. **Override**: Click YES - this is the intended use case
5. Result: Assignment documented with [Override: Inactive] note

**Why it's OK**: Emergency situations require flexibility

---

### Scenario 2: Volunteer Cross-Training

**Situation**: Training an Altar Server to become a Lector

**Steps**:
1. Assign trainee to Lector role
2. System warns: Missing ministry role
3. **Override**: Click YES during training period
4. Update Volunteers sheet once training complete
5. Re-validate: Warning should disappear

**Why it's OK**: Controlled training with supervision

---

### Scenario 3: Timeoff Changed Last Minute

**Situation**: Volunteer requests timeoff, later cancels it

**Steps**:
1. Find and reject/delete the timeoff request in Timeoffs sheet
2. Assign volunteer normally
3. System should NOT warn (timeoff no longer active)
4. If warning persists, check Status column = "Approved"

**Why it's important**: Keep Timeoffs sheet up to date

---

### Scenario 4: Special Event with Different Rules

**Situation**: Christmas Mass needs all hands on deck

**Steps**:
1. Assign volunteers even if they normally serve different masses
2. System may warn about mass preference mismatches (if implemented)
3. **Override**: Click YES for special occasions
4. Document in Notes: "Christmas special event"

**Why it's OK**: Special occasions override normal preferences

---

## Troubleshooting

### Validation Not Triggering

**Problem**: Edit cells but no validation dialog appears

**Solutions**:
1. **Refresh the page** - Reloads the script
2. **Check you're editing the right columns**:
   - Column I (Assigned Volunteer ID), OR
   - Column J (Assigned Volunteer Name)
3. **Check you're in Assignments sheet** - Other sheets don't trigger validation
4. **Check Apps Script logs**:
   - Open Apps Script editor
   - View → Executions
   - Look for errors

---

### False Warnings

**Problem**: System warns but volunteer IS qualified

**Solutions**:
1. **Check spelling** - Ministry roles are case-insensitive but must match
   - Volunteers sheet: "Lector, Eucharistic Minister"
   - MassTemplates: "Lector" ✓ matches
   - MassTemplates: "Lectore" ✗ typo
2. **Check comma separation** - Ministry Role field must be comma-separated
   - Good: "Lector, Usher, Altar Server"
   - Bad: "Lector Usher Altar Server"
3. **Check partial matches** - System accepts partial matches
   - Has: "Eucharistic Minister" ✓ matches "Eucharistic" requirement
4. **Update Volunteers sheet** - Add missing roles if truly qualified

---

### Conditional Formatting Not Showing

**Problem**: Override assignments not highlighted

**Solutions**:
1. **Run setup again**: Admin Tools → Setup Assignment Validation
2. **Check Notes column** - Should contain "[Override:..." text
3. **Manual format check**:
   - Select any cell in Assignments sheet
   - Format → Conditional formatting
   - Verify rule exists with formula: `=REGEXMATCH($L2, "\[Override:")`
4. **Reapply formatting** - Sometimes needs refresh

---

### Performance Issues

**Problem**: Validation is slow or times out

**Solutions**:
1. **Large dataset** - System reads all volunteers and timeoffs on each edit
2. **Optimize sheets**:
   - Remove old/inactive volunteers from Volunteers sheet
   - Archive old timeoff requests
   - Keep data sheets under 1000 rows if possible
3. **Contact support** - May need caching improvements for large parishes

---

## Technical Details

### Files Involved

| File | Purpose |
|------|---------|
| `0d_onedit.gs` | Main onEdit trigger and validation logic |
| `0_code.gs` | Menu integration |
| `0a_constants.gs` | Column definitions and constants |
| `0b_helper.gs` | Shared utility functions (date formatting, etc.) |

### Functions Reference

**Main Functions**:
- `onEdit(e)` - Entry point, triggers on any cell edit
- `ONEDIT_validateAssignment(sheet, row)` - Orchestrates validation
- `ONEDIT_findVolunteer(id, name)` - Looks up volunteer data
- `ONEDIT_checkVolunteerStatus(volunteer)` - Status validation
- `ONEDIT_checkMinistryMatch(volunteer, role, skill)` - Role/skill validation
- `ONEDIT_checkTimeoffConflicts(volunteer, date, eventId)` - Timeoff validation
- `ONEDIT_showValidationDialog(name, warnings)` - Shows warning dialog
- `ONEDIT_addWarningNote(sheet, row, warnings, currentNotes)` - Documents override
- `ONEDIT_setupConditionalFormatting()` - Sets up visual highlighting

### Data Read on Each Edit

**Volunteers Sheet**:
- All active volunteers and their ministry roles
- Used for eligibility checking

**Timeoffs Sheet**:
- All approved timeoff requests
- Used for availability checking

**MassTemplates Sheet**:
- Ministry skill requirements
- Used for skill matching

**Performance Note**: Data is read fresh on each edit to ensure accuracy. For large parishes (>100 volunteers), consider archiving old data.

---

## Integration with Auto-Assignment

### How They Work Together

**Auto-Assignment** (`3_assignmentlogic.gs`):
- Runs in batch for entire month
- Assigns volunteers automatically based on algorithm
- Respects same rules (status, roles, timeoffs)
- Never creates override assignments

**Manual Assignment Validation** (`0d_onedit.gs`):
- Runs in real-time for individual edits
- Allows overrides with confirmation
- Documents exceptions for audit trail
- Complements auto-assignment for edge cases

### Workflow Recommendation

1. **Generate schedule** - Creates unassigned rows
2. **Auto-assign volunteers** - Fills in most assignments
3. **Review unassigned roles** - Identify gaps
4. **Manual assignment with validation** - Fill gaps with overrides if needed
5. **Print schedule** - Generate final output

---

## Future Enhancements

Potential improvements being considered:

- [ ] **Mass preference warnings** - Warn when volunteer assigned outside preferred masses
- [ ] **Double-booking detection** - Warn if volunteer already assigned same day/time
- [ ] **Frequency tracking** - Warn if volunteer assigned too many times in month
- [ ] **Family team suggestions** - Suggest family members when one is assigned
- [ ] **Substitute recommendations** - Show qualified substitutes in dialog
- [ ] **Batch override approval** - Admin can bulk approve overrides

---

## Support & Feedback

### Getting Help

1. **Check this documentation first**
2. **Review CLAUDE.md** - System architecture and concepts
3. **Check Apps Script logs** - View → Executions in script editor
4. **Run data validation** - Admin Tools → Validate Data
5. **Contact system administrator** - Report bugs or issues

### Providing Feedback

When reporting issues, include:
- **What you were doing** - Step-by-step
- **What you expected** - Desired behavior
- **What happened** - Actual behavior
- **Screenshot** - If applicable
- **Error message** - From dialog or logs

---

## Summary

The Assignment Validation System is designed to:

✓ **Prevent errors** - Catch common assignment mistakes in real-time
✓ **Allow flexibility** - Override warnings when needed
✓ **Document exceptions** - Maintain audit trail of overrides
✓ **Provide visibility** - Visual highlighting for quality control
✓ **Integrate seamlessly** - Works alongside auto-assignment

**Key Principle**: *Helpful warnings, not rigid restrictions*

The system respects that parish scheduling requires human judgment. It provides information to help you make informed decisions, then documents your choices for accountability.

---

**Last Updated**: 2025-11-18
**Version**: 1.0
**Author**: Parish Liturgy Planner Development Team
