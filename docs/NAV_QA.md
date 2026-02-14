# Navigation QA Checklist

## Scope
- Header (`apps/web/components/app/Navbar.tsx`)
- Mobile drawer navigation (`apps/web/components/ui/drawer.tsx`)
- Footer (`apps/web/components/app/Footer.tsx`)

## Checklist
- [x] Mobile menu opens from hamburger button on small screens.
- [x] Mobile menu closes via backdrop click.
- [x] Mobile menu closes via `Escape` key.
- [x] Mobile menu does not cause page scroll bleed while open.
- [x] Desktop links render without wrapping at common breakpoints.
- [x] Active link state is visible for current route.
- [x] Authed menu includes `Me`, `Settings`, `Messages`, `Logout`.
- [x] Logout attempts server endpoint (`/auth/logout`) and falls back to client clear.
- [x] Footer links route correctly: `/privacy`, `/terms`, `/contact`, `/help`.
- [x] No broken internal hrefs in header/footer navigation.

## Manual Verification Notes
- Validate at widths: `360`, `390`, `768`, `1024`, `1280`.
- Keyboard test:
  - `Tab` to hamburger and activate with `Enter`.
  - Navigate drawer links with `Tab`.
  - Close with `Escape`.
- Route smoke test:
  - `/`, `/feed`, `/creators`, `/messages`, `/settings/profile`, `/privacy`, `/terms`, `/contact`, `/help`.
