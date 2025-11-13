/**
 * ====================================================================
 * 1b. CALENDAR SEASONAL LOGIC (CORRECTED)
 * ====================================================================
 * This file contains the logic to determine the "Proper of Time"
 * (the seasonal celebration) for any given date.
 *
 * UPDATED to fix Ash Wednesday, Lenten Sunday, and All Saints' Day logic.
 */

/**
 * Determines the "Proper of Time" (seasonal) celebration for a given date.
 * This is the "default" celebration before saints are considered.
 * @param {Date} currentDate The date to check.
 * @param {number} dayOfWeek The day of the week (0=Sun).
 * @param {object} dates The map of calculated moveable feast dates.
 * @returns {object} { celebration, season, rank, color }
 */
function CALENDAR_getSeasonalCelebration(currentDate, dayOfWeek, dates) {
  
  const oneDay = 86400000; // milliseconds in one day
  
  // Helper to get week number (1-based)
  const getWeek = (start, end) => Math.ceil(((end.getTime() - start.getTime()) / oneDay + 1) / 7);

  // 1. --- Christmas Season (Part 1: Jan) ---
  if (currentDate >= dates.maryMotherOfGod && currentDate < dates.baptism) {
    
    // --- Explicit handling of major feasts ---
    if (currentDate.getTime() === dates.epiphany.getTime()) {
      return { celebration: "The Epiphany of the Lord", season: "Christmas", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    
    // Handle 2nd Sunday after Christmas
    if (dayOfWeek === 0 && currentDate > dates.maryMotherOfGod && currentDate < dates.epiphany && currentDate > new Date(currentDate.getFullYear(), 0, 1) ) {
        return { celebration: "2nd Sunday after Christmas", season: "Christmas", rank: "Sunday-OT", color: "White" };
    }
    
    // Handle Sundays between Epiphany and Baptism
    if (dayOfWeek === 0 && currentDate > dates.epiphany && currentDate < dates.baptism) {
        return { celebration: "Sunday after Epiphany", season: "Christmas", rank: "Sunday-OT", color: "White" };
    }
    
    // Weekdays in Christmas (after Jan 2, before Baptism)
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    if (currentDate < dates.epiphany) {
      return { celebration: `${weekdayName} before Epiphany`, season: "Christmas", rank: "Weekday", color: "White" };
    } else {
      return { celebration: `${weekdayName} after Epiphany`, season: "Christmas", rank: "Weekday", color: "White" };
    }
  }
  if (currentDate.getTime() === dates.baptism.getTime()) {
    return { celebration: "The Baptism of the Lord", season: "Christmas", rank: "Feast-Lord", color: "White" };
  }

  // 2. --- Lent Season ---
  if (currentDate >= dates.ashWednesday && currentDate < dates.easter) {
    
    // *** FIX 1: Check toDateString() for reliable matching ***
    if (currentDate.toDateString() === dates.ashWednesday.toDateString()) {
      return { celebration: "Ash Wednesday", season: "Lent", rank: "ASH_WEDNESDAY", color: "Violet" };
    }
    if (currentDate.getTime() === dates.palmSunday.getTime()) {
      return { celebration: "Palm Sunday of the Passion of the Lord", season: "Lent", rank: "SOLEMNITY_HIGH", color: "Red" };
    }
    if (currentDate > dates.palmSunday && currentDate < dates.holyThursday) {
      const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
      return { celebration: `${weekdayName} of Holy Week`, season: "Lent", rank: "HOLY_WEEK_WEEKDAY", color: "Violet" };
    }
    if (currentDate.getTime() === dates.holyThursday.getTime()) {
      return { celebration: "Holy Thursday", season: "Triduum", rank: "TRIDUUM", color: "White" };
    }
    if (currentDate.getTime() === dates.goodFriday.getTime()) {
      return { celebration: "Good Friday of the Passion of the Lord", season: "Triduum", rank: "TRIDUUM", color: "Red" };
    }
      if (currentDate.getTime() === dates.holySaturday.getTime()) {
      return { celebration: "Holy Saturday", season: "Triduum", rank: "TRIDUUM", color: "White" };
    }
    
    // Sundays of Lent
    if (dayOfWeek === 0) {
      // Get week number *relative to 1st Sunday of Lent*
      const firstSundayOfLent = new Date(dates.ashWednesday.getTime() + (7 - dates.ashWednesday.getDay()) * oneDay);
      // *** FIX 2: Removed erroneous "+ 1" from week calculation ***
      const lentWeek = getWeek(firstSundayOfLent, currentDate);
      return { celebration: `${HELPER_getOrdinal(lentWeek)} Sunday of Lent`, season: "Lent", rank: "Lent Sunday", color: "Violet" };
    }
    
    // Weekdays of Lent
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    // Get week number *relative to Ash Wednesday*
    const lentWeek = getWeek(dates.ashWednesday, currentDate);
    if (currentDate > dates.ashWednesday && lentWeek === 1) {
        return { celebration: `${weekdayName} after Ash Wednesday`, season: "Lent", rank: "Weekday-High", color: "Violet" };
    }
    return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(lentWeek)} Week of Lent`, season: "Lent", rank: "Weekday-High", color: "Violet" };
  }
  
  // 3. --- Easter Season ---
  if (currentDate >= dates.easter && currentDate <= dates.pentecost) {
    if (currentDate.getTime() === dates.easter.getTime()) {
      return { celebration: "Easter Sunday of the Resurrection of the Lord", season: "Easter", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    if (currentDate.getTime() === dates.divineMercySunday.getTime()) {
      return { celebration: "2nd Sunday of Easter (or of Divine Mercy)", season: "Easter", rank: "Easter Sunday", color: "White" };
    }
    if (currentDate.getTime() === dates.ascension.getTime()) {
      return { celebration: "The Ascension of the Lord", season: "Easter", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    if (currentDate.getTime() === dates.pentecost.getTime()) {
      return { celebration: "Pentecost Sunday", season: "Easter", rank: "SOLEMNITY_HIGH", color: "Red" };
    }

    // Sundays of Easter
    if (dayOfWeek === 0) {
      const easterWeek = getWeek(dates.easter, currentDate);
      return { celebration: `${HELPER_getOrdinal(easterWeek)} Sunday of Easter`, season: "Easter", rank: "Easter Sunday", color: "White" };
    }
    
    // Weekdays of Easter (Octave and Regular)
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    const easterWeek = getWeek(dates.easter, currentDate);
    if (easterWeek === 1) {
        return { celebration: `${weekdayName} in the Octave of Easter`, season: "Easter", rank: "EASTER_OCTAVE_DAY", color: "White" };
    }
    return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(easterWeek)} Week of Easter`, season: "Easter", rank: "Weekday", color: "White" };
  }

  // 4. --- Advent Season ---
  if (currentDate >= dates.firstSundayOfAdvent && currentDate < dates.christmasDay) {
      // Sundays of Advent
    if (dayOfWeek === 0) {
      const adventWeek = getWeek(dates.firstSundayOfAdvent, currentDate);
      return { celebration: `${HELPER_getOrdinal(adventWeek)} Sunday of Advent`, season: "Advent", rank: "Advent Sunday", color: "Violet" };
    }
    
    // Weekdays of Advent
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    
    // Special naming for Dec 17-24
    if (currentDate.getMonth() === 11 && currentDate.getDate() >= 17) {
        const monthName = currentDate.toLocaleDateString(undefined, { month: 'long' });
        return { celebration: `${weekdayName}, ${monthName} ${currentDate.getDate()}`, season: "Advent", rank: "Weekday-High", color: "Violet" };
    }
    
    const adventWeek = getWeek(dates.firstSundayOfAdvent, currentDate);
    return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(adventWeek)} Week of Advent`, season: "Advent", rank: "Weekday", color: "Violet" };
  }
  
  // 5. --- Christmas Season (Part 2: Dec) ---
  if (currentDate >= dates.christmasDay) {
    
    // --- Explicit handling of major feasts ---
    if (currentDate.getTime() === dates.christmasDay.getTime()) {
      return { celebration: "The Nativity of the Lord (Christmas)", season: "Christmas", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    
    // Handle Sundays in Christmas Octave
      if (dayOfWeek === 0) {
      return { celebration: "The Holy Family of Jesus, Mary and Joseph", season: "Christmas", rank: "Sunday-OT", color: "White" };
    }
    // Weekdays in Christmas Octave
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    return { celebration: `${weekdayName} in the Octave of Christmas`, season: "Christmas", rank: "CHRISTMAS_OCTAVE_DAY", color: "White" };
  }

  // 6. --- Ordinary Time ---
  // If it's none of the above, it's Ordinary Time.
  const season = "Ordinary Time";
  const color = "Green";
  
  // These are moveable feasts that are *part* of Ordinary Time
  if (currentDate.getTime() === dates.trinitySunday.getTime()) {
    return { celebration: "The Most Holy Trinity", season: season, rank: "SOLEMNITY", color: "White" };
  }
  if (currentDate.getTime() === dates.corpusChristi.getTime()) {
    return { celebration: "The Most Holy Body and Blood of Christ (Corpus Christi)", season: season, rank: "SOLEMNITY", color: "White" };
  }
  if (currentDate.getTime() === dates.christTheKing.getTime()) {
    return { celebration: "Our Lord Jesus Christ, King of the Universe", season: season, rank: "SOLEMNITY", color: "White" };
  }

  // *** FIX 3: Add explicit checks for fixed Solemnities in Ordinary Time ***
  if (currentDate.getMonth() === 10 && currentDate.getDate() === 1) { // Nov 1
    return { celebration: "All Saints' Day", season: season, rank: "SOLEMNITY", color: "White" };
  }
  if (currentDate.getMonth() === 10 && currentDate.getDate() === 2) { // Nov 2
    return { celebration: "The Commemoration of All the Faithful Departed (All Souls' Day)", season: season, rank: "SOLEMNITY_HIGH", color: "Violet" }; // Or White/Black
  }
  // (Add other fixed feasts here as needed, e.g., Sacred Heart, St. Joseph, etc.)

  // Sundays in Ordinary Time
  if (dayOfWeek === 0) {
    let ordWeek;
    if (currentDate < dates.ashWednesday) {
      // Week 1 is the Baptism of the Lord
      ordWeek = getWeek(dates.baptism, currentDate) + 1;
    } else {
      // Count backwards from 34th week (Christ the King)
      const weeksFromEnd = Math.floor((dates.christTheKing.getTime() - currentDate.getTime()) / oneDay / 7);
      ordWeek = 34 - weeksFromEnd;
    }
    return { celebration: `${HELPER_getOrdinal(ordWeek)} Sunday in Ordinary Time`, season: season, rank: "Sunday-OT", color: color };
  }

  // Weekdays in Ordinary Time
  const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
  let ordWeek;
  if (currentDate < dates.ashWednesday) {
      // Get week number based on *preceding Sunday*
    const precedingSunday = getPreviousSunday(currentDate);
    // Week 1 is the Baptism of the Lord
    ordWeek = getWeek(dates.baptism, precedingSunday) + 1;
  } else {
    // Get week number based on *preceding Sunday*
    const precedingSunday = getPreviousSunday(currentDate);
    const weeksFromEnd = Math.floor((dates.christTheKing.getTime() - precedingSunday.getTime()) / oneDay / 7);
    ordWeek = 34 - weeksFromEnd;
  }
  
  return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(ordWeek)} Week in Ordinary Time`, season: season, rank: "Weekday", color: color };
}

/**
 * Helper function to get the preceding Sunday for a given date.
 * Assumes a helper function `getPreviousSunday` exists (likely in 0b_helper.gs)
 * If not, this is a simple implementation.
 */
function getPreviousSunday(currentDate) {
  const prevSunday = new Date(currentDate.getTime());
  prevSunday.setDate(prevSunday.getDate() - prevSunday.getDay());
  return prevSunday;
}
