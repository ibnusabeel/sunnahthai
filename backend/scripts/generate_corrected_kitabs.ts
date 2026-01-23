
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

// User provided data (hardcoded here to ensure we have the source of truth for Thai/Order)
const USER_DATA = [
    { id: '1', ar: 'كتاب الْوَالِدَيْنِ', th: 'หมวดว่าด้วยบิดามารดา (พ่อแม่)' },
    { id: '2', ar: 'كتاب صِلَةِ الرَّحِمِ', th: 'หมวดว่าด้วยการเชื่อมสัมพันธ์เครือญาติ' },
    { id: '3', ar: 'كتاب مَوَالِي', th: 'หมวดว่าด้วยเมาลา (ทาสที่ได้รับการปลดปล่อย/พันธมิตร)' },
    { id: '4', ar: 'كتاب عول البنات', th: 'หมวดว่าด้วยการเลี้ยงดูบุตรสาว' },
    { id: '5', ar: 'كتاب رعاية الأولاد', th: 'หมวดว่าด้วยการดูแลเลี้ยงดูบุตร' },
    { id: '6', ar: 'كتاب الْجَارِ', th: 'หมวดว่าด้วยเพื่อนบ้าน' },
    { id: '7', ar: 'كتاب الْكَرَمِ وَ يَتِيمٌ', th: 'หมวดว่าด้วยความเอื้อเฟื้อเผื่อแผ่และเด็กกำพร้า' },
    { id: '8', ar: 'كتاب موت الأولاد', th: 'หมวดว่าด้วยการเสียชีวิตของบุตร' },
    { id: '9', ar: 'كتاب الملكة', th: 'หมวดว่าด้วยการเป็นเจ้านาย (ผู้ปกครองดูแล)' },
    { id: '10', ar: 'كتاب الرعاية', th: 'หมวดว่าด้วยการดูแลรับผิดชอบ' },
    { id: '11', ar: 'كتاب الْمَعْرُوفِ', th: 'หมวดว่าด้วยการทำความดี (มารยาทที่ดี)' },
    { id: '12', ar: 'كتاب الِانْبِسَاطِ إِلَى النَّاسِ', th: 'หมวดว่าด้วยความยิ้มแย้มแจ่มใสต่อผู้คน' },
    { id: '13', ar: 'كتاب الْمَشُورَةِ', th: 'หมวดว่าด้วยการปรึกษาหารือ' },
    { id: '14', ar: 'كتاب حسن الخلق', th: 'หมวดว่าด้วยการมีมารยาทที่งดงาม' },
    { id: '15', ar: 'كتاب اللعن', th: 'หมวดว่าด้วยการสาปแช่ง' },
    { id: '16', ar: 'كتاب المدح', th: 'หมวดว่าด้วยการชมเชย / การสรรเสริญ' },
    { id: '17', ar: 'كتاب الزِّيَارَةِ', th: 'หมวดว่าด้วยการเยี่ยมเยียน' },
    { id: '18', ar: 'كتاب الأكَابِرِ', th: 'หมวดว่าด้วยผู้อาวุโส' },
    { id: '19', ar: 'كتاب الصَّغِيرِ', th: 'หมวดว่าด้วยเด็กเล็ก' },
    { id: '20', ar: 'كتاب رَحْمَةِ', th: 'หมวดว่าด้วยความเมตตา' },
    { id: '21', ar: 'كتاب ذات البين', th: 'หมวดว่าด้วยความสัมพันธ์ระหว่างกัน' },
    { id: '22', ar: 'كتاب الهجر', th: 'หมวดว่าด้วยการหลีกห่าง (การไม่พูดคุยด้วย)' },
    { id: '23', ar: 'كتاب الإشارة', th: 'หมวดว่าด้วยการชี้แนะ / การให้คำแนะนำ' },
    { id: '24', ar: 'كتاب السِّبَابِ', th: 'หมวดว่าด้วยการด่าทอ / การดูถูก' },
    { id: '25', ar: 'كتاب السَّرَفِ فِي الْبِنَاءِ', th: 'หมวดว่าด้วยความฟุ่มเฟือยในการก่อสร้าง' },
    { id: '26', ar: 'كتاب الرِّفْقِ', th: 'หมวดว่าด้วยความอ่อนโยน' },
    { id: '27', ar: 'كتاب الاعتناء بالدنيا', th: 'หมวดว่าด้วยการเอาใจใส่ต่อโลกดุนยา (ทางโลก)' },
    { id: '28', ar: 'كتاب الظُّلْم', th: 'หมวดว่าด้วยความอธรรม (การกดขี่)' },
    { id: '29', ar: 'كتاب عيادة المرضى', th: 'หมวดว่าด้วยการเยี่ยมผู้ป่วย' },
    { id: '30', ar: 'كتاب التصرف العام', th: 'หมวดว่าด้วยความประพฤติทั่วไป' },
    { id: '31', ar: 'كتاب الدعاء', th: 'หมวดว่าด้วยการขอดุอาอ์ (การขอพร)' },
    { id: '32', ar: 'كتاب الضيف والنفقة', th: 'หมวดว่าด้วยแขกผู้มาเยือนและการใช้จ่าย' },
    { id: '33', ar: 'كتاب الأقوال', th: 'หมวดว่าด้วยถ้อยคำ / คำพูด' },
    { id: '34', ar: 'كتاب الأسْمَاءِ', th: 'หมวดว่าด้วยการตั้งชื่อ' },
    { id: '35', ar: 'كتاب الكُنْيَةِ', th: 'หมวดว่าด้วยกุนยะฮ์ (ฉายานามแบบอาหรับ เช่น อะบู...)' },
    { id: '36', ar: 'كتاب الشِّعْرِ', th: 'หมวดว่าด้วยบทกวี' },
    { id: '37', ar: 'كتاب الْكَلامِ', th: 'หมวดว่าด้วยถ้อยวาจา / การพูดจา' },
    { id: '38', ar: 'كتاب عاقبة الأمور', th: 'หมวดว่าด้วยบั้นปลายของกิจการงาน' },
    { id: '39', ar: 'كتاب الطيرة', th: 'หมวดว่าด้วยลางบอกเหตุ (โชคลาง)' },
    { id: '40', ar: 'كتاب الْعُطَاسَ والتثاؤب', th: 'หมวดว่าด้วยการจามและการหาว' },
    { id: '41', ar: 'كتاب الحركات', th: 'หมวดว่าด้วยอากัปกิริยา / ท่าทาง' },
    { id: '42', ar: 'كتاب السَّلامِ', th: 'หมวดว่าด้วยการทักทาย (การให้สลาม)' },
    { id: '43', ar: 'كتاب الاسْتِئْذَانُ', th: 'หมวดว่าด้วยการขออนุญาต (เข้าบ้าน)' },
    { id: '44', ar: 'كتاب أَهْلِ الْكِتَابِ', th: 'หมวดว่าด้วยชาวคัมภีร์ (ยิวและคริสต์)' },
    { id: '45', ar: 'كتاب الرَّسَائِلِ', th: 'หมวดว่าด้วยจดหมาย / สาร' },
    { id: '46', ar: 'كتاب الْمَجَالِسِ', th: 'หมวดว่าด้วยที่ประชุม / วงสนทนา' },
    { id: '47', ar: 'كتاب تعامل الناس', th: 'หมวดว่าด้วยการปฏิบัติตัวต่อผู้คน' },
    { id: '48', ar: 'باب الجلوس والاستلقاء', th: 'หมวดว่าด้วยการนั่งและการนอน' },
    { id: '49', ar: 'كتاب الصباح والمساء', th: 'หมวดว่าด้วยยามเช้าและยามเย็น' },
    { id: '50', ar: 'كتاب النوم والمبيت', th: 'หมวดว่าด้วยการนอนหลับและการพักแรม' },
    { id: '51', ar: 'كتاب الْبَهَائِمِ', th: 'หมวดว่าด้วยสัตว์เดรัจฉาน' },
    { id: '52', ar: 'كتاب الْقَائِلَةِ', th: 'หมวดว่าด้วยการงีบหลับกลางวัน' },
    { id: '53', ar: 'كتاب الْخِتَانِ', th: 'หมวดว่าด้วยการขลิบหนังหุ้มปลาย' },
    { id: '54', ar: 'كتاب القمار ونحوه', th: 'หมวดว่าด้วยการพนันและการละเล่นทำนองเดียวกัน' },
    { id: '55', ar: 'كتاب المعرفة', th: 'หมวดว่าด้วยการรับรู้ / ความตระหนัก' },
    { id: '56', ar: 'كتاب الفضول والجفاء', th: 'หมวดว่าด้วยการก้าวก่ายและความหยาบกระด้าง' },
    { id: '57', ar: 'كتاب الْغَضَبِ', th: 'หมวดว่าด้วยความโกรธ' }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hadith_db';

async function generateCorrectedFile() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('translations');

    // Get DB values
    const dbKitabs = await collection.distinct('kitab.ar', { hadith_book: 'adab' });

    // Normalize both sides
    const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();

    // Map normalized DB string to REAL DB string
    const dbMap = new Map();
    dbKitabs.forEach(k => {
        dbMap.set(normalize(k), k);
    });

    const correctedData = [];

    for (const item of USER_DATA) {
        const normItem = normalize(item.ar);

        let dbMatch = dbMap.get(normItem);

        // If no direct normalized match, try a more aggressive match (remove spaces, etc)
        if (!dbMatch) {
            // Look for match treating 'Alif' variations as same, 'Ha/Ta' variations
            // For now, let's see what happens with just removing diacritics.
            // Try partial match or levenshtein if needed, but manual check showed they are close.

            // Fallback: Check if any DB item *contains* the same words?
            // This script is to Generate the file, so we can manual review or just trust if high confidence.
        }

        if (dbMatch) {
            correctedData.push({
                id: item.id,
                ar: dbMatch, // USE DB VALUE
                th: item.th
            });
        } else {
            console.warn(`!! NO MATCH FOUND IN DB FOR: ${item.ar} (Norm: ${normItem})`);
            // Keep original, but it won't work for update.
            correctedData.push(item);
        }
    }

    // Generate file content
    const fileContent = `
const KITAB_UPDATES = ${JSON.stringify(correctedData, null, 2)};

export default KITAB_UPDATES;
`;

    fs.writeFileSync(path.resolve(__dirname, 'data/adab_kitabs_corrected.ts'), fileContent);
    console.log('Generated data/adab_kitabs_corrected.ts');

    await client.close();
}

generateCorrectedFile().catch(console.error);
