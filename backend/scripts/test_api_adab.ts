
import fetch from 'node-fetch';

async function testApi() {
    try {
        const res = await fetch('http://localhost:3000/api/kitabs/adab');
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

testApi();
