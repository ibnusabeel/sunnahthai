import csv
import re
from database import translations_collection
from pymongo import UpdateOne

def update_bukhari():
    print("🚀 Starting update for Bukhari kitabs...")
    
    # Step 1: CLEAR all existing kitabs for Bukhari
    print("🧹 Clearing all existing Kitab data for Bukhari...")
    translations_collection.update_many(
        {"hadith_book": "bukhari"},
        {"$unset": {"kitab": ""}}
    )
    print("✅ Cleared.")

    updates = []
    
    with open('bukhari_kitabs.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 4:
                continue
                
            index = row[0]
            th_name = row[1].strip()
            ar_name = row[2].strip()
            range_str = row[3].strip()
            
            # Parse range "1to7" -> start=1, end=7
            if 'to' in range_str:
                start_str, end_str = range_str.split('to')
                try:
                    start = int(start_str)
                    end = int(end_str)
                    
                    # Generate list of IDs in range (as strings)
                    target_ids = [str(i) for i in range(start, end + 1)]
                    
                    # Create update operation for all hadiths in this range
                    # Note: This checks hadith_no as string. 
                    # If DB has "1" it works. If DB has 1 (int), we might need to check.
                    # Based on project, IDs are likely strings.
                    
                    from pymongo import UpdateMany
                    
                    updates.append(UpdateMany(
                        {"hadith_book": "bukhari", "hadith_no": {"$in": target_ids}},
                        {"$set": {
                            "kitab.th": th_name, 
                            "kitab.ar": ar_name,
                            "kitab.id": int(index)
                        }}
                    ))
                    
                    print(f"Prepared update for Kitab {index}: {th_name} ({start}-{end})")
                    
                except ValueError as e:
                    print(f"Error parsing range {range_str}: {e}")
            else:
                print(f"Invalid range format: {range_str}")

    if updates:
        print(f"\n📦 Executing {len(updates)} bulk updates...")
        result = translations_collection.bulk_write(updates)
        print(f"✅ Matched: {result.matched_count}")
        print(f"✨ Modified: {result.modified_count}")
    else:
        print("No updates prepared.")

if __name__ == "__main__":
    update_bukhari()
