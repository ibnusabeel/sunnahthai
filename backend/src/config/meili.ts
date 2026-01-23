import { MeiliSearch } from 'meilisearch';
import dotenv from 'dotenv';

dotenv.config();

const MEILI_HOST = process.env.MEILI_HOST || 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_KEY || '';

export const meiliClient = new MeiliSearch({
    host: MEILI_HOST,
    apiKey: MEILI_KEY
});

export const INDEX_NAME = 'hadiths';
