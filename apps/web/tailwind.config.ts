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
        brand: "var(--radius)",
        "premium-sm": "var(--radius-sm)",
        "premium-md": "var(--radius-md)",
        "premium-lg": "var(--radius-lg)",
        "premium-xl": "var(--radius-xl)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          2: "hsl(var(--brand-2))",
          ring: "hsl(var(--brand-ring))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          50: "var(--accent-50)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
        },
        destructive: "hsl(var(--destructive))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          elevated: "hsl(var(--surface-elevated))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
        neutral: {
          0: "var(--neutral-0)",
          50: "var(--neutral-50)",
          100: "var(--neutral-100)",
          200: "var(--neutral-200)",
          400: "var(--neutral-400)",
          500: "var(--neutral-500)",
          600: "var(--neutral-600)",
          700: "var(--neutral-700)",
          800: "var(--neutral-800)",
          900: "var(--neutral-900)",
        },
        success: { 500: "var(--success-500)", bg: "var(--success-bg)" },
        error: { 500: "var(--error-500)", bg: "var(--error-bg)" },
      },
      fontSize: {
        "premium-h1": ["var(--font-size-h1)", { lineHeight: "1.2" }],
        "premium-h2": ["var(--font-size-h2)", { lineHeight: "1.25" }],
        "premium-h3": ["var(--font-size-h3)", { lineHeight: "1.3" }],
        "premium-body": ["var(--font-size-body)", { lineHeight: "1.5" }],
        "premium-body-sm": ["var(--font-size-body-sm)", { lineHeight: "1.45" }],
        "premium-small": ["var(--font-size-small)", { lineHeight: "1.4" }],
        "premium-label": ["var(--font-size-label)", { lineHeight: "1.35" }],
      },
      boxShadow: {
        "premium-xs": "var(--shadow-xs)",
        "premium-sm": "var(--shadow-sm)",
        "premium-md": "var(--shadow-md)",
        "premium-lg": "var(--shadow-lg)",
        "premium-xl": "var(--shadow-xl)",
        "soft": "var(--shadow-soft)",
        "med": "var(--shadow-med)",
        "strong": "var(--shadow-strong)",
      },
      backgroundImage: {
        "brand-gradient": "var(--brand-gradient)",
        "brand-gradient-subtle": "var(--brand-gradient-subtle)",
        "accent-gradient": "var(--accent-gradient)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
      },
      transitionTimingFunction: {
        "premium-out": "var(--ease-out)",
        "premium-in-out": "var(--ease-in-out)",
      },
    },
  },
  plugins: [],
};

export default config;
