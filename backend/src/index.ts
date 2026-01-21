import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

// Routes
import booksRoutes from './routes/books.js';
import statsRoutes from './routes/stats.js';
import hadithsRoutes from './routes/hadiths.js';
import kitabsRoutes from './routes/kitabs.js';
import translateRoutes from './routes/translate.js';
import adminRoutes from './routes/admin.js';

dotenv.config({ path: '../.env' });

const fastify = Fastify({
    logger: true
});

// Register CORS
await fastify.register(cors, {
    origin: ['http://localhost:4321', 'http://localhost:3000', '*'],
    credentials: true
});

// Register routes
fastify.register(booksRoutes, { prefix: '/api' });
fastify.register(statsRoutes, { prefix: '/api' });
fastify.register(hadithsRoutes, { prefix: '/api' });
fastify.register(kitabsRoutes, { prefix: '/api' });
fastify.register(translateRoutes, { prefix: '/api' });
fastify.register(adminRoutes); // Admin HTML pages (no prefix - serves /admin/*)
fastify.register(adminRoutes, { prefix: '/api' }); // Admin CRUD routes (with /api prefix)

// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
    try {
        // Connect to MongoDB first
        await connectDB();

        // Start Fastify
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('🚀 Fastify server running on http://localhost:3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
