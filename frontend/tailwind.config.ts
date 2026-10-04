import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mint: "#BFE3D0",
        sky: "#A8D8D8",
        peach: "#F5C98E",
        blush: "#E8B4A0",
        cream: "#FDF6EC",
        ink: "#1A1A1A",
        "ink-soft": "#4A4A4A",

        success: "#4ADE80",
        warning: "#FBBF24",
        error: "#F87171",
        accent: {
          DEFAULT: "#7DD3C0",
          foreground: "#1A1A1A",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "blob-1": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "33%": { transform: "translate(8%, 12%) scale(1.08)" },
          "66%": { transform: "translate(-6%, 6%) scale(0.96)" },
        },
        "blob-2": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "33%": { transform: "translate(-10%, 8%) scale(0.94)" },
          "66%": { transform: "translate(6%, -8%) scale(1.06)" },
        },
        "blob-3": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "50%": { transform: "translate(-8%, -10%) scale(1.1)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite linear",
        "blob-1": "blob-1 30s ease-in-out infinite",
        "blob-2": "blob-2 38s ease-in-out infinite",
        "blob-3": "blob-3 45s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
