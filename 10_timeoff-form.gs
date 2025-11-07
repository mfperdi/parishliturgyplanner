/**
 * Runs automatically when a form response is submitted.
 * Validates the submission and adds warnings to Review Notes.
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Timeoffs_Responses");
  const row = e.range.getRow();
  
  // Get the submitted data (using your actual column positions)
  const name = sheet.getRange(row, 2).getValue();          // Column B
  const email = sheet.getRange(row, 3).getValue();         // Column C
  const type = sheet.getRange(row, 4).getValue();          // Column D
  const startDate = new Date(sheet.getRange(row, 5).getValue()); // Column E
  const endDate = new Date(sheet.getRange(row, 6).getValue());   // Column F
  
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
    const prevName = allData[i][1];        // Column B
    const prevEmail = allData[i][2];       // Column C
    const prevSubmitTime = new Date(allData[i][0]); // Column A
    const prevStart = new Date(allData[i][4]);      // Column E
    const prevEnd = new Date(allData[i][5]);        // Column F
    
    if ((prevName === name || prevEmail === email) && 
        prevSubmitTime > sevenDaysAgo) {
      
      // Check for overlapping dates
      if ((startDate <= prevEnd && endDate >= prevStart)) {
        warnings.push("⚠️ Possible duplicate - overlapping request submitted in last 7 days");
        break;
      }
    }
  }
  
  // Validation 5: Email matches volunteer record (optional - requires lookup)
  // You could add a check here to verify email matches Volunteers sheet
  
  // Write warnings to Review Notes (Column J)
  if (warnings.length > 0) {
    sheet.getRange(row, 10).setValue(warnings.join("\n"));
  }
  
  // Set status to Pending (Column H)
  sheet.getRange(row, 8).setValue("Pending");
  
  Logger.log(`Form submission processed for ${name}. Warnings: ${warnings.length}`);
}
