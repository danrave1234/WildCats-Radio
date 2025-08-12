import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["class", "class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        maroon: {
          50: "#fdf2f2",
          100: "#f9e6e6",
          200: "#f3cdcd",
          300: "#e9b4b4",
          400: "#df9b9b",
          500: "#b65f5d",
          600: "#91403E",
          700: "#833a38",
          800: "#753332",
          900: "#672d2c",
          950: "#591f1e",
        },
        gold: {
          50: "#fff9e6",
          100: "#fff3cc",
          200: "#ffe799",
          300: "#ffdb66",
          400: "#ffcf33",
          500: "#F4BE03",
          600: "#e6b303",
          700: "#cc9f02",
          800: "#b38b02",
          900: "#997701",
          950: "#806401",
        },
        wildcats: {
          white: "#FFFFFF",
          background: "#E9ECEC",
          maroon: "#91403E",
          yellow: "#F4BE03",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'maroon': '0 4px 14px 0 rgba(145, 64, 62, 0.15)',
        'gold': '0 4px 14px 0 rgba(244, 190, 3, 0.15)',
      },
      fontFamily: {
        sans: ['Kumbh Sans', 'system-ui', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        nunito: ['Nunito Sans', 'sans-serif'],
        poetsen: ['Poetsen One', 'cursive'],
        kumbh: ['Kumbh Sans', 'sans-serif'],
      },
      animation: {
        spinner: 'spinner 1s linear infinite',
      },
      keyframes: {
        spinner: {
          '0%': { opacity: '1' },
          '10%': { opacity: '0.7' },
          '20%': { opacity: '0.3' },
          '35%': { opacity: '0.2' },
          '50%': { opacity: '0.1' },
          '75%': { opacity: '0.05' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
    require('tailwindcss-animate'),
  ],
}