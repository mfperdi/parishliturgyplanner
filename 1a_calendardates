/**
 * ====================================================================
 * 1a. LITURGICAL DATE CALCULATIONS
 * ====================================================================
 * This file contains the pure date-math functions to calculate
 * the dates of moveable feasts for a given year.
 */

/**
 * Calculates the primary liturgical dates for the year.
 * @param {number} year The year to calculate.
 * @param {object} config The config object (from HELPER_readConfig).
 * @returns {object} An object containing all key liturgical dates.
 */
function CALENDAR_calculateLiturgicalDates(year, config) {
  const dates = {};
  
  // --- Core Moveable Feasts (based on Easter) ---
  dates.easter = getEaster(year);
  dates.ashWednesday = new Date(dates.easter.getTime() - 46 * 86400000);
  dates.palmSunday = new Date(dates.easter.getTime() - 7 * 86400000);
  dates.holyThursday = new Date(dates.easter.getTime() - 3 * 86400000);
  dates.goodFriday = new Date(dates.easter.getTime() - 2 * 86400000);
  dates.holySaturday = new Date(dates.easter.getTime() - 1 * 86400000);
  dates.divineMercySunday = new Date(dates.easter.getTime() + 7 * 86400000);
  dates.pentecost = new Date(dates.easter.getTime() + 49 * 86400000);
  dates.trinitySunday = new Date(dates.pentecost.getTime() + 7 * 86400000); // Sunday after Pentecost
  
  // --- Moveable Feasts (Transferred) ---
  
  // Ascension
  const ascensionThursday = new Date(dates.easter.getTime() + 39 * 86400000);
  dates.ascension = config["Transfer Ascension to Sunday"]
    ? new Date(dates.easter.getTime() + 42 * 86400000) // 7th Sunday of Easter
    : ascensionThursday; // 40th day

  // Corpus Christi
  const corpusChristiThursday = new Date(dates.pentecost.getTime() + 11 * 86400000);
  dates.corpusChristi = config["Transfer Corpus Christi to Sunday"]
    ? new Date(dates.pentecost.getTime() + 14 * 86400000) // 2nd Sunday after Pentecost
    : corpusChristiThursday;

  // Epiphany
  const jan1 = new Date(year, 0, 1);
  const jan6 = new Date(year, 0, 6);
  if (config["Transfer Epiphany to Sunday"]) {
    // Sunday on or after Jan 2
    let epiphanySunday = new Date(year, 0, 2);
    while (epiphanySunday.getDay() !== 0) { // 0 = Sunday
      epiphanySunday.setDate(epiphanySunday.getDate() + 1);
    }
    dates.epiphany = epiphanySunday;
  } else {
    dates.epiphany = jan6; // Fixed to Jan 6
  }

  // Baptism of the Lord
  // Sunday after Epiphany, unless Epiphany is Jan 7/8, then it's Monday.
  if (dates.epiphany.getDay() === 0) { // If Epiphany is on Sunday
    // Handle edge case where Epiphany is transferred to Jan 7 or 8
    if (dates.epiphany.getDate() >= 7) {
       dates.baptism = new Date(dates.epiphany.getTime() + 1 * 86400000); // Next day (Monday)
    } else {
       dates.baptism = new Date(dates.epiphany.getTime() + 7 * 86400000); // Next Sunday
    }
  } else { // Epiphany is on Jan 6 (a weekday)
     let baptismSunday = new Date(dates.epiphany.getTime());
     // Find the *next* Sunday
     baptismSunday.setDate(baptismSunday.getDate() + (7 - baptismSunday.getDay()));
     dates.baptism = baptismSunday;
  }


  // --- Fixed Feasts (for calculation) ---
  dates.immaculateConception = new Date(year, 11, 8);
  dates.christmasDay = new Date(year, 11, 25);
  dates.maryMotherOfGod = new Date(year, 0, 1);
  
  // Find First Sunday of Advent
  // It's the Sunday closest to Nov 30 (between Nov 27 and Dec 3)
  let firstSundayOfAdvent = new Date(year, 10, 30); // Start at Nov 30
  firstSundayOfAdvent.setDate(firstSundayOfAdvent.getDate() - firstSundayOfAdvent.getDay());
  
  // If Nov 30 is a Sunday, day 0, it's correct.
  // If Nov 30 is Mon (1), it goes to Sun 29.
  // If Nov 30 is Sat (6), it goes to Sun 24. (Too early)
  
  // Let's use a simpler, more robust method:
  // 4th Sunday *before* Christmas Day.
  let christmasDay = new Date(year, 11, 25);
  let christmasWeekday = christmasDay.getDay(); // 0=Sun, 1=Mon...
  
  // Go back to the 4th Sunday before Christmas
  // (Christmas - its weekday) = previous Sunday. Then - 3 more weeks.
  firstSundayOfAdvent = new Date(christmasDay.getTime() - (christmasWeekday * 86400000) - (21 * 86400000));
  
  dates.firstSundayOfAdvent = firstSundayOfAdvent;
  dates.christTheKing = new Date(dates.firstSundayOfAdvent.getTime() - 7 * 86400000);
  
  return dates;
}

/**
 * Helper to get Easter date (Meeus/Jones/Butcher algorithm).
 * @param {number} year The year.
 * @returns {Date} The date of Easter.
 */
function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}
