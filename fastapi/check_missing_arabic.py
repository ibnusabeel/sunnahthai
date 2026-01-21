"""
Script to check hadiths missing Arabic content
"""

from database import translations_collection

def check_missing_arabic():
    print("🔍 Checking hadiths with missing Arabic content...")
    
    # Find hadiths where content.ar is empty or doesn't exist
    query = {
        "$or": [
            {"content.ar": {"$exists": False}},
            {"content.ar": None},
            {"content.ar": ""},
        ]
    }
    
    missing = list(translations_collection.find(query, {
        "hadith_id": 1,
        "hadith_book": 1,
        "hadith_no": 1,
        "content": 1,
        "_id": 0
    }).limit(50))
    
    print(f"\n📊 Found {len(missing)} hadiths missing Arabic content (showing first 50)")
    
    # Group by book
    by_book = {}
    all_missing = translations_collection.count_documents(query)
    
    # Count per book
    books = ["bukhari", "muslim", "nasai", "tirmidhi", "abudawud", "ibnmajah", "malik"]
    for book in books:
        count = translations_collection.count_documents({**query, "hadith_book": book})
        if count > 0:
            by_book[book] = count
    
    print(f"\n📚 Total missing per book:")
    for book, count in by_book.items():
        print(f"  - {book}: {count}")
    
    print(f"\n📌 Total missing: {all_missing}")
    
    if missing:
        print(f"\n📋 Sample missing hadiths:")
        for h in missing[:10]:
            print(f"  - {h.get('hadith_id')} (No. {h.get('hadith_no')})")
    
    return missing

if __name__ == "__main__":
    check_missing_arabic()
