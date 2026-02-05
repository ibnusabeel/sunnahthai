import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("Starting Ahmad Arabic Fixer...");

    if (!DEEPSEEK_KEY) {
        console.error("❌ DEEPSEEK_API_KEY not found in .env");
        process.exit(1);
    }

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('translations');

        // Scan all ahmad for missing/empty arabic
        console.log("Scanning all Ahmad hadiths for missing Arabic...");
        const cursor = collection.find({ hadith_book: 'ahmad' });

        let processed = 0;
        let missingCount = 0;

        for await (const doc of cursor) {
            processed++;
            const ar = doc.content?.ar;

            // Check if missing or very short (likely broken)
            // User said "null", so !ar check covers null, undefined, empty string
            if (!ar || ar.trim().length < 5) {
                missingCount++;
                console.log(`[${missingCount}] Found missing Arabic: ${doc.hadith_id} (No: ${doc.hadith_no})`);

                // Fetch from DeepSeek
                try {
                    console.log(`   Fetching for #${doc.hadith_no}...`);
                    const result = await fetchDeepSeek(doc.hadith_no);

                    if (result && result.ar) {
                        // Update
                        await collection.updateOne(
                            { _id: doc._id },
                            {
                                $set: {
                                    'content.ar': result.ar,
                                    'last_updated': new Date()
                                }
                            }
                        );
                        // If Thai is provided and original Thai is missing, update it too?
                        if (result.th && (!doc.content?.th || doc.content.th.length < 5)) {
                            await collection.updateOne(
                                { _id: doc._id },
                                { $set: { 'content.th': result.th } }
                            );
                            console.log(`   ✅ Updated Arabic & Thai`);
                        } else {
                            console.log(`   ✅ Updated Arabic`);
                        }
                    } else {
                        console.log(`   ⚠️ DeepSeek returned no Arabic for #${doc.hadith_no}`);
                    }

                    // Rate limit
                    await sleep(1000); // 1 sec delay

                } catch (err: any) {
                    console.error(`   ❌ Error fetching: ${err.message}`);
                }
            }

            if (processed % 1000 === 0) {
                process.stdout.write(`Scanned ${processed}...\r`);
            }
        }

        console.log(`\nScan complete.`);
        console.log(`Found and processed ${missingCount} hadiths missing Arabic.`);

        if (missingCount === 0) {
            console.log("Strange. User reported 56, but I found 0 with empty/null Arabic text.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function fetchDeepSeek(hadithNo: number): Promise<{ ar: string, th: string } | null> {
    const url = 'https://api.deepseek.com/chat/completions';

    // Prompt
    const prompt = `Find the Arabic text and Translate to Thai for: Musnad Ahmad Hadith Number ${hadithNo}.
    
    Format strict JSON:
    {
      "ar": "Arabic text found",
      "th": "Thai translation"
    }
    
    If not found, return null JSON.
    Only return the JSON.`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a helpful Islamic Scholar assistant. You output valid JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`DeepSeek API Error: ${res.status} ${txt}`);
        }

        const data: any = await res.json();
        const contentStr = data.choices[0].message.content;

        // Extract JSON
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        return JSON.parse(jsonMatch[0]);

    } catch (e) {
        throw e;
    }
}

main();
