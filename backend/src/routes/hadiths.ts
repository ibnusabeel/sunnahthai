import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getCollection } from '../config/db.js';

const HadithsQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(15),
    search: z.string().optional().default(''),
    book: z.string().optional(),
    status: z.string().optional(),
    kitab: z.string().optional()
});

const HadithParamsSchema = z.object({
    id: z.string(),
    book: z.string().optional()
});

type HadithsQuery = z.infer<typeof HadithsQuerySchema>;

const hadithsRoutes: FastifyPluginAsync = async (f) => {
    const fastify = f.withTypeProvider<ZodTypeProvider>();

    // GET /api/hadiths - List all hadiths
    fastify.get('/hadiths', {
        schema: {
            querystring: HadithsQuerySchema
        }
    }, async (request, reply) => {
        return handleHadithsList(request, reply, null);
    });

    // GET /api/hadiths/:book - List hadiths for specific book
    fastify.get('/hadiths/:book', {
        schema: {
            params: z.object({ book: z.string() }),
            querystring: HadithsQuerySchema
        }
    }, async (request, reply) => {
        const { book } = request.params;
        return handleHadithsList(request, reply, book);
    });

    // GET /api/hadith/:id - Get single hadith
    fastify.get('/hadith/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (request, reply) => {
        const { id } = request.params;

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
        // Request query is already validated and transformed by Zod
        const query = request.query as HadithsQuery;

        // Cache Key Generation
        const { CacheService } = await import('../services/cache.js');
        const cacheKey = CacheService.generateKey('hadiths', { ...query, book });

        // Check Cache
        const cachedData = CacheService.get(cacheKey);
        if (cachedData) {
            reply.header('X-Cache', 'HIT');
            return cachedData;
        }

        const { page, limit, search, status, kitab } = query;

        // Calculate skip
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

            const responseData = {
                book,
                data: formattedData,
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit)
            };

            // Cache the result for 1 minute
            CacheService.set(cacheKey, responseData, 60 * 1000);
            reply.header('X-Cache', 'MISS');

            return responseData;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    }
};

export default hadithsRoutes;
