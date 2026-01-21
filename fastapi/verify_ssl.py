from services import translate_hadith
import sys

# Mock data
mock_hadith = {
    "kitab": {"ar": "Test Book"},
    "bab": {"ar": "Test Chapter"},
    "content": {"ar": "Test Content"}
}

print("Testing SSL connection to Gemini API...")
try:
    result = translate_hadith(mock_hadith)
    print("Success! Translation result:", result)
except Exception as e:
    print(f"Failed: {e}")
    sys.exit(1)
