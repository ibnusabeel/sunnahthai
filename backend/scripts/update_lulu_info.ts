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

async function updateLuluInfo() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('book_info');

    const luluInfo = {
        book: 'lulu',
        th: "อัล-ลุ'ลุ' วัล-มัรญาน",
        ar: "اللؤلؤ والمرجان",
        description: "รวบรวมหะดีษที่เห็นพ้องต้องกันจากบุคอรีและมุสลิม (Muttafaq 'Alayh)",
        icon: "💎", // Diamond icon as used in coming soon
        created_at: new Date(),
        updated_at: new Date()
    };

    console.log(`Updating book info for '${luluInfo.book}'...`);

    const { created_at, ...updateData } = luluInfo;

    const result = await collection.updateOne(
        { book: luluInfo.book },
        {
            $set: updateData,
            $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
    );

    console.log(`Update successful! Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);

    await client.close();
}

updateLuluInfo().catch(console.error);
