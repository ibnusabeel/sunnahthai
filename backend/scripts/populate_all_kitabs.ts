/**
 * Populate All Kitabs Collection
 * Aggregates kitabs from translations for ALL books with hadith range
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function populateAllKitabs() {
    console.log('🚀 Populating Kitabs for ALL Books...\n');

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const kitabsCollection = db.collection('kitabs');
    const translationsCollection = db.collection('translations');

    // Get all unique books from translations
    const books = await translationsCollection.distinct('hadith_book');
    console.log(`📚 Found ${books.length} books: ${books.join(', ')}\n`);

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const book of books) {
        console.log(`\n📖 Processing: ${book}`);
        console.log('─'.repeat(40));

        // Delete existing kitabs for this book
        const deleteResult = await kitabsCollection.deleteMany({ book });
        console.log(`   🗑️  Deleted ${deleteResult.deletedCount} existing kitabs`);

        // Aggregate kitabs from translations
        const pipeline = [
            { $match: { hadith_book: book } },
            {
                $group: {
                    _id: '$kitab.id',
                    ar: { $first: '$kitab.ar' },
                    en: { $first: '$kitab.en' },
                    th: { $first: '$kitab.th' },
                    min_hadith: { $min: '$hadith_no' },
                    max_hadith: { $max: '$hadith_no' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { min_hadith: 1 } as any }
        ];

        const results = await translationsCollection.aggregate(pipeline).toArray();
        console.log(`   📊 Found ${results.length} unique kitabs`);

        if (results.length === 0) {
            console.log(`   ⚠️  No kitabs found, skipping...`);
            continue;
        }

        let bookCreated = 0;

        for (let i = 0; i < results.length; i++) {
            const res = results[i];
            if (!res._id && !res.ar) continue; // Skip if no ID and no name

            const order = i + 1;

            await kitabsCollection.insertOne({
                kitab_id: crypto.randomUUID(),
                book: book,
                order: order,
                name: {
                    ar: res.ar || '',
                    en: res.en || '',
                    th: res.th || ''
                },
                hadith_count: res.count,
                min_hadith: res.min_hadith,
                max_hadith: res.max_hadith,
                created_at: new Date(),
                updated_at: new Date()
            });
            bookCreated++;
        }

        console.log(`   ✅ Created ${bookCreated} kitabs`);
        totalCreated += bookCreated;
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   Total books processed: ${books.length}`);
    console.log(`   Total kitabs created: ${totalCreated}`);
    console.log('═'.repeat(50));

    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
}

populateAllKitabs().catch(console.error);
