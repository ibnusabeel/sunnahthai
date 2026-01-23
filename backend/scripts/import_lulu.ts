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
const CSV_PATH = path.resolve(__dirname, '../src/config/src_db/lulu-marjan.csv');

interface LuluRow {
    id: string;
    hId: string;
    ref: string;
    book_id: string;
    book_alias: string;
    book_shortName_en: string;
    book_shortName: string;
    book_name_en: string;
    book_name: string;
    book_author: string;
    h1_title_en: string;
    h1_title: string;
    h2_title_en: string;
    h2_title: string;
    num: string;
    grade_grade_en: string;
    grade_grade: string;
    grader_shortName_en: string;
    grader_shortName: string;
    grader_name_en: string;
    grader_name: string;
    grade_grades: string;
    title_en: string;
    title: string;
    chain_en: string;
    chain: string;
    body_en: string;
    body: string;
    footnote_en: string;
    footnote: string;
}

async function importLulu() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    console.log('Reading CSV file...');
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t', // The file is actually TSV
        relax_quotes: true,
        relax_column_count: true
    }) as LuluRow[];

    console.log(`Found ${records.length} records. Processing...`);

    const bulkOps = [];
    // Filter for lu'lu-marjan rows
    const validRecords = records.filter(r => r.body && r.book_alias === 'lulu-marjan');

    for (const row of validRecords) {
        // Construct the Hadith object matching existing schema
        // Only Thai and Arabic - no English (except as fallback/metadata not shown in main UI)
        const hadith = {
            hadith_id: `lulu:${row.num}`, // Unique ID for Lu'lu
            hadith_no: parseInt(row.num) || row.num,
            hadith_book: 'lulu', // Short code for Lu'lu Wal-Marjan
            book_name: {
                th: 'อัล-ลุ\'ลุ\' วัล-มัรญาน',
                ar: 'اللؤلؤ والمرجان',
                en: 'Al-Lu\'lu\' wal-Marjan'
            },
            book_author: {
                ar: 'محمد فؤاد عبد الباقي' // Muhammad Fu'ad Abd al-Baqi
            },
            kitab: {
                id: row.h1_title_en,
                th: null, // Will need mapping later if Thai kitabs exist
                ar: row.h1_title || null,
                en: row.h1_title_en || null
            },
            bab: {
                th: null,
                ar: row.h2_title || null,
                en: row.h2_title_en || null
            },
            title: {
                th: null,
                ar: row.title || null
            },
            chain: {
                th: null,
                ar: row.chain || null
            },
            content: {
                th: null, // No Thai translation yet
                ar: row.body,
                en: row.body_en // Keeping English for reference/fallback
            },
            footnote: {
                th: null,
                ar: row.footnote || null
            },
            grade: {
                th: null,
                ar: row.grade_grade || null,
                en: row.grade_grade_en || null
            },
            grader: {
                shortName: {
                    ar: row.grader_shortName || null,
                    en: row.grader_shortName_en || null
                },
                fullName: {
                    ar: row.grader_name || null,
                    en: row.grader_name_en || null
                }
            },
            grade_grades: row.grade_grades || null,
            status: 'pending' // Still need translation
        };

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

importLulu().catch(console.error);
