# Parish Liturgical Scheduler - Web App Architecture

## Overview

A mobile-responsive Google Apps Script web application providing full CRUD access to all Parish Liturgical Scheduler workflows on desktop and mobile devices.

## Architecture

### Technology Stack
- **Platform**: Google Apps Script Web App
- **Frontend**: HTML5 + CSS3 (Bootstrap 5 for responsive design)
- **Client-side**: Vanilla JavaScript (ES6+)
- **Server-side**: Google Apps Script (existing codebase)
- **Data Layer**: Google Sheets (existing structure)
- **Authentication**: Google OAuth (built-in)
- **Deployment**: Apps Script Web App (public or restricted access)

### File Structure

```
/webapp/
├── 6_webapp.gs                 # Main web app entry point (doGet, routing)
├── 6a_webapp_api.gs            # Server-side API functions for CRUD operations
├── 6b_webapp_auth.gs           # Authentication and authorization helpers
├── WebApp.html                 # Main HTML template with routing
├── webapp/
│   ├── css/
│   │   └── main.css.html       # Custom styles (included in WebApp.html)
│   ├── js/
│   │   ├── app.js.html         # Main app logic and routing
│   │   ├── api.js.html         # Client-side API wrapper (google.script.run)
│   │   └── components.js.html  # Reusable UI components
│   └── views/
│       ├── dashboard.html      # Dashboard view
│       ├── volunteers.html     # Volunteers CRUD
│       ├── mass-templates.html # Mass Templates CRUD
│       ├── weekly-masses.html  # Weekly Masses CRUD
│       ├── monthly-masses.html # Monthly Masses CRUD
│       ├── yearly-masses.html  # Yearly Masses CRUD
│       ├── timeoffs.html       # Timeoff Requests CRUD
│       ├── assignments.html    # Assignments view/edit
│       └── calendar.html       # Liturgical Calendar view
```

## Core Components

### 1. Web App Entry Point (`6_webapp.gs`)

```javascript
/**
 * Main entry point for web app
 * Serves the HTML interface
 */
function doGet(e) {
  // Check authentication
  const user = Session.getActiveUser().getEmail();
  if (!user) {
    return HtmlService.createHtmlOutput('<h1>Please sign in</h1>');
  }

  // Load main HTML template
  const template = HtmlService.createTemplateFromFile('WebApp');
  template.userEmail = user;

  return template.evaluate()
    .setTitle('Parish Liturgical Scheduler')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Include HTML files (for modular structure)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

### 2. Server-Side API Layer (`6a_webapp_api.gs`)

Exposes CRUD operations to client-side:

```javascript
// ============================================
// VOLUNTEERS CRUD
// ============================================

function API_getVolunteers(filters = {}) {
  try {
    const data = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    // Convert to object array
    const volunteers = data.map(row => ({
      id: row[cols.VOLUNTEER_ID - 1],
      firstName: row[cols.FIRST_NAME - 1],
      lastName: row[cols.LAST_NAME - 1],
      email: row[cols.EMAIL - 1],
      phone: row[cols.PHONE - 1],
      status: row[cols.STATUS - 1],
      ministryRole: row[cols.MINISTRY_ROLE - 1],
      preferredMass: row[cols.PREFERRED_MASS - 1],
      familyTeam: row[cols.FAMILY_TEAM - 1]
    }));

    // Apply filters if provided
    return applyFilters(volunteers, filters);
  } catch (e) {
    throw new Error(`Failed to get volunteers: ${e.message}`);
  }
}

function API_createVolunteer(volunteerData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    // Generate new ID
    const data = sheet.getDataRange().getValues();
    const newId = generateNextId(data, cols.VOLUNTEER_ID - 1);

    // Build row
    const row = new Array(20).fill(''); // Adjust size to match columns
    row[cols.VOLUNTEER_ID - 1] = newId;
    row[cols.FIRST_NAME - 1] = volunteerData.firstName;
    row[cols.LAST_NAME - 1] = volunteerData.lastName;
    row[cols.FULL_NAME - 1] = `${volunteerData.firstName} ${volunteerData.lastName}`;
    row[cols.EMAIL - 1] = volunteerData.email;
    row[cols.PHONE - 1] = volunteerData.phone || '';
    row[cols.STATUS - 1] = volunteerData.status || 'Active';
    row[cols.MINISTRY_ROLE - 1] = volunteerData.ministryRole || '';
    row[cols.PREFERRED_MASS - 1] = volunteerData.preferredMass || '';
    row[cols.FAMILY_TEAM - 1] = volunteerData.familyTeam || '';

    // Append to sheet
    sheet.appendRow(row);

    return { success: true, id: newId };
  } catch (e) {
    throw new Error(`Failed to create volunteer: ${e.message}`);
  }
}

function API_updateVolunteer(id, updates) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);
    const data = sheet.getDataRange().getValues();
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    // Find row by ID
    const rowIndex = data.findIndex(row => row[cols.VOLUNTEER_ID - 1] === id);
    if (rowIndex === -1) {
      throw new Error(`Volunteer ${id} not found`);
    }

    // Update fields
    const row = data[rowIndex];
    if (updates.firstName) row[cols.FIRST_NAME - 1] = updates.firstName;
    if (updates.lastName) row[cols.LAST_NAME - 1] = updates.lastName;
    if (updates.firstName || updates.lastName) {
      row[cols.FULL_NAME - 1] = `${row[cols.FIRST_NAME - 1]} ${row[cols.LAST_NAME - 1]}`;
    }
    if (updates.email !== undefined) row[cols.EMAIL - 1] = updates.email;
    if (updates.phone !== undefined) row[cols.PHONE - 1] = updates.phone;
    if (updates.status) row[cols.STATUS - 1] = updates.status;
    if (updates.ministryRole !== undefined) row[cols.MINISTRY_ROLE - 1] = updates.ministryRole;
    if (updates.preferredMass !== undefined) row[cols.PREFERRED_MASS - 1] = updates.preferredMass;
    if (updates.familyTeam !== undefined) row[cols.FAMILY_TEAM - 1] = updates.familyTeam;

    // Write back to sheet
    sheet.getRange(rowIndex + 1, 1, 1, row.length).setValues([row]);

    return { success: true };
  } catch (e) {
    throw new Error(`Failed to update volunteer: ${e.message}`);
  }
}

function API_deleteVolunteer(id) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);
    const data = sheet.getDataRange().getValues();
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    // Find row by ID
    const rowIndex = data.findIndex(row => row[cols.VOLUNTEER_ID - 1] === id);
    if (rowIndex === -1) {
      throw new Error(`Volunteer ${id} not found`);
    }

    // Delete row (add 1 for 1-indexed sheets)
    sheet.deleteRow(rowIndex + 1);

    return { success: true };
  } catch (e) {
    throw new Error(`Failed to delete volunteer: ${e.message}`);
  }
}

// ============================================
// MASS TEMPLATES CRUD
// ============================================

function API_getMassTemplates() {
  // Similar pattern as volunteers
}

function API_createMassTemplate(templateData) {
  // Similar pattern
}

function API_updateMassTemplate(templateName, updates) {
  // Similar pattern
}

function API_deleteMassTemplate(templateName) {
  // Similar pattern
}

// ============================================
// WEEKLY MASSES CRUD
// ============================================

function API_getWeeklyMasses() {
  // Similar pattern
}

function API_createWeeklyMass(massData) {
  // Similar pattern
}

function API_updateWeeklyMass(eventId, updates) {
  // Similar pattern
}

function API_deleteWeeklyMass(eventId) {
  // Similar pattern
}

// ... Similar patterns for Monthly Masses, Yearly Masses, Timeoffs, etc.

// ============================================
// HELPER FUNCTIONS
// ============================================

function applyFilters(items, filters) {
  let filtered = items;

  if (filters.status) {
    filtered = filtered.filter(item => item.status === filters.status);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(item =>
      (item.firstName && item.firstName.toLowerCase().includes(searchLower)) ||
      (item.lastName && item.lastName.toLowerCase().includes(searchLower)) ||
      (item.email && item.email.toLowerCase().includes(searchLower))
    );
  }

  return filtered;
}

function generateNextId(data, idColumnIndex) {
  const ids = data
    .slice(1) // Skip header
    .map(row => row[idColumnIndex])
    .filter(id => id && typeof id === 'string')
    .map(id => {
      const match = id.match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    });

  const maxId = ids.length > 0 ? Math.max(...ids) : 0;
  return `VOL${String(maxId + 1).padStart(4, '0')}`;
}
```

### 3. Main HTML Template (`WebApp.html`)

Single-page application with client-side routing:

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parish Liturgical Scheduler</title>

  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- Bootstrap Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">

  <!-- Custom CSS -->
  <?!= include('webapp/css/main.css'); ?>
</head>
<body>
  <!-- Navigation Bar -->
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container-fluid">
      <a class="navbar-brand" href="#" onclick="navigateTo('dashboard')">
        <i class="bi bi-church"></i> Parish Scheduler
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <a class="nav-link" href="#" onclick="navigateTo('dashboard')">
              <i class="bi bi-speedometer2"></i> Dashboard
            </a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="dataDropdown" role="button" data-bs-toggle="dropdown">
              <i class="bi bi-database"></i> Data Management
            </a>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item" href="#" onclick="navigateTo('volunteers')">Volunteers</a></li>
              <li><a class="dropdown-item" href="#" onclick="navigateTo('mass-templates')">Mass Templates</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item" href="#" onclick="navigateTo('weekly-masses')">Weekly Masses</a></li>
              <li><a class="dropdown-item" href="#" onclick="navigateTo('monthly-masses')">Monthly Masses</a></li>
              <li><a class="dropdown-item" href="#" onclick="navigateTo('yearly-masses')">Yearly Masses</a></li>
            </ul>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#" onclick="navigateTo('timeoffs')">
              <i class="bi bi-calendar-x"></i> Timeoffs
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#" onclick="navigateTo('assignments')">
              <i class="bi bi-person-check"></i> Assignments
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#" onclick="navigateTo('calendar')">
              <i class="bi bi-calendar3"></i> Calendar
            </a>
          </li>
        </ul>
        <span class="navbar-text">
          <i class="bi bi-person-circle"></i> <?= userEmail ?>
        </span>
      </div>
    </div>
  </nav>

  <!-- Loading Spinner -->
  <div id="loadingSpinner" class="text-center p-5" style="display: none;">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <p class="mt-2">Loading...</p>
  </div>

  <!-- Main Content Area -->
  <div id="appContent" class="container-fluid p-3">
    <!-- Views loaded dynamically here -->
  </div>

  <!-- Toast Notifications -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="toast" class="toast" role="alert">
      <div class="toast-header">
        <strong class="me-auto" id="toastTitle">Notification</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body" id="toastMessage"></div>
    </div>
  </div>

  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

  <!-- App JavaScript -->
  <?!= include('webapp/js/api'); ?>
  <?!= include('webapp/js/components'); ?>
  <?!= include('webapp/js/app'); ?>

  <script>
    // Initialize app
    document.addEventListener('DOMContentLoaded', () => {
      navigateTo('dashboard');
    });
  </script>
</body>
</html>
```

### 4. Client-Side API Wrapper (`webapp/js/api.js.html`)

```html
<script>
/**
 * Client-side API wrapper for calling server-side functions
 * Uses google.script.run for communication
 */

const API = {
  // Show/hide loading spinner
  showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('appContent').style.display = 'none';
  },

  hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
  },

  // Generic error handler
  handleError(error) {
    console.error('API Error:', error);
    showToast('Error', error.message || 'An error occurred', 'danger');
    this.hideLoading();
  },

  // ============================================
  // VOLUNTEERS API
  // ============================================

  getVolunteers(filters = {}) {
    this.showLoading();
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(data => {
          this.hideLoading();
          resolve(data);
        })
        .withFailureHandler(error => {
          this.handleError(error);
          reject(error);
        })
        .API_getVolunteers(filters);
    });
  },

  createVolunteer(volunteerData) {
    this.showLoading();
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(result => {
          this.hideLoading();
          showToast('Success', 'Volunteer created successfully', 'success');
          resolve(result);
        })
        .withFailureHandler(error => {
          this.handleError(error);
          reject(error);
        })
        .API_createVolunteer(volunteerData);
    });
  },

  updateVolunteer(id, updates) {
    this.showLoading();
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(result => {
          this.hideLoading();
          showToast('Success', 'Volunteer updated successfully', 'success');
          resolve(result);
        })
        .withFailureHandler(error => {
          this.handleError(error);
          reject(error);
        })
        .API_updateVolunteer(id, updates);
    });
  },

  deleteVolunteer(id) {
    this.showLoading();
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(result => {
          this.hideLoading();
          showToast('Success', 'Volunteer deleted successfully', 'success');
          resolve(result);
        })
        .withFailureHandler(error => {
          this.handleError(error);
          reject(error);
        })
        .API_deleteVolunteer(id);
    });
  },

  // Add similar methods for other entities...
  // getMassTemplates(), createMassTemplate(), etc.
};

// Toast notification helper
function showToast(title, message, type = 'info') {
  const toastEl = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  toastTitle.textContent = title;
  toastMessage.textContent = message;

  // Update toast color based on type
  toastEl.className = 'toast';
  if (type === 'success') toastEl.classList.add('bg-success', 'text-white');
  if (type === 'danger') toastEl.classList.add('bg-danger', 'text-white');
  if (type === 'warning') toastEl.classList.add('bg-warning');

  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}
</script>
```

### 5. Volunteers View (`webapp/views/volunteers.html`)

Mobile-responsive CRUD interface:

```html
<div class="row">
  <div class="col-12">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2><i class="bi bi-people"></i> Volunteers</h2>
      <button class="btn btn-primary" onclick="openVolunteerModal()">
        <i class="bi bi-plus-circle"></i> Add Volunteer
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2">
          <div class="col-md-4">
            <input type="text" class="form-control" id="searchVolunteers" placeholder="Search by name or email...">
          </div>
          <div class="col-md-3">
            <select class="form-select" id="filterStatus">
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Substitute Only">Substitute Only</option>
              <option value="Ministry Sponsor">Ministry Sponsor</option>
            </select>
          </div>
          <div class="col-md-3">
            <button class="btn btn-secondary w-100" onclick="loadVolunteers()">
              <i class="bi bi-search"></i> Search
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Volunteers Table -->
    <div class="table-responsive">
      <table class="table table-hover">
        <thead class="table-light">
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th class="d-none d-md-table-cell">Phone</th>
            <th>Status</th>
            <th class="d-none d-lg-table-cell">Ministry Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="volunteersTableBody">
          <!-- Populated dynamically -->
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Volunteer Modal (Create/Edit) -->
<div class="modal fade" id="volunteerModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="volunteerModalTitle">Add Volunteer</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <form id="volunteerForm">
          <input type="hidden" id="volunteerId">
          <div class="row g-3">
            <div class="col-md-6">
              <label for="firstName" class="form-label">First Name *</label>
              <input type="text" class="form-control" id="firstName" required>
            </div>
            <div class="col-md-6">
              <label for="lastName" class="form-label">Last Name *</label>
              <input type="text" class="form-control" id="lastName" required>
            </div>
            <div class="col-md-6">
              <label for="email" class="form-label">Email *</label>
              <input type="email" class="form-control" id="email" required>
            </div>
            <div class="col-md-6">
              <label for="phone" class="form-label">Phone</label>
              <input type="tel" class="form-control" id="phone">
            </div>
            <div class="col-md-6">
              <label for="status" class="form-label">Status *</label>
              <select class="form-select" id="status" required>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Substitute Only">Substitute Only</option>
                <option value="Ministry Sponsor">Ministry Sponsor</option>
                <option value="Parent/Guardian">Parent/Guardian</option>
              </select>
            </div>
            <div class="col-md-6">
              <label for="familyTeam" class="form-label">Family Team</label>
              <input type="text" class="form-control" id="familyTeam">
            </div>
            <div class="col-12">
              <label for="ministryRole" class="form-label">Ministry Roles (comma-separated)</label>
              <input type="text" class="form-control" id="ministryRole"
                     placeholder="Lector, Eucharistic Minister">
            </div>
            <div class="col-12">
              <label for="preferredMass" class="form-label">Preferred Mass Times (Event IDs)</label>
              <input type="text" class="form-control" id="preferredMass"
                     placeholder="SUN-1000, SAT-1700">
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="saveVolunteer()">Save</button>
      </div>
    </div>
  </div>
</div>

<script>
let volunteersData = [];
let currentVolunteerId = null;

// Load volunteers on page load
async function loadVolunteers() {
  const filters = {
    search: document.getElementById('searchVolunteers')?.value || '',
    status: document.getElementById('filterStatus')?.value || ''
  };

  try {
    volunteersData = await API.getVolunteers(filters);
    renderVolunteersTable();
  } catch (error) {
    console.error('Failed to load volunteers:', error);
  }
}

function renderVolunteersTable() {
  const tbody = document.getElementById('volunteersTableBody');

  if (volunteersData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No volunteers found</td></tr>';
    return;
  }

  tbody.innerHTML = volunteersData.map(vol => `
    <tr>
      <td>${vol.id}</td>
      <td>${vol.firstName} ${vol.lastName}</td>
      <td>${vol.email}</td>
      <td class="d-none d-md-table-cell">${vol.phone || '-'}</td>
      <td><span class="badge bg-${getStatusBadgeColor(vol.status)}">${vol.status}</span></td>
      <td class="d-none d-lg-table-cell">${vol.ministryRole || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="editVolunteer('${vol.id}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteVolunteerConfirm('${vol.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function getStatusBadgeColor(status) {
  switch(status) {
    case 'Active': return 'success';
    case 'Inactive': return 'secondary';
    case 'Substitute Only': return 'warning';
    case 'Ministry Sponsor': return 'info';
    default: return 'secondary';
  }
}

function openVolunteerModal(volunteerId = null) {
  currentVolunteerId = volunteerId;
  const modal = new bootstrap.Modal(document.getElementById('volunteerModal'));

  if (volunteerId) {
    // Edit mode
    const volunteer = volunteersData.find(v => v.id === volunteerId);
    document.getElementById('volunteerModalTitle').textContent = 'Edit Volunteer';
    document.getElementById('volunteerId').value = volunteer.id;
    document.getElementById('firstName').value = volunteer.firstName;
    document.getElementById('lastName').value = volunteer.lastName;
    document.getElementById('email').value = volunteer.email;
    document.getElementById('phone').value = volunteer.phone || '';
    document.getElementById('status').value = volunteer.status;
    document.getElementById('familyTeam').value = volunteer.familyTeam || '';
    document.getElementById('ministryRole').value = volunteer.ministryRole || '';
    document.getElementById('preferredMass').value = volunteer.preferredMass || '';
  } else {
    // Create mode
    document.getElementById('volunteerModalTitle').textContent = 'Add Volunteer';
    document.getElementById('volunteerForm').reset();
  }

  modal.show();
}

function editVolunteer(id) {
  openVolunteerModal(id);
}

async function saveVolunteer() {
  const form = document.getElementById('volunteerForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const volunteerData = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    status: document.getElementById('status').value,
    familyTeam: document.getElementById('familyTeam').value,
    ministryRole: document.getElementById('ministryRole').value,
    preferredMass: document.getElementById('preferredMass').value
  };

  try {
    if (currentVolunteerId) {
      await API.updateVolunteer(currentVolunteerId, volunteerData);
    } else {
      await API.createVolunteer(volunteerData);
    }

    bootstrap.Modal.getInstance(document.getElementById('volunteerModal')).hide();
    loadVolunteers();
  } catch (error) {
    console.error('Failed to save volunteer:', error);
  }
}

async function deleteVolunteerConfirm(id) {
  if (!confirm('Are you sure you want to delete this volunteer?')) {
    return;
  }

  try {
    await API.deleteVolunteer(id);
    loadVolunteers();
  } catch (error) {
    console.error('Failed to delete volunteer:', error);
  }
}

// Auto-load on view render
loadVolunteers();
</script>
```

## Mobile Responsiveness Features

### 1. **Bootstrap 5 Grid System**
- Automatic column stacking on mobile
- Hidden columns on small screens (`d-none d-md-table-cell`)
- Mobile-first breakpoints

### 2. **Touch-Friendly UI**
- Large tap targets (minimum 44px)
- Swipe-friendly tables
- Bottom navigation for mobile

### 3. **Progressive Disclosure**
- Collapse/expand sections on mobile
- Modal forms instead of inline editing
- Simplified mobile views

### 4. **Offline Support** (Future Enhancement)
- Service Worker for caching
- Local storage for draft data
- Sync when connection restored

## Deployment Steps

### 1. **Setup Files**
```bash
# Create new files in Apps Script project
- 6_webapp.gs
- 6a_webapp_api.gs
- 6b_webapp_auth.gs
- WebApp.html
- webapp/css/main.css.html
- webapp/js/app.js.html
- webapp/js/api.js.html
- webapp/js/components.js.html
- webapp/views/*.html (all view files)
```

### 2. **Deploy as Web App**
1. In Apps Script editor: Deploy > New deployment
2. Type: Web app
3. Description: "Parish Scheduler Web App v1.0"
4. Execute as: Me
5. Who has access:
   - "Anyone" (public, requires Google sign-in)
   - "Anyone with Google account"
   - "Only myself" (testing)
6. Click Deploy
7. Copy web app URL

### 3. **Access Control** (`6b_webapp_auth.gs`)
```javascript
function isAuthorizedUser() {
  const userEmail = Session.getActiveUser().getEmail();
  const authorizedDomain = 'yourparish.org'; // Configure

  // Check if user is from authorized domain
  return userEmail.endsWith('@' + authorizedDomain);
}

function checkAuthorization() {
  if (!isAuthorizedUser()) {
    throw new Error('Unauthorized access');
  }
}
```

### 4. **Testing**
- Test on desktop browser
- Test on mobile browsers (iOS Safari, Android Chrome)
- Test offline behavior
- Test with multiple users

## Key Features Summary

### ✅ **Implemented**
- Responsive mobile-first design
- Full CRUD for all entities
- Google authentication
- Real-time data sync with Sheets
- Toast notifications
- Loading states

### 🔜 **Future Enhancements**
- Offline mode with service workers
- Push notifications for assignments
- Calendar integration (iCal export)
- Volunteer mobile app (view-only)
- Dark mode
- Multi-language support

## Performance Considerations

1. **Lazy Loading**: Load views on demand
2. **Caching**: Cache frequently accessed data client-side
3. **Pagination**: Implement for large datasets (500+ volunteers)
4. **Debouncing**: Search inputs debounced (300ms)
5. **Batch Operations**: Bulk updates when possible

## Security

- Google OAuth authentication required
- Apps Script authorization scopes
- Server-side validation for all operations
- No direct sheet access from client
- HTTPS enforced automatically

## Next Steps

1. Create file structure in Apps Script
2. Implement core files (6_webapp.gs, 6a_webapp_api.gs)
3. Build main template (WebApp.html)
4. Implement Volunteers CRUD (first module)
5. Test on mobile devices
6. Deploy as web app
7. Iterate on remaining modules

---

**Ready to start building?** Let's begin with the core infrastructure files!
