# Zinovia Fans Design System

## Principles
- Light-first UI with premium clarity and high trust.
- Calm spacing, subtle shadows, and explicit hierarchy.
- One primary CTA and one secondary CTA per section.
- Accent color reserved for monetization moments (unlock/tip).

## Core Tokens
- `--bg`: `#F7F8FB`
- `--surface`: `#FFFFFF`
- `--surface-2`: `#F2F4F8`
- `--text`: `#0B0F1A`
- `--text-2`: `#4B5563`
- `--border`: `#E5E7EB`
- `--primary`: `#635BFF`
- `--primary-hover`: `#5148FF`
- `--accent`: `#FF4D6D`
- `--success`: `#10B981`
- `--warning`: `#F59E0B`
- `--danger`: `#EF4444`

## Radius, Shadows, Motion
- Rounded corners: `--radius-sm: 10px`, `--radius-md: 14px`, `--radius-lg: 18px`.
- Card shadow: soft depth only (`shadow-premium-sm` / `shadow-premium-md`).
- Animation timing: short and subtle (`duration-fast`, `duration-normal`).

## Spacing Scale
- Base spacing scale follows: `4 / 8 / 12 / 16 / 24 / 32 / 48`.

## Typography
- Display font for page-level headings.
- Sans for body and controls.
- High-contrast heading/body pairing for readability.

## Component Kit
- `Button`: `default` (primary), `secondary` (surface), `ghost`, `destructive`.
- `Card`: surface + border + subtle shadow.
- `Input` / `Textarea` / `Select`: clear focus state using primary ring.
- `Tabs`: low-noise segmented control.
- `Modal` / `Drawer`: soft overlays with visible close controls.
- `Badge`: neutral and accent variants for status and monetization cues.
- `Avatar`, `Skeleton`, `Toast`: standard loading and identity surfaces.
- `DropdownMenu`: user-menu and contextual actions.
- `Icon` wrapper: consistent icon sizing and alignment.

## Accessibility
- Focus-visible styles are always enabled.
- Contrast remains WCAG-friendly on primary text and controls.
- Skeleton placeholders are used to reduce layout shift during loading.

## Page Application
- `/`: hero glow, trust row, how-it-works, pricing.
- `/feed`: clean card feed, strong empty/error states.
- `/creators`: search-first discovery with safe filtering controls.
- `/creators/[handle]`: polished header + locked media conversion overlays.
- `/settings/profile`: grouped form sections with profile previews.
- `/login`, `/signup`, `/verify-email`, `/onboarding`: minimal, high-trust auth funnel.
- `/billing/success`, `/billing/cancel`: clear state and action recovery.
- `/messages*`: lighter inbox/chat surfaces with premium locked media cards.
