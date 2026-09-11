/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    '../public/*.html',
    '../public/js/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        lato: ['Lato', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
