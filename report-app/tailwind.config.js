/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        ok: '#2fd07a',
        watch: '#ffcc4d',
        crit: '#ff5470',
        ink: '#0b0f17',
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pingslow: { '0%': { transform: 'scale(1)', opacity: '0.7' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      },
      animation: {
        floaty: 'floaty 5s ease-in-out infinite',
        shimmer: 'shimmer 2.2s infinite',
        pingslow: 'pingslow 2.4s cubic-bezier(0,0,0.2,1) infinite',
      },
    },
  },
  plugins: [],
};
