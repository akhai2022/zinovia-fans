# Design Tokens + Component Library — Premium Creator Platform

**Goal:** A design system that reads as “expensive”: clear hierarchy, restrained contrast, layered depth, and smooth motion. Output is structured for CSS variables and Tailwind theme.

---

## 1. Type scale

**Base:** 16px (1rem). Scale: 1.125 (major second) for body/small; 1.25 (major third) for headings.

### Mobile

| Token | Size | Line height | Weight | Use |
|-------|------|-------------|--------|-----|
| `font-size-h1` | 28px (1.75rem) | 1.2 | 600 | Page title |
| `font-size-h2` | 22px (1.375rem) | 1.25 | 600 | Section title |
| `font-size-h3` | 18px (1.125rem) | 1.3 | 600 | Card title, modal title |
| `font-size-body` | 16px (1rem) | 1.5 | 400 | Body, captions |
| `font-size-body-sm` | 14px (0.875rem) | 1.45 | 400 | Secondary text |
| `font-size-small` | 12px (0.75rem) | 1.4 | 400 | Meta, labels, timestamps |
| `font-size-label` | 11px (0.6875rem) | 1.35 | 500 | Uppercase labels, badges |

### Desktop

| Token | Size | Line height | Weight |
|-------|------|-------------|--------|
| `font-size-h1-desktop` | 36px (2.25rem) | 1.15 | 600 |
| `font-size-h2-desktop` | 26px (1.625rem) | 1.25 | 600 |
| `font-size-h3-desktop` | 20px (1.25rem) | 1.3 | 600 |
| Body/small/label | Same as mobile | — | — |

### Font families

- **Sans (primary):** `font-sans` — system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif. Or a premium choice: "DM Sans", "Plus Jakarta Sans", "Inter".
- **Mono (optional):** `font-mono` — ui-monospace, monospace (for amounts, code).

---

## 2. Spacing system (4/8pt grid)

Base unit: **4px**. Use multiples of 4; prefer 8px for component gaps.

| Token | Value | Use |
|-------|--------|-----|
| `space-0` | 0 | Reset |
| `space-1` | 4px | Icon padding, tight gaps |
| `space-2` | 8px | Inline gaps, input padding |
| `space-3` | 12px | Small component padding |
| `space-4` | 16px | Card padding, section gaps |
| `space-5` | 20px | — |
| `space-6` | 24px | Block spacing |
| `space-8` | 32px | Section spacing |
| `space-10` | 40px | — |
| `space-12` | 48px | Large section |
| `space-16` | 64px | Hero, major sections |
| `space-20` | 80px | — |
| `space-24` | 96px | — |

**Layout containers**

- **Content max-width:** `container-sm` 480px, `container-md` 672px, `container-lg` 896px, `container-xl` 1120px.
- **Gutter (mobile):** 16px (`space-4`). **Desktop:** 24px (`space-6`).
- **Nav height:** 56px mobile, 64px desktop.

---

## 3. Color tokens

### Neutral ramp (grayscale)

Use for text, borders, and surfaces. Slight warm or cool tint (e.g. warm gray) reads more premium than pure gray.

| Token | Hex (example) | Use |
|-------|----------------|-----|
| `neutral-0` | #FFFFFF | Surfaces, cards on dark bg |
| `neutral-50` | #FAFAF9 | Page background |
| `neutral-100` | #F5F5F4 | Input bg, subtle fill |
| `neutral-200` | #E7E5E4 | Borders, dividers |
| `neutral-300` | #D6D3D1 | Disabled borders |
| `neutral-400` | #A8A29E | Placeholder |
| `neutral-500` | #78716C | Secondary text |
| `neutral-600` | #57534E | Body text |
| `neutral-700` | #44403C | Emphasized text |
| `neutral-800` | #292524 | Headings |
| `neutral-900` | #1C1917 | Primary text, dark mode bg |

### Accent ramp (brand / primary)

Single primary hue; use for CTAs, links, and selected states. Restrained saturation.

| Token | Use |
|-------|-----|
| `accent-50` | Light bg (hover on white) |
| `accent-100` | — |
| `accent-200` | — |
| `accent-500` | **Primary buttons, links** (main brand) |
| `accent-600` | Primary hover |
| `accent-700` | Primary active / focus ring |

Example: `accent-500` #6366F1 (indigo) or #7C3AED (violet) or #0D9488 (teal). Keep 500 as the “hero” shade.

### Semantic

| Token | Use |
|-------|-----|
| `success-500` | Success text, success toast (e.g. #059669) |
| `success-bg` | Success surface (e.g. #ECFDF5) |
| `warn-500` | Warning text (e.g. #D97706) |
| `warn-bg` | Warning surface (e.g. #FFFBEB) |
| `error-500` | Error text, destructive (e.g. #DC2626) |
| `error-bg` | Error surface (e.g. #FEF2F2) |

### Background layers

| Token | Use |
|-------|-----|
| `bg-page` | Page background (`neutral-50`) |
| `bg-surface` | Cards, sheets (`neutral-0`) |
| `bg-surface-elevated` | Modals, dropdowns (`neutral-0` + shadow) |
| `bg-muted` | Secondary areas (`neutral-100`) |
| `bg-overlay` | Modal backdrop (e.g. black/40%) |

---

## 4. Radii

Consistent rounding; avoid many different values.

| Token | Value | Use |
|-------|--------|-----|
| `radius-none` | 0 | — |
| `radius-sm` | 6px | Inputs, small buttons, badges |
| `radius-md` | 10px | Cards, modals (or 12px) |
| `radius-lg` | 16px | Large cards, bottom sheets |
| `radius-xl` | 24px | Hero cards, pricing card |
| `radius-full` | 9999px | Pills, avatars, round buttons |

**“Expensive” tip:** Slightly larger radius on cards (e.g. 12–16px) and one consistent radius for inputs/buttons (6–8px).

---

## 5. Shadows (layered card shadows)

Few levels; soft and slightly warm/cool to match neutral ramp.

| Token | Value (CSS) | Use |
|-------|-------------|-----|
| `shadow-xs` | 0 1px 2px rgba(0,0,0,0.04) | Subtle border substitute |
| `shadow-sm` | 0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06) | Cards at rest |
| `shadow-md` | 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.06) | Dropdowns, sticky bars |
| `shadow-lg` | 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06) | Modals, bottom sheets |
| `shadow-xl` | 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04) | Popovers, premium cards |

Use `neutral-900` at low opacity (e.g. 0.04–0.08) for a cohesive look.

---

## 6. Motion

**Durations**

| Token | Value | Use |
|-------|--------|-----|
| `duration-instant` | 0ms | — |
| `duration-fast` | 150ms | Hover, focus, toggles |
| `duration-normal` | 250ms | Modals, sheet open/close |
| `duration-slow` | 350ms | Page transitions, large panels |

**Easings**

| Token | Value | Use |
|-------|--------|-----|
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) | Enter (modals, sheets) |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | Exit |
| `ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Toggle, expand |
| `ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | Optional: buttons, badges (subtle) |

**Reduced motion**

- Respect `prefers-reduced-motion: reduce`: set transitions to `0ms` or avoid non-essential animation.
- Keep focus visible (outline) even when “reduce” is on; avoid motion-dependent indicators only.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 7. Component variants (mapped to tokens)

### Buttons

| Variant | Background | Text | Border | Hover | Active |
|---------|------------|------|--------|-------|--------|
| **Primary** | `accent-500` | white | none | `accent-600` | `accent-700` |
| **Secondary** | transparent | `neutral-700` | `neutral-200` | `neutral-100` | `neutral-200` |
| **Ghost** | transparent | `neutral-600` | none | `neutral-100` | `neutral-200` |
| **Destructive** | `error-500` | white | none | darker error | — |

- Height: 40px default, 36px small, 44px large. Padding horizontal: 16px / 12px / 20px.
- Radius: `radius-sm`. Font: `font-size-body` or `body-sm`, weight 500.
- Focus: 2px ring `accent-500` at 40% opacity, offset 2px.

### Inputs

- Height: 40px. Padding: 12px 14px. Radius: `radius-sm`.
- Border: 1px `neutral-200`; focus: border `accent-500` + shadow 0 0 0 3px accent/20%.
- Background: `neutral-0`; placeholder `neutral-400`. Error: border `error-500`, optional `error-bg`.

### Cards

- Background: `bg-surface`. Radius: `radius-md` or `radius-lg`. Shadow: `shadow-sm`.
- Padding: `space-4` (16px). Optional border: 1px `neutral-200` for “flat” variant.

### Tabs

- Underline or pill. Selected: border or bg `accent-500` (underline 2px) or pill bg `accent-50` + text `accent-700`.
- Unselected: text `neutral-500`; hover `neutral-700`. Font: `body-sm`, weight 500.

### Modals / bottom sheets

- **Modal:** Max-width 400px (paywall) or 480px. Radius `radius-lg`. Shadow `shadow-xl`. Backdrop `bg-overlay`.
- **Bottom sheet:** Full width, radius `radius-lg` top only (16px). Shadow `shadow-lg`. Backdrop same.
- Enter: opacity + translateY (modal) or translateY (sheet). Duration `duration-normal`, ease `ease-out`.

### Toast

- Min-width 280px; max-width 400px. Padding 12px 16px. Radius `radius-md`. Shadow `shadow-md`.
- Background `neutral-800` (dark) or `neutral-0` (light) with border. Text white or `neutral-800`.
- Icon: success/warn/error color. Enter: slide from top or bottom + fade; duration `duration-fast`.

### Skeleton

- Background: linear gradient 90deg, `neutral-200` 25%, `neutral-100` 50%, `neutral-200` 75%; background-size 200% 100%; animation shimmer 1.5s ease-in-out infinite.
- Radius: same as content (e.g. `radius-sm` for text lines, `radius-md` for cards).

### Pricing card

- Border 1px `neutral-200` or subtle shadow `shadow-sm`. Radius `radius-xl`. Padding `space-6`.
- Title: `font-size-h3`. Price: larger (e.g. 32px) + “/month” in `neutral-500`. List: `body-sm`, checkmark in `success-500`.
- CTA: primary button full width. Optional “Most popular” badge: `accent-50` bg, `accent-700` text, `radius-sm`.

### Locked overlay

- Overlay on media: linear gradient 180deg, transparent 30%, rgba(0,0,0,0.6) 100%. Or solid rgba(0,0,0,0.5).
- Lock icon: white, 24–32px. Text: white, `font-size-small` or `body-sm`, centered.
- Radius: match media (e.g. `radius-md`).

### Creator badge

- Pill: padding 4px 8px. Radius `radius-full`. Font `font-size-label`, weight 500, uppercase optional.
- Variants: “Subscriber” — `accent-50` bg, `accent-700` text. “Verified” — checkmark icon + “Verified” in `neutral-600`. “Top creator” — optional gold/amber tint.

---

## 8. CSS variables (flat list for implementation)

```css
/* Type — mobile */
--font-size-h1: 1.75rem;
--font-size-h2: 1.375rem;
--font-size-h3: 1.125rem;
--font-size-body: 1rem;
--font-size-body-sm: 0.875rem;
--font-size-small: 0.75rem;
--font-size-label: 0.6875rem;
--line-height-tight: 1.2;
--line-height-snug: 1.25;
--line-height-normal: 1.5;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;

/* Spacing (4pt grid) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;

/* Neutral */
--neutral-0: #FFFFFF;
--neutral-50: #FAFAF9;
--neutral-100: #F5F5F4;
--neutral-200: #E7E5E4;
--neutral-400: #A8A29E;
--neutral-500: #78716C;
--neutral-600: #57534E;
--neutral-700: #44403C;
--neutral-800: #292524;
--neutral-900: #1C1917;

/* Accent (example: indigo) */
--accent-50: #EEF2FF;
--accent-500: #6366F1;
--accent-600: #4F46E5;
--accent-700: #4338CA;

/* Semantic */
--success-500: #059669;
--success-bg: #ECFDF5;
--warn-500: #D97706;
--warn-bg: #FFFBEB;
--error-500: #DC2626;
--error-bg: #FEF2F2;

/* Background layers */
--bg-page: var(--neutral-50);
--bg-surface: var(--neutral-0);
--bg-muted: var(--neutral-100);
--bg-overlay: rgba(0,0,0,0.4);

/* Radii */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;

/* Shadows */
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.06);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06);
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);

/* Motion */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 9. Tailwind theme extension (snippet)

Add or merge into `theme.extend` in `tailwind.config.js`:

```js
// In tailwind.config.js theme.extend:
fontSize: {
  'h1': ['1.75rem', { lineHeight: '1.2', fontWeight: '600' }],
  'h2': ['1.375rem', { lineHeight: '1.25', fontWeight: '600' }],
  'h3': ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],
  'body': ['1rem', { lineHeight: '1.5' }],
  'body-sm': ['0.875rem', { lineHeight: '1.45' }],
  'small': ['0.75rem', { lineHeight: '1.4' }],
  'label': ['0.6875rem', { lineHeight: '1.35', fontWeight: '500' }],
},
spacing: {
  '18': '72px',
  '22': '88px',
  // ... keep default 4pt grid via spacing scale; override if needed
},
colors: {
  neutral: {
    0: 'var(--neutral-0)',
    50: 'var(--neutral-50)',
    100: 'var(--neutral-100)',
    200: 'var(--neutral-200)',
    400: 'var(--neutral-400)',
    500: 'var(--neutral-500)',
    600: 'var(--neutral-600)',
    700: 'var(--neutral-700)',
    800: 'var(--neutral-800)',
    900: 'var(--neutral-900)',
  },
  accent: {
    50: 'var(--accent-50)',
    500: 'var(--accent-500)',
    600: 'var(--accent-600)',
    700: 'var(--accent-700)',
  },
  success: { 500: 'var(--success-500)', bg: 'var(--success-bg)' },
  warn: { 500: 'var(--warn-500)', bg: 'var(--warn-bg)' },
  error: { 500: 'var(--error-500)', bg: 'var(--error-bg)' },
},
borderRadius: {
  'sm': 'var(--radius-sm)',
  'md': 'var(--radius-md)',
  'lg': 'var(--radius-lg)',
  'xl': 'var(--radius-xl)',
  'full': 'var(--radius-full)',
},
boxShadow: {
  'xs': 'var(--shadow-xs)',
  'sm': 'var(--shadow-sm)',
  'md': 'var(--shadow-md)',
  'lg': 'var(--shadow-lg)',
  'xl': 'var(--shadow-xl)',
},
transitionDuration: {
  'fast': 'var(--duration-fast)',
  'normal': 'var(--duration-normal)',
  'slow': 'var(--duration-slow)',
},
transitionTimingFunction: {
  'out': 'var(--ease-out)',
  'in': 'var(--ease-in)',
  'in-out': 'var(--ease-in-out)',
},
```

Use CSS variables in your global CSS so Tailwind and non-Tailwind components stay in sync. This doc + the snippet give a complete, “expensive”-feeling system you can implement directly in CSS variables and Tailwind.
