
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!import.meta.env.GEMINI_API_KEY) {
    throw new Error('Invalid/Missing environment variable: "GEMINI_API_KEY"');
}

const genAI = new GoogleGenerativeAI(import.meta.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "You are an expert Islamic scholar translator. Translate the given Hadith JSON (Kitab, Bab, Content) from Arabic to Thai using formal religious language (rajasap) for the Prophet. IMPORTANT: Translate 'كتاب' (Kitab) as 'หมวด' (Category), do NOT use 'หนังสือ'. Return ONLY JSON."
});

interface HadithData {
    kitab: { ar: string };
    bab: { ar: string };
    content: { ar: string };
}

interface TranslationResult {
    kitab_th: string;
    bab_th: string;
    content_th: string;
    notes?: string;
}

export async function translateHadith(hadithData: HadithData, isRetranslate: boolean = false): Promise<TranslationResult> {
    const temperature = isRetranslate ? 0.7 : 0.2;

    const generationConfig = {
        temperature: temperature,
        responseMimeType: "application/json",
    };

    const chatSession = model.startChat({
        generationConfig,
    });

    const promptData = {
        kitab_ar: hadithData.kitab.ar,
        bab_ar: hadithData.bab.ar,
        content_ar: hadithData.content.ar
    };

    const prompt = `
    Translate the following Islamic text components into Thai:
    
    Input JSON:
    ${JSON.stringify(promptData)}

    Please provided the output as a JSON object with the following keys:
    - kitab_th: Thai translation of the Book title
    - bab_th: Thai translation of the Chapter title
    - content_th: Thai translation of the main Hadith content
    - notes: Any brief translator notes if ambiguity exists (optional)
    
    Ensure the Thai language is formal and respectful, appropriate for religious texts.
    `;

    try {
        const result = await chatSession.sendMessage(prompt);
        const responseText = result.response.text();

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (e) {
            throw new Error("Failed to parse JSON response from Gemini");
        }

        // Handle case where Gemini returns a list instead of a dict
        if (Array.isArray(parsedResponse)) {
            if (parsedResponse.length > 0) {
                return parsedResponse[0] as TranslationResult;
            } else {
                throw new Error("Empty list returned from Gemini");
            }
        }

        return parsedResponse as TranslationResult;

    } catch (error) {
        console.error("Gemini Translation Error:", error);
        throw error;
    }
}
