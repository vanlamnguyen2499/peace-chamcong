/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        gapo: {
          green: '#00BA74',
          'green-hover': '#009F63',
          'green-light': '#E6F8F1',
          dark: '#1E293B',
          gray: '#64748B',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        }
      },
    },
  },
  plugins: [],
};
