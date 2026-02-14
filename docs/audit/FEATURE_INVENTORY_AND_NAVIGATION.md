# Zinovia-Fans: Feature Inventory & Navigation Audit

**Date:** 2026-02-13  
**Updated:** 2026-02-13 (recheck)  
**Role:** Business Analyst  
**Scope:** All implemented features, navigation coverage, accessibility gaps

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| **Total user-facing pages** | 16 |
| **In main nav or footer** | 10 |
| **Reachable via flow only** | 5 |
| **Dev-only** | 1 |
| **Not in nav (onboarding)** | 1 |
| **Footer links missing href** | 4 |
| **Landing sections without CTAs** | 5 (TrustRow, SocialProof, FeatureGrid, TrustSafety, FAQSection) |

**Main gaps:**
1. **Creator Onboarding** (`/onboarding`) — No direct link in nav; only reachable via `login?next=/onboarding` (post email verification).
2. **Footer** — Help center, Contact, Privacy policy, Terms of service have no href.
3. **Hero featured creators** — Avatars do not link to creator profiles (placeholder handles: alex, jordan, sam).
4. **Ledger API** — Backend exists; no UI.
5. **Logout** — Client-side only (`setUser(null)`); no API call to clear session cookie.

---

## 2. Navigation Structure

### 2.1 Navbar (Header)

| Link | Label | Visible when | Route |
|------|-------|--------------|-------|
| Brand | Zinovia Fans | Always | `/` |
| Home | Home | Always | `/` |
| Feed | Feed | Always | `/feed` |
| Creators | Creators | Always | `/creators` |
| New post | New post | Logged in only | `/creator/post/new` |
| Settings | Settings | Logged in only | `/settings/profile` |
| Login | Login | Logged out | `/login` |
| Sign up | Sign up | Logged out | `/signup` |
| Avatar dropdown | — | Logged in | — |
| → Me | Me | Logged in (dropdown) | `/me` |
| → Settings | Settings | Logged in (dropdown) | `/settings/profile` |
| → Logout | Logout | Logged in (dropdown) | Client-side only; no API |

**Source:** `apps/web/components/app/Navbar.tsx`

---

### 2.2 Footer

| Link | Href | Status |
|------|------|--------|
| For creators | `/signup` | ✅ |
| For fans | `/feed` | ✅ |
| How it works | `#how-it-works` | ✅ |
| Pricing | `#pricing` | ✅ |
| Features | `#features` | ✅ |
| About | `/` | ✅ |
| Help center | — | ❌ No href |
| Contact | — | ❌ No href |
| Privacy policy | — | ❌ No href |
| Terms of service | — | ❌ No href |
| Refund policy | `#faq` | ✅ |

**Source:** `apps/web/components/landing/Footer.tsx`

---

### 2.3 Landing Page CTAs

| Section | CTA | Href |
|---------|-----|------|
| Hero | Start as creator | `/signup` |
| Hero | See how it works | `#how-it-works` |
| HowItWorks | Get started | `/signup` |
| PricingSection | Start as creator / Get started | `/signup` |
| PricingSection | Browse creators | `/feed` |

---

## 3. Feature List (Detailed)

### 3.1 Public / Marketing

| # | Feature | Route | Purpose | Nav/access |
|---|---------|-------|---------|------------|
| 1 | **Home / Landing** | `/` | Marketing: Hero, TrustRow, HowItWorks, SocialProof, FeatureGrid, PricingSection, TrustSafety, FAQSection, Footer | Nav: Home |
| 2 | **Feed** | `/feed` | Chronological feed of posts from followed/subscribed creators; requires auth for personalized feed | Nav: Feed; Footer: For fans |
| 3 | **Creators discovery** | `/creators` | Browse discoverable creators; cards link to `/creators/[handle]` | Nav: Creators |
| 4 | **Creator profile** | `/creators/[handle]` | Public creator page: bio, avatar, banner, posts, Subscribe CTA, Follow button, MediaGrid (paywalled cells) | From /creators; FeedCard; /c/[handle] redirect |
| 5 | **Legacy creator URL** | `/c/[handle]` | Redirect to `/creators/[handle]` | Direct URL or old links |

---

### 3.2 Authentication

| # | Feature | Route | Purpose | Nav/access |
|---|---------|-------|---------|------------|
| 6 | **Login** | `/login` | Email + password login; supports `?next=` redirect | Nav: Login (when logged out) |
| 7 | **Sign up** | `/signup` | Creator registration (email + password) | Nav: Sign up; Hero; Footer; Pricing |
| 8 | **Verify email** | `/verify-email` | Manual token entry (MVP, no email sending) | Flow: Sign up → redirect |
| 9 | **Logout** | — | Client-side: setUser(null). No API call; cookie may persist until expiry. | Avatar dropdown: Logout |

---

### 3.3 Creator Features

| # | Feature | Route | Purpose | Nav/access |
|---|---------|-------|---------|------------|
| 10 | **New post** | `/creator/post/new` | Create TEXT, IMAGE, or VIDEO post; visibility (public/followers/subscribers); NSFW toggle; media upload | Nav: New post (logged in) |
| 11 | **Profile settings** | `/settings/profile` | Edit handle, display name, bio, avatar, banner, discoverable, NSFW | Nav: Settings; Me page: Edit profile |
| 12 | **Me (Account)** | `/me` | View email, role; link to Edit profile | Avatar dropdown: Me |
| 13 | **Creator onboarding** | `/onboarding` | KYC status checklist; Start/Resume verification → KYC provider | **No nav link**; only `login?next=/onboarding` |
| 14 | **Mock KYC** | `/mock-kyc?session_id=...` | Staging: simulate KYC Approve/Reject | Flow: KYC session redirect |

---

### 3.4 Fan / Billing

| # | Feature | Route | Purpose | Nav/access |
|---|---------|-------|---------|------------|
| 15 | **Subscribe** | (modal) | SubscribeSheet on creator profile; Stripe Checkout | Creator profile: Subscribe button |
| 16 | **Billing success** | `/billing/success?return=...` | Post-checkout success; links: Go to feed, Back to creator (from return param) | Flow: Stripe redirect |
| 17 | **Billing cancel** | `/billing/cancel?return=...` | Checkout cancelled; default return `/creators`; links: Back to creator / Browse creators, Feed | Flow: Stripe redirect |

---

### 3.5 Developer / System

| # | Feature | Route | Purpose | Nav/access |
|---|---------|-------|---------|------------|
| 18 | **Debug** | `/debug` | Dev: theme swatches, API health check | **No link**; dev only; shows "only in development" in prod |
| 19 | **Error boundary** | (automatic) | Next.js error.tsx: "Something went wrong" + Try again | Shown on runtime errors; no nav |

---

## 3.6 Landing Page Sections (no standalone routes)

| Section | Id | Links |
|---------|-----|-------|
| Hero | — | Start as creator → `/signup`; See how it works → `#how-it-works` |
| TrustRow | — | None (static trust badges) |
| HowItWorks | `#how-it-works` | Get started → `/signup` |
| SocialProof | `#social-proof` | None (testimonials) |
| FeatureGrid | `#features` | None |
| PricingSection | `#pricing` | Per plan: `/signup` or `/feed` |
| TrustSafety | `#trust-safety` | None |
| FAQSection | `#faq` | None (accordion) |
| Footer | — | See §2.2 |

---

## 4. In-Page Links & Flows

| Source | Target | Context |
|--------|--------|---------|
| FeedCard | `/creators/[handle]` | Creator avatar/name on post |
| PostCard | `/creators/[handle]` | Creator link |
| Creators page | `/creators/[handle]` | Creator card |
| Creator profile | Subscribe → Stripe | Subscribe CTA |
| Creator profile | `/login` | Log in (when not authenticated) |
| Settings profile | `/` | Back to home |
| Creator profile | `/creators` | Back to creators |
| Feed | `/creators` | Discover creators (empty state) |
| New post | `/feed` | After publish |
| ImageUploadField | `/login` | When not authenticated |
| FollowButton | `/login` | When not authenticated |
| Billing success | `return` param or `/feed` | Post-checkout |
| Billing cancel | `return` param or `/creators` (default) | Post-checkout |

---

## 5. Features NOT in Navigation

| Feature | Route | How to reach | Recommendation |
|---------|-------|---------------|----------------|
| **Creator onboarding** | `/onboarding` | `login?next=/onboarding` after verify-email | Add "Complete verification" in Settings or Me when `!kyc_approved` |
| **Verify email** | `/verify-email` | Sign up redirect only | Flow-only; OK |
| **Mock KYC** | `/mock-kyc` | KYC provider redirect | Flow-only; staging only |
| **Billing success/cancel** | `/billing/*` | Stripe redirect | Flow-only; OK |
| **Debug** | `/debug` | Direct URL; dev only | No nav; OK for dev |
| **Me** | `/me` | Avatar dropdown only | Accessible but nested |

---

## 6. API Modules (Backend)

| Prefix | Purpose | UI |
|--------|---------|-----|
| `/auth` | Login, register, verify-email | Login, Signup, Verify email |
| `/onboarding` | Status | Onboarding page |
| `/kyc` | Session, status, mock-complete | Onboarding, Mock KYC |
| `/webhooks` | KYC provider callbacks | — |
| `/creators` | List, get by handle, me, update, posts | Creators, Profile, Settings |
| `/posts` | Create, list | New post, Creator profile |
| `/feed` | Personalized feed | Feed page |
| `/media` | Upload URL, download URL | ImageUpload, Creator profile, New post |
| `/billing` | Checkout subscription | SubscribeSheet, Billing success/cancel |
| `/ledger` | Ledger/transactions | **No UI** |

---

## 7. Accessibility Gaps (UX)

| Gap | Severity | Description |
|-----|----------|-------------|
| Onboarding not in nav | Medium | Creators who verified email but didn’t set `?next=/onboarding` have no obvious path to KYC |
| Footer placeholders | Low | Help center, Contact, Privacy, Terms are non-clickable |
| Hero featured creators | Low | Avatars don’t link to `/creators/[handle]` (handles are placeholder: alex, jordan, sam) |
| No mobile hamburger | Low | Navbar is same on mobile; may overflow on small screens |
| Ledger not exposed | Low | No earnings/payouts page for creators |
| Logout client-only | Low | No API call; session cookie persists until expiry or manual clear |

---

## 8. Recommendations

1. **Onboarding:** Add a "Complete verification" banner or link on `/me` or `/settings/profile` when `!kyc_approved`.
2. **Footer:** Add placeholder hrefs for Help center, Contact, Privacy, Terms (e.g. `/help`, `/contact`, `/privacy`, `/terms`) or remove until pages exist.
3. **Hero creators:** Wrap `CreatorAvatar` in `Link` to `/creators/[handle]` when real creators exist; or hide section until populated.
4. **Mobile nav:** Add a hamburger menu for small screens if links overflow.
5. **Ledger:** Add a Creator earnings/payouts page when product requires it.
6. **Logout:** Add `POST /auth/logout` (clear cookie) and call it from Navbar `handleLogout`.

---

*End of audit*
