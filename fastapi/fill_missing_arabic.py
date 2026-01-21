"""
Script to fill missing Arabic content and translation using Gemini
"""

import os
import time
from database import translations_collection
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Book names for better prompts
BOOK_NAMES = {
    "bukhari": {"ar": "صحيح البخاري", "en": "Sahih al-Bukhari"},
    "muslim": {"ar": "صحيح مسلم", "en": "Sahih Muslim"},
    "nasai": {"ar": "سنن النسائي", "en": "Sunan an-Nasa'i"},
    "tirmidhi": {"ar": "جامع الترمذي", "en": "Jami` at-Tirmidhi"},
    "abudawud": {"ar": "سنن أبي داود", "en": "Sunan Abi Dawud"},
    "ibnmajah": {"ar": "سنن ابن ماجه", "en": "Sunan Ibn Majah"},
    "malik": {"ar": "موطأ الإمام مالك", "en": "Muwatta Imam Malik"},
}

def get_hadith_from_gemini(book: str, hadith_no: str, kitab_ar: str = "", bab_ar: str = "") -> dict:
    """Use Gemini to find the Arabic text and Thai translation for a hadith."""
    
    book_info = BOOK_NAMES.get(book, {"ar": book, "en": book})
    
    prompt = f"""You are an Islamic hadith scholar. Please provide the Arabic text and Thai translation for the following hadith:

Book: {book_info['en']} ({book_info['ar']})
Hadith Number: {hadith_no}
{f"Chapter (Kitab): {kitab_ar}" if kitab_ar else ""}
{f"Section (Bab): {bab_ar}" if bab_ar else ""}

Please respond in this EXACT JSON format (no markdown, just raw JSON):
{{
    "arabic": "The full Arabic hadith text including the chain of narrators (isnad) and main text (matn)",
    "thai": "The Thai translation of the hadith"
}}

If you cannot find this specific hadith, respond with:
{{
    "arabic": "",
    "thai": "",
    "error": "Could not find hadith"
}}

IMPORTANT: 
- The Arabic text MUST be accurate and complete
- The Thai translation should be clear and readable
- Do not include any explanation, just the JSON
"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        
        # Parse JSON response
        import json
        text = response.text.strip()
        
        # Clean up markdown if present
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        result = json.loads(text.strip())
        return result
        
    except Exception as e:
        print(f"    ❌ Gemini error: {e}")
        return {"arabic": "", "thai": "", "error": str(e)}

def fill_missing_arabic():
    print("🔍 Finding hadiths with missing Arabic content...")
    
    # Find hadiths where content.ar is empty or doesn't exist
    query = {
        "$or": [
            {"content.ar": {"$exists": False}},
            {"content.ar": None},
            {"content.ar": ""},
        ]
    }
    
    missing = list(translations_collection.find(query))
    total = len(missing)
    
    print(f"📊 Found {total} hadiths missing Arabic content")
    
    if total == 0:
        print("✅ All hadiths have Arabic content!")
        return
    
    updated = 0
    failed = 0
    
    for i, hadith in enumerate(missing):
        hadith_id = hadith.get("hadith_id", "")
        book = hadith.get("hadith_book", "")
        hadith_no = hadith.get("hadith_no", "")
        kitab_ar = hadith.get("kitab", {}).get("ar", "")
        bab_ar = hadith.get("bab", {}).get("ar", "")
        
        print(f"\n[{i+1}/{total}] Processing {hadith_id}...")
        
        # Get from Gemini
        result = get_hadith_from_gemini(book, hadith_no, kitab_ar, bab_ar)
        
        if result.get("error") or not result.get("arabic"):
            print(f"    ⚠️ Could not find content: {result.get('error', 'Empty response')}")
            failed += 1
            continue
        
        # Update database
        update_data = {}
        
        if result.get("arabic"):
            update_data["content.ar"] = result["arabic"]
            print(f"    ✅ Found Arabic text ({len(result['arabic'])} chars)")
        
        if result.get("thai") and not hadith.get("content", {}).get("th"):
            update_data["content.th"] = result["thai"]
            update_data["status"] = "translated"
            print(f"    ✅ Found Thai translation ({len(result['thai'])} chars)")
        
        if update_data:
            translations_collection.update_one(
                {"hadith_id": hadith_id},
                {"$set": update_data}
            )
            updated += 1
        
        # Rate limiting
        time.sleep(1)
    
    print(f"\n" + "="*50)
    print(f"📊 Summary:")
    print(f"  - Total processed: {total}")
    print(f"  - Successfully updated: {updated}")
    print(f"  - Failed: {failed}")

if __name__ == "__main__":
    fill_missing_arabic()
