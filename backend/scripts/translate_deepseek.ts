/**
 * Hadith Translation Script using DeepSeek API
 * Translates: bab, chain, content fields for lulu and adab
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

// Collect DeepSeek API keys
const API_KEYS = [
    process.env.DEEPSEEK_API_KEY,
    process.env.DEEPSEEK_API_KEY2,
    process.env.DEEPSEEK_API_KEY3,
].filter(Boolean) as string[];

if (API_KEYS.length === 0) {
    console.error('❌ Error: No DEEPSEEK_API_KEY found in .env');
    process.exit(1);
}

console.log(`🔑 Found ${API_KEYS.length} DeepSeek API keys`);

let currentKeyIndex = 0;
let requestCount = 0;
const REQUESTS_PER_KEY = 15;

function getNextApiKey(): string {
    if (requestCount > 0 && requestCount % REQUESTS_PER_KEY === 0) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        console.log(`🔄 Rotating to API key ${currentKeyIndex + 1}`);
    }
    requestCount++;
    return API_KEYS[currentKeyIndex];
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

async function callDeepSeek(prompt: string): Promise<string> {
    const apiKey = getNextApiKey();

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: 'คุณเป็นนักวิชาการอิสลามและนักแปลภาษาอาหรับ-ไทยผู้เชี่ยวชาญ ตอบเป็น JSON เท่านั้น'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 4096
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API Error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
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

        // Find hadiths that need translation
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

                // Delay between requests (1 second)
                await delay(1000);

            } catch (error: any) {
                failed++;
                console.log(`   ❌ Failed: ${error.message}`);

                // If rate limited, wait and rotate key
                if (error.message?.includes('429') || error.message?.includes('rate')) {
                    console.log('   ⏳ Rate limited, waiting 10s...');
                    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                    await delay(10000);
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

async function generateTranslation(hadith: Hadith, retries: number = 2): Promise<TranslationResult | null> {
    // Truncate very long content to avoid response truncation
    const maxContentLen = 2000;
    const contentAr = hadith.content.ar.length > maxContentLen
        ? hadith.content.ar.substring(0, maxContentLen) + '...'
        : hadith.content.ar;

    const prompt = `แปลหะดีษนี้เป็นไทย ตอบ JSON อย่างเดียว:

${hadith.bab?.ar ? `บาบ: ${hadith.bab.ar}` : ''}
${hadith.chain?.ar ? `สายรายงาน: ${hadith.chain.ar}` : ''}
เนื้อหา: ${contentAr}

{"bab":"แปลบาบ","chain":"ถอดเสียงนักรายงาน เช่น อะหฺมัด > อิบนุ อุมัร","content":"แปลเนื้อหา"}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const text = await callDeepSeek(prompt);

            // Clean markdown code blocks
            let cleanText = text
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            // Try to fix incomplete JSON
            cleanText = tryFixJSON(cleanText);

            return JSON.parse(cleanText);
        } catch (error: any) {
            if (attempt < retries && error.message?.includes('JSON')) {
                console.log(`   ⚠️ JSON error, retrying (${attempt + 1}/${retries})...`);
                await delay(2000);
                continue;
            }
            throw error;
        }
    }
    return null;
}

// Try to fix common JSON issues
function tryFixJSON(text: string): string {
    let fixed = text;

    // Remove trailing incomplete content after last complete field
    // Find the last complete "key": "value" pair
    const lastQuote = fixed.lastIndexOf('"');
    if (lastQuote > 0) {
        // Check if we need to close the JSON
        const afterLast = fixed.substring(lastQuote + 1).trim();
        if (!afterLast.endsWith('}')) {
            // Find if we're missing closing
            const openBraces = (fixed.match(/{/g) || []).length;
            const closeBraces = (fixed.match(/}/g) || []).length;

            if (openBraces > closeBraces) {
                // Try to find the last complete value and close there
                const contentMatch = fixed.match(/"content"\s*:\s*"([^"]*)/);
                if (contentMatch) {
                    // Find where content value should end and close JSON
                    const contentStart = fixed.indexOf('"content"');
                    const valueStart = fixed.indexOf('"', contentStart + 9) + 1;
                    // Look for patterns that indicate end of content
                    let valueEnd = fixed.length;

                    // Simple approach: if JSON is incomplete, try to salvage what we can
                    // Find last properly closed quote before any issues
                    for (let i = fixed.length - 1; i >= valueStart; i--) {
                        if (fixed[i] === '"' && fixed[i - 1] !== '\\') {
                            valueEnd = i;
                            break;
                        }
                    }

                    fixed = fixed.substring(0, valueEnd + 1) + '}';
                }
            }
        }
    }

    return fixed;
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
📚 Hadith Translation Script (DeepSeek)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: npx tsx scripts/translate_deepseek.ts <book> [limit] [offset]

Examples:
  npx tsx scripts/translate_deepseek.ts lulu 10      # Translate 10 lulu hadiths
  npx tsx scripts/translate_deepseek.ts adab 20 100  # Translate 20 adab, offset 100
  npx tsx scripts/translate_deepseek.ts lulu 50      # Translate 50 lulu hadiths

Available books: lulu, adab
    `);
    process.exit(0);
}

// Run translation
translateBatch(book, limit, offset);
