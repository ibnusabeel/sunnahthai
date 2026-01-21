import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

try:
    import certifi
    os.environ['SSL_CERT_FILE'] = certifi.where()
except ImportError:
    pass

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

def translate_hadith(hadith_data: dict, is_retranslate: bool = False) -> dict:
    """
    Translates Hadith content using Google Gemini API.
    """
    
    # Configuration based on retranslate flag
    temperature = 0.7 if is_retranslate else 0.2
    
    generation_config = {
        "temperature": temperature,
        "response_mime_type": "application/json"
    }

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash", 
        generation_config=generation_config,
        system_instruction="You are an expert Islamic scholar translator. Translate the given Hadith JSON (Kitab, Bab, Content) from Arabic to Thai using formal religious language (rajasap) for the Prophet. IMPORTANT: Translate 'كتاب' (Kitab) as 'หมวด' (Category), do NOT use 'หนังสือ'. Return ONLY JSON."
    )

    # Construct the prompt
    prompt_data = {
        "kitab_ar": hadith_data["kitab"]["ar"],
        "bab_ar": hadith_data["bab"]["ar"],
        "content_ar": hadith_data["content"]["ar"]
    }

    prompt = f"""
    Translate the following Islamic text components into Thai:
    
    Input JSON:
    {json.dumps(prompt_data, ensure_ascii=False)}

    Please provided the output as a JSON object with the following keys:
    - kitab_th: Thai translation of the Book title
    - bab_th: Thai translation of the Chapter title
    - content_th: Thai translation of the main Hadith content
    - notes: Any brief translator notes if ambiguity exists (optional)
    
    Ensure the Thai language is formal and respectful, appropriate for religious texts.
    """

    response = model.generate_content(prompt)
    
    try:
        parsed_response = json.loads(response.text)
        # Handle case where Gemini returns a list instead of a dict
        if isinstance(parsed_response, list):
            if parsed_response:
                return parsed_response[0]
            else:
                raise ValueError("Empty list returned from Gemini")
        return parsed_response
    except json.JSONDecodeError:
        # Fallback in case of malformed JSON, though response_mime_type should prevent this
        raise ValueError("Failed to parse JSON response from Gemini")

