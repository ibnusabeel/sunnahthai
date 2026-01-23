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

async function verifyLuluKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('kitabs');

    const count = await collection.countDocuments({ book: 'lulu' });
    console.log(`Found ${count} kitabs for 'lulu' in 'kitabs' collection.`);

    if (count > 0) {
        const sample = await collection.findOne({ book: 'lulu' });
        console.log('Sample:', JSON.stringify(sample, null, 2));
    }

    await client.close();
}

verifyLuluKitabs().catch(console.error);
