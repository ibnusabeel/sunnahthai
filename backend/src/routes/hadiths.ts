import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';

interface HadithsQuery {
    page?: string;
    limit?: string;
    search?: string;
    book?: string;
    status?: string;
    kitab?: string;
}

const hadithsRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/hadiths - List all hadiths
    fastify.get('/hadiths', async (request, reply) => {
        return handleHadithsList(request, reply, null);
    });

    // GET /api/hadiths/:book - List hadiths for specific book
    fastify.get('/hadiths/:book', async (request, reply) => {
        const { book } = request.params as { book: string };
        return handleHadithsList(request, reply, book);
    });

    // GET /api/hadith/:id - Get single hadith
    fastify.get('/hadith/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const collection = await getCollection('translations');
            const hadith = await collection.findOne({ hadith_id: id });

            if (!hadith) {
                return reply.status(404).send({ detail: 'Hadith not found' });
            }

            const { _id, ...rest } = hadith;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    async function handleHadithsList(request: any, reply: any, book: string | null) {
        const query = request.query as HadithsQuery;
        const page = parseInt(query.page || '1');
        const limit = Math.min(Math.max(parseInt(query.limit || '15'), 1), 100);
        const search = query.search || '';
        const status = query.status || '';
        const kitab = query.kitab || '';

        try {
            const collection = await getCollection('translations');
            const conditions: any[] = [];

            // Filter by book (from route param OR query param)
            const targetBook = book || query.book;
            if (targetBook) {
                conditions.push({ hadith_book: targetBook });
            }

            // Filter by status
            if (status) {
                conditions.push({ status });
            }

            // Filter by kitab
            if (kitab) {
                conditions.push({
                    $or: [
                        { 'kitab.ar': kitab },
                        { 'kitab.th': kitab },
                        { 'kitab.en': kitab }
                    ]
                });
            }

            // Search filter
            if (search) {
                const searchRegex = { $regex: search, $options: 'i' };
                conditions.push({
                    $or: [
                        { hadith_id: searchRegex },
                        { 'content.ar': searchRegex },
                        { 'content.th': searchRegex },
                        { 'kitab.ar': searchRegex },
                        { 'kitab.th': searchRegex }
                    ]
                });
            }

            // Build query
            const mongoQuery = conditions.length > 0
                ? (conditions.length > 1 ? { $and: conditions } : conditions[0])
                : {};

            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                collection.find(mongoQuery).sort({ id: 1 }).skip(skip).limit(limit).toArray(),
                collection.countDocuments(mongoQuery)
            ]);

            // Remove _id from results
            const formattedData = data.map((doc: any) => {
                const { _id, ...rest } = doc;
                return rest;
            });

            return {
                book,
                data: formattedData,
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit)
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    }
};

export default hadithsRoutes;
