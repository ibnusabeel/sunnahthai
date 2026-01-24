
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' }); // Fallback to pro model

interface Hadith {
    _id: ObjectId;
    hadith_id: string;
    hadith_book: string;
    title?: { ar?: string; th?: string };
    bab?: { ar?: string; th?: string };
    chain?: { ar?: string; th?: string };
    content: { ar: string; th?: string };
}

async function translateBatch(book: string, limit: number = 5) {
    console.log(`Starting batch translation for book: ${book} (Limit: ${limit})`);

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('translations');

        // Find hadiths that need translation
        // Criteria: book matches AND (content.th is missing OR content.th is empty)
        const query = {
            hadith_book: book,
            $or: [
                { 'content.th': { $exists: false } },
                { 'content.th': null },
                { 'content.th': '' }
            ]
        };

        const hadiths = await collection.find(query).limit(limit).toArray() as unknown as Hadith[];

        console.log(`Found ${hadiths.length} hadiths to translate.`);

        if (hadiths.length === 0) {
            console.log('No pending translations found.');
            return;
        }

        for (const hadith of hadiths) {
            console.log(`Translating Hadith ID: ${hadith.hadith_id}...`);
            try {
                const translation = await generateTranslation(hadith);

                if (translation) {
                    await collection.updateOne(
                        { _id: hadith._id },
                        {
                            $set: {
                                'title.th': translation.title,
                                'bab.th': translation.bab,
                                'chain.th': translation.chain,
                                'content.th': translation.content,
                                'status': 'translated', // Mark as translated
                                'last_updated': new Date()
                            }
                        }
                    );
                    console.log(`✅ Updated ${hadith.hadith_id}`);
                }

                // Add a small delay to avoid hitting rate limits too hard
                await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5s

            } catch (error) {
                console.error(`❌ Failed to translate ${hadith.hadith_id}:`, error);
            }
        }

    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        await client.close();
    }
}

async function generateTranslation(hadith: Hadith) {
    const prompt = `
    You are an expert Islamic scholar and translator (Arabic to Thai).
    Translate the following Hadith components into natural, easy-to-understand Thai language.
    Maintain accurate Islamic terminology.

    Input (Arabic):
    Title: ${hadith.title?.ar || '-'}
    Bab (Chapter): ${hadith.bab?.ar || '-'}
    Chain (Narrators): ${hadith.chain?.ar || '-'}
    Content (Matn): ${hadith.content.ar}

    Requirements:
    1. "Chain": Transliterate names to Thai (e.g., "อับดุลลอฮฺ บิน อุมัร"). Use ">" to separate narrators if they are separated in source.
    2. "Content": Translate the meaning accurately.
    3. Return valid JSON only. format:
    {
        "title": "...",
        "bab": "...",
        "chain": "...",
        "content": "..."
    }
    If a field is empty in input, return null or empty string in output.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if any
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(cleanText);
    } catch (e) {
        console.error('Gemini API Error:', e);
        return null;
    }
}

// Get args
const args = process.argv.slice(2);
const book = args[0];
const limit = args[1] ? parseInt(args[1]) : 5;

if (!book) {
    console.error('Please provide book name (e.g., adab, lulu)');
    console.error('Usage: npx tsx scripts/translate_batch.ts <book> [limit]');
    process.exit(1);
}

translateBatch(book, limit);
