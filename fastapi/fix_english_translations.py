"""
Script to fix Thai translations that contain English text using Gemini
"""

import os
import re
import time
from database import translations_collection
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def find_english_hadiths():
    """Find hadiths with significant English in Thai translation."""
    hadiths = translations_collection.find(
        {"content.th": {"$exists": True, "$ne": None, "$ne": ""}},
        {"hadith_id": 1, "hadith_book": 1, "hadith_no": 1, "content": 1, "_id": 0}
    )
    
    english_pattern = re.compile(r'[A-Za-z]{4,}')
    allowed = ["Allah", "Muhammad", "Sahih", "Hadith", "narrated", "said", "from", 
               "Prophet", "Messenger", "SubhanAllah", "Alhamdulillah", "Rasulullah"]
    
    problematic = []
    
    for h in hadiths:
        thai_text = h.get("content", {}).get("th", "") or ""
        if not thai_text:
            continue
        
        matches = english_pattern.findall(thai_text)
        significant_english = [m for m in matches if m not in allowed and len(m) >= 5]
        
        if len(significant_english) >= 3:
            problematic.append(h)
    
    return problematic

def retranslate_hadith(hadith: dict) -> str:
    """Use Gemini to retranslate hadith to pure Thai."""
    
    arabic = hadith.get("content", {}).get("ar", "")
    current_thai = hadith.get("content", {}).get("th", "")
    
    prompt = f"""คุณเป็นนักแปลหะดีษผู้เชี่ยวชาญ กรุณาแปลหะดีษนี้เป็นภาษาไทยที่ถูกต้อง สละสลวย และเข้าใจง่าย

ตัวบทอาหรับ:
{arabic}

คำแปลปัจจุบัน (มีภาษาอังกฤษปน):
{current_thai[:500]}

กรุณาแปลใหม่ โดย:
1. แปลเป็นภาษาไทยล้วนๆ ไม่มีภาษาอังกฤษปน
2. ชื่อผู้รายงานให้ใช้การทับศัพท์ภาษาไทย เช่น "Yazid" เป็น "ยาซีด", "Umar" เป็น "อุมัร"
3. รักษาความหมายเดิมให้ครบถ้วน
4. ใช้ภาษาที่สละสลวยและเข้าใจง่าย

ตอบเฉพาะคำแปลภาษาไทยเท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม:
"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"    ❌ Gemini error: {e}")
        return ""

def fix_english_translations():
    print("🔍 Finding hadiths with English in Thai translation...")
    
    problematic = find_english_hadiths()
    total = len(problematic)
    
    print(f"📊 Found {total} hadiths to fix")
    
    if total == 0:
        print("✅ No hadiths with English text found!")
        return
    
    updated = 0
    failed = 0
    
    for i, hadith in enumerate(problematic):
        hadith_id = hadith.get("hadith_id", "")
        
        print(f"\n[{i+1}/{total}] Retranslating {hadith_id}...")
        
        # Get new translation from Gemini
        new_thai = retranslate_hadith(hadith)
        
        if not new_thai or len(new_thai) < 50:
            print(f"    ⚠️ Translation too short or empty")
            failed += 1
            continue
        
        # Check if still has English
        english_pattern = re.compile(r'[A-Za-z]{5,}')
        if len(english_pattern.findall(new_thai)) > 2:
            print(f"    ⚠️ Still has English, skipping")
            failed += 1
            continue
        
        # Update database
        translations_collection.update_one(
            {"hadith_id": hadith_id},
            {"$set": {"content.th": new_thai}}
        )
        print(f"    ✅ Updated ({len(new_thai)} chars)")
        updated += 1
        
        # Rate limiting
        time.sleep(1)
    
    print(f"\n" + "="*50)
    print(f"📊 Summary:")
    print(f"  - Total processed: {total}")
    print(f"  - Successfully updated: {updated}")
    print(f"  - Failed: {failed}")

if __name__ == "__main__":
    fix_english_translations()
