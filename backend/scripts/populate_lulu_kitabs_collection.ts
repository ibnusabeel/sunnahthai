import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { luluKitabs } from './data/lulu_kitabs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function populateLuluKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('kitabs');

    console.log(`Checking existing kitabs for 'lulu'...`);
    const existingKitabs = await collection.find({ book: 'lulu' }).toArray();
    const existingOrders = new Set(existingKitabs.map(k => k.order));

    console.log(`Found ${existingKitabs.length} managed kitabs.`);

    let insertedCount = 0;

    for (const kitab of luluKitabs) {
        // If this kitab order (id) is already managed, skip (preserve user edits)
        if (existingOrders.has(kitab.id)) {
            console.log(`Skipping existing kitab order ${kitab.id}: ${kitab.th}`);
            continue;
        }

        const newKitab = {
            kitab_id: crypto.randomUUID(),
            book: 'lulu',
            order: kitab.id,
            name: {
                th: kitab.th,
                ar: kitab.ar,
                en: '' // No English by default
            },
            hadith_count: 0, // Will be calculated by system or verified later
            created_at: new Date(),
            updated_at: new Date()
        };

        await collection.insertOne(newKitab);
        insertedCount++;
        process.stdout.write('.');
    }

    console.log(`\nSuccessfully populated ${insertedCount} new kitabs for Lu'lu.`);
    await client.close();
}

populateLuluKitabs().catch(console.error);
