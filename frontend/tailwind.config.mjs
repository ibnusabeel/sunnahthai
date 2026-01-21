/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                // 🌸 Pastel Cute Color Palette
                primary: {
                    DEFAULT: '#A78BFA', // Violet-400 (pastel purple)
                    light: '#C4B5FD',   // Violet-300
                    soft: '#EDE9FE',    // Violet-100
                    dark: '#7C3AED',    // Violet-600
                },
                pink: {
                    DEFAULT: '#F9A8D4', // Pink-300
                    light: '#FBCFE8',   // Pink-200
                    soft: '#FCE7F3',    // Pink-100
                },
                mint: {
                    DEFAULT: '#6EE7B7', // Emerald-300
                    light: '#A7F3D0',   // Emerald-200
                    soft: '#D1FAE5',    // Emerald-100
                },
                peach: {
                    DEFAULT: '#FDBA74', // Orange-300
                    light: '#FED7AA',   // Orange-200
                    soft: '#FFEDD5',    // Orange-100
                },
                sky: {
                    DEFAULT: '#7DD3FC', // Sky-300
                    light: '#BAE6FD',   // Sky-200
                    soft: '#E0F2FE',    // Sky-100
                },
                lavender: {
                    DEFAULT: '#C7D2FE', // Indigo-200
                    light: '#E0E7FF',   // Indigo-100
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    muted: '#FEFCE8',   // Yellow-50 (cream)
                },
                text: {
                    DEFAULT: '#374151', // Gray-700
                    muted: '#6B7280',   // Gray-500
                    light: '#9CA3AF',   // Gray-400
                },
                border: '#F3E8FF',    // Purple-100
            },
            fontFamily: {
                thai: ['Noto Sans Thai', 'sans-serif'],
                arabic: ['UthmanTN', 'Amiri', 'serif'],
                sans: ['Inter', 'Noto Sans Thai', 'sans-serif'],
            },
            borderRadius: {
                'cute': '1.25rem',
                'pill': '9999px',
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(167, 139, 250, 0.15), 0 8px 16px -4px rgba(249, 168, 212, 0.1)',
                'glow': '0 0 25px rgba(167, 139, 250, 0.25)',
                'card': '0 2px 12px rgba(0, 0, 0, 0.04)',
            },
        },
    },
    plugins: [],
}
