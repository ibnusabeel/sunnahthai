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

# API Configuration
API_KEY = "$2y$10$8i4DlQiAibPmrDE6nPmbOi3hnwnTOMb7heseXShzpJaUmZReAj4W"
BASE_URL = "https://hadithapi.com/api/hadiths"
BOOK_SLUG = "sahih-muslim"
LIMIT = 50  # hadiths per page

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

def fetch_hadiths(page=1):
    """Fetch hadiths from API"""
    url = f"{BASE_URL}?apiKey={API_KEY}&book={BOOK_SLUG}&limit={LIMIT}&page={page}"
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching page {page}: {e}")
        return None

def fetch_and_import():
    print(f"Starting Sahih Muslim import from hadithapi.com...")
    
    # First, get total pages
    first_page = fetch_hadiths(1)
    if not first_page or first_page.get("status") != 200:
        print("Failed to fetch initial data")
        return
    
    hadiths_data = first_page.get("hadiths", {})
    total_pages = hadiths_data.get("total", 0) // LIMIT + 1
    print(f"Total pages: {total_pages}")
    
    count = 0
    errors = 0
    skipped = 0
    
    # Chapter translation cache (to avoid duplicate API calls)
    chapter_cache = {}
    
    for page in range(1, total_pages + 1):
        print(f"\n--- Processing page {page}/{total_pages} ---")
        
        data = fetch_hadiths(page)
        if not data or data.get("status") != 200:
            print(f"Failed to fetch page {page}")
            errors += 1
            continue
        
        hadiths = data.get("hadiths", {}).get("data", [])
        
        for h in hadiths:
            try:
                hadith_number = h.get("hadithNumber")
                if not hadith_number:
                    continue
                
                hadith_id = f"muslim_{hadith_number}"
                
                # Check for duplicate
                if translations_collection.find_one({"hadith_id": hadith_id}):
                    print(f"Skipping duplicate: {hadith_id}")
                    skipped += 1
                    continue
                
                # Get Chapter info
                chapter = h.get("chapter", {})
                chapter_arabic = chapter.get("chapterArabic", "")
                chapter_english = chapter.get("chapterEnglish", "")
                chapter_id = str(chapter.get("id", ""))
                
                # Translate chapter to Thai (with caching)
                chapter_thai = None
                if chapter_id and chapter_id in chapter_cache:
                    chapter_thai = chapter_cache[chapter_id]
                elif chapter_english:
                    chapter_thai = translate_to_thai(chapter_english)
                    if chapter_id:
                        chapter_cache[chapter_id] = chapter_thai
                    time.sleep(0.5)  # Rate limiting
                
                # Get heading (bab)
                heading_arabic = h.get("headingArabic", "")
                heading_english = h.get("headingEnglish", "")
                
                # Translate heading to Thai
                heading_thai = None
                if heading_english:
                    heading_thai = translate_to_thai(heading_english)
                    time.sleep(0.5)  # Rate limiting
                
                # Hadith Arabic Text only
                text_arabic = h.get("hadithArabic", "")
                
                # Hadith status
                hadith_status = h.get("status", "")  # e.g., "Sahih"
                
                # Construct Document (matching Bukhari format)
                doc = {
                    "hadith_id": hadith_id,
                    "hadith_book": "muslim",
                    "hadith_no": str(hadith_number),
                    "kitab": {
                        "ar": chapter_arabic,
                        "th": chapter_thai
                    },
                    "bab": {
                        "ar": heading_arabic,
                        "th": heading_thai
                    },
                    "content": {
                        "ar": text_arabic,
                        "th": None  # จะแปลทีหลัง
                    },
                    "hadith_status": hadith_status,
                    "status": "pending_translation",
                    "created_at": datetime.utcnow()
                }
                
                translations_collection.insert_one(doc)
                count += 1
                
                if count % 10 == 0:
                    print(f"Imported {count} hadiths...")
                    
            except Exception as e:
                print(f"Error importing hadith {h.get('hadithNumber')}: {e}")
                errors += 1
        
        # Small delay between pages
        time.sleep(1)
    
    print(f"\n=== Import Complete ===")
    print(f"Imported: {count}")
    print(f"Skipped (duplicates): {skipped}")
    print(f"Errors: {errors}")

if __name__ == "__main__":
    fetch_and_import()
