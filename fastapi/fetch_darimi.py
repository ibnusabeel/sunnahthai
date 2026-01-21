"""
Fetch Sunan ad-Darimi from GitHub JSON API
Arabic only - no Indonesian translation
"""

import requests
from database import translations_collection
from datetime import datetime

JSON_URL = "https://raw.githubusercontent.com/gadingnst/hadith-api/refs/heads/master/books/darimi.json"
BOOK_NAME = "darimi"

def fetch_darimi():
    print(f"📖 Fetching Sunan ad-Darimi from GitHub...")
    
    # Download JSON
    response = requests.get(JSON_URL)
    response.raise_for_status()
    hadiths = response.json()
    
    print(f"📊 Found {len(hadiths)} hadiths")
    
    # Check existing
    existing = translations_collection.count_documents({"hadith_book": BOOK_NAME})
    print(f"📦 Existing in database: {existing}")
    
    inserted = 0
    updated = 0
    
    for hadith in hadiths:
        number = hadith.get("number", 0)
        arabic = hadith.get("arab", "").strip()
        
        if not arabic:
            continue
        
        hadith_id = f"{BOOK_NAME}_{number}"
        
        # Check if exists
        existing_doc = translations_collection.find_one({"hadith_id": hadith_id})
        
        if existing_doc:
            # Update if Arabic is missing
            if not existing_doc.get("content", {}).get("ar"):
                translations_collection.update_one(
                    {"hadith_id": hadith_id},
                    {"$set": {"content.ar": arabic}}
                )
                updated += 1
        else:
            # Insert new
            doc = {
                "hadith_id": hadith_id,
                "hadith_book": BOOK_NAME,
                "hadith_no": str(number),
                "kitab": {
                    "ar": "سنن الدارمي",
                    "th": "",
                    "en": "Sunan ad-Darimi"
                },
                "bab": {
                    "ar": "",
                    "th": "",
                    "en": ""
                },
                "content": {
                    "ar": arabic,
                    "th": ""  # Will be translated later
                },
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            translations_collection.insert_one(doc)
            inserted += 1
    
    print(f"\n✅ Done!")
    print(f"  - New hadiths inserted: {inserted}")
    print(f"  - Existing hadiths updated: {updated}")
    print(f"  - Total in database: {translations_collection.count_documents({'hadith_book': BOOK_NAME})}")

if __name__ == "__main__":
    fetch_darimi()
