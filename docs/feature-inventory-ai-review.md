# Zinovia.ai — Feature Inventory & AI Capabilities Review

**Version:** 1.1
**Date:** 2026-02-21
**Status:** Internal / Compliance Review
**Audience:** Internal team, payment processor underwriting, compliance reviewers

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Full Feature Inventory (Non-AI)](#2-full-feature-inventory-non-ai)
3. [AI Feature Inventory (Implemented)](#3-ai-feature-inventory-implemented)
4. [AI Feature Inventory (Planned / Roadmap)](#4-ai-feature-inventory-planned--roadmap)
5. [Content Safety & Compliance Controls](#5-content-safety--compliance-controls)
6. [Infrastructure Overview](#6-infrastructure-overview)
7. [Appendix](#7-appendix)
8. [Underwriting Addendum](#8-underwriting-addendum--paywall-security--safety-controls)

---

## 1. Executive Summary

- **Product**: Zinovia.ai is a creator monetization platform where creators publish exclusive content behind subscriptions and per-post pay-per-view (PPV) paywalls. Fans subscribe, tip, unlock content, and communicate via direct messages.
- **Users served**: Creators (content publishers with KYC-verified identities) and Fans (subscribers/consumers of creator content).
- **Monetization**: Three revenue streams — monthly subscriptions (recurring via CCBill), per-post PPV unlocks (one-time via CCBill), and tips (one-time via CCBill). Platform takes a configurable fee (default 10%).
- **Payment processor**: CCBill FlexForms (redirect-based hosted checkout). No card data touches our servers. All payment events are processed via authenticated webhooks with HMAC-SHA256 verification.
- **Safety & compliance posture**: All creators must complete KYC (identity verification) before publishing. Uploaded images are scanned by an AI safety pipeline (NSFW classifier + underage-likelihood proxy) with a three-tier decision engine (ALLOW / REQUIRE_REVIEW / BLOCK). Flagged content is held for human admin review before any enforcement action.
- **What AI does**: (a) Classifies uploaded images for NSFW content and proxy age signals; (b) generates caption suggestions for creator uploads; (c) auto-tags images and generates semantic embeddings for search. All models run on CPU in isolated Celery workers; no GPU required.
- **What AI does NOT do**: AI never makes final moderation decisions autonomously — all REQUIRE_REVIEW and BLOCK decisions require human admin review before enforcement. AI does not determine exact age — it produces a proxy likelihood signal based on facial appearance only. AI does not generate user-facing content without creator opt-in. AI has no access to payment data, passwords, or PII beyond the uploaded image pixels.
- **Currency:** Default transaction currency is EUR. The platform supports multi-currency via CCBill (USD, EUR, GBP, AUD, CAD, JPY). Creators set their subscription currency in their plan (defaults to EUR). PPV and tip amounts use the post/message currency or fall back to the platform default. All internal ledger amounts are stored in cents with an explicit `currency` column.
- **Data handling**: Media stored in S3 with signed URLs (time-limited access). PostgreSQL for structured data. Redis for task queuing only (no persistent data). All secrets in AWS Secrets Manager. TLS everywhere in production.
- **Availability**: Three-service architecture on ECS Fargate (API, Web, Worker) with auto-scaling, health checks, and CloudWatch alerting. WAF protection available (activated with HA mode).

---

## 2. Full Feature Inventory (Non-AI)

### 2.1 Fans / Customers

#### 2.1.1 Fan Registration & Login

| Field | Detail |
|-------|--------|
| **Purpose** | Allow fans to create accounts and access the platform |
| **UI location** | `/signup` (fan tab), `/login` |
| **User flow** | 1. Fan selects "Fan" on signup page → 2. Enters email, password (min 10 chars), display name, date of birth → 3. System validates age ≥ 18 → 4. Verification email sent → 5. Fan clicks link in email → 6. Auto-logged in, redirected to `/feed` |
| **Key data** | `users` table (id, email, password_hash, role='fan', signup_ip, last_login_ip, date_of_birth, device_info) |
| **Audit trail** | `audit_events`: ACTION_SIGNUP, ACTION_LOGIN, ACTION_LOGOUT, ACTION_VERIFY_EMAIL |
| **Evidence** | Screenshot: signup form with age gate; login page; verification email; feed after login |

#### 2.1.2 Password Management

| Field | Detail |
|-------|--------|
| **Purpose** | Secure password reset and change flows |
| **UI location** | `/forgot-password`, `/reset-password`, `/settings/security` |
| **User flow (reset)** | 1. Enter email on forgot-password → 2. Receive reset link → 3. Enter new password (min 10 chars) → 4. Logged in |
| **User flow (change)** | 1. Go to Settings > Security → 2. Enter current password + new password → 3. Strength meter validates → 4. Saved |
| **Key data** | `users.password_reset_token`, `users.password_reset_expires` |
| **Audit trail** | `audit_events`: ACTION_PASSWORD_RESET, ACTION_PASSWORD_CHANGE |
| **Evidence** | Screenshot: forgot-password page; reset-password page; change-password form with strength meter |

#### 2.1.3 Browse & Discover Creators

| Field | Detail |
|-------|--------|
| **Purpose** | Let fans find and explore creators |
| **UI location** | `/creators` (discovery grid), `/` (featured creators section) |
| **User flow** | 1. Visit `/creators` → 2. Browse grid of discoverable creators (24 per page) → 3. Search by name/handle → 4. Click creator card → 5. View profile at `/creators/{handle}` |
| **Key data** | `profiles` (handle, display_name, bio, avatar, verified, discoverable, nsfw), `follows` |
| **Audit trail** | N/A (read-only) |
| **Evidence** | Screenshot: creators discovery page with search; creator profile with stats |

#### 2.1.4 Creator Profile View

| Field | Detail |
|-------|--------|
| **Purpose** | View creator content, bio, stats, and subscription options |
| **UI location** | `/creators/{handle}` |
| **User flow** | 1. View avatar, banner, bio, follower/post counts → 2. See online status indicator → 3. See subscription price → 4. Subscribe/Follow/Message buttons → 5. Scroll posts (locked teasers for non-subscribers) |
| **Key data** | `profiles`, `posts`, `subscriptions`, `follows` |
| **Audit trail** | N/A (read-only) |
| **Evidence** | Screenshot: creator profile with locked content overlay and subscribe CTA |

#### 2.1.5 Subscription Checkout (CCBill)

| Field | Detail |
|-------|--------|
| **Purpose** | Subscribe to a creator's content for recurring monthly access |
| **UI location** | Subscribe button on creator profile → redirects to CCBill hosted form |
| **User flow** | 1. Click "Subscribe" on creator profile → 2. `POST /billing/checkout/subscription` returns CCBill redirect URL → 3. Fan completes payment on CCBill → 4. CCBill redirects to `/billing/success` → 5. System polls `/billing/status` to confirm entitlement → 6. Access unlocked |
| **Key data** | `subscriptions` (fan_user_id, creator_user_id, status, ccbill_subscription_id, renew_at), `payment_events`, `creator_plans`, `ledger_events` |
| **Audit trail** | `payment_events` (full webhook payload stored on first receipt; UNIQUE constraint on `event_id` prevents duplicate processing via atomic UPSERT; replayed webhooks return HTTP 200 with `"duplicate_ignored"` and produce no side effects), `ledger_events` (gross/fee/net breakdown) |
| **Evidence** | Screenshot: subscribe button; CCBill checkout page; success confirmation page; active subscription in manage page |

#### 2.1.6 PPV Post Unlock

| Field | Detail |
|-------|--------|
| **Purpose** | One-time purchase to unlock a specific pay-per-view post |
| **UI location** | Lock overlay on PPV post in feed or creator profile |
| **User flow** | 1. See locked PPV post with price badge → 2. Click "Unlock" → 3. `POST /ppv/posts/{id}/create-intent` returns CCBill URL → 4. Complete payment → 5. Webhook creates `post_purchases` record → 6. Content unlocked |
| **Key data** | `post_purchases` (purchaser_id, post_id, amount_cents, ccbill_transaction_id, status), `posts` (price_cents, currency) |
| **Audit trail** | `payment_events`, `ledger_events` (type=PPV_POST) |
| **Evidence** | Screenshot: locked post overlay with price; unlocked post after purchase; purchase in billing history |

#### 2.1.7 PPV Message Media Unlock

| Field | Detail |
|-------|--------|
| **Purpose** | Unlock locked media attachments in direct messages |
| **UI location** | Locked media in DM conversation thread |
| **User flow** | 1. Creator sends locked media in DM → 2. Fan sees blur + price → 3. Click unlock → 4. `POST /ppv/message-media/{id}/create-intent` → 5. CCBill checkout → 6. Media unlocked |
| **Key data** | `ppv_purchases` (purchaser_id, message_media_id, amount_cents, status), `message_media` (is_locked, price_cents) |
| **Audit trail** | `payment_events`, `ledger_events` (type=PPV_MESSAGE) |
| **Evidence** | Screenshot: locked message media; unlocked media after purchase |

#### 2.1.8 Tipping

| Field | Detail |
|-------|--------|
| **Purpose** | Send one-time tips to creators |
| **UI location** | Tip button in DM conversation or creator profile |
| **User flow** | 1. Click tip → 2. Enter amount (min 100 cents / ~€1, max 1,000,000 cents / ~€10,000) → 3. `POST /payments/tips/create-intent` → 4. CCBill checkout → 5. Tip recorded |
| **Key data** | `tips` (tipper_id, creator_id, amount_cents, ccbill_transaction_id, status) |
| **Audit trail** | `payment_events`, `ledger_events` (type=TIP) |
| **Evidence** | Screenshot: tip flow; tip in purchase history |

#### 2.1.9 Feed

| Field | Detail |
|-------|--------|
| **Purpose** | Personalized content feed from followed/subscribed creators |
| **UI location** | `/feed` (authenticated) |
| **User flow** | 1. Login → 2. View feed of posts from followed creators → 3. Infinite scroll (cursor-paginated, 20 per page) → 4. Locked posts appear as teasers (blurred) → 5. Click to view, like, comment |
| **Key data** | `posts`, `post_media`, `subscriptions`, `follows` |
| **Audit trail** | N/A |
| **Evidence** | Screenshot: feed with mix of unlocked and locked posts |

#### 2.1.10 Direct Messages

| Field | Detail |
|-------|--------|
| **Purpose** | Private 1:1 messaging between fans and creators |
| **UI location** | `/messages` (inbox), `/messages/{conversationId}` (thread) |
| **User flow** | 1. Click "Message" on creator profile → 2. Creates/opens conversation → 3. Send text or media messages → 4. Real-time message list (cursor-paginated) |
| **Key data** | `conversations` (creator_user_id, fan_user_id), `messages` (sender_id, text, message_type), `message_media` |
| **Audit trail** | N/A (messages stored in DB) |
| **Evidence** | Screenshot: message inbox; conversation thread |

#### 2.1.11 Notifications

| Field | Detail |
|-------|--------|
| **Purpose** | Notify users of engagement events |
| **UI location** | `/notifications` |
| **User flow** | 1. Receive notification (follow, like, comment, message, subscription, tip, PPV unlock) → 2. See unread count badge → 3. Click to mark read → 4. "Mark all read" option |
| **Key data** | `notifications` (user_id, type, payload_json, read_at) |
| **Audit trail** | Notification records are persistent |
| **Evidence** | Screenshot: notification list with unread badges |

#### 2.1.12 Post Search

| Field | Detail |
|-------|--------|
| **Purpose** | Search posts by caption text |
| **UI location** | `/search` |
| **User flow** | 1. Enter search query → 2. Results from full-text search (pg_trgm GIN index) → 3. Paginated results with creator info |
| **Key data** | `posts` (caption, trigram index) |
| **Audit trail** | N/A |
| **Evidence** | Screenshot: search results page |

#### 2.1.13 Purchase History & Receipts

| Field | Detail |
|-------|--------|
| **Purpose** | View all past purchases and payment status |
| **UI location** | `/billing/purchases` |
| **User flow** | 1. Navigate to purchase history → 2. See table: date, type (PPV/tip/subscription), creator, status, amount → 3. Status badges: Completed, Pending, Canceled, Refunded, Disputed → 4. Expandable receipt detail |
| **Key data** | `post_purchases`, `ppv_purchases`, `tips`, `subscriptions`, `ledger_events` |
| **Audit trail** | `payment_events` (full CCBill payload) |
| **Evidence** | Screenshot: purchase history table with status badges |

#### 2.1.14 Subscription Management

| Field | Detail |
|-------|--------|
| **Purpose** | View and cancel active subscriptions |
| **UI location** | `/billing/manage` |
| **User flow** | 1. View active/past subscriptions → 2. See status, renewal date → 3. Click "Cancel" → 4. Subscription set to cancel at period end (grace period honored) |
| **Key data** | `subscriptions` (status, cancel_at_period_end, current_period_end) |
| **Audit trail** | `payment_events` (Cancellation webhook) |
| **Evidence** | Screenshot: subscription list with cancel button; canceled subscription showing end date |

#### 2.1.15 Follow / Unfollow Creators

| Field | Detail |
|-------|--------|
| **Purpose** | Follow creators to see their posts in feed |
| **UI location** | Follow button on creator profile |
| **User flow** | 1. Click "Follow" → 2. `POST /creators/{id}/follow` → 3. Creator appears in following list → 4. Posts appear in feed |
| **Key data** | `follows` (fan_user_id, creator_user_id) |
| **Audit trail** | `notifications` (NEW_FOLLOWER to creator) |
| **Evidence** | Screenshot: follow button states; following list |

#### 2.1.16 Contact / Support

| Field | Detail |
|-------|--------|
| **Purpose** | Allow users to reach support |
| **UI location** | `/contact` page, footer links, error pages |
| **User flow** | 1. Submit contact form (`POST /contact`, rate-limited) → 2. Or email support@zinovia.ai directly → 3. Inbound emails auto-categorized and visible in admin dashboard |
| **Key data** | `inbound_emails` (from_address, subject, category, text_body) |
| **Audit trail** | `inbound_emails` table with SPF/DKIM verification |
| **Evidence** | Screenshot: contact page with form; help/FAQ page |

#### 2.1.17 Help / FAQ

| Field | Detail |
|-------|--------|
| **Purpose** | Self-service answers to common questions |
| **UI location** | `/help` |
| **User flow** | FAQ accordion with common questions (profile changes, content reporting, billing, account deletion) |
| **Key data** | Static content |
| **Evidence** | Screenshot: help page with accordion items |

#### 2.1.18 Account Settings

| Field | Detail |
|-------|--------|
| **Purpose** | View and manage account information |
| **UI location** | `/me`, `/settings/profile`, `/settings/security` |
| **User flow** | View email/role → Edit profile (creators) → Change password |
| **Key data** | `users`, `profiles` |
| **Evidence** | Screenshot: settings pages |

---

### 2.2 Creators

#### 2.2.1 Creator Registration & Onboarding

| Field | Detail |
|-------|--------|
| **Purpose** | Register as a creator with verified identity |
| **UI location** | `/signup` (creator tab), `/onboarding`, `/kyc/verify` |
| **User flow** | 1. Select "Creator" on signup → 2. Enter email, password, display name, date of birth (18+) → 3. Verify email → 4. Redirected to `/onboarding` → 5. Start KYC session → 6. Complete identity verification (selfie + document) → 7. KYC approved → 8. Set up profile → 9. Create first post |
| **Onboarding states** | CREATED → EMAIL_VERIFIED → KYC_PENDING → KYC_SUBMITTED → KYC_APPROVED (or KYC_REJECTED) |
| **Key data** | `users` (onboarding_state, explicit_intent), `kyc_sessions` (provider, status, redirect_url), `email_verification_tokens` |
| **Audit trail** | `onboarding_audit_events` (state transitions), `audit_events` (ACTION_SIGNUP, ACTION_VERIFY_EMAIL) |
| **Evidence** | Screenshot: creator signup; onboarding checklist; KYC form; approved state |

#### 2.2.2 KYC (Know Your Customer)

| Field | Detail |
|-------|--------|
| **Purpose** | Verify creator identity before allowing content publication |
| **UI location** | `/onboarding` (start), `/kyc/verify` (selfie + date-of-birth capture) |
| **User flow** | 1. `POST /kyc/session` creates idempotent session → 2. Creator completes identity steps → 3. `POST /kyc/complete` → 4. Webhook confirms approval/rejection → 5. State updated |
| **Key data** | `kyc_sessions` (creator_id, provider, status, raw_webhook_payload) |
| **Audit trail** | `onboarding_audit_events`, idempotency via `idempotency_keys` table |
| **Evidence** | Screenshot: KYC flow steps; approved KYC status on onboarding page |

#### 2.2.3 Creator Profile Management

| Field | Detail |
|-------|--------|
| **Purpose** | Configure public profile, avatar, banner, handle, and discoverability |
| **UI location** | `/settings/profile` |
| **User flow** | 1. Upload avatar (required) + optional banner → 2. Set handle (unique, 2-64 chars) → 3. Display name, bio → 4. Phone number (required) → 5. Country selection → 6. Toggle discoverable / NSFW flags → 7. Save |
| **Key data** | `profiles` (handle, display_name, bio, avatar_asset_id, banner_asset_id, discoverable, nsfw, verified) |
| **Audit trail** | N/A (update timestamps) |
| **Evidence** | Screenshot: profile edit form; public profile preview |

#### 2.2.4 Content Posting & Media Upload

| Field | Detail |
|-------|--------|
| **Purpose** | Publish photos, videos, and text posts with visibility controls |
| **UI location** | `/creator/post/new` |
| **User flow** | 1. Select media type (images 1-20, or video 1) → 2. Upload via signed S3 URL (progress bar) → 3. Write caption (with optional AI suggestions) → 4. Choose visibility: PUBLIC / FOLLOWERS / SUBSCRIBERS / PPV → 5. If PPV: set price (€1-€200) → 6. Toggle NSFW flag → 7. Optional: schedule for later → 8. Publish |
| **Media processing** | Upload triggers Celery tasks: derive variants (thumb 200px, grid 600px, full 1200px), compute blurhash + dominant color, optional watermark, optional AI safety scan |
| **Post types** | PHOTO, VIDEO, TEXT, CAROUSEL |
| **Visibility levels** | PUBLIC (anyone), FOLLOWERS_ONLY, SUBSCRIPTION_REQUIRED, FOLLOW_REQUIRED |
| **Key data** | `posts` (creator_user_id, type, caption, visibility, nsfw, price_cents, currency, status), `post_media` (post_id, media_asset_id, position), `media_assets` (object_key, content_type, size_bytes, blurhash, safety_status), `media_derived_assets` (variant, object_key) |
| **Audit trail** | `audit_events`: ACTION_MEDIA_UPLOADED |
| **Evidence** | Screenshot: post creation form; media upload progress; published post in feed |

#### 2.2.5 Subscription Plan Management

| Field | Detail |
|-------|--------|
| **Purpose** | Set and update monthly subscription price |
| **UI location** | `/settings/profile` (pricing section) |
| **User flow** | 1. Enter monthly price (min €2.99, max €499.99) → 2. See platform fee % → 3. Save → 4. Existing subscribers keep current rate until renewal |
| **Key data** | `creator_plans` (creator_user_id, price, currency, active) |
| **Evidence** | Screenshot: pricing section in profile settings |

#### 2.2.6 Media Vault

| Field | Detail |
|-------|--------|
| **Purpose** | Store and manage all uploaded media for reuse across posts |
| **UI location** | `/creator/vault` |
| **User flow** | 1. View all uploaded media (infinite scroll) → 2. Filter by type (images/videos) → 3. Preview in modal → 4. Delete unused media → 5. Select from vault when creating posts |
| **Key data** | `media_assets` (owner_user_id, object_key, content_type, size_bytes) |
| **Audit trail** | `audit_events`: ACTION_MEDIA_DELETED |
| **Evidence** | Screenshot: vault grid with filter tabs |

#### 2.2.7 Collections

| Field | Detail |
|-------|--------|
| **Purpose** | Organize posts into themed collections |
| **UI location** | `/creator/collections`, `/creator/collections/new`, `/creator/collections/{id}` |
| **User flow** | 1. Create collection (title, description, visibility, cover image) → 2. Add posts to collection → 3. Reorder posts → 4. Edit/delete collections |
| **Key data** | `collections` (title, description, cover_asset_id, visibility, position), `collection_posts` (collection_id, post_id, position) |
| **Evidence** | Screenshot: collections list; collection detail with posts |

#### 2.2.8 Earnings Dashboard

| Field | Detail |
|-------|--------|
| **Purpose** | View revenue summary and transaction history |
| **UI location** | `/creator/earnings` |
| **User flow** | 1. View 30-day summary cards (gross, fees, net) → 2. See payout method status → 3. Browse recent transactions table (type, gross, fee, net) |
| **Key data** | `ledger_events` (creator_id, type, gross_cents, fee_cents, net_cents), `ledger_entries`, `ledger_balances` |
| **Evidence** | Screenshot: earnings dashboard with summary cards and transaction table |

#### 2.2.9 Direct Messages (Creator Side)

| Field | Detail |
|-------|--------|
| **Purpose** | Communicate with fans, send locked media |
| **UI location** | `/messages` |
| **User flow** | 1. View conversation inbox → 2. Open thread → 3. Send text or media → 4. Optionally lock media with price (PPV message) |
| **Key data** | `conversations`, `messages`, `message_media` (is_locked, price_cents) |
| **Evidence** | Screenshot: creator DM interface with locked media option |

#### 2.2.10 Scheduled Posts

| Field | Detail |
|-------|--------|
| **Purpose** | Schedule posts for future publication |
| **UI location** | `/creator/post/new` (schedule toggle) |
| **User flow** | 1. Create post → 2. Toggle "Schedule" → 3. Pick date/time → 4. Post saved as SCHEDULED → 5. Celery beat task (`posts.publish_due_scheduled`) publishes every minute |
| **Feature flag** | `ENABLE_SCHEDULED_POSTS` (default: false) |
| **Key data** | `posts` (publish_at, status=SCHEDULED) |
| **Evidence** | Screenshot: schedule toggle with datetime picker |

#### 2.2.11 AI Image Studio

| Field | Detail |
|-------|--------|
| **Purpose** | Generate avatar, banner, or hero images using AI |
| **UI location** | `/ai/images`, `/ai/images/new`, `/ai/images/{id}` |
| **User flow** | 1. Select image type (hero/avatar/banner) → 2. Set subject, vibe, accent color → 3. Submit → 4. Worker calls Replicate API → 5. Poll status until READY → 6. Apply to profile or landing page |
| **Key data** | `ai_image_jobs` (user_id, status, image_type, prompt, result_object_keys), `brand_assets` |
| **Evidence** | Screenshot: generation form; result preview; applied avatar |

---

### 2.3 Admin / Moderation / Support

#### 2.3.1 Admin Dashboard

| Field | Detail |
|-------|--------|
| **Purpose** | Manage users, creators, posts, and transactions |
| **UI location** | `/admin` (requires `role="admin"` or `"super_admin"`) |
| **User flow** | 1. View paginated user list (10/page) → 2. Filter by role/discoverable/featured/verified → 3. Search by email → 4. Take actions on users |
| **Key data** | All user/profile/post/transaction tables |
| **Audit trail** | Admin actions logged in `audit_events` |
| **Evidence** | Screenshot: admin dashboard with user list and action buttons |

#### 2.3.2 User/Creator Actions

| Field | Detail |
|-------|--------|
| **Purpose** | Approve, reject, feature, suspend, verify, or delete users |
| **Actions** | approve, reject, feature, unfeature, suspend, activate, verify, unverify, delete (soft-delete: role="deleted", is_active=False, discoverable=False) |
| **Key data** | `users` (role, is_active), `profiles` (discoverable, verified) |
| **Audit trail** | `audit_events` with actor_id, action, resource_type, resource_id |
| **Evidence** | Screenshot: action buttons on admin user row; user status after action |

#### 2.3.3 Post Moderation

| Field | Detail |
|-------|--------|
| **Purpose** | Review and moderate published posts |
| **Endpoints** | `GET /admin/posts`, `POST /admin/posts/{id}/action` (approve, reject, remove, feature, unfeature) |
| **Key data** | `posts` (status) |
| **Audit trail** | `audit_events` |
| **Evidence** | Screenshot: post list in admin; action buttons |

#### 2.3.4 Transaction Monitoring

| Field | Detail |
|-------|--------|
| **Purpose** | View all platform transactions |
| **Endpoints** | `GET /admin/transactions` (filter by type: subscription, tip, ppv, refund) |
| **Key data** | `payment_events`, `ledger_events`, `subscriptions`, `tips`, `post_purchases`, `ppv_purchases` |
| **Evidence** | Screenshot: transaction list with type filters |

#### 2.3.5 AI Safety Review Queue

| Field | Detail |
|-------|--------|
| **Purpose** | Review content flagged by AI safety scanner |
| **UI location** | `/admin` (moderation tab) |
| **User flow** | 1. View pending reviews list → 2. See risk level (HIGH=red, MEDIUM=amber), NSFW score, age proxy score → 3. Approve or Reject → 4. Decision recorded with admin ID and timestamp |
| **Endpoints** | `GET /ai-safety/admin/pending-reviews`, `POST /ai-safety/admin/review/{scan_id}` |
| **Key data** | `image_safety_scans` (reviewed_by, reviewed_at, review_decision) |
| **Audit trail** | `image_safety_scans` records admin reviewer identity and timestamp |
| **Evidence** | Screenshot: pending reviews list; approve/reject buttons; reviewed item |

#### 2.3.6 Inbound Email Management

| Field | Detail |
|-------|--------|
| **Purpose** | View and manage support/privacy/legal emails |
| **UI location** | Admin dashboard |
| **User flow** | 1. Inbound emails auto-ingested via Resend webhook → 2. Auto-categorized (support, privacy, creators, safety, legal) → 3. Admin views list → 4. Click to read (auto-marks read) → 5. Manual sync available |
| **Key data** | `inbound_emails` (from_address, subject, category, text_body, spf_result, dkim_result) |
| **Evidence** | Screenshot: inbound email list with categories |

#### 2.3.7 Manual Onboarding Recovery

| Field | Detail |
|-------|--------|
| **Purpose** | Recover stuck onboarding (e.g., email delivery failures) |
| **Endpoints** | `GET /admin/tokens?email=...` (retrieve verification tokens), `POST /admin/force-verify-email?email=...` (bypass email delivery) |
| **Key data** | `email_verification_tokens` |
| **Evidence** | Screenshot: admin force-verify action |

---

### 2.4 Platform-Wide Features

#### 2.4.1 Internationalization (i18n)

| Field | Detail |
|-------|--------|
| **Languages** | English, Spanish, French, German, Portuguese, Turkish, Romanian, Polish, Italian (9 total) |
| **Implementation** | `useTranslation()` hook, locale stored in `zinovia_locale` cookie |
| **UI** | Language switcher in navbar |

#### 2.4.2 Online Presence Indicator

| Field | Detail |
|-------|--------|
| **Purpose** | Show when creators are currently online |
| **Implementation** | `last_activity_at` updated on every authenticated request (debounced 60s). `is_online` computed as `(now - last_activity_at) < 5 minutes`. Green dot shown on avatar when online, gray when offline. |
| **Key data** | `users.last_activity_at` |

#### 2.4.3 Legal Pages

| Page | URL |
|------|-----|
| Terms of Service | `/terms` |
| Privacy Policy | `/privacy` |
| About | `/about` |
| How It Works | `/how-it-works` |
| Help / FAQ | `/help` |
| Contact | `/contact` |
| Pricing | `/pricing` |

---

## 3. AI Feature Inventory (Implemented)

### 3.1 AI Safety Image Scan

| Field | Detail |
|-------|--------|
| **Feature name** | AI Safety Image Scan |
| **Purpose** | Content safety — automatically classify uploaded images for NSFW content and proxy age signals to prevent prohibited content |
| **Category** | Safety / Compliance |
| **Feature flag** | `ENABLE_AI_SAFETY` (default: `false` in API settings; Terraform default: `true`) |

**Trigger**: Enqueued as Celery task when any image is uploaded via `POST /media/upload-url` (if `ENABLE_AI_SAFETY=true`).

**Inputs**:
- Raw image bytes from S3 (the uploaded file), converted to RGB PIL Image
- `asset_id`, `object_key`, `content_type` (routing metadata only — not passed to models)
- **Input minimization:** The ML models receive ONLY decoded pixel data. No EXIF metadata, no user PII (email, name, DOB), no KYC data, no payment information, and no profile data is passed to any model. The `asset_id` is used solely to record results in the database — it is not a model input.
- **No biometric identification:** The age-range proxy classifier (`nateraw/vit-age-classifier`) is a standard image-classification model. It does NOT perform facial recognition, does NOT extract or store biometric templates, does NOT produce a faceprint, and does NOT identify individuals. It outputs a probability distribution over age-range buckets based on general visual features. No biometric data (as defined under GDPR Article 9, BIPA, or CCPA) is processed or stored.

**Processing — Models & Tasks**:

| Model | HuggingFace ID | Task | Output | CPU viable | Where loaded |
|-------|----------------|------|--------|------------|--------------|
| NSFW Classifier | `Falconsai/nsfw_image_detection` | image-classification | `nsfw_score` (0-1), `nsfw_label` (nsfw/normal) | Yes (CPU, device=-1) | Celery worker only |
| Age-Range Proxy | `nateraw/vit-age-classifier` | image-classification (ViT) | `age_range_prediction` (e.g., "20-29"), `underage_likelihood_proxy` (0-1) | Yes (CPU, device=-1) | Celery worker only |

**Inference isolation:** All ML model inference runs exclusively in the Celery worker container. The API container does not include `torch`, `transformers`, or `sentence-transformers` in its dependencies and cannot load models. For the semantic search endpoint (`GET /ai-safety/search`), the API dispatches a synchronous Celery task (`ai_safety.embed_query`) to the worker and waits up to 10 seconds for the result via `task.get(timeout=10)`. If the worker is unavailable or times out, search falls back to keyword matching with zero model dependency in the API process. This architecture ensures ML inference load does not affect API request latency or stability.

**Policy Decision Engine** (`compute_policy_decision`):

| Decision | Condition | Risk Level | Action |
|----------|-----------|------------|--------|
| **BLOCK** | `underage_proxy ≥ 0.6` AND `nsfw_score ≥ 0.85` | HIGH | **HOLD state**: `safety_status = "blocked"`. Media is quarantined — not served to any non-owner user. Awaits mandatory admin review. No autonomous enforcement. |
| **REQUIRE_REVIEW** | `underage_proxy ≥ 0.6` (alone) | HIGH | **HOLD state**: `safety_status = "review"`. Media is quarantined — not served to any non-owner user. Awaits mandatory admin review. No autonomous enforcement. |
| **REQUIRE_REVIEW** | `underage_proxy ≥ 0.3` AND `nsfw_score ≥ 0.5` | MEDIUM | **HOLD state**: `safety_status = "review"`. Same quarantine behavior as above. |
| **ALLOW** | All other cases | LOW | `safety_status = "allowed"`. Media may be served normally. Chains caption + tag generation tasks. |

**Definition — HOLD state:** When a safety scan produces a BLOCK or REQUIRE_REVIEW decision, the media asset enters a HOLD state. In this state: (a) the media owner (uploader) can still view their own asset; (b) no other user can obtain a download URL for this asset via the media access control layer; (c) the asset remains in HOLD until an admin explicitly sets `review_decision` to APPROVED or REJECTED. The AI system does NOT autonomously remove, delete, or permanently block content — all final decisions require a human admin action recorded with the admin's user ID and timestamp.

Thresholds are configurable via environment variables:
- `AI_SAFETY_NSFW_BLOCK_THRESHOLD` (default: 0.85)
- `AI_SAFETY_MINOR_HIGH_THRESHOLD` (default: 0.6)
- `AI_SAFETY_MINOR_MED_THRESHOLD` (default: 0.3)

**Outputs — Storage Schema**:

Table: `image_safety_scans`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Scan record ID |
| media_asset_id | UUID (FK, unique) | 1:1 link to uploaded media |
| nsfw_score | Float | NSFW confidence (0-1) |
| nsfw_label | String(32) | "nsfw" or "normal" |
| age_range_prediction | String(32) | Predicted range (e.g., "20-29") |
| underage_likelihood_proxy | Float | Sum of probabilities for age ranges < 20 |
| risk_level | String(16) | LOW, MEDIUM, HIGH |
| decision | String(16) | ALLOW, REQUIRE_REVIEW, BLOCK |
| model_versions | JSONB | `{"nsfw": "Falconsai/nsfw_image_detection", "age": "nateraw/vit-age-classifier"}` |
| reviewed_by | UUID (FK, nullable) | Admin who reviewed |
| reviewed_at | DateTime (nullable) | Review timestamp |
| review_decision | String(16, nullable) | APPROVED or REJECTED (admin override) |
| created_at | DateTime | Scan timestamp |

Additionally, `media_assets.safety_status` column (String(16), nullable) is updated: "allowed", "review", "blocked".

**Privacy & Retention**:
- Only image pixel data is processed; no EXIF metadata is extracted or stored by the classifier
- Scan results stored indefinitely (compliance audit trail)
- Original images follow S3 lifecycle policy (configurable, default 90 days)
- Models run entirely within Celery worker container — no external API calls for safety scanning

**Failure Modes & Safe Defaults**:
- If scan task fails: retries up to 3 times (30s delay). If all retries fail, `safety_status` remains `NULL` (unscanned) — content is not auto-published without scan in safety-required flows
- If NSFW model fails to load: task fails, logged, retried
- If age model fails to load: task fails, logged, retried
- Idempotent: skips processing if scan record already exists for media_asset_id

**Feature Flag Control**:
- `ENABLE_AI_SAFETY=false` (default): scan tasks are not enqueued; media uploads proceed without safety check
- Rollout plan: Enable in staging first → monitor false-positive rate → enable in production with admin review queue active
- Configured in Terraform: `enable_ai_safety = true` (default). Env var set on API, Web, and Worker task definitions

**User-Facing UX**:
- Creators see no direct indication of the scan (it runs asynchronously in background)
- If content is BLOCKED/REQUIRE_REVIEW, the media's `safety_status` is set accordingly; the admin review queue surfaces it
- Creators can query their scan results via `GET /ai-safety/media/{media_id}/scan`

**Admin-Facing Review Workflow**:
1. Admin navigates to moderation tab in `/admin`
2. Sees list of pending reviews (paginated, 20/page)
3. Each item shows: risk level badge (red=HIGH, amber=MEDIUM), NSFW score %, age range, underage proxy %, asset ID, timestamp
4. Admin clicks "Approve" → `review_decision=APPROVED`, `safety_status="allowed"`
5. Admin clicks "Reject" → `review_decision=REJECTED`, `safety_status="blocked"`
6. All review actions are permanently recorded with admin user ID and timestamp

**Metrics to Monitor**:
- Scan task latency (p50, p95, p99)
- Scan queue depth (Celery)
- Decision distribution (ALLOW vs REQUIRE_REVIEW vs BLOCK per day)
- False positive rate (admin overrides of REQUIRE_REVIEW → APPROVED)
- Model inference time per image
- Worker memory usage (PyTorch on CPU)

**Evidence for Payment Processor**:
- Screenshot: admin pending review queue with risk badges
- Screenshot: approve/reject action and recorded decision
- Log excerpt: scan task completion with decision + scores
- Schema: `image_safety_scans` table DDL
- Policy engine code showing threshold logic

---

### 3.2 AI Caption Suggestions

| Field | Detail |
|-------|--------|
| **Feature name** | AI Caption Suggestions |
| **Purpose** | Creator productivity — generate 3 caption variants from uploaded images to help creators write engaging post captions |
| **Category** | Creator Productivity |
| **Feature flag** | Chained from AI Safety Scan (runs only if scan decision = ALLOW) |

**Trigger**: Automatically chained as Celery task after `ai_safety.scan_image` completes with decision == "ALLOW".

**Inputs**:
- Image bytes from S3 (same image that was safety-scanned)
- `asset_id`, `object_key`, `content_type`

**Processing — Model**:

| Model | HuggingFace ID | Task | CPU viable | Where loaded |
|-------|----------------|------|------------|--------------|
| BLIP Image Captioning | `Salesforce/blip-image-captioning-base` | image-to-text | Yes (CPU) | Celery worker only |

Pipeline:
1. Download image from S3
2. Process with BLIP processor → tensors
3. Generate caption (`model.generate(max_new_tokens=50)`)
4. Derive 3 variants:
   - `caption_short`: ~15 words (truncated at sentence boundary)
   - `caption_medium`: ~30 words
   - `caption_promo`: "Check out this amazing content: {caption_short}"

**Outputs — Storage Schema**:

Table: `image_captions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Caption record ID |
| media_asset_id | UUID (FK, unique) | 1:1 link to media |
| caption_short | Text | ~15 word description |
| caption_medium | Text | ~30 word description |
| caption_promo | Text | Promotional variant |
| raw_caption | Text | Full model output |
| model_version | String(128) | "Salesforce/blip-image-captioning-base" |
| created_at | DateTime | Generation timestamp |

**Privacy & Retention**:
- Only image pixels processed; no user PII used
- Captions stored indefinitely alongside media
- No captions are auto-published — creator must explicitly select one

**Failure Modes & Safe Defaults**:
- If task fails: retries up to 2 times (30s delay). Post creation is not blocked by caption failure
- Idempotent: skips if caption already exists for media_asset_id

**User-Facing UX** (CaptionSuggestions component):
1. On post creation page, after image upload
2. "Suggest Caption" button appears
3. Click → fetches `GET /ai-safety/media/{mediaAssetId}/captions`
4. Shows 3 clickable caption variants (short, medium, promo)
5. Creator clicks one → populates caption textarea
6. Creator can edit freely before publishing
7. Loading skeleton shown during fetch; error message if unavailable

**Admin-Facing**: None (captions are creator-facing only)

**Metrics to Monitor**:
- Caption generation latency
- Caption adoption rate (% of posts where AI caption was selected)
- Task failure rate

**Evidence for Payment Processor**:
- Screenshot: CaptionSuggestions component on post creation form
- Screenshot: 3 caption variants with select buttons

---

### 3.3 Auto Tags & Semantic Embeddings

| Field | Detail |
|-------|--------|
| **Feature name** | Auto Tags & Semantic Search |
| **Purpose** | Content discovery — extract keyword tags from captions and generate vector embeddings for semantic media search |
| **Category** | Discovery / Search |
| **Feature flag** | Chained from AI Safety Scan (runs only if scan decision = ALLOW, after caption generation) |

**Trigger**: Automatically chained as Celery task after `ai_safety.generate_caption` completes (which itself chains from `scan_image` with ALLOW decision).

**Inputs**:
- `raw_caption` from `image_captions` table (text, not the image itself)
- `asset_id`

**Processing — Models**:

| Model | HuggingFace ID | Task | CPU viable | Where loaded |
|-------|----------------|------|------------|--------------|
| Sentence Transformer | `sentence-transformers/all-MiniLM-L6-v2` | text-to-embedding | Yes (CPU) | Celery worker only |

Pipeline:
1. Fetch `raw_caption` from `image_captions` table
2. Extract tags: split words → lowercase → remove punctuation → filter (length ≥ 3, alphabetic, not in English stopwords) → deduplicate → cap at 20 tags
3. Encode caption text with SentenceTransformer → 384-dimensional embedding vector
4. Store tags as JSONB list + embedding as JSONB array
5. If pgvector extension available: also store as native `vector(384)` column for cosine similarity search

**Outputs — Storage Schema**:

Table: `image_tags`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Tags record ID |
| media_asset_id | UUID (FK, unique) | 1:1 link to media |
| tags | JSONB | List of keyword strings (max 20) |
| embedding_json | JSONB | 384-dim vector as JSON array (fallback) |
| embedding | vector(384) | pgvector column (optional, non-fatal if unavailable) |
| model_version | String(128) | "sentence-transformers/all-MiniLM-L6-v2" |
| created_at | DateTime | Generation timestamp |

**Search Endpoint**: `GET /ai-safety/search?q={query}&limit=20`
- If pgvector available: synchronously calls worker `ai_safety.embed_query` (10s timeout) → cosine similarity search (`1 - (embedding <=> query_vec)`)
- Fallback: keyword matching against tags JSONB (score = matched keywords / total keywords)
- Returns: list of media items with relevance scores and search mode ("vector" or "keyword")

**Privacy & Retention**:
- Only caption text processed (derived from image, no PII)
- Tags/embeddings stored indefinitely
- Embeddings are numerical vectors — not reversible to original content

**Failure Modes & Safe Defaults**:
- If tag task fails: retries 2 times. Search simply won't find that media
- If pgvector unavailable: migration uses SAVEPOINT (non-fatal), falls back to JSONB + keyword search
- If `embed_query` times out (10s): search returns empty results

**User-Facing UX**:
- SemanticSearch component (`features/search/SemanticSearch.tsx`) integrated into creator Media Vault (`/creator/vault`)
- Search bar with debounced input (400ms) → results grid with relevance scores → click opens preview modal

**Admin-Facing**: Tags visible via `GET /ai-safety/media/{id}/tags`

**Metrics to Monitor**:
- Tag generation latency
- Embedding generation latency
- Search query latency (vector vs keyword)
- pgvector availability status

**Evidence for Payment Processor**:
- Screenshot: tags data in API response
- Schema: `image_tags` table DDL

---

## 4. AI Feature Inventory (Planned / Roadmap)

### 4.1 Smart Previews (Thumbnails + Blur Teaser + Watermark)

| Field | Detail |
|-------|--------|
| **Feature name** | Smart Previews |
| **Purpose** | Creator productivity — auto-generate optimized thumbnails, blur teasers for locked content, and configurable watermarks |
| **Category** | Media Processing / Creator Productivity |
| **Effort estimate** | **S** (Small) — most infrastructure already exists |

**Current State**: Partial implementation exists:
- Derived variants (thumb, grid, full) already generated via `media.generate_derived_variants` task
- Watermark infrastructure exists (configurable via `MEDIA_WATERMARK_*` env vars: text, opacity, position, size, include creator handle)
- Blurhash + dominant color already computed
- Blur teaser overlay already rendered in frontend (`LockedOverlay` component)

**Remaining Work**:
- Smart crop (face-detection based) for thumbnails — OpenCV Haar cascades already in worker dependencies
- Teaser variant generation (blurred, low-res preview stored as derived asset)
- Watermark applied to teaser variants specifically

**Trigger**: Part of `media.generate_derived_variants` Celery task chain (already exists)

**Inputs**: Original uploaded image bytes

**Processing**: CPU-based image processing (Pillow + OpenCV, no ML model inference)

**Outputs**: Additional derived asset variants stored in `media_derived_assets` table

**Dependencies**:
- CloudFront CDN for efficient delivery of derived variants (currently disabled — `enable_cloudfront=false`)
- S3 storage for variant files

**Risk Notes**:
- Face detection for smart crop is basic (Haar cascades, not deep learning) — may produce suboptimal crops for some content types
- Watermark configuration already exists but must be enabled (`MEDIA_WATERMARK_ENABLED=true`)

**Rollout Checklist**:
- [ ] Enable CloudFront CDN for derived asset delivery
- [ ] Implement face-detection smart crop in `generate_derived_variants`
- [ ] Add "teaser" variant to derived assets pipeline
- [ ] Enable watermark settings in production Terraform
- [ ] QA: verify thumbnails, teasers, watermarks across content types
- [ ] Monitor: variant generation latency, S3 storage growth

---

### 4.2 Promo Copy Generator

| Field | Detail |
|-------|--------|
| **Feature name** | Promo Copy Generator |
| **Purpose** | Creator productivity — generate promotional text (social media posts, link previews) from post content using templates + NLP heuristics |
| **Category** | Creator Productivity |
| **Effort estimate** | **M** (Medium) |

**Design Approach**: Template-based text generation with NLP tokenization — no heavy LLM inference.

**Trigger**: On-demand (creator clicks "Generate promo" button on published post)

**Inputs**:
- Post caption text
- Post media captions (from AI-generated captions if available)
- Creator handle / display name
- Post type and visibility

**Processing**:
- Template library (pre-written promotional templates for different post types)
- NLP keyword extraction (reuse existing tag extraction logic from `all-MiniLM-L6-v2`)
- Template slot filling with extracted keywords and creator info
- No external API calls — CPU-only, runs synchronously or via Celery

**Outputs**:
- 2-3 promotional text variants (short for Twitter/X, medium for Instagram, long for email/blog)
- Stored in new table or JSONB column on posts

**Storage Schema** (proposed):

Table: `post_promo_copy` (new)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Record ID |
| post_id | UUID (FK) | Post reference |
| variant | String(32) | "short", "medium", "long" |
| text | Text | Generated promo text |
| created_at | DateTime | Generation time |

**Dependencies**:
- Existing `sentence-transformers/all-MiniLM-L6-v2` model (already loaded in worker)
- Template library (new, needs content writing)

**Risk Notes**:
- Template quality determines output quality (no creative LLM generation)
- Must avoid generating misleading or policy-violating promotional text
- Templates must be reviewed for compliance before rollout

**Rollout Checklist**:
- [ ] Design template library (5-10 templates per post type)
- [ ] Implement promo generation service
- [ ] Add `post_promo_copy` migration
- [ ] Frontend: "Generate promo" button on post detail/edit
- [ ] QA: verify output quality across post types
- [ ] Review templates for compliance

---

### 4.3 Auto-Translate Captions (FR/ES/AR)

| Field | Detail |
|-------|--------|
| **Feature name** | Auto-Translate Captions |
| **Purpose** | Discovery — automatically translate post captions to French, Spanish, and Arabic to expand audience reach |
| **Category** | Discovery / Internationalization |
| **Effort estimate** | **L** (Large) — requires new model, significant testing |

**Design Approach**: CPU-only translation using HuggingFace translation models, processed asynchronously via Celery.

**Trigger**: Async Celery task chained after post creation (or on-demand)

**Inputs**:
- Post caption text (source language auto-detected or assumed English)

**Processing** (proposed models):

| Model | HuggingFace ID | Languages | CPU viable | Size |
|-------|----------------|-----------|------------|------|
| Helsinki-NLP/opus-mt-en-fr | `Helsinki-NLP/opus-mt-en-fr` | EN→FR | Yes | ~300MB |
| Helsinki-NLP/opus-mt-en-es | `Helsinki-NLP/opus-mt-en-es` | EN→ES | Yes | ~300MB |
| Helsinki-NLP/opus-mt-en-ar | `Helsinki-NLP/opus-mt-en-ar` | EN→AR | Yes | ~300MB |

Alternative: `facebook/mbart-large-50-many-to-many-mmt` (single model, multi-language, but ~2.4GB — may be too large for CPU worker alongside existing models).

**Outputs**: Translated captions stored alongside original

**Storage Schema** (proposed):

Table: `post_translations` (new)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Record ID |
| post_id | UUID (FK) | Post reference |
| language | String(8) | "fr", "es", "ar" |
| caption | Text | Translated caption |
| model_version | String(128) | Model ID |
| created_at | DateTime | Generation time |

**Dependencies**:
- Worker container must download additional models (~900MB for 3 Helsinki-NLP models)
- Worker memory increase may be needed (currently 2GB; may need 4GB with all models loaded)

**Risk Notes**:
- **Performance**: CPU translation is slow (~1-5s per caption per language). Batch processing required.
- **Quality**: Helsinki-NLP models are adequate for short text but may struggle with slang, creator-specific language
- **Arabic RTL**: Frontend must handle right-to-left text rendering
- **Memory**: 3 additional models (~900MB) added to worker's existing ~1.76GB model cache
- **Policy**: Translated content must carry clear "auto-translated" label to avoid misleading users

**Rollout Checklist**:
- [ ] Benchmark CPU translation latency on target hardware
- [ ] Add Helsinki-NLP models to worker Dockerfile pre-download
- [ ] Implement `translate_caption` Celery task
- [ ] Add `post_translations` migration
- [ ] Frontend: language tab on post view showing available translations
- [ ] Add "Auto-translated" label/disclaimer
- [ ] Handle Arabic RTL in frontend
- [ ] Increase worker memory allocation if needed
- [ ] QA: translation quality review across content types
- [ ] Monitor: translation latency, queue depth, memory usage

---

## 5. Content Safety & Compliance Controls

### 5.1 Paywall Enforcement & Media Delivery

**Security invariant:** Unauthorized users CANNOT obtain original or full-resolution media. Access is enforced server-side at the API layer, not by client-side blur or obfuscation.

**Mechanism:**

| Layer | Control |
|-------|---------|
| **Variant-level gating** | Media exists in multiple derived variants: `thumb` (200px), `grid` (600px), `teaser` (blurred), `full` (1200px), and original. Unauthorized users may only request variants in the `TEASER_VARIANTS` set (`thumb`, `grid`, `teaser`). Requests for `full` or original from unauthorized users return HTTP 404. |
| **Server-side access check** | Every call to `GET /media/{id}/download-url` invokes `can_user_access_media()` (authenticated) or `can_anonymous_access_media()` (unauthenticated). These functions verify subscription status, purchase status (`PostPurchase.status == "SUCCEEDED"`), follow relationship, or ownership before issuing a signed URL. |
| **Denial response** | Unauthorized requests return HTTP 404 (not 403), preventing resource enumeration. |
| **Signed URL TTL** | S3 presigned URLs expire after `MEDIA_URL_TTL_SECONDS` (default: 900s / 15 min). CloudFront signed URLs expire after `CLOUDFRONT_URL_TTL_SECONDS` (default: 600s / 10 min). Expired URLs return HTTP 403 from S3/CloudFront. |
| **Locked post teasers** | For posts the viewer cannot access, the API returns a teaser payload: `is_locked=true`, `locked_reason` (e.g., "SUBSCRIPTION_REQUIRED"), `price_cents`, `currency`, and `media_previews` (blurhash + dominant color for placeholder rendering). The caption is withheld (`caption: null`). Asset IDs are included so the frontend can request teaser-variant thumbnails only. |
| **Subscription validation** | `is_active_subscriber()` checks `Subscription.status` is `active` or `past_due` within the configurable grace period (`SUBSCRIPTION_GRACE_PERIOD_HOURS`, default 72h), AND `current_period_end > now`. |
| **PPV validation** | `PostPurchase.status == "SUCCEEDED"` is required. Pending or failed purchases do not grant access. |

**Recommendation (not yet implemented):** Set `Cache-Control: no-store, no-cache, must-revalidate` on S3 objects for original and `full` variants to prevent CDN or browser caching of paywalled originals. Teaser variants (`thumb`, `grid`) may use short cache TTLs (`max-age=300`).

### 5.2 Prohibited Content Policy Enforcement Points

Content is checked at multiple enforcement points throughout the platform:

| Enforcement Point | Mechanism | When |
|-------------------|-----------|------|
| **Registration** | Age gate (date of birth ≥ 18 years) | Fan and creator signup |
| **KYC** | Identity verification with selfie + document | Before creator can publish |
| **Upload** | File type + size validation (25MB image, 200MB video) | `POST /media/upload-url` |
| **AI Safety Scan** | NSFW + age-proxy classification → ALLOW / REQUIRE_REVIEW / BLOCK | Async after image upload (when enabled) |
| **Admin Review** | Human review of flagged content | Before BLOCK/REQUIRE_REVIEW is enforced or overridden |
| **Post Creation** | NSFW flag (creator self-classification) | `POST /posts` |
| **Admin Moderation** | Post approve/reject/remove actions | Reactive, admin-initiated |
| **User Actions** | Suspend, delete (soft-delete) users | Admin dashboard |
| **Rate Limiting** | Per-user and per-IP rate limits on all sensitive actions | API middleware |
| **WAF** | AWS WAF rules (SQL injection, XSS, rate limiting 2000 req/IP) | ALB / CloudFront |

### 5.2 Minor-Risk Mitigation Approach

The platform employs a **multi-layered approach** to mitigate the risk of content involving minors:

1. **Age gate at registration**: All users must provide date of birth. Anyone under 18 is rejected at signup.

2. **Creator KYC**: Every creator must complete identity verification (government ID + selfie) before they can publish any content. KYC status is tracked through explicit states (CREATED → EMAIL_VERIFIED → KYC_PENDING → KYC_SUBMITTED → KYC_APPROVED).

3. **AI proxy signal (not age determination, not biometric identification)**: The `nateraw/vit-age-classifier` model produces an `underage_likelihood_proxy` score — this is a **proxy signal based on general visual features only**. It is explicitly NOT a definitive age determination. The model does NOT perform facial recognition, does NOT extract biometric templates, and does NOT identify individuals. No biometric data is processed or retained. The score represents the sum of predicted probabilities for age ranges under 20.

4. **Human review required**: When the proxy signal exceeds thresholds (≥ 0.3 with moderate NSFW, or ≥ 0.6 alone), the content is flagged for REQUIRE_REVIEW or BLOCK. **No automated enforcement occurs** — a human admin must explicitly approve or reject every flagged item.

5. **Conservative thresholds**: The BLOCK threshold requires BOTH high underage proxy (≥ 0.6) AND high NSFW confidence (≥ 0.85). Thresholds are configurable and can be tightened.

6. **Audit trail**: Every scan result, every admin review decision, and the identity of the reviewing admin are permanently recorded in the `image_safety_scans` table.

### 5.3 Audit Logs & Admin Actions

**Audit Events Table** (`audit_events` — immutable, append-only):

| Column | Purpose |
|--------|---------|
| timestamp | When the action occurred |
| actor_id | Which user performed the action |
| action | Action type (see below) |
| resource_type | Target entity type |
| resource_id | Target entity ID |
| metadata_json | Additional context |
| ip_address | Request IP |

**Tracked Actions**:
- `ACTION_LOGIN`, `ACTION_LOGOUT`
- `ACTION_SIGNUP`
- `ACTION_VERIFY_EMAIL`
- `ACTION_PASSWORD_CHANGE`, `ACTION_PASSWORD_RESET`
- `ACTION_MEDIA_UPLOADED`, `ACTION_MEDIA_DELETED`
- Admin actions on users/posts (approve, reject, suspend, delete, verify, feature)

**Onboarding Audit** (`onboarding_audit_events`):
- Tracks every KYC state transition with from_state, to_state, and payload

**Payment Events** (`payment_events`):
- Full CCBill webhook payload stored for every transaction event
- Idempotent by event_id (prevents duplicate processing)

**AI Safety Scans** (`image_safety_scans`):
- Permanent record of every scan with scores, decision, and model versions
- Admin review identity and timestamp recorded

### 5.4 Data Minimization & Access Controls

| Principle | Implementation |
|-----------|---------------|
| **Minimal PII collection** | Only email, password, display name, date of birth, optional phone/country. No SSN, no financial data on our servers |
| **Payment data isolation** | All card data handled by CCBill (PCI-compliant processor). We never see or store card numbers |
| **Signed URLs** | All media access via time-limited signed URLs (S3: 15 min default, CloudFront: 10 min). No permanent public URLs |
| **Role-based access** | Fan, Creator, Admin, Super Admin roles with endpoint-level authorization checks |
| **Admin-only endpoints** | All `/admin/*` and `/ai-safety/admin/*` endpoints require `role="admin"` or `"super_admin"` |
| **Media ownership** | Creators can only access their own media (vault, scan results, captions, tags). Fans access content through subscription/purchase checks |
| **Secrets management** | All credentials in AWS Secrets Manager (JWT secret, CSRF secret, CCBill keys, API keys). Never in code or environment files |
| **Database access** | RDS only accessible from ECS task security group. No public endpoint |
| **Redis access** | ElastiCache only accessible from ECS task security group. Encryption at rest enabled |
| **Soft deletion** | User deletion is soft (role="deleted", is_active=False) — preserves audit trail while removing access |

**Data Retention Defaults:**

| Data Category | Active Retention | After Deletion | Notes |
|---------------|-----------------|----------------|-------|
| **Original media (S3)** | Indefinite (while account active) | S3 lifecycle: configurable, default 90 days (`media_lifecycle_days`) | Set to 0 to disable auto-expiration |
| **Derived variants (S3)** | Same as original | Same as original | Deleted with parent via cascade |
| **Safety scan records** | Indefinite | Indefinite | Immutable audit trail; required for compliance |
| **Audit events** | Indefinite | Indefinite | Immutable, append-only; never deleted |
| **Payment events** | Indefinite | Indefinite | Full webhook payloads; required for chargeback defense |
| **Ledger events** | Indefinite | Indefinite | Financial records |
| **User PII (DB)** | While account active | Soft-deleted: `role="deleted"`, `is_active=false`. Personal data retained for audit/legal obligations. Full erasure available on request (manual process via `privacy@zinovia.ai`). | 30-day erasure commitment per FAQ |
| **Captions & tags** | While media exists | Cascade-deleted with parent `media_assets` record | No standalone retention |
| **Inbound emails** | Indefinite | N/A | Support correspondence |
| **Idempotency keys** | 24 hours | Auto-expired via `expires_at` column | Cleanup via scheduled task |

These are platform defaults. Specific retention periods may be adjusted per jurisdiction upon legal review.

### 5.5 Customer Support Escalation Paths

| Email | Purpose | Routing |
|-------|---------|---------|
| `support@zinovia.ai` | General support, billing questions, technical issues | Auto-categorized as "support" in inbound emails |
| `privacy@zinovia.ai` | Privacy requests, data deletion, GDPR/CCPA inquiries | Auto-categorized as "privacy" |
| `legal@zinovia.ai` | Legal inquiries, DMCA takedowns, disputes | Auto-categorized as "legal" |
| `safety@zinovia.ai` | Content safety reports, abuse reports | Auto-categorized as "safety" |

All inbound emails are:
1. Received via Resend inbound MX record
2. Verified (SPF, DKIM)
3. Auto-categorized by recipient address
4. Stored in `inbound_emails` table
5. Visible in admin dashboard with read/unread status

### 5.6 Webhook Security Controls

All external webhooks are authenticated and deduplicated:

| Webhook Source | Verification | Idempotency | Replay Handling |
|----------------|-------------|-------------|-----------------|
| **CCBill** (`POST /billing/webhooks/ccbill`) | MD5 digest: `MD5(subscriptionId + flag + salt)` verified against `responseDigest` parameter. Salt stored in AWS Secrets Manager. | Atomic UPSERT on `payment_events.event_id` (UNIQUE constraint). Event ID format: `"{event_type}:{transactionId}"`. PostgreSQL `ON CONFLICT DO NOTHING` prevents TOCTOU race conditions. | Duplicate events return HTTP 200 with `{"status": "duplicate_ignored"}`. No side effects on replay. |
| **KYC provider** (`POST /webhooks/kyc`) | HMAC-SHA256 via `X-Kyc-Signature` header. Uses `hmac.compare_digest()` for timing-attack resistance. Secret in settings. | Idempotency key table: `"webhook:kyc:{event_id}"` with SHA256 request hash. Cached response returned for exact replays. | Same payload → HTTP 200 (cached). Different payload with same event ID → HTTP 409 Conflict. |
| **Resend inbound email** (`POST /webhooks/inbound`) | Svix signature verification. | `inbound_emails.resend_email_id` UNIQUE constraint. | Duplicate silently ignored. |

**Note on CCBill MD5:** CCBill's webhook protocol uses MD5 digest (not HMAC-SHA256). This is CCBill's standard integration method. The digest secret (salt) is stored in AWS Secrets Manager and never exposed in logs or responses. Some CCBill event types do not include a digest; for these, idempotency relies on the database UNIQUE constraint on `event_id`.

### 5.7 Content Report & Response Workflow

1. **User reports content**: Emails `safety@zinovia.ai` with creator handle, content description, and optional screenshots (as documented in `/help` FAQ)
2. **Email ingested**: Received via Resend webhook → stored in `inbound_emails` → categorized as "safety"
3. **Admin reviews**: Opens email in admin dashboard → investigates reported content → takes action:
   - Remove post (`POST /admin/posts/{id}/action` with action=remove)
   - Suspend user (`POST /admin/users/{id}/action` with action=suspend)
   - Delete user (`POST /admin/users/{id}/action` with action=delete, soft-delete)
4. **Response**: Admin responds via email to the reporter
5. **Timeline**: FAQ states "We review all reports within 24 hours"

**Disputes/Refunds**:
- CCBill handles chargeback disputes as payment processor
- Chargeback/Refund webhook events recorded in `payment_events`
- Refund creates `ledger_events` entry (type=REFUND) adjusting creator balance
- Purchase history shows status badges: Completed, Pending, Canceled, Refunded, Disputed
- For direct refund requests: users contact `support@zinovia.ai`

---

## 6. Infrastructure Overview

### 6.1 Architecture Diagram

```
                                    ┌──────────────────────────┐
                                    │     Route53 (DNS)        │
                                    │  zinovia.ai              │
                                    │  api.zinovia.ai          │
                                    │  media.zinovia.ai        │
                                    └────────────┬─────────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                    ┌─────────▼────────┐         │        ┌────────▼────────┐
                    │   AWS WAF v2     │         │        │  CloudFront CDN │
                    │  (SQLi, XSS,     │         │        │  (media assets) │
                    │   rate limit)    │         │        │  [disabled]     │
                    └─────────┬────────┘         │        └────────┬────────┘
                              │                  │                 │
                    ┌─────────▼────────┐         │        ┌────────▼────────┐
                    │     ALB          │         │        │                 │
                    │  (HTTPS, path    │         │        │   S3 Bucket     │
                    │   routing)       │         │        │  (media files,  │
                    └──┬──────────┬────┘         │        │   derived       │
                       │          │              │        │   variants)     │
              ┌────────▼──┐  ┌───▼─────────┐    │        └─────────────────┘
              │ ECS: Web  │  │ ECS: API    │    │              ▲
              │ (Next.js) │  │ (FastAPI)   │    │              │
              │ Port 3000 │  │ Port 8000   │    │              │ S3 signed URLs
              │ 512 CPU   │  │ 512 CPU     │    │              │
              │ 1GB RAM   │  │ 1GB RAM     │    │              │
              └───────────┘  └──┬───────┬──┘    │              │
                                │       │       │              │
                    ┌───────────▼──┐    │   ┌───▼──────────────┤
                    │  RDS         │    │   │  ECS: Worker     │
                    │  PostgreSQL  │    │   │  (Celery)        │
                    │  16          │    │   │  1024 CPU        │
                    │  (users,     │    │   │  2GB RAM *       │
                    │   posts,     │    │   │  ML models       │
                    │   payments,  │    │   │  (~1.76GB cache) │
                    │   scans)     │    │   └──────────┬───────┘
                    └──────────────┘    │              │
                                        │   ┌──────────▼───────┐
                                        └──▶│  ElastiCache     │
                                            │  Redis 7.0       │
                                            │  (Celery broker) │
                                            └──────────────────┘

              ┌──────────────────────────────────────────────────┐
              │  AWS Secrets Manager                             │
              │  (DB URL, JWT, CSRF, CCBill, Resend, CloudFront)│
              └──────────────────────────────────────────────────┘
```

*\* Worker RAM note: Current Terraform allocation is 2048 MB (2 GB). Pre-downloaded model files total ~1.76 GB on disk. At runtime, PyTorch loads models into memory on first use (lazy singleton). Peak memory during inference (especially BLIP captioning) may approach or exceed the 2 GB limit. **Recommended production sizing: 4096 MB (4 GB) RAM with 2048 CPU units** to provide headroom for concurrent image processing. `CELERY_CONCURRENCY` defaults to 1 to avoid loading duplicate model copies.*

### 6.2 Data Storage

| Store | What's Stored | Encryption |
|-------|--------------|------------|
| **S3** | Original media, derived variants (thumb/grid/full), watermarked copies, video posters, AI-generated images | Server-side (SSE-S3), versioning enabled in prod |
| **PostgreSQL (RDS)** | Users, profiles, posts, subscriptions, payments, audit logs, safety scans, captions, tags, conversations, messages, notifications, ledger | Encrypted at rest (RDS default), TLS in transit |
| **Redis (ElastiCache)** | Celery task queue (transient), rate-limit counters | Encrypted at rest, no persistent data |
| **Secrets Manager** | JWT secret, CSRF secret, DB password, CCBill keys, Resend keys, CloudFront private key | AWS KMS encryption |

### 6.3 CDN & WAF — Current Status

| Component | Status (as of 2026-02-21) | Configuration When Enabled |
|-----------|--------------------------|---------------------------|
| **CloudFront (media)** | **Disabled** — pending AWS account service limit increase | `media.zinovia.ai` → S3 origin with Origin Access Control, signed URLs (10 min TTL) |
| **CloudFront (web)** | **Disabled** — ALB serves web traffic directly | `zinovia.ai` → S3 static site (fallback if ALB unavailable) |
| **WAF (regional, ALB)** | **Disabled** — activates with `enable_ha=true` or `enable_waf=true` | AWSManagedRulesCommonRuleSet (SQLi, XSS) + rate limit (2000 req/IP) |
| **WAF (CloudFront)** | **Disabled** — requires CloudFront to be active | Same ruleset as regional |

**Current media delivery path (CloudFront disabled):** API generates S3 presigned URLs directly. URLs expire after `MEDIA_URL_TTL_SECONDS` (default 900s / 15 min). S3 enforces expiration server-side. Application-level rate limiting (Redis-backed) provides request throttling in lieu of WAF.

**Planned:** Enable CloudFront and WAF once AWS account verification completes. No code changes required — infrastructure is fully configured in Terraform and activates via feature flags.

### 6.4 Background Processing (Celery)

| Task | Queue | Trigger | Purpose |
|------|-------|---------|---------|
| `media.generate_derived_variants` | default | Image upload | Thumb/grid/full variants + blurhash + watermark |
| `media.generate_video_poster` | default | Video upload | Extract poster frame at 1s |
| `ai_safety.scan_image` | default | Image upload (if enabled) | NSFW + age-proxy classification |
| `ai_safety.generate_caption` | default | After ALLOW scan | Image captioning (3 variants) |
| `ai_safety.generate_tags` | default | After caption generation | Tag extraction + embeddings |
| `ai.generate_images` | default | AI studio request | Replicate API for image generation |
| `notify.create_notification` | default | Various events | In-app notifications |
| `posts.publish_due_scheduled` | beat (every minute) | Celery beat scheduler | Publish scheduled posts |

### 6.5 Security

| Layer | Protection |
|-------|-----------|
| **TLS** | HTTPS enforced via ALB + HSTS (2 years, preload) |
| **CSRF** | Double-submit cookie pattern (X-CSRF-Token header) |
| **JWT** | HS256, 60-min expiry, httponly cookie |
| **CORS** | Allowlist of `zinovia.ai` + `www.zinovia.ai` + `api.zinovia.ai` |
| **WAF** | AWSManagedRulesCommonRuleSet + rate limit (2000 req/IP) |
| **Rate Limiting** | Application-level per-user + per-IP (Redis-backed) |
| **Secrets** | AWS Secrets Manager, never in code/env files |
| **IAM** | Least-privilege task roles (S3 read/write, Secrets read only) |
| **Database** | Private subnet, ECS security group only |
| **Webhooks** | CCBill: MD5 digest verification; KYC: HMAC-SHA256 with timing-safe comparison; Resend: Svix signature. All webhooks deduplicated via database UNIQUE constraints. |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |

### 6.6 Observability

| Component | Tool |
|-----------|------|
| **Logs** | CloudWatch Logs (30 days retention prod) |
| **Errors** | Sentry (when SENTRY_DSN configured) |
| **Metrics** | CloudWatch metrics (ALB, ECS, RDS) |
| **Alarms** | ALB 5xx spike (≥10 in 2 min), API target group 5xx spike |
| **Health Checks** | `/health` (basic), `/ready` (DB + Redis + CCBill connectivity) |
| **Request Tracing** | X-Request-Id header on all API responses |
| **Audit** | Immutable audit_events table for all sensitive actions |

---

## 7. Appendix

### 7.1 Feature Flags & Defaults

| Flag | Environment Variable | API Default | Prod Terraform | Status |
|------|---------------------|-------------|----------------|--------|
| Likes | `ENABLE_LIKES` | false | true | Active |
| Comments | `ENABLE_COMMENTS` | false | true | Active |
| Notifications | `ENABLE_NOTIFICATIONS` | false | true | Active |
| Vault | `ENABLE_VAULT` | true | true | Active |
| Scheduled Posts | `ENABLE_SCHEDULED_POSTS` | false | false | Gated |
| Promotions | `ENABLE_PROMOTIONS` | false | false | Gated |
| DM Broadcast | `ENABLE_DM_BROADCAST` | false | false | Gated |
| PPV Posts | `ENABLE_PPV_POSTS` | false | false | Gated |
| PPV Messages | `ENABLE_PPVM` | false | true | Active |
| Moderation | `ENABLE_MODERATION` | false | false | Gated |
| AI Safety | `ENABLE_AI_SAFETY` | false | true | Active |
| Analytics | `ENABLE_ANALYTICS` | false | false | Gated |
| Mobile Nav Polish | `ENABLE_MOBILE_NAV_POLISH` | false | false | Gated |
| Mock KYC | `ENABLE_MOCK_KYC` | false | true | Temporary |
| Watermark | `MEDIA_WATERMARK_ENABLED` | false | TODO | Pending setup |
| Video | `MEDIA_ALLOW_VIDEO` | true | true | Active |

### 7.2 Public Contact Emails

| Email | Purpose | Auto-Category |
|-------|---------|---------------|
| `support@zinovia.ai` | General support, billing, technical issues | support |
| `privacy@zinovia.ai` | Privacy requests, data deletion, GDPR/CCPA | privacy |
| `legal@zinovia.ai` | Legal inquiries, DMCA, disputes | legal |
| `safety@zinovia.ai` | Content safety reports, abuse reports | safety |
| `noreply@zinovia.ai` | Outbound transactional emails (verification, reset) | — |
| `dmarc@zinovia.ai` | DMARC aggregate reports | — |

### 7.3 Merchant Underwriting Evidence Checklist

Screenshots/evidence to collect for payment processor review:

**Platform Safety**:
- [ ] Signup form showing age gate (date of birth, 18+ validation)
- [ ] KYC verification flow (document + selfie steps)
- [ ] KYC onboarding checklist (all states)
- [ ] AI safety scan queue in admin (pending reviews with risk badges)
- [ ] Admin approve/reject action on flagged content
- [ ] `image_safety_scans` table showing recorded decisions and model versions
- [ ] Policy engine thresholds configuration

**Content & Moderation**:
- [ ] Admin dashboard showing user list with action buttons
- [ ] Post moderation actions (approve, reject, remove)
- [ ] NSFW toggle on post creation form
- [ ] Locked content overlay (blurred preview for non-subscribers)
- [ ] Terms of Service page (`/terms`)
- [ ] Privacy Policy page (`/privacy`)

**Payment Flows**:
- [ ] Subscribe button → CCBill redirect
- [ ] CCBill hosted checkout page
- [ ] Subscription success confirmation page
- [ ] PPV post unlock flow (locked state → unlock → CCBill → unlocked)
- [ ] Tip payment flow
- [ ] Purchase history page with status badges
- [ ] Subscription management page (active, cancel)
- [ ] Billing success/cancel pages

**Support & Compliance**:
- [ ] Contact page with support email and form
- [ ] Help/FAQ page
- [ ] Content reporting instructions (in FAQ)
- [ ] Inbound email management in admin dashboard
- [ ] Audit events table showing tracked actions

**Infrastructure & Security**:
- [ ] `/health` and `/ready` endpoint responses
- [ ] HTTPS certificate (browser lock icon)
- [ ] Security headers in API response
- [ ] Rate limiting response (429 status)

### 7.4 Glossary

| Term | Definition |
|------|-----------|
| **PPV** | Pay-Per-View — one-time purchase to unlock a specific piece of content (post or message media) |
| **CCBill** | Payment processor specializing in recurring billing and adult content. Uses FlexForms (redirect-based hosted checkout) |
| **FlexForms** | CCBill's hosted payment form system — users are redirected to CCBill's domain to enter payment details; no card data touches our servers |
| **formDigest** | HMAC verification hash for CCBill checkout URLs: `MD5(price + period + ... + salt)` |
| **KYC** | Know Your Customer — identity verification process requiring government ID and selfie before creator can publish |
| **NSFW** | Not Safe For Work — content classification indicating adult/explicit material |
| **Underage Likelihood Proxy** | A numerical signal (0-1) from the `nateraw/vit-age-classifier` model representing the sum of probabilities for predicted age ranges under 20. This is a proxy signal based on facial appearance — NOT a definitive age determination |
| **ALLOW / REQUIRE_REVIEW / BLOCK** | Three-tier safety decision from the AI policy engine. REQUIRE_REVIEW and BLOCK place media into HOLD state and always require human admin review before resolution |
| **HOLD state** | Media quarantine state triggered by BLOCK or REQUIRE_REVIEW decisions. Media owner can view; all other users denied access. Remains in HOLD until admin explicitly approves or rejects. No autonomous enforcement |
| **Derived Variant** | Resized/processed versions of uploaded media (thumb 200px, grid 600px, full 1200px) stored alongside originals |
| **Blurhash** | Compact hash representing a blurred version of an image, used as placeholder during loading |
| **pgvector** | PostgreSQL extension for vector similarity search, used for semantic media search |
| **Celery** | Distributed task queue (Python) used for background processing of media, AI scans, notifications |
| **Celery Beat** | Scheduler component of Celery for periodic tasks (e.g., publishing scheduled posts every minute) |
| **ECS Fargate** | AWS serverless container orchestration — runs containers without managing EC2 instances |
| **ALB** | Application Load Balancer — distributes traffic between API and Web services with path-based routing |
| **Ledger** | Double-entry accounting system tracking all financial transactions (gross, fees, net) per creator |
| **Soft Delete** | User deletion that sets role="deleted" and is_active=False rather than removing the database record, preserving audit trail |
| **Signed URL** | Time-limited, cryptographically signed URL for accessing private S3 objects. Expires after configured TTL |
| **SAVEPOINT** | PostgreSQL transactional savepoint used to make DDL operations non-fatal (e.g., creating pgvector extension) |

---

## 8. Underwriting Addendum — Paywall Security & Safety Controls

*This addendum summarizes the controls most relevant to payment processor underwriting. It references specific mechanisms documented in the sections above.*

### 8.1 Paywall Enforcement & Media Delivery

All premium content (subscription-gated posts, PPV posts, locked message media) is protected by **server-side access control** at the API layer. The platform does NOT rely on client-side blur, JavaScript obfuscation, or URL obscurity.

- Media files are stored in private S3 buckets with no public access.
- Every media download request (`GET /media/{id}/download-url`) is validated by `can_user_access_media()`, which checks ownership, subscription status, or purchase status (`PostPurchase.status == "SUCCEEDED"`) before issuing a time-limited signed URL.
- Unauthorized requests receive HTTP 404 (resource appears non-existent; prevents enumeration).
- **Variant-level gating:** Media exists in multiple server-generated variants. Unauthorized users can only request teaser variants (`thumb`, `grid`, `teaser`). Requests for `full` or original from unauthorized users are denied.
- **Signed URL expiry:** S3 presigned URLs expire in 15 minutes; CloudFront signed URLs in 10 minutes.
- **Subscription validation:** Checks status (`active` or `past_due` within grace period) AND `current_period_end > now`.
- **Recommendation pending:** Add `Cache-Control: no-store` to original/full S3 objects.

### 8.2 Minor-Risk Mitigation

Five layers of defense:

1. **Age gate:** All users must provide date of birth at signup. Anyone under 18 is rejected.
2. **Creator KYC:** Government ID + selfie verification required before content publication.
3. **AI proxy signal:** `nateraw/vit-age-classifier` produces an `underage_likelihood_proxy` score (0–1). This is a statistical proxy based on general visual features — **NOT facial recognition, NOT biometric identification, NOT a definitive age determination.** No biometric templates are extracted, stored, or compared.
4. **Human review:** When proxy score exceeds thresholds, content enters **HOLD state** — quarantined from non-owner access until admin explicitly approves or rejects. AI CANNOT autonomously enforce.
5. **Immutable audit:** Every scan result and admin review action permanently recorded with reviewer identity.

### 8.3 Human-in-the-Loop Moderation — Chain of Custody

| Step | Actor | Action | Immutable Record |
|------|-------|--------|------------------|
| Upload | Creator | Uploads image | `media_assets` + `audit_events` ACTION_MEDIA_UPLOADED |
| Scan | AI (worker) | Classifies image | `image_safety_scans`: scores, decision, model_versions |
| HOLD | System | Sets `safety_status` to "review" or "blocked" | `media_assets.safety_status` |
| Quarantine | System | Denies non-owner download requests | Enforced by `can_user_access_media()` |
| Review | Admin | Approves or rejects | `reviewed_by`, `reviewed_at`, `review_decision` |
| Resolution | System | Updates `safety_status` | `media_assets.safety_status` |

All records are immutable after creation. Admin identity captured via authenticated session.

### 8.4 Payment Isolation

- **No card data on our servers.** CCBill FlexForms (redirect-based hosted checkout). Our servers never see or store card numbers.
- **Webhook verification:** CCBill: MD5 digest; KYC: HMAC-SHA256 with timing-safe comparison.
- **Idempotent processing:** UNIQUE constraint on `event_id` with atomic PostgreSQL UPSERT. Replayed webhooks produce no duplicate charges or ledger entries.
- **Chargeback handling:** CCBill Chargeback events recorded in `payment_events`; REFUND ledger entry adjusts creator balance.

### 8.5 Incident Handling & Escalation

| Channel | Address | SLA |
|---------|---------|-----|
| Safety reports | `safety@zinovia.ai` | Review within 24 hours |
| Privacy requests | `privacy@zinovia.ai` | Acknowledgment 48h; erasure within 30 days |
| Legal | `legal@zinovia.ai` | Acknowledgment within 48 hours |
| Billing support | `support@zinovia.ai` | Response within 24 hours |

All inbound emails auto-ingested, verified (SPF/DKIM), categorized, and visible in admin dashboard. Admin actions logged in `audit_events` with actor identity, timestamp, and IP.

For critical safety incidents: immediate content removal + user suspension + legal escalation.

---

*Document v1.1 generated 2026-02-21. For questions, contact the engineering team.*
