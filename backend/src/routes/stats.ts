import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';

const statsRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/stats - Overall stats
    fastify.get('/stats', async (request, reply) => {
        try {
            const collection = await getCollection('translations');

            const total = await collection.countDocuments({});
            const translated = await collection.countDocuments({ status: 'translated' });
            const pending = total - translated;
            const percentage = total > 0 ? Math.round((translated / total) * 100) : 0;

            return {
                book: null,
                overall: { total, translated, pending, percentage }
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/stats/:book - Stats for specific book
    fastify.get('/stats/:book', async (request, reply) => {
        const { book } = request.params as { book: string };

        try {
            const collection = await getCollection('translations');

            const total = await collection.countDocuments({ hadith_book: book });
            const translated = await collection.countDocuments({ hadith_book: book, status: 'translated' });
            const pending = total - translated;
            const percentage = total > 0 ? Math.round((translated / total) * 100) : 0;

            return {
                book,
                overall: { total, translated, pending, percentage }
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default statsRoutes;
