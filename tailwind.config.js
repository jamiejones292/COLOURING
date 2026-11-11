/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#2b2350',
        grape: { 50: '#f4f0ff', 100: '#e9e1ff', 200: '#d4c4ff', 400: '#9b7bff', 500: '#7c5cff', 600: '#6741f0', 700: '#5531cc' },
        sunny: { 300: '#ffe27a', 400: '#ffd23f', 500: '#ffbf1f' },
        bubble: { 300: '#ff9ccb', 400: '#ff6fb1', 500: '#ff4797' },
        mint: { 300: '#8ff0cf', 400: '#4fe0b0', 500: '#1fc995' },
        sky2: { 300: '#8fd8ff', 400: '#4fc0ff', 500: '#1ea7f5' },
        tangerine: { 400: '#ff9a3d', 500: '#ff7a1a' },
      },
      boxShadow: {
        pop: '0 6px 0 0 rgba(43,35,80,0.18)',
        'pop-sm': '0 3px 0 0 rgba(43,35,80,0.18)',
        soft: '0 10px 30px -10px rgba(43,35,80,0.35)',
      },
      keyframes: {
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        popin: { '0%': { transform: 'scale(.6)', opacity: '0' }, '70%': { transform: 'scale(1.06)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        popin: 'popin .35s cubic-bezier(.2,.9,.3,1.3) both',
      },
    },
  },
  plugins: [],
};
