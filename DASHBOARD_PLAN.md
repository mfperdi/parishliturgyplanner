# Dashboard Analytics - Implementation Plan

## Overview

Add a comprehensive analytics dashboard to provide visibility into volunteer participation patterns, coverage gaps, and scheduling health. This addresses the current gap where administrators have no easy way to identify over/under-utilized volunteers or monitor scheduling effectiveness.

## Business Goals

1. **Prevent volunteer burnout** - Identify volunteers serving too frequently
2. **Improve coverage** - Highlight gaps in mass/ministry assignments
3. **Fair distribution** - Show utilization imbalances across volunteer pool
4. **Proactive planning** - Identify patterns in timeoff requests
5. **Data-driven decisions** - Give coordinators actionable insights

## Feature Scope

### In Scope (MVP)
- ✅ Volunteer service frequency analysis (current month + year-to-date)
- ✅ Coverage percentage by mass and ministry
- ✅ Unassigned role count summary
- ✅ Timeoff pattern analysis (most requested dates)
- ✅ Burnout risk indicators
- ✅ Dashboard sheet output (formatted for readability)
- ✅ Sidebar integration (one-click generation)
- ✅ Menu integration (admin tools)

### Out of Scope (Future Enhancements)
- ❌ Month-over-month trend charts
- ❌ Email alerts for critical coverage gaps
- ❌ Predictive analytics (forecasting future gaps)
- ❌ Volunteer performance ratings
- ❌ Interactive filtering (Google Sheets only supports static output)

## Data Model

### Dashboard Sheet Structure

**Sheet Name**: `Dashboard`

**Layout**: Multi-section report with headers and formatted data

```
╔════════════════════════════════════════════════════════════════════╗
║          DASHBOARD ANALYTICS - [Month Year]                        ║
║          Generated: [Timestamp]                                    ║
╚════════════════════════════════════════════════════════════════════╝

┌─ SECTION 1: VOLUNTEER SERVICE FREQUENCY ─────────────────────────┐
│ Volunteer Name | Month Count | YTD Count | Last Served | Avg Days │
│                |             |           |             | Between  │
│                |             |           |             | Assigns  │
│ Status         |             |           |             |          │
├──────────────────────────────────────────────────────────────────┤
│ John Smith     | 4           | 12        | 2/15/2026   | 14      │
│ Over-utilized ⚠️                                                 │
├──────────────────────────────────────────────────────────────────┤
│ Mary Johnson   | 2           | 6         | 2/8/2026    | 21      │
│ Balanced ✓                                                       │
└──────────────────────────────────────────────────────────────────┘

┌─ SECTION 2: COVERAGE BY MASS ────────────────────────────────────┐
│ Event ID   | Mass Description    | Total  | Assigned | Coverage │
│            |                     | Roles  | Roles    | %        │
│ Status     |                     |        |          |          │
├──────────────────────────────────────────────────────────────────┤
│ SUN-1000   | Sunday 10:00 AM    | 20     | 18       | 90%     │
│ Good ✓                                                           │
├──────────────────────────────────────────────────────────────────┤
│ SAT-1700   | Saturday Vigil     | 15     | 8        | 53%     │
│ Warning ⚠️                                                       │
└──────────────────────────────────────────────────────────────────┘

┌─ SECTION 3: COVERAGE BY MINISTRY ────────────────────────────────┐
│ Ministry Name      | Total Roles | Assigned | Coverage % | Status│
├──────────────────────────────────────────────────────────────────┤
│ Lector             | 45          | 40       | 89%       | Good ✓│
│ Eucharistic Min.   | 60          | 28       | 47%       | Critical🚨│
└──────────────────────────────────────────────────────────────────┘

┌─ SECTION 4: UNASSIGNED ROLES SUMMARY ────────────────────────────┐
│ Total Unassigned: 42 roles                                       │
│                                                                   │
│ By Ministry:                                                      │
│   Lector: 5 roles                                                │
│   Eucharistic Minister: 32 roles                                 │
│   Music Ministry: 5 roles                                        │
│                                                                   │
│ By Week:                                                          │
│   Week of 2/1: 12 roles                                          │
│   Week of 2/8: 18 roles                                          │
│   Week of 2/15: 8 roles                                          │
│   Week of 2/22: 4 roles                                          │
└──────────────────────────────────────────────────────────────────┘

┌─ SECTION 5: TIMEOFF PATTERN ANALYSIS ────────────────────────────┐
│ Date       | Volunteers | Masses      | Impact Level             │
│            | Unavailable| Affected    |                          │
├──────────────────────────────────────────────────────────────────┤
│ 2/15/2026  | 8          | 3           | High Impact 🚨          │
│ 2/8/2026   | 4          | 2           | Medium Impact ⚠️        │
│ 2/22/2026  | 2          | 1           | Low Impact              │
└──────────────────────────────────────────────────────────────────┘

┌─ SECTION 6: BURNOUT RISK ALERTS ─────────────────────────────────┐
│ Volunteer Name | Assignments | Days Since | Risk Level           │
│                | This Month  | Last Assign|                      │
├──────────────────────────────────────────────────────────────────┤
│ John Smith     | 4           | 3          | High Risk 🚨        │
│ Sarah Davis    | 3           | 5          | Medium Risk ⚠️      │
│ Mike Brown     | 2           | 14         | Low Risk            │
└──────────────────────────────────────────────────────────────────┘
```

## Technical Architecture

### File Structure

**New File**: `8_dashboardlogic.gs`
- Follows existing naming convention (8_ = new feature after tests)
- Contains all dashboard analytics logic
- ~500 lines estimated

**Modified Files**:
- `0a_constants.gs` - Add Dashboard sheet constant ✓ (already added)
- `0_code.gs` - Add menu item
- `Sidebar.html` - Add dashboard button

### Constants (0a_constants.gs)

```javascript
SHEETS: {
  // ... existing sheets
  DASHBOARD: "Dashboard"  // ✓ Already added
}

// No column constants needed (dashboard uses dynamic layout)
```

### Core Functions (8_dashboardlogic.gs)

#### Main Entry Point
```javascript
function DASHBOARD_generateAnalytics(monthString)
```
- Validates month string
- Calls all analytics functions
- Aggregates results
- Writes to Dashboard sheet
- Returns success message

#### Analytics Functions

**1. Volunteer Frequency Analysis**
```javascript
function DASHBOARD_analyzeVolunteerFrequency(monthString)
```
- Reads all assignments for month
- Counts assignments per volunteer
- Calculates YTD assignments
- Determines last service date
- Calculates average days between assignments
- Classifies utilization status

**2. Mass Coverage Analysis**
```javascript
function DASHBOARD_analyzeCoverageByMass(monthString)
```
- Groups assignments by Event ID
- Counts total roles vs assigned roles per mass
- Calculates coverage percentage
- Classifies status (Good/Warning/Critical)

**3. Ministry Coverage Analysis**
```javascript
function DASHBOARD_analyzeCoverageByMinistry(monthString)
```
- Groups assignments by Ministry
- Counts total roles vs assigned roles per ministry
- Calculates coverage percentage
- Classifies status

**4. Unassigned Role Analysis**
```javascript
function DASHBOARD_analyzeUnassignedRoles(monthString)
```
- Counts total unassigned roles
- Breaks down by ministry
- Breaks down by week
- Returns summary object

**5. Timeoff Pattern Analysis**
```javascript
function DASHBOARD_analyzeTimeoffPatterns(monthString)
```
- Reads approved timeoffs for month
- Counts volunteers per date
- Identifies masses affected
- Classifies impact level

**6. Burnout Risk Analysis**
```javascript
function DASHBOARD_calculateBurnoutRisk(monthString)
```
- Calculates assignment frequency
- Checks recent assignment spacing
- Compares to average
- Flags high-risk volunteers

#### Helper Functions

```javascript
function DASHBOARD_getVolunteerStats(volunteerId, monthString)
function DASHBOARD_calculateAverageDaysBetween(dates)
function DASHBOARD_classifyUtilization(count, average)
function DASHBOARD_classifyCoverage(percentage)
function DASHBOARD_classifyImpact(volunteerCount)
function DASHBOARD_classifyBurnoutRisk(assignments, daysSince, average)
```

#### Output Functions

```javascript
function DASHBOARD_writeToSheet(analyticsData, monthString)
```
- Clears existing dashboard sheet (or creates if missing)
- Writes header section
- Writes each analytics section with formatting
- Applies colors/styles
- Auto-resizes columns

### Classification Logic

#### Volunteer Utilization
```javascript
const monthlyAverage = totalAssignments / activeVolunteerCount;

if (volunteerAssignments < monthlyAverage * 0.5) {
  status = "Under-utilized 💡";
} else if (volunteerAssignments > monthlyAverage * 1.5) {
  status = "Over-utilized ⚠️";
} else {
  status = "Balanced ✓";
}
```

#### Coverage Status
```javascript
const coveragePercent = (assignedRoles / totalRoles) * 100;

if (coveragePercent >= 80) {
  status = "Good ✓";
  color = GREEN;
} else if (coveragePercent >= 50) {
  status = "Warning ⚠️";
  color = YELLOW;
} else {
  status = "Critical 🚨";
  color = RED;
}
```

#### Burnout Risk
```javascript
const isOverworked = assignments > monthlyAverage * 1.5;
const isFrequent = daysSinceLastAssignment < 7;

if (isOverworked && isFrequent) {
  risk = "High Risk 🚨";
} else if (isOverworked || isFrequent) {
  risk = "Medium Risk ⚠️";
} else {
  risk = "Low Risk";
}
```

#### Timeoff Impact
```javascript
if (volunteersUnavailable > 5) {
  impact = "High Impact 🚨";
} else if (volunteersUnavailable >= 3) {
  impact = "Medium Impact ⚠️";
} else {
  impact = "Low Impact";
}
```

## User Interface Integration

### Sidebar (Sidebar.html)

**Placement**: Add new step in "Finalize & Export" phase (after step 7, before step 8)

```html
<div class="step-item">
  <div class="step-icon" style="background-color: #1e8e3e;">📊</div>
  <div class="step-content">
    <div class="step-title">
      View Dashboard Analytics
      <span id="completion-dashboard" class="completion-badge hidden">✓ Complete</span>
    </div>
    <div class="step-description">Analyze volunteer utilization and coverage patterns</div>
    <button id="btn-dashboard" class="btn btn-secondary" disabled>
      Generate Dashboard
    </button>
  </div>
</div>
```

**JavaScript**:
```javascript
btnDashboard.addEventListener('click', () => {
  const selectedMonth = monthSelect.value;
  if (!selectedMonth) return;

  const selectedText = monthSelect.options[monthSelect.selectedIndex].text;
  const msg = `Generating dashboard analytics for ${selectedText}...`;
  showLoading(msg);

  google.script.run
    .withSuccessHandler((message) => {
      showSuccess(message);
      markStepComplete('dashboard');
    })
    .withFailureHandler((error) => showError(error, 'dashboard'))
    .DASHBOARD_generateAnalytics(selectedMonth);
});
```

### Menu (0_code.gs)

**Placement**: Add to "Admin Tools" submenu

```javascript
.addSubMenu(ui.createMenu('Admin Tools')
  .addItem('Generate Liturgical Calendar', 'CALENDAR_generateLiturgicalCalendar')
  .addItem('Validate Data', 'showDataValidation')
  .addSeparator()
  .addItem('View Dashboard Analytics', 'DASHBOARD_showDashboardDialog')  // NEW
  .addSeparator()
  // ... existing items
)
```

**Wrapper Function**:
```javascript
function DASHBOARD_showDashboardDialog() {
  const ui = SpreadsheetApp.getUi();
  const config = HELPER_readConfigSafe();
  const year = config['Year to Schedule'];

  // Get available months
  const months = getMonthsForSidebar();

  if (months.length === 0) {
    HELPER_showError('No Calendar Data',
      new Error('Please generate liturgical calendar first.'),
      'calendar');
    return;
  }

  // Show simple prompt for month selection
  const result = HELPER_promptUser(
    'Generate Dashboard Analytics',
    'Select month to analyze:',
    {
      type: 'dropdown',
      options: months.map(m => m.display),
      default: 0
    }
  );

  if (result.buttonPressed === 'OK') {
    const monthString = months[result.selectedIndex].value;
    const message = DASHBOARD_generateAnalytics(monthString);
    HELPER_showSuccess('Dashboard Generated', message);
  }
}
```

## Data Sources

### Input Sheets
1. **Assignments** - Primary data source
   - Date, Ministry, Role, Assigned Volunteer ID, Status
   - Filter by Month-Year column

2. **Volunteers** - Active volunteer list
   - Volunteer ID, Full Name, Status
   - Filter Status = "Active"

3. **Timeoffs** - Timeoff requests
   - Volunteer Name, Selected Dates, Status
   - Filter Status = "Approved"

4. **LiturgicalCalendar** - Date context
   - Date, Liturgical Celebration
   - For date formatting/context

### Output Sheet
- **Dashboard** - Formatted analytics report

## Performance Considerations

### Optimization Strategies

1. **Caching**: Use `HELPER_readSheetDataCached()` for frequently accessed sheets
2. **Batch Processing**: Read all data once, process in memory
3. **Efficient Data Structures**: Use Maps for lookups instead of array searching
4. **Minimal API Calls**: Write entire dashboard in single `setValues()` call

### Expected Performance
- Small parish (50 volunteers, 100 assignments/month): < 5 seconds
- Medium parish (150 volunteers, 400 assignments/month): < 10 seconds
- Large parish (300 volunteers, 1000 assignments/month): < 20 seconds

## Error Handling

### Validation Checks
1. Month string format validation
2. Calendar existence check
3. Assignments sheet existence
4. Volunteers sheet existence
5. Minimum data requirements (at least 1 assignment)

### Error Messages
```javascript
try {
  // Validate month
  const { year, month } = HELPER_validateMonthString(monthString);

  // Check data availability
  const assignments = HELPER_readSheetDataCached(CONSTANTS.SHEETS.ASSIGNMENTS);
  if (assignments.length === 0) {
    throw new Error('No assignments found. Please generate schedule first.');
  }

  // Process analytics
  const result = processAnalytics(monthString);

  return `Dashboard generated for ${monthString}`;

} catch (e) {
  Logger.log(`ERROR in DASHBOARD_generateAnalytics: ${e.message}`);
  throw new Error(`Dashboard generation failed: ${e.message}`);
}
```

## Testing Plan

### Test Scenarios

**1. Empty State**
- No assignments → Show "No data available" message
- No volunteers → Show warning
- No timeoffs → Show "No timeoffs this month"

**2. Typical Month**
- 50 volunteers, 200 assignments
- Mix of assigned/unassigned roles
- 10 timeoff requests
- Verify all sections populate correctly

**3. Edge Cases**
- All roles assigned (100% coverage)
- All roles unassigned (0% coverage)
- Single volunteer with all assignments (burnout test)
- Month with no masses (holiday/special case)

**4. Data Quality**
- Missing volunteer names → Handle gracefully
- Invalid dates → Skip and log warning
- Duplicate assignments → Count correctly

### Manual Testing Checklist
- [ ] Generate dashboard from sidebar
- [ ] Generate dashboard from menu
- [ ] Verify all 6 sections appear
- [ ] Check formatting (colors, alignment)
- [ ] Validate calculations (spot-check counts)
- [ ] Test with different months
- [ ] Test with empty month (no schedule generated)
- [ ] Verify error messages are helpful

## Documentation Updates

### CLAUDE.md Additions

**1. Add to File Inventory**
```markdown
| `8_dashboardlogic.gs` | Dashboard analytics generation | `DASHBOARD_*()` functions |
```

**2. Add New Workflow Section**
```markdown
### Workflow 8: Dashboard Analytics

**Trigger**: User clicks "Generate Dashboard" or runs from Admin Tools menu

**Process** (`DASHBOARD_generateAnalytics()`):
1. Validate month string
2. Read assignments for month
3. Calculate volunteer frequency stats
4. Analyze coverage by mass and ministry
5. Count unassigned roles
6. Analyze timeoff patterns
7. Calculate burnout risk indicators
8. Write formatted report to Dashboard sheet

**Analytics Provided**:
- Volunteer service frequency (over/under/balanced utilization)
- Coverage percentage by mass and ministry
- Unassigned role summary
- Timeoff pattern insights
- Burnout risk alerts

**Use Cases**:
- Monthly scheduling review
- Volunteer recruitment planning
- Burnout prevention
- Coverage gap identification
```

**3. Update Data Model Section**
```markdown
#### Output Sheets

**Dashboard** - Analytics report
- Multi-section formatted report
- Generated on-demand for any month
- Shows volunteer utilization, coverage stats, and risk indicators
```

## Open Questions / Decisions Needed

### 1. Scope
**Question**: Should dashboard show only current month, or allow any month selection?

**Options**:
- A) Current month only (simpler, less useful)
- B) Any month via dropdown (more flexible) ✅ **RECOMMENDED**
- C) Month range (e.g., "Last 3 months") (complex, maybe v2)

**Recommendation**: Option B - Allow month selection for flexibility

### 2. Thresholds
**Question**: Should utilization/burnout thresholds be configurable or hardcoded?

**Options**:
- A) Hardcoded in code (simpler, good defaults) ✅ **RECOMMENDED**
- B) Config sheet settings (flexible, more complex)
- C) Dynamic based on parish size (adaptive, complex)

**Recommendation**: Option A for MVP, Option B for v2 if needed

**Proposed Defaults**:
- Under-utilized: < 50% of average
- Over-utilized: > 150% of average
- Burnout risk: > 150% average AND < 7 days spacing
- Coverage warning: < 80%
- Coverage critical: < 50%

### 3. Formatting
**Question**: How much visual styling should dashboard use?

**Options**:
- A) Plain text report (simple, fast)
- B) Color-coded cells (visual, helpful) ✅ **RECOMMENDED**
- C) Charts/graphs (beautiful, requires Google Charts API)

**Recommendation**: Option B - Use background colors and emojis for clarity

### 4. Refresh Behavior
**Question**: Should dashboard auto-refresh when assignments change?

**Options**:
- A) Manual refresh only (simpler, user-controlled) ✅ **RECOMMENDED**
- B) Auto-refresh on assignment completion (convenient, complex)
- C) Daily scheduled refresh (automatic, unnecessary)

**Recommendation**: Option A - Manual refresh gives control, avoids performance issues

### 5. Historical Data
**Question**: Should dashboard track month-over-month trends?

**Options**:
- A) Current month snapshot only ✅ **RECOMMENDED for MVP**
- B) Store monthly snapshots for comparison (v2 feature)
- C) Full historical analysis (v3 feature)

**Recommendation**: Option A for MVP, defer trend analysis to future version

## Implementation Timeline

### Phase 1: Core Analytics (Est. 3-4 hours)
- [ ] Create `8_dashboardlogic.gs`
- [ ] Implement all 6 analytics functions
- [ ] Implement helper functions
- [ ] Add error handling

### Phase 2: Output Formatting (Est. 1-2 hours)
- [ ] Design sheet layout
- [ ] Implement `DASHBOARD_writeToSheet()`
- [ ] Add color coding
- [ ] Test formatting

### Phase 3: UI Integration (Est. 1 hour)
- [ ] Add sidebar button
- [ ] Add menu item
- [ ] Wire up event handlers
- [ ] Test user flows

### Phase 4: Testing & Documentation (Est. 1-2 hours)
- [ ] Manual testing with sample data
- [ ] Edge case testing
- [ ] Update CLAUDE.md
- [ ] Create usage examples

**Total Estimated Time**: 6-9 hours

## Success Criteria

### Functionality
- ✅ Dashboard generates without errors for any month
- ✅ All 6 sections populate with accurate data
- ✅ Calculations match manual verification
- ✅ Handles edge cases gracefully

### Usability
- ✅ One-click generation from sidebar
- ✅ Clear, actionable insights
- ✅ Visual indicators (colors/emojis) aid understanding
- ✅ Error messages are helpful

### Performance
- ✅ Generates in < 20 seconds for large parishes
- ✅ Doesn't slow down other operations
- ✅ Uses efficient data structures

### Maintainability
- ✅ Follows existing code conventions
- ✅ Well-documented functions
- ✅ Easy to extend with new metrics
- ✅ Comprehensive error logging

## Future Enhancements (v2)

1. **Email Reports** - Automatically email dashboard to coordinators
2. **Trend Analysis** - Month-over-month comparison charts
3. **Configurable Thresholds** - Admin-defined utilization limits
4. **Export to PDF** - One-click PDF export
5. **Volunteer Notifications** - Auto-email under-utilized volunteers
6. **Predictive Analytics** - Forecast future coverage gaps
7. **Mobile Dashboard** - Responsive web view
8. **Real-time Alerts** - Notify when coverage drops below threshold

---

## Approval Checklist

Before implementation begins, please confirm:

- [ ] **Scope is clear** - All 6 analytics sections approved
- [ ] **UI placement is correct** - Sidebar + menu integration
- [ ] **Thresholds are reasonable** - Default values make sense
- [ ] **Technical approach is sound** - File structure and architecture
- [ ] **Timeline is acceptable** - 6-9 hours estimated effort
- [ ] **Open questions resolved** - All decisions finalized

**Ready to proceed?** Please review this plan and provide feedback.
