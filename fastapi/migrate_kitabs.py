"""
Migration Script: Normalize Kitabs
Extracts kitabs from hadiths collection into separate kitabs collection
"""

from database import translations_collection, db
from datetime import datetime
from bson import ObjectId

# Create or get kitabs collection
kitabs_collection = db["kitabs"]

def migrate_kitabs():
    print("🚀 Starting Kitabs Normalization Migration...")
    
    # Step 1: Extract unique kitabs from each book
    books = ["bukhari", "muslim", "nasai", "tirmidhi", "abudawud", "ibnmajah"]
    
    for book in books:
        print(f"\n📖 Processing {book}...")
        
        # Aggregate unique kitabs with min/max hadith numbers
        pipeline = [
            {"$match": {"hadith_book": book, "kitab": {"$exists": True}}},
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
                "_id": {
                    "ar": "$kitab.ar",
                    "th": "$kitab.th"
                },
                "en": {"$first": "$kitab.en"},
                "order": {"$min": "$kitab.id"},
                "min_hadith": {"$min": "$hadith_no_int"},
                "max_hadith": {"$max": "$hadith_no_int"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"order": 1, "min_hadith": 1}}
        ]
        
        result = list(translations_collection.aggregate(pipeline))
        print(f"  Found {len(result)} unique kitabs")
        
        # Step 2: Insert kitabs into new collection
        inserted = 0
        for i, doc in enumerate(result):
            kitab_id = f"{book}_{i + 1}"
            
            # Check if already exists
            existing = kitabs_collection.find_one({"kitab_id": kitab_id})
            if existing:
                print(f"  Skipping existing: {kitab_id}")
                continue
            
            kitab_doc = {
                "kitab_id": kitab_id,
                "book": book,
                "order": doc.get("order") or (i + 1),
                "name": {
                    "ar": doc["_id"].get("ar", "") or "",
                    "th": doc["_id"].get("th", "") or "",
                    "en": doc.get("en", "") or ""
                },
                "hadith_range": {
                    "start": doc.get("min_hadith", 0),
                    "end": doc.get("max_hadith", 0)
                },
                "hadith_count": doc.get("count", 0),
                "description": "",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            kitabs_collection.insert_one(kitab_doc)
            inserted += 1
        
        print(f"  ✅ Inserted {inserted} new kitabs")
        
        # Step 3: Update hadiths to use kitab_id reference
        print(f"  Updating hadiths with kitab_id references...")
        
        # Get all kitabs for this book
        book_kitabs = list(kitabs_collection.find({"book": book}))
        
        updated_count = 0
        for kitab in book_kitabs:
            # Find hadiths that match this kitab's name
            query = {
                "hadith_book": book,
                "$or": [
                    {"kitab.th": kitab["name"]["th"]},
                    {"kitab.ar": kitab["name"]["ar"]}
                ]
            }
            
            # Skip if th and ar are both empty
            if not kitab["name"]["th"] and not kitab["name"]["ar"]:
                continue
            
            # Update to add kitab_id
            result = translations_collection.update_many(
                query,
                {"$set": {"kitab_id": kitab["kitab_id"]}}
            )
            updated_count += result.modified_count
        
        print(f"  ✅ Updated {updated_count} hadiths with kitab_id")
    
    # Create indexes
    print("\n📇 Creating indexes...")
    kitabs_collection.create_index([("kitab_id", 1)], unique=True)
    kitabs_collection.create_index([("book", 1), ("order", 1)])
    translations_collection.create_index([("kitab_id", 1)])
    print("  ✅ Indexes created")
    
    print("\n🎉 Migration complete!")
    
    # Summary
    total_kitabs = kitabs_collection.count_documents({})
    print(f"\n📊 Summary:")
    print(f"  Total kitabs in collection: {total_kitabs}")
    for book in books:
        count = kitabs_collection.count_documents({"book": book})
        print(f"  - {book}: {count} kitabs")

if __name__ == "__main__":
    migrate_kitabs()
