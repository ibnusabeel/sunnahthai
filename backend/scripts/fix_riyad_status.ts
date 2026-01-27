
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

async function fixRiyadStatus() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    console.log('Updating Riyad hadiths status to "translated"...');

    // Update all riyad hadiths that have status 'published' to 'translated'
    const result = await collection.updateMany(
        { hadith_book: 'riyad', status: 'published' },
        { $set: { status: 'translated' } }
    );

    console.log(`Updated ${result.modifiedCount} hadiths.`);

    await client.close();
}

fixRiyadStatus().catch(console.error);
