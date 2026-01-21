"""
Script to check Thai translations for English text mixed in
"""

import re
from database import translations_collection

def check_thai_with_english():
    print("🔍 Checking Thai translations for English text...")
    
    # Find hadiths with Thai translation
    hadiths = translations_collection.find(
        {"content.th": {"$exists": True, "$ne": None, "$ne": ""}},
        {"hadith_id": 1, "hadith_book": 1, "hadith_no": 1, "content.th": 1, "_id": 0}
    )
    
    # Pattern to detect significant English text (words, not just names)
    # Ignore common transliterations and short matches
    english_pattern = re.compile(r'[A-Za-z]{4,}')  # 4+ consecutive letters
    
    problematic = []
    total_checked = 0
    
    for h in hadiths:
        total_checked += 1
        thai_text = h.get("content", {}).get("th", "") or ""
        
        if not thai_text:
            continue
        
        # Find English words
        matches = english_pattern.findall(thai_text)
        
        # Filter out common transliterations that are okay
        allowed = ["Allah", "Muhammad", "Sahih", "Hadith", "narrated", "said", "from", 
                   "Prophet", "Messenger", "SubhanAllah", "Alhamdulillah", "Rasulullah"]
        
        significant_english = [m for m in matches if m not in allowed and len(m) >= 5]
        
        if len(significant_english) >= 3:  # Has 3+ significant English words
            problematic.append({
                "id": h.get("hadith_id"),
                "book": h.get("hadith_book"),
                "no": h.get("hadith_no"),
                "english_found": significant_english[:5],  # Show first 5
                "sample": thai_text[:200]
            })
    
    print(f"\n📊 Checked {total_checked} hadiths with Thai translation")
    print(f"⚠️ Found {len(problematic)} hadiths with significant English text")
    
    # Group by book
    by_book = {}
    for p in problematic:
        book = p["book"]
        if book not in by_book:
            by_book[book] = 0
        by_book[book] += 1
    
    print(f"\n📚 Per book:")
    for book, count in sorted(by_book.items(), key=lambda x: -x[1]):
        print(f"  - {book}: {count}")
    
    print(f"\n📋 Sample problematic hadiths:")
    for p in problematic[:10]:
        print(f"\n  ID: {p['id']}")
        print(f"  English words: {', '.join(p['english_found'])}")
        print(f"  Sample: {p['sample'][:100]}...")
    
    return problematic

if __name__ == "__main__":
    results = check_thai_with_english()
    
    # Ask if user wants to save list
    if results:
        print(f"\n💾 Total to fix: {len(results)}")
