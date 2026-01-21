import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream';
import util from 'util';
import { fileURLToPath } from 'url';

const pump = util.promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post('/upload', async (req, reply) => {
        const data = await (req as any).file();

        if (!data) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(data.mimetype)) {
            return reply.status(400).send({ error: 'Invalid file type. Only images are allowed.' });
        }

        // Create unique filename
        const timestamp = Date.now();
        const ext = path.extname(data.filename);
        const filename = `${timestamp}-${Math.round(Math.random() * 1E9)}${ext}`;
        const savePath = path.join(__dirname, '../../uploads', filename);

        // Ensure directory exists (redundant if mkdir was run, but safe)
        if (!fs.existsSync(path.dirname(savePath))) {
            fs.mkdirSync(path.dirname(savePath), { recursive: true });
        }

        await pump(data.file, fs.createWriteStream(savePath));

        const fileUrl = `/uploads/${filename}`;

        return {
            url: fileUrl,
            filename: filename,
            mimetype: data.mimetype
        };
    });
};

export default uploadRoutes;
