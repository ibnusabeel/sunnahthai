from database import translations_collection

def check_ids():
    # Get a few samples
    samples = list(translations_collection.find({"hadith_book": "bukhari"}).limit(5))
    print("Found samples:", len(samples))
    for s in samples:
        print(f"ID: {s.get('hadith_id')}, No: {s.get('hadith_no')}, Kitab: {s.get('kitab')}")

    # Check specific ID 1
    h1 = translations_collection.find_one({"hadith_book": "bukhari", "hadith_no": "1"})
    print("\nHadith 1 found by no='1':", h1 is not None)
    
    if not h1:
         h1_int = translations_collection.find_one({"hadith_book": "bukhari", "hadith_no": 1})
         print("Hadith 1 found by no=1 (int):", h1_int is not None)

if __name__ == "__main__":
    check_ids()
