/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'white': { DEFAULT: '#FFFFFF', 100: '#333333', 200: '#666666', 300: '#999999', 400: '#cccccc', 500: '#ffffff', 600: '#ffffff', 700: '#ffffff', 800: '#ffffff', 900: '#ffffff' },
        'cordovan': { DEFAULT: '#91403E', 100: '#1d0d0d', 200: '#3b1a19', 300: '#582626', 400: '#753332', 500: '#91403e', 600: '#b75856', 700: '#c98281', 800: '#dbacab', 900: '#edd5d5' },
        'anti-flash_white': { DEFAULT: '#E9ECEC', 100: '#2c3232', 200: '#576464', 300: '#859595', 400: '#b7c0c0', 500: '#e9ecec', 600: '#eef0f0', 700: '#f2f4f4', 800: '#f6f7f7', 900: '#fbfbfb' },
        'mikado_yellow': { DEFAULT: '#F4BE03', 100: '#302600', 200: '#614c01', 300: '#917201', 400: '#c29802', 500: '#f4be03', 600: '#fdd02d', 700: '#fddc61', 800: '#fee796', 900: '#fef3ca' },
        'black': { DEFAULT: '#000000', 100: '#000000', 200: '#000000', 300: '#000000', 400: '#000000', 500: '#000000', 600: '#333333', 700: '#666666', 800: '#999999', 900: '#cccccc' },
      },
    },
  },
  plugins: [],
}

