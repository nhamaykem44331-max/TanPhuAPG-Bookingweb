/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0a74c0',
          50: '#eef6fc',
          100: '#d6e9f7',
          200: '#a9d0ee',
          300: '#6fb2e2',
          400: '#2f8fd2',
          500: '#0a74c0',
          600: '#0861a3',
          700: '#0a4f86',
          800: '#0f3d6a',
          900: '#112f4f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Be Vietnam Pro', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
