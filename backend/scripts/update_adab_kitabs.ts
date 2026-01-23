
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import KITAB_UPDATES from './data/adab_kitabs_corrected';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function updateKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    console.log(`Found ${KITAB_UPDATES.length} kitab updates to apply.`);

    let updatedCount = 0;

    for (const update of KITAB_UPDATES) {
        if (!update.ar) continue;

        // Pad ID to 2 digits for better sorting if string sorting is used (e.g. "01", "10")
        // Or keep as is if numbers. The user list uses "1", "2".
        // Let's perform a dry run or check specifically what matches
        // Match by Arabic kitab name

        // We update all hadiths in 'adab' book that have this kitab.ar
        const filter = {
            hadith_book: 'adab',
            'kitab.ar': update.ar
        };

        const updateDoc = {
            $set: {
                'kitab.th': update.th,
                'kitab.id': update.id // The order provided by user
            }
        };

        const result = await collection.updateMany(filter, updateDoc);
        console.log(`Updated kitab '${update.ar}' (Assigned ID: ${update.id}): ${result.modifiedCount} hadiths modified.`);
        updatedCount += result.modifiedCount;
    }

    console.log(`\nTotal hadiths updated: ${updatedCount}`);
    await client.close();
}

updateKitabs().catch(console.error);
