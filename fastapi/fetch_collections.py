"""
Unified Hadith Import Script
Supports: Abu Dawud, Tirmidhi, Ibn Majah, Muwatta Malik
"""
import urllib.request
import json
from database import translations_collection
from datetime import datetime, timezone
import google.generativeai as genai
import os
from dotenv import load_dotenv
import time
import sys

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

# Book configurations
BOOKS = {
    "abudawud": {
        "name": "Sunan Abi Dawud",
        "url": "https://raw.githubusercontent.com/fawazahmed0/hadith-api/refs/heads/1/editions/ara-abudawud.json",
        "prefix": "abudawud"
    },
    "tirmidhi": {
        "name": "Jami` at-Tirmidhi",
        "url": "https://raw.githubusercontent.com/fawazahmed0/hadith-api/refs/heads/1/editions/ara-tirmidhi1.json",
        "prefix": "tirmidhi"
    },
    "ibnmajah": {
        "name": "Sunan Ibn Majah",
        "url": "https://raw.githubusercontent.com/fawazahmed0/hadith-api/refs/heads/1/editions/ara-ibnmajah.json",
        "prefix": "ibnmajah"
    },
    "malik": {
        "name": "Muwatta Malik",
        "url": "https://raw.githubusercontent.com/fawazahmed0/hadith-api/refs/heads/1/editions/ara-malik.json",
        "prefix": "malik"
    }
}

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

def fetch_json(url):
    """Fetch JSON from GitHub"""
    print(f"Fetching data from {url}...")
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching JSON: {e}")
        return None

def import_book(book_key):
    config = BOOKS.get(book_key)
    if not config:
        print(f"Unknown book: {book_key}")
        return
    
    print(f"\n{'='*50}")
    print(f"Importing: {config['name']}")
    print(f"{'='*50}\n")
    
    data = fetch_json(config['url'])
    if not data:
        print("Failed to fetch JSON")
        return
    
    # Get section names (English)
    sections = data.get("metadata", {}).get("sections", {})
    section_details = data.get("metadata", {}).get("section_details", {})
    
    # Cache for section translations
    section_cache = {}
    
    # Pre-translate sections
    print(f"Translating {len(sections)} section names...")
    for section_id, section_name in sections.items():
        if section_name:
            thai_name = translate_to_thai(section_name)
            section_cache[section_id] = {
                "en": section_name,
                "th": thai_name
            }
            time.sleep(0.5)
            print(f"  {section_id}. {section_name[:40]}... -> {thai_name[:30] if thai_name else 'N/A'}...")
    
    # Get hadith range for each section
    def get_section_for_hadith(hadith_no):
        for sec_id, details in section_details.items():
            first = details.get("hadithnumber_first", 0)
            last = details.get("hadithnumber_last", 0)
            if first <= hadith_no <= last:
                return sec_id
        return "0"
    
    hadiths = data.get("hadiths", [])
    print(f"\nFound {len(hadiths)} hadiths. Starting import...")
    
    count = 0
    skipped = 0
    errors = 0
    
    for h in hadiths:
        try:
            hadith_no = h.get("hadithnumber")
            if hadith_no is None:
                continue
            
            hadith_id = f"{config['prefix']}_{hadith_no}"
            
            # Check if already exists
            if translations_collection.find_one({"hadith_id": hadith_id}):
                skipped += 1
                continue
            
            # Get section info
            section_id = get_section_for_hadith(hadith_no)
            section_info = section_cache.get(section_id, {})
            
            # Get grade (first one with Sahih if available)
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
                "hadith_book": config['prefix'],
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
            
            if count % 200 == 0:
                print(f"  Imported {count} hadiths...")
                
        except Exception as e:
            print(f"Error importing hadith {h.get('hadithnumber')}: {e}")
            errors += 1
    
    print(f"\n--- {config['name']} Import Complete ---")
    print(f"Imported: {count}")
    print(f"Skipped (already exists): {skipped}")
    print(f"Errors: {errors}")
    total = translations_collection.count_documents({"hadith_book": config['prefix']})
    print(f"Total in DB: {total}")

def import_all():
    """Import all 4 books sequentially"""
    for book_key in BOOKS.keys():
        import_book(book_key)
        print("\nPausing 5s before next book...")
        time.sleep(5)
    
    print("\n" + "="*50)
    print("ALL IMPORTS COMPLETE!")
    print("="*50)
    for book_key, config in BOOKS.items():
        total = translations_collection.count_documents({"hadith_book": config['prefix']})
        print(f"  {config['name']}: {total:,} hadiths")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        book_key = sys.argv[1].lower()
        if book_key == "all":
            import_all()
        elif book_key in BOOKS:
            import_book(book_key)
        else:
            print(f"Usage: python {sys.argv[0]} [book|all]")
            print(f"Available books: {', '.join(BOOKS.keys())}, all")
    else:
        print("Hadith Import Script")
        print("-" * 30)
        print("Usage:")
        print(f"  python {sys.argv[0]} abudawud  - Import Abu Dawud only")
        print(f"  python {sys.argv[0]} tirmidhi  - Import Tirmidhi only")
        print(f"  python {sys.argv[0]} ibnmajah  - Import Ibn Majah only")
        print(f"  python {sys.argv[0]} malik     - Import Muwatta Malik only")
        print(f"  python {sys.argv[0]} all       - Import ALL books")
