import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ROOT_DIR = path.resolve(__dirname, '../../'); // Root of repo
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const OUTPUT_DIR = path.join(ROOT_DIR, 'deployment_package');
const DATA_DIR = path.join(OUTPUT_DIR, 'data');

async function preparePackage() {
    console.log('📦 Preparing Deployment Package (ESM)...');

    // 1. Clean/Create Output Directory
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUTPUT_DIR);
    fs.mkdirSync(DATA_DIR);
    console.log(`✅ Created ${OUTPUT_DIR}`);

    // 2. Export Database
    console.log('⏳ Exporting Database...');
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('hadith_db');

        const collections = ['kitabs', 'translations', 'book_info'];
        for (const colName of collections) {
            const data = await db.collection(colName).find({}).toArray();
            fs.writeFileSync(
                path.join(DATA_DIR, `${colName}.json`),
                JSON.stringify(data, null, 2)
            );
            console.log(`   - Exported ${colName} (${data.length} records)`);
        }
    } catch (e) {
        console.error('❌ Database export failed:', e);
    } finally {
        await client.close();
    }

    // 3. Copy Source Code
    console.log('⏳ Copying Source Code...');

    // Function to filter node_modules and other junk
    const filterFunc = (src, dest) => {
        const basename = path.basename(src);
        if (basename === 'node_modules' || basename === '.git' || basename === 'dist' || basename === '.astro' || basename === '__pycache__' || basename === '.venv' || basename === '.env') {
            return false;
        }
        return true;
    };

    // Copy Backend
    fs.cpSync(BACKEND_DIR, path.join(OUTPUT_DIR, 'backend'), { recursive: true, filter: filterFunc });
    console.log('   - Copied Backend');

    // Copy Frontend
    fs.cpSync(FRONTEND_DIR, path.join(OUTPUT_DIR, 'frontend'), { recursive: true, filter: filterFunc });
    console.log('   - Copied Frontend');

    // Copy Templates
    if (fs.existsSync(TEMPLATES_DIR)) {
        fs.cpSync(TEMPLATES_DIR, path.join(OUTPUT_DIR, 'templates'), { recursive: true });
        console.log('   - Copied Templates');
    }

    // Copy README/Deployment Guide
    const deployGuide = path.join(ROOT_DIR, 'DEPLOY_AAPANEL.md');
    if (fs.existsSync(deployGuide)) {
        fs.copyFileSync(deployGuide, path.join(OUTPUT_DIR, 'README_DEPLOY.md'));
    }

    // Create a Restore Script
    const restoreScript = `
console.log('To restore data, allow this script to run mongorestore or use the json files in /data');
console.log('Recommended: mongoimport --db hadith_db --collection kitabs --file data/kitabs.json --jsonArray');
    `;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'restore_instructions.txt'), restoreScript);

    console.log('✅ Package Created Successfully at ' + OUTPUT_DIR);
}

preparePackage();
