
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function listAdabKitabs() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    const kitabs = await collection.distinct('kitab.ar', { hadith_book: 'adab' });

    console.log('--- Distinct Kitab Names in "adab" ---');
    kitabs.sort().forEach((k, i) => {
        console.log(`${i + 1}. '${k}'`);
    });
    console.log(`Total distinct kitabs: ${kitabs.length}`);

    await client.close();
}

listAdabKitabs().catch(console.error);
