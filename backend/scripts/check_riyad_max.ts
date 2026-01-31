
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = path.resolve(__dirname, '../src/config/src_db/riyad.csv');

function checkMaxNum() {
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t',
        relax_quotes: true
    });

    const validRecords = records.filter((r: any) => r.book_alias === 'riyad');
    const nums = validRecords.map((r: any) => parseInt(r.num)).filter((n: number) => !isNaN(n));

    console.log(`Min Num: ${Math.min(...nums)}`);
    console.log(`Max Num: ${Math.max(...nums)}`);
}

checkMaxNum();
