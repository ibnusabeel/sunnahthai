
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import KITAB_UPDATES from './data/adab_kitabs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function verifyMatches() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    // get all distinct from DB
    const dbKitabs = await collection.distinct('kitab.ar', { hadith_book: 'adab' });

    console.log(`DB has ${dbKitabs.length} distinct kitabs.`);
    console.log(`Ref List has ${KITAB_UPDATES.length} updates.`);

    const missingInDB = [];
    const unmatchedDb = new Set(dbKitabs);

    let matchCount = 0;

    for (const update of KITAB_UPDATES) {
        if (dbKitabs.includes(update.ar)) {
            matchCount++;
            unmatchedDb.delete(update.ar);
        } else {
            missingInDB.push(update.ar);
        }
    }

    console.log(`\nExact Matches: ${matchCount}`);
    console.log(`\nFailed to match (in List but not found in DB exact string): ${missingInDB.length}`);

    missingInDB.forEach(k => {
        console.log(` - List: '${k}'`);
        // Try to find closest in unmatchedDb
        // simple heuristic: remove diacritics
        const normK = k.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

        let potentialMatch = null;
        for (const dbK of unmatchedDb) {
            const normDbK = dbK.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
            if (normDbK === normK) {
                potentialMatch = dbK;
                break;
            }
        }

        if (potentialMatch) {
            console.log(`   + DB Has: '${potentialMatch}' (Normalized match!)`);
        } else {
            console.log(`   ! No normalized match found in DB.`);
        }
    });

    await client.close();
}

verifyMatches().catch(console.error);
