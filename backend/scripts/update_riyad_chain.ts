import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';
const CSV_PATH = path.resolve(__dirname, '../src/config/src_db/riyad.csv');

interface RiyadRow {
    id: string;
    num: string;
    book_alias: string;
    chain: string;        // Arabic chain
    chain_en: string;     // English chain
    body: string;
    h1: string;           // Kitab ID
    h1_title: string;     // Kitab Arabic
    h1_title_en: string;  // Kitab English
}

async function updateRiyadChain() {
    console.log('🔗 Updating Riyad hadiths with chain data...');
    console.log('Connecting to MongoDB...');

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    console.log('Reading CSV file from:', CSV_PATH);
    if (!fs.existsSync(CSV_PATH)) {
        console.error('File not found:', CSV_PATH);
        process.exit(1);
    }
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t',
        relax_quotes: true,
        relax_column_count: true
    }) as RiyadRow[];

    console.log(`Found ${records.length} records. Processing...`);

    const validRecords = records.filter(r => r.body && r.book_alias === 'riyad');
    console.log(`Valid riyad records: ${validRecords.length}`);

    const bulkOps = [];
    let updatedCount = 0;
    let chainCount = 0;
    let chainEnCount = 0;

    for (const row of validRecords) {
        const hadithId = `riyad:${row.num}`;

        // Build update object - only update fields that have data
        const updateFields: any = {};

        // Add chain (Arabic) only - user requested no chain_en
        if (row.chain && row.chain.trim() && row.chain !== 'null') {
            updateFields['chain.ar'] = row.chain.trim();
            chainCount++;
        }

        // Only update if there's at least one field
        if (Object.keys(updateFields).length > 0) {
            updateFields.updated_at = new Date();

            bulkOps.push({
                updateOne: {
                    filter: { hadith_id: hadithId },
                    update: { $set: updateFields }
                }
            });
            updatedCount++;
        }

        // Execute in batches of 500
        if (bulkOps.length >= 500) {
            const result = await collection.bulkWrite(bulkOps);
            console.log(`Batch executed: ${result.modifiedCount} modified`);
            bulkOps.length = 0;
        }
    }

    // Execute remaining
    if (bulkOps.length > 0) {
        const result = await collection.bulkWrite(bulkOps);
        console.log(`Final batch: ${result.modifiedCount} modified`);
    }

    console.log('\n✅ Update completed!');
    console.log(`Total records with chain.ar: ${chainCount}`);
    console.log(`Total records with chain.en: ${chainEnCount}`);
    console.log(`Total update operations: ${updatedCount}`);

    await client.close();
}

updateRiyadChain().catch(console.error);
