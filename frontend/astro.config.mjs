// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    integrations: [tailwind(), react()],
    output: 'server',  // Server mode for dynamic pages (search, pagination)
    adapter: node({
        mode: 'standalone',
    }),
    server: {
        host: '0.0.0.0',
        port: 4321,
    },
    site: 'http://localhost:4321',
});
