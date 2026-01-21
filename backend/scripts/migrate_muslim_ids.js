import { MongoClient } from 'mongodb';

async function migrate() {
    console.log('Starting migration for Muslim kitab IDs...');
    const client = new MongoClient('mongodb://localhost:27017');

    try {
        await client.connect();
        const db = client.db('hadith_db');
        const translations = db.collection('translations');
        const kitabs = db.collection('kitabs');

        // 1. Get all Muslim kitabs
        const muslimKitabs = await kitabs.find({ book: 'muslim' }).toArray();
        console.log(`Found ${muslimKitabs.length} Muslim kitabs.`);

        let totalUpdated = 0;

        // 2. Iterate and update hadiths
        for (const k of muslimKitabs) {
            if (!k.name || !k.name.th) {
                console.warn(`Skipping kitab ${k.kitab_id} - missing TH name`);
                continue;
            }

            // Update hadiths that match this kitab name AND belong to 'muslim'
            const result = await translations.updateMany(
                {
                    hadith_book: 'muslim',
                    'kitab.th': k.name.th
                },
                {
                    $set: { 'kitab.id': k.order }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`Updated ${result.modifiedCount} hadiths for kitab '${k.name.th}' -> ID: ${k.order}`);
                totalUpdated += result.modifiedCount;
            } else {
                // Should we log zeroes? Maybe just for summary. 
                // console.log(`No hadiths updated for kitab '${k.name.th}'`);
            }
        }

        console.log(`\nMigration complete! Total hadiths updated: ${totalUpdated}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
    }
}

migrate();
