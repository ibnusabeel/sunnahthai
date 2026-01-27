import { FastifyPluginAsync } from 'fastify';
import { getCollection } from '../config/db.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adminRoutes: FastifyPluginAsync = async (fastify) => {

    // GET /api/book-names - Get all dynamic book names
    fastify.get('/book-names', async (request, reply) => {
        try {
            const collection = await getCollection('book_info');
            const allInfo = await collection.find({}).toArray();

            // Map to dictionary keyed by book slug
            const nameMap: Record<string, any> = {};
            for (const info of allInfo) {
                nameMap[info.book] = {
                    th: info.th,
                    ar: info.ar,
                    description: info.description
                };
            }
            return nameMap;
        } catch (error) {
            fastify.log.error(error);
            return {}; // Return empty object on error to fallback safely
        }
    });

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

    // --------------------------------------------------------------------------------
    // BOOKS MANAGEMENT
    // --------------------------------------------------------------------------------

    // GET /api/admin/books - Get all books (Info + Stats)
    fastify.get('/admin/books', async (request, reply) => {
        try {
            const bookInfoCollection = await getCollection('book_info');
            const translationsCollection = await getCollection('translations');

            // 0. Hardcoded Canonical Books (Source of Truth for defaults)
            const BOOK_NAMES: Record<string, { th: string; ar: string; icon: string }> = {
                bukhari: { th: 'ซอเฮียะฮ์บุคอรี', ar: 'صحيح البخاري', icon: '📚' },
                muslim: { th: 'ซอเฮียะฮ์มุสลิม', ar: 'صحيح مسلم', icon: '📖' },
                nasai: { th: 'สุนันนะซาอี', ar: 'سنن النسائي', icon: '📕' },
                tirmidhi: { th: 'สุนันติรมิซี', ar: 'جامع الترمذي', icon: '📗' },
                abudawud: { th: 'สุนันอะบูดาวูด', ar: 'سنن أبي داود', icon: '📘' },
                ibnmajah: { th: 'สุนันอิบนุมาญะฮ์', ar: 'سنن ابن ماجه', icon: '📙' },
                malik: { th: 'มุวัตตอ อิหม่ามมาลิก', ar: 'موطأ الإمام مالك', icon: '📜' },
                darimi: { th: 'สุนันดาริมี', ar: 'سنن الدارمي', icon: '📚' },
                ahmad: { th: 'มุสนัด อะห์มัด', ar: 'مسند أحمد', icon: '📗' },
                adab: { th: 'อัล-อะดับ อัล-มุฟร็อด', ar: 'الأدب المفرد', icon: '📓' },
                lulu: { th: 'อัล-ลุ\'ลุ\' วัล-มัรญาน', ar: 'اللؤلؤ والمرجان', icon: '💎' },
                riyad: { th: 'ริยาดุสซอลิฮีน', ar: 'رياض الصالحين', icon: '🌿' },
            };

            // 1. Get all book definitions from DB (Dynamic/Overrides)
            const booksInfo = await bookInfoCollection.find({}).toArray();
            const bookInfoMap: Record<string, any> = {};
            booksInfo.forEach((b: any) => bookInfoMap[b.book] = b);

            // 2. Get stats from translations
            const stats = await translationsCollection.aggregate([
                {
                    $group: {
                        _id: '$hadith_book',
                        total: { $sum: 1 },
                        translated: { $sum: { $cond: [{ $eq: ['$status', 'translated'] }, 1, 0] } }
                    }
                }
            ]).toArray();

            const statsMap: Record<string, any> = {};
            stats.forEach((s: any) => {
                statsMap[s._id] = s;
            });

            // 3. Merge EVERYTHING
            // Keys = Set(Canonical + info + stats)
            const allKeys = new Set([
                ...Object.keys(BOOK_NAMES),
                ...booksInfo.map((b: any) => b.book),
                ...stats.map((s: any) => s._id)
            ]);

            const result = Array.from(allKeys).map(key => {
                const canonical = BOOK_NAMES[key] || {};
                const info = bookInfoMap[key] || {};
                const s = statsMap[key] || { total: 0, translated: 0 };

                return {
                    book: key,
                    th: info.th || canonical.th || key,
                    ar: info.ar || canonical.ar || '',
                    description: info.description || '',
                    icon: info.icon || canonical.icon || '📖',
                    color: info.color || 'blue',
                    total: s.total,
                    translated: s.translated,
                    pending: s.total - s.translated,
                    percentage: s.total > 0 ? Math.round((s.translated / s.total) * 100) : 0,
                    created_at: info.created_at || null,
                    updated_at: info.updated_at || null
                };
            });

            // Sort by order in BOOK_NAMES, then by created_at for dynamic ones
            const canonicalOrder = Object.keys(BOOK_NAMES);
            result.sort((a, b) => {
                const idxA = canonicalOrder.indexOf(a.book);
                const idxB = canonicalOrder.indexOf(b.book);

                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;

                return (b.created_at || 0) - (a.created_at || 0);
            });

            return { data: result };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // POST /api/admin/books - Create a new book
    fastify.post('/admin/books', async (request, reply) => {
        const body = request.body as any;
        if (!body.book || !body.th) {
            return reply.status(400).send({ detail: 'Book slug (book) and Thai name (th) are required' });
        }

        try {
            const collection = await getCollection('book_info');
            const existing = await collection.findOne({ book: body.book });
            if (existing) {
                return reply.status(400).send({ detail: 'Book ID already exists' });
            }

            const newBook = {
                book: body.book,
                th: body.th,
                ar: body.ar || '',
                description: body.description || '',
                icon: body.icon || '📖',
                color: body.color || 'blue',
                created_at: new Date(),
                updated_at: new Date()
            };

            await collection.insertOne(newBook);
            return { message: 'Book created successfully', data: newBook };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // PUT /api/admin/books/:book - Update book
    fastify.put('/admin/books/:book', async (request, reply) => {
        const { book } = request.params as { book: string };
        const updates = request.body as any;

        try {
            const collection = await getCollection('book_info');
            await collection.updateOne(
                { book },
                {
                    $set: {
                        ...updates,
                        updated_at: new Date()
                    }
                }
            );
            return { message: 'Book updated successfully' };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // DELETE /api/admin/books/:book - Delete book (DANGER)
    fastify.delete('/admin/books/:book', async (request, reply) => {
        const { book } = request.params as { book: string };

        try {
            const bookInfo = await getCollection('book_info');
            // Check if exists
            const existing = await bookInfo.findOne({ book });
            if (!existing) return reply.status(404).send({ detail: 'Book not found' });

            // Delete info
            await bookInfo.deleteOne({ book });

            // Optional: Delete content? 
            // For safety, maybe we require a query param ?confirm=true to delete hadiths?
            // User request: "สามารถเพิ่ม ลบ แก้ไขได้" -> implied full delete.
            // Let's delete info first. If they want to delete data that might be a separate action or we blindly do it.
            // Let's keeping it safe: ONLY delete metadata for now. 
            // If we delete hadiths, that's destructive.

            return { message: 'Book metadata deleted. Hadiths are preserved but hidden.' };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // --------------------------------------------------------------------------------
    // KITABS MANAGEMENT (Keep existing mixed with new standard if needed)
    // --------------------------------------------------------------------------------

    // GET /admin/kitabs (Redirect removed, handled by frontend router now)

    // ... existing kitabs POST/PUT/DELETE maps well ...

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
                if (updates.kitab.id !== undefined) updateData['kitab.id'] = updates.kitab.id; // Allow updating kitab ID
                if (updates.kitab.th !== undefined) updateData['kitab.th'] = updates.kitab.th;
                if (updates.kitab.ar !== undefined) updateData['kitab.ar'] = updates.kitab.ar;
            }
            if (updates.bab) {
                if (updates.bab.th !== undefined) updateData['bab.th'] = updates.bab.th;
                if (updates.bab.ar !== undefined) updateData['bab.ar'] = updates.bab.ar;
            }
            if (updates.chain) {
                if (updates.chain.th !== undefined) updateData['chain.th'] = updates.chain.th;
                if (updates.chain.ar !== undefined) updateData['chain.ar'] = updates.chain.ar;
            }
            if (updates.title) {
                if (updates.title.th !== undefined) updateData['title.th'] = updates.title.th;
                if (updates.title.ar !== undefined) updateData['title.ar'] = updates.title.ar;
            }
            if (updates.footnote) {
                if (updates.footnote.th !== undefined) updateData['footnote.th'] = updates.footnote.th;
                if (updates.footnote.ar !== undefined) updateData['footnote.ar'] = updates.footnote.ar;
            }
            if (updates.grade) {
                // Grade can be complex object or string sometimes, but usually object { th, ar }
                // Or simple grade field "grade"
                if (updates.grade.th !== undefined) updateData['grade.th'] = updates.grade.th;
                if (updates.grade.ar !== undefined) updateData['grade.ar'] = updates.grade.ar;
            }
            if (updates.hadith_status) updateData.hadith_status = updates.hadith_status; // Simple string grade

            await collection.updateOne({ hadith_id: id }, { $set: updateData });

            const updated = await collection.findOne({ hadith_id: id });
            const { _id, ...rest } = updated!;
            return rest;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // POST /api/admin/hadiths - Create new hadith
    fastify.post('/admin/hadiths', async (request, reply) => {
        const body = request.body as any;

        // Basic validation
        if (!body.hadith_book || !body.hadith_no) {
            return reply.status(400).send({ detail: 'hadith_book and hadith_no are required' });
        }

        try {
            const collection = await getCollection('translations');

            // Auto-generate hadith_id if not provided
            const hadith_id = body.hadith_id || `${body.hadith_book}:${body.hadith_no}`;

            const existing = await collection.findOne({ hadith_id });
            if (existing) {
                return reply.status(400).send({ detail: `Hadith ID ${hadith_id} already exists` });
            }

            const newHadith = {
                hadith_id,
                hadith_book: body.hadith_book,
                hadith_no: parseInt(body.hadith_no),
                kitab: body.kitab || {},
                bab: body.bab || {},
                title: body.title || {},
                chain: body.chain || {},
                content: body.content || { ar: '', th: '' },
                footnote: body.footnote || {},
                grade: body.grade || {},
                hadith_status: body.hadith_status,
                status: body.status || 'pending',
                created_at: new Date(),
                updated_at: new Date()
            };

            await collection.insertOne(newHadith);
            const { _id, ...rest } = newHadith as any;
            return rest;

        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // DELETE /api/admin/hadiths/:id - Delete hadith
    fastify.delete('/admin/hadiths/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const collection = await getCollection('translations');
            const result = await collection.deleteOne({ hadith_id: id });

            if (result.deletedCount === 0) {
                return reply.status(404).send({ detail: 'Hadith not found' });
            }

            return { message: 'Hadith deleted successfully' };
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
                        // Ensure th/ar/icon are saved if provided
                        ...(updates.th ? { th: updates.th } : {}),
                        ...(updates.ar ? { ar: updates.ar } : {}),
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
