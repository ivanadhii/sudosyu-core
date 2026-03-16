import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        purple: {
          400: "#C084FC",
          500: "#A855F7",
          600: "#9333EA",
          700: "#7C3AED",
          800: "#6D28D9",
          900: "#4C1D95",
        },
        dark: {
          50: "#1A1A1A",
          100: "#141414",
          200: "#111111",
          300: "#0D0D0D",
          400: "#0A0A0A",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      boxShadow: {
        "neon-purple": "0 0 20px rgba(168, 85, 247, 0.4)",
        "neon-purple-sm": "0 0 10px rgba(168, 85, 247, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
