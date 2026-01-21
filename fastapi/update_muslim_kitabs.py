import csv
import re
from database import translations_collection
from pymongo import UpdateMany

def update_muslim():
    print("🚀 Starting update for Muslim kitabs...")
    
    # Step 1: CLEAR all existing kitabs for Muslim
    print("🧹 Clearing all existing Kitab data for Muslim...")
    translations_collection.update_many(
        {"hadith_book": "muslim"},
        {"$unset": {"kitab": ""}}
    )
    print("✅ Cleared.")

    updates = []
    
    with open('muslim_kitabs.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 4:
                continue
            
            # ID, Book_Name_TH, Book_Name_AR, Hadith_Range
            index_str = row[0].strip()
            th_name = row[1].strip()
            ar_name = row[2].strip()
            range_str = row[3].strip()
            
            # Handle "Intro" -> ID 0
            if index_str.lower() == "intro":
                index = 0
            else:
                try:
                    index = int(index_str)
                except ValueError:
                    print(f"Skipping invalid index: {index_str}")
                    continue
            
            # Parse range "1to7" -> start=1, end=7
            if 'to' in range_str:
                start_str, end_str = range_str.split('to')
                try:
                    start = int(start_str)
                    end = int(end_str)
                    
                    # Generate list of IDs in range (as strings)
                    target_ids = [str(i) for i in range(start, end + 1)]
                    
                    # Create update operation
                    updates.append(UpdateMany(
                        {"hadith_book": "muslim", "hadith_no": {"$in": target_ids}},
                        {"$set": {
                            "kitab.th": th_name, 
                            "kitab.ar": ar_name,
                            "kitab.id": index
                        }}
                    ))
                    
                    print(f"Prepared update for Kitab {index}: {th_name} ({start}-{end})")
                    
                except ValueError as e:
                    print(f"Error parsing range {range_str}: {e}")
            else:
                print(f"Invalid range format: {range_str}")

    if updates:
        print(f"\n📦 Executing {len(updates)} bulk updates for Muslim...")
        # Note: bulk_write handles a mix of operations, but here we only have UpdateMany
        result = translations_collection.bulk_write(updates)
        print(f"✅ Matched: {result.matched_count}")
        print(f"✨ Modified: {result.modified_count}")
    else:
        print("No updates prepared.")

if __name__ == "__main__":
    update_muslim()
