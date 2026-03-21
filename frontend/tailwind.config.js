/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vitae: {
          bg: '#0A0A0A',
          card: '#141414',
          'card-light': '#1A1A1A',
          border: '#222222',
          gold: '#0099C4',
          'gold-dim': 'rgba(0,153,196,0.15)',
          green: '#4AD9A4',
          red: '#D94452',
          blue: '#4A9FD9',
          purple: '#B482FF',
          text: '#FFFFFF',
          'text-secondary': '#888888',
          'text-muted': '#555555',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'phone': '52px',
        'card': '20px',
        'btn': '14px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
