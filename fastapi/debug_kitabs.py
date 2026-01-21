from database import translations_collection

def debug_kitabs():
    pipeline = [
        {"$match": {"hadith_book": "bukhari"}},
        {"$group": {
            "_id": {"ar": "$kitab.ar", "th": "$kitab.th"},
            "en": {"$first": "$kitab.en"},
            "id": {"$min": "$kitab.id"},
            "count": {"$sum": 1},
            "sample_no": {"$first": "$hadith_no"}
        }},
        {"$sort": {"id": 1}}
    ]
    
    results = list(translations_collection.aggregate(pipeline))
    
    print(f"Total unique kitabs found: {len(results)}")
    
    no_id_count = 0
    print("\nSample Kitabs with NO ID (Not updated):")
    for r in results:
        if r.get('id') is None:
            no_id_count += 1
            if no_id_count <= 20: # Print first 20
                print(f" - TH: {r['_id']['th']} | AR: {r['_id']['ar']} | Count: {r['count']} | Sample No: {r['sample_no']}")
    
    print(f"\nTotal Kitabs without ID: {no_id_count}")
    print(f"Total Kitabs WITH ID: {len(results) - no_id_count}")

if __name__ == "__main__":
    debug_kitabs()
