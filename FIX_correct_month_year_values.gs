/**
 * Fix Month-Year values for manually added assignments.
 * This corrects assignments that were copied from an old spreadsheet.
 *
 * IMPORTANT: This fixes Month-Year based on the date, using the same logic
 * as the schedule generator.
 */
function FIX_correctMonthYearValues() {
  try {
    Logger.log('=== CORRECTING MONTH-YEAR VALUES ===\n');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!assignSheet) {
      throw new Error('Assignments sheet not found');
    }

    const data = assignSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

    let correctionCount = 0;
    const corrections = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[assignCols.DATE - 1];

      if (!date) continue;

      const dateObj = new Date(date);
      const currentMonthYear = row[assignCols.MONTH_YEAR - 1];

      // Calculate correct Month-Year based on date
      // Use the date's year and month to determine the schedule month
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1; // 0-indexed, so add 1

      // SPECIAL CASE: Early January dates that are part of previous month's liturgical season
      // These should have the PREVIOUS month's Month-Year value
      let correctMonthYear;

      // For dates in early January (day 1-7), check if they should belong to December schedule
      if (month === 1 && dateObj.getDate() <= 7) {
        // Check the liturgical celebration to determine if it's part of Christmas season
        const liturgicalCelebration = row[assignCols.LITURGICAL_CELEBRATION - 1] || '';

        // Christmas season celebrations in early January should use December's Month-Year
        const christmasSeasonCelebrations = [
          'Solemnity of Mary, the Mother of God',
          'The Epiphany of the Lord',
          'The Baptism of the Lord'
        ];

        const isChristmasSeason = christmasSeasonCelebrations.some(c =>
          liturgicalCelebration.includes(c)
        );

        if (isChristmasSeason && dateObj.getDate() <= 1) {
          // Mary Mother of God (1/1) should be in December schedule
          correctMonthYear = `${year - 1}-12`;
        } else {
          // Everything else in early January uses January Month-Year
          correctMonthYear = `${year}-${month.toString().padStart(2, '0')}`;
        }
      } else {
        // Normal case: use the date's month
        correctMonthYear = `${year}-${month.toString().padStart(2, '0')}`;
      }

      // Check if correction needed
      if (currentMonthYear !== correctMonthYear) {
        const dateStr = HELPER_formatDate(dateObj, 'default');
        const role = row[assignCols.ROLE - 1];
        const time = row[assignCols.TIME - 1];
        const timeStr = time instanceof Date ? HELPER_formatTime(time) : time;

        corrections.push({
          row: i + 1,
          date: dateStr,
          time: timeStr,
          role: role,
          oldMonthYear: currentMonthYear,
          newMonthYear: correctMonthYear
        });

        // Update the Month-Year value
        assignSheet.getRange(i + 1, assignCols.MONTH_YEAR).setValue(correctMonthYear);
        correctionCount++;
      }
    }

    // Log corrections
    Logger.log(`Corrections made: ${correctionCount}\n`);

    if (corrections.length > 0) {
      Logger.log('Details:');
      for (const c of corrections) {
        Logger.log(`  Row ${c.row}: ${c.date} ${c.time} ${c.role}`);
        Logger.log(`    Changed: "${c.oldMonthYear}" → "${c.newMonthYear}"`);
      }
    }

    Logger.log('\n=== CORRECTION COMPLETE ===');

    // Show results to user
    if (correctionCount > 0) {
      const message = `Corrected ${correctionCount} Month-Year values.\n\n` +
                      `Check execution logs (View > Executions) for details.\n\n` +
                      `Please regenerate the weekly view to see the changes.`;

      SpreadsheetApp.getUi().alert('Month-Year Correction Complete', message, SpreadsheetApp.getUi().ButtonSet.OK);
      return message;
    } else {
      const message = 'No corrections needed. All Month-Year values are already correct.';
      SpreadsheetApp.getUi().alert('Month-Year Check Complete', message, SpreadsheetApp.getUi().ButtonSet.OK);
      return message;
    }

  } catch (e) {
    Logger.log(`ERROR in FIX_correctMonthYearValues: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
    throw new Error(`Could not correct Month-Year values: ${e.message}`);
  }
}


/**
 * Preview what Month-Year corrections would be made (without making changes).
 * Use this to verify before running the fix.
 */
function FIX_previewMonthYearCorrections() {
  try {
    Logger.log('=== PREVIEW MONTH-YEAR CORRECTIONS ===\n');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignSheet = ss.getSheetByName(CONSTANTS.SHEETS.ASSIGNMENTS);

    if (!assignSheet) {
      throw new Error('Assignments sheet not found');
    }

    const data = assignSheet.getDataRange().getValues();
    const assignCols = CONSTANTS.COLS.ASSIGNMENTS;

    const needsCorrection = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[assignCols.DATE - 1];

      if (!date) continue;

      const dateObj = new Date(date);
      const currentMonthYear = row[assignCols.MONTH_YEAR - 1];

      // Calculate correct Month-Year
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;

      let correctMonthYear;

      if (month === 1 && dateObj.getDate() <= 7) {
        const liturgicalCelebration = row[assignCols.LITURGICAL_CELEBRATION - 1] || '';

        const christmasSeasonCelebrations = [
          'Solemnity of Mary, the Mother of God',
          'The Epiphany of the Lord',
          'The Baptism of the Lord'
        ];

        const isChristmasSeason = christmasSeasonCelebrations.some(c =>
          liturgicalCelebration.includes(c)
        );

        if (isChristmasSeason && dateObj.getDate() <= 1) {
          correctMonthYear = `${year - 1}-12`;
        } else {
          correctMonthYear = `${year}-${month.toString().padStart(2, '0')}`;
        }
      } else {
        correctMonthYear = `${year}-${month.toString().padStart(2, '0')}`;
      }

      if (currentMonthYear !== correctMonthYear) {
        const dateStr = HELPER_formatDate(dateObj, 'default');
        const role = row[assignCols.ROLE - 1];
        const liturgy = row[assignCols.LITURGICAL_CELEBRATION - 1];

        needsCorrection.push({
          row: i + 1,
          date: dateStr,
          role: role,
          liturgy: liturgy,
          current: currentMonthYear,
          correct: correctMonthYear
        });
      }
    }

    Logger.log(`Assignments needing correction: ${needsCorrection.length}\n`);

    if (needsCorrection.length > 0) {
      Logger.log('Preview of changes:');
      for (const item of needsCorrection) {
        Logger.log(`  Row ${item.row}: ${item.date} ${item.role}`);
        Logger.log(`    Liturgy: ${item.liturgy}`);
        Logger.log(`    Current: "${item.current}" → Correct: "${item.correct}"`);
        Logger.log('');
      }

      Logger.log('To apply these corrections, run: FIX_correctMonthYearValues()');
    } else {
      Logger.log('No corrections needed!');
    }

    return `Preview complete - see execution logs. Found ${needsCorrection.length} corrections needed.`;

  } catch (e) {
    Logger.log(`ERROR in FIX_previewMonthYearCorrections: ${e.message}`);
    throw e;
  }
}
