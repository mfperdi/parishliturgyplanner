/**
 * ====================================================================
 * WEB APP - PROOF OF CONCEPT
 * ====================================================================
 * Simple web app to demonstrate the architecture and test deployment.
 *
 * Features:
 * - Shows logged-in user email
 * - Loads volunteer data from existing Volunteers sheet
 * - Bootstrap UI with responsive design
 * - Works on desktop and mobile
 *
 * To Deploy:
 * 1. Click "Deploy" > "New deployment"
 * 2. Type: Web app
 * 3. Execute as: Me
 * 4. Access: Anyone with link (or Organization only)
 * 5. Click "Deploy"
 * 6. Copy the URL and open in browser
 */

/**
 * Main entry point for web app
 * Serves the HTML page when user visits the web app URL
 */
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Parish Scheduler - Proof of Concept</title>

        <!-- Bootstrap 5 CSS -->
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

        <!-- Custom styles -->
        <style>
          body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }

          .card {
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            border: none;
            border-radius: 15px;
          }

          .card-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px 15px 0 0 !important;
            padding: 20px;
          }

          .user-badge {
            background: rgba(255,255,255,0.2);
            padding: 10px 15px;
            border-radius: 8px;
            display: inline-block;
            margin-top: 10px;
          }

          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-weight: 500;
            transition: transform 0.2s;
          }

          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
          }

          .loading {
            text-align: center;
            padding: 20px;
            color: #6c757d;
          }

          .spinner-border {
            width: 1.5rem;
            height: 1.5rem;
            border-width: 0.2em;
          }

          #result {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
          }

          .volunteer-item {
            background: white;
            border-left: 4px solid #667eea;
            padding: 12px 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            transition: transform 0.2s;
          }

          .volunteer-item:hover {
            transform: translateX(5px);
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
          }

          .badge {
            font-weight: 500;
          }

          .success-message {
            background: #d4edda;
            color: #155724;
            padding: 12px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
            margin-bottom: 15px;
          }
        </style>
      </head>

      <body>
        <div class="container" style="max-width: 800px;">
          <!-- Main Card -->
          <div class="card">
            <div class="card-header text-center">
              <h1 class="mb-0">🎉 Parish Scheduler Web App</h1>
              <p class="mb-0 mt-2">Proof of Concept</p>
              <div class="user-badge" id="userBadge">
                <small>Loading user...</small>
              </div>
            </div>

            <div class="card-body">
              <!-- Success Message -->
              <div class="success-message">
                <strong>✅ Success!</strong> Your web app is running. This proves the architecture works!
              </div>

              <!-- Instructions -->
              <div class="alert alert-info">
                <h6 class="alert-heading">What This Demonstrates:</h6>
                <ul class="mb-0">
                  <li>✅ Web app deployment working</li>
                  <li>✅ User authentication (Google login)</li>
                  <li>✅ Data access from Google Sheets</li>
                  <li>✅ Bootstrap UI (mobile-responsive)</li>
                  <li>✅ Client-server communication</li>
                </ul>
              </div>

              <!-- Load Volunteers Button -->
              <div class="text-center mb-4">
                <button class="btn btn-primary btn-lg" onclick="loadVolunteers()">
                  📋 Load Volunteers
                </button>
                <p class="text-muted small mt-2">
                  This will fetch the first 5 volunteers from your Volunteers sheet
                </p>
              </div>

              <!-- Results Area -->
              <div id="result"></div>
            </div>

            <div class="card-footer text-muted text-center">
              <small>
                Parish Liturgical Scheduler • Web App Proof of Concept
                <br>
                Powered by Google Apps Script
              </small>
            </div>
          </div>

          <!-- Next Steps Card -->
          <div class="card mt-4">
            <div class="card-body">
              <h5 class="card-title">🚀 Next Steps</h5>
              <p class="card-text">
                This proof-of-concept works! Now you can build the full app by following the 9-week roadmap in <code>CRUD_APP_PLAN.md</code>.
              </p>
              <div class="d-grid gap-2">
                <a href="#" class="btn btn-outline-primary" onclick="alert('Check CRUD_APP_PLAN.md in your repository for the full implementation roadmap!'); return false;">
                  📖 View Full Implementation Plan
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Bootstrap JS (optional, for future interactive components) -->
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

        <!-- App JavaScript -->
        <script>
          // Load user email on page load
          google.script.run
            .withSuccessHandler(displayUser)
            .withFailureHandler(handleError)
            .getUserEmail();

          /**
           * Display logged-in user email
           */
          function displayUser(email) {
            document.getElementById('userBadge').innerHTML =
              '<i class="bi bi-person-circle"></i> Logged in as: <strong>' + email + '</strong>';
          }

          /**
           * Load volunteers from Volunteers sheet
           */
          function loadVolunteers() {
            // Show loading state
            document.getElementById('result').innerHTML =
              '<div class="loading"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading volunteers...</p></div>';

            // Call server function
            google.script.run
              .withSuccessHandler(displayVolunteers)
              .withFailureHandler(handleError)
              .getVolunteersData();
          }

          /**
           * Display volunteer data in formatted cards
           */
          function displayVolunteers(data) {
            if (!data || data.length === 0) {
              document.getElementById('result').innerHTML =
                '<div class="alert alert-warning">No volunteers found. Make sure you have data in the Volunteers sheet.</div>';
              return;
            }

            let html = '<h5 class="mb-3">📋 Volunteers (First 5)</h5>';

            data.forEach(function(volunteer, index) {
              const status = volunteer.status || 'Unknown';
              const ministries = volunteer.ministries || 'None';
              const email = volunteer.email || 'No email';

              // Color-code status badges
              let statusColor = 'secondary';
              if (status === 'Active') statusColor = 'success';
              else if (status === 'Inactive') statusColor = 'danger';
              else if (status === 'Ministry Sponsor') statusColor = 'primary';

              html += \`
                <div class="volunteer-item">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 class="mb-1">\${volunteer.fullName || 'Unknown'}</h6>
                      <small class="text-muted">\${email}</small>
                    </div>
                    <span class="badge bg-\${statusColor}">\${status}</span>
                  </div>
                  <div class="mt-2">
                    <small><strong>Ministries:</strong> \${ministries}</small>
                  </div>
                </div>
              \`;
            });

            html += '<div class="text-center mt-3"><small class="text-muted">Showing first 5 of ' + data.length + ' volunteers</small></div>';

            document.getElementById('result').innerHTML = html;
          }

          /**
           * Handle errors
           */
          function handleError(error) {
            console.error('Error:', error);
            document.getElementById('result').innerHTML =
              '<div class="alert alert-danger"><strong>Error:</strong> ' + error.message + '</div>';
          }
        </script>
      </body>
    </html>
  `)
    .setTitle('Parish Scheduler - Web App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Get the email of the currently logged-in user
 * @returns {string} User's email address
 */
function getUserEmail() {
  try {
    const email = Session.getActiveUser().getEmail();

    if (!email) {
      throw new Error('Unable to get user email. Make sure you are logged in.');
    }

    return email;
  } catch (e) {
    Logger.log('Error in getUserEmail: ' + e.message);
    throw new Error('Could not retrieve user email: ' + e.message);
  }
}

/**
 * Get volunteers data from the Volunteers sheet
 * Returns first 5 volunteers as proof-of-concept
 * @returns {Array<Object>} Array of volunteer objects
 */
function getVolunteersData() {
  try {
    // Check if HELPER_readSheetData exists (from existing codebase)
    if (typeof HELPER_readSheetData !== 'function') {
      throw new Error('HELPER_readSheetData function not found. Make sure all code files are loaded.');
    }

    // Check if CONSTANTS exists
    if (typeof CONSTANTS === 'undefined') {
      throw new Error('CONSTANTS not found. Make sure 0a_constants.gs is loaded.');
    }

    // Read volunteers data
    const data = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);

    if (!data || data.length === 0) {
      return [];
    }

    // Get column indices
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    // Transform first 5 rows into objects
    const volunteers = data.slice(0, 5).map(function(row) {
      return {
        id: HELPER_safeArrayAccess(row, cols.VOLUNTEER_ID - 1, ''),
        firstName: HELPER_safeArrayAccess(row, cols.FIRST_NAME - 1, ''),
        lastName: HELPER_safeArrayAccess(row, cols.LAST_NAME - 1, ''),
        fullName: HELPER_safeArrayAccess(row, cols.FULL_NAME - 1, ''),
        email: HELPER_safeArrayAccess(row, cols.EMAIL - 1, ''),
        status: HELPER_safeArrayAccess(row, cols.STATUS - 1, ''),
        ministries: HELPER_safeArrayAccess(row, cols.MINISTRY_ROLE - 1, '')
      };
    });

    Logger.log('Successfully retrieved ' + volunteers.length + ' volunteers');
    return volunteers;

  } catch (e) {
    Logger.log('Error in getVolunteersData: ' + e.message);
    Logger.log('Stack trace: ' + e.stack);
    throw new Error('Could not load volunteers: ' + e.message);
  }
}

/**
 * Test function to verify web app functions work
 * Run this from Script Editor to test before deploying
 */
function TEST_webAppFunctions() {
  Logger.log('Testing getUserEmail...');
  const email = getUserEmail();
  Logger.log('Email: ' + email);

  Logger.log('Testing getVolunteersData...');
  const volunteers = getVolunteersData();
  Logger.log('Found ' + volunteers.length + ' volunteers');
  Logger.log('Sample: ' + JSON.stringify(volunteers[0], null, 2));

  Logger.log('All tests passed! ✅');
}
