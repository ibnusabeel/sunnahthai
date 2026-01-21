import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';

const booksRoutes: FastifyPluginAsync = async (fastify) => {
    // GET /api/books - List all books with stats
    fastify.get('/books', async (request, reply) => {
        try {
            const collection = await getCollection('translations');

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

            const result = await collection.aggregate(pipeline).toArray();
            const books = [];

            for (const doc of result) {
                if (doc._id) {
                    let total = doc.total;
                    const translated = doc.translated;

                    // Override for Ahmad
                    if (doc._id === 'ahmad') {
                        total = 26363;
                    }

                    books.push({
                        book: doc._id,
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
