import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';
import { ObjectId } from 'mongodb';

const articlesRoutes: FastifyPluginAsync = async (fastify) => {

    // GET /api/articles
    // Query params: page, limit, status, category (slug), search
    fastify.get('/articles', async (request, reply) => {
        try {
            const collection = await getCollection('articles');
            const { page = 1, limit = 10, status, category, search } = request.query as any;

            const query: any = {};
            if (status) query.status = status;
            if (category) query.category = category; // assuming category slug is stored, or we store ID
            // Actually, we should store simple slugs or plain strings for category to make it easier for now.

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { content: { $regex: search, $options: 'i' } }
                ];
            }

            const p = parseInt(page);
            const l = parseInt(limit);
            const skip = (p - 1) * l;

            const total = await collection.countDocuments(query);
            const articles = await collection
                .find(query)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(l)
                .toArray();

            return {
                data: articles,
                total,
                page: p,
                limit: l,
                total_pages: Math.ceil(total / l)
            };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // GET /api/articles/:id (or slug)
    // We can support both ID and Slug
    fastify.get('/articles/:id', async (request, reply) => {
        try {
            const collection = await getCollection('articles');
            const { id } = request.params as { id: string };

            let query;
            if (ObjectId.isValid(id)) {
                query = { _id: new ObjectId(id) };
            } else {
                query = { slug: id };
            }

            const article = await collection.findOne(query);
            if (!article) return reply.status(404).send({ error: 'Article not found' });

            return article;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // POST /api/articles
    fastify.post('/articles', async (request, reply) => {
        try {
            const collection = await getCollection('articles');
            const data = request.body as any;

            console.log("Creating article payload:", data); // Debug Log

            if (!data.title || !data.slug) {
                console.log("Validation failed: Title or Slug missing");
                return reply.status(400).send({ error: 'Title and Slug are required' });
            }

            // Check duplicate slug
            const existing = await collection.findOne({ slug: data.slug });
            if (existing) {
                console.log("Validation failed: Duplicate slug", data.slug);
                return reply.status(400).send({ error: 'Slug already exists' });
            }

            const newArticle = {
                title: data.title,
                slug: data.slug,
                category: data.category || 'uncategorized',
                content: data.content || '',
                cover_image: data.cover_image || '',
                status: data.status || 'draft',
                author: data.author || 'Admin',
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await collection.insertOne(newArticle);
            console.log("Article created:", result.insertedId);
            return { ...newArticle, _id: result.insertedId };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/articles/:id
    fastify.put('/articles/:id', async (request, reply) => {
        try {
            const collection = await getCollection('articles');
            const { id } = request.params as { id: string };
            const data = request.body as any;

            if (!ObjectId.isValid(id)) {
                return reply.status(400).send({ error: 'Invalid ID' });
            }

            const updateData: any = {
                updated_at: new Date()
            };
            if (data.title) updateData.title = data.title;
            if (data.slug) updateData.slug = data.slug; // Should check uniqueness if changed
            if (data.category) updateData.category = data.category;
            if (data.content) updateData.content = data.content;
            if (data.cover_image !== undefined) updateData.cover_image = data.cover_image;
            if (data.status) updateData.status = data.status;

            const result = await collection.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            if (!result) return reply.status(404).send({ error: 'Article not found' });
            return result;

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // DELETE /api/articles/:id
    fastify.delete('/articles/:id', async (request, reply) => {
        try {
            const collection = await getCollection('articles');
            const { id } = request.params as { id: string };

            if (!ObjectId.isValid(id)) {
                return reply.status(400).send({ error: 'Invalid ID' });
            }

            const result = await collection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0) return reply.status(404).send({ error: 'Article not found' });

            return { success: true };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default articlesRoutes;
