#!/usr/bin/env python3
"""
Web scraper for liturgical readings from catholic-resources.org
Phase 1: Sunday Cycles (A, B, C) - Year A focus
Author: Parish Liturgy Planner Project

USAGE MODES:
1. Online mode: Fetch directly from website (may be blocked by 403)
2. Offline mode: Use locally downloaded HTML files (recommended)

To use offline mode:
1. Visit https://catholic-resources.org/Lectionary/ in your browser
2. Save each season page as HTML (Right-click → Save As)
3. Place files in 'html_files' directory
4. Run with --offline flag: python scrape_liturgical_readings.py --offline
"""

import requests
from bs4 import BeautifulSoup
import csv
import re
import os
import sys
from typing import List, Dict, Optional, Tuple
from datetime import datetime

# Base URL for the lectionary
BASE_URL = "https://catholic-resources.org/Lectionary/"

# Directory for offline HTML files
OFFLINE_DIR = "html_files"

# Season pages to scrape (Phase 1: Sunday cycles only)
SEASON_PAGES = {
    'Advent': '1998USL-Advent.htm',
    'Christmas': '1998USL-Christmas.htm',
    'Lent': '1998USL-Lent.htm',
    'Easter': '1998USL-Easter.htm',
    'OrdinaryTime': '1998USL-Ordinary.htm'  # Note: Just "Ordinary", not "OrdinaryTime"
}

# Output CSV columns
CSV_HEADERS = [
    'Liturgical Celebration',
    'Cycle',
    'Lectionary Number',
    'Reading Type',
    'First Reading',
    'Responsorial Psalm',
    'Second Reading',
    'Gospel Acclamation',
    'Gospel',
    'Notes'
]


class LiturgicalReadingScraper:
    """Scrapes liturgical readings from catholic-resources.org"""

    def __init__(self, offline_mode: bool = False):
        self.offline_mode = offline_mode
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; LiturgicalReadingScraper/1.0)'
        })
        self.readings_data = []

        if offline_mode and not os.path.exists(OFFLINE_DIR):
            print(f"WARNING: Offline directory '{OFFLINE_DIR}' not found")
            print("Please create it and place downloaded HTML files there")

    def fetch_page(self, page_filename: str) -> Optional[BeautifulSoup]:
        """Fetch and parse a page from the website or local file"""

        if self.offline_mode:
            # Read from local file
            filepath = os.path.join(OFFLINE_DIR, page_filename)
            print(f"Reading local file: {filepath}")

            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                return BeautifulSoup(content, 'html.parser')
            except FileNotFoundError:
                print(f"File not found: {filepath}")
                print(f"Please download from: {BASE_URL}{page_filename}")
                return None
            except Exception as e:
                print(f"Error reading {filepath}: {e}")
                return None
        else:
            # Fetch from website
            url = BASE_URL + page_filename
            print(f"Fetching: {url}")

            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                return BeautifulSoup(response.content, 'html.parser')
            except requests.RequestException as e:
                print(f"Error fetching {url}: {e}")
                print(f"\nTIP: If you see 403 errors, try offline mode:")
                print(f"  1. Download HTML file from {url}")
                print(f"  2. Save to {OFFLINE_DIR}/{page_filename}")
                print(f"  3. Run with: python scrape_liturgical_readings.py --offline")
                return None

    def extract_reading_type(self, celebration_text: str) -> Tuple[str, str]:
        """
        Extract reading type from celebration text and return cleaned celebration name
        Examples:
          "Christmas (Vigil)" -> ("Christmas", "Vigil")
          "Christmas (Night)" -> ("Christmas", "Night")
          "Easter Sunday" -> ("Easter Sunday", "Standard")
        """
        # Check for parenthetical reading type
        match = re.search(r'\(([^)]+)\)$', celebration_text)
        if match:
            reading_type = match.group(1).strip()
            celebration = celebration_text[:match.start()].strip()

            # Standardize reading types
            reading_type_map = {
                'Vigil': 'Vigil',
                'Night': 'Night',
                'Dawn': 'Dawn',
                'Day': 'Day',
                'At the Vigil Mass': 'Vigil',
                'At the Mass at Night': 'Night',
                'At the Mass at Dawn': 'Dawn',
                'At the Mass during the Day': 'Day'
            }
            return celebration, reading_type_map.get(reading_type, reading_type)

        return celebration_text.strip(), 'Standard'

    def determine_cycle(self, year_column: str) -> str:
        """
        Determine cycle from the year column
        Examples:
          "ABC" -> "Fixed"
          "A" -> "A"
          "B" -> "B"
          "C" -> "C"
        """
        year_column = year_column.strip().upper()

        if year_column == 'ABC':
            return 'Fixed'
        elif year_column in ['A', 'B', 'C']:
            return year_column
        else:
            return 'Unknown'

    def clean_reading_text(self, text: str) -> str:
        """Clean and normalize reading citation text"""
        if not text:
            return ''

        # Remove extra whitespace
        text = ' '.join(text.split())

        # Remove trailing punctuation
        text = text.rstrip('.,;')

        return text.strip()

    def parse_lectionary_number(self, num_text: str) -> str:
        """Parse lectionary number, handling ranges and special cases"""
        if not num_text:
            return ''

        # Clean the text
        num_text = num_text.strip()

        # Handle ranges (e.g., "1-2" means use "1")
        if '-' in num_text:
            num_text = num_text.split('-')[0]

        return num_text

    def is_sunday_reading(self, celebration: str, date_col: str) -> bool:
        """
        Determine if this is a Sunday reading (Phase 1 focus)
        Returns True for Sundays and Sunday-equivalent solemnities
        """
        # Check if it's explicitly a Sunday
        if 'Sunday' in celebration:
            return True

        # Check for major solemnities that use Sunday cycles
        sunday_equivalent_solemnities = [
            'The Nativity of the Lord',  # Christmas
            'Christmas',
            'The Epiphany of the Lord',
            'Epiphany',
            'The Baptism of the Lord',
            'Ash Wednesday',  # Start of Lent
            'Palm Sunday',
            'Holy Thursday',
            'Good Friday',
            'Easter Sunday',
            'The Ascension of the Lord',
            'Ascension',
            'Pentecost Sunday',
            'The Most Holy Trinity',
            'Trinity Sunday',
            'The Most Holy Body and Blood of Christ',
            'Corpus Christi',
            'The Most Sacred Heart of Jesus',
            'Sacred Heart',
            'Christ the King',
            'Our Lord Jesus Christ, King of the Universe'
        ]

        for sol in sunday_equivalent_solemnities:
            if sol.lower() in celebration.lower():
                return True

        # Check date column for Sunday indicator
        if date_col and 'Sun' in date_col:
            return True

        return False

    def parse_table_row(self, row, season: str) -> Optional[List[Dict]]:
        """
        Parse a single table row and return reading data
        May return multiple entries if celebration has multiple cycles
        """
        cells = row.find_all('td')

        # Need at least 7 columns (Date, #, Sunday/Feast, 1st Reading, Psalm, 2nd Reading, Gospel)
        if len(cells) < 7:
            return None

        # Extract data
        date_col = cells[0].get_text(strip=True)
        lect_num = self.parse_lectionary_number(cells[1].get_text(strip=True))
        celebration_raw = cells[2].get_text(strip=True)
        first_reading = self.clean_reading_text(cells[3].get_text(strip=True))
        psalm = self.clean_reading_text(cells[4].get_text(strip=True))
        second_reading = self.clean_reading_text(cells[5].get_text(strip=True))

        # Gospel Acclamation and Gospel might be in separate columns or combined
        if len(cells) >= 8:
            gospel_acc = self.clean_reading_text(cells[6].get_text(strip=True))
            gospel = self.clean_reading_text(cells[7].get_text(strip=True))
        else:
            # Combined in one column
            gospel_text = cells[6].get_text(strip=True)
            # Try to split on common patterns
            if '|' in gospel_text:
                parts = gospel_text.split('|')
                gospel_acc = self.clean_reading_text(parts[0])
                gospel = self.clean_reading_text(parts[1]) if len(parts) > 1 else ''
            else:
                gospel_acc = ''
                gospel = self.clean_reading_text(gospel_text)

        # Skip if this is not a Sunday reading (Phase 1)
        if not self.is_sunday_reading(celebration_raw, date_col):
            return None

        # DEBUG: ALWAYS print first 10 readings to diagnose cycle extraction
        if len(self.readings_data) < 10:
            print(f"\n  DEBUG Reading #{len(self.readings_data) + 1}:")
            print(f"    celebration_raw: '{celebration_raw}'")
            print(f"    last 10 chars: {repr(celebration_raw[-10:])}")
            print(f"    last 10 bytes: {celebration_raw[-10:].encode('utf-8')}")

        # Extract celebration name and reading type
        celebration, reading_type = self.extract_reading_type(celebration_raw)

        # Determine cycle from celebration_raw (e.g., "1stSunday of Advent - A")
        # The cycle is usually at the end after a hyphen or en-dash
        year_indicator = 'ABC'  # Default to fixed

        # Use regex to extract cycle suffix more robustly
        # Matches: " - A", "- A", " – A", "– A", etc. (handles various dash types and spacing)
        # Try to find cycle pattern at end: any dash type, optional spaces, then A/B/C/ABC
        cycle_pattern = r'[\s\-–—]*([ABC]{1,3})$'
        match = re.search(cycle_pattern, celebration_raw)

        if match:
            year_indicator = match.group(1)
            # Remove the entire matched suffix from celebration name
            celebration = celebration_raw[:match.start()].strip()
            # Re-extract reading type from cleaned celebration
            celebration, reading_type = self.extract_reading_type(celebration)

            if len(self.readings_data) < 10:
                print(f"    ✓ Regex matched! Cycle: {year_indicator}")
                print(f"    ✓ Cleaned name: '{celebration}'")
        else:
            if len(self.readings_data) < 10:
                print(f"    ✗ Regex NO MATCH")
                print(f"    ✗ Testing pattern: {cycle_pattern}")

        cycle = self.determine_cycle(year_indicator)

        if len(self.readings_data) < 10:
            print(f"    → Final cycle: {cycle}")

        # Handle ABC (Fixed) celebrations - create one entry
        if cycle == 'Fixed':
            cycles_to_create = ['Fixed']
        # For single cycle, create one entry
        elif cycle in ['A', 'B', 'C']:
            cycles_to_create = [cycle]
        else:
            # Unknown cycle, skip
            return None

        results = []
        for cyc in cycles_to_create:
            entry = {
                'Liturgical Celebration': celebration,
                'Cycle': cyc,
                'Lectionary Number': lect_num,
                'Reading Type': reading_type,
                'First Reading': first_reading,
                'Responsorial Psalm': psalm,
                'Second Reading': second_reading,
                'Gospel Acclamation': gospel_acc,
                'Gospel': gospel,
                'Notes': f'Source: {season}'
            }
            results.append(entry)

        return results if results else None

    def scrape_season(self, season_name: str, page_filename: str):
        """Scrape all readings from a season page"""
        print(f"\n=== Scraping {season_name} ===")

        soup = self.fetch_page(page_filename)
        if not soup:
            print(f"Failed to fetch {season_name}")
            return

        # Find all tables on the page
        tables = soup.find_all('table')
        print(f"Found {len(tables)} table(s) on page")

        readings_count = 0
        for table_idx, table in enumerate(tables):
            rows = table.find_all('tr')

            for row_idx, row in enumerate(rows):
                # Skip header rows
                if row.find('th'):
                    continue

                # Parse the row
                entries = self.parse_table_row(row, season_name)
                if entries:
                    self.readings_data.extend(entries)
                    readings_count += len(entries)

        print(f"Extracted {readings_count} reading(s) from {season_name}")

    def scrape_all_seasons(self):
        """Scrape all season pages"""
        print("=" * 60)
        print("LITURGICAL READINGS SCRAPER - PHASE 1: SUNDAY CYCLES")
        print("=" * 60)

        for season_name, page_filename in SEASON_PAGES.items():
            self.scrape_season(season_name, page_filename)

        print(f"\n=== TOTAL: {len(self.readings_data)} readings extracted ===")

    def save_to_csv(self, output_filename: str = 'liturgical_readings_phase1.csv'):
        """Save scraped data to CSV file"""
        print(f"\nSaving to {output_filename}...")

        with open(output_filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_HEADERS)
            writer.writeheader()
            writer.writerows(self.readings_data)

        print(f"✓ Saved {len(self.readings_data)} readings to {output_filename}")

    def print_summary(self):
        """Print summary statistics"""
        if not self.readings_data:
            print("\nNo data to summarize")
            return

        print("\n" + "=" * 60)
        print("SUMMARY STATISTICS")
        print("=" * 60)

        # Count by cycle
        cycle_counts = {}
        for entry in self.readings_data:
            cycle = entry['Cycle']
            cycle_counts[cycle] = cycle_counts.get(cycle, 0) + 1

        print("\nReadings by Cycle:")
        for cycle in sorted(cycle_counts.keys()):
            print(f"  {cycle}: {cycle_counts[cycle]}")

        # Count by reading type
        type_counts = {}
        for entry in self.readings_data:
            rtype = entry['Reading Type']
            type_counts[rtype] = type_counts.get(rtype, 0) + 1

        print("\nReadings by Type:")
        for rtype in sorted(type_counts.keys()):
            print(f"  {rtype}: {type_counts[rtype]}")

        # Sample entries
        print("\nSample Entries (first 3):")
        for i, entry in enumerate(self.readings_data[:3]):
            print(f"\n  {i+1}. {entry['Liturgical Celebration']} (Cycle {entry['Cycle']})")
            print(f"     Lect#: {entry['Lectionary Number']}")
            print(f"     1st: {entry['First Reading'][:50]}...")
            print(f"     Gospel: {entry['Gospel'][:50]}...")


def main():
    """Main entry point"""
    # Check for offline mode flag
    offline_mode = '--offline' in sys.argv or '-o' in sys.argv

    if offline_mode:
        print("Running in OFFLINE mode (using local HTML files)")
    else:
        print("Running in ONLINE mode (fetching from website)")
        print("If you encounter 403 errors, use offline mode: --offline")

    scraper = LiturgicalReadingScraper(offline_mode=offline_mode)

    # Scrape all seasons
    scraper.scrape_all_seasons()

    # Print summary
    scraper.print_summary()

    # Save to CSV
    if len(scraper.readings_data) > 0:
        scraper.save_to_csv()
        print("\n✓ Scraping complete!")
        print("\nNext steps:")
        print("1. Review liturgical_readings_phase1.csv")
        print("2. Import into Google Sheets as 'LiturgicalReadings' sheet")
        print("3. Run Phase 2 for weekday cycles (I, II)")
    else:
        print("\n⚠ No data scraped. Check error messages above.")
        if not offline_mode:
            print("\nTry offline mode if seeing 403 errors:")
            print("1. Download HTML files from https://catholic-resources.org/Lectionary/")
            print(f"2. Place in '{OFFLINE_DIR}' directory")
            print("3. Run: python scrape_liturgical_readings.py --offline")


if __name__ == '__main__':
    main()
