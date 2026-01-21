import os
import time
import json
import google.generativeai as genai
from database import translations_collection, kitabs_collection
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# Configure
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")
BOOK = "darimi"
TARGET_TOTAL = 3367

def get_missing_numbers():
    print(f"🔍 Scanning {BOOK} hadiths...")
    
    cursor = translations_collection.find({"hadith_book": BOOK}, {"hadith_no": 1})
    existing_numbers = set()
    
    for doc in cursor:
        try:
            num = int(doc["hadith_no"])
            existing_numbers.add(num)
        except:
            pass
            
    print(f"   Found {len(existing_numbers)} existing hadiths.")
    
    missing = []
    for i in range(1, TARGET_TOTAL + 1):
        if i not in existing_numbers:
            missing.append(i)
            
    print(f"   ❌ Missing {len(missing)} hadith numbers (Target: {TARGET_TOTAL})")
    
    # Print sample of missing
    if missing:
        print(f"   Sample missing: {missing[:10]} ... {missing[-5:]}")
        
    return missing

def generate_and_fill(number):
    print(f"\n🔄 Generatin data for Hadith #{number}...")
    
    prompt = f"""Retrieve the Arabic text (Matn) and translate to Thai for:
Book: Sunan ad-Darimi
Hadith Number: {number}

Instructions:
1. Find the accurate Arabic text for this specific hadith number in Sunan ad-Darimi.
2. Translate it to Thai (keep it natural and accurate).
3. Identify the Kitab (General Chapter) name if possible (in Arabic and Thai).

Return ONLY valid JSON:
{{
  "ar": "arabic text here",
  "th": "thai translation here",
  "kitab_ar": "kitab name arabic",
  "kitab_th": "kitab name thai"
}}

If this hadith number DEFINITELY does not exist in standard Sunan ad-Darimi numbering, return null.
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        
        if text.lower() == "null":
            print(f"   ⚠️ Gemini returned null (Hadith might not exist).")
            return False
            
        data = json.loads(text)
        
        # Validate keys
        if not data.get("ar") or not data.get("th"):
            print(f"   ❌ Invalid JSON data received.")
            return False
            
        # Insert
        doc = {
            "hadith_id": f"{BOOK}_{number}",
            "hadith_book": BOOK,
            "hadith_no": str(number),
            "kitab": {
                "ar": data.get("kitab_ar", "سنن الدارمي"),
                "th": data.get("kitab_th", "สุนันดาริมี"),
                "en": "Sunan ad-Darimi"
            },
            "bab": {
                "ar": "",
                "th": "",
                "en": ""
            },
            "content": {
                "ar": data["ar"],
                "th": data["th"]
            },
            "status": "translated",  # Auto-translated by AI
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "source": "gemini_fill"
        }
        
        translations_collection.insert_one(doc)
        print(f"   ✅ Inserted Hadith #{number}")
        
        # Also update kitabs collection if we have new kitab info?
        # For now, let's just insert the hadith. 
        # sync_kitabs can be run later to normalize.
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        time.sleep(5)
        return False

def main():
    missing = get_missing_numbers()
    
    if not missing:
        print("✅ No missing hadiths!")
        return
        
    print(f"\n🚀 Starting generation for {len(missing)} hadiths...")
    print("Press Ctrl+C to stop.")
    
    success_count = 0
    fail_count = 0
    
    for i, num in enumerate(missing):
        # Rate limit
        if i > 0 and i % 10 == 0:
            print("⏳ Resting 10s...")
            time.sleep(10)
        else:
            time.sleep(2)
            
        if generate_and_fill(num):
            success_count += 1
        else:
            fail_count += 1
            
    print(f"\n🏁 Finished!")
    print(f"   Success: {success_count}")
    print(f"   Failed/Skipped: {fail_count}")

if __name__ == "__main__":
    main()
