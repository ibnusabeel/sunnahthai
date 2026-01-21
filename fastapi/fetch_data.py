import urllib.request
import json
import os
from database import translations_collection
from datetime import datetime

URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari.min.json"

def fetch_and_import():
    print(f"Fetching data from {URL}...")
    try:
        with urllib.request.urlopen(URL) as response:
            data = json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    metadata_sections = data.get("metadata", {}).get("sections", {})
    hadiths = data.get("hadiths", [])
    
    print(f"Found {len(hadiths)} hadiths. Starting import...")
    
    count = 0
    errors = 0
    
    for h in hadiths:
        try:
            hadith_number = h.get("hadithnumber")
            if not hadith_number:
                continue
                
            hadith_id = f"bukhari_{hadith_number}"
            
            # Check for duplicate
            if translations_collection.find_one({"hadith_id": hadith_id}):
                print(f"Skipping duplicate: {hadith_id}")
                continue
            
            # Get Book Name (Kitab)
            book_ref = h.get("reference", {}).get("book")
            book_name = metadata_sections.get(str(book_ref), "Unknown Book")
            
            # Hadith Text
            text = h.get("text", "")
            
            # Construct Document
            doc = {
                "hadith_id": hadith_id,
                "kitab": {
                    "ar": book_name, # Note: This is English from the API, but field is required
                    "th": None
                },
                "bab": {
                    "ar": "", # API does not provide distinct Bab titles easily
                    "th": None
                },
                "content": {
                    "ar": text,
                    "th": None
                },
                "status": "pending_translation",
                "created_at": datetime.utcnow()
            }
            
            translations_collection.insert_one(doc)
            count += 1
            
            if count % 100 == 0:
                print(f"Imported {count} hadiths...")
                
        except Exception as e:
            print(f"Error importing hadith {h}: {e}")
            errors += 1
            
    print(f"Import complete. Imported: {count}, Errors: {errors}")

if __name__ == "__main__":
    fetch_and_import()
