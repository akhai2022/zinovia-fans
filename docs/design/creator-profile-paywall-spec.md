# Creator Profile + Paywall Modal — The Money Screen

**Goal:** Creator public profile (mobile-first) optimized for subscription conversion, with a clear paywall flow and trust.

---

## 1. Layout spec (mobile-first)

### 1.1 Overall structure (vertical order)

1. **Banner** (full-width, fixed aspect or max height)  
2. **Profile block** (avatar, name, handle, verification, optional badge)  
3. **Bio + tags + “What you get”**  
4. **Preview content grid** (with locked overlays)  
5. **Sticky subscribe bar** (mobile: fixed bottom when scrolled)  
6. **Subscription card** (plan, perks, renewal, cancellation) — can sit above grid or in modal  

**Desktop:** Same order; profile block can be row (avatar + text); grid 3–4 columns; subscribe bar becomes a sidebar card or inline block instead of sticky strip.

---

### 1.2 Banner

- **Size:** Full width; height ~120–160px mobile (or 28–32vw), ~200–280px desktop. Max height to avoid dominating.
- **Content:** Creator-uploaded image; fallback gradient or default art if none.
- **Overlay:** None or very subtle so text/avatar stay readable. No CTA on banner.

---

### 1.3 Profile block (avatar, name, handle, verification, badge)

- **Layout:** Avatar overlaps banner bottom (centered or left-aligned). Name and handle below; verification and badge inline with name/handle.
- **Avatar:** 80–96px mobile, 96–120px desktop; circular; border (e.g. 3px surface/white) so it sits on banner.
- **Name:** H1 or strong title; one line, truncate with ellipsis if long.
- **Handle:** @handle, muted color; below or next to name.
- **Verification:** Checkmark icon (or “Verified” pill) next to name or handle; only if verified. Tooltip/label: “Verified creator”.
- **Badge pattern:** Optional “Top creator” / “Early supporter” / “Subscriber” (for fan view) — small pill or icon; one primary badge to avoid clutter.

**Hierarchy:** Name > Handle > Verification/badge. All in one compact block so first scroll shows “who this is” immediately.

---

### 1.4 Bio + tags + “What you get”

- **Bio:** 2–4 lines visible; “Read more” expand if longer. Body text, readable line length.
- **Tags:** Pills (e.g. Fitness, Art, Q&A); max 5–7; muted fill; no dropdown on profile — static.
- **“What you get”:** Bullet list (3–6 items). Icon or dot + short line each. E.g. “Exclusive posts every week”, “Subscriber-only DMs”, “Early access to drops”.
- **Order:** Bio first, then tags, then “What you get”. “What you get” is the conversion bridge into the subscription card.

**Hierarchy:** “What you get” heading same weight as “Bio” or slightly stronger; bullets visually lighter than creator name.

---

### 1.5 Preview content grid (locked overlays)

- **Grid:** 2 columns mobile, 3–4 desktop. Uniform cells (e.g. 1:1 or 4:3); gap consistent.
- **Cell content:** Thumbnail (image/video poster) or text snippet (e.g. first line). Post type icon if needed (image/video/text).
- **Locked state:** Overlay on thumbnail: dark gradient (bottom or full) + lock icon (center or bottom) + optional “Subscriber only” or “Subscribe to unlock” line. Tap → paywall (see 1.8).
- **Unlocked state:** No overlay; tap → post detail.
- **Order:** Newest first or “featured” first; same for locked and unlocked.

**Hierarchy:** Grid is secondary to profile block and subscribe CTA; don’t let it dominate above the fold on mobile.

---

### 1.6 Sticky subscribe bar (mobile)

- **When:** Becomes sticky after profile block (and optionally bio) scroll out of view; or after first row of grid.
- **Content:** Creator avatar (small) + “Subscribe to [Name]” (or “[Price]/month”) + **Subscribe** button (primary).
- **Height:** ~56–64px; single row; bar has background (e.g. surface with border or shadow) so it reads as one component.
- **Desktop:** Can be non-sticky; same content in a sidebar card or below “What you get”.

**Interaction:** Tap “Subscribe” → open paywall modal/sheet (see 1.8).

---

### 1.7 Subscription card (plan, perks, renewal, cancellation)

- **Placement:** Below “What you get” or inside paywall step 1. If on profile, compact card; full detail in modal.
- **Content:**
  - **Plan:** Price (e.g. “$4.99/month”), billing interval (“Billed monthly”).
  - **Perks:** Short list (same as or subset of “What you get”): e.g. “Full feed”, “Subscriber DMs”, “No ads”.
  - **Renewal clarity:** “Renews on [date]” or “You’ll be charged $X on [date] each month.”
  - **Cancellation clarity:** “Cancel anytime. Access until end of billing period.”
- **CTA:** “Subscribe” (primary) or “Continue” if in modal.
- **“DM included?”:** If DMs are a perk: explicit line “Subscriber-only DMs included” or “You can message [Name] as a subscriber.” Toggle only if creator can turn DMs on/off; otherwise just labeling.

**Hierarchy:** Price is prominent; perks and renewal/cancel are scannable; no fine print only — key terms visible.

---

### 1.8 Paywall modal / bottom sheet flow (step-by-step)

**Trigger:** Tap locked content, or “Subscribe” in sticky bar or subscription card.

**Mobile:** Bottom sheet (slides up); can expand to full screen on step 2.  
**Desktop:** Centered modal; max width ~400px.

**Step 1 — Offer**
- Creator avatar + name + “Subscribe to [Name]”.
- Price + interval: “$X/month” and “Billed monthly”.
- Short perks (3–4 bullets).
- “DM included” line if applicable.
- **Primary CTA:** “Subscribe — $X/month”.
- **Trust:** “Secure payment” / “Cancel anytime” / “Card charged by [Product]” (or Stripe). Small lock or “Secure” text.
- **Secondary:** “Cancel” or close (X).

**Step 2 — Checkout**
- If we host: email (if not logged in), card fields, or “Pay with Apple Pay / Google Pay”.
- If redirect to Stripe: “You’ll be taken to our secure payment page” + “Continue to payment”.
- Trust line repeated: “Your payment is secure. Cancel anytime.”

**Step 3 — Success**
- Checkmark or success illustration.
- “You’re in. You now have access to [Name]’s subscriber content and DMs.”
- **CTA:** “View profile” or “See latest posts”.
- Sheet/modal dismisses; profile refreshes (content unlocks).

**Trust indicators (in flow):** Lock icon + “Secure payment”; “Cancel anytime”; “Card never shared with creator”; optional “Powered by Stripe” or “Secure checkout”.

---

### 1.9 Post types: image, video, text — locked vs unlocked

- **Image:** Thumbnail in grid; locked = overlay + lock; unlocked = tap to open lightbox/detail.
- **Video:** Poster frame in grid; play icon on cell; locked = overlay + lock; unlocked = tap to play inline or full screen.
- **Text:** Card with first line or “Text post”; locked = overlay + lock (or blurred/short preview per policy); unlocked = full text in detail.

**Locked overlay microcopy (see Section 2):** One short line per cell (e.g. “Subscriber only”); in modal, fuller “Subscribe to unlock” pitch.

**Unlocked:** No overlay; same grid; tap → post detail (image lightbox, video player, text expansion).

---

## 2. Hierarchy rules

- **Primary:** Creator name + subscribe CTA (sticky bar and card). One primary action: “Subscribe”.
- **Secondary:** “What you get”, price, perks. Scannable in 3–5 seconds.
- **Tertiary:** Bio, tags, grid. Support identity and proof, don’t compete with CTA.
- **Visual:** Name and CTA button highest contrast/size; then price and perks; then body text and thumbnails.
- **Order:** Identity (who) → Value (what you get) → Proof (grid) → Action (subscribe). Sticky bar repeats action without repeating full value block.

---

## 3. Microcopy

### 3.1 Locked overlay (on grid cell)

- **Short (on overlay):** “Subscriber only” or “Subscribe to unlock”.
- **Optional:** “Locked” with lock icon only (no text) for minimal look.

### 3.2 Subscribe pitch (in card / step 1)

- **Headline:** “Subscribe to [Name]” or “Unlock [Name]’s content”.
- **Value:** “Get full access to posts, subscriber DMs, and more.”
- **Price:** “$X/month. Billed monthly.”
- **Reassurance:** “Cancel anytime. Access until the end of your billing period.”
- **CTA:** “Subscribe — $X/month” or “Continue — $X/month”.

### 3.3 Trust (paywall)

- “Secure payment. Your card is never shared with the creator.”
- “Cancel anytime.”
- “You’ll be charged $X on [date] each month. Cancel before then to avoid the next charge.”

### 3.4 “DM included” labeling

- If DM is a perk: “Subscriber-only DMs included” (in perks list and subscription card).
- If creator can toggle: “DMs: Included” or “Message [Name] as a subscriber” with no toggle on profile; toggle only in creator settings.

---

## 4. Edge cases

### 4.1 No posts yet

- **Grid:** Don’t show empty grid. Show one placeholder block: “No posts yet” or “[Name] hasn’t posted yet. Subscribe to be first to see new content.” Optional soft CTA: “Subscribe to get notified.”
- **Locked overlay:** N/A. Subscription card and sticky bar still visible; pitch = “Be first” instead of “Unlock X posts”.

### 4.2 Private / unlisted creator

- **If profile not found:** 404 or “This creator isn’t available.” No paywall.
- **If creator exists but is “private” (invite-only or disabled):** Same as not found, or “This creator’s page isn’t public right now.” No subscribe CTA; no grid.

### 4.3 Payment failed

- **In paywall (step 2 or return from Stripe):** Toast or inline message: “Payment didn’t go through. Check your card or try again.” Keep user on checkout step; “Try again” and optional “Use different card”.
- **No auto-unlock:** Only unlock after successful payment; show success step then.

### 4.4 Already subscribed

- **Sticky bar:** Replace with “You’re subscribed” (muted) or “Manage subscription” (link to settings).
- **Subscription card:** “Current plan: $X/month” + “Manage” or “Cancel subscription” (link).
- **Grid:** All content unlocked; no lock overlays for subscriber-only posts.
- **CTA:** No “Subscribe”; primary action = “View latest” or “Message” (if DMs included).

### 4.5 Logged out

- **Subscribe tap:** Open paywall; step 1 can show “Log in or sign up to subscribe” or redirect to signup then return to paywall (with return URL).
- **Locked content tap:** Same: sign up / log in in flow or before paywall.

### 4.6 Creator has no subscription plan

- **If product allows “follow only”:** Hide subscription card and subscribe CTA; show follow only; no paywall. Or show “Subscribe coming soon.”
- **If subscription required for creator:** Don’t show profile as “creator” until they set a plan; edge case handled in onboarding.

---

## 5. Component checklist

- Banner (with fallback)
- Avatar (overlapping banner)
- Name, handle, verification icon, badge pill
- Bio (with “Read more”)
- Tag pills
- “What you get” bullet list
- Content grid (2/3/4 col), cell with thumbnail + locked overlay (gradient + lock + microcopy)
- Sticky subscribe bar (avatar + label + Subscribe button)
- Subscription card (price, perks, renewal, cancel, CTA, “DM included” line)
- Paywall bottom sheet / modal (steps: Offer → Checkout → Success)
- Trust line (secure, cancel anytime)
- Post detail / lightbox (unlocked)
- Empty state (no posts)
- Error state (payment failed)

This spec gives layout, hierarchy, microcopy, and edge-case behavior for the creator profile and paywall flow.
