
import { connectDB, getCollection } from '../src/config/db';
import fetch from 'node-fetch';

async function debugNames() {
    await connectDB();
    const collection = await getCollection('book_info');
    const docs = await collection.find({}).toArray();
    console.log('--- DB Content (book_info) ---');
    console.log(JSON.stringify(docs, null, 2));

    console.log('\n--- API Response (/api/book-names) ---');
    try {
        const res = await fetch('http://localhost:3000/api/book-names');
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('API Fetch failed:', e);
    }
    process.exit(0);
}

debugNames();
