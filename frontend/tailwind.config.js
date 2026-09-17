/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'] },
      colors: {
        ink: { 950: '#0b0b12', 900: '#12121a', 800: '#1b1b26', 700: '#262633' },
        zivv: { orange: '#FF9A3D', yellow: '#FFD23D', pink: '#FF4D8D', magenta: '#C724B1', purple: '#7B2FF7', blue: '#2FB7FF' },
      },
      boxShadow: { card: '0 8px 30px rgba(0,0,0,.08)', pop: '0 18px 60px rgba(123,47,247,.25)' },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
