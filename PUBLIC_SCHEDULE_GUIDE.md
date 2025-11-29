# Public Schedule - Usage Guide

## Overview

The **Public Schedule** feature allows you to sync your MonthlyView schedule to a separate volunteer-facing spreadsheet. This gives volunteers view-only access to their assignments without exposing sensitive administrative data.

## Key Features

- ✅ **Exact Clone**: Copies MonthlyView exactly (formatting, colors, liturgical details, unassigned slots)
- ✅ **Single Spreadsheet**: Creates one public spreadsheet with monthly tabs (e.g., "February 2026", "March 2026")
- ✅ **Auto-Naming**: Spreadsheet named based on Config values: `{Parish Name} {Ministry Name} Schedule`
- ✅ **Manual Control**: You decide when to publish (no automatic sync)
- ✅ **Access Control**: You manage volunteer access via Google Sheets sharing

## How It Works

### First-Time Setup

1. **Generate Print Schedule**
   - Complete your normal workflow: Generate Calendar → Generate Schedule → Auto-Assign → Print Schedule
   - The MonthlyView sheet must exist before you can publish

2. **Publish to Volunteers**
   - Use one of these methods:
     - **Sidebar**: Click "Publish Schedule" button (Step 9)
     - **Menu**: Parish Scheduler → Admin Tools → Public Schedule → Publish Current Month

3. **Public Spreadsheet Created**
   - System creates new spreadsheet: `{Parish Name} {Ministry Name} Schedule`
   - Adds "Instructions" tab for volunteers
   - Creates month tab (e.g., "February 2026") with your schedule
   - Stores spreadsheet ID in Config sheet (row: "Public Spreadsheet ID")

4. **Share with Volunteers**
   - Get the public schedule link:
     - **Menu**: Parish Scheduler → Admin Tools → Public Schedule → Get Public Schedule Link
   - Open the public spreadsheet
   - Click "Share" button (top right)
   - Add volunteer emails with "Viewer" permission
   - Optional: Enable "Anyone with the link can view" for easier access

### Monthly Workflow

Each month, after finalizing assignments:

1. **Generate Print Schedule** (Sidebar Step 8)
   - Creates/updates MonthlyView sheet

2. **Publish Schedule** (Sidebar Step 9)
   - Syncs MonthlyView to public spreadsheet
   - Creates new tab if first time for this month
   - Updates existing tab if republishing

3. **Notify Volunteers**
   - Send email with link to public spreadsheet
   - Volunteers navigate to their month's tab

### Updating Published Schedule

If you make changes after publishing (e.g., substitute assignments):

1. Update assignments in main spreadsheet
2. Regenerate Print Schedule (Step 8)
3. Click "Publish Schedule" again (Step 9)
   - System will overwrite the existing month tab with updated data

## What Volunteers See

### Public Spreadsheet Contains:

✅ **Instructions Tab**:
- Welcome message
- How to find their assignments
- Contact info for ministry coordinator

✅ **Monthly Tabs** (e.g., "February 2026"):
- Date, Time, Mass Description
- Liturgical Celebration (color-coded by season)
- Ministry Role
- Assigned Volunteer Name
- Unassigned slots (shows "UNASSIGNED")
- Liturgical rank/season/color details

### What Volunteers DON'T See:

❌ Volunteer IDs
❌ Other volunteers' contact info
❌ Timeoff requests
❌ Admin notes
❌ Configuration settings
❌ Other administrative sheets

## Access Management

### Method 1: Share with Specific Emails (Recommended)

**Pros**: Controlled access, audit trail
**Cons**: Requires accurate volunteer emails

**Steps**:
1. Get public schedule link (Menu → Admin Tools → Public Schedule → Get Link)
2. Open public spreadsheet
3. Click "Share" button
4. Add volunteer emails with "Viewer" permission
5. Optionally: Uncheck "Notify people" to avoid sending automatic emails

### Method 2: Shareable Link

**Pros**: Simple, no email management needed
**Cons**: Link could leak outside your volunteer group

**Steps**:
1. Open public spreadsheet
2. Click "Share" button
3. Change to "Anyone with the link can view"
4. Copy link and share via email, bulletin, website

## Troubleshooting

### Error: "MonthlyView sheet not found"
**Solution**: Generate Print Schedule first (Sidebar Step 8)

### Error: "MonthlyView appears empty"
**Solution**: Verify Print Schedule generated successfully and has data

### Public spreadsheet deleted accidentally
**Solution**:
- Just click "Publish Schedule" again
- System will create a new public spreadsheet
- You'll need to re-share with volunteers

### Want to rename public spreadsheet
**Solution**:
- Update "Parish Name" or "Ministry Name" in Config sheet
- Delete "Public Spreadsheet ID" row in Config sheet
- Click "Publish Schedule" to create new spreadsheet with new name
- Delete old public spreadsheet

### Need to unpublish a month
**Solution**:
- Open public spreadsheet
- Right-click month tab → Delete
- Tab will be removed from volunteer view

## Best Practices

1. **Publish After Finalizing**: Only publish when assignments are complete and verified
2. **Communicate with Volunteers**: Send email when new schedule is published
3. **Monthly Cadence**: Publish 1-2 weeks before the month starts
4. **Update as Needed**: If substitutes needed, republish with updates
5. **Archive Old Months**: Periodically delete old month tabs from public spreadsheet to keep it clean

## Integration with Existing Workflow

The public schedule feature integrates seamlessly with your existing workflow:

```
Step 1: Generate Calendar (once per year)
Step 2: Validate Data
  ↓
Step 3: Generate Schedule (monthly)
Step 4: Update Timeoff Form
Step 5: Review Timeoffs
Step 6: Auto-Assign Volunteers
  ↓
Step 7: Manual adjustments (if needed)
  ↓
Step 8: Print Schedule → Creates MonthlyView
Step 9: Publish Schedule → Syncs to public spreadsheet ← NEW!
  ↓
Step 10: Share link with volunteers
```

## FAQ

**Q: Do I need to publish every month?**
A: Yes, each month needs to be published separately. The system creates a new tab for each month.

**Q: Can volunteers edit the schedule?**
A: No, volunteers only have "Viewer" permission. They cannot edit the public spreadsheet.

**Q: What if I need to make changes after publishing?**
A: Just regenerate Print Schedule and click Publish Schedule again. It will overwrite the existing month tab.

**Q: Can I publish multiple months at once?**
A: Currently, you can only publish the selected month. Repeat for each month as needed.

**Q: Where is the public spreadsheet stored?**
A: It's created in the same Google Drive location as your main scheduling spreadsheet.

**Q: Can I manually edit the public spreadsheet?**
A: You can, but changes will be overwritten when you republish. Better to make changes in the main spreadsheet and republish.

## Support

If you encounter issues:

1. Check the error message for specific guidance
2. Verify MonthlyView sheet exists and has data
3. Check Config sheet has "Parish Name" and "Ministry Name" set
4. Review this guide's Troubleshooting section

---

**Last Updated**: 2025-11-29
**Feature Version**: 1.0
