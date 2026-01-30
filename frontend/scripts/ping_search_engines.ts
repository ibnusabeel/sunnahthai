/**
 * Ping Search Engines Script
 * แจ้ง search engines ให้มาอ่าน sitemap ใหม่
 * 
 * Usage: npx tsx scripts/ping_search_engines.ts
 */

const SITE_URL = 'https://sunnahthai.com';
const SITEMAP_URL = `${SITE_URL}/sitemap-index.xml`;

// Search engine ping URLs
const SEARCH_ENGINES = [
    {
        name: 'Google',
        url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
    },
    {
        name: 'Bing',
        url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
    },
    {
        name: 'IndexNow (Bing/Yandex/DuckDuckGo)',
        url: `https://api.indexnow.org/indexnow?url=${encodeURIComponent(SITE_URL)}&key=sunnahthai`,
        note: 'ต้องสร้างไฟล์ /sunnahthai.txt ที่ root ก่อน (ใส่ค่า: sunnahthai)',
    },
];

// Important pages to ping individually
const IMPORTANT_PAGES = [
    '/',
    '/bukhari',
    '/muslim',
    '/nasai',
    '/tirmidhi',
    '/abudawud',
    '/ibnmajah',
    '/search',
    '/articles',
];

async function pingSearchEngines() {
    console.log('🔔 Pinging Search Engines...\n');
    console.log(`📍 Site: ${SITE_URL}`);
    console.log(`📄 Sitemap: ${SITEMAP_URL}\n`);
    console.log('─'.repeat(50));

    for (const engine of SEARCH_ENGINES) {
        try {
            console.log(`\n🌐 Pinging ${engine.name}...`);
            if (engine.note) {
                console.log(`   ℹ️  ${engine.note}`);
            }

            const response = await fetch(engine.url);

            if (response.ok) {
                console.log(`   ✅ Success! Status: ${response.status}`);
            } else {
                console.log(`   ⚠️  Status: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${(error as Error).message}`);
        }
    }

    console.log('\n' + '─'.repeat(50));
    console.log('\n📋 สรุป:\n');
    console.log('1. ✅ Ping sitemap แล้ว');
    console.log('2. 📌 ยังต้องทำ:');
    console.log('   - ไปที่ Google Search Console: https://search.google.com/search-console');
    console.log('   - Submit Sitemap: /sitemap-index.xml');
    console.log('   - Request Indexing สำหรับหน้าสำคัญ');
    console.log('\n🎯 หน้าสำคัญที่ควร Request Indexing:');

    for (const page of IMPORTANT_PAGES) {
        console.log(`   ${SITE_URL}${page}`);
    }

    console.log('\n' + '─'.repeat(50));
    console.log('✨ เสร็จสิ้น!\n');
}

// Ping individual URLs to IndexNow (optional advanced feature)
async function pingIndexNow(urls: string[]) {
    console.log('\n🚀 Pinging IndexNow API...\n');

    const body = {
        host: 'sunnahthai.com',
        key: 'sunnahthai',
        keyLocation: `${SITE_URL}/sunnahthai.txt`,
        urlList: urls.map(path => `${SITE_URL}${path}`),
    };

    try {
        const response = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (response.ok || response.status === 202) {
            console.log('✅ IndexNow: URLs submitted successfully!');
            console.log(`   Submitted ${urls.length} URLs`);
        } else {
            console.log(`⚠️  IndexNow Status: ${response.status}`);
            const text = await response.text();
            console.log(`   Response: ${text}`);
        }
    } catch (error) {
        console.log(`❌ IndexNow Error: ${(error as Error).message}`);
    }
}

// Main
async function main() {
    console.log('\n');
    console.log('═'.repeat(50));
    console.log('   🔍 SunnahThai - Search Engine Ping Tool');
    console.log('═'.repeat(50));

    await pingSearchEngines();

    // Optional: Ping IndexNow with important pages
    const args = process.argv.slice(2);
    if (args.includes('--indexnow')) {
        await pingIndexNow(IMPORTANT_PAGES);
    }
}

main().catch(console.error);
