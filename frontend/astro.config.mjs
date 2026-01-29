// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    integrations: [
        tailwind(),
        react(),
        sitemap({
            // Filter pages for sitemap
            filter: (page) => !page.includes('/admin'),
            changefreq: 'weekly',
            priority: 0.7,
        }),
    ],
    output: 'server',  // Server mode for dynamic pages (search, pagination)
    adapter: node({
        mode: 'standalone',
    }),
    server: {
        host: '0.0.0.0',
        port: 4321,
    },
    // Production site URL for canonical URLs and sitemap
    site: 'https://sunnahthai.com',
});
