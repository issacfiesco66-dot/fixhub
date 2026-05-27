import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Tipografía elegante (system stack — sin imports)
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
      },
      colors: {
        // Marca: indigo profundo para confianza
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          900: "#312e81",
        },
        // Monetización: esmeralda
        money: {
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Urgencia: ámbar→carmesí (usar en gradientes)
        urgent: {
          amber: "#f59e0b",
          red: "#dc2626",
        },
      },
      boxShadow: {
        bento: "0 8px 30px rgb(0,0,0,0.04)",
        "bento-dark": "0 8px 30px rgb(0,0,0,0.4)",
        "glow-indigo": "0 0 0 4px rgba(99,102,241,0.15)",
        "glow-emerald": "0 0 0 4px rgba(16,185,129,0.15)",
        "glow-red": "0 0 0 4px rgba(220,38,38,0.2)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "shake": "shake 0.4s cubic-bezier(.36,.07,.19,.97) infinite",
        "pulse-soft": "pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-down": "slideDown 0.3s ease-out",
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        shake: {
          "10%, 90%": { transform: "translate3d(-1px, 0, 0)" },
          "20%, 80%": { transform: "translate3d(2px, 0, 0)" },
          "30%, 50%, 70%": { transform: "translate3d(-4px, 0, 0)" },
          "40%, 60%": { transform: "translate3d(4px, 0, 0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        slideDown: {
          "0%": { transform: "translateY(-12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
