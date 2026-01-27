/**
 * Sync Translations to Production
 * Exports translated hadiths from local DB and syncs to production
 * Only updates content.th, chain.th, bab.th, and status fields
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const LOCAL_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const LOCAL_DB = process.env.DB_NAME || 'hadith_db';

// Production URI - set this in .env
const PROD_URI = process.env.MONGO_PROD_URI || '';
const PROD_DB = process.env.PROD_DB_NAME || LOCAL_DB;

interface TranslatedHadith {
    hadith_id: string;
    hadith_book: string;
    content?: { th?: string };
    chain?: { th?: string };
    bab?: { th?: string };
    kitab?: { th?: string };
    status: string;
    last_updated: Date;
}

async function exportTranslations(books: string[] = ['lulu', 'adab']): Promise<TranslatedHadith[]> {
    console.log('📤 Exporting translations from local database...');

    const client = new MongoClient(LOCAL_URI);

    try {
        await client.connect();
        const db = client.db(LOCAL_DB);
        const collection = db.collection('translations');

        // Find all translated hadiths for specified books
        const query = {
            hadith_book: { $in: books },
            status: 'translated',
            'content.th': { $exists: true, $ne: '', $ne: null }
        };

        const hadiths = await collection.find(query, {
            projection: {
                hadith_id: 1,
                hadith_book: 1,
                'content.th': 1,
                'chain.th': 1,
                'bab.th': 1,
                'kitab.th': 1,
                status: 1,
                last_updated: 1
            }
        }).toArray();

        console.log(`   Found ${hadiths.length} translated hadiths`);
        return hadiths as unknown as TranslatedHadith[];

    } finally {
        await client.close();
    }
}

async function syncToProduction(translations: TranslatedHadith[], prodUri: string) {
    console.log('\n📥 Syncing to production database...');
    console.log(`   Total documents to sync: ${translations.length}`);

    const client = new MongoClient(prodUri);

    try {
        await client.connect();
        console.log('   ✅ Connected to production');

        const db = client.db(PROD_DB);
        const collection = db.collection('translations');

        let updated = 0;
        let failed = 0;

        // Update in batches
        const BATCH_SIZE = 100;

        for (let i = 0; i < translations.length; i += BATCH_SIZE) {
            const batch = translations.slice(i, i + BATCH_SIZE);

            const bulkOps = batch.map(t => ({
                updateOne: {
                    filter: { hadith_id: t.hadith_id },
                    update: {
                        $set: {
                            'content.th': t.content?.th || '',
                            'chain.th': t.chain?.th || '',
                            'bab.th': t.bab?.th || '',
                            'kitab.th': t.kitab?.th || '',
                            'status': 'translated',
                            'last_updated': new Date()
                        }
                    }
                }
            }));

            try {
                const result = await collection.bulkWrite(bulkOps);
                updated += result.modifiedCount;
                console.log(`   Progress: ${Math.min(i + BATCH_SIZE, translations.length)}/${translations.length} (${result.modifiedCount} updated)`);
            } catch (err: any) {
                failed += batch.length;
                console.error(`   ❌ Batch error: ${err.message}`);
            }
        }

        console.log(`\n📊 Sync Complete:`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ❌ Failed: ${failed}`);

    } finally {
        await client.close();
        console.log('   🔌 Disconnected from production');
    }
}

async function exportToFile(translations: TranslatedHadith[], filename: string) {
    console.log(`\n💾 Saving to file: ${filename}`);
    fs.writeFileSync(filename, JSON.stringify(translations, null, 2));
    console.log(`   ✅ Saved ${translations.length} translations`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log(`
📦 Database Sync Tool
━━━━━━━━━━━━━━━━━━━━━

Usage:
  npx tsx scripts/sync_to_production.ts export [books]     # Export to JSON file
  npx tsx scripts/sync_to_production.ts sync [prod_uri]    # Sync to production
  npx tsx scripts/sync_to_production.ts count              # Count translated

Examples:
  npx tsx scripts/sync_to_production.ts export lulu,adab
  npx tsx scripts/sync_to_production.ts sync mongodb://user:pass@vps-ip:27017
`);

    if (command === 'export') {
        const books = args[1] ? args[1].split(',') : ['lulu', 'adab'];
        const translations = await exportTranslations(books);
        await exportToFile(translations, 'translations_export.json');

    } else if (command === 'sync') {
        const prodUri = args[1] || PROD_URI;

        if (!prodUri) {
            console.error('❌ Production URI required!');
            console.log('   Set MONGO_PROD_URI in .env or pass as argument');
            process.exit(1);
        }

        const translations = await exportTranslations();
        await syncToProduction(translations, prodUri);

    } else if (command === 'count') {
        const client = new MongoClient(LOCAL_URI);
        await client.connect();
        const db = client.db(LOCAL_DB);
        const collection = db.collection('translations');

        for (const book of ['lulu', 'adab', 'ahmad']) {
            const total = await collection.countDocuments({ hadith_book: book });
            const translated = await collection.countDocuments({
                hadith_book: book,
                status: 'translated',
                'content.th': { $exists: true, $ne: '', $ne: null }
            });
            console.log(`📚 ${book}: ${translated}/${total} translated (${Math.round(translated / total * 100)}%)`);
        }

        await client.close();
    }
}

main().catch(console.error);
