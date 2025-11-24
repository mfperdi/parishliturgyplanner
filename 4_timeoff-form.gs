/**
 * ====================================================================
 * 4. TIMEOFFS MANAGEMENT
 * ====================================================================
 * Functions for validating and managing volunteer timeoff requests.
 */

/**
 * Runs automatically when a form response is submitted.
 * Validates the submission and adds warnings to Review Notes.
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
  const row = e.range.getRow();
  const cols = CONSTANTS.COLS.TIMEOFFS;
  
  // Get the submitted data
  const name = sheet.getRange(row, cols.VOLUNTEER_NAME).getValue();
  const email = sheet.getRange(row, cols.EMAIL).getValue();
  const type = sheet.getRange(row, cols.TYPE).getValue();
  const startDate = new Date(sheet.getRange(row, cols.START_DATE).getValue());
  const endDate = new Date(sheet.getRange(row, cols.END_DATE).getValue());
  
  let warnings = [];
  
  // Validation 1: End date before start date
  if (endDate < startDate) {
    warnings.push("⚠️ END DATE IS BEFORE START DATE");
  }
  
  // Validation 2: Dates in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDate < today) {
    warnings.push("⚠️ Start date is in the past");
  }
  
  // Validation 3: Very long period (>90 days)
  const daysDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    warnings.push(`⚠️ Long period: ${daysDiff} days`);
  }
  
  // Validation 4: Check for recent duplicate submissions
  const allData = sheet.getDataRange().getValues();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  for (let i = 1; i < allData.length - 1; i++) { // Skip header and current row
    const prevName = allData[i][cols.VOLUNTEER_NAME - 1];
    const prevEmail = allData[i][cols.EMAIL - 1];
    const prevSubmitTime = new Date(allData[i][cols.TIMESTAMP - 1]);
    const prevStart = new Date(allData[i][cols.START_DATE - 1]);
    const prevEnd = new Date(allData[i][cols.END_DATE - 1]);
    
    if ((prevName === name || prevEmail === email) && 
        prevSubmitTime > sevenDaysAgo) {
      
      // Check for overlapping dates
      if ((startDate <= prevEnd && endDate >= prevStart)) {
        warnings.push("⚠️ Possible duplicate - overlapping request in last 7 days");
        break;
      }
    }
  }
  
  // Validation 5: Check if volunteer name exists in Volunteers sheet
  try {
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const volunteerExists = volunteerData.some(row => row[CONSTANTS.COLS.VOLUNTEERS.FULL_NAME - 1] === name);
    if (!volunteerExists) {
      warnings.push("⚠️ Volunteer name not found in database");
    }
  } catch (error) {
    Logger.log(`Error checking volunteer database: ${error}`);
  }

  // Validation 6: Type-specific validation
  let notes = sheet.getRange(row, cols.NOTES).getValue();

  switch(type) {
    case CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE:
    case CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE:
      // Both types now require date checkboxes
      if (!notes || notes.trim() === '') {
        warnings.push("⚠️ No dates selected - please check at least one date");
      } else {
        try {
          // Extract dates from checkbox responses
          const extractedDates = HELPER_extractDatesFromCheckboxes(notes);

          if (extractedDates.length > 0) {
            // Reformat Notes to just dates for cleaner storage
            const reformattedNotes = extractedDates.join(', ');
            sheet.getRange(row, cols.NOTES).setValue(reformattedNotes);
            notes = reformattedNotes; // Update local variable

            Logger.log(`Extracted ${extractedDates.length} dates from checkbox response`);
          } else {
            // No dates detected - this shouldn't happen with required checkboxes
            warnings.push("⚠️ Could not parse dates from selection");
          }
        } catch (e) {
          warnings.push(`⚠️ Error parsing dates: ${e.message}`);
        }
      }
      break;

    default:
      // Unknown or blank TYPE
      if (!type || type === '') {
        warnings.push("⚠️ TYPE field is blank - will be treated as 'Not Available'");
      } else {
        warnings.push(`⚠️ Unknown TYPE: ${type}`);
      }
      break;
  }

  // Write warnings to Review Notes
  if (warnings.length > 0) {
    sheet.getRange(row, cols.REVIEW_NOTES).setValue(warnings.join("\n"));
  }

  // Set status to Pending
  sheet.getRange(row, cols.STATUS).setValue("Pending");

  Logger.log(`Form submission processed for ${name}. Type: ${type}, Warnings: ${warnings.length}`);
}

/**
 * Gets all pending timeoff requests for review.
 * @returns {Array<object>} Array of pending requests.
 */
function TIMEOFFS_getPendingRequests() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
  const data = sheet.getDataRange().getValues();
  const cols = CONSTANTS.COLS.TIMEOFFS;
  
  const pending = [];
  
  for (let i = 1; i < data.length; i++) { // Skip header
    const row = data[i];
    const status = row[cols.STATUS - 1];
    
    if (status === "Pending") {
      pending.push({
        rowNumber: i + 1,
        timestamp: row[cols.TIMESTAMP - 1],
        name: row[cols.VOLUNTEER_NAME - 1],
        email: row[cols.EMAIL - 1],
        type: row[cols.TYPE - 1],
        startDate: row[cols.START_DATE - 1],
        endDate: row[cols.END_DATE - 1],
        notes: row[cols.NOTES - 1],
        reviewNotes: row[cols.REVIEW_NOTES - 1]
      });
    }
  }
  
  Logger.log(`Found ${pending.length} pending timeoff requests.`);
  return pending;
}

/**
 * Approves a timeoff request
 * @param {number} rowNumber The sheet row number (1-based).
 * @returns {string} Success message.
 */
function TIMEOFFS_approveRequest(rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
  const cols = CONSTANTS.COLS.TIMEOFFS;

  // Get volunteer name
  const name = sheet.getRange(rowNumber, cols.VOLUNTEER_NAME).getValue();

  // Update sheet
  sheet.getRange(rowNumber, cols.STATUS).setValue("Approved");
  sheet.getRange(rowNumber, cols.REVIEWED_DATE).setValue(new Date());

  // Add approval note
  const currentNotes = sheet.getRange(rowNumber, cols.REVIEW_NOTES).getValue();
  const newNotes = currentNotes ? `${currentNotes}\n✅ Approved` : "✅ Approved";
  sheet.getRange(rowNumber, cols.REVIEW_NOTES).setValue(newNotes);

  Logger.log(`Approved timeoff request for ${name} (Row ${rowNumber})`);
  return `Approved request for ${name}`;
}

/**
 * Rejects a timeoff request.
 * @param {number} rowNumber The sheet row number (1-based).
 * @param {string} reason Optional reason for rejection.
 * @returns {string} Success message.
 */
function TIMEOFFS_rejectRequest(rowNumber, reason) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
  const cols = CONSTANTS.COLS.TIMEOFFS;
  
  // Get volunteer name for logging
  const name = sheet.getRange(rowNumber, cols.VOLUNTEER_NAME).getValue();
  
  // Update sheet
  sheet.getRange(rowNumber, cols.STATUS).setValue("Rejected");
  sheet.getRange(rowNumber, cols.REVIEWED_DATE).setValue(new Date());
  
  // Add rejection note with reason
  const currentNotes = sheet.getRange(rowNumber, cols.REVIEW_NOTES).getValue();
  const rejectionNote = reason ? `❌ Rejected: ${reason}` : "❌ Rejected";
  const newNotes = currentNotes ? `${currentNotes}\n${rejectionNote}` : rejectionNote;
  sheet.getRange(rowNumber, cols.REVIEW_NOTES).setValue(newNotes);
  
  Logger.log(`Rejected timeoff request for ${name} (Row ${rowNumber})`);
  return `Rejected request for ${name}`;
}

/**
 * Bulk approves all pending timeoff requests.
 * Use with caution!
 * @returns {string} Success message.
 */
function TIMEOFFS_bulkApprovePending() {
  const pending = TIMEOFFS_getPendingRequests();

  if (pending.length === 0) {
    return "No pending requests to approve.";
  }

  let approved = 0;
  for (const request of pending) {
    // Only approve if there are no critical warnings
    if (!request.reviewNotes || !request.reviewNotes.includes("⚠️")) {
      TIMEOFFS_approveRequest(request.rowNumber);
      approved++;
    }
  }

  Logger.log(`Bulk approved ${approved} of ${pending.length} pending requests.`);
  return `Bulk approved ${approved} requests. ${pending.length - approved} requests need manual review.`;
}

/**
 * Gets all unique dates with masses for a specific month.
 * Groups masses by date and separates vigil masses from non-vigil masses.
 * Used to populate the Google Form with date checkbox options.
 * @param {string} monthString Month in format "2026-01"
 * @returns {Array<object>} Array of date objects with date, display, isVigil
 */
function TIMEOFFS_getDatesForMonth(monthString) {
  try {
    // Validate month string
    const { year, month } = HELPER_validateMonthString(monthString);

    // Get all masses for this month using existing schedule logic
    const allMasses = SCHEDULE_findMassesForMonth(month - 1, year); // month is 0-indexed in the function

    // Group masses by date
    const dateMap = new Map(); // Key: dateString (e.g., "2026-01-05"), Value: { hasVigil: bool, hasNonVigil: bool, date: Date }

    for (const mass of allMasses) {
      const dateKey = mass.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const isVigil = mass.isAnticipated === true;

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: mass.date,
          hasVigil: false,
          hasNonVigil: false
        });
      }

      const dateInfo = dateMap.get(dateKey);
      if (isVigil) {
        dateInfo.hasVigil = true;
      } else {
        dateInfo.hasNonVigil = true;
      }
    }

    // Build checkbox options
    const result = [];

    // Sort dates chronologically
    const sortedDates = Array.from(dateMap.entries()).sort((a, b) => {
      return a[1].date.getTime() - b[1].date.getTime();
    });

    for (const [dateKey, dateInfo] of sortedDates) {
      const date = dateInfo.date;
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' });
      const dateStr = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

      // If both vigil and non-vigil masses exist, create two checkboxes
      if (dateInfo.hasVigil && dateInfo.hasNonVigil) {
        // Non-vigil masses
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr}`,
          isVigil: false,
          date: date
        });
        // Vigil mass
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr} (Vigil)`,
          isVigil: true,
          date: date
        });
      } else if (dateInfo.hasVigil) {
        // Only vigil mass
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr} (Vigil)`,
          isVigil: true,
          date: date
        });
      } else {
        // Only non-vigil masses
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr}`,
          isVigil: false,
          date: date
        });
      }
    }

    Logger.log(`Found ${result.length} date options for ${monthString}`);
    return result;

  } catch (e) {
    Logger.log(`ERROR in TIMEOFFS_getDatesForMonth: ${e.message}`);
    throw new Error(`Could not get dates for month: ${e.message}`);
  }
}

/**
 * Updates the Google Form with date options and volunteer list for a specific month.
 * Run this before timeoff review to ensure form has current month's dates.
 * @param {string} monthString Month in format "2026-01"
 * @returns {string} Success message
 */
function TIMEOFFS_updateFormForMonth(monthString) {
  try {
    // Get the form
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timeoffsSheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);

    if (!timeoffsSheet) {
      throw new Error('Timeoffs sheet not found');
    }

    const formUrl = timeoffsSheet.getFormUrl();

    if (!formUrl) {
      throw new Error('No form linked to Timeoffs sheet. Please create one via Tools > Create a new form');
    }

    // Extract form ID
    const match = formUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Could not extract form ID from URL');
    }

    const formId = match[1];
    const form = FormApp.openById(formId);

    // Get volunteers for dropdown
    const volunteers = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const volunteerNames = volunteers
      .filter(v => v[CONSTANTS.COLS.VOLUNTEERS.STATUS - 1] === 'Active')
      .map(v => v[CONSTANTS.COLS.VOLUNTEERS.FULL_NAME - 1])
      .filter(name => name && name.trim() !== '')
      .sort();

    // Get dates for the month
    const dates = TIMEOFFS_getDatesForMonth(monthString);

    if (dates.length === 0) {
      throw new Error(`No dates found for ${monthString}. Please generate the schedule first.`);
    }

    // Format date options
    const dateOptions = dates.map(d => d.display);

    const items = form.getItems();

    // 1. Update or create Volunteer Name dropdown
    let volunteerQuestion = null;
    for (const item of items) {
      const title = item.getTitle().toLowerCase();
      if (title.includes('volunteer') && title.includes('name') &&
          item.getType() === FormApp.ItemType.LIST) {
        volunteerQuestion = item.asListItem();
        break;
      }
    }

    if (!volunteerQuestion) {
      volunteerQuestion = form.addListItem()
        .setTitle('Volunteer Name')
        .setRequired(true);
    }
    volunteerQuestion.setChoiceValues(volunteerNames);

    // 2. Find or create date checkbox question
    let dateQuestion = null;
    for (const item of items) {
      const title = item.getTitle().toLowerCase();
      if (title.includes('date') && item.getType() === FormApp.ItemType.CHECKBOX) {
        dateQuestion = item.asCheckboxItem();
        break;
      }
    }

    if (!dateQuestion) {
      dateQuestion = form.addCheckboxItem()
        .setTitle('Select Dates')
        .setHelpText('For "Not Available": Check dates you CANNOT serve.\nFor "Only Available": Check dates you CAN serve.')
        .setRequired(true);
    }

    // Update choices
    dateQuestion.setChoiceValues(dateOptions);

    // Get friendly month name
    const monthDate = new Date(monthString + '-01T12:00:00');
    const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    Logger.log(`Updated form with ${volunteerNames.length} volunteers and ${dateOptions.length} date options for ${monthString}`);
    return `✓ Form updated for ${monthName}:\n- ${volunteerNames.length} volunteers\n- ${dateOptions.length} date options`;

  } catch (e) {
    Logger.log(`ERROR in TIMEOFFS_updateFormForMonth: ${e.message}`);
    throw new Error(`Could not update form: ${e.message}`);
  }
}

/**
 * Extract dates from Google Forms checkbox response text.
 * Input: "Sunday 1/5/2026, Saturday 1/11/2026 (Vigil), Sunday 1/12/2026"
 * Output: ["1/5/2026", "1/11/2026 (Vigil)", "1/12/2026"]
 * @param {string} text Checkbox response text
 * @returns {Array<string>} Array of date strings
 */
function HELPER_extractDatesFromCheckboxes(text) {
  if (!text || typeof text !== 'string') return [];

  const dates = [];

  // Split by comma and clean up each entry
  const parts = text.split(',').map(s => s.trim());

  for (const part of parts) {
    if (!part) continue;

    // Extract date portion (after day of week)
    // Format: "Sunday 1/5/2026" or "Saturday 1/4/2026 (Vigil)"
    const match = part.match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s*\(Vigil\))?)/i);

    if (match) {
      dates.push(match[1]);
    }
  }

  return dates;
}

/**
 * Setup dropdown validation for TYPE column in Timeoffs sheet
 * Run this once to add data validation to the TYPE column
 * NOTE: Works with both typed and untyped columns
 * @returns {string} Success message
 */
function TIMEOFFS_setupValidation() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);

    if (!sheet) {
      throw new Error(`Timeoffs sheet '${CONSTANTS.SHEETS.TIMEOFFS}' not found`);
    }

    const types = Object.values(CONSTANTS.TIMEOFF_TYPES);

    // Try to add dropdown validation to TYPE column (entire column, starting from row 2)
    const typeColumn = sheet.getRange(2, CONSTANTS.COLS.TIMEOFFS.TYPE, sheet.getMaxRows() - 1, 1);

    try {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(types, true)  // true = show dropdown
        .setAllowInvalid(false)           // Reject invalid entries
        .setHelpText('Select the type of timeoff request')
        .build();

      typeColumn.setDataValidation(rule);

      Logger.log(`Set TYPE validation with values: ${types.join(', ')}`);
      return `✓ Timeoff TYPE column dropdown validation added successfully\n\nAvailable types:\n- ${types.join('\n- ')}`;

    } catch (validationError) {
      // Column is likely typed - validation is already enforced by column type
      if (validationError.message.includes('typed column')) {
        Logger.log(`TYPE column is already typed - validation not needed`);

        return `✓ TYPE column validation setup complete\n\n` +
               `Note: Your TYPE column is using Google Sheets column types, ` +
               `which already provides dropdown validation.\n\n` +
               `Available types:\n- ${types.join('\n- ')}\n\n` +
               `To ensure the column type includes all values:\n` +
               `1. Click the TYPE column header (column D)\n` +
               `2. Verify the column type dropdown includes:\n` +
               `   - ${types.join('\n   - ')}\n` +
               `3. If types are missing, add them to the column type settings`;
      }

      // Some other error - rethrow
      throw validationError;
    }

  } catch (e) {
    Logger.log(`ERROR in TIMEOFFS_setupValidation: ${e.message}`);

    // Provide helpful error message
    let errorMsg = `Could not setup TYPE validation: ${e.message}\n\n`;

    if (e.message.includes('typed column')) {
      errorMsg += `Your TYPE column uses Google Sheets column types.\n\n` +
                  `Manual setup:\n` +
                  `1. Click the TYPE column header (column D)\n` +
                  `2. Look for the column type dropdown arrow\n` +
                  `3. Ensure it includes these values:\n` +
                  `   - ${Object.values(CONSTANTS.TIMEOFF_TYPES).join('\n   - ')}`;
    } else {
      errorMsg += `Please check the Timeoffs sheet structure and try again.`;
    }

    throw new Error(errorMsg);
  }
}
