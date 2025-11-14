/**
 * ====================================================================
 * 1b. CALENDAR SEASONAL LOGIC (CORRECTED)
 * ====================================================================
 * This file contains the logic to determine the "Proper of Time"
 * (the seasonal celebration) for any given date.
 *
 * UPDATED: Fixes all "0th Week" counting bugs for all seasons.
 */

/**
 * Determines the "Proper of Time" (seasonal) celebration for a given date.
 * @param {Date} currentDate The date to check.
 * @param {number} dayOfWeek The day of the week (0=Sun).
 *@param {object} dates The map of calculated moveable feast dates.
 * @returns {object} { celebration, season, rank, color }
 */
function CALENDAR_getSeasonalCelebration(currentDate, dayOfWeek, dates) {
  
  const oneDay = 86400000; // milliseconds in one day
  
  // *** FIX: This helper function is now corrected ***
  // It correctly calculates the week number.
  // (e.g., days 0-6 = week 1, days 7-13 = week 2)
  const getWeek = (start, end) => {
    const startTime = setDateToNoon(start).getTime();
    const endTime = setDateToNoon(end).getTime();
    // Calculate days elapsed (rounding up to handle DST)
    const daysElapsed = Math.round((endTime - startTime) / oneDay);
    return Math.floor(daysElapsed / 7) + 1;
  };

  // --- Set current date to noon for reliable comparison ---
  const currTime = setDateToNoon(currentDate).getTime();

  // 1. --- Christmas Season (Part 1: Jan) ---
  if (currTime >= dates.maryMotherOfGod.getTime() && currTime < dates.baptism.getTime()) {
    
    // --- Explicit handling of major feasts ---
    if (currTime === dates.maryMotherOfGod.getTime()) {
      return { celebration: "Solemnity of Mary, the Holy Mother of God", season: "Christmas", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    if (currTime === dates.epiphany.getTime()) {
      return { celebration: "The Epiphany of the Lord", season: "Christmas", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    
    // Handle 2nd Sunday after Christmas
    if (dayOfWeek === 0 && currTime > dates.maryMotherOfGod.getTime() && currTime < dates.epiphany.getTime() ) {
        return { celebration: "2nd Sunday after Christmas", season: "Christmas", rank: "Sunday-OT", color: "White" };
    }
    
    // Handle Sundays between Epiphany and Baptism
    if (dayOfWeek === 0 && currTime > dates.epiphany.getTime() && currTime < dates.baptism.getTime()) {
        return { celebration: "Sunday after Epiphany", season: "Christmas", rank: "Sunday-OT", color: "White" };
    }
    
    // Weekdays in Christmas
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    if (currTime < dates.epiphany.getTime()) {
      return { celebration: `${weekdayName} before Epiphany`, season: "Christmas", rank: "Weekday", color: "White" };
    } else {
      return { celebration: `${weekdayName} after Epiphany`, season: "Christmas", rank: "Weekday", color: "White" };
    }
  }
  if (currTime === dates.baptism.getTime()) {
    return { celebration: "The Baptism of the Lord", season: "Christmas", rank: "Feast-Lord", color: "White" };
  }

  // 2. --- Lent Season ---
  if (currTime >= dates.ashWednesday.getTime() && currTime < dates.easter.getTime()) {
    
    if (currTime === dates.ashWednesday.getTime()) {
      return { celebration: "Ash Wednesday", season: "Lent", rank: "ASH_WEDNESDAY", color: "Violet" };
    }
    if (currTime === dates.palmSunday.getTime()) {
      return { celebration: "Palm Sunday of the Passion of the Lord", season: "Lent", rank: "SOLEMNITY_HIGH", color: "Red" };
    }
    if (currTime > dates.palmSunday.getTime() && currTime < dates.holyThursday.getTime()) {
      const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
      return { celebration: `${weekdayName} of Holy Week`, season: "Lent", rank: "HOLY_WEEK_WEEKDAY", color: "Violet" };
    }
    if (currTime === dates.holyThursday.getTime()) {
      return { celebration: "Holy Thursday", season: "Triduum", rank: "TRIDUUM", color: "White" };
    }
    if (currTime === dates.goodFriday.getTime()) {
      return { celebration: "Good Friday of the Passion of the Lord", season: "Triduum", rank: "TRIDUUM", color: "Red" };
    }
      if (currTime === dates.holySaturday.getTime()) {
      return { celebration: "Holy Saturday", season: "Triduum", rank: "TRIDUUM", color: "White" };
    }
    
    // Find the 1st Sunday of Lent (the Sunday *after* Ash Wednesday)
    let firstSundayOfLent = new Date(dates.ashWednesday.getTime());
    firstSundayOfLent.setDate(firstSundayOfLent.getDate() + (7 - firstSundayOfLent.getDay()));
    firstSundayOfLent = setDateToNoon(firstSundayOfLent);

    // Sundays of Lent
    if (dayOfWeek === 0) {
      const lentWeek = getWeek(firstSundayOfLent, currentDate);
      // 4th Sunday of Lent (Laetare Sunday) uses Rose color
      const color = (lentWeek === 4) ? "Rose" : "Violet";
      return { celebration: `${HELPER_getOrdinal(lentWeek)} Sunday of Lent`, season: "Lent", rank: "Lent Sunday", color: color };
    }
    
    // Weekdays of Lent
    const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
    
    if (currTime > dates.ashWednesday.getTime() && currTime < firstSundayOfLent.getTime()) {
        return { celebration: `${weekdayName} after Ash Wednesday`, season: "Lent", rank: "Weekday-High", color: "Violet" };
    }
    
    const lentWeek = getWeek(firstSundayOfLent, currentDate);
    return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(lentWeek)} Week of Lent`, season: "Lent", rank: "Weekday-High", color: "Violet" };
  }
  
  // 3. --- Easter Season ---
  if (currTime >= dates.easter.getTime() && currTime <= dates.pentecost.getTime()) {
    if (currTime === dates.easter.getTime()) {
      return { celebration: "Easter Sunday of the Resurrection of the Lord", season: "Easter", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    if (currTime === dates.divineMercySunday.getTime()) {
      return { celebration: "2nd Sunday of Easter (or of Divine Mercy)", season: "Easter", rank: "Easter Sunday", color: "White" };
    }
    if (currTime === dates.ascension.getTime()) {
      return { celebration: "The Ascension of the Lord", season: "Easter", rank: "SOLEMNITY_HIGH", color: "White" };
    }
    if (currTime === dates.pentecost.getTime()) {
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
    if (easterWeek === 1) { // Octave
        return { celebration: `${weekdayName} in the Octave of Easter`, season: "Easter", rank: "EASTER_OCTAVE_DAY", color: "White" };
    }
    return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(easterWeek)} Week of Easter`, season: "Easter", rank: "Weekday", color: "White" };
  }

  // 4. --- Advent Season ---
  if (currTime >= dates.firstSundayOfAdvent.getTime() && currTime < dates.christmasDay.getTime()) {
      // Sundays of Advent
    if (dayOfWeek === 0) {
      const adventWeek = getWeek(dates.firstSundayOfAdvent, currentDate);
      // 3rd Sunday of Advent (Gaudete Sunday) uses Rose color
      const color = (adventWeek === 3) ? "Rose" : "Violet";
      return { celebration: `${HELPER_getOrdinal(adventWeek)} Sunday of Advent`, season: "Advent", rank: "Advent Sunday", color: color };
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
  if (currTime >= dates.christmasDay.getTime()) {
    
    if (currTime === dates.christmasDay.getTime()) {
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
  if (currTime === dates.trinitySunday.getTime()) {
    return { celebration: "The Most Holy Trinity", season: season, rank: "SOLEMNITY", color: "White" };
  }
  if (currTime === dates.corpusChristi.getTime()) {
    return { celebration: "The Most Holy Body and Blood of Christ (Corpus Christi)", season: season, rank: "SOLEMNITY", color: "White" };
  }
  if (currTime === dates.christTheKing.getTime()) {
    return { celebration: "Our Lord Jesus Christ, King of the Universe", season: season, rank: "SOLEMNITY", color: "White" };
  }

  // Fixed feasts in Ordinary Time
  if (currentDate.getMonth() === 10 && currentDate.getDate() === 1) { // Nov 1
    return { celebration: "All Saints' Day", season: season, rank: "SOLEMNITY", color: "White" };
  }
  if (currentDate.getMonth() === 10 && currentDate.getDate() === 2) { // Nov 2
    return { celebration: "The Commemoration of All the Faithful Departed (All Souls' Day)", season: season, rank: "SOLEMNITY_HIGH", color: "Violet" };
  }

  // Find the start of Ordinary Time (Monday after Baptism)
  let firstOTMonday = new Date(dates.baptism.getTime());
  if (firstOTMonday.getDay() === 0) { // If Baptism is a Sunday
    firstOTMonday.setDate(firstOTMonday.getDate() + 1); // Start is Monday
  } else { // Baptism is a Monday
    // firstOTMonday is correct
  }
  firstOTMonday = setDateToNoon(firstOTMonday);


  // Sundays in Ordinary Time
  if (dayOfWeek === 0) {
    let ordWeek;
    if (currTime < dates.ashWednesday.getTime()) {
      // The Sunday *after* Baptism is the 2nd Sunday.
      ordWeek = getWeek(dates.baptism, currentDate); 
    } else {
      // Count backwards from 34th week (Christ the King)
      const weeksFromEnd = Math.floor((dates.christTheKing.getTime() - currTime) / oneDay / 7);
      ordWeek = 34 - weeksFromEnd;
    }
    return { celebration: `${HELPER_getOrdinal(ordWeek)} Sunday in Ordinary Time`, season: season, rank: "Sunday-OT", color: color };
  }

  // Weekdays in Ordinary Time
  const weekdayName = currentDate.toLocaleDateString(undefined, { weekday: 'long' });
  let ordWeek;
  if (currTime < dates.ashWednesday.getTime()) {
    // The week *of* firstOTMonday is Week 1.
    ordWeek = getWeek(firstOTMonday, currentDate);
  } else {
    // Get week number based on *preceding Sunday*
    const precedingSunday = getPreviousSunday(currentDate);
    const weeksFromEnd = Math.floor((dates.christTheKing.getTime() - precedingSunday.getTime()) / oneDay / 7);
    ordWeek = 34 - weeksFromEnd;
  }
  
  return { celebration: `${weekdayName} of the ${HELPER_getOrdinal(ordWeek)} Week in Ordinary Time`, season: season, rank: "Weekday", color: "Green" };
}

/**
 * Helper function to get the preceding Sunday for a given date.
 */
function getPreviousSunday(currentDate) {
  const prevSunday = setDateToNoon(new Date(currentDate.getTime()));
  prevSunday.setDate(prevSunday.getDate() - prevSunday.getDay());
  return prevSunday;
}

/**
 * Helper function to set a date to noon (local time) to avoid timezone bugs.
 */
function setDateToNoon(date) {
  if (!date || isNaN(date.getTime())) {
    // Try to parse it if it's a string (this is a fallback)
    const d = new Date(date);
    if (!d || isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}
