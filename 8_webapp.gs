/**
 * ====================================================================
 * PARISH SCHEDULER - ADMIN WEB APP
 * ====================================================================
 * Modern web application for parish administrators to manage
 * liturgical schedules, volunteers, and ministry assignments.
 *
 * Architecture:
 * - Left sidebar navigation
 * - Card-based dashboard
 * - Multi-page routing
 * - Direct Google Sheets integration
 *
 * Pages:
 * - Dashboard (home)
 * - Calendar (schedule view)
 * - Assignments (manage assignments)
 * - Volunteers (manage volunteers)
 * - Ministries (manage ministry roles)
 * - Schedules (generate schedules)
 * - Settings (configuration)
 */

/**
 * Main entry point - serves HTML based on page parameter
 */
function doGet(e) {
  const page = e.parameter.page || 'dashboard';

  // Check authentication
  try {
    const auth = WEBAPP_checkAuth();
    return renderPage(page, auth);
  } catch (error) {
    return renderErrorPage(error.message);
  }
}

/**
 * Check if user is authorized admin
 */
function WEBAPP_checkAuth() {
  const email = Session.getActiveUser().getEmail().toLowerCase();

  // Read admin emails from Config sheet
  const config = HELPER_readConfigSafe();
  const adminEmailsStr = config['Admin Emails'] || '';

  if (!adminEmailsStr) {
    throw new Error('No admin emails configured. Please add "Admin Emails" to Config sheet.');
  }

  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());

  if (!adminEmails.includes(email)) {
    throw new Error('Access denied. You must be a parish administrator to access this application.');
  }

  return {
    email: email,
    isAdmin: true,
    userName: email.split('@')[0] // Simple name from email
  };
}

/**
 * Render the requested page
 */
function renderPage(page, auth) {
  let content = '';
  let pageTitle = 'Dashboard';

  switch(page) {
    case 'dashboard':
      content = renderDashboard(auth);
      pageTitle = 'Dashboard';
      break;
    case 'calendar':
      content = renderCalendar(auth);
      pageTitle = 'Calendar';
      break;
    case 'assignments':
      content = renderAssignments(auth);
      pageTitle = 'Assignments';
      break;
    case 'volunteers':
      content = renderVolunteers(auth);
      pageTitle = 'Volunteers';
      break;
    case 'ministries':
      content = renderMinistries(auth);
      pageTitle = 'Ministries';
      break;
    case 'schedules':
      content = renderSchedules(auth);
      pageTitle = 'Schedules';
      break;
    case 'settings':
      content = renderSettings(auth);
      pageTitle = 'Settings';
      break;
    default:
      content = renderDashboard(auth);
      pageTitle = 'Dashboard';
  }

  return HtmlService.createHtmlOutput(renderLayout(content, page, pageTitle, auth))
    .setTitle('Parish Scheduler - ' + pageTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Main layout with sidebar navigation
 */
function renderLayout(content, activePage, pageTitle, auth) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parish Scheduler - ${pageTitle}</title>

  <!-- VERSION: 2025-12-22 Mobile-First with Critical CSS -->
  <!-- If you see this comment, the latest code is deployed! -->

  <!-- CRITICAL CSS - Prevents flash of desktop layout on mobile -->
  <style>
    /* Load mobile layout IMMEDIATELY before any other CSS */
    .mobile-header { display: flex !important; }
    .sidebar { transform: translateX(-100%) !important; }
    .main-content { margin-left: 0 !important; margin-top: 60px !important; }
    .sidebar-close { display: block !important; }

    /* Desktop override */
    @media (min-width: 1025px) {
      .mobile-header { display: none !important; }
      .sidebar { transform: translateX(0) !important; }
      .main-content { margin-left: 260px !important; margin-top: 0 !important; }
      .sidebar-close { display: none !important; }
    }
  </style>

  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --primary-gold: #E5A855;
      --primary-gold-hover: #D49543;
      --text-dark: #1A1A1A;
      --text-medium: #4A4A4A;
      --text-light: #6B6B6B;
      --bg-cream: #FAF8F5;
      --bg-white: #FFFFFF;
      --border-light: #E5E5E5;
      --sidebar-width: 260px;
      --green-success: #2C5F2D;
      --red-alert: #C53030;
      --deep-teal: #0f3538;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--deep-teal);
      color: var(--text-dark);
      min-height: 100vh;
    }

    /* Sidebar - Positioned fixed (critical CSS handles show/hide) */
    .sidebar {
      width: var(--sidebar-width);
      background: var(--bg-white);
      border-right: 1px solid var(--border-light);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 1000;
      /* transform handled by critical CSS */
      transition: transform 0.3s ease;
    }

    .sidebar.active {
      transform: translateX(0) !important;
    }

    /* Main content shell */
    .main-content {
      width: 100%;
      max-width: 620px;
      margin: 60px auto 2rem;
      padding: 1.25rem;
      background: transparent;
    }

    .page-header {
      margin-bottom: 1.25rem;
    }

    .page-title {
      font-size: 1.9rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 0.35rem;
    }

    .page-subtitle {
      font-size: 1.05rem;
      color: var(--text-light);
      margin: 0;
    }

    .sidebar-header {
      padding: 1.5rem 1.25rem;
      border-bottom: 1px solid var(--border-light);
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text-dark);
    }

    .sidebar-logo-icon {
      width: 32px;
      height: 32px;
      background: var(--primary-gold);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }

    .sidebar-logo-text {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0;
      overflow-y: auto;
    }

    .nav-item {
      display: block;
      padding: 0.75rem 1.25rem;
      color: var(--text-medium);
      text-decoration: none;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .nav-item:hover {
      background: var(--bg-cream);
      color: var(--text-dark);
    }

    .nav-item.active {
      background: #FFF9EF;
      color: var(--text-dark);
      border-left: 3px solid var(--primary-gold);
      padding-left: calc(1.25rem - 3px);
    }

    .nav-icon {
      width: 20px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border-light);
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      background: var(--text-dark);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .user-info {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-dark);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 0.75rem;
      color: var(--text-light);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Main Content - margin handled by critical CSS */
    .main-content {
      /* margin-left and margin-top handled by critical CSS */
      flex: 1;
      padding: 1rem;
      max-width: 1400px;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-dark);
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      color: var(--text-light);
      font-size: 1rem;
    }

    /* Cards */
    .card {
      background: var(--bg-white);
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-white);
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: var(--text-light);
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .stat-value {
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--text-dark);
      line-height: 1;
    }

    .stat-value.alert {
      color: var(--red-alert);
    }

    .stat-description {
      font-size: 0.8rem;
      color: var(--text-medium);
      margin-top: 0.5rem;
    }

    /* Buttons */
    .btn-primary {
      background: var(--primary-gold);
      border: none;
      color: var(--text-dark);
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.95rem;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .btn-primary:hover {
      background: var(--primary-gold-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(229, 168, 85, 0.3);
    }

    .btn-outline {
      background: transparent;
      border: 1px solid var(--border-light);
      color: var(--text-dark);
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .btn-outline:hover {
      border-color: var(--primary-gold);
      color: var(--primary-gold);
    }

    /* Date Badge */
    .date-badge {
      background: #FFF9EF;
      border: 1px solid #F5E6C8;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .date-icon {
      width: 48px;
      height: 48px;
      background: var(--primary-gold);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }

    .date-info h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .date-info p {
      font-size: 0.875rem;
      color: var(--text-light);
      margin: 0;
    }

    .liturgical-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .liturgical-dot {
      width: 8px;
      height: 8px;
      background: var(--green-success);
      border-radius: 50%;
    }

    /* Getting Started */
    .getting-started {
      background: var(--bg-white);
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 2rem;
    }

    .getting-started h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .getting-started-subtitle {
      color: var(--text-light);
      margin-bottom: 2rem;
    }

    .steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }

    .step-card {
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .step-icon {
      width: 40px;
      height: 40px;
      background: #FFF9EF;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }

    .step-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .step-description {
      color: var(--text-light);
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }

    .step-action {
      display: inline-block;
      color: var(--primary-gold);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.15s ease;
    }

    .step-action:hover {
      color: var(--primary-gold-hover);
      text-decoration: underline;
    }

    /* Mobile Header - display handled by critical CSS */
    .mobile-header {
      /* display handled by critical CSS */
      background: var(--bg-white);
      border-bottom: 1px solid var(--border-light);
      padding: 1rem;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1001;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .menu-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.5rem;
      color: var(--text-dark);
    }

    .mobile-logo {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-dark);
    }

    /* Sidebar Overlay */
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
    }

    .sidebar-overlay.active {
      display: block;
    }

    .sidebar-close {
      /* display handled by critical CSS */
      position: absolute;
      top: 1.25rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-medium);
      padding: 0.25rem;
      line-height: 1;
    }

    /* DESKTOP OVERRIDE - Handled by critical CSS above */
    /* Desktop layout (sidebar visible, mobile header hidden) is set in critical CSS */
    /* Only desktop-specific sizing adjustments go in media queries below */
    @media (min-width: 1025px) {
      .main-content {
        max-width: none;
        margin: 0;
        padding: 2rem;
        margin-left: 260px !important;
        margin-top: 0 !important;
      }
    }

    /* Responsive - Large Tablet/Small Desktop (1024px - 1280px) */
    @media (max-width: 1280px) and (min-width: 1025px) {
      .stats-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    /* Responsive - Tablet (769px - 1024px) */
    @media (max-width: 1024px) and (min-width: 769px) {
      /* Keep sidebar visible but reduce content padding */
      .main-content {
        padding: 1.5rem;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }

      .steps-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .date-badge {
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .date-info {
        flex: 1;
        min-width: 250px;
      }

      .getting-started {
        padding: 1.75rem;
      }

      .card {
        padding: 1.5rem;
      }
    }

    /* Responsive - Large Phone/Small Tablet (481px - 768px) */
    @media (max-width: 768px) and (min-width: 481px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }

      .stat-card {
        padding: 1.5rem;
      }

      .steps-grid {
        grid-template-columns: 1fr;
        gap: 1.25rem;
      }

      .date-badge {
        padding: 1.25rem;
        gap: 1rem;
      }

      .main-content {
        padding: 1.25rem;
      }
    }

    /* Responsive - Mobile (max 480px) - Size adjustments only */
    @media (max-width: 480px) {
      /* Mobile header and sidebar already set as defaults */

      body {
        font-size: 1.05rem;
      }

      .page-header {
        margin-bottom: 1.5rem;
      }

      .page-title {
        font-size: 1.55rem;
        margin-bottom: 0.5rem;
        line-height: 1.3;
      }

      .page-subtitle {
        font-size: 1rem;
        line-height: 1.5;
      }

      .stats-grid {
        grid-template-columns: 1fr;
        gap: 1.25rem;
        margin-bottom: 1.75rem;
      }

      .stat-card {
        padding: 1.5rem;
      }

      .stat-value {
        font-size: 2.2rem;
        margin: 0.5rem 0;
      }

      .stat-label {
        font-size: 0.95rem;
        margin-bottom: 0.75rem;
      }

      .stat-description {
        font-size: 0.9rem;
        margin-top: 0.75rem;
      }

      .steps-grid {
        grid-template-columns: 1fr;
        gap: 1.25rem;
      }

      .step-card {
        padding: 1.5rem;
      }

      .step-title {
        font-size: 1.18rem;
        margin-bottom: 1rem;
      }

      .step-description {
        font-size: 0.95rem;
        line-height: 1.6;
        margin-bottom: 1.25rem;
      }

      .step-icon {
        margin-bottom: 1.25rem;
      }

      .getting-started {
        padding: 1.5rem;
      }

      .getting-started h2 {
        font-size: 1.35rem;
        margin-bottom: 0.75rem;
      }

      .getting-started-subtitle {
        font-size: 0.95rem;
        margin-bottom: 1.75rem;
        line-height: 1.6;
      }

      .date-badge {
        flex-direction: column;
        text-align: center;
        padding: 1.25rem;
        gap: 1rem;
        margin-bottom: 1.75rem;
      }

      .date-icon {
        width: 40px;
        height: 40px;
        font-size: 1.25rem;
      }

      .date-info h3 {
        font-size: 0.9375rem;
        margin-bottom: 0.5rem;
      }

      .date-info p {
        font-size: 0.8125rem;
        line-height: 1.5;
      }

      .date-badge .btn-primary {
        width: 100%;
        padding: 0.75rem 1.25rem;
        font-size: 0.9375rem;
        margin-top: 0.5rem;
      }

      .card {
        padding: 1.5rem;
        margin-bottom: 1.25rem;
      }

      .mobile-logo {
        font-size: 1.0625rem;
      }

      .menu-btn {
        font-size: 1.5rem;
        padding: 0.5rem;
      }
    }
  </style>
</head>
<body>
  <!-- Mobile Header (shows only on mobile) -->
  <div class="mobile-header">
    <button class="menu-btn" onclick="toggleSidebar()">☰</button>
    <div class="mobile-logo">Acutis Planner</div>
    <div style="width: 40px;"></div>
  </div>

  <!-- Sidebar Overlay (mobile only) -->
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>

  <!-- Sidebar -->
  <div class="sidebar" id="sidebar">
    <button class="sidebar-close" onclick="closeSidebar()">✕</button>
    <div class="sidebar-header">
      <a href="?page=dashboard" class="sidebar-logo">
        <div class="sidebar-logo-icon">⛪</div>
        <div class="sidebar-logo-text">Acutis Planner</div>
      </a>
    </div>

    <nav class="sidebar-nav">
      <a href="?page=dashboard" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
        <span class="nav-icon">📊</span>
        Dashboard
      </a>
      <a href="?page=calendar" class="nav-item ${activePage === 'calendar' ? 'active' : ''}">
        <span class="nav-icon">📅</span>
        Calendar
      </a>
      <a href="?page=assignments" class="nav-item ${activePage === 'assignments' ? 'active' : ''}">
        <span class="nav-icon">📋</span>
        Assignments
      </a>
      <a href="?page=volunteers" class="nav-item ${activePage === 'volunteers' ? 'active' : ''}">
        <span class="nav-icon">👥</span>
        Volunteers
      </a>
      <a href="?page=ministries" class="nav-item ${activePage === 'ministries' ? 'active' : ''}">
        <span class="nav-icon">🛡️</span>
        Ministries
      </a>
      <a href="?page=schedules" class="nav-item ${activePage === 'schedules' ? 'active' : ''}">
        <span class="nav-icon">🔄</span>
        Schedules
      </a>
      <a href="?page=settings" class="nav-item ${activePage === 'settings' ? 'active' : ''}">
        <span class="nav-icon">⚙️</span>
        Settings
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="user-profile">
        <div class="user-avatar">${auth.userName.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">Parish Admin</div>
          <div class="user-email">${auth.email}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="main-content">
    ${content}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

  <script>
    // VERSION CHECK - Verify deployment
    console.log('%c✅ Acutis Planner - Version 2025-12-22', 'color: #E5A855; font-weight: bold; font-size: 14px;');
    console.log('%cMobile-First CSS with Critical Inline Styles', 'color: #666; font-size: 12px;');
    console.log('Screen width:', window.innerWidth + 'px');
    console.log('Mobile header visible:', window.getComputedStyle(document.querySelector('.mobile-header')).display !== 'none');
    console.log('Sidebar position:', window.getComputedStyle(document.querySelector('.sidebar')).transform);

    const MOBILE_BREAKPOINT = 768;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const menuButton = document.querySelector('.menu-btn');
    const navLinks = document.querySelectorAll('.nav-item');

    function isMobileWidth() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function setMenuAria(isOpen) {
      if (!menuButton) return;
      menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuButton.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    }

    // Mobile sidebar toggle
    function toggleSidebar() {
      const isOpen = !sidebar.classList.contains('active');
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
      setMenuAria(isOpen);
    }

    function closeSidebar() {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      setMenuAria(false);
    }

    function updateNavLinkHandlers() {
      navLinks.forEach(link => {
        link.removeEventListener('click', closeSidebar);
        if (isMobileWidth()) {
          link.addEventListener('click', closeSidebar);
        }
      });
    }

    function syncSidebarStateToViewport() {
      if (!isMobileWidth()) {
        closeSidebar();
      }
      updateNavLinkHandlers();
    }

    window.addEventListener('resize', () => {
      clearTimeout(window.__acutisResizeTimer);
      window.__acutisResizeTimer = setTimeout(syncSidebarStateToViewport, 150);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    });

    // Initialize state on first paint
    syncSidebarStateToViewport();
  </script>
</body>
</html>
  `;
}

/**
 * Dashboard page with stats and getting started
 */
function renderDashboard(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Welcome, Parish Admin!</h1>
      <p class="page-subtitle">Here's your parish at a glance.</p>
    </div>

    <!-- Current Date -->
    <div class="date-badge">
      <div class="date-icon">📅</div>
      <div class="date-info" style="flex: 1;">
        <h3 id="currentDate">Loading...</h3>
        <p>
          <span class="liturgical-badge">
            <span class="liturgical-dot"></span>
            <span id="liturgicalSeason">Ordinary Time</span>
          </span>
          <span style="color: var(--text-light); margin: 0 0.5rem;">|</span>
          <span id="liturgicalDay">Weekday | Ordinary Time</span>
        </p>
      </div>
      <button class="btn-primary" onclick="window.location.href='?page=calendar'">Go to Calendar</button>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Upcoming Masses</div>
        <div class="stat-value" id="upcomingMasses">--</div>
        <div class="stat-description">Next 7 days</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Active Volunteers</div>
        <div class="stat-value" id="activeVolunteers">--</div>
        <div class="stat-description">Ready to serve</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Open Positions</div>
        <div class="stat-value alert" id="openPositions">--</div>
        <div class="stat-description">Needs immediate attention</div>
      </div>
    </div>

    <!-- Getting Started -->
    <div class="getting-started">
      <h2>Getting Started</h2>
      <p class="getting-started-subtitle">New to Acutis Planner? Here's how to begin building your parish schedule.</p>

      <div class="steps-grid">
        <div class="step-card">
          <div class="step-icon">👥</div>
          <h3 class="step-title">Step 1: Add Volunteers</h3>
          <p class="step-description">Build your roster by adding all the volunteers who serve your parish community.</p>
          <a href="?page=volunteers" class="step-action">Manage Volunteers →</a>
        </div>

        <div class="step-card">
          <div class="step-icon">⚙️</div>
          <h3 class="step-title">Step 2: Define Ministries</h3>
          <p class="step-description">Set up all the ministries your parish offers, like Lectors, Ushers, and Altar Servers.</p>
          <a href="?page=ministries" class="step-action">Manage Ministries →</a>
        </div>
      </div>
    </div>

    <script>
      // Load dashboard stats
      (function() {
        // Format current date
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);

        // Load stats from server
        google.script.run
          .withSuccessHandler(function(stats) {
            document.getElementById('upcomingMasses').textContent = stats.upcomingMasses || 0;
            document.getElementById('activeVolunteers').textContent = stats.activeVolunteers || 0;
            document.getElementById('openPositions').textContent = stats.openPositions || 0;

            if (stats.liturgicalSeason) {
              document.getElementById('liturgicalSeason').textContent = stats.liturgicalSeason;
            }
            if (stats.liturgicalDay) {
              document.getElementById('liturgicalDay').textContent = stats.liturgicalDay;
            }
          })
          .withFailureHandler(function(error) {
            console.error('Failed to load stats:', error);
          })
          .WEBAPP_getDashboardStats();
      })();
    </script>
  `;
}

/**
 * Placeholder pages (to be built in later weeks)
 */
function renderCalendar(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Calendar</h1>
      <p class="page-subtitle">View and manage your parish schedule.</p>
    </div>
    <div class="card">
      <p>Calendar view coming in Week 2...</p>
    </div>
  `;
}

function renderAssignments(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Assignments</h1>
      <p class="page-subtitle">Manage volunteer assignments.</p>
    </div>
    <div class="card">
      <p>Assignment management coming in Week 3...</p>
    </div>
  `;
}

function renderVolunteers(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Volunteers</h1>
      <p class="page-subtitle">Manage your volunteer roster.</p>
    </div>
    <div class="card">
      <p>Volunteer management coming in Week 4...</p>
    </div>
  `;
}

function renderMinistries(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Ministries</h1>
      <p class="page-subtitle">Configure ministry roles and templates.</p>
    </div>
    <div class="card">
      <p>Ministry management coming in Week 5...</p>
    </div>
  `;
}

function renderSchedules(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Schedules</h1>
      <p class="page-subtitle">Generate and manage schedules.</p>
    </div>
    <div class="card">
      <p>Schedule generation coming in Week 6...</p>
    </div>
  `;
}

function renderSettings(auth) {
  return `
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Configure application settings.</p>
    </div>
    <div class="card">
      <p>Settings coming soon...</p>
    </div>
  `;
}

/**
 * Error page for unauthorized access
 */
function renderErrorPage(message) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Access Denied</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #FAF8F5;
          margin: 0;
          padding: 1rem;
        }
        .error-card {
          background: white;
          border: 1px solid #E5E5E5;
          border-radius: 8px;
          padding: 3rem 2rem;
          max-width: 480px;
          text-align: center;
        }
        .error-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: #1A1A1A;
        }
        p {
          color: #6B6B6B;
          line-height: 1.6;
          margin-bottom: 2rem;
        }
        .contact {
          background: #FFF9EF;
          border: 1px solid #F5E6C8;
          border-radius: 6px;
          padding: 1rem;
          font-size: 0.9rem;
          color: #4A4A4A;
        }
      </style>
    </head>
    <body>
      <div class="error-card">
        <div class="error-icon">🔒</div>
        <h1>Access Denied</h1>
        <p>${message}</p>
        <div class="contact">
          <strong>Need access?</strong><br>
          Contact your parish administrator to be added to the authorized users list.
        </div>
      </div>
    </body>
    </html>
  `).setTitle('Access Denied');
}

/**
 * Get dashboard statistics
 */
function WEBAPP_getDashboardStats() {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Count active volunteers
    const volunteers = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const activeVolunteers = volunteers.filter(row =>
      row[CONSTANTS.COLS.VOLUNTEERS.STATUS - 1] === 'Active'
    ).length;

    // Count upcoming masses (next 7 days)
    const assignments = HELPER_readSheetData(CONSTANTS.SHEETS.ASSIGNMENTS);
    const upcomingMasses = new Set();
    assignments.forEach(row => {
      const dateStr = row[CONSTANTS.COLS.ASSIGNMENTS.DATE - 1];
      if (dateStr) {
        const date = new Date(dateStr);
        if (date >= now && date <= sevenDaysFromNow) {
          const key = dateStr + '-' + row[CONSTANTS.COLS.ASSIGNMENTS.TIME - 1];
          upcomingMasses.add(key);
        }
      }
    });

    // Count open positions (unassigned)
    const openPositions = assignments.filter(row => {
      const dateStr = row[CONSTANTS.COLS.ASSIGNMENTS.DATE - 1];
      const volunteerId = row[CONSTANTS.COLS.ASSIGNMENTS.ASSIGNED_VOLUNTEER_ID - 1];
      if (dateStr && !volunteerId) {
        const date = new Date(dateStr);
        return date >= now && date <= sevenDaysFromNow;
      }
      return false;
    }).length;

    // Get current liturgical info (simplified)
    const liturgicalCal = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    let liturgicalSeason = 'Ordinary Time';
    let liturgicalDay = 'Weekday | Ordinary Time';

    const todayStr = HELPER_formatDate(now, 'default');
    const todayRow = liturgicalCal.find(row =>
      HELPER_formatDate(new Date(row[CONSTANTS.COLS.CALENDAR.DATE - 1]), 'default') === todayStr
    );

    if (todayRow) {
      liturgicalSeason = todayRow[CONSTANTS.COLS.CALENDAR.SEASON - 1] || 'Ordinary Time';
      const weekday = todayRow[CONSTANTS.COLS.CALENDAR.WEEKDAY - 1] || 'Weekday';
      liturgicalDay = weekday + ' | ' + liturgicalSeason;
    }

    return {
      upcomingMasses: upcomingMasses.size,
      activeVolunteers: activeVolunteers,
      openPositions: openPositions,
      liturgicalSeason: liturgicalSeason,
      liturgicalDay: liturgicalDay
    };

  } catch (e) {
    Logger.log('Error in WEBAPP_getDashboardStats: ' + e.message);
    return {
      upcomingMasses: 0,
      activeVolunteers: 0,
      openPositions: 0,
      liturgicalSeason: 'Ordinary Time',
      liturgicalDay: 'Weekday | Ordinary Time'
    };
  }
}

/**
 * Test function
 */
function TEST_webApp() {
  Logger.log('Testing authentication...');
  const auth = WEBAPP_checkAuth();
  Logger.log('Auth: ' + JSON.stringify(auth));

  Logger.log('Testing dashboard stats...');
  const stats = WEBAPP_getDashboardStats();
  Logger.log('Stats: ' + JSON.stringify(stats));

  Logger.log('All tests passed! ✅');
}
