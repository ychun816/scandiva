/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
            },
            colors: {
                // primary ink accent — a calm near-black, replaces the indigo/purple gradients
                ink: {
                    DEFAULT: '#1c1917',
                    soft: '#292524',
                },
            },
            boxShadow: {
                // soft, layered elevation — present but calm, no colored glows
                card: '0 1px 2px -1px rgb(28 25 23 / 0.08), 0 1px 3px 0 rgb(28 25 23 / 0.05)',
                'card-hover': '0 6px 20px -8px rgb(28 25 23 / 0.18), 0 2px 6px -2px rgb(28 25 23 / 0.10)',
                pop: '0 12px 40px -10px rgb(28 25 23 / 0.22), 0 4px 12px -4px rgb(28 25 23 / 0.12)',
                header: '0 1px 0 0 rgb(28 25 23 / 0.06), 0 4px 20px -12px rgb(28 25 23 / 0.10)',
            },
            keyframes: {
                'fade-in': {
                    from: { opacity: '0', transform: 'translateY(4px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.18s ease-out',
            },
        },
    },
    plugins: [],
}
