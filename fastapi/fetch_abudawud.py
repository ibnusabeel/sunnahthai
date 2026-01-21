import urllib.request
import json
from database import translations_collection
from datetime import datetime, timezone
import google.generativeai as genai
import os
from dotenv import load_dotenv
import time

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

# Abu Dawud JSON URL (سنن أبي داود)
JSON_URL = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/refs/heads/1/editions/ara-abudawud.json"

def translate_to_thai(text, max_retries=3):
    """Translate section name to Thai using Gemini with retry"""
    if not text or text.strip() == "":
        return None
    
    for retry in range(max_retries):
        try:
            prompt = f"""แปลชื่อหมวดหะดีษต่อไปนี้เป็นภาษาไทย (ตอบเฉพาะคำแปล ไม่ต้องอธิบาย):

{text}"""
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) or "Resource exhausted" in str(e):
                wait_time = (2 ** retry) * 10
                print(f"Rate limit hit. Waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"Translation error: {e}")
                return None
    return None

def fetch_json():
    """Fetch JSON from GitHub"""
    print(f"📥 Fetching Abu Dawud (سنن أبي داود) from {JSON_URL}...")
    try:
        req = urllib.request.Request(JSON_URL)
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching JSON: {e}")
        return None

def import_abudawud():
    data = fetch_json()
    if not data:
        print("Failed to fetch JSON")
        return
    
    # Get section names (English)
    sections = data.get("metadata", {}).get("sections", {})
    section_details = data.get("metadata", {}).get("section_details", {})
    
    # Cache for section translations
    section_cache = {}
    
    # Pre-translate sections
    print(f"🔄 Translating {len(sections)} section names...")
    for section_id, section_name in sections.items():
        if section_name:
            thai_name = translate_to_thai(section_name)
            section_cache[section_id] = {
                "en": section_name,
                "th": thai_name
            }
            time.sleep(0.5)
            print(f"  {section_id}. {section_name} -> {thai_name}")
    
    # Get hadith range for each section
    def get_section_for_hadith(hadith_no):
        for sec_id, details in section_details.items():
            first = details.get("hadithnumber_first", 0)
            last = details.get("hadithnumber_last", 0)
            if first <= hadith_no <= last:
                return sec_id
        return "0"
    
    hadiths = data.get("hadiths", [])
    print(f"\n📚 Found {len(hadiths)} hadiths. Starting import...")
    
    count = 0
    skipped = 0
    errors = 0
    
    for h in hadiths:
        try:
            hadith_no = h.get("hadithnumber")
            if hadith_no is None:
                continue
            
            hadith_id = f"abudawud_{hadith_no}"
            
            # Check if already exists
            if translations_collection.find_one({"hadith_id": hadith_id}):
                skipped += 1
                continue
            
            # Get section info
            section_id = get_section_for_hadith(hadith_no)
            section_info = section_cache.get(section_id, {})
            
            # Get grade
            grades = h.get("grades", [])
            grade_status = "Unknown"
            for g in grades:
                if "Sahih" in g.get("grade", ""):
                    grade_status = "Sahih"
                    break
                elif "Hasan" in g.get("grade", ""):
                    grade_status = "Hasan"
            if grade_status == "Unknown" and grades:
                grade_status = grades[0].get("grade", "Unknown")
            
            # Construct Document
            doc = {
                "hadith_id": hadith_id,
                "hadith_book": "abudawud",
                "hadith_no": str(hadith_no),
                "kitab": {
                    "ar": "",
                    "th": section_info.get("th"),
                    "en": section_info.get("en")
                },
                "bab": {
                    "ar": "",
                    "th": None
                },
                "content": {
                    "ar": h.get("text", ""),
                    "th": None
                },
                "hadith_status": grade_status,
                "status": "pending_translation",
                "created_at": datetime.now(timezone.utc)
            }
            
            translations_collection.insert_one(doc)
            count += 1
            
            if count % 100 == 0:
                print(f"✨ Imported {count} hadiths...")
                
        except Exception as e:
            print(f"Error importing hadith {h.get('hadithnumber')}: {e}")
            errors += 1
    
    print(f"\n=== 🎉 Import Complete (Abu Dawud) ===")
    print(f"✅ Imported: {count}")
    print(f"⏭️ Skipped (already exists): {skipped}")
    print(f"❌ Errors: {errors}")
    print(f"\n📊 Total Abu Dawud in DB: {translations_collection.count_documents({'hadith_book': 'abudawud'})}")

if __name__ == "__main__":
    import_abudawud()
