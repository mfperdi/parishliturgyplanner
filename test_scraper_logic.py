#!/usr/bin/env python3
"""
Test script to validate scraper parsing logic using sample data
Uses actual Christmas data structure from catholic-resources.org
"""

from bs4 import BeautifulSoup
import csv

# Sample HTML from Christmas page (provided by user)
SAMPLE_HTML = """
<table border="1" cellpadding="5">
<tr bgcolor="#CCCCFF">
<th>Date</th>
<th>#</th>
<th>Sunday or Feast - Year</th>
<th>First Reading</th>
<th>Responsorial Psalm</th>
<th>Second Reading</th>
<th>Alleluia</th>
<th>Gospel</th>
</tr>
<tr bgcolor="#FFCCFF">
<td>Dec. 24</td>
<td>13</td>
<td>Vigil - ABC</td>
<td>Isa 62:1-5</td>
<td>Ps 89:4-5, 16-17, 27, 29</td>
<td>Acts 13:16-17, 22-25</td>
<td>-</td>
<td>Matt 1:1-25</td>
</tr>
<tr bgcolor="#FFCCFF">
<td>Dec. 25</td>
<td>14</td>
<td>At the Mass at Night - ABC</td>
<td>Isa 9:1-6</td>
<td>Ps 96:1-2, 2-3, 11-12, 13</td>
<td>Titus 2:11-14</td>
<td>Luke 2:10-11</td>
<td>Luke 2:1-14</td>
</tr>
<tr bgcolor="#FFCCFF">
<td>Dec. 25</td>
<td>15</td>
<td>At the Mass at Dawn - ABC</td>
<td>Isa 62:11-12</td>
<td>Ps 97:1, 6, 11-12</td>
<td>Titus 3:4-7</td>
<td>Luke 2:14</td>
<td>Luke 2:15-20</td>
</tr>
<tr bgcolor="#FFCCFF">
<td>Dec. 25</td>
<td>16</td>
<td>At the Mass during the Day - ABC</td>
<td>Isa 52:7-10</td>
<td>Ps 98:1, 2-3, 3-4, 5-6</td>
<td>Heb 1:1-6</td>
<td>-</td>
<td>John 1:1-18</td>
</tr>
<tr>
<td>Dec. 26</td>
<td>17</td>
<td>St. Stephen, First Martyr - ABC</td>
<td>Acts 6:8-10; 7:54-59</td>
<td>Ps 31:3-4, 6+8, 16-17</td>
<td>-</td>
<td>Ps 118:26, 27</td>
<td>Matt 10:17-22</td>
</tr>
<tr>
<td>Dec. 27</td>
<td>18</td>
<td>St. John, Apostle - ABC</td>
<td>1 John 1:1-4</td>
<td>Ps 97:1-2, 5-6, 11-12</td>
<td>-</td>
<td>John 1:14, 12</td>
<td>John 20:1a,2-8</td>
</tr>
<tr>
<td>Dec. 28</td>
<td>19</td>
<td>Holy Innocents, Martyrs - ABC</td>
<td>1 John 1:5-2:2</td>
<td>Ps 124:2-3, 4-5, 7-8</td>
<td>-</td>
<td>-</td>
<td>Matt 2:13-18</td>
</tr>
<tr>
<td>Sun. after Dec. 25</td>
<td>20</td>
<td>Sunday in the Octave - Holy Family - ABC</td>
<td>Sir 3:2-6,12-14</td>
<td>Ps 128:1-2,3,4-5</td>
<td>Col 3:12-21</td>
<td>Acts 16:14</td>
<td>Matt 2:13-15,19-23</td>
</tr>
</table>
"""

def test_parse_christmas_data():
    """Test parsing logic with sample Christmas data"""

    print("=" * 70)
    print("TESTING SCRAPER PARSING LOGIC - CHRISTMAS SAMPLE DATA")
    print("=" * 70)

    # Parse HTML
    soup = BeautifulSoup(SAMPLE_HTML, 'html.parser')
    table = soup.find('table')

    if not table:
        print("ERROR: No table found in sample HTML")
        return

    rows = table.find_all('tr')
    print(f"\nFound {len(rows)} rows in table (including header)")

    # Skip header row
    data_rows = [r for r in rows if not r.find('th')]
    print(f"Processing {len(data_rows)} data rows\n")

    results = []

    for idx, row in enumerate(data_rows, 1):
        cells = row.find_all('td')

        if len(cells) < 7:
            print(f"Row {idx}: Skipping (insufficient columns)")
            continue

        # Extract data
        date_col = cells[0].get_text(strip=True)
        lect_num = cells[1].get_text(strip=True)
        celebration_raw = cells[2].get_text(strip=True)
        first_reading = cells[3].get_text(strip=True)
        psalm = cells[4].get_text(strip=True)
        second_reading = cells[5].get_text(strip=True)
        gospel_acc = cells[6].get_text(strip=True)
        gospel = cells[7].get_text(strip=True)

        # Parse celebration and reading type
        celebration = celebration_raw
        reading_type = 'Standard'

        # Extract reading type from parenthetical or explicit text
        if 'Vigil' in celebration:
            reading_type = 'Vigil'
            celebration = 'The Nativity of the Lord'
        elif 'At the Mass at Night' in celebration:
            reading_type = 'Night'
            celebration = 'The Nativity of the Lord'
        elif 'At the Mass at Dawn' in celebration:
            reading_type = 'Dawn'
            celebration = 'The Nativity of the Lord'
        elif 'At the Mass during the Day' in celebration:
            reading_type = 'Day'
            celebration = 'The Nativity of the Lord'
        elif 'Holy Family' in celebration:
            celebration = 'The Holy Family of Jesus, Mary and Joseph'
        elif 'St. Stephen' in celebration:
            celebration = 'Saint Stephen, the First Martyr'
        elif 'St. John' in celebration:
            celebration = 'Saint John, Apostle and Evangelist'
        elif 'Holy Innocents' in celebration:
            celebration = 'The Holy Innocents, Martyrs'

        # Determine cycle from celebration_raw (e.g., "1stSunday of Advent - A")
        if celebration_raw.endswith('- A') or celebration_raw.endswith('-A'):
            cycle = 'A'
            celebration = celebration.replace('- A', '').replace('-A', '').strip()
        elif celebration_raw.endswith('- B') or celebration_raw.endswith('-B'):
            cycle = 'B'
            celebration = celebration.replace('- B', '').replace('-B', '').strip()
        elif celebration_raw.endswith('- C') or celebration_raw.endswith('-C'):
            cycle = 'C'
            celebration = celebration.replace('- C', '').replace('-C', '').strip()
        elif celebration_raw.endswith('- ABC') or celebration_raw.endswith('-ABC'):
            cycle = 'Fixed'
            celebration = celebration.replace('- ABC', '').replace('-ABC', '').strip()
        else:
            # No cycle suffix means it's a fixed celebration (same every year)
            cycle = 'Fixed'

        # Create entry
        entry = {
            'Liturgical Celebration': celebration,
            'Cycle': cycle,
            'Lectionary Number': lect_num,
            'Reading Type': reading_type,
            'First Reading': first_reading,
            'Responsorial Psalm': psalm,
            'Second Reading': second_reading if second_reading != '-' else '',
            'Gospel Acclamation': gospel_acc if gospel_acc != '-' else '',
            'Gospel': gospel,
            'Notes': f'Source: Christmas, Date: {date_col}'
        }

        results.append(entry)

        # Print parsed result
        print(f"Row {idx}: {celebration} (Cycle {cycle})")
        print(f"  Lect#: {lect_num}, Type: {reading_type}")
        print(f"  1st: {first_reading}")
        print(f"  Psalm: {psalm}")
        print(f"  2nd: {second_reading}")
        print(f"  Gospel: {gospel}")
        print()

    # Save to CSV
    output_file = 'test_christmas_readings.csv'

    headers = [
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

    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()
        writer.writerows(results)

    print("=" * 70)
    print(f"✓ Successfully parsed {len(results)} readings")
    print(f"✓ Saved to {output_file}")
    print("=" * 70)

    # Print summary
    print("\nSUMMARY:")
    print(f"  Total readings: {len(results)}")
    print(f"  Unique celebrations: {len(set(r['Liturgical Celebration'] for r in results))}")
    print(f"  Reading types: {set(r['Reading Type'] for r in results)}")
    print(f"  Cycles: {set(r['Cycle'] for r in results)}")

    print("\nSample CSV rows:")
    for i, entry in enumerate(results[:3], 1):
        print(f"\n{i}. {entry['Liturgical Celebration']}")
        print(f"   Cycle={entry['Cycle']}, Lect#={entry['Lectionary Number']}, Type={entry['Reading Type']}")

if __name__ == '__main__':
    test_parse_christmas_data()
