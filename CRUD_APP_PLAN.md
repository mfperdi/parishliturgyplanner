# Parish Liturgical Scheduler - Google Apps Script Web App Plan

## Executive Summary

This document outlines the implementation plan for building a web/mobile/desktop CRUD application using **Google Apps Script Web App** deployment.

**Current State**: Google Apps Script add-in running within Google Sheets (Sidebar UI)
**Target State**: Standalone Google Apps Script Web App accessible via URL on any device
**Technology**: Google Apps Script + HtmlService + JavaScript (no external frameworks)
**Timeline**: Phased approach (MVP → Full Features → Production)
**Risk Level**: Low (same technology, no migration needed)

---

## 1. Current System Analysis

### Strengths
- ✅ Fully functional scheduling logic
- ✅ Comprehensive data validation
- ✅ Complex liturgical calendar generation
- ✅ Auto-assignment algorithm
- ✅ Existing mobile views (Google Sheets-based)
- ✅ Public schedule publishing capability
- ✅ Rich business logic in ~15 .gs files

### Limitations
- ❌ Requires Google Sheets access
- ❌ Limited mobile UX (Google Sheets app)
- ❌ No native mobile apps
- ❌ Admin-only interface (volunteers can't self-manage)
- ❌ No real-time collaboration features
- ❌ Limited reporting/analytics capabilities
- ❌ Difficult to integrate with parish website

### Existing Mobile Features
- **6_mobileviews**: Creates WeeklyView, UnassignedRoles, VolunteerLookup sheets
- **6_publicschedule.gs**: Publishes schedules to separate spreadsheets
- **Auto-publish**: Time-based triggers for automatic syncing
- **Ministry filtering**: Separate schedules per ministry

---

## 2. Architecture: Google Apps Script Web App

**Architecture**:
```
Browser (Desktop/Mobile/Tablet)
    ↓ HTTPS
Google Apps Script Web App (doGet/doPost)
    ↓ Direct Access
Google Sheets (existing data - same spreadsheet)
    ↑
Existing Apps Script functions (reuse all logic)
```

**How It Works**:
1. **Web App Deployment**: Deploy Apps Script as standalone web app via "Deploy > New deployment"
2. **Public URL**: Get a `script.google.com/macros/s/.../exec` URL
3. **Access Control**: Anyone with link, or restricted to organization
4. **UI**: HTML/CSS/JavaScript served via `HtmlService.createHtmlOutputFromFile()`
5. **Backend**: Existing `.gs` files (reuse ALL existing logic)
6. **Data**: Same Google Sheets (no migration needed!)

**Pros**:
- ✅ Zero migration - uses existing Google Sheets data
- ✅ Reuse ALL existing Apps Script logic (15+ .gs files)
- ✅ No external hosting needed (Google hosts it)
- ✅ Free (within Google Apps Script quotas)
- ✅ Built-in authentication (Google accounts)
- ✅ Can run in parallel with Sidebar
- ✅ Same permissions model
- ✅ Works on any device with browser
- ✅ No external dependencies

**Cons**:
- ❌ Limited to Apps Script quotas (6 min execution, 30 MB response)
- ❌ No modern frontend framework (vanilla JS only)
- ❌ Slower than dedicated backend
- ❌ UI must be server-rendered or client-side JS
- ❌ No WebSocket (but can use polling)

**Perfect For**: Parish scheduler with existing Apps Script codebase

---

## 3. Tech Stack (Apps Script Only)

### Frontend
**Choice: HTML + CSS + Vanilla JavaScript**

**Why No Framework?**:
- Apps Script HtmlService doesn't support npm packages
- Can't bundle React, Vue, etc. without complex workarounds
- Must use vanilla JS or CDN libraries

**Allowed Libraries (via CDN)**:
- ✅ **Bootstrap 5** (responsive CSS framework)
- ✅ **FullCalendar** (calendar view for schedules)
- ✅ **DataTables** (sortable, filterable tables)
- ✅ **Alpine.js** (lightweight reactivity - ~15KB)
- ✅ **jQuery** (if needed, but prefer vanilla JS)
- ✅ **Day.js** (date manipulation)
- ✅ **Chart.js** (dashboard charts)

**Recommended Stack**:
```html
<!-- HTML template served by Apps Script -->
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.0/index.global.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.0/index.global.min.js"></script>
</head>
<body>
  <!-- Your app UI -->
  <script>
    // Call Apps Script functions via google.script.run
    google.script.run.withSuccessHandler(displayData).getVolunteers();
  </script>
</body>
</html>
```

### Backend
**Choice: Google Apps Script (.gs files)**

**Existing Logic**:
- ✅ Reuse ALL 15+ existing .gs files
- ✅ Calendar generation (1_calendarlogic.gs, etc.)
- ✅ Schedule generation (2_schedulelogic.gs)
- ✅ Auto-assignment (3_assignmentlogic.gs)
- ✅ Timeoff management (4_timeoff-form.gs)
- ✅ Validation (0c_validation.gs)
- ✅ Helpers (0b_helper.gs)

**New Functions Needed**:
- `doGet(e)` - Serve web app HTML
- `WEBAPP_getVolunteers()` - API endpoint for volunteers
- `WEBAPP_getAssignments(month)` - API endpoint for assignments
- `WEBAPP_assignVolunteer(assignmentId, volunteerId)` - Update assignment
- etc.

### Database
**Choice: Google Sheets (existing)**

**No Changes Needed**:
- Same sheets (Volunteers, Assignments, Timeoffs, etc.)
- Same structure
- Same validation rules
- Sidebar and Web App share data seamlessly

### Hosting
**Choice: Google Apps Script Web App Deployment**

**Deployment**:
1. Open Apps Script editor
2. Click "Deploy" > "New deployment"
3. Choose "Web app" type
4. Set access (anyone with link, or organization only)
5. Get URL: `https://script.google.com/macros/s/ABC123.../exec`

**Cost**: FREE (within quotas)

### Mobile Strategy
**Choice: Responsive Web App**

**Approach**:
- Mobile-first CSS (Bootstrap responsive classes)
- Touch-friendly UI (large buttons, swipe gestures)
- Fast loading (minimize CDN libraries)
- Add to Home Screen (PWA-like, no service worker needed)

**No PWA Features** (Apps Script limitations):
- ❌ No service worker (can't cache for offline)
- ❌ No push notifications
- ✅ But: Works great in mobile browser
- ✅ Can add to home screen (just a bookmark)

---

## 4. Feature Scope

### MVP (Phase 1) - 2-3 weeks

**Target Users**: Admins + Volunteers (read-only)
**Backend**: Existing Apps Script functions

**Features**:
- [ ] Web app deployment (doGet handler)
- [ ] User authentication (Session.getActiveUser())
- [ ] Role detection (Admin vs Volunteer)
- [ ] Admin dashboard home page
- [ ] View monthly schedules (calendar view - FullCalendar)
- [ ] View volunteer list (DataTables)
- [ ] View assignments (filterable table)
- [ ] Manual assign/unassign volunteers (inline editing)
- [ ] View timeoff requests
- [ ] Approve/reject timeoff requests
- [ ] Mobile-responsive layout (Bootstrap)
- [ ] Volunteer view (read-only - see own schedule)

**Reused from Existing Code**:
- ✅ All data reading (HELPER_readSheetData)
- ✅ Assignment validation (from 0d_onedit.gs)
- ✅ Timeoff approval logic (from 4_timeoff-form.gs)
- ✅ Calendar generation (call existing functions)
- ✅ Schedule generation (call existing functions)
- ✅ Auto-assignment (call existing functions)

---

### Full Features (Phase 2) - 3-4 weeks

**Target Users**: Admins + Volunteers (full access)
**Backend**: Same Apps Script functions

**New Features**:
- [ ] Volunteer portal (full CRUD)
  - [ ] View own schedule (filtered by volunteer)
  - [ ] Submit timeoff requests
  - [ ] Update own profile (email, phone, preferences)
  - [ ] View upcoming assignments (next 30 days)
- [ ] Email notifications (GmailApp)
  - [ ] Assignment confirmations
  - [ ] Timeoff approval/rejection
  - [ ] Schedule published notifications
  - [ ] Substitute needed alerts
- [ ] Admin workflows
  - [ ] Trigger calendar generation from web app
  - [ ] Trigger schedule generation from web app
  - [ ] Trigger auto-assignment from web app
  - [ ] Progress indicators during long operations
- [ ] Advanced filtering
  - [ ] By ministry (dropdown)
  - [ ] By date range (date picker)
  - [ ] By volunteer (search)
  - [ ] By status (unassigned, assigned, substitute needed)
- [ ] Export schedules
  - [ ] Print-friendly view (existing PRINT logic)
  - [ ] PDF generation (Google Docs template → PDF)
  - [ ] Email schedule to volunteers
- [ ] Dashboard widgets (Chart.js)
  - [ ] Unassigned roles count
  - [ ] Pending timeoffs count
  - [ ] Volunteer participation stats
  - [ ] Monthly assignment chart

**Admin Features**:
- [ ] Conflict detection (highlight double-bookings)
- [ ] Substitute finder (suggest volunteers for timeoff slots)
- [ ] Bulk operations (assign multiple, approve multiple timeoffs)
- [ ] Audit log (sheet-based logging)
- [ ] Role-based permissions (check Session.getActiveUser())

---

### Production Hardening (Phase 3) - 1-2 weeks

**Focus**: Reliability, security, performance

**Tasks**:
- [ ] Comprehensive error handling (try/catch, user-friendly messages)
- [ ] Performance optimization
  - [ ] Cache volunteer/assignment data (CacheService)
  - [ ] Lazy load calendar events
  - [ ] Paginate large tables
- [ ] Security audit
  - [ ] Validate all inputs
  - [ ] Check user permissions on every action
  - [ ] Prevent XSS (escape HTML)
  - [ ] CSRF protection (Apps Script handles this)
- [ ] Testing
  - [ ] Manual testing checklist (no automated tests in Apps Script)
  - [ ] Cross-browser testing (Chrome, Safari, Firefox, Mobile Safari, Mobile Chrome)
  - [ ] Accessibility testing (keyboard navigation, screen reader)
- [ ] Monitoring
  - [ ] Error logging (Logger + email alerts via MailApp)
  - [ ] Usage tracking (sheet-based analytics)
- [ ] Documentation
  - [ ] User guide (admin and volunteer)
  - [ ] Deployment guide
  - [ ] Troubleshooting guide
- [ ] Training
  - [ ] Video walkthrough (admin features)
  - [ ] Video walkthrough (volunteer features)
  - [ ] FAQs

---

## 5. Data Model

### Core Entities

```typescript
// Volunteers
interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'Active' | 'Inactive' | 'Substitute Only' | 'Ministry Sponsor' | 'Parent/Guardian';
  familyTeam?: string;
  ministries: string[]; // ["Lector", "Eucharistic Minister"]
  ministryRoles: string[]; // ["1st reading", "Bread"]
  preferredMassTimes: string[]; // Event IDs
  dateCleared?: Date;
  dateTrained?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Assignments
interface Assignment {
  id: string;
  date: Date;
  time: string;
  eventId: string;
  liturgicalCelebration: string;
  ministry: string;
  role: string;
  isAnticipated: boolean;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  assignedGroup?: string;
  status: 'Unassigned' | 'Assigned' | 'Substitute Needed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Timeoffs
interface Timeoff {
  id: string;
  volunteerId: string;
  type: 'Not Available' | 'Only Available';
  selectedDates: Date[];
  volunteerNotes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Masses (consolidated from Weekly/Monthly/Yearly)
interface Mass {
  id: string;
  type: 'weekly' | 'monthly' | 'yearly';
  eventId: string;

  // Weekly fields
  dayOfWeek?: number; // 0-6

  // Monthly fields
  weekOfMonth?: number; // 1-4, -1 for last

  // Yearly fields
  date?: Date; // specific date
  liturgicalCelebration?: string;

  // Common fields
  time: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isAnticipated: boolean;
  overrideType?: 'append' | 'overrideday';
  description: string;
  templateName: string;
  assignedGroup?: string;
  notes?: string;
}

// Mass Templates
interface MassTemplate {
  id: string;
  name: string;
  description: string;
  roles: {
    ministry: string;
    role: string;
  }[];
}

// Liturgical Calendar
interface LiturgicalDay {
  date: Date;
  weekday: string;
  liturgicalCelebration: string;
  optionalMemorial?: string;
  season: string;
  rank: string;
  color: string;
}

// Config
interface Config {
  key: string;
  value: string;
}
```

---

## 6. API Design (Apps Script Functions)

### Apps Script Communication Pattern

**Client-side (HTML)**:
```javascript
// Call server-side function
google.script.run
  .withSuccessHandler(onSuccess)
  .withFailureHandler(onError)
  .WEBAPP_functionName(param1, param2);

function onSuccess(result) {
  // Handle result
  console.log('Got data:', result);
}

function onError(error) {
  // Handle error
  console.error('Error:', error.message);
}
```

**Server-side (.gs file)**:
```javascript
function WEBAPP_functionName(param1, param2) {
  try {
    // Validate user permissions
    const user = WEBAPP_getCurrentUser();
    if (!user.isAdmin) {
      throw new Error('Unauthorized');
    }

    // Call existing logic
    const result = HELPER_readSheetData('Volunteers');

    return result;
  } catch (e) {
    Logger.log(`Error in WEBAPP_functionName: ${e.message}`);
    throw e; // Sent to client's withFailureHandler
  }
}
```

---

### Server-Side Functions (Phase 1)

**Web App Entry Point**
```javascript
function doGet(e) {
  // Serve main HTML page
  return HtmlService.createTemplateFromFile('WebApp')
    .evaluate()
    .setTitle('Parish Scheduler')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

**Authentication**
```javascript
WEBAPP_getCurrentUser()           // Get active user (email, name, role)
WEBAPP_isAdmin(email)             // Check if user is admin
WEBAPP_isVolunteer(email)         // Check if user is volunteer
```

**Volunteers**
```javascript
WEBAPP_getVolunteers()            // Get all volunteers (admin only)
WEBAPP_getVolunteer(id)           // Get volunteer by ID
WEBAPP_createVolunteer(data)      // Create volunteer
WEBAPP_updateVolunteer(id, data)  // Update volunteer
WEBAPP_deleteVolunteer(id)        // Delete volunteer (soft delete)
WEBAPP_getVolunteerAssignments(volunteerId, startDate, endDate)
```

**Assignments**
```javascript
WEBAPP_getAssignments(month)      // Get assignments for month
WEBAPP_getAssignment(id)          // Get single assignment
WEBAPP_assignVolunteer(assignmentId, volunteerId) // Assign volunteer
WEBAPP_unassignVolunteer(assignmentId) // Unassign
WEBAPP_bulkAssign(assignments)    // Assign multiple
WEBAPP_getUnassignedRoles(month)  // Get unassigned roles
```

**Schedules**
```javascript
WEBAPP_generateCalendar(year)     // Calls CALENDAR_generateLiturgicalCalendar
WEBAPP_generateSchedule(month)    // Calls SCHEDULE_generateScheduleForMonth
WEBAPP_autoAssign(month)          // Calls ASSIGNMENT_autoAssignRolesForMonth
WEBAPP_getScheduleData(month)     // Get formatted schedule data for display
WEBAPP_getPrintSchedule(month, ministryFilter) // Get printable schedule
```

**Timeoffs**
```javascript
WEBAPP_getTimeoffs(status)        // Get timeoffs (filter by status)
WEBAPP_getTimeoff(id)             // Get single timeoff
WEBAPP_submitTimeoff(data)        // Submit new timeoff request
WEBAPP_approveTimeoff(id, notes)  // Approve timeoff
WEBAPP_rejectTimeoff(id, notes)   // Reject timeoff
WEBAPP_getVolunteerTimeoffs(volunteerId) // Get volunteer's timeoffs
```

**Dashboard**
```javascript
WEBAPP_getDashboardStats()        // Get stats (unassigned count, pending timeoffs, etc.)
WEBAPP_getUpcomingMasses(days)    // Get next N days of masses
```

**Public Access (no auth)**
```javascript
WEBAPP_getPublicSchedule(month)   // Get public schedule (read-only)
```

---

## 7. User Interface Design

### Admin Dashboard (Desktop)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Header (Parish Name, User Menu)                │
├────────┬────────────────────────────────────────┤
│ Side   │ Main Content Area                      │
│ Nav    │                                        │
│        │ ┌────────────────────────────────────┐ │
│ • Home │ │ Dashboard Widgets                  │ │
│ • Cal  │ │ - Unassigned Roles (12)            │ │
│ • Sched│ │ - Pending Timeoffs (3)             │ │
│ • Vol  │ │ - This Week's Schedule             │ │
│ • Time │ │ - Quick Stats                      │ │
│ • Rep  │ └────────────────────────────────────┘ │
│        │                                        │
└────────┴────────────────────────────────────────┘
```

**Key Views**:
1. **Dashboard**: Overview widgets, quick actions
2. **Calendar**: Month view with liturgical celebrations
3. **Schedule**: Month view with assignments table
4. **Volunteers**: Searchable table, detail view
5. **Timeoffs**: Approval queue, history
6. **Reports**: Analytics, export tools

---

### Volunteer Portal (Mobile-First)

**Layout**:
```
┌─────────────────────┐
│  Parish Schedule    │
│  [User: John Doe ▼] │
├─────────────────────┤
│                     │
│ Your Next Assignment│
│ ┌─────────────────┐ │
│ │ Sunday, Dec 22  │ │
│ │ 10:00 AM Mass   │ │
│ │ Lector - 1st    │ │
│ │ [View Details]  │ │
│ └─────────────────┘ │
│                     │
│ Upcoming Assignments│
│ • Dec 29 - 2nd rdg  │
│ • Jan 5  - 1st rdg  │
│ • Jan 12 - Psalm    │
│                     │
│ [Request Timeoff]   │
│ [View Full Schedule]│
│ [Update Profile]    │
│                     │
└─────────────────────┘
```

**Key Features**:
- Simple, card-based UI
- Large touch targets
- Bottom navigation
- Swipe gestures
- Push notifications

---

### Schedule View (Desktop)

**Calendar View**:
```
┌─────────────────────────────────────────────────┐
│ December 2024        [Week] [Month] [List]      │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  1   │  2   │  3   │  4   │  5   │  6   │  7   │
│ 10am │      │      │ Ash  │      │ 7pm  │ 5pm  │
│ Lect │      │      │ Wed  │      │ 1st  │ Vig  │
│ John │      │      │ 7pm  │      │ Fri  │ Mary │
├──────┼──────┼──────┴──────┴──────┼──────┼──────┤
│  8   │  9   │        ...         │ 13   │ 14   │
└──────┴──────┴────────────────────┴──────┴──────┘
```

**Table View**:
```
┌─────────────────────────────────────────────────┐
│ Date      │ Time  │ Mass      │ Role    │ Vol   │
├───────────┼───────┼───────────┼─────────┼───────┤
│ 12/1/2024 │ 10:00 │ 1st Adv   │ 1st rdg │ John  │
│ 12/1/2024 │ 10:00 │ 1st Adv   │ 2nd rdg │ Mary  │
│ 12/1/2024 │ 10:00 │ 1st Adv   │ Psalm   │ [Unas]│
│ 12/7/2024 │ 17:00 │ 2nd Adv V │ 1st rdg │ Tom   │
└───────────┴───────┴───────────┴─────────┴───────┘
```

---

## 8. Key Technical Challenges

### Challenge 1: Managing Large Datasets in Apps Script

**Problem**: Apps Script has execution time limits (6 min max)
**Solutions**:
- **Pagination**: Load data in chunks (e.g., 100 volunteers at a time)
- **Caching**: Use CacheService for frequently accessed data
```javascript
function WEBAPP_getVolunteers() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('volunteers');

  if (cached) {
    return JSON.parse(cached);
  }

  const data = HELPER_readSheetData('Volunteers');
  cache.put('volunteers', JSON.stringify(data), 300); // Cache 5 min
  return data;
}
```
- **Lazy loading**: Load only what's visible (e.g., current month assignments)

---

### Challenge 2: UI State Management

**Problem**: No React/Vue state management
**Solutions**:
- **Alpine.js** for reactive data binding (lightweight)
```html
<div x-data="{ volunteers: [] }" x-init="loadVolunteers()">
  <template x-for="vol in volunteers">
    <div x-text="vol.name"></div>
  </template>
</div>

<script>
function loadVolunteers() {
  google.script.run.withSuccessHandler(data => {
    this.volunteers = data;
  }).WEBAPP_getVolunteers();
}
</script>
```
- **Global JavaScript object** for state
```javascript
const AppState = {
  currentMonth: '2026-01',
  volunteers: [],
  assignments: [],
  user: null,

  loadAssignments(month) {
    google.script.run
      .withSuccessHandler(data => {
        this.assignments = data;
        this.renderAssignments();
      })
      .WEBAPP_getAssignments(month);
  }
};
```

---

### Challenge 3: Real-Time Updates

**Problem**: Multiple users editing simultaneously, no WebSocket
**Solutions**:
- **Polling**: Refresh data every 30-60 seconds
```javascript
setInterval(() => {
  AppState.loadAssignments(AppState.currentMonth);
}, 30000); // 30 seconds
```
- **Optimistic UI**: Update UI immediately, sync in background
- **Conflict detection**: Check if data changed before saving
- **Lock mechanism**: Use PropertiesService to lock rows during edit

---

### Challenge 4: Authentication & Authorization

**Roles**:
- **Admin**: Full access (check against Config sheet admin list)
- **Volunteer**: View own schedule, submit timeoffs

**Implementation**:
```javascript
function WEBAPP_getCurrentUser() {
  const email = Session.getActiveUser().getEmail();

  // Check if admin (from Config sheet or hardcoded list)
  const config = HELPER_readConfigSafe();
  const adminEmails = config['Admin Emails'].split(',').map(e => e.trim());
  const isAdmin = adminEmails.includes(email);

  // Get volunteer data if exists
  const volunteers = HELPER_readSheetData('Volunteers');
  const volunteer = volunteers.find(v => v.email === email);

  return {
    email,
    isAdmin,
    isVolunteer: volunteer !== undefined,
    volunteerId: volunteer?.id,
    volunteerName: volunteer?.fullName
  };
}

function WEBAPP_checkPermission(requiredRole) {
  const user = WEBAPP_getCurrentUser();

  if (requiredRole === 'admin' && !user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  if (requiredRole === 'volunteer' && !user.isVolunteer && !user.isAdmin) {
    throw new Error('Unauthorized: Volunteer access required');
  }
}
```

---

### Challenge 5: Mobile Performance

**Problem**: Slow loading on mobile networks
**Solutions**:
- **Minimize CDN libraries**: Only load what you need
- **Defer non-critical scripts**: Use `defer` or `async`
- **Compress data**: Send only essential fields
```javascript
function WEBAPP_getAssignmentsSummary(month) {
  const all = HELPER_readSheetData('Assignments');
  // Filter to month
  const filtered = all.filter(a => a.monthYear === month);
  // Return only needed fields
  return filtered.map(a => ({
    id: a.id,
    date: a.date,
    time: a.time,
    role: a.role,
    volunteer: a.volunteerName
  }));
}
```
- **Image optimization**: Use SVG icons instead of PNGs
- **Reduce DOM updates**: Batch DOM changes

---

## 9. Implementation Roadmap

### Phase 1: MVP (Week 1-3)

**Week 1: Foundation & Setup**
- [ ] Create new Apps Script files:
  - [ ] `8_webapp.gs` - Entry point (doGet, auth, permissions)
  - [ ] `WebApp.html` - Main HTML template
  - [ ] `WebApp_Header.html` - Shared header/nav
  - [ ] `WebApp_CSS.html` - Shared CSS
  - [ ] `WebApp_JS.html` - Shared JavaScript
- [ ] Implement authentication
  - [ ] `WEBAPP_getCurrentUser()` - Get logged-in user
  - [ ] `WEBAPP_checkPermission()` - Permission checking
  - [ ] Role detection (Admin vs Volunteer)
- [ ] Create basic layout (Bootstrap 5)
  - [ ] Header with parish name
  - [ ] Navigation (sidebar or top nav)
  - [ ] Main content area
  - [ ] Footer
- [ ] Setup deployment
  - [ ] Deploy as web app
  - [ ] Test access (anyone with link vs organization)

**Week 2: Core Views**
- [ ] Dashboard (admin view)
  - [ ] Stats widgets (unassigned roles, pending timeoffs)
  - [ ] Quick links (generate schedule, view calendar)
  - [ ] Recent activity
- [ ] Volunteers page
  - [ ] `WEBAPP_getVolunteers()` server function
  - [ ] DataTables integration
  - [ ] Search/filter
  - [ ] Click to view volunteer detail
- [ ] Assignments page
  - [ ] `WEBAPP_getAssignments(month)` server function
  - [ ] Month selector dropdown
  - [ ] Table view with filters
  - [ ] Inline editing (assign/unassign)

**Week 3: Timeoffs & Testing**
- [ ] Timeoff page
  - [ ] `WEBAPP_getTimeoffs()` server function
  - [ ] Pending approvals list
  - [ ] Approve/reject buttons
  - [ ] `WEBAPP_approveTimeoff()`, `WEBAPP_rejectTimeoff()`
- [ ] Volunteer view (read-only)
  - [ ] Filter to show only own schedule
  - [ ] Next 30 days view
  - [ ] Upcoming assignments list
- [ ] Testing
  - [ ] Test as admin user
  - [ ] Test as volunteer user
  - [ ] Test on mobile (Chrome, Safari)
  - [ ] Fix bugs

**Deliverable**: Working web app with read/write access for admins, read-only for volunteers

---

### Phase 2: Full Features (Week 4-7)

**Week 4: Calendar Integration**
- [ ] Calendar view page
  - [ ] FullCalendar.js integration
  - [ ] Display assignments on calendar
  - [ ] Color-code by ministry
  - [ ] Click event to view/edit assignments
- [ ] Schedule generation UI
  - [ ] Month selector
  - [ ] "Generate Calendar" button (calls existing function)
  - [ ] "Generate Schedule" button
  - [ ] "Auto-Assign" button
  - [ ] Progress indicators during long operations

**Week 5: Volunteer Portal**
- [ ] Volunteer self-service
  - [ ] Profile page (view/edit email, phone, preferences)
  - [ ] `WEBAPP_updateVolunteer()` server function
  - [ ] Timeoff submission form
  - [ ] `WEBAPP_submitTimeoff()` server function
  - [ ] Confirmation messages
- [ ] Email notifications
  - [ ] `WEBAPP_sendAssignmentEmail()` - Notify on assignment
  - [ ] `WEBAPP_sendTimeoffApprovalEmail()` - Notify on approval
  - [ ] `WEBAPP_sendSchedulePublishedEmail()` - Notify schedule ready
  - [ ] Use GmailApp.sendEmail()

**Week 6: Advanced Features**
- [ ] Advanced filtering
  - [ ] Filter by ministry (dropdown)
  - [ ] Filter by volunteer (search)
  - [ ] Filter by date range (date picker)
  - [ ] Filter by status (unassigned, assigned, substitute)
- [ ] Export/print
  - [ ] Print-friendly view (reuse existing print logic)
  - [ ] PDF export (optional - via Google Docs template)
  - [ ] Email schedule to volunteers
- [ ] Dashboard widgets
  - [ ] Chart.js integration
  - [ ] Volunteer participation chart
  - [ ] Monthly assignment counts
  - [ ] Trend graphs

**Week 7: Admin Tools**
- [ ] Conflict detection
  - [ ] Highlight volunteers assigned multiple roles same mass
  - [ ] Highlight volunteers assigned despite timeoff
  - [ ] Visual warnings
- [ ] Substitute finder
  - [ ] `WEBAPP_findSubstitutes(assignmentId)` - Suggest volunteers
  - [ ] Filter by qualified, available, recent assignment count
  - [ ] One-click assign suggestion
- [ ] Bulk operations
  - [ ] Select multiple assignments (checkboxes)
  - [ ] Bulk assign to volunteer
  - [ ] Bulk unassign
  - [ ] Bulk approve timeoffs

**Deliverable**: Full-featured app with volunteer portal and admin tools

---

### Phase 3: Polish & Launch (Week 8-9)

**Week 8: Testing & Refinement**
- [ ] Cross-browser testing
  - [ ] Chrome (desktop & mobile)
  - [ ] Safari (desktop & mobile)
  - [ ] Firefox
  - [ ] Edge
- [ ] Accessibility
  - [ ] Keyboard navigation
  - [ ] Screen reader compatibility
  - [ ] ARIA labels
  - [ ] Color contrast
- [ ] Performance optimization
  - [ ] Add caching (CacheService)
  - [ ] Lazy load large datasets
  - [ ] Optimize DOM updates
  - [ ] Minify CSS/JS
- [ ] Error handling
  - [ ] Try/catch all server functions
  - [ ] User-friendly error messages
  - [ ] Fallback UI for errors

**Week 9: Documentation & Launch**
- [ ] User documentation
  - [ ] Admin guide (PDF or Google Doc)
  - [ ] Volunteer guide
  - [ ] Screenshots/videos
  - [ ] FAQ
- [ ] Training
  - [ ] Record video walkthrough (admin)
  - [ ] Record video walkthrough (volunteer)
  - [ ] Live training session (optional)
- [ ] Deployment
  - [ ] Final testing in production spreadsheet
  - [ ] Share web app URL with users
  - [ ] Monitor usage (check Executions log)
  - [ ] Gather feedback
  - [ ] Iterate on improvements

**Deliverable**: Production-ready web app with documentation and training materials

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Google Sheets API rate limits | Medium | High | Cache aggressively, batch requests, consider DB early |
| Data migration errors | Medium | Critical | Extensive testing, dry-run mode, rollback plan |
| User adoption resistance | High | Medium | Gradual rollout, training, keep Sheets as fallback |
| Scope creep | High | High | Strict phase boundaries, feature freeze periods |
| Technical complexity underestimated | Medium | High | Build proof-of-concept first, weekly reviews |
| Loss of existing functionality | Low | Critical | Feature parity checklist, parallel testing |

---

## 11. Success Metrics

### MVP Success Criteria
- [ ] 2+ admins successfully use the app for 1 month
- [ ] All schedules viewable and editable
- [ ] Zero data loss incidents
- [ ] 95% uptime
- [ ] Mobile-responsive on iOS/Android

### Full Features Success Criteria
- [ ] 50+ volunteers using portal weekly
- [ ] 80% timeoff requests submitted via app (not email)
- [ ] Auto-assignment works with 90%+ accuracy
- [ ] Page load time < 2 seconds
- [ ] Mobile PWA installed by 30% of volunteers

### Production Success Criteria
- [ ] 99% uptime
- [ ] < 10 support tickets per month
- [ ] All business logic ported from Apps Script
- [ ] Positive user satisfaction (4+/5 survey)
- [ ] Ready for multi-parish deployment

---

## 12. Open Questions & Decisions Needed

### Architecture
- [ ] **Option A vs B vs C?** Which architecture path to choose?
- [ ] **Database choice?** PostgreSQL, Firebase, or other?
- [ ] **Hosting?** Vercel + Railway, Google Cloud, or self-hosted?

### Features
- [ ] **MVP scope?** Admin-only or include volunteer portal?
- [ ] **Real-time?** Critical for MVP or defer to Phase 2?
- [ ] **Mobile strategy?** PWA sufficient or need React Native?

### Data
- [ ] **Migration strategy?** One-time or dual-write transition?
- [ ] **Sheets deprecation?** Keep as backup or fully migrate?
- [ ] **Historical data?** How far back to import?

### Users
- [ ] **Target parishes?** Single parish or multi-parish from start?
- [ ] **Roles?** Just Admin/Volunteer or more granular?
- [ ] **Authentication?** Google-only or support email/password?

### Timeline
- [ ] **Launch date?** When does parish need this live?
- [ ] **Budget?** Development hours, hosting costs?
- [ ] **Team?** Solo developer or team?

---

## 13. Next Steps - Getting Started

### Immediate Actions (Today)

1. **Review this plan**
   - Understand the architecture (Apps Script Web App)
   - Confirm features needed (MVP vs Full vs Custom)
   - Decide: DIY or hire developer?

2. **Create proof-of-concept** (30 minutes)
   - Open your parish scheduler spreadsheet
   - Extensions > Apps Script
   - Create new file: `8_webapp.gs`
   - Paste this code:

```javascript
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <html>
      <head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body>
        <div class="container mt-5">
          <h1>Parish Scheduler Web App</h1>
          <p>Welcome! You are logged in as: <span id="user"></span></p>
          <button class="btn btn-primary" onclick="loadVolunteers()">Load Volunteers</button>
          <div id="result" class="mt-3"></div>
        </div>
        <script>
          google.script.run.withSuccessHandler(function(email) {
            document.getElementById('user').textContent = email;
          }).getUserEmail();

          function loadVolunteers() {
            google.script.run.withSuccessHandler(function(data) {
              document.getElementById('result').innerHTML =
                '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            }).getVolunteersData();
          }
        </script>
      </body>
    </html>
  `).setTitle('Parish Scheduler');
}

function getUserEmail() {
  return Session.getActiveUser().getEmail();
}

function getVolunteersData() {
  const data = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
  return data.slice(0, 5); // Return first 5 volunteers
}
```

   - Click "Deploy" > "New deployment" > "Web app"
   - Execute as: "Me"
   - Access: "Anyone with link" (or "Organization only")
   - Click "Deploy"
   - **Click the URL** - you should see your web app!

3. **Validate it works**:
   - ✅ You see "Welcome! You are logged in as: [your email]"
   - ✅ Click "Load Volunteers" button
   - ✅ You see volunteer data displayed
   - 🎉 Success! You just built your first Apps Script Web App!

### This Week

4. **Plan your approach**:
   - **Option A - DIY**: Follow the 9-week roadmap in this plan
   - **Option B - Hire**: Find Apps Script developer (Upwork, Fiverr, local)
   - **Option C - Hybrid**: DIY MVP, hire for advanced features

5. **Setup project structure** (if DIY):
   - Create new files per Week 1 roadmap
   - Copy existing Sidebar.html as reference
   - Start with authentication and basic layout

6. **Design mockups** (optional):
   - Sketch your ideal UI on paper or Figma
   - Reference the UI designs in this plan
   - Keep it simple - Bootstrap components are your friend

### Week 2+

7. **Follow the roadmap**:
   - Work through Phase 1 (Week 1-3) step-by-step
   - Test frequently (deploy new version, click URL, test)
   - Ask for help in Apps Script forums if stuck

8. **Get feedback early**:
   - Share web app URL with 1-2 trusted users
   - Watch them use it (usability testing)
   - Iterate based on feedback

---

## 14. FAQ

**Q: Can I build this if I'm not a developer?**
A: Yes! If you understand the existing Apps Script code, you can follow this plan. Start with the proof-of-concept above. Apps Script is beginner-friendly.

**Q: How long will it really take?**
A: For someone familiar with Apps Script: 60-80 hours over 9 weeks. For a beginner: 100-120 hours. For an expert: 40-50 hours.

**Q: What if I get stuck?**
A:
- Google Apps Script documentation: https://developers.google.com/apps-script
- Stack Overflow (tag: google-apps-script)
- Apps Script Community: https://groups.google.com/g/google-apps-script-community
- AI assistants (ChatGPT, Claude) can help debug

**Q: Can I use the Sidebar AND the web app?**
A: Yes! They can coexist. The web app is for volunteers/public, the sidebar for admin quick tasks.

**Q: What about mobile apps (iOS/Android)?**
A: The web app works great in mobile browsers. For native apps, you'd need a different approach (not Apps Script).

**Q: How do I secure the web app?**
A:
1. Deploy with "Execute as: Me" (runs with your permissions)
2. Access: "Anyone" (public) or "Organization only" (restrict to your Google Workspace)
3. Check permissions in every function (`WEBAPP_checkPermission()`)
4. Validate all inputs

**Q: What if I want to customize this plan?**
A: Great! This plan is a template. Adapt it to your needs. Skip features you don't need, add features you want.

**Q: Can I hire someone to build this?**
A: Yes! Share this plan with potential developers. It's a clear spec they can quote from. Budget: $3k-$9k depending on scope.

**Q: What's the easiest way to start?**
A: Run the proof-of-concept code above. If that works, you're 5% done. Keep going!

---

## 15. Appendix

### A. Technology Learning Resources

**Google Apps Script**:
- [Apps Script Fundamentals](https://developers.google.com/apps-script/overview)
- [HtmlService Guide](https://developers.google.com/apps-script/guides/html)
- [Web Apps Guide](https://developers.google.com/apps-script/guides/web)
- [Codelab: Building Web Apps](https://codelabs.developers.google.com/codelabs/apps-script-web-app)

**Frontend Libraries (CDN)**:
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/)
- [FullCalendar Documentation](https://fullcalendar.io/docs)
- [DataTables Documentation](https://datatables.net/)
- [Alpine.js Documentation](https://alpinejs.dev/)
- [Chart.js Documentation](https://www.chartjs.org/)

**JavaScript**:
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [JavaScript.info](https://javascript.info/) (comprehensive tutorial)

---

### B. Estimated Costs

**Development Time** (assuming freelance rates):
- MVP (3 weeks × 20 hrs/week × $50/hr): **$3,000**
- Full Features (4 weeks × 20 hrs/week): **$4,000**
- Polish & Launch (2 weeks × 20 hrs/week): **$2,000**
- **Total**: $9,000

Or **DIY** (if you're learning Apps Script):
- Follow this plan step-by-step
- Allocate 2-4 hours per week
- Total time: 60-80 hours over 9 weeks
- **Cost**: $0 (your time)

**Hosting** (per month):
- **$0** - Google Apps Script is free within quotas
- Quotas (free tier):
  - 6 min max execution time
  - 30 MB max response size
  - 20,000 UrlFetch calls/day
  - Sufficient for typical parish (50-200 volunteers)

**Third-Party Services** (optional):
- **Email**: FREE - Use GmailApp (built into Apps Script)
- **Domain**: $12/year (if you want custom URL redirect)
- **Total**: ~$1/mo

---

### C. Apps Script Web App Examples

**For Reference**:
- [Google Apps Script Web App Tutorial](https://developers.google.com/apps-script/guides/web)
- [HtmlService Best Practices](https://developers.google.com/apps-script/guides/html/best-practices)
- [Building Web Apps with Apps Script (Codelab)](https://codelabs.developers.google.com/codelabs/apps-script-web-app)

**Similar Apps Built with Apps Script**:
- Church event registration systems
- Volunteer sign-up sheets
- Equipment checkout systems
- Room booking systems

**UI Libraries Compatible with Apps Script**:
- Bootstrap 5 (responsive framework)
- FullCalendar.js (calendar views)
- DataTables (sortable tables)
- Alpine.js (lightweight reactivity)
- Chart.js (data visualization)

---

**Document Version**: 2.0 (Apps Script-focused)
**Last Updated**: 2025-12-19
**Author**: AI Assistant (Claude)
**Technology Constraint**: Google Apps Script only (no external frameworks/hosting)
**Status**: Ready for implementation
**Estimated Timeline**: 9 weeks (DIY) or 3-6 weeks (hired developer)
**Estimated Cost**: $0-$9,000 (depending on DIY vs hire)
