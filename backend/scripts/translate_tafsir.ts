import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY not found in .env');
    process.exit(1);
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callDeepSeek(prompt: string): Promise<string> {
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful Islamic scholar translator. You translate Tafsir Al-Jalalayn from Arabic to Thai using clear, respectful, and easy-to-understand language."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
        throw error;
    }
}

async function translateTafsir() {
    console.log('🔌 Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('quran_ayahs');

    try {
        // Find ayahs with arabic tafsir but no thai tafsir
        const query = {
            tafsir_ar: { $exists: true, $ne: '' },
            $or: [
                { tafsir_th: null },
                { tafsir_th: '' },
                { tafsir_th: { $exists: false } }
            ]
        };

        const totalToTranslate = await collection.countDocuments(query);
        console.log(`🎯 Found ${totalToTranslate} ayahs to translate in Total (using DeepSeek)`);

        const cursor = collection.find(query).addCursorFlag('noCursorTimeout', true);
        let count = 0;

        for await (const ayah of cursor) {
            count++;
            console.log(`\n[${count}/${totalToTranslate}] Translating Surah ${ayah.surah_no}:${ayah.ayah_no}...`);

            const prompt = `
Please translate the following Tafsir Al-Jalalayn (Arabic commentary on the Quran) into Thai.

**Context:**
- Surah Number: ${ayah.surah_no}
- Ayah Number: ${ayah.ayah_no}
- Original Ayah Text: ${ayah.text_uthmani}
- Arabic Tafsir: ${ayah.tafsir_ar}

**Instructions:**
- Translate strictly the meaning of the Tafsir explanation into Thai.
- Make the translation smooth, respectful, and easy to read for Thai Muslims.
- Do NOT output markdown or explanations, just the Thai translation paragraph.
- If the Tafsir explains a specific word, integrate it naturally into the sentence.
- Use strictly Thai language.

**Translation:**
`;

            // Retry logic
            let retries = 3;
            while (retries > 0) {
                try {
                    const translatedText = await callDeepSeek(prompt);

                    if (translatedText) {
                        await collection.updateOne(
                            { _id: ayah._id },
                            {
                                $set: {
                                    tafsir_th: translatedText,
                                    status: 'translated',
                                    updated_at: new Date()
                                }
                            }
                        );
                        console.log(`   ✅ Translated: "${translatedText.substring(0, 50)}..."`);
                        break; // Success
                    } else {
                        console.log('   ⚠️ Empty response from DeepSeek, retrying...');
                        retries--;
                    }
                } catch (err: any) {
                    console.error(`   ❌ API Error: ${err.message}`);
                    if (err.message.includes('429') && retries > 1) {
                        console.log(`   ⏳ Rate limited. Waiting 10s...`);
                        await sleep(10000);
                        retries--;
                    } else {
                        retries--;
                        await sleep(3000);
                    }
                }
            }

            // Rate limit
            await sleep(2000);
        }

        console.log('\n🎉 Translation completed for Surah 1!');

    } catch (error) {
        console.error('❌ Script failed:', error);
    } finally {
        await client.close();
    }
}

translateTafsir();
