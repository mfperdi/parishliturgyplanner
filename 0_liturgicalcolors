/**
 * ====================================================================
 * CONSOLIDATED LITURGICAL COLORS - SINGLE SOURCE OF TRUTH
 * ====================================================================
 * These colors are liturgically appropriate and consistent across the system
 */

/**
 * Consolidated liturgical color definitions
 * Used consistently across all print and display functions
 */
const LITURGICAL_COLORS = {
  // Primary liturgical colors
  'White': '#f8f9fa',      // Clean white for Christmas, Easter, feasts
  'Violet': '#6f42c1',     // Rich purple for Lent and Advent  
  'Rose': '#e83e8c',       // Rose pink for Gaudete and Laetare Sundays
  'Green': '#28a745',      // Fresh green for Ordinary Time
  'Red': '#dc3545',        // Bold red for Palm Sunday, Pentecost, martyrs
  'Gold': '#ffc107',       // Gold as alternative to white for special occasions
  
  // Additional colors sometimes used
  'Blue': '#007bff',       // Sometimes used for Marian feasts
  'Black': '#343a40',      // Rarely used (Good Friday in some traditions)
};

/**
 * Get hex color code for liturgical color name
 * @param {string} colorName The liturgical color name
 * @returns {string} Hex color code
 */
function HELPER_getLiturgicalColorHex(colorName) {
  return LITURGICAL_COLORS[colorName] || '#f8f9fa'; // Default to white
}

/**
 * Get all available liturgical colors
 * @returns {Object} Object with color names as keys and hex codes as values
 */
function HELPER_getAllLiturgicalColors() {
  return { ...LITURGICAL_COLORS };
}

/**
 * Check if a color name is a valid liturgical color
 * @param {string} colorName The color name to check
 * @returns {boolean} True if valid liturgical color
 */
function HELPER_isValidLiturgicalColor(colorName) {
  return colorName in LITURGICAL_COLORS;
}
