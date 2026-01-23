import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { luluKitabs } from './data/lulu_kitabs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function updateLuluKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    console.log(`Found ${luluKitabs.length} kitab updates to apply.`);

    let totalUpdated = 0;

    for (const kitab of luluKitabs) {
        // Update all hadiths that match this kitab's Arabic name
        // Cleaning up the Arabic text to ensure matches despite minor differences
        const cleanAr = kitab.ar.trim();

        // Update query: match book='lulu' and kitab.ar (fuzzy match or exact)
        // Since we imported exactly from CSV, exact match on strings should work well
        // if the CSV data aligns with this list.

        const result = await collection.updateMany(
            {
                hadith_book: 'lulu',
                'kitab.ar': cleanAr
            },
            {
                $set: {
                    'kitab.th': kitab.th,
                    // Also ensure ID is set to integer if possible for sorting
                    'kitab.id': kitab.id
                }
            }
        );

        if (result.matchedCount > 0) {
            console.log(`Updated kitab '${kitab.th}' (ID: ${kitab.id}): ${result.modifiedCount} hadiths modified.`);
            totalUpdated += result.modifiedCount;
        } else {
            console.log(`⚠️ No hadiths found for kitab: ${cleanAr}`);
        }
    }

    console.log(`\nTotal hadiths updated: ${totalUpdated}`);
    await client.close();
}

updateLuluKitabs().catch(console.error);
