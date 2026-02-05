import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

// API URLs
const QURAN_API = 'https://api.quran.com/api/v4';
const ALQURAN_CLOUD_API = 'https://api.alquran.cloud/v1';

// Thai translation ID from Quran.com
const THAI_TRANSLATION_ID = 230;

interface Surah {
    id: number;
    name_arabic: string;
    name_simple: string;
    name_complex: string;
    verses_count: number;
    revelation_place: string;
}

interface QuranAyah {
    surah_no: number;
    ayah_no: number;
    verse_key: string;
    text_uthmani: string;
    translation_th: string;
    tafsir_ar: string;
    tafsir_th?: string | null;
    status: 'pending' | 'translated';
}

// Rate limiter helper
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retry ${i + 1}/${retries} for ${url}`);
            await sleep(1000 * (i + 1));
        }
    }
}

async function fetchSurahs(): Promise<Surah[]> {
    console.log('📚 Fetching surah list from Quran.com API...');
    const data = await fetchWithRetry(`${QURAN_API}/chapters`);

    return data.chapters.map((ch: any) => ({
        id: ch.id,
        name_arabic: ch.name_arabic,
        name_simple: ch.name_simple,
        name_complex: ch.name_complex,
        verses_count: ch.verses_count,
        revelation_place: ch.revelation_place
    }));
}

async function fetchArabicText(surahId: number): Promise<Map<number, string>> {
    const data = await fetchWithRetry(`${QURAN_API}/quran/verses/uthmani?chapter_number=${surahId}`);
    const map = new Map<number, string>();

    for (const verse of data.verses) {
        const ayahNo = parseInt(verse.verse_key.split(':')[1]);
        map.set(ayahNo, verse.text_uthmani);
    }

    return map;
}

async function fetchThaiTranslation(surahId: number): Promise<Map<number, string>> {
    const data = await fetchWithRetry(`${QURAN_API}/quran/translations/${THAI_TRANSLATION_ID}?chapter_number=${surahId}`);
    const map = new Map<number, string>();

    for (let i = 0; i < data.translations.length; i++) {
        // Remove [n] number prefix from translation
        let text = data.translations[i].text;
        text = text.replace(/^\[\d+\]\s*/, '');
        map.set(i + 1, text);
    }

    return map;
}

async function fetchTafsirJalalayn(surahId: number): Promise<Map<number, string>> {
    const data = await fetchWithRetry(`${ALQURAN_CLOUD_API}/surah/${surahId}/ar.jalalayn`);
    const map = new Map<number, string>();

    if (data.data && data.data.ayahs) {
        for (const ayah of data.data.ayahs) {
            map.set(ayah.numberInSurah, ayah.text);
        }
    }

    return map;
}

async function importQuran() {
    console.log('🔌 Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    // Create collections
    const surahsCollection = db.collection('quran_surahs');
    const ayahsCollection = db.collection('quran_ayahs');

    try {
        // Step 1: Fetch and save surahs
        const surahs = await fetchSurahs();
        console.log(`✅ Found ${surahs.length} surahs`);

        // Save surahs to collection
        for (const surah of surahs) {
            await surahsCollection.updateOne(
                { id: surah.id },
                { $set: surah },
                { upsert: true }
            );
        }
        console.log('✅ Saved surahs to database');

        // Step 2: Process each surah
        let totalAyahs = 0;

        for (const surah of surahs) {
            console.log(`\n📖 Processing Surah ${surah.id}: ${surah.name_simple} (${surah.verses_count} ayahs)`);

            // Fetch all data in parallel
            const [arabicText, thaiTranslation, tafsir] = await Promise.all([
                fetchArabicText(surah.id),
                fetchThaiTranslation(surah.id),
                fetchTafsirJalalayn(surah.id)
            ]);

            // Process each ayah
            const bulkOps = [];

            for (let ayahNo = 1; ayahNo <= surah.verses_count; ayahNo++) {
                const verseKey = `${surah.id}:${ayahNo}`;

                const ayah: QuranAyah = {
                    surah_no: surah.id,
                    ayah_no: ayahNo,
                    verse_key: verseKey,
                    text_uthmani: arabicText.get(ayahNo) || '',
                    translation_th: thaiTranslation.get(ayahNo) || '',
                    tafsir_ar: tafsir.get(ayahNo) || '',
                    tafsir_th: null,
                    status: 'pending'
                };

                bulkOps.push({
                    updateOne: {
                        filter: { verse_key: verseKey },
                        update: { $set: ayah },
                        upsert: true
                    }
                });
            }

            if (bulkOps.length > 0) {
                await ayahsCollection.bulkWrite(bulkOps);
                totalAyahs += bulkOps.length;
            }

            console.log(`   ✓ Saved ${bulkOps.length} ayahs`);

            // Rate limiting: 200ms between surahs
            await sleep(200);
        }

        // Create indexes
        console.log('\n📊 Creating indexes...');
        await ayahsCollection.createIndex({ verse_key: 1 }, { unique: true });
        await ayahsCollection.createIndex({ surah_no: 1 });
        await ayahsCollection.createIndex({ status: 1 });
        await surahsCollection.createIndex({ id: 1 }, { unique: true });

        console.log('\n🎉 Import completed successfully!');
        console.log(`📚 Total surahs: ${surahs.length}`);
        console.log(`📜 Total ayahs: ${totalAyahs}`);

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Run import
importQuran().catch(console.error);
