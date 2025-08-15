/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delay': 'float 7s ease-in-out 2s infinite',
        'pulse-slow': 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
      boxShadow: {
        'custom-red': '0px 0px 0px -3px rgb(254,255,254), 7px 7px 0px -3px rgb(8, 28, 21), 11px 11px 0px -3px rgb(216, 243, 220)',
        'custom-dark-green': '5px 5px 0px 0px rgb(8, 28, 21)',
        'custom-light-green': '5px 5px 0px 0px rgb(64, 145, 108)',
        'circle-glow': '0 0 20px rgba(64, 145, 108, 0.25)',
        'text-shadow-glow': '0 0 10px rgba(255, 255, 255, 0.7), 0 0 20px rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.3)',
      },
      fontFamily: {
        'unbounded': ["Unbounded", "system-ui"],
      },
      fontWeight: {
        hairline: 100,
        thin: 200,
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900,
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.text-shadow-glow': {
          textShadow: '0 0 60px rgba(216, 243, 220, 1)',
        },
        '.text-shadow-green-glow': {
          textShadow: '0 0 100px #40916C',
        },
      };
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
  ],
}