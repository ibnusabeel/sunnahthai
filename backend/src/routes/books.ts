import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';

// Hardcoded fallback book names
const BOOK_NAMES: Record<string, { th: string; ar: string; icon: string }> = {
    bukhari: { th: 'ซอเฮียะฮ์บุคอรี', ar: 'صحيح البخاري', icon: '📚' },
    muslim: { th: 'ซอเฮียะฮ์มุสลิม', ar: 'صحيح مسلم', icon: '📖' },
    nasai: { th: 'สุนันนะซาอี', ar: 'سنن النسائي', icon: '📕' },
    tirmidhi: { th: 'สุนันติรมิซี', ar: 'جامع الترمذي', icon: '📗' },
    abudawud: { th: 'สุนันอะบูดาวูด', ar: 'سنن أبي داود', icon: '📘' },
    ibnmajah: { th: 'สุนันอิบนุมาญะฮ์', ar: 'سنن ابن ماجه', icon: '📙' },
    malik: { th: 'มุวัตตอ อิหม่ามมาลิก', ar: 'موطأ الإمام مالك', icon: '📜' },
    darimi: { th: 'สุนันดาริมี', ar: 'سنن الدارمي', icon: '📚' },
    ahmad: { th: 'มุสนัด อะห์มัด', ar: 'مسند أحمد', icon: '📗' },
    adab: { th: 'อัล-อะดับ อัล-มุฟร็อด', ar: 'الأدب المفرد', icon: '📓' },
    lulu: { th: 'อัล-ลุ\'ลุ\' วัล-มัรญาน', ar: 'اللؤلؤ والمرجان', icon: '💎' },
    riyad: { th: 'ริยาดุสซอลิฮีน', ar: 'رياض الصالحين', icon: '🌿' },
};

const booksRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/books - List all books with stats AND dynamic names
    fastify.get('/books', async (request, reply) => {
        try {
            const translationsCollection = await getCollection('translations');
            const bookInfoCollection = await getCollection('book_info');

            // Fetch stats aggregation
            const pipeline = [
                {
                    $group: {
                        _id: '$hadith_book',
                        total: { $sum: 1 },
                        translated: { $sum: { $cond: [{ $eq: ['$status', 'translated'] }, 1, 0] } }
                    }
                },
                { $sort: { total: -1 } }
            ];

            // Fetch in parallel for speed
            const [statsResult, bookInfoResult] = await Promise.all([
                translationsCollection.aggregate(pipeline).toArray(),
                bookInfoCollection.find({}).toArray()
            ]);

            // Build book info map from DB
            const bookInfoMap: Record<string, any> = {};
            for (const info of bookInfoResult) {
                bookInfoMap[info.book] = {
                    th: info.th,
                    ar: info.ar,
                    icon: info.icon,
                    description: info.description,
                    color: info.color
                };
            }

            // Build final books array
            const books = [];

            for (const doc of statsResult) {
                if (doc._id) {
                    let total = doc.total;
                    const translated = doc.translated;

                    // Override for Ahmad
                    if (doc._id === 'ahmad') {
                        total = 26363;
                    }

                    // Get names: DB override > Hardcoded fallback > default
                    const dbInfo = bookInfoMap[doc._id] || {};
                    const fallback = BOOK_NAMES[doc._id] || { th: doc._id, ar: '', icon: '📖' };

                    books.push({
                        book: doc._id,
                        th: dbInfo.th || fallback.th,
                        ar: dbInfo.ar || fallback.ar,
                        icon: dbInfo.icon || fallback.icon,
                        description: dbInfo.description || '',
                        color: dbInfo.color || 'blue',
                        total,
                        translated,
                        pending: total - translated,
                        percentage: total > 0 ? Math.round((translated / total) * 100) : 0
                    });
                }
            }

            return { books };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default booksRoutes;

