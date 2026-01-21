from database import translations_collection
from services import translate_hadith
import datetime
import time
import os
from dotenv import load_dotenv

load_dotenv()

# Pro Plan: Higher limits, but still good to be safe. 
# 0.5s delay = ~120 RPM. 
SLEEP_INTERVAL = 0.5 

def batch_translate():
    print("Starting batch translation...")
    
    # Find all untranslated hadiths
    query = {"status": {"$ne": "translated"}}
    total_pending = translations_collection.count_documents(query)
    
    print(f"Found {total_pending} hadiths pending translation.")
    
    cursor = translations_collection.find(query)
    
    count = 0
    errors = 0
    
    for hadith in cursor:
        hadith_id = hadith.get("hadith_id")
        print(f"Translating {hadith_id} ({count + 1}/{total_pending})...")
        
        try:
            translation_result = translate_hadith(hadith)
            
            # Update DB
            mongo_update = {
                "$set": {
                    "kitab.th": translation_result.get("kitab_th"),
                    "bab.th": translation_result.get("bab_th"),
                    "content.th": translation_result.get("content_th"),
                    "status": "translated",
                    "last_updated": datetime.datetime.utcnow(),
                    "translation_notes": translation_result.get("notes")
                }
            }
            
            translations_collection.update_one({"hadith_id": hadith_id}, mongo_update)
            count += 1
            
        except Exception as e:
            print(f"Error translating {hadith_id}: {e}")
            errors += 1
            
        time.sleep(SLEEP_INTERVAL)

    print(f"Batch translation complete. Success: {count}, Errors: {errors}")

if __name__ == "__main__":
    batch_translate()
