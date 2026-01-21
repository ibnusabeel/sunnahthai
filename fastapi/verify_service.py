from services import translate_hadith
import json

mock_hadith = {
    "kitab": {"ar": "كتاب بدء الوحي"},
    "bab": {"ar": "باب كيف كان بدء الوحي إلى رسول الله صلى الله عليه وسلم"},
    "content": {"ar": "حدثنا الحميدي عبد الله بن الزبير قال حدثنا سفيان قال حدثنا يحيى بن سعيد الأنصاري قال أخبرني محمد بن إبراهيم التيمي أنه سمع علقمة بن وقاص الليثي يقول سمعت عمر بن الخطاب رضي الله عنه على المنبر قال سمعت رسول الله صلى الله عليه وسلم يقول إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى دنيا يصيبها أو إلى امرأة ينكحها فهجرته إلى ما هاجر إليه"}
}

try:
    print("Testing translation for 'Kitab' -> 'หมวด'...")
    result = translate_hadith(mock_hadith)
    print("Translation successful!")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    if "หมวด" in result.get("kitab_th", ""):
        print("SUCCESS: 'หมวด' found in kitab_th")
    else:
        print("WARNING: 'หมวด' NOT found in kitab_th")
        
except Exception as e:
    print(f"Translation failed: {e}")
