
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';
const CSV_PATH = path.resolve(__dirname, '../src/config/src_db/riyad.csv');

async function checkRiyadStats() {
    console.log('🔍 Checking Riyad stats...');

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    // 1. Check DB Count
    const count = await collection.countDocuments({ hadith_book: 'riyad' });
    console.log(`\n📊 DB Status:`);
    console.log(`   Total Riyad Hadiths in DB: ${count}`);

    // Data sample
    const sample = await collection.findOne({ hadith_book: 'riyad' });
    console.log(`   Sample ID in DB: ${sample?.hadith_id} (No: ${sample?.hadith_no})`);

    // 2. Check CSV Count and Uniqueness
    console.log(`\n📄 CSV Status:`);
    if (fs.existsSync(CSV_PATH)) {
        const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            delimiter: '\t',
            relax_quotes: true
        });

        const validRecords = records.filter((r: any) => r.book_alias === 'riyad');
        console.log(`   Total Valid Records in CSV: ${validRecords.length}`);

        // Check for duplicate nums
        const nums = validRecords.map((r: any) => r.num);
        const uniqueNums = new Set(nums);
        console.log(`   Unique 'num' values: ${uniqueNums.size}`);

        if (uniqueNums.size !== validRecords.length) {
            console.log(`   ⚠️ WARNING: 'num' collision detected!`);
            console.log(`      Records: ${validRecords.length}`);
            console.log(`      Unique Nums: ${uniqueNums.size}`);
            console.log(`      Duplicates: ${validRecords.length - uniqueNums.size}`);

            // Find duplicates
            const seen = new Set();
            const duplicates = new Set();
            for (const n of nums) {
                if (seen.has(n)) duplicates.add(n);
                seen.add(n);
            }
            console.log(`      Duplicate examples: ${Array.from(duplicates).slice(0, 5).join(', ')}...`);
        } else {
            console.log(`   ✅ 'num' is unique for all records.`);
        }

    } else {
        console.log(`   ❌ CSV file not found at ${CSV_PATH}`);
    }

    await client.close();
}

checkRiyadStats().catch(console.error);
