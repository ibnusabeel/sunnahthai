import { MongoClient } from 'mongodb';

async function auditKitabIds() {
    console.log('Starting audit for kitab.id in all books...');
    const client = new MongoClient('mongodb://localhost:27017');

    try {
        await client.connect();
        const db = client.db('hadith_db');
        const translations = db.collection('translations');
        const kitabs = db.collection('kitabs');

        // 1. Get all distinct books from kitabs
        const books = await kitabs.distinct('book');
        console.log(`Found ${books.length} books in kitabs collection: ${books.join(', ')}`);

        console.log('\n--- Audit Results ---');
        console.log('Book\t\tTotal Hadiths\tMissing ID\tStatus');
        console.log('------------------------------------------------------------');

        for (const book of books) {
            // Count total hadiths for this book
            const total = await translations.countDocuments({ hadith_book: book });

            // Count hadiths missing kitab.id
            const missingId = await translations.countDocuments({
                hadith_book: book,
                $or: [
                    { 'kitab.id': { $exists: false } },
                    { 'kitab.id': null }
                ]
            });

            const status = missingId === 0 ? '✅ OK' : '❌ Needs Migration';
            // Pad book name for alignment
            const paddedBook = book.padEnd(12, ' ');

            console.log(`${paddedBook}\t${total}\t\t${missingId}\t\t${status}`);
        }
        console.log('------------------------------------------------------------');
        console.log('Done.');

    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await client.close();
    }
}

auditKitabIds();
