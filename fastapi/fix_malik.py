from database import kitabs_collection, translations_collection
from datetime import datetime, timezone

def fix_malik_kitabs():
    """
    Fix malik kitabs in database.
    1. Remove existing malik kitabs from kitabs_collection.
    2. Analyze hadiths to extract proper kitabs.
    3. Re-insert unique kitabs.
    """
    print("🧹 Cleaning up old Malik kitabs...")
    kitabs_collection.delete_many({"book": "malik"})
    
    print("\n🔍 Analyzing Malik hadiths structure...")
    
    # Check if hadiths have proper kitab info
    # We aggregate by English name if Thai/Arabic are inconsistent
    pipeline = [
        {"$match": {"hadith_book": "malik"}},
        {"$group": {
            "_id": {
                "en": "$kitab.en",
                "th": "$kitab.th", 
                "ar": "$kitab.ar"
            },
            "count": {"$sum": 1},
            "min_hadith": {"$min": {"$toInt": "$hadith_no"}}
        }},
        {"$sort": {"min_hadith": 1}}
    ]
    
    results = list(translations_collection.aggregate(pipeline))
    print(f"📊 Found {len(results)} unique kitabs in hadiths.")
    
    # Insert cleanly
    for i, res in enumerate(results):
        names = res["_id"]
        
        # Determine names
        name_en = names.get("en", "") or ""
        name_ar = names.get("ar", "") or ""
        name_th = names.get("th", "") or ""
        
        # Skip if all empty
        if not name_en and not name_ar and not name_th:
            continue
            
        # Create stable ID
        # Prefer English slug if available, else sequential
        slug = name_en.lower().replace(" ", "_").replace("'", "") if name_en else f"kitab_{i+1}"
        kitab_id = f"malik_{slug}"
        
        doc = {
            "kitab_id": kitab_id,
            "book": "malik",
            "order": i + 1,
            "name": {
                "th": name_th,
                "ar": name_ar,
                "en": name_en
            },
            "hadith_count": res["count"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        kitabs_collection.insert_one(doc)
        print(f"   + Added: {name_th or name_en} ({res['count']} hadiths)")

    print("\n✅ Malik kitabs fixed!")

if __name__ == "__main__":
    fix_malik_kitabs()
