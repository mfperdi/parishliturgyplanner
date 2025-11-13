/**
 * ====================================================================
 * 1a. LITURGICAL DATE CALCULATIONS (CORRECTED)
 * ====================================================================
 * This file contains the pure date-math functions to calculate
 * the dates of moveable feasts for a given year.
 *
 * UPDATED: All calculated dates are set to noon (T12:00:00)
 * to prevent timezone and "midnight" bugs.
 */

/**
 * Helper to create a new Date set to noon (local time)
 * @param {number} year
 * @param {number} month (0-11)
 * @param {number} day (1-31)
 * @returns {Date}
 */
function createSafeDate(year, month, day) {
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Helper to clone a date and set it to noon.
 * @param {Date} date
 * @returns {Date}
 */
function setDateToNoon(date) {
  return createSafeDate(date.getFullYear(), date.getMonth(), date.getDate());
}


/**
 * Calculates the primary liturgical dates for the year.
 * @param {number} year The year to calculate.
 * @param {object} config The config object (from HELPER_readConfig).
 * @returns {object} An object containing all key liturgical dates.
 */
function CALENDAR_calculateLiturgicalDates(year, config) {
  const dates = {};
  const oneDay = 86400000; // 24 * 60 * 60 * 1000
  
  // --- Core Moveable Feasts (based on Easter) ---
  dates.easter = setDateToNoon(getEaster(year));
  
  // Use .setDate() for DST-safe date math instead of fixed milliseconds
  let ashWed = new Date(dates.easter.getTime());
  ashWed.setDate(ashWed.getDate() - 46);
  dates.ashWednesday = setDateToNoon(ashWed);

  let palmSun = new Date(dates.easter.getTime());
  palmSun.setDate(palmSun.getDate() - 7);
  dates.palmSunday = setDateToNoon(palmSun);

  let holyThu = new Date(dates.easter.getTime());
  holyThu.setDate(holyThu.getDate() - 3);
  dates.holyThursday = setDateToNoon(holyThu);

  let goodFri = new Date(dates.easter.getTime());
  goodFri.setDate(goodFri.getDate() - 2);
  dates.goodFriday = setDateToNoon(goodFri);

  let holySat = new Date(dates.easter.getTime());
  holySat.setDate(holySat.getDate() - 1);
  dates.holySaturday = setDateToNoon(holySat);

  let divineMercy = new Date(dates.easter.getTime());
  divineMercy.setDate(divineMercy.getDate() + 7);
  dates.divineMercySunday = setDateToNoon(divineMercy);

  let pentecost = new Date(dates.easter.getTime());
  pentecost.setDate(pentecost.getDate() + 49);
  dates.pentecost = setDateToNoon(pentecost);

  let trinity = new Date(dates.pentecost.getTime());
  trinity.setDate(trinity.getDate() + 7);
  dates.trinitySunday = setDateToNoon(trinity); 
  
  // --- Moveable Feasts (Transferred) ---
  
  // Ascension
  let ascensionThu = new Date(dates.easter.getTime());
  ascensionThu.setDate(ascensionThu.getDate() + 39);
  const ascensionThursday = setDateToNoon(ascensionThu);
  
  let ascensionSun = new Date(dates.easter.getTime());
  ascensionSun.setDate(ascensionSun.getDate() + 42);

  dates.ascension = config["Transfer Ascension to Sunday"]
    ? setDateToNoon(ascensionSun) // 7th Sunday of Easter
    : ascensionThursday; // 40th day

  // Corpus Christi
  let corpusChristiThu = new Date(dates.pentecost.getTime());
  corpusChristiThu.setDate(corpusChristiThu.getDate() + 11);
  const corpusChristiThursday = setDateToNoon(corpusChristiThu);

  let corpusChristiSun = new Date(dates.pentecost.getTime());
  corpusChristiSun.setDate(corpusChristiSun.getDate() + 14);

  dates.corpusChristi = config["Transfer Corpus Christi to Sunday"]
    ? setDateToNoon(corpusChristiSun) // 2nd Sunday after Pentecost
    : corpusChristiThursday;

  // Epiphany
  const jan1 = createSafeDate(year, 0, 1);
  const jan6 = createSafeDate(year, 0, 6);
  if (config["Transfer Epiphany to Sunday"]) {
    // Sunday on or after Jan 2
    let epiphanySunday = createSafeDate(year, 0, 2);
    while (epiphanySunday.getDay() !== 0) { // 0 = Sunday
      epiphanySunday.setDate(epiphanySunday.getDate() + 1);
    }
    dates.epiphany = setDateToNoon(epiphanySunday);
  } else {
    dates.epiphany = jan6; // Fixed to Jan 6
  }

  // Baptism of the Lord
  // Sunday after Epiphany, unless Epiphany is Jan 7/8, then it's Monday.
  if (dates.epiphany.getDay() === 0) { // If Epiphany is on Sunday
    if (dates.epiphany.getDate() >= 7) {
       let baptismMon = new Date(dates.epiphany.getTime());
       baptismMon.setDate(baptismMon.getDate() + 1);
       dates.baptism = setDateToNoon(baptismMon); // Next day (Monday)
    } else {
       let baptismSun = new Date(dates.epiphany.getTime());
       baptismSun.setDate(baptismSun.getDate() + 7);
       dates.baptism = setDateToNoon(baptismSun); // Next Sunday
    }
  } else { // Epiphany is on Jan 6 (a weekday)
     let baptismSunday = new Date(dates.epiphany.getTime());
     // Find the *next* Sunday
     baptismSunday.setDate(baptismSunday.getDate() + (7 - baptismSunday.getDay()));
     dates.baptism = setDateToNoon(baptismSunday);
  }


  // --- Fixed Feasts (for calculation) ---
  dates.immaculateConception = createSafeDate(year, 11, 8);
  dates.christmasDay = createSafeDate(year, 11, 25);
  dates.maryMotherOfGod = createSafeDate(year, 0, 1);
  
  // Find First Sunday of Advent
  // 4th Sunday *before* Christmas Day.
  let christmasDay = createSafeDate(year, 11, 25);
  let christmasWeekday = christmasDay.getDay(); // 0=Sun, 1=Mon...
  
  // (Christmas - its weekday) = previous Sunday. Then - 3 more weeks.
  let firstSundayOfAdvent = new Date(christmasDay.getTime());
  firstSundayOfAdvent.setDate(firstSundayOfAdvent.getDate() - christmasWeekday - 21);
  
  dates.firstSundayOfAdvent = setDateToNoon(firstSundayOfAdvent);
  
  let christTheKing = new Date(dates.firstSundayOfAdvent.getTime());
  christTheKing.setDate(christTheKing.getDate() - 7);
  dates.christTheKing = setDateToNoon(christTheKing);
  
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
  
  return new Date(year, month - 1, day); // Returns a local date at midnight
}
