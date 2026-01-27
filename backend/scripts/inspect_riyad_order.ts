
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

async function inspectOrder() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    const pipeline = [
        { $match: { hadith_book: 'riyad' } },
        {
            $group: {
                _id: '$kitab.id',
                min_hadith: { $min: '$hadith_no' },
                max_hadith: { $max: '$hadith_no' },
                count: { $sum: 1 },
                name: { $first: '$kitab.th' }
            }
        },
        { $sort: { min_hadith: 1 } }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    console.log('Kitab Order based on Hadith Number:');
    results.forEach((r, i) => {
        console.log(`${i + 1}. Kitab ID: ${r._id}, Hadith: ${r.min_hadith}-${r.max_hadith}, Name: ${r.name || 'N/A'}`);
    });

    await client.close();
}

inspectOrder().catch(console.error);
