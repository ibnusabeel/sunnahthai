import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adminRoutes: FastifyPluginAsync = async (fastify) => {

    // GET /api/debug - Check DB status
    fastify.get('/debug', async (request, reply) => {
        try {
            const translations = await getCollection('translations');
            const kitabs = await getCollection('kitabs');
            const tCount = await translations.countDocuments();
            const kCount = await kitabs.countDocuments();

            return {
                status: 'ok',
                db_name: process.env.DB_NAME || 'default (hadith_db)',
                counts: {
                    translations: tCount,
                    kitabs: kCount
                },
                env: {
                    MONGO_URI: process.env.MONGO_URI ? 'Set' : 'Not Set'
                }
            };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    });

    // GET /admin - Main Admin Dashboard (serve the complete HTML)
    fastify.get('/admin', async (request, reply) => {
        // Serve complete admin dashboard HTML
        reply.type('text/html').send(getAdminDashboardHtml());
    });

    // GET /admin/kitabs - Redirect to main admin (kitabs is now a section)
    fastify.get('/admin/kitabs', async (request, reply) => {
        reply.redirect('/admin#kitabs');
    });

    // POST /api/kitabs - Create new kitab
    fastify.post('/kitabs', async (request, reply) => {
        const kitab = request.body as any;

        if (!kitab.kitab_id || !kitab.book) {
            return reply.status(400).send({ detail: 'kitab_id and book are required' });
        }

        try {
            const collection = await getCollection('kitabs');

            const existing = await collection.findOne({ kitab_id: kitab.kitab_id });
            if (existing) {
                return reply.status(400).send({ detail: 'Kitab already exists' });
            }

            const newKitab = {
                ...kitab,
                created_at: new Date(),
                updated_at: new Date()
            };

            await collection.insertOne(newKitab);
            const { _id, ...rest } = newKitab;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/kitab/:id - Update kitab
    fastify.put('/kitab/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const updates = request.body as any;

        try {
            const kitabsCollection = await getCollection('kitabs');
            const translationsCollection = await getCollection('translations');

            const oldKitab = await kitabsCollection.findOne({ kitab_id: id });
            if (!oldKitab) {
                return reply.status(404).send({ detail: 'Kitab not found' });
            }

            await kitabsCollection.updateOne(
                { kitab_id: id },
                { $set: { ...updates, updated_at: new Date() } }
            );

            // Propagate name changes to translations
            if (updates.name) {
                const newName = updates.name;
                const oldName = oldKitab.name || {};
                const book = oldKitab.book;

                // Build update for new names
                const translationUpdates: any = {};
                if (newName.th) translationUpdates['kitab.th'] = newName.th;
                if (newName.ar) translationUpdates['kitab.ar'] = newName.ar;
                if (newName.en) translationUpdates['kitab.en'] = newName.en;

                if (Object.keys(translationUpdates).length > 0) {
                    // Try matching by order/id first
                    const orderId = oldKitab.order;
                    if (orderId !== undefined) {
                        const result1 = await translationsCollection.updateMany(
                            { hadith_book: book, 'kitab.id': orderId },
                            { $set: translationUpdates }
                        );

                        const result2 = await translationsCollection.updateMany(
                            { hadith_book: book, 'kitab.id': String(orderId) },
                            { $set: translationUpdates }
                        );

                        // If no matches by id, try matching by old name
                        if (result1.modifiedCount === 0 && result2.modifiedCount === 0) {
                            const nameConditions: any[] = [];
                            if (oldName.th) nameConditions.push({ 'kitab.th': oldName.th });
                            if (oldName.ar) nameConditions.push({ 'kitab.ar': oldName.ar });

                            if (nameConditions.length > 0) {
                                await translationsCollection.updateMany(
                                    { hadith_book: book, $or: nameConditions },
                                    { $set: translationUpdates }
                                );
                            }
                        }
                    } else {
                        // No order id, match by old name
                        const nameConditions: any[] = [];
                        if (oldName.th) nameConditions.push({ 'kitab.th': oldName.th });
                        if (oldName.ar) nameConditions.push({ 'kitab.ar': oldName.ar });

                        if (nameConditions.length > 0) {
                            await translationsCollection.updateMany(
                                { hadith_book: book, $or: nameConditions },
                                { $set: translationUpdates }
                            );
                        }
                    }
                }
            }

            const updated = await kitabsCollection.findOne({ kitab_id: id });
            const { _id, ...rest } = updated!;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // DELETE /api/kitab/:id - Delete kitab
    fastify.delete('/kitab/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const collection = await getCollection('kitabs');
            const result = await collection.deleteOne({ kitab_id: id });

            if (result.deletedCount === 0) {
                return reply.status(404).send({ detail: 'Kitab not found' });
            }

            return { message: 'Kitab deleted successfully' };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/hadith/:id - Update hadith (for admin editing)
    fastify.put('/hadith/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const updates = request.body as any;

        try {
            const collection = await getCollection('translations');

            const hadith = await collection.findOne({ hadith_id: id });
            if (!hadith) {
                return reply.status(404).send({ detail: 'Hadith not found' });
            }

            const updateData: any = { updated_at: new Date() };

            if (updates.content) {
                if (updates.content.ar !== undefined) updateData['content.ar'] = updates.content.ar;
                if (updates.content.th !== undefined) updateData['content.th'] = updates.content.th;
            }
            if (updates.status) updateData.status = updates.status;
            if (updates.kitab) {
                if (updates.kitab.th !== undefined) updateData['kitab.th'] = updates.kitab.th;
                if (updates.kitab.ar !== undefined) updateData['kitab.ar'] = updates.kitab.ar;
            }

            await collection.updateOne({ hadith_id: id }, { $set: updateData });

            const updated = await collection.findOne({ hadith_id: id });
            const { _id, ...rest } = updated!;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/book-info/:book - Update book info
    fastify.put('/book-info/:book', async (request, reply) => {
        const { book } = request.params as { book: string };
        const updates = request.body as any;

        try {
            const collection = await getCollection('book_info');

            await collection.updateOne(
                { book },
                {
                    $set: {
                        ...updates,
                        book,
                        updated_at: new Date()
                    },
                    $setOnInsert: { created_at: new Date() }
                },
                { upsert: true }
            );

            const updated = await collection.findOne({ book });
            if (!updated) {
                return { book, description: updates.description || '' };
            }
            const { _id, ...rest } = updated;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

function getAdminDashboardHtml(): string {
    // Try multiple possible paths to find the admin.html template
    const possiblePaths = [
        path.join(process.cwd(), '..', 'templates', 'admin.html'),  // backend/../templates
        path.join(process.cwd(), 'templates', 'admin.html'),        // templates/ in cwd
        path.resolve(__dirname, '../../../../templates/admin.html'), // relative from dist
        path.resolve(__dirname, '../../../templates/admin.html'),    // another relative try
    ];

    for (const templatePath of possiblePaths) {
        try {
            if (fs.existsSync(templatePath)) {
                console.log(`[Admin] Loading template from: ${templatePath}`);
                return fs.readFileSync(templatePath, 'utf-8');
            }
        } catch (error) {
            // Continue to next path
        }
    }

    console.error('[Admin] Template not found. Tried paths:', possiblePaths);

    // Fallback: return a basic HTML with an embedded admin dashboard
    return `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-purple-50 to-pink-50 min-h-screen flex items-center justify-center">
    <div class="text-center p-8">
        <h1 class="text-3xl font-bold text-purple-800 mb-4">🎛️ Admin Dashboard</h1>
        <p class="text-gray-600 mb-6">ไม่พบไฟล์ templates/admin.html</p>
        <p class="text-sm text-gray-400 mb-4">กรุณาตรวจสอบว่าไฟล์ templates/admin.html มีอยู่ในโปรเจค</p>
        <p class="text-xs text-gray-400 mb-6">Tried: ${possiblePaths.join(', ')}</p>
        <a href="http://localhost:4321/admin" class="mt-4 inline-block px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
            ไปหน้า Admin เดิม (Astro)
        </a>
    </div>
</body>
</html>`;
}

export default adminRoutes;
