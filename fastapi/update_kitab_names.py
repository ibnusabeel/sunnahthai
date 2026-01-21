from database import translations_collection
import re

def replace_book_with_category():
    print("🚀 Starting text replacement: 'หนังสือ' -> 'หมวด' in kitab.th...")
    
    # Check counts first
    count_query = {"kitab.th": {"$regex": "หนังสือ"}}
    total_matches = translations_collection.count_documents(count_query)
    print(f"Found {total_matches} documents containing 'หนังสือ' in kitab.th")
    
    if total_matches == 0:
        print("No documents to update.")
        return

    # Use aggregation to list affected kitabs (for verification)
    pipeline = [
        {"$match": count_query},
        {"$group": {"_id": "$kitab.th"}},
        {"$limit": 10}
    ]
    sample_kitabs = list(translations_collection.aggregate(pipeline))
    print("\nSample Kitabs to be updated:")
    for k in sample_kitabs:
        print(f" - {k['_id']}")

    print("\n📦 Updating...")
    
    # Perform update using aggregation pipeline for efficiency (requires MongoDB 4.2+)
    # This allows us to use $replaceOne directly in the update
    
    result = translations_collection.update_many(
        count_query,
        [
            {
                "$set": {
                    "kitab.th": {
                        "$replaceOne": {
                            "input": "$kitab.th",
                            "find": "หนังสือ",
                            "replacement": "หมวด"
                        }
                    }
                }
            }
        ]
    )
    
    print(f"✅ Matched: {result.matched_count}")
    print(f"✨ Modified: {result.modified_count}")
    
    # Also verify some updates
    print("\nVerifying updates...")
    verify_pipeline = [
        {"$match": {"kitab.th": {"$regex": "หมวด"}}},
        {"$group": {"_id": "$kitab.th"}},
        {"$limit": 5}
    ]
    updated_samples = list(translations_collection.aggregate(verify_pipeline))
    for k in updated_samples:
        print(f" - {k['_id']}")

if __name__ == "__main__":
    replace_book_with_category()
