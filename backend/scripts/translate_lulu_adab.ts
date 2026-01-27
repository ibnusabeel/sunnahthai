/**
 * Hadith Translation Script for LuLu and Adab
 * Translates: bab, chain, content fields
 * Uses multiple Gemini API keys to avoid rate limits
 */

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

// Collect all available API keys
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[];

if (API_KEYS.length === 0) {
    console.error('❌ Error: No GEMINI_API_KEY found in .env');
    process.exit(1);
}

console.log(`🔑 Found ${API_KEYS.length} API keys`);

let currentKeyIndex = 0;
let requestCount = 0;
const REQUESTS_PER_KEY = 10; // Rotate key every N requests

function getNextModel() {
    // Rotate API key every N requests
    if (requestCount > 0 && requestCount % REQUESTS_PER_KEY === 0) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        console.log(`🔄 Rotating to API key ${currentKeyIndex + 1}`);
    }
    requestCount++;

    const genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
    return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

interface Hadith {
    _id: ObjectId;
    hadith_id: string;
    hadith_book: string;
    hadith_no?: number;
    kitab?: { ar?: string; th?: string };
    bab?: { ar?: string; th?: string };
    chain?: { ar?: string; th?: string };
    content: { ar: string; th?: string };
}

interface TranslationResult {
    bab: string | null;
    chain: string | null;
    content: string;
}

async function translateBatch(book: string, limit: number = 10, offset: number = 0) {
    console.log(`\n📚 Starting translation for: ${book.toUpperCase()}`);
    console.log(`   Limit: ${limit}, Offset: ${offset}`);

    const client = new MongoClient(MONGO_URI);
    let translated = 0;
    let failed = 0;

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection('translations');

        // Find hadiths that need translation (content.th is missing or empty)
        const query = {
            hadith_book: book,
            $or: [
                { 'content.th': { $exists: false } },
                { 'content.th': null },
                { 'content.th': '' }
            ]
        };

        const hadiths = await collection
            .find(query)
            .skip(offset)
            .limit(limit)
            .toArray() as unknown as Hadith[];

        console.log(`📋 Found ${hadiths.length} hadiths to translate\n`);

        if (hadiths.length === 0) {
            console.log('✨ All hadiths already translated!');
            return;
        }

        for (let i = 0; i < hadiths.length; i++) {
            const hadith = hadiths[i];
            const progress = `[${i + 1}/${hadiths.length}]`;

            console.log(`${progress} Translating: ${hadith.hadith_id}`);

            try {
                const translation = await generateTranslation(hadith);

                if (translation) {
                    const updateFields: any = {
                        'content.th': translation.content,
                        'status': 'translated',
                        'last_updated': new Date()
                    };

                    // Only update bab and chain if they exist in source
                    if (hadith.bab?.ar && translation.bab) {
                        updateFields['bab.th'] = translation.bab;
                    }
                    if (hadith.chain?.ar && translation.chain) {
                        updateFields['chain.th'] = translation.chain;
                    }

                    await collection.updateOne(
                        { _id: hadith._id },
                        { $set: updateFields }
                    );

                    translated++;
                    console.log(`   ✅ Success`);
                } else {
                    failed++;
                    console.log(`   ⚠️ Empty response`);
                }

                // Delay to avoid rate limits (2 seconds between requests)
                await delay(2000);

            } catch (error: any) {
                failed++;
                console.log(`   ❌ Failed: ${error.message}`);

                // If rate limited, wait longer and try rotating key
                if (error.message?.includes('429') || error.message?.includes('quota')) {
                    console.log('   ⏳ Rate limited, waiting 30s and rotating key...');
                    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                    await delay(30000);
                }
            }
        }

        console.log(`\n📊 Translation Complete:`);
        console.log(`   ✅ Translated: ${translated}`);
        console.log(`   ❌ Failed: ${failed}`);

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

async function generateTranslation(hadith: Hadith): Promise<TranslationResult | null> {
    const prompt = `คุณเป็นนักวิชาการอิสลามและนักแปลภาษาอาหรับ-ไทยผู้เชี่ยวชาญ
แปลหะดีษต่อไปนี้เป็นภาษาไทยที่เข้าใจง่าย รักษาศัพท์อิสลามที่ถูกต้อง

📖 หะดีษ: ${hadith.hadith_id}

${hadith.bab?.ar ? `📌 บาบ (หัวข้อบท - อาหรับ): ${hadith.bab.ar}` : ''}
${hadith.chain?.ar ? `⛓️ สายรายงาน (อาหรับ): ${hadith.chain.ar}` : ''}
📜 เนื้อหา (อาหรับ): ${hadith.content.ar}

คำแนะนำ:
1. "chain" - ถอดเสียงชื่อนักรายงานเป็นไทย เช่น "อับดุลลอฮฺ บิน อุมัร" ใช้ " > " คั่นระหว่างนักรายงาน
2. "content" - แปลความหมายให้ถูกต้องและเข้าใจง่าย
3. "bab" - แปลชื่อบทเป็นไทย

ตอบเป็น JSON เท่านั้น:
{
    "bab": "ชื่อบทภาษาไทย หรือ null ถ้าไม่มี",
    "chain": "สายรายงานภาษาไทย หรือ null ถ้าไม่มี",
    "content": "เนื้อหาหะดีษภาษาไทย"
}`;

    try {
        const model = getNextModel();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks
        const cleanText = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        return JSON.parse(cleanText);
    } catch (error: any) {
        throw error;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse command line arguments
const args = process.argv.slice(2);
const book = args[0];
const limit = args[1] ? parseInt(args[1]) : 10;
const offset = args[2] ? parseInt(args[2]) : 0;

if (!book) {
    console.log(`
📚 Hadith Translation Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: npx tsx scripts/translate_lulu_adab.ts <book> [limit] [offset]

Examples:
  npx tsx scripts/translate_lulu_adab.ts lulu 10      # Translate 10 lulu hadiths
  npx tsx scripts/translate_lulu_adab.ts adab 20 100  # Translate 20 adab hadiths, starting from offset 100
  npx tsx scripts/translate_lulu_adab.ts lulu 50      # Translate 50 lulu hadiths

Available books: lulu, adab
    `);
    process.exit(0);
}

// Run translation
translateBatch(book, limit, offset);
