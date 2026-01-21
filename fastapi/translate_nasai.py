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

# Batch settings - Slower to avoid rate limits
BATCH_SIZE = 15
DELAY_BETWEEN_REQUESTS = 4  # 4 seconds between requests
MAX_RETRIES = 3

def translate_to_thai(arabic_text, retry_count=0):
    """Translate Arabic hadith text to Thai using Gemini with retry"""
    if not arabic_text or arabic_text.strip() == "":
        return None
    
    try:
        prompt = f"""แปลหะดีษต่อไปนี้จากภาษาอาหรับเป็นภาษาไทย
ให้แปลอย่างถูกต้องตามหลักศาสนาอิสลาม รักษาความหมายเดิม
ตอบเฉพาะคำแปลภาษาไทย ไม่ต้องอธิบายเพิ่มเติม

หะดีษ:
{arabic_text}"""
        
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        error_msg = str(e)
        
        # Handle Rate Limit (429)
        if "429" in error_msg or "Resource exhausted" in error_msg:
            if retry_count < MAX_RETRIES:
                wait_time = (2 ** retry_count) * 10  # Exponential backoff: 10s, 20s, 40s
                print(f"Rate limit hit. Waiting {wait_time}s before retry {retry_count + 1}/{MAX_RETRIES}...")
                time.sleep(wait_time)
                return translate_to_thai(arabic_text, retry_count + 1)
            else:
                print(f"Max retries reached. Skipping...")
                return None
        
        print(f"Translation error: {e}")
        return None

def translate_nasai_hadiths():
    """Translate all pending Nasai hadiths"""
    
    # Find pending Nasai hadiths
    query = {
        "hadith_book": "nasai",
        "status": "pending_translation",
        "content.ar": {"$exists": True, "$ne": ""}
    }
    
    total_pending = translations_collection.count_documents(query)
    print(f"🌙 Found {total_pending} pending Nasai hadiths to translate")
    
    if total_pending == 0:
        print("✅ No pending hadiths to translate!")
        return
    
    translated_count = 0
    error_count = 0
    batch_num = 0
    
    while True:
        # Get next batch
        batch = list(translations_collection.find(query).limit(BATCH_SIZE))
        
        if not batch:
            break
        
        batch_num += 1
        print(f"\n--- Processing batch {batch_num} ({len(batch)} hadiths) ---")
        
        for hadith in batch:
            hadith_id = hadith.get("hadith_id")
            arabic_content = hadith.get("content", {}).get("ar", "")
            
            if not arabic_content:
                print(f"Skipping {hadith_id}: No Arabic content")
                continue
            
            # Translate
            thai_translation = translate_to_thai(arabic_content)
            
            if thai_translation:
                # Update database
                translations_collection.update_one(
                    {"hadith_id": hadith_id},
                    {
                        "$set": {
                            "content.th": thai_translation,
                            "status": "translated",
                            "last_updated": datetime.now(timezone.utc)
                        }
                    }
                )
                translated_count += 1
                
                if translated_count % 10 == 0:
                    print(f"✨ Translated {translated_count} hadiths...")
            else:
                error_count += 1
                print(f"❌ Failed to translate {hadith_id}")
            
            # Rate limiting
            time.sleep(DELAY_BETWEEN_REQUESTS)
        
        # Progress update
        remaining = translations_collection.count_documents(query)
        print(f"📊 Progress: {translated_count} translated, {remaining} remaining")
        
        # Pause between batches
        print("⏳ Pausing 5s between batches...")
        time.sleep(5)
    
    print(f"\n=== 🎉 Translation Complete ===")
    print(f"✅ Translated: {translated_count}")
    print(f"❌ Errors: {error_count}")

if __name__ == "__main__":
    translate_nasai_hadiths()
