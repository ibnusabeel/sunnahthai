import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hadith';

async function inspectDb() {
    console.log('Connecting to:', URI);
    const client = new MongoClient(URI);
    try {
        await client.connect();
        const db = client.db();
        const collection = db.collection('translations');

        console.log('Connected. Counting documents...');
        const total = await collection.countDocuments({});
        console.log(`Total documents in 'translations': ${total}`);

        console.log('\n distinct hadith_book values:');
        const books = await collection.distinct('hadith_book');
        console.log(books);

        console.log('\nCounts per book:');
        for (const book of books) {
            const count = await collection.countDocuments({ hadith_book: book });
            console.log(`- ${book}: ${count}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectDb();
