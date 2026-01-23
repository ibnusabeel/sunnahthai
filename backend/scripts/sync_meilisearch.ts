import { getCollection } from '../src/config/db.js';
import { meiliClient, INDEX_NAME } from '../src/config/meili.js';

async function syncMeilisearch() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        const collection = await getCollection('translations');
        const count = await collection.countDocuments();
        console.log(`📊 Found ${count} hadiths in MongoDB.`);

        console.log('🔄 Fetching all hadiths...');
        const cursor = collection.find({});
        const batchSize = 1000;
        let batch = [];
        let processed = 0;

        // Configure Meilisearch Index
        console.log('⚙️ Configuring Meilisearch Index...');
        const index = meiliClient.index(INDEX_NAME);

        await index.updateSettings({
            searchableAttributes: [
                'hadith_no',
                'content.th',
                'content.ar',
                'book_name.th',
                'book_name.ar',
                'kitab.th',
                'kitab.ar'
            ],
            filterableAttributes: [
                'hadith_book',
                'hadith_status',
                'book_name.th'
            ],
            sortableAttributes: [
                'hadith_no'
            ],
            typoTolerance: {
                enabled: true,
                minWordSizeForTypos: {
                    oneTypo: 4,
                    twoTypos: 8
                }
            }
        });

        console.log('🚀 Starting indexing...');

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!doc) continue;

            const { _id, ...rest } = doc;

            // Transform for Meilisearch
            const record = {
                id: _id.toString(), // Meilisearch ID must be string
                ...rest,
                // Flatten some fields if needed for easier filtering
            };

            batch.push(record);

            if (batch.length >= batchSize) {
                await index.addDocuments(batch);
                processed += batch.length;
                console.log(`✅ Indexed ${processed} / ${count} documents`);
                batch = [];
            }
        }

        if (batch.length > 0) {
            await index.addDocuments(batch);
            processed += batch.length;
            console.log(`✅ Indexed ${processed} / ${count} documents`);
        }

        console.log('🎉 Sync complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

syncMeilisearch();
