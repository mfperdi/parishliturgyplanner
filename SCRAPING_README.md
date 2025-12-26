# Liturgical Readings Web Scraper

## Overview

This Python script scrapes liturgical reading data from [catholic-resources.org](https://catholic-resources.org/Lectionary/) and generates a CSV file compatible with the Parish Liturgical Scheduler.

**Phase 1** (Current): Sunday Cycles A, B, C with focus on Year A
**Phase 2** (Future): Weekday Cycles I, II

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

## Installation

1. Install required Python packages:
```bash
pip install -r requirements_scraper.txt
```

Or install individually:
```bash
pip install requests beautifulsoup4 lxml
```

## Usage

### Running the Scraper

The scraper supports two modes:

**Option 1: Online Mode** (may encounter 403 Forbidden errors)
```bash
python scrape_liturgical_readings.py
```

**Option 2: Offline Mode** (recommended - works around 403 errors)
```bash
# 1. Create directory for HTML files
mkdir html_files

# 2. Download HTML files manually in your web browser:
#    Visit: https://catholic-resources.org/Lectionary/
#    Save each page (Right-click → Save As):
#      - 1998USL-Advent.htm
#      - 1998USL-Christmas.htm
#      - 1998USL-Lent.htm
#      - 1998USL-Easter.htm
#      - 1998USL-OrdinaryTime.htm
#    Save them to the html_files/ directory

# 3. Run scraper in offline mode
python scrape_liturgical_readings.py --offline
```

### Output

The script generates `liturgical_readings_phase1.csv` with 10 columns:

1. **Liturgical Celebration** - Name of the celebration
2. **Cycle** - Fixed, A, B, or C
3. **Lectionary Number** - Official lectionary reference number
4. **Reading Type** - Standard, Vigil, Night, Dawn, Day, etc.
5. **First Reading** - Scripture citation
6. **Responsorial Psalm** - Psalm citation
7. **Second Reading** - Scripture citation (blank for weekdays)
8. **Gospel Acclamation** - Alleluia/Acclamation citation
9. **Gospel** - Gospel citation
10. **Notes** - Source season and additional info

### Importing into Google Sheets

1. Open your Parish Liturgical Scheduler spreadsheet
2. Create a new sheet named `LiturgicalReadings`
3. File → Import → Upload → Select `liturgical_readings_phase1.csv`
4. Import location: "Replace data at selected cell" (A1)
5. Verify the data imported correctly

## What the Scraper Does

### Phase 1: Sunday Cycles (Current)

The scraper extracts readings from these pages:
- **Advent** - 1998USL-Advent.htm
- **Christmas** - 1998USL-Christmas.htm
- **Lent** - 1998USL-Lent.htm
- **Easter** - 1998USL-Easter.htm
- **Ordinary Time** - 1998USL-OrdinaryTime.htm

**Includes**:
- All Sundays (Cycle A, B, C)
- Major solemnities (Christmas, Easter, etc.)
- Sunday-equivalent celebrations (Trinity Sunday, Christ the King, etc.)

**Excludes** (Phase 1):
- Weekday readings
- Memorials and optional memorials (use weekday readings anyway)
- Ferias

### Phase 2: Weekday Cycles (Future)

Will extract:
- Cycle I and Cycle II weekday readings
- Special weekday celebrations during Advent and Lent
- Ferias of liturgical seasons

## Data Processing

### Celebration Name Extraction

The scraper:
1. Parses celebration names from HTML tables
2. Extracts reading type from parentheticals: "Christmas (Vigil)" → Celebration: "Christmas", Type: "Vigil"
3. Standardizes reading types: Standard, Vigil, Night, Dawn, Day
4. Handles multi-reading celebrations (Easter Vigil, Christmas)

### Cycle Determination

- **ABC** → Converted to "Fixed" (same readings every year)
- **A**, **B**, **C** → Individual cycle entries
- Sunday readings use A/B/C cycles
- Weekday readings (Phase 2) will use I/II cycles

### Lectionary Numbers

- Extracts official lectionary reference numbers
- Handles ranges (e.g., "1-2" → uses "1")
- Critical for lectors to find readings in physical Lectionary books

### Reading Citations

Cleans and normalizes:
- Scripture citations (e.g., "Gen 1:1-2:2")
- Psalm responses
- Gospel acclamations
- Removes extra whitespace and trailing punctuation

## Troubleshooting

### Common Issues

**Import Error: No module named 'bs4'**
```bash
pip install beautifulsoup4
```

**Import Error: No module named 'requests'**
```bash
pip install requests
```

**HTTP 403 Forbidden errors**
- The website blocks automated scraping (common protection)
- Solution: Use offline mode (download HTML files manually)
- See "Option 2: Offline Mode" in Usage section above

**Timeout errors**
- Check internet connection
- Website may be temporarily unavailable
- If persistent, use offline mode

**Empty CSV file**
- Check console output for error messages
- Verify website structure hasn't changed
- Website URL: https://catholic-resources.org/Lectionary/

### Testing the Scraper Logic

Before running the full scraper, you can test the parsing logic with sample data:

```bash
python test_scraper_logic.py
```

This will:
- Parse sample Christmas data (8 readings)
- Generate test_christmas_readings.csv
- Validate the 10-column output format
- Confirm reading type extraction works correctly

### Validation

After scraping, verify:
1. CSV has ~150-200 Sunday readings (Cycle A focus)
2. Major celebrations present (Christmas, Easter, Pentecost)
3. Lectionary numbers populated
4. Reading citations look correct (book abbreviations, chapter:verse)
5. Reading types properly extracted (Standard, Vigil, Night, Dawn, Day)

## Data Quality Notes

### Known Limitations

1. **Website Structure Dependency**: Script assumes current HTML table structure. If website redesign occurs, script may need updates.

2. **Celebration Name Matching**: Some celebration names on website may differ from LiturgicalCalendar sheet. Manual reconciliation may be needed.

3. **Gospel Acclamation**: Some seasons (Lent) use "Verse before the Gospel" instead of "Alleluia". Script captures both.

4. **Optional Readings**: Some celebrations have optional readings. Script captures the primary set listed.

5. **Memorials**: Phase 1 excludes memorials since they typically use weekday readings.

## Next Steps After Scraping

1. **Review CSV** - Open in spreadsheet software to verify data quality
2. **Import to Google Sheets** - Create LiturgicalReadings sheet
3. **Reconcile Names** - Match celebration names with existing LiturgicalCalendar sheet
4. **Add Code Integration** - Implement helper functions (HELPER_getReadingsForCelebration)
5. **Update Print Schedule** - Display readings in print schedules
6. **Run Phase 2** - Scrape weekday cycles I and II

## Data Source

**Website**: [catholic-resources.org](https://catholic-resources.org/Lectionary/)
**Maintainer**: Felix Just, S.J., Ph.D.
**Lectionary**: 1998 USCCB Lectionary for Mass

The website provides official lectionary readings approved by the United States Conference of Catholic Bishops (USCCB).

## License & Attribution

This scraper is for use with the Parish Liturgical Scheduler project.

Data source attribution:
- Liturgical readings © USCCB
- Website structure © Felix Just, S.J.

## Support

For issues or questions:
1. Check console output for error messages
2. Verify internet connection and website availability
3. Review LITURGICAL_READINGS_DESIGN.md for data structure
4. Check LITURGICAL_READINGS_DATA_TEMPLATE.md for expected format

## Version History

**v1.0** - Phase 1: Sunday Cycles A, B, C (Year A focus)
- Scrapes 5 liturgical seasons
- Extracts 10-column reading data
- Outputs CSV for Google Sheets import

**v2.0** (Planned) - Phase 2: Weekday Cycles I, II
- Add weekday reading extraction
- Handle feria and special weekday celebrations
- Expand coverage to complete liturgical year
