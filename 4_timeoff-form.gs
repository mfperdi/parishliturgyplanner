/**
 * ====================================================================
 * 4. TIMEOFFS MANAGEMENT
 * ====================================================================
 * Functions for validating and managing volunteer timeoff requests.
 */

/**
 * Runs automatically when a form response is submitted.
 * Validates the submission and adds warnings to Review Notes.
 *
 * Expected form structure (4 questions):
 * 1. Volunteer Name (dropdown)
 * 2. Type (dropdown: Not Available | Only Available)
 * 3. Select Dates (checkboxes with dates)
 * 4. Notes (optional text field)
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
  const row = e.range.getRow();
  const cols = CONSTANTS.COLS.TIMEOFFS;

  // Get the submitted data
  const name = sheet.getRange(row, cols.VOLUNTEER_NAME).getValue();
  const type = sheet.getRange(row, cols.TYPE).getValue();
  let selectedDates = sheet.getRange(row, cols.SELECTED_DATES).getValue();

  let warnings = [];

  Logger.log(`Processing form submission for ${name}, Type: ${type}`);

  // Validation 1: Check if volunteer name exists in Volunteers sheet
  try {
    const volunteerData = HELPER_readSheetData(CONSTANTS.SHEETS.VOLUNTEERS);
    const volunteerExists = volunteerData.some(row => row[CONSTANTS.COLS.VOLUNTEERS.FULL_NAME - 1] === name);
    if (!volunteerExists) {
      warnings.push("⚠️ Volunteer name not found in database");
    }
  } catch (error) {
    Logger.log(`Error checking volunteer database: ${error}`);
  }

  // Validation 2: Type-specific validation and date extraction
  switch(type) {
    case CONSTANTS.TIMEOFF_TYPES.ONLY_AVAILABLE:
    case CONSTANTS.TIMEOFF_TYPES.NOT_AVAILABLE:
      // Both types require date checkboxes
      if (!selectedDates || selectedDates.trim() === '') {
        warnings.push("⚠️ No dates selected - please check at least one date");
      } else {
        try {
          // Extract dates from checkbox responses
          // Input: "Saturday 2/7/2026 - 5th Sunday in Ordinary Time (Vigil), Sunday 2/8/2026 - 5th Sunday in Ordinary Time"
          // Output: "2/7/2026 (Vigil), 2/8/2026"
          const extractedDates = HELPER_extractDatesFromCheckboxes(selectedDates);

          if (extractedDates.length > 0) {
            // Reformat to just dates for cleaner storage
            const reformattedDates = extractedDates.join(', ');
            sheet.getRange(row, cols.SELECTED_DATES).setValue(reformattedDates);
            selectedDates = reformattedDates; // Update local variable

            Logger.log(`Extracted ${extractedDates.length} dates from checkbox response: ${reformattedDates}`);
          } else {
            // No dates detected - this shouldn't happen with required checkboxes
            warnings.push("⚠️ Could not parse dates from selection");
          }
        } catch (e) {
          warnings.push(`⚠️ Error parsing dates: ${e.message}`);
          Logger.log(`Error parsing dates: ${e.message}\n${e.stack}`);
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

  Logger.log(`Form submission complete for ${name}. Type: ${type}, Warnings: ${warnings.length}`);
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
        type: row[cols.TYPE - 1],
        selectedDates: row[cols.SELECTED_DATES - 1],
        volunteerNotes: row[cols.VOLUNTEER_NOTES - 1],
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
    const allMasses = SCHEDULE_findMassesForMonth(month, year); // month is already 0-indexed from HELPER_validateMonthString

    // Build liturgical celebration map from the calendar
    const calData = HELPER_readSheetData(CONSTANTS.SHEETS.CALENDAR);
    const calCols = CONSTANTS.COLS.CALENDAR;
    const liturgyMap = new Map(); // Key: dateString (YYYY-MM-DD), Value: liturgical celebration name

    for (const row of calData) {
      const calDate = new Date(row[calCols.DATE - 1]);
      if (isNaN(calDate.getTime())) continue;

      const dateKey = calDate.toISOString().split('T')[0];
      const celebration = row[calCols.LITURGICAL_CELEBRATION - 1];

      if (celebration) {
        liturgyMap.set(dateKey, celebration);
      }
    }

    // Group masses by date
    const dateMap = new Map(); // Key: dateString (e.g., "2026-01-05"), Value: { hasVigil: bool, hasNonVigil: bool, date: Date, liturgy: string }

    for (const mass of allMasses) {
      const dateKey = mass.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const isVigil = mass.isAnticipated === true;

      if (!dateMap.has(dateKey)) {
        // Initialize with regular day's liturgy
        const regularLiturgy = liturgyMap.get(dateKey) || "";

        // For vigil masses, also get next day's liturgy
        const nextDay = new Date(mass.date.getTime() + 24 * 60 * 60 * 1000);
        const nextDayKey = nextDay.toISOString().split('T')[0];
        const vigilLiturgy = liturgyMap.get(nextDayKey) || "";

        dateMap.set(dateKey, {
          date: mass.date,
          hasVigil: false,
          hasNonVigil: false,
          liturgyRegular: regularLiturgy,
          liturgyVigil: vigilLiturgy
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
        // Non-vigil masses (use regular day's liturgy)
        const regularLiturgy = dateInfo.liturgyRegular || "Sunday";
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr} - ${regularLiturgy}`,
          isVigil: false,
          date: date
        });
        // Vigil mass (use next day's liturgy)
        const vigilLiturgy = dateInfo.liturgyVigil || "Sunday";
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr} - ${vigilLiturgy} (Vigil)`,
          isVigil: true,
          date: date
        });
      } else if (dateInfo.hasVigil) {
        // Only vigil mass (use next day's liturgy)
        const vigilLiturgy = dateInfo.liturgyVigil || "Sunday";
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr} - ${vigilLiturgy} (Vigil)`,
          isVigil: true,
          date: date
        });
      } else {
        // Only non-vigil masses (use regular day's liturgy)
        const regularLiturgy = dateInfo.liturgyRegular || "Sunday";
        result.push({
          dateKey: dateKey,
          display: `${dayOfWeek} ${dateStr} - ${regularLiturgy}`,
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

    // Get friendly month name for form title and description
    const monthDate = new Date(monthString + '-01T12:00:00');
    const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Update form title
    form.setTitle(`Ministry Schedule - Timeoff Request for ${monthName}`);

    // Update form description
    const description = `Use this form to submit TEMPORARY availability changes for ${monthName} ministry scheduling.

📅 COMMON EXAMPLES:
✓ Vacation/travel: "I cannot serve March 10-17"
   → Select "I CANNOT Serve" and check those dates

✓ Limited availability: "I can only help March 8 and March 22"
   → Select "I Can ONLY Serve" and check only those 2 dates

✓ Mass time restrictions: "I can only serve evening masses this month"
   → Select type, check dates, and explain in the Additional Details field

❌ PERMANENT CHANGES (contact parish office instead):
• Changing your regular preferred mass time
• Adding/removing ministry roles
• Updating contact information
• Changing volunteer status (inactive, etc.)

Questions? Contact the parish office for assistance.`;

    form.setDescription(description);

    // Update confirmation message
    const confirmationMessage = `✓ Your timeoff request has been submitted!

WHAT HAPPENS NEXT:
1. Parish staff will review your request within 2-3 business days
2. You'll be notified when your request is approved or if we have questions
3. Check your email or the parish bulletin for your final assignments

NEED TO MAKE CHANGES?
If you need to modify or cancel this request, contact the parish office.

Thank you for serving our parish community! 🙏`;

    form.setConfirmationMessage(confirmationMessage);

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
        .setTitle('Your Name')
        .setHelpText('Select your name from the list. If you don\'t see your name, contact the parish office.')
        .setRequired(true);
    } else {
      volunteerQuestion.setTitle('Your Name');
      volunteerQuestion.setHelpText('Select your name from the list. If you don\'t see your name, contact the parish office.');
    }
    volunteerQuestion.setChoiceValues(volunteerNames);

    // 2. Find or create Type dropdown
    let typeQuestion = null;
    for (const item of items) {
      const title = item.getTitle().toLowerCase();
      if (title.includes('type') && item.getType() === FormApp.ItemType.LIST) {
        typeQuestion = item.asListItem();
        break;
      }
    }

    const types = Object.values(CONSTANTS.TIMEOFF_TYPES);
    if (!typeQuestion) {
      typeQuestion = form.addListItem()
        .setTitle('What type of availability change is this?')
        .setHelpText('Choose carefully:\n\n• "I CANNOT serve" = You are unavailable on specific dates\n  Example: Vacation, family event, work conflict, illness\n\n• "I can ONLY serve" = You can ONLY be scheduled for specific dates (not available any other dates this month)\n  Example: "I can only help Feb 8 and Feb 15 - no other Sundays"\n  \n💡 Most requests are "I CANNOT serve"')
        .setRequired(true);
    } else {
      typeQuestion.setTitle('What type of availability change is this?');
      typeQuestion.setHelpText('Choose carefully:\n\n• "I CANNOT serve" = You are unavailable on specific dates\n  Example: Vacation, family event, work conflict, illness\n\n• "I can ONLY serve" = You can ONLY be scheduled for specific dates (not available any other dates this month)\n  Example: "I can only help Feb 8 and Feb 15 - no other Sundays"\n  \n💡 Most requests are "I CANNOT serve"');
    }
    typeQuestion.setChoiceValues(types);

    // 3. Find or create date checkbox question
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
        .setTitle('Select the dates that apply to your request')
        .setHelpText('Check ALL dates that apply:\n\n• For "I CANNOT serve": Check every date you are unavailable\n  (For a vacation week, check each individual date in that week)\n\n• For "I can ONLY serve": Check ONLY the dates you can serve\n  (Do not check dates you\'re unavailable - only check the ones you CAN do)\n\n📝 VIGIL MASSES: Saturday evening vigil masses are listed separately from Sunday masses. If you\'re unavailable for an entire weekend, check both Saturday vigil AND Sunday.\n\n💡 TIP: The liturgical celebration name helps identify special holy days (Ash Wednesday, Easter, Christmas, etc.)')
        .setRequired(true);
    } else {
      dateQuestion.setTitle('Select the dates that apply to your request');
      dateQuestion.setHelpText('Check ALL dates that apply:\n\n• For "I CANNOT serve": Check every date you are unavailable\n  (For a vacation week, check each individual date in that week)\n\n• For "I can ONLY serve": Check ONLY the dates you can serve\n  (Do not check dates you\'re unavailable - only check the ones you CAN do)\n\n📝 VIGIL MASSES: Saturday evening vigil masses are listed separately from Sunday masses. If you\'re unavailable for an entire weekend, check both Saturday vigil AND Sunday.\n\n💡 TIP: The liturgical celebration name helps identify special holy days (Ash Wednesday, Easter, Christmas, etc.)');
    }

    // Update choices
    dateQuestion.setChoiceValues(dateOptions);

    // 4. Find or create Notes question
    let notesQuestion = null;
    for (const item of items) {
      const title = item.getTitle().toLowerCase();
      if ((title.includes('note') || title.includes('detail')) && item.getType() === FormApp.ItemType.PARAGRAPH_TEXT) {
        notesQuestion = item.asParagraphTextItem();
        break;
      }
    }

    if (!notesQuestion) {
      notesQuestion = form.addParagraphTextItem()
        .setTitle('Additional details or restrictions (Optional)')
        .setHelpText('Use this field for:\n\n• Mass time restrictions: "Can only serve evening masses" or "Available only after 6pm"\n• Special circumstances: "Available for lector only, not Eucharistic Minister"\n• Context: "Family wedding" or "Surgery recovery"\n• Questions or clarifications for the scheduler\n\nLeave blank if your request is straightforward.')
        .setRequired(false);
    } else {
      notesQuestion.setTitle('Additional details or restrictions (Optional)');
      notesQuestion.setHelpText('Use this field for:\n\n• Mass time restrictions: "Can only serve evening masses" or "Available only after 6pm"\n• Special circumstances: "Available for lector only, not Eucharistic Minister"\n• Context: "Family wedding" or "Surgery recovery"\n• Questions or clarifications for the scheduler\n\nLeave blank if your request is straightforward.');
    }

    Logger.log(`Updated form with ${volunteerNames.length} volunteers and ${dateOptions.length} date options for ${monthString}`);
    return `✓ Form updated for ${monthName}:\n- ${volunteerNames.length} volunteers\n- ${dateOptions.length} date options`;

  } catch (e) {
    Logger.log(`ERROR in TIMEOFFS_updateFormForMonth: ${e.message}`);
    throw new Error(`Could not update form: ${e.message}`);
  }
}

/**
 * Extract dates from Google Forms checkbox response text.
 * Input: "Saturday 2/7/2026 - 5th Sunday in Ordinary Time (Vigil), Sunday 2/8/2026 - 5th Sunday in Ordinary Time, Wednesday 2/18/2026 - Ash Wednesday"
 * Output: ["2/7/2026 (Vigil)", "2/8/2026", "2/18/2026"]
 * @param {string} text Checkbox response text
 * @returns {Array<string>} Array of date strings with optional (Vigil) marker
 */
function HELPER_extractDatesFromCheckboxes(text) {
  if (!text || typeof text !== 'string') return [];

  const dates = [];

  // Split by comma and clean up each entry
  const parts = text.split(',').map(s => s.trim());

  for (const part of parts) {
    if (!part) continue;

    // Extract date portion
    // NEW Format: "Saturday 2/7/2026 - 5th Sunday in Ordinary Time (Vigil)"
    // OLD Format: "Sunday 1/5/2026" or "Saturday 1/4/2026 (Vigil)"
    const dateMatch = part.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);

    if (dateMatch) {
      const dateStr = dateMatch[1];

      // Check if this entry has (Vigil) marker anywhere in the string
      const isVigil = part.toLowerCase().includes('(vigil)');

      // Append (Vigil) to the date if needed
      if (isVigil) {
        dates.push(dateStr + ' (Vigil)');
      } else {
        dates.push(dateStr);
      }
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
