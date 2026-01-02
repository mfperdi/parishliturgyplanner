/**
 * TEST FUNCTION - Dashboard Generation
 * Run this from the Apps Script editor to test dashboard
 */
function TEST_dashboardGeneration() {
  // REPLACE THIS with a month you have schedule/assignment data for
  // Format must be: "YYYY-MM" (e.g., "2026-02" for February 2026)
  const monthString = "2026-02";

  Logger.log(`=== Testing Dashboard Generation for ${monthString} ===`);

  try {
    const result = DASHBOARD_generateAnalytics(monthString);

    Logger.log('✅ SUCCESS!');
    Logger.log(result);

    // Open the Dashboard sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dashboardSheet = ss.getSheetByName('Dashboard');
    if (dashboardSheet) {
      ss.setActiveSheet(dashboardSheet);
      Logger.log('Dashboard sheet opened');
    }

    return result;

  } catch (e) {
    Logger.log('❌ ERROR: ' + e.message);
    Logger.log('Stack: ' + e.stack);
    throw e;
  }
}
