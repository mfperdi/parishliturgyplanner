/**
 * Runs automatically when a form response is submitted.
 * Adds validation warnings to help with review.
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Timeoffs_Responses");
  const row = e.range.getRow();
  
  // Get the submitted data
  const startDate = new Date(sheet.getRange(row, 6).getValue()); // Column F
  const endDate = new Date(sheet.getRange(row, 7).getValue());   // Column G
  const reviewNotesCol = 14; // Column N
  
  let warnings = [];
  
  // Check 1: End date before start date
  if (endDate < startDate) {
    warnings.push("⚠️ End date is before start date");
  }
  
  // Check 2: Dates in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDate < today) {
    warnings.push("⚠️ Start date is in the past");
  }
  
  // Check 3: Very long period (>60 days)
  const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
  if (daysDiff > 60) {
    warnings.push(`⚠️ Long period: ${Math.round(daysDiff)} days`);
  }
  
  // Check 4: Name mismatch (typed name when dropdown was available)
  const dropdownName = sheet.getRange(row, 3).getValue();    // Column C
  const typedName = sheet.getRange(row, 4).getValue();       // Column D
  if (!dropdownName && typedName) {
    warnings.push("⚠️ Name not found in volunteer list");
  }
  
  // Write warnings to Review Notes column
  if (warnings.length > 0) {
    sheet.getRange(row, reviewNotesCol).setValue(warnings.join("\n"));
  }
  
  // Set status to Pending
  sheet.getRange(row, 11).setValue("Pending"); // Column K
}
```

**To install this trigger:**
1. In Apps Script Editor → Triggers (clock icon)
2. Add Trigger
3. Function: `onFormSubmit`
4. Event source: From spreadsheet
5. Event type: On form submit
6. Save

---

## Form Share Settings

### Public Access (Recommended):
```
🔗 Share Link: [Anyone with the link can respond]
```

**Benefits:**
- Volunteers don't need Google accounts (though email will be collected)
- Easy to share via email, bulletin, etc.
- No permission management

### Restricted Access (More Secure):
```
🔒 Share Link: [Only people in [your domain] can respond]
