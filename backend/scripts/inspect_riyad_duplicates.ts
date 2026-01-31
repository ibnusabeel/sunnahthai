
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = path.resolve(__dirname, '../src/config/src_db/riyad.csv');

function inspectDuplicates() {
    console.log('🔍 Inspecting Riyad Duplicates...');

    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t',
        relax_quotes: true
    });

    const validRecords = records.filter((r: any) => r.book_alias === 'riyad');

    // Group by num
    const grouped: Record<string, any[]> = {};
    for (const r of validRecords) {
        if (!grouped[r.num]) grouped[r.num] = [];
        grouped[r.num].push(r);
    }

    // Find duplicates and show diff
    let count = 0;
    for (const num in grouped) {
        if (grouped[num].length > 1) {
            console.log(`\nDuplicate Num: ${num} (Count: ${grouped[num].length})`);
            grouped[num].forEach((r, i) => {
                console.log(`   [${i}] ID: ${r.id}, H1: ${r.h1}, H2: ${r.h2} BodyStart: ${r.body.substring(0, 30)}...`);
            });
            count++;
            if (count >= 5) break;
        }
    }
}

inspectDuplicates();
