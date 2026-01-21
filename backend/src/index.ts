import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';

// Routes
import booksRoutes from './routes/books.js';
import statsRoutes from './routes/stats.js';
import hadithsRoutes from './routes/hadiths.js';
import kitabsRoutes from './routes/kitabs.js';
import uploadRoutes from './routes/upload.js';
import categoriesRoutes from './routes/categories.js';
import articlesRoutes from './routes/articles.js';
import translateRoutes from './routes/translate.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '../.env' });

const fastify = Fastify({
    logger: true
});

// Register Plugins
await fastify.register(cors, {
    origin: ['http://localhost:4321', 'http://localhost:3000', '*'],
    credentials: true
});

await fastify.register(multipart);
await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/', // public url prefix
});

// Register routes
fastify.register(booksRoutes, { prefix: '/api' });
fastify.register(statsRoutes, { prefix: '/api' });
fastify.register(hadithsRoutes, { prefix: '/api' });
fastify.register(kitabsRoutes, { prefix: '/api' });
fastify.register(uploadRoutes, { prefix: '/api' });
fastify.register(categoriesRoutes, { prefix: '/api' });
fastify.register(articlesRoutes, { prefix: '/api' });
fastify.register(translateRoutes, { prefix: '/api' });
fastify.register(adminRoutes); // Admin HTML pages
fastify.register(adminRoutes, { prefix: '/api' }); // Admin CRUD routes

// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
    try {
        await connectDB();
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('🚀 Fastify server running on http://localhost:3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
