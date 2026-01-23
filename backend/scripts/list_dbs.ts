import { MongoClient } from 'mongodb';

const URI = 'mongodb://localhost:27017';

async function listDbs() {
    console.log('Connecting to:', URI);
    const client = new MongoClient(URI);
    try {
        await client.connect();
        const adminDb = client.db().admin();
        const result = await adminDb.listDatabases();

        console.log('Databases:');
        result.databases.forEach(db => {
            console.log(`- ${db.name} (Size: ${db.sizeOnDisk})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

listDbs();
