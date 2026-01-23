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

        // Calculate skip early, before any try/catch blocks
        const skip = (page - 1) * limit;

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
                try {
                    // Try Meilisearch first
                    const { meiliClient, INDEX_NAME } = await import('../config/meili.js');
                    const index = meiliClient.index(INDEX_NAME);

                    // Build Meili filters
                    const filters = [];
                    if (targetBook) filters.push(`hadith_book = "${targetBook}"`);
                    if (status) filters.push(`status = "${status}"`);
                    // Kitab filter in Meili might need exact match or simplified

                    const searchParams: any = {
                        limit: limit,
                        offset: skip,
                        filter: filters.length > 0 ? filters.join(' AND ') : undefined,
                        attributesToHighlight: ['content.th', 'content.ar']
                    };

                    const searchResults = await index.search(search, searchParams);

                    // If we got results, return them
                    if (searchResults) {
                        const totalHits = searchResults.estimatedTotalHits || 0;
                        return {
                            book,
                            data: searchResults.hits,
                            page,
                            limit,
                            total: totalHits,
                            total_pages: Math.ceil(totalHits / limit),
                            provider: 'meilisearch'
                        };
                    }
                } catch (meiliError) {
                    // console.warn('Meilisearch failed, falling back to MongoDB:', meiliError);
                    // Fallback to MongoDB Regex below
                }

                // MongoDB Regex Fallback
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

            const [data, total] = await Promise.all([
                collection.find(mongoQuery)
                    .sort({ hadith_no: 1, id: 1 })
                    .collation({ locale: "en", numericOrdering: true })
                    .skip(skip)
                    .limit(limit)
                    .toArray(),
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
