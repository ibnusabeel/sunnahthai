
import fetch from 'node-fetch';

const BAES_URL = 'http://localhost:3000';

async function testAdminAPI() {
    console.log('🧪 Testing Admin API...');

    // 1. GET /api/admin/books
    console.log('\n--- 1. GET Books ---');
    const res1 = await fetch(`${BAES_URL}/api/admin/books`);
    const data1 = await res1.json();
    console.log('Result:', data1.data?.length > 0 ? 'Success' : 'Empty?');
    if (data1.data?.length > 0) {
        console.log('Sample Book:', data1.data[0].book, `(Total: ${data1.data[0].total})`);
    }

    // 2. POST /api/admin/books
    console.log('\n--- 2. POST Book (test-book) ---');
    const newBook = {
        book: 'test-book',
        th: 'หนังสือทดสอบ',
        ar: 'Test Book',
        description: 'Test description'
    };
    const res2 = await fetch(`${BAES_URL}/api/admin/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook)
    });
    console.log('Status:', res2.status);
    console.log('Body:', await res2.json());

    // 3. POST /api/admin/hadiths
    console.log('\n--- 3. POST Hadith (test-book:1) ---');
    const newHadith = {
        hadith_book: 'test-book',
        hadith_no: 1,
        content: { ar: 'Test content', th: 'เนื้อหาทดสอบ' }
    };
    const res3 = await fetch(`${BAES_URL}/api/admin/hadiths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHadith)
    });
    console.log('Status:', res3.status);
    const hData = await res3.json();
    console.log('Body:', hData);
    const hId = hData.hadith_id;

    // 4. DELETE /api/admin/hadiths/:id
    if (hId) {
        console.log(`\n--- 4. DELETE Hadith (${hId}) ---`);
        const res4 = await fetch(`${BAES_URL}/api/admin/hadiths/${hId}`, {
            method: 'DELETE'
        });
        console.log('Status:', res4.status);
        console.log('Body:', await res4.json());
    }

    // 5. DELETE /api/admin/books/:book
    console.log('\n--- 5. DELETE Book (test-book) ---');
    const res5 = await fetch(`${BAES_URL}/api/admin/books/test-book`, {
        method: 'DELETE'
    });
    console.log('Status:', res5.status);
    console.log('Body:', await res5.json());

}

testAdminAPI().catch(console.error);
