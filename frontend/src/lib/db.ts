
import { MongoClient } from 'mongodb';

if (!import.meta.env.MONGO_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGO_URI"');
}

const uri = import.meta.env.MONGO_URI;
const options = {};

let client;
let clientPromise: Promise<MongoClient>;

if (import.meta.env.DEV) {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

export default clientPromise;

// Helper to get collections
export async function getCollection(collectionName: string) {
    const client = await clientPromise;
    const db = client.db('hadith_db'); // Make sure this matches your DB name
    return db.collection(collectionName);
}
