
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function populateRiyadKitabs() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const kitabsCollection = db.collection('kitabs');
    const translationsCollection = db.collection('translations');

    console.log('Aggregating kitabs from translations...');

    // Find all distinct kitabs in riyad translations
    // We group by kitab.id to ensure uniqueness
    const pipeline = [
        { $match: { hadith_book: 'riyad' } },
        {
            $group: {
                _id: '$kitab.id',
                ar: { $first: '$kitab.ar' },
                en: { $first: '$kitab.en' },
                th: { $first: '$kitab.th' },
                min_hadith: { $min: '$hadith_no' },
                count: { $sum: 1 }
            }
        },
        { $sort: { min_hadith: 1 } as any } // Sort by min hadith no
    ];

    const results = await translationsCollection.aggregate(pipeline).toArray();

    console.log(`Found ${results.length} unique kitabs. Processing...`);

    let existingCount = 0;
    let newCount = 0;

    // Use loop index as the order to ensure it matches the min_hadith sort
    for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (!res._id) continue;

        const order = i + 1; // Assign sequential order based on min_hadith sort
        const oldId = parseInt(res._id) || res._id; // The original ID from CSV

        // Check if kitab exists in kitabs collection by original ID or new order?
        // Let's match by kitab_id if we had it, but we don't.
        // We match by book + name (ar) to be safe, OR we just update by book + order if we trust the reordering.
        // But reordering changes 'order'. 
        // Strategy: Delete all riyad kitabs first? Or update by name?
        // Let's update by matching the name.ar since that shouldn't change

        const existingKitab = await kitabsCollection.findOne({
            book: 'riyad',
            'name.ar': res.ar
        });

        if (existingKitab) {
            // Update existing
            await kitabsCollection.updateOne(
                { _id: existingKitab._id },
                {
                    $set: {
                        order: order, // Update the order to the sequential one
                        name: {
                            ar: res.ar,
                            en: res.en,
                            th: res.th
                        },
                        hadith_count: res.count,
                        updated_at: new Date()
                    }
                }
            );
            existingCount++;
            process.stdout.write('.');
        } else {
            // Create new
            await kitabsCollection.insertOne({
                kitab_id: crypto.randomUUID(),
                book: 'riyad',
                order: order, // Use sequential order
                name: {
                    ar: res.ar,
                    en: res.en,
                    th: res.th
                },
                hadith_count: res.count,
                created_at: new Date(),
                updated_at: new Date()
            });
            newCount++;
            process.stdout.write('+');
        }
    }

    console.log(`\nFinished! Updated: ${existingCount}, Created: ${newCount}`);
    await client.close();
}

populateRiyadKitabs().catch(console.error);
