
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const LOCAL_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const LOCAL_DB_NAME = process.env.DB_NAME || 'hadith_db';

// Expecting production URI from command line argument or ENV
// Defaulting to the tunnel address if not provided, for convenience?
// But safer to force explicit uri.
const PROD_URI = process.env.MONGO_PROD_URI || 'mongodb://localhost:27018';
const PROD_DB_NAME = process.env.PROD_DB_NAME || LOCAL_DB_NAME;

const COLLECTIONS_TO_SYNC = ['translations', 'kitabs', 'book_info'];

async function askConfirmation(query: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function replaceProductionDB() {
    console.log(`
🚨🚨🚨 DANGER: REPLACE PRODUCTION DATABASE 🚨🚨🚨
-------------------------------------------------
Source (Local):      ${LOCAL_URI}  [${LOCAL_DB_NAME}]
Target (Production): ${PROD_URI}   [${PROD_DB_NAME}]
Collections:         ${COLLECTIONS_TO_SYNC.join(', ')}

This will DELETE ALL DATA in the production database for the specified collections
and replace it with data from your local database.

Are you absolutely sure you want to proceed?
    `);

    const confirmed = await askConfirmation('Type "yes" to confirm: ');
    if (!confirmed) {
        console.log('❌ Operation cancelled.');
        process.exit(0);
    }

    console.log('\n🚀 Starting full database replacement...');

    const localClient = new MongoClient(LOCAL_URI);
    const prodClient = new MongoClient(PROD_URI);

    try {
        await localClient.connect();
        await prodClient.connect();
        console.log('✅ Connected to both databases');

        const localDb = localClient.db(LOCAL_DB_NAME);
        const prodDb = prodClient.db(PROD_DB_NAME);

        for (const colName of COLLECTIONS_TO_SYNC) {
            console.log(`\n📦 Processing collection: ${colName}`);

            const localCollection = localDb.collection(colName);
            const prodCollection = prodDb.collection(colName);

            // 1. Fetch all local data
            const count = await localCollection.countDocuments();
            console.log(`   📖 Reading ${count} documents from local...`);
            const cursor = localCollection.find({});
            const documents = await cursor.toArray();

            if (documents.length === 0) {
                console.log('   ⚠️ Local collection is empty. Skipping.');
                continue;
            }

            // 2. Drop production collection
            try {
                await prodCollection.drop();
                console.log('   🗑️  Dropped production collection.');
            } catch (e: any) {
                if (e.codeName === 'NamespaceNotFound') {
                    console.log('   ℹ️  Production collection does not exist yet.');
                } else {
                    console.error('   ❌ Error dropping collection:', e);
                    throw e;
                }
            }

            // 3. Bulk Insert
            // Split into batches to avoid memory issues or doc size limits
            const BATCH_SIZE = 500;
            let insertedCount = 0;

            for (let i = 0; i < documents.length; i += BATCH_SIZE) {
                const batch = documents.slice(i, i + BATCH_SIZE);
                await prodCollection.insertMany(batch);
                insertedCount += batch.length;
                process.stdout.write(`   Uploading: ${insertedCount}/${count}\r`);
            }
            console.log(`\n   ✅ Successfully replaced ${insertedCount} documents.`);

            // 4. Indexes (Optional but good)
            // It would be nice to copy indexes too
            const indexes = await localCollection.indexes();
            if (indexes.length > 0) {
                // Filter out _id index as it's created automatically
                const indexSpecs = indexes
                    .filter(idx => idx.name !== '_id_')
                    .map(idx => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { v, ns, ...spec } = idx; // Remove version and namespace
                        return spec;
                    });

                if (indexSpecs.length > 0) {
                    try {
                        await prodCollection.createIndexes(indexSpecs as any);
                        console.log(`   📇 Re-created ${indexSpecs.length} indexes.`);
                    } catch (err) {
                        console.error('   ⚠️ Failed to recreate indexes:', err);
                    }
                }
            }
        }

        console.log('\n✨ Database replacement completed successfully!');

    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
    } finally {
        await localClient.close();
        await prodClient.close();
        console.log('🔌 Disconnected.');
    }
}

replaceProductionDB().catch(console.error);
