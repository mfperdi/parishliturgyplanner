/**
 * ====================================================================
 * 2. SCHEDULE GENERATION LOGIC
 * ====================================================================
 * This file contains all logic for "Step 1: Generate Schedule".
 * It reads mass templates and recurring/special masses to create
 * all the "Unassigned" rows for a given month.
 */

/**
 * Main function to generate the unassigned schedule for a given month.
 * Called by Code.gs
 * @param {string} monthString A string like "2026-01" (for Jan 2026).
 * @returns {string} A success message.
 */
function SCHEDULE_generateScheduleForMonth(monthString) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
  const config = HELPER_readConfig();
  const scheduleYear = config["Year to Schedule"];
  
  const selectedDate = new Date(monthString + "-01T12:00:00"); // Use noon to avoid timezone issues
  const month = selectedDate.getMonth(); // 0-indexed month
  
  if (selectedDate.getFullYear() != scheduleYear) {
    throw new Error(`The selected month (${monthString}) is not in the configured schedule year (${scheduleYear}). Please check the 'Config' sheet.`);
  }

  Logger.log(`Starting schedule generation for: ${monthString} (Month: ${month}, Year: ${scheduleYear})`);

  // 1. Clear out any old "Unassigned" rows for this month
  Logger.log("1. Clearing old 'Unassigned' rows...");
  SCHEDULE_clearOldAssignments(assignmentsSheet, month, scheduleYear);

  // 2. Read all mass templates
  Logger.log("2. Reading mass templates...");
  const templateMap = SCHEDULE_buildTemplateMap();
  
  // 3. Find all masses that need to be scheduled this month
  Logger.log("3. Finding all masses for the month...");
  const massesToSchedule = SCHEDULE_findMassesForMonth(month, scheduleYear);
  
  // 4. Create new rows
  Logger.log(`4. Generating roles for ${massesToSchedule.length} masses...`);
  const newAssignmentRows = [];
  const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

  for (const mass of massesToSchedule) {
    const templateName = mass.templateName;
    const roles = templateMap.get(templateName);

    if (!roles) {
      Logger.log(`Warning: Template "${templateName}" not found for mass "${mass.description}". Skipping.`);
      continue;
    }

    // For each role in the template, create a new row
    for (const role of roles) {
      const newRow = new Array(assignCols.FAMILY_GROUP).fill(""); // Create array with correct length
      
      newRow[assignCols.DATE - 1] = mass.date; // The specific date of the mass
      newRow[assignCols.TIME - 1] = mass.time;
      newRow[assignCols.MASS_NAME - 1] = mass.description;
      newRow[assignCols.LITURGICAL_CELEBRATION - 1] = mass.liturgicalCelebration; // NEW
      newRow[assignCols.MINISTRY_ROLE - 1] = role.roleName; // e.g., "1st Reading"
      newRow[assignCols.MINISTRY_SKILL - 1] = role.skill; // e.g., "Lector"
      newRow[assignCols.ASSIGNED_VOLUNTEER_ID - 1] = "";
      newRow[assignCols.ASSIGNED_VOLUNTEER_NAME - 1] = "";
      newRow[assignCols.STATUS - 1] = "Unassigned";
      newRow[assignCols.NOTES - 1] = mass.notes || ""; // NEW
      newRow[assignCols.EVENT
