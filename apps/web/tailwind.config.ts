import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        brand: "var(--radius-brand)",
        "premium-sm": "var(--radius-sm)",
        "premium-md": "var(--radius-md)",
        "premium-lg": "var(--radius-lg)",
        "premium-xl": "var(--radius-xl)",
      },
      colors: {
        border: "rgb(var(--color-border) / <alpha-value>)",
        input: "rgb(var(--color-border) / <alpha-value>)",
        ring: "rgb(var(--color-primary) / <alpha-value>)",
        background: "rgb(var(--color-bg) / <alpha-value>)",
        foreground: "rgb(var(--color-text-primary) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          foreground: "rgb(var(--color-surface) / <alpha-value>)",
          2: "rgb(var(--color-primary-hover) / <alpha-value>)",
          ring: "rgb(var(--color-primary) / <alpha-value>)",
          gold: "rgb(var(--color-brand-gold) / <alpha-value>)",
          plum: "rgb(var(--color-brand-plum) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          foreground: "rgb(var(--color-surface) / <alpha-value>)",
          hover: "rgb(var(--color-primary-hover) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          foreground: "rgb(var(--color-text-primary) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--color-surface-alt) / <alpha-value>)",
          foreground: "rgb(var(--color-text-secondary) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          foreground: "rgb(var(--color-surface) / <alpha-value>)",
          50: "rgb(var(--color-accent) / 0.1)",
          500: "rgb(var(--color-accent) / <alpha-value>)",
          600: "rgb(var(--color-accent) / <alpha-value>)",
          700: "rgb(var(--color-accent) / <alpha-value>)",
        },
        destructive: "rgb(var(--color-danger) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          foreground: "rgb(var(--color-text-primary) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          alt: "rgb(var(--color-surface-alt) / <alpha-value>)",
          1: "rgb(var(--color-surface) / <alpha-value>)",
          2: "rgb(var(--color-surface-alt) / <alpha-value>)",
          3: "rgb(var(--color-surface-alt) / 0.7)",
          elevated: "rgb(var(--color-surface) / <alpha-value>)",
        },
        neutral: {
          0: "rgb(var(--color-surface) / <alpha-value>)",
          50: "rgb(var(--color-bg) / <alpha-value>)",
          100: "rgb(var(--color-surface-alt) / <alpha-value>)",
          200: "rgb(var(--color-border) / <alpha-value>)",
          400: "rgb(var(--color-text-secondary) / 0.8)",
          500: "rgb(var(--color-text-secondary) / <alpha-value>)",
          600: "rgb(var(--color-text-secondary) / <alpha-value>)",
          700: "rgb(var(--color-text-secondary) / <alpha-value>)",
          800: "rgb(var(--color-text-primary) / 0.9)",
          900: "rgb(var(--color-text-primary) / <alpha-value>)",
        },
        verified: {
          DEFAULT: "rgb(var(--color-brand-gold) / <alpha-value>)",
          bg: "rgb(var(--color-brand-gold) / 0.12)",
        },
        success: {
          DEFAULT: "rgb(var(--color-success) / <alpha-value>)",
          500: "rgb(var(--color-success) / <alpha-value>)",
          bg: "rgb(var(--color-success) / 0.12)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning) / <alpha-value>)",
          500: "rgb(var(--color-warning) / <alpha-value>)",
        },
        error: {
          DEFAULT: "rgb(var(--color-danger) / <alpha-value>)",
          500: "rgb(var(--color-danger) / <alpha-value>)",
          bg: "rgb(var(--color-danger) / 0.12)",
        },
      },
      fontSize: {
        "premium-h1": ["var(--font-size-h1)", { lineHeight: "1.1" }],
        "premium-h2": ["var(--font-size-h2)", { lineHeight: "1.15" }],
        "premium-h3": ["var(--font-size-h3)", { lineHeight: "1.2" }],
        "premium-body": ["var(--font-size-body)", { lineHeight: "1.6" }],
        "premium-body-sm": ["var(--font-size-body-sm)", { lineHeight: "1.6" }],
        "premium-small": ["var(--font-size-small)", { lineHeight: "1.5" }],
        "premium-label": ["var(--font-size-label)", { lineHeight: "1.4" }],
      },
      boxShadow: {
        "premium-sm": "var(--shadow-sm)",
        "premium-md": "var(--shadow-md)",
        "premium-lg": "var(--shadow-lg)",
        soft: "var(--shadow-sm)",
        med: "var(--shadow-md)",
        strong: "var(--shadow-lg)",
      },
      backgroundImage: {
        "hero-glow": "var(--hero-glow)",
        "brand-gradient": "var(--brand-gradient)",
        "brand-gradient-subtle": "var(--brand-gradient-subtle-bg)",
        "brand-gradient-subtle-old": "linear-gradient(120deg, rgb(var(--color-primary) / 0.14), rgb(var(--color-primary-hover) / 0.12))",
        "accent-gradient": "linear-gradient(120deg, rgb(var(--color-accent) / 0.18), rgb(var(--color-primary) / 0.1))",
      },
      transitionDuration: {
        fast: "140ms",
        normal: "240ms",
      },
      transitionTimingFunction: {
        "premium-out": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "premium-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "card-shine": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "card-shine": "card-shine 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
