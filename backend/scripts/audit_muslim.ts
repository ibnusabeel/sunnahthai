import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hadith_db';

async function auditMuslim() {
    console.log('Connecting to MongoDB:', URI);
    const client = new MongoClient(URI);

    try {
        await client.connect();
        const db = client.db();
        const collection = db.collection('translations');

        console.log('Auditing "muslim" collection...');

        const query = { hadith_book: 'muslim' };
        const total = await collection.countDocuments(query);
        console.log(`Total documents for muslim: ${total}`);

        // 1. Check for duplicate IDs
        const duplicatesById = await collection.aggregate([
            { $match: query },
            { $group: { _id: "$hadith_id", count: { $sum: 1 }, docs: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        console.log(`\nDuplicate hadith_ids found: ${duplicatesById.length}`);
        if (duplicatesById.length > 0) {
            console.log('Top 5 duplicates by ID:');
            duplicatesById.slice(0, 5).forEach(d => {
                console.log(`- ID: ${d._id}, Count: ${d.count}`);
            });
        }

        // 2. Check for duplicate Numbers (hadith_no)
        const duplicatesByNo = await collection.aggregate([
            { $match: query },
            { $group: { _id: "$hadith_no", count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        console.log(`\nDuplicate hadith_nos found: ${duplicatesByNo.length}`);
        if (duplicatesByNo.length > 0) {
            console.log('Top 5 duplicates by Number:');
            duplicatesByNo.slice(0, 5).forEach(d => {
                console.log(`- No: ${d._id}, Count: ${d.count}`);
            });
        }

        // 3. Sample check
        if (duplicatesById.length > 0) {
            const sampleId = duplicatesById[0]._id;
            console.log(`\nInspecting sample duplicate ID: ${sampleId}`);
            const sampleDocs = await collection.find({ hadith_book: 'muslim', hadith_id: sampleId }).toArray();
            sampleDocs.forEach(d => {
                console.log(`\nDoc ID: ${d._id}`);
                console.log(`- Book: ${d.book}`);
                console.log(`- Kitab: ${JSON.stringify(d.kitab)}`);
                console.log(`- Content (Ar): ${d.content?.ar?.substring(0, 50)}...`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

auditMuslim();
