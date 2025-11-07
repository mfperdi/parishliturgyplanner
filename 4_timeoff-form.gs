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
  
  // Write warnings to Review Notes
  if (warnings.length > 0) {
    sheet.getRange(row, cols.REVIEW_NOTES).setValue(warnings.join("\n"));
  }
  
  // Set status to Pending
  sheet.getRange(row, cols.STATUS).setValue("Pending");
  
  Logger.log(`Form submission processed for ${name}. Warnings: ${warnings.length}`);
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
 * Approves a timeoff request.
 * @param {number} rowNumber The sheet row number (1-based).
 * @returns {string} Success message.
 */
function TIMEOFFS_approveRequest(rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONSTANTS.SHEETS.TIMEOFFS);
  const cols = CONSTANTS.COLS.TIMEOFFS;
  
  // Get volunteer name for logging
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
