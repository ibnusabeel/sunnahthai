import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';
import { ObjectId } from 'mongodb';

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {

    // GET /api/categories
    fastify.get('/categories', async (request, reply) => {
        try {
            const collection = await getCollection('categories');
            const categories = await collection.find({}).toArray();
            return { categories };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // POST /api/categories
    fastify.post('/categories', async (request, reply) => {
        try {
            const collection = await getCollection('categories');
            const data = request.body as any;

            if (!data.name || !data.slug) {
                return reply.status(400).send({ error: 'Name and Slug are required' });
            }

            // Check duplicate slug
            const existing = await collection.findOne({ slug: data.slug });
            if (existing) {
                return reply.status(400).send({ error: 'Slug already exists' });
            }

            const newCategory = {
                name: data.name,
                slug: data.slug,
                description: data.description || '',
                created_at: new Date()
            };

            const result = await collection.insertOne(newCategory);
            return { ...newCategory, _id: result.insertedId };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/categories/:id
    fastify.put('/categories/:id', async (request, reply) => {
        try {
            const collection = await getCollection('categories');
            const { id } = request.params as { id: string };
            const data = request.body as any;

            if (!ObjectId.isValid(id)) {
                return reply.status(400).send({ error: 'Invalid ID' });
            }

            const updateData: any = {
                updated_at: new Date()
            };
            if (data.name) updateData.name = data.name;
            if (data.slug) updateData.slug = data.slug;
            if (data.description !== undefined) updateData.description = data.description;

            const result = await collection.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            if (!result) return reply.status(404).send({ error: 'Category not found' });

            return result;

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // DELETE /api/categories/:id
    fastify.delete('/categories/:id', async (request, reply) => {
        try {
            const collection = await getCollection('categories');
            const { id } = request.params as { id: string };

            if (!ObjectId.isValid(id)) {
                return reply.status(400).send({ error: 'Invalid ID' });
            }

            const result = await collection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0) return reply.status(404).send({ error: 'Category not found' });

            return { success: true };

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default categoriesRoutes;
