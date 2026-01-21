import requests

JSON_URL = "https://raw.githubusercontent.com/gadingnst/hadith-api/refs/heads/master/books/darimi.json"

def check_source():
    print(f"📖 Downloading JSON from {JSON_URL}...")
    response = requests.get(JSON_URL)
    data = response.json()
    
    total = len(data)
    print(f"📊 Total items in JSON: {total}")
    
    empty_arabic = 0
    valid = 0
    
    for item in data:
        if not item.get("arab", "").strip():
            empty_arabic += 1
        else:
            valid += 1
            
    print(f"❌ Empty Arabic: {empty_arabic}")
    print(f"✅ Valid Arabic: {valid}")

if __name__ == "__main__":
    check_source()
