import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';

const kitabsRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/kitabs/:book - List kitabs for a book
    fastify.get('/kitabs/:book', async (request, reply) => {
        const { book } = request.params as { book: string };

        try {
            const kitabsCollection = await getCollection('kitabs');
            const translationsCollection = await getCollection('translations');

            // Try new kitabs collection first
            const kitabs = await kitabsCollection
                .find({ book })
                .sort({ order: 1 })
                .toArray();

            if (kitabs.length > 0) {
                return {
                    book,
                    kitabs: kitabs.map((k: any) => ({
                        kitab_id: k.kitab_id,
                        ar: k.name?.ar || '',
                        th: k.name?.th || '',
                        en: k.name?.en || '',
                        id: k.order,
                        hadith_count: k.hadith_count || 0,
                        min_hadith: k.min_hadith || null,
                        max_hadith: k.max_hadith || null
                    }))
                };
            }

            // Fallback: aggregate from translations
            const pipeline = [
                { $match: { hadith_book: book } },
                {
                    $addFields: {
                        hadith_no_int: {
                            $convert: {
                                input: '$hadith_no',
                                to: 'int',
                                onError: 9999999,
                                onNull: 9999999
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: { ar: '$kitab.ar', th: '$kitab.th' },
                        en: { $first: '$kitab.en' },
                        id: { $min: '$kitab.id' },
                        min_hadith: { $min: '$hadith_no_int' }
                    }
                },
                { $sort: { id: 1, min_hadith: 1, '_id.th': 1 } },
                {
                    $addFields: {
                        id_int: {
                            $convert: {
                                input: '$id',
                                to: 'int',
                                onError: 9999,
                                onNull: 9999
                            }
                        }
                    }
                },
                { $sort: { id_int: 1, min_hadith: 1, '_id.th': 1 } }
            ];

            const result = await translationsCollection.aggregate(pipeline).toArray();
            const kitabsList: any[] = [];
            const seen = new Set<string>();

            for (const doc of result) {
                const ar = doc._id.ar || '';
                const th = doc._id.th || '';
                const en = doc.en || '';
                const id = doc.id;

                const key = th || en || ar;
                if (key && !seen.has(key)) {
                    seen.add(key);
                    kitabsList.push({ ar, th, en, id });
                }
            }

            return { book, kitabs: kitabsList };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/kitab/:id - Get single kitab
    fastify.get('/kitab/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const collection = await getCollection('kitabs');
            const kitab = await collection.findOne({ kitab_id: id });

            if (!kitab) {
                return reply.status(404).send({ detail: 'Kitab not found' });
            }

            const { _id, ...rest } = kitab;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // POST /api/kitabs/sync/:book - Sync kitab names
    fastify.post('/kitabs/sync/:book', async (request, reply) => {
        const { book } = request.params as { book: string };

        try {
            const kitabsCollection = await getCollection('kitabs');
            const translationsCollection = await getCollection('translations');

            const kitabs = await kitabsCollection.find({ book }).toArray();

            if (kitabs.length === 0) {
                return reply.status(404).send({ detail: 'No kitabs found for this book' });
            }

            let updatedCount = 0;

            for (const k of kitabs) {
                const orderId = k.order;
                const name = k.name || {};

                if (orderId === undefined || orderId === null) continue;

                const updates: any = {};
                if (name.th) updates['kitab.th'] = name.th;
                if (name.ar) updates['kitab.ar'] = name.ar;
                if (name.en) updates['kitab.en'] = name.en;

                if (Object.keys(updates).length === 0) continue;

                // Update by integer ID
                const res1 = await translationsCollection.updateMany(
                    { hadith_book: book, 'kitab.id': orderId },
                    { $set: updates }
                );
                updatedCount += res1.modifiedCount;

                // Update by string ID
                const res2 = await translationsCollection.updateMany(
                    { hadith_book: book, 'kitab.id': String(orderId) },
                    { $set: updates }
                );
                updatedCount += res2.modifiedCount;
            }

            return { message: `Synced ${updatedCount} hadiths for book ${book}` };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/book-info/:book - Get book metadata
    fastify.get('/book-info/:book', async (request, reply) => {
        const { book } = request.params as { book: string };

        try {
            const collection = await getCollection('book_info');
            const info = await collection.findOne({ book });

            if (!info) {
                return { book, description: '' };
            }

            const { _id, ...rest } = info;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default kitabsRoutes;
