
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

async function verifyRiyad() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const translations = db.collection('translations');
    const kitabs = db.collection('kitabs');
    const bookInfo = db.collection('book_info');

    console.log('--- Verification Report ---');

    const total = await translations.countDocuments({ hadith_book: 'riyad' });
    console.log(`Total Riyad Hadiths: ${total}`);

    const published = await translations.countDocuments({ hadith_book: 'riyad', status: 'published' });
    console.log(`Status 'published': ${published}`);

    const translated = await translations.countDocuments({ hadith_book: 'riyad', status: 'translated' });
    console.log(`Status 'translated': ${translated}`);

    const kitabCount = await kitabs.countDocuments({ book: 'riyad' });
    console.log(`Total Riyad Kitabs: ${kitabCount}`);

    const info = await bookInfo.findOne({ book: 'riyad' });
    console.log(`Book Info Present: ${!!info}`);
    if (info) {
        console.log(`Book Title (TH): ${info.th}`);
        console.log(`Book Title (AR): ${info.ar}`);
    }

    await client.close();
}

verifyRiyad().catch(console.error);
