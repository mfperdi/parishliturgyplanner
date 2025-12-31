# Dashboard Analytics - Updated Implementation Plan

## Changes Based on User Feedback

This document updates the original `DASHBOARD_PLAN.md` with user-approved decisions.

---

## User Decisions (Approved)

### 1. Month Selection Scope ✅
**Decision**: Allow any month selection via dropdown

**Implementation**:
- Sidebar: Month dropdown (uses existing `monthSelect`)
- Menu: Prompt with month selection
- No restriction to current month only

**Impact**: Already planned ✓

---

### 2. Configurable Thresholds ✅
**Decision**: Thresholds should be configurable via Config sheet

**Implementation**: Add new Config sheet settings

#### New Config Settings

| Setting Name | Default Value | Description |
|-------------|---------------|-------------|
| `Dashboard_UnderUtilized_Threshold` | 50 | % of average below which volunteer is under-utilized |
| `Dashboard_OverUtilized_Threshold` | 150 | % of average above which volunteer is over-utilized |
| `Dashboard_Burnout_Assignments_Threshold` | 150 | % of average indicating high workload |
| `Dashboard_Burnout_Spacing_Days` | 7 | Minimum days between assignments to avoid burnout |
| `Dashboard_Coverage_Warning_Threshold` | 80 | % coverage below which shows warning |
| `Dashboard_Coverage_Critical_Threshold` | 50 | % coverage below which shows critical alert |
| `Dashboard_Timeoff_HighImpact_Threshold` | 5 | Number of volunteers unavailable = high impact |
| `Dashboard_Timeoff_MediumImpact_Threshold` | 3 | Number of volunteers unavailable = medium impact |

#### Helper Function
```javascript
function DASHBOARD_getThresholds() {
  const config = HELPER_readConfigSafe();

  return {
    underUtilized: parseFloat(config['Dashboard_UnderUtilized_Threshold'] || 50),
    overUtilized: parseFloat(config['Dashboard_OverUtilized_Threshold'] || 150),
    burnoutAssignments: parseFloat(config['Dashboard_Burnout_Assignments_Threshold'] || 150),
    burnoutSpacing: parseInt(config['Dashboard_Burnout_Spacing_Days'] || 7),
    coverageWarning: parseFloat(config['Dashboard_Coverage_Warning_Threshold'] || 80),
    coverageCritical: parseFloat(config['Dashboard_Coverage_Critical_Threshold'] || 50),
    timeoffHigh: parseInt(config['Dashboard_Timeoff_HighImpact_Threshold'] || 5),
    timeoffMedium: parseInt(config['Dashboard_Timeoff_MediumImpact_Threshold'] || 3)
  };
}
```

#### Updated Classification Logic
```javascript
function DASHBOARD_classifyUtilization(count, average) {
  const thresholds = DASHBOARD_getThresholds();
  const percentage = (count / average) * 100;

  if (percentage < thresholds.underUtilized) {
    return { status: "Under-utilized 💡", color: "#FFF3CD" };
  } else if (percentage > thresholds.overUtilized) {
    return { status: "Over-utilized ⚠️", color: "#F8D7DA" };
  } else {
    return { status: "Balanced ✓", color: "#D4EDDA" };
  }
}
```

**Impact**:
- ~50 lines additional code
- +30 minutes implementation time
- Better flexibility for different parish sizes

---

### 3. UI Placement ✅
**Decision**: Both sidebar AND menu (Option A)

**Implementation**: Already planned ✓
- Sidebar: Step in "Finalize & Export" phase
- Menu: "Admin Tools" > "View Dashboard Analytics"

**Impact**: No change (already in original plan)

---

### 4. Auto-Refresh + Manual Button ✅
**Decision**: Auto-refresh when assignments complete + manual refresh button

**Implementation**:

#### A. Auto-Refresh Hook
Add to `3_assignmentlogic.gs`:

```javascript
function ASSIGNMENT_autoAssignRolesForMonth(monthString) {
  // ... existing logic ...

  const result = executeAssignmentLogic(monthString, month, scheduleYear);

  // AUTO-REFRESH: Regenerate dashboard after assignments complete
  try {
    Logger.log('Auto-refreshing dashboard analytics...');
    DASHBOARD_generateAnalytics(monthString, { silent: true });
    Logger.log('Dashboard auto-refresh complete');
  } catch (e) {
    Logger.log(`WARNING: Dashboard auto-refresh failed: ${e.message}`);
    // Don't fail assignment if dashboard refresh fails
  }

  return result;
}
```

#### B. Silent Mode Option
Update `DASHBOARD_generateAnalytics()`:

```javascript
function DASHBOARD_generateAnalytics(monthString, options = {}) {
  const silent = options.silent || false;

  try {
    // ... analytics logic ...

    const result = `Dashboard analytics generated for ${monthString}`;

    if (!silent) {
      return result; // Return message for UI display
    } else {
      Logger.log(result); // Just log, don't show UI message
      return null;
    }
  } catch (e) {
    if (!silent) {
      throw e; // Propagate error for UI display
    } else {
      Logger.log(`Dashboard auto-refresh error: ${e.message}`);
      return null; // Silent failure
    }
  }
}
```

#### C. Manual Refresh Button
Already in original plan - sidebar button for on-demand refresh.

#### D. Refresh Indicator
Add to Dashboard sheet header:

```
Last Refreshed: [Timestamp]
Auto-refresh: Enabled ✓
```

**Impact**:
- ~30 lines additional code
- +20 minutes implementation time
- Better user experience (always up-to-date)

---

### 5. Historical Trends ✅
**Decision**: Track trends over time (month-over-month analysis)

**Implementation**: Add historical data tracking

#### New Sheet: DashboardHistory

**Purpose**: Store monthly dashboard snapshots for trend analysis

**Columns** (16 columns):
```
| Month-Year | Generated Date | Active Volunteers | Total Assignments |
| Avg Assignments/Volunteer | Under-Utilized Count | Over-Utilized Count |
| Balanced Count | Coverage % (Overall) | Unassigned Roles |
| High Burnout Count | Medium Burnout Count | Timeoff Requests |
| High Impact Dates | Medium Impact Dates | Notes |
```

**Sample Data**:
```
2026-02 | 2/28/2026 10:30 AM | 50 | 200 | 4.0 | 12 | 8 | 30 | 85% | 30 | 2 | 5 | 15 | 3 | 7 | Good coverage
2026-01 | 1/31/2026 09:15 AM | 48 | 180 | 3.75 | 15 | 5 | 28 | 78% | 45 | 1 | 3 | 12 | 2 | 5 | Holiday impact
```

#### New Functions

**Store Monthly Snapshot**:
```javascript
function DASHBOARD_storeHistoricalSnapshot(monthString, analyticsData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let historySheet = ss.getSheetByName('DashboardHistory');

  // Create sheet if doesn't exist
  if (!historySheet) {
    historySheet = ss.insertSheet('DashboardHistory');

    // Add header row
    const headers = [
      'Month-Year', 'Generated Date', 'Active Volunteers', 'Total Assignments',
      'Avg Assignments/Volunteer', 'Under-Utilized Count', 'Over-Utilized Count',
      'Balanced Count', 'Coverage % (Overall)', 'Unassigned Roles',
      'High Burnout Count', 'Medium Burnout Count', 'Timeoff Requests',
      'High Impact Dates', 'Medium Impact Dates', 'Notes'
    ];

    historySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    historySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  // Check if snapshot for this month already exists
  const data = historySheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === monthString) {
      rowIndex = i + 1; // Found existing row
      break;
    }
  }

  // Build snapshot row
  const snapshot = [
    monthString,
    new Date(),
    analyticsData.volunteerStats.activeCount,
    analyticsData.volunteerStats.totalAssignments,
    analyticsData.volunteerStats.average,
    analyticsData.volunteerStats.underUtilizedCount,
    analyticsData.volunteerStats.overUtilizedCount,
    analyticsData.volunteerStats.balancedCount,
    analyticsData.coverage.overallPercentage,
    analyticsData.unassigned.totalCount,
    analyticsData.burnout.highRiskCount,
    analyticsData.burnout.mediumRiskCount,
    analyticsData.timeoff.totalRequests,
    analyticsData.timeoff.highImpactCount,
    analyticsData.timeoff.mediumImpactCount,
    '' // Notes (admin can add manually)
  ];

  // Update or append
  if (rowIndex > 0) {
    historySheet.getRange(rowIndex, 1, 1, snapshot.length).setValues([snapshot]);
  } else {
    historySheet.appendRow(snapshot);
  }

  Logger.log(`Historical snapshot saved for ${monthString}`);
}
```

**Retrieve Trend Data**:
```javascript
function DASHBOARD_getTrendData(monthString, lookbackMonths = 3) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = ss.getSheetByName('DashboardHistory');

  if (!historySheet) {
    return null; // No historical data yet
  }

  const data = historySheet.getDataRange().getValues();
  const headers = data[0];

  // Find current month and previous months
  const { year, month } = HELPER_validateMonthString(monthString);
  const trends = [];

  for (let i = 0; i < lookbackMonths; i++) {
    const targetDate = new Date(year, month - i, 1);
    const targetMonthString = HELPER_formatDate(targetDate, 'month-year');

    // Find row for this month
    for (let j = 1; j < data.length; j++) {
      if (data[j][0] === targetMonthString) {
        trends.push({
          monthYear: data[j][0],
          activeVolunteers: data[j][2],
          totalAssignments: data[j][3],
          avgAssignments: data[j][4],
          coverage: data[j][8],
          unassigned: data[j][9],
          burnoutHigh: data[j][10]
        });
        break;
      }
    }
  }

  return trends;
}
```

**Calculate Trends**:
```javascript
function DASHBOARD_calculateTrends(currentData, historicalData) {
  if (!historicalData || historicalData.length < 2) {
    return { hasTrends: false };
  }

  const current = currentData;
  const previous = historicalData[1]; // Most recent historical month

  return {
    hasTrends: true,
    coverage: {
      current: current.coverage.overallPercentage,
      previous: previous.coverage,
      change: current.coverage.overallPercentage - previous.coverage,
      trend: current.coverage.overallPercentage > previous.coverage ? 'improving' : 'declining'
    },
    utilization: {
      current: current.volunteerStats.average,
      previous: previous.avgAssignments,
      change: current.volunteerStats.average - previous.avgAssignments,
      trend: Math.abs(current.volunteerStats.average - previous.avgAssignments) < 0.5 ? 'stable' : 'changing'
    },
    burnout: {
      current: current.burnout.highRiskCount,
      previous: previous.burnoutHigh,
      change: current.burnout.highRiskCount - previous.burnoutHigh,
      trend: current.burnout.highRiskCount < previous.burnoutHigh ? 'improving' : 'worsening'
    }
  };
}
```

#### Updated Dashboard Output

Add new **Section 7: Month-over-Month Trends** to dashboard:

```
┌─ SECTION 7: TRENDS (vs Previous Month) ──────────────────────────┐
│ Metric              | Current | Previous | Change | Trend        │
├──────────────────────────────────────────────────────────────────┤
│ Coverage %          | 85%     | 78%      | +7%    | Improving ↗️ │
│ Avg Assignments     | 4.0     | 3.75     | +0.25  | Stable →     │
│ High Burnout Risk   | 2       | 1        | +1     | Worsening ↘️ │
│ Unassigned Roles    | 30      | 45       | -15    | Improving ↗️ │
└──────────────────────────────────────────────────────────────────┘

Historical Data Available: Last 3 months
```

**Impact**:
- New sheet: DashboardHistory
- ~200 lines additional code
- +2 hours implementation time
- Powerful insights for long-term planning

---

## Updated Technical Architecture

### Modified Files Summary

| File | Changes | Est. Lines |
|------|---------|-----------|
| `0a_constants.gs` | Add DASHBOARD_HISTORY sheet constant | +1 |
| `8_dashboardlogic.gs` | Core analytics + trends + history | ~800 |
| `3_assignmentlogic.gs` | Auto-refresh hook | +10 |
| `0_code.gs` | Menu integration | +15 |
| `Sidebar.html` | Dashboard button + event handler | +30 |
| Config sheet | Add 8 threshold settings | Manual |
| DashboardHistory sheet | Create new sheet | Manual |

**Total Estimated Lines**: ~850 lines

---

## Updated Implementation Timeline

### Phase 1: Core Analytics (3-4 hours)
- [ ] Create `8_dashboardlogic.gs`
- [ ] Implement 6 core analytics functions
- [ ] Add configurable threshold support
- [ ] Add error handling

### Phase 2: Historical Tracking (2-3 hours) ⭐ NEW
- [ ] Create DashboardHistory sheet structure
- [ ] Implement `DASHBOARD_storeHistoricalSnapshot()`
- [ ] Implement `DASHBOARD_getTrendData()`
- [ ] Implement `DASHBOARD_calculateTrends()`
- [ ] Add trend section to dashboard output

### Phase 3: Output Formatting (1-2 hours)
- [ ] Design 7-section sheet layout (including trends)
- [ ] Implement `DASHBOARD_writeToSheet()`
- [ ] Add color coding
- [ ] Test formatting

### Phase 4: Auto-Refresh Integration (1 hour) ⭐ NEW
- [ ] Add auto-refresh hook to assignment logic
- [ ] Implement silent mode
- [ ] Add refresh timestamp to dashboard
- [ ] Test auto-refresh behavior

### Phase 5: UI Integration (1 hour)
- [ ] Add sidebar button
- [ ] Add menu item
- [ ] Wire up event handlers
- [ ] Test user flows

### Phase 6: Configuration (30 minutes) ⭐ NEW
- [ ] Add 8 threshold settings to Config sheet
- [ ] Document default values
- [ ] Test threshold customization

### Phase 7: Testing & Documentation (2-3 hours)
- [ ] Manual testing with sample data
- [ ] Test trend calculations
- [ ] Test auto-refresh
- [ ] Edge case testing
- [ ] Update CLAUDE.md
- [ ] Create usage examples

**Total Estimated Time**: 11-15 hours (was 6-9 hours)

---

## Updated Success Criteria

### Functionality
- ✅ Dashboard generates without errors for any month
- ✅ All 7 sections populate with accurate data (including trends)
- ✅ Thresholds read from Config sheet with proper defaults
- ✅ Auto-refresh triggers after assignment completion
- ✅ Historical snapshots save correctly
- ✅ Trend calculations are accurate
- ✅ Handles edge cases gracefully

### Usability
- ✅ One-click generation from sidebar
- ✅ Auto-updates when assignments change
- ✅ Clear, actionable insights with trends
- ✅ Visual indicators aid understanding
- ✅ Configurable for different parish sizes

### Performance
- ✅ Generates in < 25 seconds for large parishes (slightly slower due to trends)
- ✅ Auto-refresh doesn't block assignment workflow
- ✅ Historical storage doesn't bloat spreadsheet

---

## Migration Notes

### For Existing Deployments

1. **Config Sheet Setup**:
   - Add 8 new dashboard threshold settings
   - Use default values if parish doesn't need customization

2. **DashboardHistory Sheet**:
   - Will be auto-created on first dashboard generation
   - No manual setup required

3. **Existing Dashboards**:
   - First generation will show "No trend data available"
   - Trends will populate after 2+ months of data

4. **Auto-Refresh**:
   - Automatically enabled after deployment
   - No opt-out needed (silent failures don't interrupt workflow)

---

## Open Items / Clarifications

### 1. Trend Lookback Period
**Question**: How many months back should trends analyze?

**Options**:
- A) 1 month (current vs previous)
- B) 3 months (quarterly view) ✅ **RECOMMENDED**
- C) 6 months (semi-annual)
- D) 12 months (full year)

**Recommendation**: 3 months for balanced insight without clutter

### 2. Auto-Refresh Notification
**Question**: Should auto-refresh show a notification to user?

**Options**:
- A) Silent (no notification, just logs) ✅ **RECOMMENDED**
- B) Subtle toast message ("Dashboard updated")
- C) Full success message

**Recommendation**: Silent mode to avoid interrupting workflow

### 3. Historical Data Retention
**Question**: How long to keep historical snapshots?

**Options**:
- A) Forever (unlimited history)
- B) Rolling 12 months ✅ **RECOMMENDED**
- C) Rolling 24 months
- D) Manual cleanup only

**Recommendation**: Rolling 12 months keeps file size manageable

---

## Approval Checklist

Updated scope confirmed:

- [x] Configurable thresholds via Config sheet
- [x] Auto-refresh after assignment completion
- [x] Historical data tracking (DashboardHistory sheet)
- [x] Trend analysis (month-over-month comparison)
- [x] Both sidebar and menu integration
- [x] Increased timeline to 11-15 hours acceptable

**Ready to implement?** Please confirm decisions on the 3 open items above, then I'll proceed with implementation.
