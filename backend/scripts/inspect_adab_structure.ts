
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

async function inspectAdabKitab() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('kitabs');

    const result = await collection.find({ book: 'adab' }).limit(1).toArray();

    if (result.length > 0) {
        console.log('Found Adab kitab. Structure:');
        console.log(JSON.stringify(result[0], null, 2));
    } else {
        console.log('No Adab kitabs found in collection.');
    }

    await client.close();
}

inspectAdabKitab().catch(console.error);
