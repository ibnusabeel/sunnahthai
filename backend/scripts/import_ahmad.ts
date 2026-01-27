/**
 * Ahmad CSV Import Script
 * Deletes existing ahmad data and imports from ahmad.csv
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';
const CSV_PATH = path.resolve(__dirname, '../src/config/src_db/ahmad.csv');

interface AhmadRow {
    id: string;
    hId: string;
    ref: string;  // ahmad:1, ahmad:2, etc.
    h1_title: string;  // Kitab Arabic
    h1_title_en: string;  // Kitab English
    chain: string;  // Arabic narrators
    chain_en: string;  // English narrators
    body: string;  // Arabic content
    body_en: string;  // English content
    grade_grade: string;  // Grade Arabic
    grade_grade_en: string;  // Grade English
    grader_shortName: string;  // Grader Arabic
    grader_shortName_en: string;  // Grader English
    ordinal: string;  // hadith number
    numInChapter: string;
}

async function parseCSV(filePath: string): Promise<AhmadRow[]> {
    const rows: AhmadRow[] = [];

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let headers: string[] = [];
    let lineNum = 0;

    for await (const line of rl) {
        lineNum++;

        // Split by tab (TSV format)
        const values = line.split('\t');

        if (lineNum === 1) {
            headers = values;
            continue;
        }

        // Create object from headers and values
        const row: any = {};
        headers.forEach((header, i) => {
            row[header] = values[i] || '';
        });

        // Only process hadith doctype
        if (row.doctype === 'hadith') {
            rows.push(row as AhmadRow);
        }
    }

    return rows;
}

async function importAhmad() {
    console.log('🔄 Ahmad CSV Import Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if CSV exists
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV file not found: ${CSV_PATH}`);
        process.exit(1);
    }

    console.log(`📁 CSV Path: ${CSV_PATH}`);

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection('translations');

        // Step 1: Delete existing ahmad data
        console.log('\n🗑️  Deleting existing ahmad data...');
        const deleteResult = await collection.deleteMany({ hadith_book: 'ahmad' });
        console.log(`   Deleted ${deleteResult.deletedCount} documents`);

        // Step 2: Parse CSV
        console.log('\n📖 Parsing CSV file...');
        const rows = await parseCSV(CSV_PATH);
        console.log(`   Found ${rows.length} hadiths to import`);

        // Step 3: Transform and insert
        console.log('\n📥 Importing hadiths...');

        const documents = rows.map((row, index) => {
            // Extract hadith number from ref (ahmad:1 -> 1)
            const hadithNo = parseInt(row.ref.replace('ahmad:', '')) || index + 1;

            return {
                hadith_id: row.ref,
                hadith_book: 'ahmad',
                hadith_no: hadithNo,
                kitab: {
                    id: parseInt(row.hId) || 0,
                    ar: row.h1_title || '',
                    th: ''  // To be translated
                },
                bab: {
                    ar: '',
                    th: ''
                },
                chain: {
                    ar: row.chain || '',
                    th: ''  // To be translated
                },
                content: {
                    ar: row.body || '',
                    th: ''  // To be translated  
                },
                grade: {
                    ar: row.grade_grade || '',
                    th: ''
                },
                grader: {
                    shortName: {
                        ar: row.grader_shortName || ''
                    }
                },
                hadith_status: row.grade_grade || '',
                status: 'pending',
                last_updated: new Date()
            };
        });

        // Insert in batches
        const BATCH_SIZE = 1000;
        let inserted = 0;

        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batch = documents.slice(i, i + BATCH_SIZE);
            await collection.insertMany(batch);
            inserted += batch.length;
            console.log(`   Progress: ${inserted}/${documents.length} (${Math.round(inserted / documents.length * 100)}%)`);
        }

        console.log(`\n✅ Import Complete!`);
        console.log(`   Total imported: ${documents.length} hadiths`);

        // Verify count
        const count = await collection.countDocuments({ hadith_book: 'ahmad' });
        console.log(`   Verified count in DB: ${count}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run import
importAhmad();
