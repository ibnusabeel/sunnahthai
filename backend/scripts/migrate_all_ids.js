import { MongoClient } from 'mongodb';

async function migrateAllIds() {
    console.log('Starting migration for ALL kitab IDs (with AR fallback)...');
    const client = new MongoClient('mongodb://localhost:27017');

    try {
        await client.connect();
        const db = client.db('hadith_db');
        const translations = db.collection('translations');
        const kitabs = db.collection('kitabs');

        // 1. Get all unique books
        const books = await kitabs.distinct('book');
        console.log(`Found ${books.length} books to process: ${books.join(', ')}`);

        let totalUpdated = 0;

        for (const book of books) {
            console.log(`\nProcessing book: ${book}...`);

            // Get all kitabs for this book
            const bookKitabs = await kitabs.find({ book: book }).toArray();
            let bookUpdated = 0;

            for (const k of bookKitabs) {
                // Determine if we have names to match
                const hasTh = k.name && k.name.th;
                const hasAr = k.name && k.name.ar;

                if (!hasTh && !hasAr) continue;

                let updatedForKitab = 0;

                // Priority 1: Match by TH name
                if (hasTh) {
                    const resultTh = await translations.updateMany(
                        {
                            hadith_book: book,
                            'kitab.th': k.name.th
                        },
                        {
                            $set: { 'kitab.id': k.order }
                        }
                    );
                    updatedForKitab += resultTh.modifiedCount;
                }

                // Priority 2: Match by AR name (for remaining hadiths lacking ID or not matched by TH)
                // Only if AR name exists
                if (hasAr) {
                    const resultAr = await translations.updateMany(
                        {
                            hadith_book: book,
                            $or: [ // Missing or empty ID
                                { 'kitab.id': { $exists: false } },
                                { 'kitab.id': null }
                            ],
                            'kitab.ar': k.name.ar
                        },
                        {
                            $set: { 'kitab.id': k.order }
                        }
                    );
                    updatedForKitab += resultAr.modifiedCount;
                }

                if (updatedForKitab > 0) {
                    bookUpdated += updatedForKitab;
                }
            }
            console.log(`  -> Updated ${bookUpdated} hadiths for ${book}`);
            totalUpdated += bookUpdated;
        }

        console.log(`\nMigration complete! Total hadiths updated across all books: ${totalUpdated}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
    }
}

migrateAllIds();
