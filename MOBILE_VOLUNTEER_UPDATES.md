# Mobile Volunteer Updates - Auto-Publish Guide

## Overview

This feature enables you to edit volunteer assignments from your mobile device and have those changes automatically sync to the public volunteer spreadsheet. No need to manually run scripts from mobile!

## How It Works

1. **One-Time Setup** (from desktop):
   - Enable auto-publish with your preferred sync interval
   - The system creates a time-based trigger

2. **Edit Assignments** (from mobile):
   - Open admin spreadsheet on your mobile device
   - Use existing mobile views (WeeklyView, UnassignedRoles, etc.)
   - Edit volunteer assignments in the Assignments sheet
   - Changes are automatically detected

3. **Auto-Sync**:
   - Every X minutes (you choose: 15, 30, 60, etc.), the system:
     - Checks if MonthlyView exists
     - Publishes MonthlyView to public spreadsheet
     - Updates the public volunteer schedule

## Setup Instructions

### Initial Setup (Desktop Only)

1. **Generate Your First Schedule:**
   ```
   Sidebar > Select Month > Generate Calendar
   Sidebar > Select Month > Generate Schedule
   Sidebar > Select Month > Auto-Assign Volunteers
   Sidebar > Select Month > Print Schedule
   ```

2. **Publish Manually Once:**
   ```
   Menu > Parish Scheduler > Admin Tools > Public Schedule > Publish Schedule
   ```
   This creates the public spreadsheet for the first time.

3. **Enable Auto-Publish:**
   ```
   Menu > Parish Scheduler > Admin Tools > Public Schedule > Enable Auto-Publish
   ```

4. **Choose Interval:**
   - **15 minutes**: Fast sync (good for active editing sessions)
   - **30 minutes**: Recommended balance ⭐
   - **60 minutes**: Less frequent (good for occasional edits)
   - **120+ minutes**: Minimal sync frequency

5. **Confirmation:**
   - You'll see: "✅ Auto-publish enabled! Schedules will automatically publish every X minutes."
   - The system adds two settings to your Config sheet:
     - `Auto-Publish Enabled: TRUE`
     - `Auto-Publish Interval (Minutes): 30`

### Mobile Editing Workflow

Now that auto-publish is enabled, your mobile workflow is simple:

1. **Open Admin Spreadsheet:**
   - Open the admin spreadsheet on your phone (Google Sheets app)
   - Navigate to one of the mobile-optimized views:
     - **WeeklyView**: Shows current + next 7 days
     - **UnassignedRoles**: Shows only unassigned roles
     - **Assignments**: Full assignments sheet with dropdowns

2. **Make Changes:**
   - Tap a cell in the "Volunteer" column
   - Select a volunteer from the dropdown (or type a name)
   - The assignment validation system checks for conflicts
   - Save the change

3. **Wait for Auto-Sync:**
   - Within your chosen interval (e.g., 30 minutes), the system:
     - Detects the MonthlyView needs publishing
     - Syncs to the public spreadsheet automatically
   - No manual action needed!

4. **Verify (Optional):**
   - Open the public spreadsheet on your phone
   - Check that the volunteer assignment appears
   - Refresh if needed (pull down on mobile)

## Managing Auto-Publish

### Check Status

```
Menu > Parish Scheduler > Admin Tools > Public Schedule > Auto-Publish Status
```

Shows:
- ✅ Enabled: Auto-publish is running
- ⚠️ Partially Enabled: Config enabled but trigger missing
- ❌ Disabled: Manual publish only

### Disable Auto-Publish

```
Menu > Parish Scheduler > Admin Tools > Public Schedule > Disable Auto-Publish
```

Use this if:
- You want to prevent automatic publishing temporarily
- You're making bulk edits and don't want partial changes published
- You prefer full manual control

You can re-enable at any time.

## Important Notes

### What Gets Published

Auto-publish syncs the **MonthlyView** sheet to the public spreadsheet. This is the formatted, printable version of your schedule that volunteers see.

- The MonthlyView is generated when you click "Print Schedule" in the sidebar
- Auto-publish syncs whatever MonthlyView currently exists
- If you regenerate MonthlyView for a different month, auto-publish will sync that new month

### Month Transition

When switching to a new month:
1. Generate the new month's schedule (Calendar > Schedule > Assignments > Print)
2. Auto-publish will automatically detect and publish the new MonthlyView
3. The public spreadsheet gets a new tab for the new month

### Safety Features

- **No data loss**: Auto-publish only copies data, never deletes from admin spreadsheet
- **Config check**: Auto-publish respects the "Auto-Publish Enabled" setting
- **Error handling**: If publishing fails, the trigger continues running (next attempt in X minutes)
- **Logs**: All auto-publish activity is logged (View > Executions in Script Editor)

### Performance

- **Trigger limits**: Google Apps Script allows triggers every 1-6 hours total runtime per day
- **Recommended intervals**: 30-60 minutes for typical usage
- **Peak editing**: Use 15 minutes if you're actively scheduling and need faster sync

## Troubleshooting

### Auto-Publish Not Working

**Check 1: Is it enabled?**
```
Menu > Admin Tools > Public Schedule > Auto-Publish Status
```

**Check 2: Does MonthlyView exist?**
- Open admin spreadsheet
- Check for "MonthlyView" tab
- If missing, run: Sidebar > Print Schedule

**Check 3: Check execution logs**
- Open Script Editor (Extensions > Apps Script)
- Click "Executions" (clock icon in left sidebar)
- Look for `AUTOPUBLISH_runScheduledPublish` entries
- Check for errors

**Check 4: Verify trigger exists**
- Open Script Editor
- Click "Triggers" (alarm clock icon in left sidebar)
- You should see: `AUTOPUBLISH_runScheduledPublish` running every X minutes
- If missing, re-enable auto-publish from menu

### Changes Not Appearing in Public Spreadsheet

**Reason 1: Interval hasn't elapsed yet**
- Wait for your chosen interval to pass (e.g., 30 minutes)
- Check Auto-Publish Status to see last run time

**Reason 2: MonthlyView not regenerated**
- Edits to Assignments sheet don't automatically update MonthlyView
- MonthlyView is a snapshot created by "Print Schedule"
- Two options:
  - **Option A**: Regenerate MonthlyView (Sidebar > Print Schedule) after edits
  - **Option B**: Edit MonthlyView directly (not recommended for complex changes)

**Reason 3: Wrong month**
- Auto-publish syncs the current MonthlyView
- Check that MonthlyView shows the month you're editing
- If wrong month, regenerate for correct month

### Accidentally Published Incomplete Schedule

**Fix 1: Disable auto-publish temporarily**
```
Menu > Admin Tools > Public Schedule > Disable Auto-Publish
```

**Fix 2: Fix the schedule**
- Complete your edits in admin spreadsheet
- Regenerate MonthlyView

**Fix 3: Manually publish correct version**
```
Menu > Admin Tools > Public Schedule > Publish Schedule
```

**Fix 4: Re-enable auto-publish**
```
Menu > Admin Tools > Public Schedule > Enable Auto-Publish
```

## Best Practices

### For Active Scheduling Periods

1. **Enable auto-publish** with 30-minute interval
2. **Edit assignments** as needed throughout the day
3. **Regenerate MonthlyView** once after bulk edits:
   ```
   Sidebar > Select Month > Print Schedule
   ```
4. Auto-publish handles the rest

### For Maintenance Mode

1. **Set longer interval** (60-120 minutes) to reduce trigger usage
2. **Make edits** as substitutions arise
3. **Verify public schedule** occasionally to ensure sync is working

### For Control Freaks

1. **Disable auto-publish** entirely
2. **Edit at your own pace** in admin spreadsheet
3. **Manually publish** when ready:
   ```
   Menu > Admin Tools > Public Schedule > Publish Schedule
   ```

## FAQ

**Q: Can I edit from mobile without auto-publish?**
A: Yes! You can edit assignments on mobile anytime. Without auto-publish, you'll need to manually publish from desktop when ready.

**Q: Does auto-publish work for all months?**
A: Auto-publish syncs whatever MonthlyView currently exists. Generate a new month's schedule, and auto-publish will sync that new month automatically.

**Q: Can volunteers see my edits in real-time?**
A: No. Volunteers see updates after: (1) you regenerate MonthlyView, AND (2) auto-publish runs (within your chosen interval). This gives you time to make multiple edits before publishing.

**Q: What happens if I edit Assignments but don't regenerate MonthlyView?**
A: Auto-publish will keep syncing the old MonthlyView. You must regenerate MonthlyView (Sidebar > Print Schedule) for edits to appear in the public spreadsheet.

**Q: Can I change the auto-publish interval?**
A: Yes! Just disable and re-enable auto-publish with a new interval:
```
Menu > Admin Tools > Public Schedule > Disable Auto-Publish
Menu > Admin Tools > Public Schedule > Enable Auto-Publish (choose new interval)
```

**Q: Does auto-publish use up my Google Apps Script quota?**
A: Minimally. Each publish takes ~5-10 seconds. At 30-minute intervals, that's ~5 minutes per day, well under the daily limit.

**Q: Can I see when auto-publish last ran?**
A: Yes! Check execution logs:
```
Extensions > Apps Script > Executions (clock icon)
```
Look for `AUTOPUBLISH_runScheduledPublish` entries with timestamps.

## Advanced: Manual Trigger Testing

To test auto-publish without waiting for the interval:

1. **Open Script Editor:**
   ```
   Extensions > Apps Script
   ```

2. **Find the function:**
   - Open `6_publicschedule.gs`
   - Find `AUTOPUBLISH_runScheduledPublish()`

3. **Run it:**
   - Click the function name in the dropdown
   - Click the "Run" button (play icon)
   - Check execution log for results

This lets you verify auto-publish is working without waiting 30 minutes.

---

**Last Updated:** 2025-12-08
**Feature Version:** 1.0 - Initial Release
