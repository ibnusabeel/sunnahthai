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
    book_name: string;
    book_author: string;
    h1: string; // Chapter number
    h1_title: string; // Kitab
    h1_title_en: string;
    h2_title: string; // Bab
    h2_title_en: string;
    body: string; // Arabic content
    body_en: string; // English content
    grade_grade: string;
    grade_grade_en: string;
}

async function importRiyad() {
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

    const bulkOps = [];
    // Riyad alias in CSV is 'riyad'
    const validRecords = records.filter(r => r.body && r.book_alias === 'riyad');

    for (const row of validRecords) {
        // Construct the Hadith object
        const hadith = {
            hadith_id: `riyad:${row.num}`,
            hadith_no: parseInt(row.num) || row.num,
            hadith_book: 'riyad',
            book_name: {
                th: 'ริยาดุศศอลิฮีน', // Thai name for Riyad as-Salihin
                ar: row.book_name || 'رياض الصالحين'
            },
            book_author: {
                ar: row.book_author || 'Abū Zakariyyā Yaḥyá b. Sharaf al-Nawawī'
            },
            kitab: {
                id: parseInt(row.h1) || row.h1,
                th: null,
                ar: row.h1_title || null,
                en: row.h1_title_en || null
            },
            bab: {
                th: null,
                ar: row.h2_title || null,
                en: row.h2_title_en || null
            },
            content: {
                th: null, // No Thai translation yet
                ar: row.body,
                en: row.body_en || null
            },
            grade: {
                th: null,
                ar: row.grade_grade || null,
                en: row.grade_grade_en || null
            },
            // Map grades to standard status
            status: 'published', // Default to published or check grade?
            updated_at: new Date()
        };

        // Insert or Update
        bulkOps.push({
            updateOne: {
                filter: { hadith_id: hadith.hadith_id },
                update: { $set: hadith },
                upsert: true
            }
        });

        // Execute in batches of 500
        if (bulkOps.length >= 500) {
            await collection.bulkWrite(bulkOps);
            bulkOps.length = 0;
            process.stdout.write('.');
        }
    }

    if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
    }

    console.log('\nImport completed successfully!');
    console.log(`Total records imported: ${validRecords.length}`);
    await client.close();
}

importRiyad().catch(console.error);
