
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

async function checkLulu() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    const count = await collection.countDocuments({ hadith_book: 'lulu' });
    console.log(`Found ${count} Lu'lu hadiths.`);

    // Check if kitabs are populated
    const kitabsCollection = db.collection('kitabs');
    const kitabCount = await kitabsCollection.countDocuments({ book: 'lulu' });
    console.log(`Found ${kitabCount} Lu'lu kitabs in kitabs collection.`);

    await client.close();
}

checkLulu().catch(console.error);
