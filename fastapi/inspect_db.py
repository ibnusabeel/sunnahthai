from database import kitabs_collection, translations_collection
import pprint

def inspect_data():
    print("\n🧐 Inspecting 'malik' in translations_collection (Source Data)...")
    # Check one hadith to see structure
    doc = translations_collection.find_one({"hadith_book": "malik"})
    if doc:
        print("Structure of one Malik hadith:")
        pprint.pprint(doc)
    else:
        print("❌ No Malik hadiths found!")

    print("\n🧐 Inspecting 'malik' in kitabs_collection (Synced Data)...")
    count = kitabs_collection.count_documents({"book": "malik"})
    print(f"Count: {count}")
    
    if count > 0:
        print("First 3 kitabs docs:")
        docs = list(kitabs_collection.find({"book": "malik"}).limit(3))
        for doc in docs:
            pprint.pprint(doc)
    else:
        print("⚠️ No kitabs found for malik (API likely using fallback)")

if __name__ == "__main__":
    inspect_data()
