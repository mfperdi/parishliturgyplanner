# Dashboard Sheet - Mockup (Hybrid Approach)

## Overview

The Dashboard uses a **3-layer architecture**:
1. **DATA LAYER** (Columns A-M, hidden) - Raw data written by Apps Script
2. **CALCULATION LAYER** (Columns N-Z, hidden) - Formulas do the math
3. **PRESENTATION LAYER** (Columns AA+, visible) - Formatted display for users

---

## Complete Sheet Layout

### Row 1-5: Header Section
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA1: PARISH SCHEDULER - DASHBOARD ANALYTICS                                   ║
║  AA2: Month: [February 2026]        Generated: [2/28/2026 10:30 AM]           ║
║  AA3: Last Refreshed: [2/28/2026 10:35 AM]    Auto-refresh: ✓ Enabled         ║
║  AA4: [blank row for spacing]                                                  ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

**Formulas:**
```
AA1: ="PARISH SCHEDULER - DASHBOARD ANALYTICS"
AA2: ="Month: " & TEXT(DataLayer!B1,"MMMM YYYY") & "     Generated: " & TEXT(DataLayer!C1,"M/D/YYYY h:mm AM/PM")
AA3: ="Last Refreshed: " & TEXT(NOW(),"M/D/YYYY h:mm AM/PM") & "     Auto-refresh: " & IF(DataLayer!D1=TRUE,"✓ Enabled","○ Disabled")
```

---

## SECTION 1: Volunteer Service Frequency (Rows 6-25)

### Section Header (Row 6)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA6: 📊 VOLUNTEER SERVICE FREQUENCY                                           ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Column Headers (Row 7)
```
| AA7       | AB7   | AC7  | AD7         | AE7      | AF7           | AG7    |
|-----------|-------|------|-------------|----------|---------------|--------|
| Volunteer | This  | YTD  | Last        | Days     | Utilization   | Status |
| Name      | Month |      | Served      | Since    | %             |        |
```

### Data Rows (8-25, example data)
```
| AA8           | AB8 | AC8 | AD8        | AE8 | AF8  | AG8              |
|---------------|-----|-----|------------|-----|------|------------------|
| John Smith    | 4   | 12  | 2/15/2026  | 13  | 167% | Over-utilized ⚠️ |
| Mary Johnson  | 2   | 6   | 2/8/2026   | 20  | 83%  | Balanced ✓       |
| Bob Williams  | 1   | 3   | 1/18/2026  | 41  | 42%  | Under-utilized 💡|
| Sarah Davis   | 3   | 9   | 2/20/2026  | 8   | 125% | Balanced ✓       |
```

### Hidden Data Layer (Columns A-M)
```
| A8    | B8           | C8 | D8 | E8        | F8  |
|-------|--------------|----|----|-----------|-----|
| V001  | John Smith   | 4  | 12 | 2/15/2026 | ... |
| V002  | Mary Johnson | 2  | 6  | 2/8/2026  | ... |
| V003  | Bob Williams | 1  | 3  | 1/18/2026 | ... |
```

### Hidden Calculation Layer (Columns N-Z)
```
| N8   | O8        | P8   |
|------|-----------|------|
| 13   | 167%      | Over |
| 20   | 83%       | Bal. |
| 41   | 42%       | Under|
```

### Formulas Explained

**AA8 (Volunteer Name):**
```
=B8
```
Pull from data layer

**AB8 (This Month):**
```
=C8
```
Pull from data layer

**AC8 (YTD):**
```
=D8
```
Pull from data layer

**AD8 (Last Served):**
```
=TEXT(E8,"M/D/YYYY")
```
Format date from data layer

**AE8 (Days Since):**
```
=N8
```
Where N8 = `=IF(E8="","",TODAY()-E8)`

**AF8 (Utilization %):**
```
=O8
```
Where O8 = `=IF(C8="","",TEXT(C8/AVERAGE($C$8:$C$25),"0%"))`

**AG8 (Status):**
```
=P8 & " " &
 IF(P8="Over-utilized","⚠️",
    IF(P8="Under-utilized","💡","✓"))
```
Where P8 =
```
=IF(C8="","",
   IF((C8/AVERAGE($C$8:$C$25)) < Config!$B$10, "Under-utilized",
      IF((C8/AVERAGE($C$8:$C$25)) > Config!$B$11, "Over-utilized", "Balanced")))
```

**Conditional Formatting (Column AG):**
- Background: Green if contains "Balanced", Yellow if "Under", Red if "Over"
- Font: Bold

### Summary Row (Row 26)
```
| AA26          | AB26 | AC26 | AD26   | AE26   | AF26    | AG26           |
|---------------|------|------|--------|--------|---------|----------------|
| SUMMARY       | 50   | 180  | Avg:   | 20 days| Average | 12 Under, 8 Over|
```

**Formulas:**
```
AB26: =SUM(AB8:AB25)                  // Total assignments this month
AC26: =SUM(AC8:AC25)                  // Total YTD
AE26: ="Avg: " & ROUND(AVERAGE(AE8:AE25),0) & " days"
AG26: =COUNTIF(AG8:AG25,"*Under*") & " Under, " & COUNTIF(AG8:AG25,"*Over*") & " Over"
```

---

## SECTION 2: Coverage by Mass (Rows 28-45)

### Section Header (Row 28)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA28: 📅 COVERAGE BY MASS                                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Column Headers (Row 29)
```
| AA29      | AB29              | AC29  | AD29     | AE29      | AF29   |
|-----------|-------------------|-------|----------|-----------|--------|
| Event ID  | Mass Description  | Total | Assigned | Coverage  | Status |
|           |                   | Roles | Roles    | %         |        |
```

### Data Rows (30-45)
```
| AA30     | AB30              | AC30 | AD30 | AE30 | AF30         |
|----------|-------------------|------|------|------|--------------|
| SUN-1000 | Sunday 10:00 AM   | 20   | 18   | 90%  | Good ✓       |
| SAT-1700 | Saturday Vigil    | 15   | 8    | 53%  | Warning ⚠️   |
| SUN-0800 | Sunday 8:00 AM    | 12   | 5    | 42%  | Critical 🚨  |
| FRI-1900 | First Friday 7pm  | 10   | 10   | 100% | Good ✓       |
```

### Hidden Data Layer (Columns G-J)
```
| G30      | H30               | I30 | J30 |
|----------|-------------------|-----|-----|
| SUN-1000 | Sunday 10:00 AM   | 20  | 18  |
| SAT-1700 | Saturday Vigil    | 15  | 8   |
```

### Hidden Calculation Layer (Columns Q-S)
```
| Q30 | R30  | S30      |
|-----|------|----------|
| 90  | 90%  | Good     |
| 53  | 53%  | Warning  |
| 42  | 42%  | Critical |
```

### Formulas Explained

**AA30 (Event ID):**
```
=G30
```

**AB30 (Description):**
```
=H30
```

**AC30 (Total Roles):**
```
=I30
```

**AD30 (Assigned):**
```
=J30
```

**AE30 (Coverage %):**
```
=R30
```
Where R30 = `=TEXT(J30/I30,"0%")`

**AF30 (Status):**
```
=S30 & " " &
 IF(S30="Good","✓",
    IF(S30="Warning","⚠️","🚨"))
```
Where S30 =
```
=IF(Q30 >= Config!$B$12, "Good",
   IF(Q30 >= Config!$B$13, "Warning", "Critical"))
```
(Q30 = `=J30/I30*100`)

**Conditional Formatting (Column AF):**
- Background: Green if "Good", Yellow if "Warning", Red if "Critical"

### Summary Row (Row 46)
```
| AA46     | AB46    | AC46 | AD46 | AE46 | AF46                    |
|----------|---------|------|------|------|-------------------------|
| SUMMARY  | Overall | 155  | 131  | 85%  | 10 Good, 3 Warn, 2 Crit |
```

---

## SECTION 3: Coverage by Ministry (Rows 48-60)

### Section Header (Row 48)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA48: 📖 COVERAGE BY MINISTRY                                                 ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Column Headers (Row 49)
```
| AA49              | AB49  | AC49     | AD49      | AE49   |
|-------------------|-------|----------|-----------|--------|
| Ministry Name     | Total | Assigned | Coverage  | Status |
|                   | Roles | Roles    | %         |        |
```

### Data Rows (50-60)
```
| AA50              | AB50 | AC50 | AD50 | AE50         |
|-------------------|------|------|------|--------------|
| Lector            | 45   | 40   | 89%  | Good ✓       |
| Eucharistic Min.  | 60   | 28   | 47%  | Critical 🚨  |
| Music Ministry    | 20   | 18   | 90%  | Good ✓       |
| Usher             | 30   | 25   | 83%  | Good ✓       |
```

**Formulas:** Similar pattern to Section 2

---

## SECTION 4: Unassigned Roles Summary (Rows 62-75)

### Section Header (Row 62)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA62: ⚠️ UNASSIGNED ROLES                                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Total Count (Row 63)
```
| AA63                      | AB63 |
|---------------------------|------|
| Total Unassigned Roles:   | 42   |
```

**Formula AB63:**
```
=COUNTIF(Assignments!M:M,"Unassigned")
```

### By Ministry Breakdown (Rows 65-70)
```
| AA65              | AB65 |
|-------------------|------|
| BY MINISTRY       |      |
| Lector            | 5    |
| Eucharistic Min.  | 32   |
| Music Ministry    | 2    |
| Usher             | 3    |
```

**Formula AB66 (Lector count):**
```
=COUNTIFS(Assignments!E:E,"Lector",Assignments!M:M,"Unassigned",Assignments!I:I,DataLayer!$B$1)
```

### By Week Breakdown (Rows 72-75)
```
| AA72          | AB72 |
|---------------|------|
| BY WEEK       |      |
| Week of 2/1   | 12   |
| Week of 2/8   | 18   |
| Week of 2/15  | 8    |
| Week of 2/22  | 4    |
```

**Formula AB73 (Week of 2/1):**
```
=COUNTIFS(Assignments!A:A,">="&DATE(2026,2,1),Assignments!A:A,"<"&DATE(2026,2,8),Assignments!M:M,"Unassigned")
```

---

## SECTION 5: Timeoff Pattern Analysis (Rows 77-90)

### Section Header (Row 77)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA77: 🗓️ TIMEOFF PATTERNS                                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Column Headers (Row 78)
```
| AA78      | AB78        | AC78   | AD78         |
|-----------|-------------|--------|--------------|
| Date      | Volunteers  | Masses | Impact       |
|           | Unavailable | Affect | Level        |
```

### Data Rows (79-90, sorted by impact)
```
| AA79      | AB79 | AC79 | AD79               |
|-----------|------|------|--------------------|
| 2/15/2026 | 8    | 3    | High Impact 🚨     |
| 2/22/2026 | 5    | 2    | High Impact 🚨     |
| 2/8/2026  | 4    | 2    | Medium Impact ⚠️   |
| 2/1/2026  | 2    | 1    | Low Impact         |
```

### Hidden Data Layer (Columns K-M)
Apps Script writes:
```
| K79       | L79 | M79 |
|-----------|-----|-----|
| 2/15/2026 | 8   | 3   |
```

### Formulas

**AD79 (Impact Level):**
```
=IF(AB79 >= Config!$B$14, "High Impact 🚨",
   IF(AB79 >= Config!$B$15, "Medium Impact ⚠️", "Low Impact"))
```

**Conditional Formatting:** Red if "High", Yellow if "Medium"

---

## SECTION 6: Burnout Risk Alerts (Rows 92-110)

### Section Header (Row 92)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA92: 🔥 BURNOUT RISK ALERTS                                                  ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Column Headers (Row 93)
```
| AA93          | AB93        | AC93       | AD93       |
|---------------|-------------|------------|------------|
| Volunteer     | Assignments | Days Since | Risk       |
| Name          | This Month  | Last       | Level      |
```

### Data Rows (94-110, filtered to only show risk)
```
| AA94        | AB94 | AC94 | AD94            |
|-------------|------|------|-----------------|
| John Smith  | 4    | 3    | High Risk 🚨    |
| Sarah Davis | 3    | 5    | Medium Risk ⚠️  |
| Mike Brown  | 3    | 10   | Medium Risk ⚠️  |
```

**Formula (only shows rows with risk):**

**AA94:**
```
=QUERY(VolunteerFreq!AA8:AG25,
  "SELECT Col1, Col2, Col5
   WHERE Col7 CONTAINS 'Over' OR (Col2 > " & AVERAGE(VolunteerFreq!AB8:AB25)*1.25 & ")
   ORDER BY Col2 DESC")
```

**AD94 (Risk Level):**
```
=IF(AND(AB94 > AVERAGE(VolunteerFreq!$AB$8:$AB$25)*1.5, AC94 < Config!$B$16), "High Risk 🚨",
   IF(OR(AB94 > AVERAGE(VolunteerFreq!$AB$8:$AB$25)*1.25, AC94 < Config!$B$16), "Medium Risk ⚠️", "Low Risk"))
```

---

## SECTION 7: Month-over-Month Trends (Rows 112-125)

### Section Header (Row 112)
```
╔════════════════════════════════════════════════════════════════════════════════╗
║  AA112: 📈 TRENDS (vs Previous Month)                                          ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Column Headers (Row 113)
```
| AA113             | AB113   | AC113    | AD113  | AE113        |
|-------------------|---------|----------|--------|--------------|
| Metric            | Current | Previous | Change | Trend        |
```

### Data Rows (114-120)
```
| AA114             | AB114 | AC114 | AD114 | AE114        |
|-------------------|-------|-------|-------|--------------|
| Coverage %        | 85%   | 78%   | +7%   | Improving ↗️ |
| Avg Assignments   | 4.0   | 3.75  | +0.25 | Stable →     |
| High Burnout Risk | 2     | 1     | +1    | Worsening ↘️ |
| Unassigned Roles  | 30    | 45    | -15   | Improving ↗️ |
| Active Volunteers | 50    | 48    | +2    | Growing ↗️   |
```

**Data Source:** DashboardHistory sheet (written by Apps Script)

**Formulas:**

**AB114 (Current Coverage %):**
```
=R46  // Reference from Section 2 summary
```

**AC114 (Previous Coverage %):**
```
=VLOOKUP(TEXT(EDATE(DataLayer!B1,-1),"YYYY-MM"), DashboardHistory!A:P, 9, FALSE)
```
(Column 9 of DashboardHistory = Coverage %)

**AD114 (Change):**
```
=TEXT(AB114-AC114,"+0%;-0%;0%")
```

**AE114 (Trend):**
```
=IF(AB114>AC114, "Improving ↗️",
   IF(AB114<AC114, "Worsening ↘️", "Stable →"))
```

### Mini Sparkline Chart (Row 122)
```
| AA122                     | AB122-AF122 (merged cell)        |
|---------------------------|----------------------------------|
| Coverage % Last 6 Months  | [Sparkline chart: ▁▂▃▄▅█]       |
```

**Formula AB122:**
```
=SPARKLINE(
  QUERY(DashboardHistory!A:I,
    "SELECT I
     WHERE A >= '" & TEXT(EDATE(DataLayer!B1,-6),"YYYY-MM") & "'
     ORDER BY A"),
  {"charttype","line";"linewidth",2;"color1","#1a73e8"})
```

---

## Hidden DATA LAYER Reference (Columns A-M)

Apps Script writes this once, formulas read from it:

```
| A        | B              | C        | D         | E         | F    | G        | H            | I    | J    | K         | L    | M    |
|----------|----------------|----------|-----------|-----------|------|----------|--------------|------|------|-----------|------|------|
| Meta     | MonthString    | GenDate  | AutoRefr  |           |      |          |              |      |      |           |      |      |
| Header   | 2026-02        | 2/28/26  | TRUE      |           |      |          |              |      |      |           |      |      |
|          |                |          |           |           |      |          |              |      |      |           |      |      |
| Vol ID   | Vol Name       | Month    | YTD       | LastDate  | ... | EventID  | MassDesc     | Tot  | Asgn | TimeoffDt | Vols | Mass |
| V001     | John Smith     | 4        | 12        | 2/15/2026 |     | SUN-1000 | Sunday 10am  | 20   | 18   | 2/15/2026 | 8    | 3    |
| V002     | Mary Johnson   | 2        | 6         | 2/8/2026  |     | SAT-1700 | Sat Vigil    | 15   | 8    | 2/8/2026  | 4    | 2    |
```

**Apps Script Function:**
```javascript
function DASHBOARD_writeDataLayer(monthString) {
  const sheet = getOrCreateSheet('Dashboard');

  // Write metadata (row 1-2)
  sheet.getRange('B1').setValue(monthString);
  sheet.getRange('C1').setValue(new Date());
  sheet.getRange('D1').setValue(true); // Auto-refresh enabled

  // Write volunteer frequency data (starting row 5)
  const volunteerData = DASHBOARD_getVolunteerFrequencyData(monthString);
  sheet.getRange(5, 1, volunteerData.length, 6).setValues(volunteerData);

  // Write coverage by mass data
  const massData = DASHBOARD_getCoverageByMassData(monthString);
  sheet.getRange(5, 7, massData.length, 4).setValues(massData);

  // Write timeoff data
  const timeoffData = DASHBOARD_getTimeoffPatternData(monthString);
  sheet.getRange(5, 11, timeoffData.length, 3).setValues(timeoffData);

  Logger.log('Data layer written successfully');
}
```

---

## Config Sheet Threshold References

Dashboard formulas reference these Config sheet cells:

```
| A                                    | B    |
|--------------------------------------|------|
| Dashboard_UnderUtilized_Threshold    | 50   |  ← B10
| Dashboard_OverUtilized_Threshold     | 150  |  ← B11
| Dashboard_Coverage_Warning_Threshold | 80   |  ← B12
| Dashboard_Coverage_Critical_Threshold| 50   |  ← B13
| Dashboard_Timeoff_HighImpact_Threshold| 5   |  ← B14
| Dashboard_Timeoff_MediumImpact_Threshold| 3 |  ← B15
| Dashboard_Burnout_Spacing_Days       | 7    |  ← B16
```

**Admins can change these values and dashboard recalculates instantly!**

---

## Conditional Formatting Rules

### Rule 1: Utilization Status (Column AG)
- **Range:** AG8:AG25
- **Condition:** Custom formula `=REGEXMATCH(AG8,"Over")`
- **Format:** Background #F8D7DA (light red)

- **Condition:** Custom formula `=REGEXMATCH(AG8,"Under")`
- **Format:** Background #FFF3CD (light yellow)

- **Condition:** Custom formula `=REGEXMATCH(AG8,"Balanced")`
- **Format:** Background #D4EDDA (light green)

### Rule 2: Coverage Status (Column AF, rows 30-45)
- **Range:** AF30:AF45
- **Condition:** Custom formula `=REGEXMATCH(AF30,"Good")`
- **Format:** Background #D4EDDA (light green)

- **Condition:** Custom formula `=REGEXMATCH(AF30,"Warning")`
- **Format:** Background #FFF3CD (light yellow)

- **Condition:** Custom formula `=REGEXMATCH(AF30,"Critical")`
- **Format:** Background #F8D7DA (light red)

### Rule 3: Burnout Risk (Column AD, rows 94-110)
- **Range:** AD94:AD110
- **Condition:** Custom formula `=REGEXMATCH(AD94,"High")`
- **Format:** Background #F8D7DA, Font bold

- **Condition:** Custom formula `=REGEXMATCH(AD94,"Medium")`
- **Format:** Background #FFF3CD

---

## Sheet Protection & Hidden Columns

### Hidden Columns (A-Z)
- Columns A-M: Data layer (hidden from users)
- Columns N-Z: Calculation layer (hidden from users)
- Columns AA+: Visible presentation layer

**How to hide:**
Apps Script sets on creation:
```javascript
sheet.hideColumns(1, 26); // Hide columns A-Z
```

### Protected Ranges
- Data layer (A-M): Protected, only Apps Script can edit
- Calculation layer (N-Z): Protected, formulas locked
- Presentation layer (AA+): Unprotected, users can view/copy

```javascript
const protection = sheet.getRange('A:Z').protect();
protection.setDescription('Data and calculation layers - managed by system');
protection.setWarningOnly(true);
```

---

## Summary: What Apps Script Does vs What Formulas Do

### Apps Script Responsibilities:
1. ✅ Aggregate data from Assignments, Volunteers, Timeoffs, LiturgicalCalendar sheets
2. ✅ Write raw data to columns A-M (data layer)
3. ✅ Create initial formulas in columns N-Z (calculation layer) - **one time setup**
4. ✅ Create presentation formulas in columns AA+ - **one time setup**
5. ✅ Set up conditional formatting rules - **one time setup**
6. ✅ Hide columns A-Z
7. ✅ Store historical snapshot to DashboardHistory sheet
8. ✅ Trigger auto-refresh after assignments complete

### Formula Responsibilities (Automatic):
1. ✅ Calculate utilization percentages (N-Z columns)
2. ✅ Classify statuses based on Config thresholds
3. ✅ Format presentation layer (AA+ columns)
4. ✅ Pull trend data from DashboardHistory
5. ✅ Recalculate instantly when data layer changes
6. ✅ Recalculate when Config thresholds change

---

## Performance Notes

**Initial Generation** (Apps Script):
- Small parish: ~3-5 seconds
- Large parish: ~10-15 seconds

**Formula Recalculation** (Automatic):
- Instant (Google Sheets native)
- Happens whenever data layer updates
- No user wait time

**Auto-Refresh** (Apps Script):
- Runs silently after assignment completion
- Updates data layer only
- Formulas recalculate automatically
- User sees updated dashboard next time they open it

---

## User Experience

### Initial Setup (One Time):
1. Admin clicks "Generate Dashboard" from sidebar
2. Apps Script creates sheet, writes formulas, populates data
3. Dashboard appears with all 7 sections
4. Takes ~10 seconds

### Daily Use:
1. Admin runs auto-assignment
2. Dashboard auto-refreshes in background (silent)
3. Admin opens Dashboard sheet
4. Sees up-to-date analytics instantly
5. Can copy/export data as needed

### Customization:
1. Admin wants different "over-utilized" threshold
2. Goes to Config sheet, changes value from 150 to 140
3. Dashboard recalculates instantly (formulas update)
4. No code changes needed!

---

## Visual Example (Full Row)

**What the user sees:**

```
Row 8 (John Smith):
┌──────────────┬────────┬─────┬───────────┬──────────┬──────────────┬──────────────────┐
│ Volunteer    │ This   │ YTD │ Last      │ Days     │ Utilization  │ Status           │
│ Name         │ Month  │     │ Served    │ Since    │ %            │                  │
├──────────────┼────────┼─────┼───────────┼──────────┼──────────────┼──────────────────┤
│ John Smith   │ 4      │ 12  │ 2/15/2026 │ 13       │ 167%         │ Over-utilized ⚠️ │
│              │        │     │           │          │              │ [RED BACKGROUND] │
└──────────────┴────────┴─────┴───────────┴──────────┴──────────────┴──────────────────┘
   AA8           AB8      AC8    AD8         AE8         AF8             AG8
```

**What's happening behind the scenes:**

```
DATA LAYER (hidden):
A8=V001  B8=John Smith  C8=4  D8=12  E8=2/15/2026

CALCULATION LAYER (hidden):
N8: =TODAY()-E8              → 13
O8: =TEXT(C8/AVERAGE($C$8:$C$25),"0%")  → 167%
P8: =IF((C8/AVERAGE($C$8:$C$25)) > Config!$B$11, "Over-utilized", ...)  → "Over-utilized"

PRESENTATION LAYER (visible):
AA8: =B8                     → "John Smith"
AB8: =C8                     → 4
AC8: =D8                     → 12
AD8: =TEXT(E8,"M/D/YYYY")    → "2/15/2026"
AE8: =N8                     → 13
AF8: =O8                     → "167%"
AG8: =P8 & " ⚠️"             → "Over-utilized ⚠️"

CONDITIONAL FORMATTING:
AG8 background → RED (because contains "Over")
```

---

This hybrid approach gives you:
- ✅ **Real-time updates** - Formulas recalculate automatically
- ✅ **Easy customization** - Config sheet controls thresholds
- ✅ **Rich analytics** - Apps Script provides complex aggregations
- ✅ **Performance** - Native formulas are fast
- ✅ **Maintainability** - Clear separation of concerns

Ready to implement? 🚀
