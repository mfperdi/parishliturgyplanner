#!/usr/bin/env python3
"""
Debug script to see what's actually in the scraped celebration names
"""

import csv

# Read the CSV
with open('liturgical_readings_phase1.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)

    print("First 10 celebration names from CSV:")
    print("=" * 80)

    for i, row in enumerate(reader):
        if i >= 10:
            break

        celebration = row['Liturgical Celebration']
        cycle = row['Cycle']

        print(f"\nRow {i+1}:")
        print(f"  Celebration: '{celebration}'")
        print(f"  Cycle: {cycle}")
        print(f"  Length: {len(celebration)}")
        print(f"  Last 5 chars: {repr(celebration[-5:])}")
        print(f"  Bytes: {celebration.encode('utf-8')[-10:]}")
