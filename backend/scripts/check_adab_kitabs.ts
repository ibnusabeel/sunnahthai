
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

async function checkAdabKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const kitabsCollection = db.collection('kitabs');

    const count = await kitabsCollection.countDocuments({ book: 'adab' });
    console.log(`Found ${count} kitabs for 'adab' in collection.`);

    if (count === 0) {
        console.log('No kitabs found. Please run populate_adab_kitabs_collection.ts');
    } else {
        const sample = await kitabsCollection.findOne({ book: 'adab' });
        console.log('Sample kitab:', sample);
    }

    await client.close();
}

checkAdabKitabs().catch(console.error);
