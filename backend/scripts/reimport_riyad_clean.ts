
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
    h1: string; // Kitab ID
    h1_title: string; // Kitab
    h1_title_en: string;
    h2_title: string; // Bab
    h2_title_en: string;
    body: string; // Arabic content
    body_en: string; // English content
    chain: string; // Arabic Chain
    grade_grade: string;
    grade_grade_en: string;
}

async function reimportRiyad() {
    console.log('🧹 Starting Clean Re-import of Riyad as-Salihin...');

    // 1. Connect and Wipe Old Data
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    console.log('🗑️  Deleting existing riyad hadiths...');
    const deleteResult = await collection.deleteMany({ hadith_book: 'riyad' });
    console.log(`   Deleted ${deleteResult.deletedCount} records.`);

    // 2. Process CSV
    console.log('📖 Reading CSV...');
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t',
        relax_quotes: true,
        relax_column_count: true
    }) as RiyadRow[];

    const validRecords = records.filter(r => r.book_alias === 'riyad' && r.body);
    console.log(`   Found ${validRecords.length} valid rows.`);

    // 3. Deduplicate Logic
    const toImport = [];
    const seenContent = new Set<string>(); // Use ID + H1 to detect exact duplicates

    for (const row of validRecords) {
        // Unique Key: ID + H1 (Chapter)
        // If exact same ID appears in exact same chapter -> Duplicate Data -> Skip
        // If same ID/Num appears in different chapter -> Cross-reference -> Keep (with unique hadith_id)

        // Note: CSV 'id' seems to be internal. 
        // We use composite key to detect DATA duplication
        const uniqueKey = `${row.num}-${row.h1}-${row.body.substring(0, 50)}`;

        if (seenContent.has(uniqueKey)) {
            continue; // Skip exact duplicate
        }
        seenContent.add(uniqueKey);

        // Generate unique hadith_id
        // Try 'riyad:<num>'. If taken, append suffix.
        let hadithId = `riyad:${row.num}`;
        let suffix = 2;
        while (toImport.some(h => h.hadith_id === hadithId)) {
            hadithId = `riyad:${row.num}-${suffix}`;
            suffix++;
        }

        const hadith = {
            hadith_id: hadithId,
            hadith_no: parseInt(row.num) || row.num, // Keep original number
            hadith_book: 'riyad',
            book_name: {
                th: 'ริยาดุศศอลิฮีน',
                ar: row.book_name || 'رياض الصالحين'
            },
            book_author: {
                ar: row.book_author || 'Abū Zakariyyā Yaḥyá b. Sharaf al-Nawawī'
            },
            kitab: {
                id: row.h1, // Use raw value if not int
                th: null,
                ar: row.h1_title || null
            },
            bab: {
                th: null,
                ar: row.h2_title || null
            },
            chain: {
                th: null,
                ar: row.chain || null
            },
            content: {
                th: null,
                ar: row.body
            },
            grade: {
                th: null,
                ar: row.grade_grade || null
            },
            status: 'published',
            updated_at: new Date()
        };

        toImport.push(hadith);
    }

    console.log(`✨ Prepare to import ${toImport.length} unique records (after deduplication).`);

    // 4. Batch Insert
    if (toImport.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < toImport.length; i += batchSize) {
            const batch = toImport.slice(i, i + batchSize);
            await collection.insertMany(batch);
            process.stdout.write('.');
        }
        console.log('\n✅ Import completed successfully!');
    } else {
        console.log('⚠️ No records to import.');
    }

    await client.close();
}

reimportRiyad().catch(console.error);
