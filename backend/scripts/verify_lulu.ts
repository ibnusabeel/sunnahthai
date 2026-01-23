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

async function verifyLulu() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    // Check Book Info
    const bookInfo = await db.collection('book_info').findOne({ book: 'lulu' });
    console.log('--------------------------------');
    console.log('Book Info Status:');
    if (bookInfo) {
        console.log('✅ Found "lulu" in book_info');
        console.log(`   Title: ${bookInfo.th}`);
        console.log(`   Description: ${bookInfo.description}`);
    } else {
        console.log('❌ "lulu" NOT found in book_info');
    }

    // Check Translations
    const count = await db.collection('translations').countDocuments({ hadith_book: 'lulu' });
    console.log('--------------------------------');
    console.log('Translations Status:');
    console.log(`   Total "lulu" hadiths: ${count}`);

    if (count > 0) {
        const sample = await db.collection('translations').findOne({ hadith_book: 'lulu' });
        console.log('   Sample Kitab ID:', sample?.kitab?.id);
        console.log('   Sample Kitab TH:', sample?.kitab?.th);
    }

    await client.close();
}

verifyLulu().catch(console.error);
