# Feed + Post Composer — Retention & Creator Velocity

**Goals:** Fan feed that’s scrollable and fast, with clear but non-spammy “subscribe to unlock” patterns. Creator composer that feels instant on mobile and supports media, lock settings, pricing, schedule, preview, and publish — with skeletons, optimistic UI, upload progress, content warnings, and drafts.

---

## Part A: Fan feed

### A.1 Design principles

- **Media-first:** Image/video is the hero; text supports. Cards lead with thumbnail or inline media.
- **Fast:** Skeleton loaders, no layout shift, lazy-load media below fold. Infinite scroll or “Load more” with minimal delay.
- **Locked tease, not spam:** Locked content is visible enough to create desire (blur, crop, or overlay) but doesn’t repeat the same CTA in every card. One clear “Subscribe to unlock” pattern per card or per screen.

---

### A.2 Component breakdown — feed

| Component | Description |
|-----------|-------------|
| **Feed container** | Vertical scroll; padding bottom for last card + optional “Load more” trigger. No horizontal scroll. |
| **Feed card** | Single post unit: creator strip (avatar, name, handle, optional badge) + media block or text block + caption + actions (like, comment, share) + lock state if applicable. |
| **Creator strip** | Avatar (small), name (tappable → profile), @handle, “Subscriber”/“Creator” badge if relevant. Single row; always above content. |
| **Media block** | Image: aspect-preserved, max height or full width. Video: poster + play icon; tap to play inline or full screen. |
| **Text block** | Caption or text-only post; line clamp (e.g. 3–4 lines) with “more” expand. |
| **Locked overlay** | On media or card: gradient + lock icon + one line (“Subscriber only” or “Subscribe to [Name] to unlock”). Tap → profile or paywall (no modal spam). |
| **Card actions** | Like, comment (count), share; optional save. Icon + count; secondary visual weight. |
| **Skeleton card** | Placeholder: creator strip skeleton (circle + 2 lines) + media block (rect) + 2 caption lines. Same height rhythm as real card. |
| **Empty feed** | Illustration + “No posts yet” + “Follow or subscribe to creators to fill your feed.” + CTA “Discover creators”. |
| **Load more / infinite** | At list end: skeleton or “Load more” button; or auto-load on scroll threshold. |

---

### A.3 Feed card states

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton card (creator strip + media rect + caption lines). No image load. |
| **Unlocked (loaded)** | Full media + caption + actions. Tap media → detail/lightbox if needed. |
| **Locked** | Media with overlay (blur or dark gradient), lock icon, one line of copy. Tap card → creator profile (subscribe there) or single paywall CTA. No “Subscribe” on every card; optional “Unlock” on card that goes to profile. |
| **Error** | Card shows “Couldn’t load this post” + Retry. Or skip and show next. |
| **Optimistic (like)** | Like count +1 and heart filled immediately; revert on error with toast. |

---

### A.4 “Subscribe to unlock” patterns (non-spammy)

- **In card:** One line only: “Subscriber only” or “Subscribe to [Name] to unlock.” No button on card; tap card → creator profile. Profile has the subscribe CTA. Reduces repetition.
- **Frequency:** If feed has many locked posts from one creator, first locked card can show full tease; next ones from same creator can show smaller lock badge or same one-line. Avoid 5 identical “Subscribe now” buttons in one viewport.
- **Tone:** “Subscriber only” is neutral. “Subscribe to unlock” is one step more direct. Avoid “You’re missing out!” or countdowns.
- **Optional:** One floating or inline “Subscribe to see more from [Name]” after N locked cards from same creator (e.g. after 2–3), linking to profile. Single nudge, not per card.

---

### A.5 Microinteractions — feed

- **Scroll:** Smooth; no jank. Lazy-load images with fade or no animation (prefer no layout shift).
- **Pull to refresh:** Optional; subtle spinner at top; refresh replaces list or prepends.
- **Tap locked card:** Light haptic (if available); navigate to creator profile or open paywall once. No double modal.
- **Like:** Heart fills (and count +1) immediately; optional small scale (1.1x) on tap. On error: revert + toast “Couldn’t update”.
- **Expand caption:** “more” tappable; expands in place with short ease. No full-screen modal for caption only.
- **Video:** Tap play → inline or full screen; show progress; pause on scroll away (policy-dependent).

---

## Part B: Creator post composer

### B.1 Design principles

- **Extremely fast on mobile:** Few taps to add media, caption, and publish. Progressive disclosure: advanced (lock, price, schedule) behind “Options” or second step.
- **Media first:** Add photo/video before or with caption; preview is live.
- **Clear outcomes:** “Publish” and “Save draft” are obvious; lock and pricing are explicit.

---

### B.2 Component breakdown — composer

| Component | Description |
|-----------|-------------|
| **Composer shell** | Full screen (mobile) or modal/panel (desktop). Header: Back, “New post”, Publish (primary) or “Save draft”. |
| **Media picker / drop zone** | “Add photo or video” — tap opens system picker or camera. Selected media: thumbnail strip (horizontal) or grid; reorder by drag; remove per slot (×). Multi-select supported (e.g. up to 10). |
| **Media preview** | Main preview area: single image/video or carousel. Swap order by dragging in strip. |
| **Caption input** | Single field; placeholder “Write a caption…” or “Add caption (optional)”. Expandable (e.g. 3–4 lines default). Optional @mention or #tag support. |
| **Lock / visibility** | Toggle or segment: “Free” vs “Subscribers only” (and optional “Paid unlock” for one-time). Default: Free or last used. |
| **Paid unlock (optional)** | If “Paid unlock” or “Unlock for $X”: amount input (min/max); short line “Fans pay once to view this post.” |
| **Schedule** | Toggle “Publish now” vs “Schedule”; date/time picker when scheduled. Optional “Schedule for later” in header. |
| **Preview** | “Preview” button or tab: shows card as it will appear in feed (with lock overlay if locked). |
| **Content warning (optional)** | Toggle “Mark as sensitive” or “Add content warning”; optional short label. |
| **Drafts** | “Save draft” in header or footer; draft list in composer entry or profile. Draft = caption + media refs + lock/schedule saved; no publish. |
| **Upload progress** | Per media item: progress bar or % under thumbnail; or global “Uploading…” with bar. Success: checkmark. Error: “Failed” + Retry. |

---

### B.3 Composer flow (mobile, minimal taps)

1. **Open composer** → Media picker prominent (“Add photo or video”).
2. **Select media** → Thumbnails appear; optional reorder; caption field below.
3. **Caption** → Type; optional “Options” (lock, price, schedule, content warning).
4. **Options (progressive):**  
   - **Visibility:** Free | Subscribers only | Paid unlock ($X).  
   - **Schedule:** Now | Schedule (date/time).  
   - **Sensitive:** On/off + optional label.  
5. **Preview** → One tap to see feed-style card.
6. **Publish or Save draft** → Primary: “Publish”; secondary: “Save draft”. If schedule: “Schedule” button.

**Desktop:** Same steps; options can be sidebar or accordion next to preview.

---

### B.4 Composer states

| State | Behavior |
|-------|----------|
| **Empty** | Media drop zone visible; caption placeholder; Publish disabled until media (or caption for text-only if supported). |
| **Draft** | Caption + media refs (and lock/schedule) saved; “Save draft” → “Saved”. Publish enabled. |
| **Uploading** | After “Publish” or on add: progress per asset or global; “Publish” disabled or “Publishing…” with spinner. |
| **Optimistic publish** | On “Publish”: post appears in creator’s profile/feed immediately (grey/skeleton or real); then replace with server state. On error: revert + toast “Couldn’t publish” + Retry. |
| **Scheduled** | “Schedule” tap → “Scheduled for [date/time]”; confirmation. Post appears in feed at that time. |
| **Validation error** | e.g. Paid unlock without amount: inline message under field; Publish stays enabled or disabled per rule. |
| **Content warning** | If enabled: post shows warning screen before content (blur or placeholder); “View” to reveal. |

---

### B.5 Skeleton loaders

| Context | Skeleton |
|---------|----------|
| **Feed loading** | 2–3 skeleton cards: creator strip (circle + 2 lines) + media rect (16:9 or 1:1) + 2 caption lines. Same spacing as real cards. |
| **Single card (refresh)** | Same as above for one card. |
| **Composer preview** | If preview fetches: skeleton card shape until media + caption render. |
| **Draft list** | Rows: small thumb + 2 lines; no need for full card. |

---

### B.6 Optimistic UI

| Action | Optimistic behavior | Rollback |
|--------|---------------------|----------|
| **Publish post** | Post appears in feed/profile right away (local state or placeholder); “Publishing…” on button. | On failure: remove or show “Failed” on card + toast + Retry. |
| **Like** | Heart filled, count +1. | On failure: revert count, un-fill heart, toast. |
| **Save draft** | “Saved” or checkmark; no spinner needed. | On failure: toast “Couldn’t save draft” + Retry. |
| **Delete draft** | Row removed from list. | On failure: restore row + toast. |

---

### B.7 Upload progress

- **In composer:** After selecting media, show progress per thumbnail (bar under image) or one bar for “Uploading 2 of 5”.
- **States:** Uploading (bar or %), Success (checkmark or bar full), Error (“Failed” + Retry on that item).
- **Publish:** “Publish” can stay disabled until all uploads succeed, or enable and show “Publishing…” while finalizing. Prefer blocking Publish until uploads complete so post never “publishes” with missing media.

---

### B.8 Content warnings (optional)

- **Toggle:** “Mark as sensitive” or “Add content warning” in options.
- **Optional label:** Short text (e.g. “Nudity”, “Violence”) or preset chips.
- **On feed:** Card shows blur or placeholder + “Sensitive content” + “View” button. Tap “View” → reveal once (or per-session). No forced gate beyond one tap.

---

### B.9 Drafts

- **Save:** “Save draft” writes caption, media refs (uploaded or pending), lock, schedule, content warning to local or server draft.
- **Draft list:** Entry point from composer (“Drafts”) or profile (“Draft posts”). List: thumb + caption preview + “Edit” / “Delete”. Tap Edit → reopen composer with state.
- **Conflict:** If draft is opened on two devices, last save wins or show “Updated elsewhere” (product choice).

---

### B.10 Microinteractions — composer

- **Add media:** Picker opens; on select, thumbnails appear with short fade or no animation (fast). Drag handle for reorder; haptic on drop.
- **Remove media:** × on thumbnail; item removed with short collapse; focus stays in composer.
- **Lock toggle:** Segment or toggle switches; selected state clear (fill or underline). No extra modal for “Subscribers only”.
- **Paid unlock:** Amount field focuses; keyboard numeric; validation on blur or Publish.
- **Schedule:** Date/time picker (native or custom); “Schedule” button confirms; toast “Scheduled for [date]”.
- **Preview:** Tap “Preview” → card view; tap outside or “Back” to return to form.
- **Publish:** Button shows “Publishing…” and disabled; then success → close composer and optionally toast “Posted” or navigate to post.
- **Draft saved:** Brief “Saved” text or checkmark (1–2s); no modal.

---

## Part C: Summary tables

### Feed — components

- Feed container, feed card, creator strip, media block, text block, locked overlay, card actions, skeleton card, empty feed, load more / infinite.

### Feed — states

- Loading (skeleton), unlocked (loaded), locked (tease + one line), error (retry), optimistic (like).

### Composer — components

- Composer shell, media picker/drop zone, media preview, caption input, lock/visibility, paid unlock, schedule, preview, content warning, drafts, upload progress.

### Composer — states

- Empty, draft, uploading, optimistic publish, scheduled, validation error, content warning.

### Microinteractions (both)

- Scroll smooth; pull to refresh; tap locked → profile; like instant + revert on error; caption expand; video play; media add/remove/reorder; lock/schedule/preview toggles; publish loading; draft saved feedback.

This spec gives a full component breakdown, states, and microinteractions for the feed and composer with retention and creator velocity in mind.
