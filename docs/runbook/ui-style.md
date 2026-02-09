# UI style checklist

Quick visual checklist to verify the premium design system is applied.

## Brand foundation

- [ ] **Home hero**: Primary CTA uses brand gradient (purple/indigo), not flat gray.
- [ ] **Accents**: Links and focus rings use brand/accent color (visible on tab).
- [ ] **Surfaces**: Sections use subtle tinted surfaces (surface-2, brand-gradient-subtle), not plain gray.
- [ ] **Typography**: Headings use display font (Sora); body uses Inter.

## Key pages

- [ ] **Home**: Hero shows gradient CTA, featured creators row (3 avatars), product preview card with glass style.
- [ ] **Creators list** (`/creators`): Cards show avatar (with gradient ring), display name, handle, follower count, Follow button; not plain text list.
- [ ] **Creator profile** (`/creators/[handle]`): Banner has subtle brand tint; "Verified by Zinovia" badge; Subscribe button uses brand variant; posts grid shows real image thumbnails when posts have `asset_ids` (not gray boxes).
- [ ] **Feed** (`/feed`): Empty state has illustration placeholder and premium copy; error/unauthorized states use surface-2 and brand CTA; FeedCard has elevated shadow.

## Accessibility

- [ ] **Focus rings**: Tab through interactive elements; focus ring (brand ring) is visible.
- [ ] **Contrast**: Text on background meets sufficient contrast (foreground on background, muted-foreground on surface-2).

## Commands

- `make web-build` — must pass.
