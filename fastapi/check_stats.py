"""Check translation stats for all books"""
from database import translations_collection

books = ['bukhari', 'muslim', 'nasai', 'tirmidhi', 'abudawud', 'ibnmajah']

print("=" * 60)
print("📊 HADITH TRANSLATION STATUS")
print("=" * 60)

for book in books:
    total = translations_collection.count_documents({"hadith_book": book})
    translated = translations_collection.count_documents({"hadith_book": book, "status": "translated"})
    pending = translations_collection.count_documents({"hadith_book": book, "status": "pending_translation"})
    no_thai = translations_collection.count_documents({"hadith_book": book, "content.th": None})
    
    if total > 0:
        pct = round(translated / total * 100, 1)
        print(f"\n📚 {book.upper()}")
        print(f"   Total: {total}")
        print(f"   Translated: {translated} ({pct}%)")
        print(f"   Pending: {pending}")
        print(f"   No Thai content: {no_thai}")
    else:
        print(f"\n📚 {book.upper()}: No data")

print("\n" + "=" * 60)
