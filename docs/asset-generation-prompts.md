# Image Generation Prompts for `apps/web/public/`

Use these prompts with image generation tools (DALL·E, Midjourney, Stable Diffusion, etc.) to create high-quality photos for each directory. Save outputs with the exact filenames listed.

---

## 1. `public/brand/`

**Note:** The brand folder uses **SVGs** (logos, badges), not photos. Keep `zinovia-verified.svg` as-is—it's a "Validated by Zinovia Fans" verification badge overlay on creator content. No photo prompts needed unless you add new brand imagery.

**Optional additions:**

| Filename | Purpose | Prompt |
|----------|----------|--------|
| `favicon.svg` or `og-image.png` | OG/social share image | *Not covered—create separately if needed.* |
| `logo-light.png` | Light-mode logo (if needed) | Professional wordmark logo for "Zinovia Fans", creator subscription platform, modern sans-serif, pink-to-violet gradient accent, white/light background, 512×512px, PNG with transparency. |

---

## 2. `public/avatars/` — Creator avatar placeholders

Used for: placeholder avatars (creator-1, creator-2, creator-3). SVGs exist but can be replaced with photos for richer landing/demo UI.

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `creator-1.png` | 256×256 | Creative professional avatar | Portrait photo of a creative professional woman, shoulder-up, warm natural lighting, neutral background, confident expression, suitable for creator platform avatar, high resolution, professional headshot style. |
| `creator-2.png` | 256×256 | Creative professional avatar | Portrait photo of a creative professional man, shoulder-up, soft studio lighting, neutral gray background, friendly expression, suitable for creator platform avatar, high resolution, professional headshot style. |
| `creator-3.png` | 256×256 | Creative professional avatar | Portrait photo of a creative professional, androgynous or non-binary presenting, shoulder-up, soft diffused light, minimalist background, approachable expression, suitable for creator platform avatar, high resolution. |

**Style note:** Diverse, inclusive, professional. Avoid overly posed or stock-photo feel. Cohesive set (same lighting/background style across all three).

---

## 3. `public/preview/` — Hero and grid preview tiles

Contains `preview-1.svg`–`preview-6.svg` and `tile-1.svg`–`tile-9.svg`. Replace with photos for a more polished product preview.

### `preview/` — Hero/featured preview images (400×300 or 16:10)

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `preview-1.png` | 800×500 | Featured creator content teaser | Artistic lifestyle photo, creator workspace with laptop and warm light, aesthetic flat lay, soft pastels and cream tones, aspirational but authentic, suitable for subscription platform hero. |
| `preview-2.png` | 800×500 | Content variety | High-quality photo of exclusive digital content—e.g. behind-the-scenes, vlog setup, or creative studio moment—soft bokeh, warm accent lighting, premium feel. |
| `preview-3.png` | 800×500 | Creator-fan connection | Abstract or atmospheric image suggesting connection—e.g. hands on device, blurred audience, or shared moment—warm tones, emotional but not cheesy. |
| `preview-4.png` | 800×500 | Monetization/earnings | Clean visual suggesting success—e.g. laptop on desk with notifications, charts, or minimal financial imagery—professional, modern, aspirational. |
| `preview-5.png` | 800×500 | Community | Diverse group or community vibe—e.g. people in soft focus, event, or online community—warm, inclusive, contemporary. |
| `preview-6.png` | 800×500 | Exclusive content | Locked or exclusive content teaser—blurred premium content, subtle lock motif, pink/violet accent, subscription-platform feel. |

### `preview/` — Grid tiles (square, 600×600 or 800×800)

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `tile-1.png` | 600×600 | Creator post preview tile | Square lifestyle photo, creator-style content—e.g. outfit, makeup, or creative shot—soft natural light, aesthetic feed aesthetic, instagram-worthy. |
| `tile-2.png` | 600×600 | Creator post preview tile | Square photo, behind-the-scenes moment—studio, creative process, or personal space—warm tones, authentic feel. |
| `tile-3.png` | 600×600 | Creator post preview tile | Square photo, wellness or self-care aesthetic—e.g. yoga, skincare, cozy moment—soft lighting, aspirational but relatable. |
| `tile-4.png` | 600×600 | Creator post preview tile | Square photo, fashion or style content—outfit detail, accessories, or flat lay—clean composition, modern. |
| `tile-5.png` | 600×600 | Creator post preview tile | Square photo, travel or adventure—landscape, destination, or experience—vibrant but not oversaturated. |
| `tile-6.png` | 600×600 | Creator post preview tile | Square photo, food or lifestyle—coffee, brunch, or cozy scene—warm, inviting. |
| `tile-7.png` | 600×600 | Creator post preview tile | Square photo, fitness or workout—gym, outdoor run, or active moment—dynamic, energizing. |
| `tile-8.png` | 600×600 | Creator post preview tile | Square photo, art or craft—handmade work, creative project, or studio—artistic, textured. |
| `tile-9.png` | 600×600 | Creator post preview tile | Square photo, music or performance—instrument, stage, or recording—creative, moody lighting. |

**Style note:** Cohesive aesthetic across tiles—similar color temperature and mood. Suitable for a subscription/content creator platform grid. Avoid explicit or overly provocative imagery.

---

## 4. `public/creators/demo/` — Demo/fallback assets (actively used)

**Critical:** These are used when creators have no uploaded media. Must match the exact filenames and aspect ratios below.

### Avatars (circular crop in UI)

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `avatar_256.png` | 256×256 | Hero featured creators strip, testimonial cards, ProductPreview header | Same person as avatar_512—portrait, shoulder-up, warm natural lighting, neutral background, creative professional woman, confident expression, high resolution. |
| `avatar_512.png` | 512×512 | Creator profile page when no avatar uploaded | Same person as avatar_256, higher resolution—portrait, shoulder-up, warm natural lighting, neutral background, creative professional woman, confident expression, high resolution. |
| `avatar_1024.png` | 1024×1024 | Hi-DPI / large displays | Same person as avatar_512, maximum quality—portrait, shoulder-up, warm natural lighting, neutral background, creative professional woman, high resolution. |

**Important:** Use the **same person** across all three sizes for consistency. The 256 and 512 are shown in Hero, SocialProof, and ProductPreview.

### Banner (creator profile header)

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `banner_1500x500.png` | 1500×500 | Creator profile header (primary) | Wide horizontal banner, 3:1 aspect ratio, aesthetic creator header—soft gradient or abstract pattern, pink/violet/mauve tones matching brand, no text, suitable for profile cover, premium feel. |
| `banner_1200x400.png` | 1200×400 | Fallback / smaller displays | Same design as banner_1500x500, 3:1 aspect ratio—aesthetic creator header, soft gradient or abstract, pink/violet/mauve, premium. |

### Tiles (post grid previews)

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `tile_600.png` | 600×600 | Unlocked post tiles in ProductPreview grid (4 of 6 tiles) | Square lifestyle photo, creator-style content—aesthetic flat lay, soft natural light, outfit or creative moment, instagram-worthy, warm tones, suitable for subscription content preview. |
| `tile_800.png` | 800×800 | Larger tile variant | Same style as tile_600, higher resolution—square lifestyle photo, creator aesthetic, soft light, warm. |

### Locked content placeholder

| Filename | Size | Purpose | Prompt |
|----------|------|---------|--------|
| `locked_800.png` | 800×800 | Blurred “locked” post placeholder (first 2 tiles in ProductPreview) | Same composition as tile_600/tile_800 but suitable for “locked” overlay—attractive enough when slightly blurred, lifestyle/creator content, soft lighting, premium teaser feel. |

**Tip:** You can use the same image as `tile_600.png` for `locked_800.png`; the UI applies blur. Or create a slightly more “teaser” version.

---

## Summary: Directories and File Counts

| Directory | Files | Format | Notes |
|-----------|------|--------|-------|
| `brand/` | 1+ | SVG/PNG | Keep badge SVG; add logo/OG if needed |
| `avatars/` | 3 | PNG | 256×256, diverse creator headshots |
| `preview/` | 15 | PNG | 6 preview (800×500) + 9 tiles (600×600) |
| `creators/demo/` | 8 | PNG | Critical: exact filenames, used in production |

---

## Quick checklist

- [ ] `public/avatars/creator-1.png`, `creator-2.png`, `creator-3.png`
- [ ] `public/preview/preview-1.png` … `preview-6.png`
- [ ] `public/preview/tile-1.png` … `tile-9.png`
- [ ] `public/creators/demo/avatar_256.png`, `avatar_512.png`, `avatar_1024.png`
- [ ] `public/creators/demo/banner_1500x500.png`, `banner_1200x400.png`
- [ ] `public/creators/demo/tile_600.png`, `tile_800.png`
- [ ] `public/creators/demo/locked_800.png`

---

## Resize / optimization

After generation, you may need to resize to match dimensions. Tools: `sips` (macOS), `ImageMagick`, or online tools. For Next.js, consider WebP for smaller payloads where acceptable.
