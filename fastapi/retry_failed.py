"""Retry translating hadiths that failed or have no Thai content"""
import time
from database import translations_collection
from datetime import datetime, timezone
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

DELAY = 3

def translate_to_thai(arabic_text, max_retries=3):
    if not arabic_text or arabic_text.strip() == "":
        return None
    
    for retry in range(max_retries):
        try:
            prompt = f"""แปลหะดีษต่อไปนี้จากภาษาอาหรับเป็นภาษาไทย
ให้แปลอย่างถูกต้องตามหลักศาสนาอิสลาม รักษาความหมายเดิม
ตอบเฉพาะคำแปลภาษาไทย ไม่ต้องอธิบายเพิ่มเติม

หะดีษ:
{arabic_text}"""
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) or "Resource exhausted" in str(e):
                wait_time = (2 ** retry) * 10
                print(f"Rate limit. Waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"Error: {e}")
                return None
    return None

def retry_failed():
    """Find and retry hadiths with no Thai content"""
    
    # Query: has Arabic content but no Thai content
    query = {
        "content.ar": {"$exists": True, "$ne": ""},
        "$or": [
            {"content.th": None},
            {"content.th": ""},
            {"content.th": {"$exists": False}}
        ]
    }
    
    total = translations_collection.count_documents(query)
    print(f"🔧 Found {total} hadiths with no Thai translation")
    
    if total == 0:
        print("✅ All hadiths have Thai translations!")
        return
    
    count = 0
    errors = 0
    
    for hadith in translations_collection.find(query).limit(1000):  # Process 500 at a time
        hadith_id = hadith.get("hadith_id")
        arabic = hadith.get("content", {}).get("ar", "")
        
        if not arabic:
            print(f"⏭️ Skipping {hadith_id}: No Arabic content")
            continue
        
        print(f"🔄 Translating {hadith_id}...")
        thai = translate_to_thai(arabic)
        
        if thai:
            translations_collection.update_one(
                {"hadith_id": hadith_id},
                {"$set": {
                    "content.th": thai,
                    "status": "translated",
                    "last_updated": datetime.now(timezone.utc)
                }}
            )
            count += 1
            if count % 10 == 0:
                print(f"✨ Translated {count} hadiths...")
        else:
            errors += 1
            print(f"❌ Failed: {hadith_id}")
        
        time.sleep(DELAY)
    
    print(f"\n=== 🎉 Retry Complete ===")
    print(f"✅ Fixed: {count}")
    print(f"❌ Errors: {errors}")
    print(f"📊 Remaining: {translations_collection.count_documents(query)}")

if __name__ == "__main__":
    retry_failed()
