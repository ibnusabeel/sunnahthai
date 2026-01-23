
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import KITAB_UPDATES from './data/adab_kitabs_corrected';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function populateAdabKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const kitabsCollection = db.collection('kitabs');
    const translationsCollection = db.collection('translations');

    console.log(`Processing ${KITAB_UPDATES.length} kitabs for Adab...`);

    let existingCount = 0;
    let newCount = 0;

    for (const kitab of KITAB_UPDATES) {
        if (!kitab.ar) continue;

        // Count hadiths for this kitab
        const count = await translationsCollection.countDocuments({
            hadith_book: 'adab',
            'kitab.ar': kitab.ar
        });

        // Check if kitab exists
        const existingKitab = await kitabsCollection.findOne({
            book: 'adab',
            id: parseInt(kitab.id)
        });

        if (existingKitab) {
            // Update existing
            await kitabsCollection.updateOne(
                { _id: existingKitab._id },
                {
                    $set: {
                        ar: kitab.ar,
                        th: kitab.th,
                        hadith_count: count,
                        updated_at: new Date()
                    }
                }
            );
            existingCount++;
            process.stdout.write('.');
        } else {
            // Create new
            await kitabsCollection.insertOne({
                kitab_id: crypto.randomUUID(),
                book: 'adab',
                id: parseInt(kitab.id),
                ar: kitab.ar,
                th: kitab.th,
                en: '',
                hadith_count: count,
                created_at: new Date(),
                updated_at: new Date()
            });
            newCount++;
            process.stdout.write('+');
        }
    }

    console.log(`\nFinished! Updated: ${existingCount}, Created: ${newCount}`);
    await client.close();
}

populateAdabKitabs().catch(console.error);
