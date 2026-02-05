import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';

interface SurahParams {
    id: string;
}

interface SearchQuery {
    q?: string;
    page?: string;
    limit?: string;
}

const quranRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/quran/surahs - List all surahs
    fastify.get('/quran/surahs', async (request, reply) => {
        try {
            const collection = await getCollection('quran_surahs');
            const surahs = await collection.find({}).sort({ id: 1 }).toArray();

            return {
                surahs,
                total: surahs.length
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/quran/surah/:id - Get ayahs for a specific surah
    fastify.get('/quran/surah/:id', async (request, reply) => {
        const { id } = request.params as SurahParams;
        const surahNo = parseInt(id);

        if (isNaN(surahNo) || surahNo < 1 || surahNo > 114) {
            return reply.status(400).send({ error: 'Invalid surah number' });
        }

        try {
            // Get surah info
            const surahsCollection = await getCollection('quran_surahs');
            const surah = await surahsCollection.findOne({ id: surahNo });

            if (!surah) {
                return reply.status(404).send({ error: 'Surah not found' });
            }

            // Get ayahs
            const ayahsCollection = await getCollection('quran_ayahs');
            const ayahs = await ayahsCollection
                .find({ surah_no: surahNo })
                .sort({ ayah_no: 1 })
                .toArray();

            return {
                surah,
                ayahs,
                total: ayahs.length
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/quran/ayah/:verseKey - Get specific ayah
    fastify.get('/quran/ayah/:verseKey', async (request, reply) => {
        const { verseKey } = request.params as { verseKey: string };

        try {
            const collection = await getCollection('quran_ayahs');
            const ayah = await collection.findOne({ verse_key: verseKey });

            if (!ayah) {
                return reply.status(404).send({ error: 'Ayah not found' });
            }

            return { ayah };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/quran/ayah/:id - Update ayah (translation/tafsir)
    fastify.put('/quran/ayah/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as { translation_th?: string; tafsir_th?: string };

        try {
            const collection = await getCollection('quran_ayahs');
            const { ObjectId } = await import('mongodb');

            const updateData: any = { updated_at: new Date() };
            if (body.translation_th !== undefined) updateData.translation_th = body.translation_th;
            if (body.tafsir_th !== undefined) {
                updateData.tafsir_th = body.tafsir_th;
                updateData.status = 'translated'; // Mark as translated if tafsir provided
            }

            const result = await collection.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            if (!result) {
                return reply.status(404).send({ error: 'Ayah not found' });
            }

            return { success: true, ayah: result };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/quran/stats - Tafsir translation stats
    fastify.get('/quran/stats', async (request, reply) => {
        try {
            const ayahsCollection = await getCollection('quran_ayahs');
            const surahsCollection = await getCollection('quran_surahs');

            const totalAyahs = await ayahsCollection.countDocuments({});
            const translatedTafsir = await ayahsCollection.countDocuments({
                status: 'translated',
                tafsir_th: { $nin: [null, ''] }
            });
            const totalSurahs = await surahsCollection.countDocuments({});

            return {
                totalSurahs,
                totalAyahs,
                translatedTafsir,
                pendingTafsir: totalAyahs - translatedTafsir,
                percentage: totalAyahs > 0 ? Math.round((translatedTafsir / totalAyahs) * 100) : 0
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/quran/search - Search in Quran
    fastify.get('/quran/search', async (request, reply) => {
        const { q, page = '1', limit = '20' } = request.query as SearchQuery;

        if (!q || q.length < 2) {
            return reply.status(400).send({ error: 'Query must be at least 2 characters' });
        }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        try {
            const collection = await getCollection('quran_ayahs');

            const query = {
                $or: [
                    { text_uthmani: { $regex: q, $options: 'i' } },
                    { translation_th: { $regex: q, $options: 'i' } },
                    { tafsir_ar: { $regex: q, $options: 'i' } },
                    { tafsir_th: { $regex: q, $options: 'i' } }
                ]
            };

            const [ayahs, total] = await Promise.all([
                collection.find(query).skip(skip).limit(limitNum).toArray(),
                collection.countDocuments(query)
            ]);

            return {
                ayahs,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default quranRoutes;
