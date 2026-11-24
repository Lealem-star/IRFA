/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1e3250',
          900: '#14243b',
          950: '#0c1726',
        },
        gov: {
          blue: '#2458d3',
          blueHover: '#1c46ad',
          softBlue: '#eaf0ff',
          iceBlue: '#f1f5ff',
          ink: '#18253a',
          muted: '#6b778c',
          line: '#e6eaf1',
          bg: '#f6f8fc',
          green: '#15966a',
          greenBg: '#e5f7ef',
          amber: '#b97712',
          amberBg: '#fff3d8',
          red: '#c53b47',
          redBg: '#fdecef',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
