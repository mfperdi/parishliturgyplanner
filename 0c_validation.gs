/**
 * ====================================================================
 * DATA VALIDATION - INPUT VALIDATION AND INTEGRITY CHECKS
 * ====================================================================
 * This file contains all data validation functions to ensure data
 * integrity and prevent errors before they happen.
 */

/**
 * Master validation function - runs all validation checks
 * @returns {object} Validation results with errors and warnings
 */
function VALIDATE_all() {
  const results = {
    errors: [],
    warnings: [],
    isValid: true
  };

  try {
    // 1. Config validation
    const configResults = VALIDATE_config();
    results.errors.push(...configResults.errors);
    results.warnings.push(...configResults.warnings);

    // 2. Ministries validation (master reference)
    const ministriesResults = VALIDATE_ministries();
    results.errors.push(...ministriesResults.errors);
    results.warnings.push(...ministriesResults.warnings);

    // 3. Volunteers validation
    const volunteerResults = VALIDATE_volunteers();
    results.errors.push(...volunteerResults.errors);
    results.warnings.push(...volunteerResults.warnings);

    // 4. Mass templates validation
    const templateResults = VALIDATE_templates();
    results.errors.push(...templateResults.errors);
    results.warnings.push(...templateResults.warnings);

    // 5. Mass configuration validation
    const massResults = VALIDATE_masses();
    results.errors.push(...massResults.errors);
    results.warnings.push(...massResults.warnings);

    // 6. Cross-sheet consistency validation
    const consistencyResults = VALIDATE_consistency();
    results.errors.push(...consistencyResults.errors);
    results.warnings.push(...consistencyResults.warnings);

    // 7. Liturgical notes validation
    const notesResults = VALIDATE_liturgicalNotes();
    results.errors.push(...notesResults.errors);
    results.warnings.push(...notesResults.warnings);

    // Determine overall validity
    results.isValid = results.errors.length === 0;

  } catch (e) {
    results.errors.push(`Validation system error: ${e.message}`);
    results.isValid = false;
  }

  return results;
}

/**
 * Validates the Config sheet
 * @returns {object} Validation results
 */
function VALIDATE_config() {
  const results = { errors: [], warnings: [] };

  try {
    const config = HELPER_readConfig();

    // Required: Year to Schedule
    if (!config["Year to Schedule"]) {
      results.errors.push("Config: 'Year to Schedule' is required");
    } else {
      const year = config["Year to Schedule"];
      if (year < 2020 || year > 2050) {
        results.errors.push(`Config: Year ${year} is out of valid range (2020-2050)`);
      }
    }

    // Recommended: Parish Name
    if (!config["Parish Name"] || config["Parish Name"].trim() === "") {
      results.warnings.push("Config: 'Parish Name' is not set (recommended for print schedules)");
    } else if (config["Parish Name"].length > 100) {
      results.warnings.push("Config: 'Parish Name' is very long (over 100 characters)");
    }

    // Recommended: Calendar Region
    const validRegions = ["General Roman Calendar", "USA", "Canada", "Mexico", "Diocese of Sacramento"];
    if (!config["Calendar Region"]) {
      results.warnings.push("Config: 'Calendar Region' not set (defaulting to General Roman Calendar)");
    } else if (!validRegions.includes(config["Calendar Region"])) {
      results.warnings.push(`Config: '${config["Calendar Region"]}' is not a standard region. Valid: ${validRegions.join(', ')}`);
    }

  } catch (e) {
    results.errors.push(`Config sheet error: ${e.message}`);
  }

  return results;
}

/**
 * Validates the Ministries sheet (master reference for all ministry roles)
 * @returns {object} Validation results
 */
function VALIDATE_ministries() {
  const results = { errors: [], warnings: [] };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ministriesSheet = ss.getSheetByName(CONSTANTS.SHEETS.MINISTRIES);

    // Check if sheet exists
    if (!ministriesSheet) {
      results.errors.push("Ministries: Sheet does not exist. Please create the Ministries sheet.");
      return results;
    }

    // Check if there's data
    if (ministriesSheet.getLastRow() <= 1) {
      results.warnings.push("Ministries: Sheet exists but has no data. Add ministry roles to enable validation.");
      return results;
    }

    const ministryData = HELPER_readSheetData(CONSTANTS.SHEETS.MINISTRIES);
    const cols = CONSTANTS.COLS.MINISTRIES;

    const ministryRoleCombos = new Set();
    let rowNum = 1; // Start at 1 (header is row 1, data starts at row 2)

    for (const row of ministryData) {
      rowNum++;
      const ministryName = HELPER_safeArrayAccess(row, cols.MINISTRY_NAME - 1);
      const roleName = HELPER_safeArrayAccess(row, cols.ROLE_NAME - 1);
      const isActive = HELPER_safeArrayAccess(row, cols.IS_ACTIVE - 1);

      // Check required fields
      if (!ministryName || String(ministryName).trim() === "") {
        results.errors.push(`Ministries row ${rowNum}: Ministry Name is required`);
      }

      if (!roleName || String(roleName).trim() === "") {
        results.errors.push(`Ministries row ${rowNum}: Role Name is required`);
      }

      // Check for duplicates (case-insensitive)
      if (ministryName && roleName) {
        const comboKey = `${String(ministryName).toLowerCase()}|${String(roleName).toLowerCase()}`;
        if (ministryRoleCombos.has(comboKey)) {
          results.errors.push(`Ministries row ${rowNum}: Duplicate ministry-role combination '${ministryName} | ${roleName}'`);
        } else {
          ministryRoleCombos.add(comboKey);
        }
      }

      // Validate Is Active field (should be TRUE/FALSE or checkbox)
      if (isActive !== "" && isActive !== true && isActive !== false && isActive !== "TRUE" && isActive !== "FALSE") {
        results.warnings.push(`Ministries row ${rowNum}: Is Active should be TRUE/FALSE (found: '${isActive}')`);
      }
    }

    // Success message
    if (results.errors.length === 0 && results.warnings.length === 0) {
      Logger.log(`Ministries validation passed: ${ministryRoleCombos.size} unique ministry-role combinations found`);
    }

  } catch (e) {
    results.errors.push(`Ministries sheet error: ${e.message}`);
  }

  return results;
}

/**
 * Validates the Volunteers sheet
 * @returns {object} Validation results
 */
function VALIDATE_volunteers() {
  const results = { errors: [], warnings: [] };

  try {
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const cols = CONSTANTS.COLS.VOLUNTEERS;

    const volunteerIds = new Set();
    const emails = new Set();

    for (let i = 0; i < volunteerData.length; i++) {
      const row = volunteerData[i];
      const rowNum = i + 2; // +2 for 1-based indexing and header

      // Volunteer ID: Required and unique
      const volunteerId = HELPER_safeArrayAccess(row, cols.VOLUNTEER_ID - 1);
      if (!volunteerId) {
        results.errors.push(`Volunteers row ${rowNum}: Volunteer ID is required`);
      } else {
        if (volunteerIds.has(volunteerId)) {
          results.errors.push(`Volunteers row ${rowNum}: Duplicate Volunteer ID '${volunteerId}'`);
        }
        volunteerIds.add(volunteerId);
      }

      // Full Name: Required
      const fullName = HELPER_safeArrayAccess(row, cols.FULL_NAME - 1);
      if (!fullName || fullName.trim() === "") {
        results.errors.push(`Volunteers row ${rowNum}: Full Name is required`);
      }

      // Email: Valid format
      const email = HELPER_safeArrayAccess(row, cols.EMAIL - 1);
      if (email && email.trim() !== "") {
        if (!isValidEmail(email)) {
          results.errors.push(`Volunteers row ${rowNum}: Invalid email format '${email}'`);
        } else {
          if (emails.has(email.toLowerCase())) {
            results.warnings.push(`Volunteers row ${rowNum}: Duplicate email '${email}'`);
          }
          emails.add(email.toLowerCase());
        }
      }

      // Status: Must be valid value
      const status = HELPER_safeArrayAccess(row, cols.STATUS - 1);
      const validStatuses = CONSTANTS.STATUS.VOLUNTEER;
      if (status && !validStatuses.includes(status)) {
        results.errors.push(`Volunteers row ${rowNum}: Invalid status '${status}'. Must be: ${validStatuses.join(', ')}`);
      }

      // Ministries: Required for active volunteers
      const ministries = HELPER_safeArrayAccess(row, cols.MINISTRIES - 1);
      if (status === 'Active' && (!ministries || ministries.trim() === "")) {
        results.warnings.push(`Volunteers row ${rowNum}: Active volunteer '${fullName}' has no ministry roles`);
      }

      // Date Cleared: Valid date
      const dateCleared = HELPER_safeArrayAccess(row, cols.DATE_CLEARED - 1);
      if (dateCleared && dateCleared !== "") {
        const clearedDate = new Date(dateCleared);
        if (isNaN(clearedDate.getTime())) {
          results.errors.push(`Volunteers row ${rowNum}: Invalid Date Cleared`);
        } else if (clearedDate > new Date()) {
          results.warnings.push(`Volunteers row ${rowNum}: Date Cleared is in the future`);
        }
      }

      // Date Trained: Valid date and after Date Cleared
      const dateTrained = HELPER_safeArrayAccess(row, cols.DATE_TRAINED - 1);
      if (dateTrained && dateTrained !== "") {
        const trainedDate = new Date(dateTrained);
        if (isNaN(trainedDate.getTime())) {
          results.errors.push(`Volunteers row ${rowNum}: Invalid Date Trained`);
        } else if (dateCleared) {
          const clearedDate = new Date(dateCleared);
          if (!isNaN(clearedDate.getTime()) && trainedDate < clearedDate) {
            results.warnings.push(`Volunteers row ${rowNum}: Date Trained is before Date Cleared`);
          }
        }
      }
    }

    // Summary check
    if (volunteerIds.size === 0) {
      results.warnings.push("Volunteers: No volunteers found in sheet");
    } else {
      const activeCount = volunteerData.filter(row =>
        HELPER_safeArrayAccess(row, cols.STATUS - 1) === 'Active'
      ).length;

      if (activeCount === 0) {
        results.warnings.push("Volunteers: No active volunteers found");
      } else if (activeCount < 5) {
        results.warnings.push(`Volunteers: Only ${activeCount} active volunteers (consider adding more)`);
      }
    }

  } catch (e) {
    results.errors.push(`Volunteers sheet error: ${e.message}`);
  }

  return results;
}

/**
 * Validates the MassTemplates sheet
 * @returns {object} Validation results
 */
function VALIDATE_templates() {
  const results = { errors: [], warnings: [] };

  try {
    const templateData = HELPER_readSheetData(CONSTANTS.SHEETS.TEMPLATES);
    const cols = CONSTANTS.COLS.TEMPLATES;

    const templates = new Set();

    for (let i = 0; i < templateData.length; i++) {
      const row = templateData[i];
      const rowNum = i + 2;

      const templateName = HELPER_safeArrayAccess(row, cols.TEMPLATE_NAME - 1);
      const rolesRaw = HELPER_safeArrayAccess(row, cols.ROLES - 1);

      // Template Name: Required
      if (!templateName || String(templateName).trim() === "") {
        results.errors.push(`Templates row ${rowNum}: Template Name is required`);
        continue;
      }

      // Roles: Required
      if (!rolesRaw || String(rolesRaw).trim() === "") {
        results.errors.push(`Templates row ${rowNum}: Roles are required for template '${templateName}'`);
        continue;
      }

      // Parse roles to ensure valid format
      const roles = String(rolesRaw)
        .split(',')
        .map(r => r.trim())
        .filter(r => r !== '');

      if (roles.length === 0) {
        results.errors.push(`Templates row ${rowNum}: Template '${templateName}' has no valid roles (check for empty commas)`);
        continue;
      }

      // Track templates
      templates.add(templateName);
    }

    if (templates.size === 0) {
      results.errors.push("Templates: No mass templates defined");
    }

  } catch (e) {
    results.errors.push(`Templates sheet error: ${e.message}`);
  }

  return results;
}

/**
 * Validates all Mass configuration sheets (Weekly, Monthly, Yearly)
 * @returns {object} Validation results
 */
function VALIDATE_masses() {
  const results = { errors: [], warnings: [] };

  try {
    // Get all templates for validation
    const templateData = HELPER_readSheetData(CONSTANTS.SHEETS.TEMPLATES);
    const templateCols = CONSTANTS.COLS.TEMPLATES;
    const validTemplates = new Set();

    for (const row of templateData) {
      const templateName = HELPER_safeArrayAccess(row, templateCols.TEMPLATE_NAME - 1);
      if (templateName) validTemplates.add(templateName);
    }

    // Validate WeeklyMasses
    const weeklyResults = validateWeeklyMasses(validTemplates);
    results.errors.push(...weeklyResults.errors);
    results.warnings.push(...weeklyResults.warnings);

    // Validate MonthlyMasses
    const monthlyResults = validateMonthlyMasses(validTemplates);
    results.errors.push(...monthlyResults.errors);
    results.warnings.push(...monthlyResults.warnings);

    // Validate YearlyMasses
    const yearlyResults = validateYearlyMasses(validTemplates);
    results.errors.push(...yearlyResults.errors);
    results.warnings.push(...yearlyResults.warnings);

  } catch (e) {
    results.errors.push(`Mass configuration error: ${e.message}`);
  }

  return results;
}

/**
 * Helper: Validates WeeklyMasses sheet
 */
function validateWeeklyMasses(validTemplates) {
  const results = { errors: [], warnings: [] };

  try {
    const weeklyData = HELPER_readSheetData(CONSTANTS.SHEETS.WEEKLY_MASSES);
    const cols = CONSTANTS.COLS.WEEKLY_MASSES;

    const eventIds = new Set();
    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < weeklyData.length; i++) {
      const row = weeklyData[i];
      const rowNum = i + 2;

      const eventId = HELPER_safeArrayAccess(row, cols.EVENT_ID - 1);
      const dayOfWeek = HELPER_safeArrayAccess(row, cols.DAY_OF_WEEK - 1);
      const time = HELPER_safeArrayAccess(row, cols.TIME - 1);
      const templateName = HELPER_safeArrayAccess(row, cols.TEMPLATE_NAME - 1);

      // Event ID: Required and unique
      if (!eventId) {
        results.errors.push(`WeeklyMasses row ${rowNum}: Event ID is required`);
      } else {
        if (eventIds.has(eventId)) {
          results.errors.push(`WeeklyMasses row ${rowNum}: Duplicate Event ID '${eventId}'`);
        }
        eventIds.add(eventId);
      }

      // Day of Week: Valid value
      if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
        results.errors.push(`WeeklyMasses row ${rowNum}: Invalid Day of Week '${dayOfWeek}'. Must be: ${validDays.join(', ')}`);
      }

      // Time: Required
      if (!time) {
        results.errors.push(`WeeklyMasses row ${rowNum}: Time is required`);
      }

      // Template Name: Must exist
      if (!templateName) {
        results.errors.push(`WeeklyMasses row ${rowNum}: Template Name is required`);
      } else if (!validTemplates.has(templateName)) {
        results.errors.push(`WeeklyMasses row ${rowNum}: Template '${templateName}' does not exist in MassTemplates`);
      }
    }

    if (weeklyData.length === 0) {
      results.warnings.push("WeeklyMasses: No weekly masses defined");
    }

  } catch (e) {
    results.errors.push(`WeeklyMasses error: ${e.message}`);
  }

  return results;
}

/**
 * Helper: Validates MonthlyMasses sheet
 */
function validateMonthlyMasses(validTemplates) {
  const results = { errors: [], warnings: [] };

  try {
    const monthlyData = HELPER_readSheetData(CONSTANTS.SHEETS.MONTHLY_MASSES);
    const cols = CONSTANTS.COLS.MONTHLY_MASSES;

    const eventIds = new Set();
    const validWeeks = ['1st', '2nd', '3rd', '4th', '5th', 'Last'];
    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const validOverrides = ['', 'overrideday', 'append'];

    for (let i = 0; i < monthlyData.length; i++) {
      const row = monthlyData[i];
      const rowNum = i + 2;

      const eventId = HELPER_safeArrayAccess(row, cols.EVENT_ID - 1);
      const weekOfMonth = HELPER_safeArrayAccess(row, cols.WEEK_OF_MONTH - 1, '').toString();
      const dayOfWeek = HELPER_safeArrayAccess(row, cols.DAY_OF_WEEK - 1);
      const templateName = HELPER_safeArrayAccess(row, cols.TEMPLATE_NAME - 1);
      const overrideType = HELPER_safeArrayAccess(row, cols.OVERRIDE_TYPE - 1, '').toLowerCase();

      // Event ID: Required and unique
      if (!eventId) {
        results.errors.push(`MonthlyMasses row ${rowNum}: Event ID is required`);
      } else {
        if (eventIds.has(eventId)) {
          results.errors.push(`MonthlyMasses row ${rowNum}: Duplicate Event ID '${eventId}'`);
        }
        eventIds.add(eventId);
      }

      // Week of Month: Valid value
      if (!weekOfMonth || !validWeeks.includes(weekOfMonth)) {
        results.errors.push(`MonthlyMasses row ${rowNum}: Invalid Week of Month '${weekOfMonth}'. Must be: ${validWeeks.join(', ')}`);
      }

      // Day of Week: Valid value
      if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
        results.errors.push(`MonthlyMasses row ${rowNum}: Invalid Day of Week '${dayOfWeek}'`);
      }

      // Template Name: Must exist
      if (!templateName) {
        results.errors.push(`MonthlyMasses row ${rowNum}: Template Name is required`);
      } else if (!validTemplates.has(templateName)) {
        results.errors.push(`MonthlyMasses row ${rowNum}: Template '${templateName}' does not exist`);
      }

      // Override Type: Valid value
      if (!validOverrides.includes(overrideType)) {
        results.errors.push(`MonthlyMasses row ${rowNum}: Invalid Override Type '${overrideType}'. Must be: ${validOverrides.join(', ')}`);
      }
    }

  } catch (e) {
    results.errors.push(`MonthlyMasses error: ${e.message}`);
  }

  return results;
}

/**
 * Helper: Validates YearlyMasses sheet
 */
function validateYearlyMasses(validTemplates) {
  const results = { errors: [], warnings: [] };

  try {
    const yearlyData = HELPER_readSheetData(CONSTANTS.SHEETS.YEARLY_MASSES);
    const cols = CONSTANTS.COLS.YEARLY_MASSES;

    const eventIds = new Set();
    const validOverrides = ['', 'override', 'append'];

    for (let i = 0; i < yearlyData.length; i++) {
      const row = yearlyData[i];
      const rowNum = i + 2;

      const eventId = HELPER_safeArrayAccess(row, cols.EVENT_ID - 1);
      const date = HELPER_safeArrayAccess(row, cols.DATE - 1);
      const liturgicalCelebration = HELPER_safeArrayAccess(row, cols.LITURGICAL_CELEBRATION - 1);
      const templateName = HELPER_safeArrayAccess(row, cols.TEMPLATE_NAME - 1);
      const overrideType = HELPER_safeArrayAccess(row, cols.OVERRIDE_TYPE - 1, '').toLowerCase();

      // Event ID: Required and unique
      if (!eventId) {
        results.errors.push(`YearlyMasses row ${rowNum}: Event ID is required`);
      } else {
        if (eventIds.has(eventId)) {
          results.errors.push(`YearlyMasses row ${rowNum}: Duplicate Event ID '${eventId}'`);
        }
        eventIds.add(eventId);
      }

      // Either Date OR Liturgical Celebration required
      if (!date && !liturgicalCelebration) {
        results.errors.push(`YearlyMasses row ${rowNum}: Either Date or Liturgical Celebration is required`);
      }

      // If date provided, validate it
      if (date && date !== "") {
        const testDate = new Date(date);
        if (isNaN(testDate.getTime())) {
          results.errors.push(`YearlyMasses row ${rowNum}: Invalid Date format`);
        }
      }

      // Template Name: Must exist
      if (!templateName) {
        results.errors.push(`YearlyMasses row ${rowNum}: Template Name is required`);
      } else if (!validTemplates.has(templateName)) {
        results.errors.push(`YearlyMasses row ${rowNum}: Template '${templateName}' does not exist`);
      }

      // Override Type: Valid value
      if (!validOverrides.includes(overrideType)) {
        results.errors.push(`YearlyMasses row ${rowNum}: Invalid Override Type '${overrideType}'. Must be: ${validOverrides.join(', ')}`);
      }
    }

  } catch (e) {
    results.errors.push(`YearlyMasses error: ${e.message}`);
  }

  return results;
}

/**
 * Validates cross-sheet consistency
 * @returns {object} Validation results
 */
function VALIDATE_consistency() {
  const results = { errors: [], warnings: [] };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check if Assignments reference valid Event IDs
    const assignmentsSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);
    if (assignmentsSheet && assignmentsSheet.getLastRow() > 1) {
      // Get all valid Event IDs from mass sheets
      const validEventIds = getAllValidEventIds();

      const assignData = HELPER_readSheetData(CONSTANTS.SHEETS.ASSIGNMENTS);
      const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

      for (let i = 0; i < Math.min(assignData.length, 10); i++) { // Check first 10 rows
        const row = assignData[i];
        const eventId = HELPER_safeArrayAccess(row, assignCols.EVENT_ID - 1);

        if (eventId && eventId !== "" && !validEventIds.has(eventId)) {
          results.warnings.push(`Assignments: Event ID '${eventId}' not found in mass sheets (row ${i + 2})`);
          break; // Only report once
        }
      }
    }

    // Check if Timeoffs reference valid volunteers
    const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
    if (timeoffsSheet && timeoffsSheet.getLastRow() > 1) {
      const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
      const volCols = CONSTANTS.COLS.VOLUNTEERS;
      const validVolunteerNames = new Set();

      for (const row of volunteerData) {
        const name = HELPER_safeArrayAccess(row, volCols.FULL_NAME - 1);
        if (name) validVolunteerNames.add(name.toLowerCase());
      }

      const timeoffData = HELPER_readSheetData(CONSTANTS.SHEETS.TIMEOFFS);
      const timeoffCols = CONSTANTS.COLS.TIMEOFFS;

      for (let i = 0; i < Math.min(timeoffData.length, 10); i++) {
        const row = timeoffData[i];
        const volunteerName = HELPER_safeArrayAccess(row, timeoffCols.VOLUNTEER_NAME - 1);

        if (volunteerName && !validVolunteerNames.has(volunteerName.toLowerCase())) {
          results.warnings.push(`Timeoffs: Volunteer '${volunteerName}' not found in Volunteers sheet (row ${i + 2})`);
        }
      }
    }

    // Check if MassTemplates reference valid Ministries
    const ministriesSheet = ss.getSheetByName(CONSTANTS.SHEETS.MINISTRIES);
    const templatesSheet = ss.getSheetByName(CONSTANTS.SHEETS.TEMPLATES);

    if (ministriesSheet && ministriesSheet.getLastRow() > 1 && templatesSheet && templatesSheet.getLastRow() > 1) {
      // Build set of valid role names from Ministries sheet
      const ministryData = HELPER_readSheetData(CONSTANTS.SHEETS.MINISTRIES);
      const minCols = CONSTANTS.COLS.MINISTRIES;
      const validRoles = new Set();

      for (const row of ministryData) {
        const roleName = HELPER_safeArrayAccess(row, minCols.ROLE_NAME - 1);
        const isActive = HELPER_safeArrayAccess(row, minCols.IS_ACTIVE - 1, true);

        if (roleName && isActive) {
          validRoles.add(String(roleName).toLowerCase());
        }
      }

      // Check MassTemplates references (comma-separated roles)
      const templateData = HELPER_readSheetData(CONSTANTS.SHEETS.TEMPLATES);
      const tempCols = CONSTANTS.COLS.TEMPLATES;
      const invalidRefs = new Set(); // Track unique invalid references

      for (let i = 0; i < templateData.length; i++) {
        const row = templateData[i];
        const templateName = HELPER_safeArrayAccess(row, tempCols.TEMPLATE_NAME - 1);
        const rolesRaw = HELPER_safeArrayAccess(row, tempCols.ROLES - 1);

        if (rolesRaw) {
          // Parse comma-separated roles
          const roles = String(rolesRaw)
            .split(',')
            .map(r => r.trim())
            .filter(r => r !== '');

          // Check each role exists in Ministries
          for (const role of roles) {
            const roleLower = role.toLowerCase();
            if (!validRoles.has(roleLower)) {
              if (!invalidRefs.has(roleLower)) {
                results.errors.push(`MassTemplates: Role '${role}' in template '${templateName}' not found in Ministries sheet (row ${i + 2})`);
                invalidRefs.add(roleLower);
              }
            }
          }
        }
      }
    }

    // Check if Volunteers reference valid Ministries
    const volunteersSheet = ss.getSheetByName(CONSTANTS.SHEETS.VOLUNTEERS);

    if (ministriesSheet && ministriesSheet.getLastRow() > 1 && volunteersSheet && volunteersSheet.getLastRow() > 1) {
      // Build sets of valid ministries and roles from Ministries sheet
      const ministryData = HELPER_readSheetData(CONSTANTS.SHEETS.MINISTRIES);
      const minCols = CONSTANTS.COLS.MINISTRIES;
      const validMinistries = new Set();
      const validRoles = new Set();

      for (const row of ministryData) {
        const ministryName = HELPER_safeArrayAccess(row, minCols.MINISTRY_NAME - 1);
        const roleName = HELPER_safeArrayAccess(row, minCols.ROLE_NAME - 1);
        const isActive = HELPER_safeArrayAccess(row, minCols.IS_ACTIVE - 1, true);

        if (ministryName && isActive) {
          validMinistries.add(String(ministryName).toLowerCase());
        }
        if (roleName && isActive) {
          validRoles.add(String(roleName).toLowerCase());
        }
      }

      // Check first 10 volunteers for invalid ministry/role references
      const volData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
      const volCols = CONSTANTS.COLS.VOLUNTEERS;

      for (let i = 0; i < Math.min(volData.length, 10); i++) {
        const row = volData[i];
        const volunteerName = HELPER_safeArrayAccess(row, volCols.FULL_NAME - 1);
        const ministriesRaw = HELPER_safeArrayAccess(row, volCols.MINISTRIES - 1);
        const rolesRaw = HELPER_safeArrayAccess(row, volCols.ROLES - 1);

        // Check ministries
        if (ministriesRaw) {
          const ministries = String(ministriesRaw).split(',').map(m => m.trim().toLowerCase()).filter(m => m !== '');
          for (const ministry of ministries) {
            if (!validMinistries.has(ministry)) {
              results.warnings.push(`Volunteers: '${volunteerName}' has ministry '${ministry}' not found in Ministries sheet (row ${i + 2})`);
            }
          }
        }

        // Check roles
        if (rolesRaw) {
          const roles = String(rolesRaw).split(',').map(r => r.trim().toLowerCase()).filter(r => r !== '');
          for (const role of roles) {
            if (!validRoles.has(role)) {
              results.warnings.push(`Volunteers: '${volunteerName}' has role '${role}' not found in Ministries sheet (row ${i + 2})`);
            }
          }
        }
      }
    }

  } catch (e) {
    results.errors.push(`Consistency validation error: ${e.message}`);
  }

  return results;
}

/**
 * Validates LiturgicalNotes sheet
 * @returns {object} Validation results
 */
function VALIDATE_liturgicalNotes() {
  const results = { errors: [], warnings: [] };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const notesSheet = ss.getSheetByName(CONSTANTS.SHEETS.LITURGICAL_NOTES);

    // If sheet doesn't exist, that's okay - it's optional
    if (!notesSheet) {
      Logger.log('LiturgicalNotes sheet does not exist - skipping validation');
      return results;
    }

    // Check if there's data
    if (notesSheet.getLastRow() <= 1) {
      results.warnings.push('LiturgicalNotes: Sheet exists but has no data (this is optional)');
      return results;
    }

    // Get all liturgical celebrations from the calendar
    const calendarSheet = ss.getSheetByName(CONSTANTS.SHEETS.CALENDAR);
    const validCelebrations = new Set();

    if (calendarSheet && calendarSheet.getLastRow() > 1) {
      const calendarData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
      const calCols = CONSTANTS.COLS.CALENDAR;

      for (const row of calendarData) {
        const celebration = HELPER_safeArrayAccess(row, calCols.LITURGICAL_CELEBRATION - 1);
        if (celebration) validCelebrations.add(celebration);
      }
    }

    // Validate liturgical notes entries
    const notesData = notesSheet.getDataRange().getValues();
    const notesCols = CONSTANTS.COLS.LITURGICAL_NOTES;

    // Skip header row
    for (let i = 1; i < notesData.length; i++) {
      const row = notesData[i];
      const rowNum = i + 1; // +1 for 1-based indexing

      const celebration = HELPER_safeArrayAccess(row, notesCols.CELEBRATION - 1);
      const notes = HELPER_safeArrayAccess(row, notesCols.NOTES - 1);

      // Celebration name required
      if (!celebration || celebration.trim() === "") {
        results.errors.push(`LiturgicalNotes row ${rowNum}: Liturgical Celebration is required`);
        continue;
      }

      // Notes required (otherwise why have the entry?)
      if (!notes || notes.trim() === "") {
        results.warnings.push(`LiturgicalNotes row ${rowNum}: Notes are empty for '${celebration}'`);
      }

      // Check if celebration exists in calendar (if calendar has been generated)
      if (validCelebrations.size > 0 && !validCelebrations.has(celebration)) {
        results.warnings.push(`LiturgicalNotes row ${rowNum}: Celebration '${celebration}' not found in current liturgical calendar. Notes will not display unless calendar is regenerated or name matches exactly.`);
      }
    }

  } catch (e) {
    results.errors.push(`LiturgicalNotes validation error: ${e.message}`);
  }

  return results;
}

/**
 * Helper: Get all valid Event IDs from mass sheets
 */
function getAllValidEventIds() {
  const eventIds = new Set();

  try {
    // Weekly Masses
    const weeklyData = HELPER_readSheetData(CONSTANTS.SHEETS.WEEKLY_MASSES);
    const weeklyCols = CONSTANTS.COLS.WEEKLY_MASSES;
    for (const row of weeklyData) {
      const eventId = HELPER_safeArrayAccess(row, weeklyCols.EVENT_ID - 1);
      if (eventId) eventIds.add(eventId);
    }

    // Monthly Masses
    const monthlyData = HELPER_readSheetData(CONSTANTS.SHEETS.MONTHLY_MASSES);
    const monthlyCols = CONSTANTS.COLS.MONTHLY_MASSES;
    for (const row of monthlyData) {
      const eventId = HELPER_safeArrayAccess(row, monthlyCols.EVENT_ID - 1);
      if (eventId) eventIds.add(eventId);
    }

    // Yearly Masses
    const yearlyData = HELPER_readSheetData(CONSTANTS.SHEETS.YEARLY_MASSES);
    const yearlyCols = CONSTANTS.COLS.YEARLY_MASSES;
    for (const row of yearlyData) {
      const eventId = HELPER_safeArrayAccess(row, yearlyCols.EVENT_ID - 1);
      if (eventId) eventIds.add(eventId);
    }
  } catch (e) {
    Logger.log(`Error getting event IDs: ${e.message}`);
  }

  return eventIds;
}

/**
 * Helper: Validates email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Formats validation results for display
 * @param {object} results Validation results
 * @returns {string} Formatted message
 */
function VALIDATE_formatResults(results) {
  let message = "=== DATA VALIDATION RESULTS ===\n\n";

  if (results.isValid && results.warnings.length === 0) {
    message += "✓ All validation checks passed!\n";
    message += "Your data is ready for scheduling.";
    return message;
  }

  if (results.errors.length > 0) {
    message += `❌ ERRORS (${results.errors.length}):\n`;
    message += "(Must be fixed before scheduling)\n\n";
    results.errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`;
    });
    message += "\n";
  }

  if (results.warnings.length > 0) {
    message += `⚠️  WARNINGS (${results.warnings.length}):\n`;
    message += "(Recommended to fix, but not required)\n\n";
    results.warnings.forEach((warning, index) => {
      message += `${index + 1}. ${warning}\n`;
    });
  }

  if (results.errors.length > 0) {
    message += "\n\n⚠️  Please fix all errors before proceeding with schedule generation.";
  } else {
    message += "\n\n✓ No critical errors found. You may proceed with scheduling.";
  }

  return message;
}

/**
 * User-facing validation function (called from menu/sidebar)
 * @returns {string} User-friendly validation message
 */
function runDataValidation() {
  try {
    Logger.log("Starting data validation...");
    const results = VALIDATE_all();
    const formattedMessage = VALIDATE_formatResults(results);

    Logger.log("Validation complete:");
    Logger.log(`- Errors: ${results.errors.length}`);
    Logger.log(`- Warnings: ${results.warnings.length}`);

    return formattedMessage;

  } catch (e) {
    Logger.log(`Validation error: ${e.message}`);
    return `Validation system error: ${e.message}`;
  }
}
