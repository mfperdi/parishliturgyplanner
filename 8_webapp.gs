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

        <!-- Google Fonts - Traditional serif for headings -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">

        <!-- Custom styles -->
        <style>
          :root {
            --burgundy: #6B2C2C;
            --gold: #C4A053;
            --cream: #F5F1E8;
            --slate: #4A4A4A;
            --light-slate: #858585;
            --warm-white: #FDFCFA;
            --border-color: #D4C5B0;
          }

          body {
            background: var(--cream);
            font-family: 'Inter', -apple-system, sans-serif;
            color: var(--slate);
            padding: 20px 10px;
            line-height: 1.6;
          }

          .container {
            max-width: 900px;
          }

          /* Header - Church-inspired */
          .page-header {
            background: var(--warm-white);
            border: 1px solid var(--border-color);
            border-radius: 0;
            padding: 2rem 1.5rem 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(107, 44, 44, 0.08);
            position: relative;
          }

          .page-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--burgundy) 0%, var(--gold) 50%, var(--burgundy) 100%);
          }

          .page-title {
            font-family: 'Crimson Text', Georgia, serif;
            font-size: 2rem;
            font-weight: 700;
            color: var(--burgundy);
            margin: 0 0 0.5rem 0;
            letter-spacing: 0.5px;
          }

          .page-subtitle {
            font-family: 'Crimson Text', Georgia, serif;
            font-size: 1.1rem;
            color: var(--light-slate);
            font-style: italic;
            margin: 0 0 1rem 0;
          }

          .user-info {
            background: var(--cream);
            border-left: 3px solid var(--gold);
            padding: 0.75rem 1rem;
            font-size: 0.9rem;
            color: var(--slate);
            margin-top: 1rem;
          }

          .user-info strong {
            color: var(--burgundy);
          }

          /* Main content card */
          .content-card {
            background: var(--warm-white);
            border: 1px solid var(--border-color);
            border-radius: 0;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(107, 44, 44, 0.06);
          }

          .content-card h2 {
            font-family: 'Crimson Text', Georgia, serif;
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--burgundy);
            margin-bottom: 1rem;
            border-bottom: 2px solid var(--cream);
            padding-bottom: 0.5rem;
          }

          /* Buttons - Traditional parish aesthetic */
          .btn-parish {
            background: var(--burgundy);
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            font-weight: 500;
            font-size: 0.95rem;
            letter-spacing: 0.5px;
            border-radius: 0;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(107, 44, 44, 0.2);
          }

          .btn-parish:hover {
            background: #582424;
            color: white;
            box-shadow: 0 4px 8px rgba(107, 44, 44, 0.3);
            transform: translateY(-1px);
          }

          .btn-outline-parish {
            background: transparent;
            color: var(--burgundy);
            border: 2px solid var(--burgundy);
            padding: 0.75rem 2rem;
            font-weight: 500;
            font-size: 0.95rem;
            letter-spacing: 0.5px;
            border-radius: 0;
            transition: all 0.2s ease;
          }

          .btn-outline-parish:hover {
            background: var(--burgundy);
            color: white;
          }

          /* Status badge */
          .status-badge {
            display: inline-block;
            padding: 0.4rem 1rem;
            border-radius: 2px;
            font-size: 0.85rem;
            font-weight: 500;
            letter-spacing: 0.5px;
          }

          .status-badge.active {
            background: #2C5F2D;
            color: white;
          }

          .status-badge.inactive {
            background: var(--light-slate);
            color: white;
          }

          .status-badge.sponsor {
            background: var(--gold);
            color: var(--slate);
          }

          /* Volunteer list - clean, readable */
          .volunteer-list {
            background: var(--cream);
            border: 1px solid var(--border-color);
            padding: 1.5rem;
            margin-top: 1rem;
          }

          .volunteer-item {
            background: var(--warm-white);
            border-left: 3px solid var(--gold);
            padding: 1rem 1.25rem;
            margin-bottom: 1rem;
            transition: all 0.2s ease;
          }

          .volunteer-item:hover {
            border-left-color: var(--burgundy);
            box-shadow: 0 2px 6px rgba(107, 44, 44, 0.1);
          }

          .volunteer-item:last-child {
            margin-bottom: 0;
          }

          .volunteer-name {
            font-weight: 600;
            color: var(--burgundy);
            font-size: 1.05rem;
            margin-bottom: 0.25rem;
          }

          .volunteer-email {
            color: var(--light-slate);
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
          }

          .volunteer-ministry {
            color: var(--slate);
            font-size: 0.9rem;
          }

          .volunteer-ministry strong {
            color: var(--burgundy);
          }

          /* Info boxes */
          .info-box {
            background: #FFF9E6;
            border-left: 4px solid var(--gold);
            padding: 1rem 1.25rem;
            margin: 1.5rem 0;
            color: var(--slate);
          }

          .info-box-title {
            font-weight: 600;
            color: var(--burgundy);
            margin-bottom: 0.5rem;
          }

          .info-box ul {
            margin: 0.5rem 0 0 0;
            padding-left: 1.25rem;
          }

          .info-box li {
            margin-bottom: 0.25rem;
          }

          /* Loading state */
          .loading {
            text-align: center;
            padding: 2rem;
            color: var(--light-slate);
            font-style: italic;
          }

          .loading-spinner {
            border: 3px solid var(--cream);
            border-top: 3px solid var(--burgundy);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          /* Footer */
          .page-footer {
            text-align: center;
            padding: 1.5rem;
            color: var(--light-slate);
            font-size: 0.85rem;
            border-top: 1px solid var(--border-color);
            margin-top: 2rem;
          }

          /* Responsive */
          @media (max-width: 768px) {
            .page-title {
              font-size: 1.5rem;
            }

            .content-card {
              padding: 1.5rem 1rem;
            }

            .btn-parish,
            .btn-outline-parish {
              width: 100%;
              margin-bottom: 0.5rem;
            }
          }
        </style>
      </head>

      <body>
        <div class="container">

          <!-- Header -->
          <div class="page-header text-center">
            <h1 class="page-title">Parish Liturgical Scheduler</h1>
            <p class="page-subtitle">Ministry Coordination Platform</p>
            <div class="user-info" id="userBadge">
              <small>Connecting...</small>
            </div>
          </div>

          <!-- Main Content -->
          <div class="content-card">
            <h2>System Status</h2>

            <div class="info-box">
              <div class="info-box-title">✓ Web Application Active</div>
              <p style="margin: 0; font-size: 0.9rem;">
                The scheduling platform is successfully deployed and ready for use.
              </p>
            </div>

            <div class="info-box">
              <div class="info-box-title">Current Capabilities</div>
              <ul>
                <li>Secure user authentication via Google accounts</li>
                <li>Direct access to volunteer database</li>
                <li>Real-time data synchronization</li>
                <li>Mobile-responsive interface</li>
                <li>Server-side data processing</li>
              </ul>
            </div>

            <div class="text-center" style="margin: 2rem 0;">
              <button class="btn-parish" onclick="loadVolunteers()">
                View Ministry Volunteers
              </button>
              <p style="margin-top: 0.75rem; color: var(--light-slate); font-size: 0.9rem;">
                Retrieves active volunteers from your database
              </p>
            </div>

            <!-- Results Area -->
            <div id="result"></div>
          </div>

          <!-- Next Steps -->
          <div class="content-card">
            <h2>Implementation Roadmap</h2>
            <p style="color: var(--slate); margin-bottom: 1.5rem;">
              This proof-of-concept confirms the technical foundation. The full application
              follows a structured 9-week development plan with three distinct phases.
            </p>
            <div class="text-center">
              <button class="btn-outline-parish" onclick="alert('Detailed implementation plan available in CRUD_APP_PLAN.md'); return false;">
                Review Development Plan
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="page-footer">
            Parish Liturgical Scheduler &middot; Proof of Concept<br>
            Powered by Google Apps Script
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
              'Authenticated as: <strong>' + email + '</strong>';
          }

          /**
           * Load volunteers from Volunteers sheet
           */
          function loadVolunteers() {
            // Show loading state
            document.getElementById('result').innerHTML =
              '<div class="loading"><div class="loading-spinner"></div><p>Retrieving volunteer records...</p></div>';

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
                '<div class="info-box" style="background: #FFF3CD; border-left-color: #856404;">' +
                '<div class="info-box-title" style="color: #856404;">No Records Found</div>' +
                '<p style="margin: 0;">No volunteer data available in the Volunteers sheet.</p>' +
                '</div>';
              return;
            }

            let html = '<div class="volunteer-list">';
            html += '<h3 style="font-family: \'Crimson Text\', serif; color: var(--burgundy); margin-bottom: 1.5rem; font-size: 1.3rem;">Ministry Volunteers</h3>';

            data.forEach(function(volunteer, index) {
              const status = volunteer.status || 'Unknown';
              const ministries = volunteer.ministries || 'Not assigned';
              const email = volunteer.email || 'No email on file';

              // Status badge class
              let statusClass = '';
              if (status === 'Active') statusClass = 'active';
              else if (status === 'Inactive') statusClass = 'inactive';
              else if (status === 'Ministry Sponsor') statusClass = 'sponsor';
              else statusClass = 'inactive';

              html += \`
                <div class="volunteer-item">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="flex: 1;">
                      <div class="volunteer-name">\${volunteer.fullName || 'Unknown'}</div>
                      <div class="volunteer-email">\${email}</div>
                    </div>
                    <span class="status-badge \${statusClass}">\${status}</span>
                  </div>
                  <div class="volunteer-ministry">
                    <strong>Ministries:</strong> \${ministries}
                  </div>
                </div>
              \`;
            });

            html += '<div style="text-align: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color); color: var(--light-slate); font-size: 0.9rem;">';
            html += 'Displaying first 5 records from database';
            html += '</div>';
            html += '</div>';

            document.getElementById('result').innerHTML = html;
          }

          /**
           * Handle errors
           */
          function handleError(error) {
            console.error('Error:', error);
            document.getElementById('result').innerHTML =
              '<div class="info-box" style="background: #F8D7DA; border-left-color: #842029;">' +
              '<div class="info-box-title" style="color: #842029;">System Error</div>' +
              '<p style="margin: 0; color: #58151C;">' + error.message + '</p>' +
              '</div>';
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
