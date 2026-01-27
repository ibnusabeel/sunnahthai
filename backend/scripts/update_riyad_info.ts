
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

async function updateRiyadInfo() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('book_info');

    const riyadInfo = {
        book: 'riyad',
        th: "ริยาดุศศอลิฮีน",
        ar: "رياض الصالحين",
        description: "สวนของผู้ศรัทธา รวบรวมโดย อิหม่ามนะวะวี",
        icon: "🌿",
        created_at: new Date(),
        updated_at: new Date()
    };

    console.log(`Updating book info for '${riyadInfo.book}'...`);

    const { created_at, ...updateData } = riyadInfo;

    const result = await collection.updateOne(
        { book: riyadInfo.book },
        {
            $set: updateData,
            $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
    );

    console.log(`Update successful! Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);

    await client.close();
}

updateRiyadInfo().catch(console.error);
