import requests
from database import translations_collection, kitabs_collection
from datetime import datetime, timezone

JSON_URL = "https://raw.githubusercontent.com/gadingnst/hadith-api/refs/heads/master/books/ahmad.json"
BOOK_NAME = "ahmad"
KITAB_NAME_TH = "มุสนัด อะห์มัด"
KITAB_NAME_AR = "مسند أحمد"
KITAB_NAME_EN = "Musnad Ahmad"

def fetch_ahmad():
    print(f"📖 Fetching {KITAB_NAME_EN} from GitHub...")
    
    # Download JSON
    try:
        response = requests.get(JSON_URL)
        response.raise_for_status()
        hadiths = response.json()
    except Exception as e:
        print(f"❌ Failed to download: {e}")
        return
    
    print(f"📊 Found {len(hadiths)} hadiths")
    
    # Upsert Kitab Entry first
    kitab_id = f"{BOOK_NAME}_default"
    kitab_doc = {
        "kitab_id": kitab_id,
        "book": BOOK_NAME,
        "order": 1,
        "name": {
            "th": KITAB_NAME_TH,
            "ar": KITAB_NAME_AR,
            "en": KITAB_NAME_EN
        },
        "hadith_count": len(hadiths),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    kitabs_collection.update_one(
        {"kitab_id": kitab_id},
        {"$set": kitab_doc},
        upsert=True
    )
    print(f"✅ Kitab entry synced.")
    
    inserted = 0
    updated = 0
    
    # Batch ops for speed? Pymongo individual is slow for 26k hadiths potentially.
    # Ahmad is huge. 26k?
    # Let's check length first.
    
    for i, hadith in enumerate(hadiths):
        number = hadith.get("number", 0)
        # Only take Arabic
        arabic = hadith.get("arab", "").strip()
        
        if not arabic:
            continue
        
        hadith_id = f"{BOOK_NAME}_{number}"
        
        doc = {
            "hadith_id": hadith_id,
            "hadith_book": BOOK_NAME,
            "hadith_no": str(number),
            "kitab_id": kitab_id,  # Link to new kitab system directly
            "kitab": { # Keep legacy format for fallback
                "ar": KITAB_NAME_AR,
                "th": KITAB_NAME_TH,
                "en": KITAB_NAME_EN
            },
            "bab": {
                "ar": "",
                "th": "",
                "en": ""
            },
            "content": {
                "ar": arabic,
                "th": "" # No Indo
            },
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Upsert
        res = translations_collection.update_one(
            {"hadith_id": hadith_id},
            {"$set": doc},
            upsert=True
        )
        
        if res.upserted_id:
            inserted += 1
        else:
            updated += 1
            
        if (i + 1) % 100 == 0:
            print(f"   Processed {i + 1}/{len(hadiths)}...")

    print(f"\n✅ Done!")
    print(f"  - New: {inserted}")
    print(f"  - Updated: {updated}")

if __name__ == "__main__":
    fetch_ahmad()
