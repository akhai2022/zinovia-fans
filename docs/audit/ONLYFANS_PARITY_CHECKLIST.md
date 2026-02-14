# OnlyFans Parity Checklist

**Date:** 2026-02-07  
**Role:** Product + Engineering Analyst  
**Scope:** Baseline feature coverage vs. OnlyFans-equivalent platform

---

## 1. Parity Score Summary

| Status | Count | Features |
|--------|-------|----------|
| **IMPLEMENTED** | 1 | Subscriptions (monthly) |
| **PARTIAL** | 4 | PPV paid posts, Likes + Comments, Creator earnings + payouts, Vault/media library |
| **MISSING** | 11 | PPV paid DMs, Tips, DMs, Notifications, Promotions, Mass messaging, Scheduled posts, Livestream, Analytics, Moderation/reporting |

**Total baseline items:** 16  
**Parity score:** 1/16 implemented, 4/16 partial ≈ **6% full parity**

---

## 2. Feature-by-Feature Table

| Feature | Status | Evidence | User flow | Missing pieces | Recommended next step |
|---------|--------|----------|-----------|----------------|----------------------|
| **Subscriptions (monthly)** | IMPLEMENTED | `apps/api/app/modules/billing/` (router, service, models), `apps/api/app/modules/billing/schemas.py`; DB: `creator_plans`, `subscriptions` (migration `0005_creator_plan_and_subscriptions.py`); Stripe Checkout + webhooks; `SubscribeSheet.tsx`, `PricingCard.tsx`, `/billing/success`, `/billing/cancel` | Fan: Creator profile → Subscribe → Stripe Checkout → success/cancel redirect | None | — |
| **PPV paid posts** | PARTIAL | Visibility-based paywall (PUBLIC / FOLLOWERS / SUBSCRIBERS) in `posts/models.py`, `posts/constants.py`; `LockedOverlay.tsx`, `MediaGrid.tsx` on creator profile; `posts/service.py` (`_can_see_post`). No `price` column on `Post` | Fan sees locked teaser for SUBSCRIBERS-only content; tap → Subscribe to unlock. No per-post purchase | `Post.price_cents`/`price_currency`; purchase flow for non-subscribers; Stripe one-time payment; webhook for PPV unlock | Add `price_cents` (nullable) to posts; implement `/posts/{id}/purchase` + Stripe PaymentIntent; unlock after payment |
| **PPV paid DMs (locked media in messages)** | MISSING | Design spec only: `docs/design/dms-feature-spec.md` (paid message bubbles). No `messages`, `conversations` tables or API | — | DMs system first; then locked media in messages with per-message price | Implement DMs (see below); then add `message_purchases` and locked-message unlock flow |
| **Tips (one-off payments)** | MISSING | No tips/tip endpoints; no `tips` table or Stripe one-time payment for creator | — | `tips` table; `/tips` or `/creators/{handle}/tip` API; Stripe PaymentIntent; ledger credit | Add `tips` table; `POST /creators/{handle}/tip` with amount; Stripe PaymentIntent; credit creator ledger |
| **DMs** | MISSING | Design spec: `docs/design/dms-feature-spec.md`. No `messages`, `conversations` tables; no `/messages` API; no inbox UI | — | `conversations`, `messages` tables; inbox + thread API; inbox + thread UI; message requests (accept/decline) | Add migrations; `GET/POST /messages`; inbox page at `/messages`; thread view |
| **Likes + Comments** | PARTIAL | UI buttons in `apps/web/features/posts/components/FeedCard.tsx` (Like, Comment, Share). All call `onActionComingSoon`; no backend | Fan: sees Like/Comment on feed; tap → "Coming soon" toast | `post_likes`, `post_comments` tables; `POST /posts/{id}/like`, `GET/POST /posts/{id}/comments`; persist and display counts | Add DB + API; wire buttons to API; show counts and comment list |
| **Notifications** | MISSING | No `notifications` table; no notification service or API; no bell/inbox for notifications | — | `notifications` table; create on subscribe, comment, like, DM; `GET /notifications`; bell icon + dropdown/page | Add migrations; notification model/service; API; nav bell + `/notifications` page |
| **Promotions/discounts/bundles** | MISSING | No promo codes, discount logic, or bundle tables. `creator_plans` has single `price` | — | `promo_codes` table; apply at checkout; Stripe coupon support; bundle logic if needed | Add `promo_codes`; optional `stripe_coupon_id`; apply in billing checkout |
| **Creator earnings + payouts** | PARTIAL | Ledger: `apps/api/app/modules/ledger/` (models, service, router); `ledger_entries`, `ledger_balances`; billing credits creator on `invoice.paid` (`billing/service.py:319–356`). No read API for creator; no UI; no payout method | Internal only: admin can create ledger entries; creator balance not exposed | Creator-facing `GET /ledger/balance` + `GET /ledger/entries`; earnings dashboard page; Stripe Connect (or bank details) for payouts | Add non-admin read for own balance; `/me/earnings` or `/creator/earnings` page; Stripe Connect onboarding |
| **Vault/media library** | PARTIAL | Media: `apps/api/app/modules/media/` (router, service, models); `media_assets`, `media_derived_assets`; `POST /media/upload-url`, `GET /media/{id}/download-url`. Used by posts via `ImageUploadField` | Creator: uploads media when creating post; no standalone vault | `GET /media` (list own assets); vault page at `/creator/vault` or `/creator/media`; reuse in post composer | Add `GET /media?owner=me`; create `/creator/vault` page with grid |
| **Mass messaging** | MISSING | Requires DMs; no DMs implemented | — | DMs first; then "Message all subscribers" or similar bulk send | Implement DMs; then add bulk-send to subscribers |
| **Scheduled posts** | MISSING | `posts.models.Post` has no `scheduled_at`/`publish_at`; design mentions it in `docs/design/feed-and-composer-spec.md` | — | `scheduled_at` on posts; worker to publish at time; composer "Schedule" UI | Add `scheduled_at`; cron/worker; composer schedule picker |
| **Livestream** | MISSING | No livestream module, RTMP, or video streaming infra | — | WebRTC/RTMP ingestion; streaming delivery; live chat | Out of MVP scope; defer or use third-party (e.g. Mux, LiveKit) |
| **Analytics** | MISSING | No analytics tables or endpoints; design mentions in `docs/design/landing-page-spec.md`, `docs/audit/CREATOR_WORKFLOW_COMPLIANCE.md` | — | Views, engagement metrics; `GET /creator/analytics`; chart UI | Add basic analytics: post views, subscription counts; dashboard page |
| **Moderation/reporting basics** | MISSING | TrustSafety copy: "Report and block anytime" (`TrustSafety.tsx:4`); no `reports`, `blocks` tables or API | — | `reports` table; `blocks` or block list; `POST /report`, `POST /block`; hide blocked content | Add `reports`, `user_blocks`; API; Report/Block actions in post/user menus |

---

## 3. Minimum to Claim OnlyFans-Equivalent

The smallest set of **missing** features that block parity:

1. **DMs** — Core fan–creator interaction; required for mass messaging and PPV paid DMs.
2. **PPV paid posts** — Per-post purchase (not just subscription-gated); major revenue stream.
3. **Tips** — One-off payments; expected monetization.
4. **Creator earnings dashboard + payout method** — Creators need to see earnings and add bank/Stripe Connect.
5. **Likes + Comments** — Engagement; currently placeholder.
6. **Moderation/reporting basics** — Report and block; trust & safety baseline.

**Optional but recommended for parity:**

- PPV paid DMs (depends on DMs).
- Mass messaging (depends on DMs).
- Notifications (improves engagement).
- Promotions/discounts (improves conversion).
- Scheduled posts (creator workflow).
- Vault UI (media management).
- Analytics (creator insights).

---

## 4. Evidence Index

| Module | Path | Purpose |
|--------|------|---------|
| Billing | `apps/api/app/modules/billing/` | Subscriptions, Stripe Checkout, webhooks |
| Posts | `apps/api/app/modules/posts/` | Posts, visibility, paywall logic |
| Media | `apps/api/app/modules/media/` | Upload, download, derived variants |
| Ledger | `apps/api/app/modules/ledger/` | Internal balances; billing credits creators |
| Creators | `apps/api/app/modules/creators/` | Profiles, follow |
| Feed | `apps/api/app/modules/posts/router.py` (feed_router) | Chronological feed |
| DM design | `docs/design/dms-feature-spec.md` | DM spec (not implemented) |
| Composer design | `docs/design/feed-and-composer-spec.md` | Scheduled posts mentioned |
| Feature inventory | `docs/audit/FEATURE_INVENTORY_AND_NAVIGATION.md` | Nav, ledger not exposed |

---

*End of OnlyFans Parity Checklist*
