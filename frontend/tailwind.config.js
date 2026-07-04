/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: '#0770E3',
      },
      fontFamily: {
        sans: ['Inter', 'Be Vietnam Pro', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
