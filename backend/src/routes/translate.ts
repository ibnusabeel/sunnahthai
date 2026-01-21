import { FastifyPluginAsync } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCollection } from '../config/db.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

interface TranslateQuery {
    retranslate?: string;
}

const translateRoutes: FastifyPluginAsync = async (fastify) => {
    // POST /api/hadith/:id/translate - Trigger AI translation
    fastify.post('/hadith/:id/translate', async (request, reply) => {
        const { id } = request.params as { id: string };
        const query = request.query as TranslateQuery;
        const retranslate = query.retranslate === 'true';

        if (!GEMINI_API_KEY) {
            return reply.status(500).send({ detail: 'GEMINI_API_KEY not configured' });
        }

        try {
            const collection = await getCollection('translations');
            const hadith = await collection.findOne({ hadith_id: id });

            if (!hadith) {
                return reply.status(404).send({ detail: 'Hadith not found' });
            }

            // Check if already translated
            if (hadith.status === 'translated' && !retranslate) {
                const { _id, ...rest } = hadith;
                return rest;
            }

            // Call Gemini for translation
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction: `You are an expert translator specializing in Islamic hadith texts.
Your task is to translate Arabic hadith text into formal Thai language suitable for religious texts.
Follow these rules:
1. Use proper Thai Islamic terminology
2. Maintain respectful language for the Prophet (use ศ็อลลัลลอฮุอะลัยฮิวะสัลลัม)
3. Keep the translation accurate to the original meaning
4. Return ONLY valid JSON, no markdown or extra text`
            });

            const prompt = `Translate this hadith to Thai:

Kitab (Arabic): ${hadith.kitab?.ar || ''}
Bab (Arabic): ${hadith.bab?.ar || ''}
Content (Arabic): ${hadith.content?.ar || ''}

Return JSON format:
{
  "kitab_th": "Thai translation of kitab name",
  "bab_th": "Thai translation of bab name",
  "content_th": "Thai translation of hadith content",
  "notes": "Any translation notes"
}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Extract JSON from response
            let translationResult;
            try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    translationResult = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                fastify.log.error({ response: responseText }, 'Failed to parse Gemini response');
                return reply.status(500).send({ detail: 'Failed to parse translation response' });
            }

            // Update hadith
            await collection.updateOne(
                { hadith_id: id },
                {
                    $set: {
                        'kitab.th': translationResult.kitab_th,
                        'bab.th': translationResult.bab_th,
                        'content.th': translationResult.content_th,
                        status: 'translated',
                        last_updated: new Date(),
                        translation_notes: translationResult.notes
                    }
                }
            );

            // Return updated hadith
            const updatedHadith = await collection.findOne({ hadith_id: id });
            const { _id, ...rest } = updatedHadith!;
            return rest;

        } catch (error: any) {
            fastify.log.error(error, 'Translation error');
            return reply.status(500).send({ detail: `Translation failed: ${error.message}` });
        }
    });
};

export default translateRoutes;
