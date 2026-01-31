/**
 * Riyad Kitab & Chain Translation Script using DeepSeek API
 * Translates: kitab.th, chain.th from Arabic to Thai
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
    kitab?: { ar?: string; th?: string; id?: number };
    bab?: { ar?: string; th?: string };
    chain?: { ar?: string; th?: string };
    content?: { ar?: string; th?: string };
}

interface TranslationResult {
    kitab: string | null;
    bab: string | null;
    chain: string | null;
    content: string | null;
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
                    content: `คุณเป็นนักวิชาการอิสลามและนักแปลภาษาอาหรับ-ไทยผู้เชี่ยวชาญ ตอบเป็น JSON เท่านั้น
                    
สำหรับ kitab (หมวดหะดีษ) - แปลความหมายเป็นภาษาไทย
สำหรับ chain (สายรายงาน) - ทับศัพท์ชื่อผู้รายงานเป็นภาษาไทย (transliterate)`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2048
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API Error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
}

async function translateBatch(limit: number = 10, offset: number = 0, mode: 'kitab' | 'chain' | 'bab' | 'content' | 'all' = 'all') {
    console.log(`\n📚 Starting Riyad ${mode} translation`);
    console.log(`   Limit: ${limit}, Offset: ${offset}`);

    const client = new MongoClient(MONGO_URI);
    let translated = 0;
    let failed = 0;

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection('translations');

        // Build query based on mode
        const queryConditions: any[] = [];

        if (['kitab', 'all'].includes(mode)) {
            queryConditions.push({
                'kitab.ar': { $exists: true, $ne: null, $ne: '' },
                $or: [{ 'kitab.th': { $exists: false } }, { 'kitab.th': null }, { 'kitab.th': '' }]
            });
        }

        if (['bab', 'all'].includes(mode)) {
            queryConditions.push({
                'bab.ar': { $exists: true, $ne: null, $ne: '' },
                $or: [{ 'bab.th': { $exists: false } }, { 'bab.th': null }, { 'bab.th': '' }]
            });
        }

        if (['chain', 'all'].includes(mode)) {
            queryConditions.push({
                'chain.ar': { $exists: true, $ne: null, $ne: '' },
                $or: [{ 'chain.th': { $exists: false } }, { 'chain.th': null }, { 'chain.th': '' }]
            });
        }

        if (['content', 'all'].includes(mode)) {
            queryConditions.push({
                'content.ar': { $exists: true, $ne: null, $ne: '' },
                $or: [{ 'content.th': { $exists: false } }, { 'content.th': null }, { 'content.th': '' }]
            });
        }

        const query = {
            hadith_book: 'riyad',
            $or: queryConditions
        };

        const hadiths = await collection
            .find(query)
            .skip(offset)
            .limit(limit)
            .toArray() as unknown as Hadith[];

        console.log(`📋 Found ${hadiths.length} hadiths to translate\n`);

        if (hadiths.length === 0) {
            console.log('✨ All riyad kitab/chain already translated!');
            return;
        }

        for (let i = 0; i < hadiths.length; i++) {
            const hadith = hadiths[i];
            const progress = `[${i + 1}/${hadiths.length}]`;

            console.log(`${progress} Translating: ${hadith.hadith_id}`);

            try {
                const translation = await generateTranslation(hadith, mode);

                if (translation) {
                    const updateFields: any = {
                        'last_updated': new Date()
                    };

                    if (translation.kitab && hadith.kitab?.ar) updateFields['kitab.th'] = translation.kitab;
                    if (translation.bab && hadith.bab?.ar) updateFields['bab.th'] = translation.bab;
                    if (translation.chain && hadith.chain?.ar) updateFields['chain.th'] = translation.chain;
                    if (translation.content && hadith.content?.ar) updateFields['content.th'] = translation.content;

                    if (Object.keys(updateFields).length > 1) {
                        await collection.updateOne(
                            { _id: hadith._id },
                            { $set: updateFields }
                        );

                        translated++;
                        console.log(`   ✅ Success`);
                    } else {
                        console.log(`   ⚠️ No fields to update`);
                    }
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

async function generateTranslation(hadith: Hadith, mode: string, retries: number = 2): Promise<TranslationResult | null> {
    const kitabAr = hadith.kitab?.ar || '';
    const babAr = hadith.bab?.ar || '';
    const chainAr = hadith.chain?.ar || '';
    const contentAr = hadith.content?.ar || '';

    // Skip if nothing to translate
    const needsKitab = ['kitab', 'all'].includes(mode) && kitabAr;
    const needsBab = ['bab', 'all'].includes(mode) && babAr;
    const needsChain = ['chain', 'all'].includes(mode) && chainAr;
    const needsContent = ['content', 'all'].includes(mode) && contentAr;

    if (!needsKitab && !needsBab && !needsChain && !needsContent) {
        return null;
    }

    // Build prompt based on what needs translation
    let prompt = `Translate this Hadith to Thai. Return ONLY raw JSON without markdown formatting.\n\n`;

    if (needsKitab) prompt += `Ar Kitab (Main Section): ${kitabAr}\n`;
    if (needsBab) prompt += `Ar Bab (Chapter Title): ${babAr}\n`;
    if (needsChain) {
        const truncatedChain = chainAr.length > 500 ? chainAr.substring(0, 500) + '...' : chainAr;
        prompt += `Ar Chain (Narrators): ${truncatedChain}\n`;
    }
    if (needsContent) {
        const truncatedContent = contentAr.length > 2000 ? contentAr.substring(0, 2000) + '...' : contentAr;
        prompt += `Ar Content (Hadith Text): ${truncatedContent}\n`;
    }

    prompt += `
Required JSON Format:
{
  "kitab": "Thai translation of Kitab (or null)",
  "bab": "Thai translation of Bab (or null)",
  "chain": "Thai transliteration of Narrators (or null)",
  "content": "Thai translation of Content (or null)"
}

คำแนะนำ:
1. "chain" - ถอดเสียงชื่อนักรายงานเป็นไทย เช่น "อับดุลลอฮฺ บิน อุมัร" ใช้ " > " คั่นระหว่างนักรายงาน
2. "content" - แปลความหมายให้ถูกต้องและเข้าใจง่าย
3. "bab" - แปลชื่อบทเป็นไทย`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        let text = '';
        try {
            text = await callDeepSeek(prompt);

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

            // Log raw response on final failure
            if (error.message?.includes('JSON') || error instanceof SyntaxError) {
                console.log(`   ❌ JSON Parse Error. Raw response:\n${text}`);
            }
            throw error;
        }
    }
    return null;
}

// Try to fix common JSON issues
function tryFixJSON(text: string): string {
    let fixed = text;

    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;

    if (openBraces > closeBraces) {
        // Find last complete field and close
        const lastQuote = fixed.lastIndexOf('"');
        if (lastQuote > 0) {
            const afterLast = fixed.substring(lastQuote + 1).trim();
            if (!afterLast.endsWith('}')) {
                fixed = fixed.substring(0, lastQuote + 1) + '}';
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
const mode = (args[0] || 'all') as 'kitab' | 'chain' | 'bab' | 'content' | 'all';
const limit = args[1] ? parseInt(args[1]) : 10;
const offset = args[2] ? parseInt(args[2]) : 0;

if (args[0] === 'help' || args[0] === '--help') {
    console.log(`
📚 Riyad Fields Translation Script (DeepSeek)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: npx tsx scripts/translate_riyad_fields.ts [mode] [limit] [offset]

Modes:
  kitab   - Translate only kitab (Main Book/Section)
  bab     - Translate only bab (Chapter Title)
  chain   - Transliterate chain (Narrators)
  content - Translate content (Hadith Body)
  all     - Translate all 4 fields (default)

Examples:
  npx tsx scripts/translate_riyad_fields.ts all 10        # Translate 10 riyad hadiths
  npx tsx scripts/translate_riyad_fields.ts content 20    # Translate content only
  npx tsx scripts/translate_riyad_fields.ts chain 20 100  # Translate chain only
    `);
    process.exit(0);
}

if (!['kitab', 'chain', 'bab', 'content', 'all'].includes(mode)) {
    console.error(`❌ Invalid mode: ${mode}. Use: kitab, bab, chain, content, or all`);
    process.exit(1);
}

// Run translation
translateBatch(limit, offset, mode);
