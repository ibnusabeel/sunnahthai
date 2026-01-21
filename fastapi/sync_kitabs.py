from database import translations_collection, kitabs_collection
from datetime import datetime, timezone

def sync_kitabs_for_books(books):
    """
    Sync kitabs from translations_collection to kitabs_collection for specific books.
    This ensures all kitabs are editable in the admin dashboard.
    """
    for book in books:
        print(f"\n📚 Syncing kitabs for: {book}...")
        
        # Aggregate unique kitabs from existing translations
        pipeline = [
            {"$match": {"hadith_book": book}},
            {"$addFields": {
                "hadith_no_int": {
                    "$convert": {
                        "input": "$hadith_no",
                        "to": "int",
                        "onError": 9999999,
                        "onNull": 9999999
                    }
                }
            }},
            {"$group": {
                "_id": {"ar": "$kitab.ar", "th": "$kitab.th"},
                "en": {"$first": "$kitab.en"},
                "id": {"$min": "$kitab.id"},
                "min_hadith": {"$min": "$hadith_no_int"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"min_hadith": 1}}
        ]
        
        results = list(translations_collection.aggregate(pipeline))
        print(f"   Found {len(results)} kitabs in hadiths data.")
        
        synced_count = 0
        new_count = 0
        
        for i, res in enumerate(results):
            # Extract basic data
            # NOTE: For Malik/Darimi, kitab.id might be missing or raw.
            # We will use the 'id' from aggregation if available, OR fallback to loop index + 1
            
            raw_id = res.get("id")
            
            # Determine order
            order = i + 1
            if raw_id:
                try:
                    order = int(raw_id)
                except:
                    pass
            
            # Construct kitab_id
            # NOTE: We must ensure this ID is stable.
            # If we used numeric IDs before, stick to them.
            # New format suggestion: {book}_kitab_{order}
            
            # Check for existing kitab entry by trying to match name or order
            # But really we just want to fill holes.
            
            name_th = res["_id"].get("th", "") or ""
            name_ar = res["_id"].get("ar", "") or ""
            name_en = res.get("en", "") or ""
            
            if not name_th and not name_ar:
                print(f"   Skip empty kitab info")
                continue
                
            # Create a deterministic ID based on book and order if possible
            # But the 'edit' feature relies on the ID being persistent.
            # Let's check if we can find an existing kitab with similar names to avoid duplication
            
            existing = kitabs_collection.find_one({
                "book": book,
                "$or": [
                    {"name.th": name_th},
                    {"name.ar": name_ar}
                ]
            })
            
            if existing:
                # Update counts or names if needed?
                # For now just update count
                kitabs_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"hadith_count": res["count"]}}
                )
                synced_count += 1
            else:
                # Create NEW
                new_kitab_id = f"{book}_kitab_{order}"
                
                # Verify ID uniqueness
                while kitabs_collection.find_one({"kitab_id": new_kitab_id}):
                    new_kitab_id += f"_{datetime.now().timestamp()}"
                
                new_doc = {
                    "kitab_id": new_kitab_id,
                    "book": book,
                    "order": order,
                    "name": {
                        "th": name_th,
                        "ar": name_ar,
                        "en": name_en
                    },
                    "hadith_count": res["count"],
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                kitabs_collection.insert_one(new_doc)
                new_count += 1
                
        print(f"   ✅ Synced: {synced_count} existing, {new_count} new created.")

if __name__ == "__main__":
    # Sync for malik and darimi specifically
    sync_kitabs_for_books(["malik", "darimi"])
