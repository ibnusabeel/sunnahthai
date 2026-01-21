import urllib.request
import json
import time
from database import translations_collection
from datetime import datetime
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash")

# GitHub JSON URL
JSON_URL = "https://raw.githubusercontent.com/AhmedBaset/hadith-json/refs/heads/main/db/by_book/the_9_books/muslim.json"

def translate_to_thai(text):
    """Translate text to Thai using Gemini"""
    if not text or text.strip() == "":
        return None
    try:
        prompt = f"แปลข้อความต่อไปนี้เป็นภาษาไทย (ตอบเฉพาะคำแปล ไม่ต้องอธิบาย):\n\n{text}"
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Translation error: {e}")
        return None

def fetch_json():
    """Fetch JSON from GitHub"""
    print(f"Fetching data from {JSON_URL}...")
    try:
        req = urllib.request.Request(JSON_URL)
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching JSON: {e}")
        return None

def fetch_and_import_remaining():
    data = fetch_json()
    if not data:
        print("Failed to fetch JSON")
        return
    
    # Get chapters as dict for lookup
    chapters_dict = {}
    for chapter in data.get("chapters", []):
        chapters_dict[chapter["id"]] = chapter
    
    hadiths = data.get("hadiths", [])
    print(f"Found {len(hadiths)} hadiths in JSON. Checking for missing ones...")
    
    count = 0
    skipped = 0
    errors = 0
    
    # Chapter translation cache
    chapter_cache = {}
    
    for h in hadiths:
        try:
            hadith_id_in_book = h.get("idInBook")
            if hadith_id_in_book is None:
                continue
            
            hadith_id = f"muslim_{hadith_id_in_book}"
            
            # Check if already exists
            if translations_collection.find_one({"hadith_id": hadith_id}):
                skipped += 1
                continue
            
            # Get chapter info
            chapter_id = h.get("chapterId", 0)
            chapter_info = chapters_dict.get(chapter_id, {})
            chapter_arabic = chapter_info.get("arabic", "")
            chapter_english = chapter_info.get("english", "")
            
            # Translate chapter to Thai (with caching)
            chapter_thai = None
            cache_key = str(chapter_id)
            if cache_key in chapter_cache:
                chapter_thai = chapter_cache[cache_key]
            elif chapter_english:
                chapter_thai = translate_to_thai(chapter_english)
                chapter_cache[cache_key] = chapter_thai
                time.sleep(0.5)  # Rate limiting
            
            # Hadith Arabic Text only
            text_arabic = h.get("arabic", "")
            
            # Construct Document (matching Bukhari format)
            doc = {
                "hadith_id": hadith_id,
                "hadith_book": "muslim",
                "hadith_no": str(hadith_id_in_book),
                "kitab": {
                    "ar": chapter_arabic,
                    "th": chapter_thai
                },
                "bab": {
                    "ar": "",
                    "th": None
                },
                "content": {
                    "ar": text_arabic,
                    "th": None  # Will be translated later
                },
                "hadith_status": "Sahih",
                "status": "pending_translation",
                "created_at": datetime.utcnow()
            }
            
            translations_collection.insert_one(doc)
            count += 1
            
            if count % 50 == 0:
                print(f"Imported {count} new hadiths...")
                
        except Exception as e:
            print(f"Error importing hadith {h.get('idInBook')}: {e}")
            errors += 1
    
    print(f"\n=== Import Complete ===")
    print(f"New imports: {count}")
    print(f"Skipped (already exists): {skipped}")
    print(f"Errors: {errors}")

if __name__ == "__main__":
    fetch_and_import_remaining()
