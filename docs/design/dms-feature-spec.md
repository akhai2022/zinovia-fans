# DM System — Feature Design Spec

**Design goal:** A DM experience that feels as polished as top consumer apps (iMessage, Instagram DMs, Discord): fast, trustworthy, and safe.

---

## 1. Screens & Structure

### 1.1 Inbox (list view)

**Purpose:** Single entry point for all conversations. Clear split between accepted conversations and message requests.

**Layout — Mobile (primary):**

- **Top bar**
  - Title: “Messages” (or “DMs”).
  - Optional: search icon (filter by name/handle).
  - No tabs in nav; structure is **two sections in one scroll** (see below).
- **Two sections (single scroll):**
  1. **Message requests** (if any)
     - Section label: “Requests” with count badge, e.g. `Requests (2)`.
     - List of request rows: avatar, name/handle, 1-line preview, “Accept” / “Decline” (or “View” → then Accept/Decline in thread).
     - Tapping row opens **request thread** (gated view).
  2. **Conversations**
     - Section label: “Conversations”.
     - Sorted by last message time (newest first).
     - Row: avatar, name/handle, **subscriber badge** (pill or icon) if they’re your subscriber, last message preview (or “Photo” / “Paid message” placeholder), timestamp (relative), unread dot if unread.
- **Empty state (requests):** “No message requests” + short line: “When someone messages you first, it’ll show up here.”
- **Empty state (conversations):** Illustration + “No conversations yet” + “Follow or subscribe to creators to start a conversation.”

**Layout — Desktop:**

- Left rail (≈320–360px): same two sections, fixed height with scroll.
- Right: placeholder “Select a conversation” or, when a thread is open, thread view (see 1.2).
- List row: same content, hover state, optional right-click “Mark unread” / “Block”.

**Interaction rules:**

- **Requests:** Accept moves thread to Conversations and allows free back-and-forth (subject to product rules). Decline removes from Requests; optional “Decline and block”.
- **Unread:** Tapping a conversation marks it read; unread count in app nav/sidebar.
- **Badge:** Subscriber badge is always visible in list and in thread so creators see who is a paying supporter.

---

### 1.2 Message thread (conversation view)

**Purpose:** Read and send messages; see subscriber status; handle requests; attach media; optional paid message; safety actions.

**Layout — Mobile:**

- **Header (sticky):**
  - Back to inbox.
  - Avatar + name/handle.
  - **Subscriber badge** (e.g. “Subscriber” pill or crown/star icon) when the other user is your subscriber.
  - Overflow menu (⋮): **View profile**, **Block**, **Report**, **Delete conversation**.
- **Message list (scroll):**
  - Bubbles: sent (right, primary color); received (left, surface/secondary).
  - Each bubble: text and/or media; timestamp (e.g. on long-press or below in compact form).
  - **Media:** Thumbnail in bubble; tap → lightbox/full-screen with optional download.
  - **Paid message (optional):** Shown as locked bubble with lock icon + “Pay $X to unlock”; tap → paywall microcopy + “Unlock” CTA; after payment, bubble reveals content.
  - **Request gate (non-subscriber messaging creator):** If product rule is “only subscribers can DM creator”:
    - Banner at top: “This is a message request. [Creator] can accept to start chatting.”
    - Creator sees **Accept** / **Decline** (and optionally “Decline and block”) in header or sticky bar.
    - Until accepted, thread stays in Requests and fan sees “Waiting for [Creator] to accept.”
- **Composer (sticky bottom):**
  - Attachment button (image/video) → opens **attachment picker**.
  - Text input (single line, expands up to ~4 lines).
  - Send button (or “Pay to send” if paid message is enabled for this thread).
  - Optional: “Request paid message” or “Send paid message” toggle/entry point for creator.

**Layout — Desktop:**

- Same header and list; composer at bottom of thread column.
- Optional: right sidebar with “View profile” card and “Block / Report” for quick access.

**Interaction rules:**

- **Send:** Enter (or Cmd+Enter) sends; empty message disabled.
- **Attachments:** Picker opens; select one or multiple; previews below input; remove via × on preview; send attaches all (or in-sequence if we limit per message).
- **Paid message:** Creator can optionally set “Pay $X to send” for one message; fan sees amount and “Pay & send”; after payment, message sends and appears unlocked for both.
- **Request flow:** Only “Accept” moves to main inbox and unlocks full thread for both sides.

---

### 1.3 Message request gating (non-subscriber)

**Purpose:** Let creators control who can message them (e.g. subscribers only) and review requests without clutter.

**States:**

- **Fan (non-subscriber) sends first message:**
  - Message goes to creator’s **Requests**, not main inbox.
  - Fan sees their own thread with system line: “You sent a message request. [Creator] will see your message and can accept to chat.”
  - Fan cannot send more messages until creator accepts (avoids spam).
- **Creator sees request:**
  - In Requests list: preview of first message (or “Photo” / “Paid message”).
  - In thread: full message(s); **Accept** / **Decline** / **Decline and block**.
- **After Accept:** Thread moves to Conversations; both can send freely (within rate limits).
- **After Decline:** Thread removed from creator’s Requests; fan sees “Message request was declined” (no resend unless product allows a new request later).

**Gating rules (configurable):**

- Who can start a DM: “Anyone” / “Followers only” / “Subscribers only”.
- Shown in creator **Settings → DMs** and optionally on profile (“Only subscribers can message me”).

---

### 1.4 Attachment picker

**Purpose:** Add images/video to a message with clear preview and limits.

**Layout:**

- **Trigger:** Tap attachment icon in composer → bottom sheet (mobile) or modal (desktop).
- **Content:**
  - Source tabs or buttons: **Camera** (if available), **Photo library**.
  - Grid of recent photos/videos; multi-select (e.g. up to 5–10 per message, configurable).
  - Selected items: checkmark overlay, order 1–5; reorder by drag (optional).
- **Footer:** “Add X photo(s)” or “Add X photo(s) and 1 video” (if mixed); **Cancel** / **Add**.
- **After Add:** Thumbnails appear **below** the text input (or above send); each with × to remove. Send attaches all to one message (or split by product rule).

**Interaction rules:**

- **Size/type limits:** Max file size (e.g. 20MB), types: image/*, video/*; show error toast if over limit or unsupported type.
- **Preview before send:** Always show thumbnail; tap thumbnail → full preview with option to remove.

**Accessibility:** Picker is focusable; “Add photo” / “Add video” labels; selected state announced; Cancel and Add as primary actions.

---

### 1.5 Paid message (optional)

**Purpose:** Let creators charge for a single message (e.g. custom content or tip).

**Flow:**

- **Creator:** In composer, optional “Request $X for this message” (dropdown or toggle); set amount; send.
- **Fan sees:** Locked bubble: “Pay $X to unlock this message” + **Unlock** button.
- **Unlock:** Tap → small modal/sheet: “Pay $X to [Creator]?” + payment method + **Pay**; on success, bubble unlocks and content is visible.
- **In thread list:** Preview text: “Paid message” so fan doesn’t see content before paying.

**Constraints:** Amount min/max (e.g. $1–$200); one paid message at a time in UI; platform fee per product.

---

### 1.6 Safety actions (block / report)

**Purpose:** Anti-harassment controls that are easy to find and use.

**Block:**

- **Where:** Thread overflow (⋮) → **Block [Name]**; optional “Block and report”.
- **Confirm:** “Block [Name]? They won’t be able to message you or see your profile.” → **Cancel** / **Block**.
- **After block:** Thread removed from list; user sees “You blocked [Name].” in thread or toast; option to “Unblock” in Settings → Blocked users.

**Report:**

- **Where:** Thread overflow → **Report**.
- **Flow:** Reason (harassment, spam, scam, other); optional text; **Submit**.
- **Feedback:** “Report submitted. We’ll review and get back if needed.” No promise of immediate reply.

**Blocked users list (Settings):**

- List of blocked accounts; **Unblock** per row. No way to message until unblocked.

**Interaction rules:**

- Block is immediate and reversible; report is async and may trigger trust & safety review.
- Creator and fan both have same block/report; no “creator-only” DMs bypass.

---

## 2. Subscriber badges in thread

- **In list row:** Small pill “Subscriber” or icon (e.g. star/crown) next to name so creators can prioritize and recognize supporters.
- **In thread header:** Same pill or icon + optional tooltip: “They’re subscribed to you.”
- **Visual:** One consistent component (e.g. `CreatorBadge` or `SubscriberBadge`); subtle, not noisy; sufficient contrast for a11y.

---

## 3. Anti-harassment controls (summary)

- **Message requests:** Unknown or non-subscriber messages go to Requests; creator can accept/decline/block without replying.
- **Block:** One-tap from thread; confirmation; thread hidden; reversible in Settings.
- **Report:** In-thread report with reason + optional details; clear “submitted” state.
- **Rate limits:** Hard limits on messages per time window; see Section 5.
- **No unsolicited media in preview:** In requests, show “Photo” or “Message” instead of auto-loading media until accepted (optional policy).

---

## 4. Media attachments with previews

- **In composer:** Thumbnails below input; remove via ×; max N items; order preserved.
- **In bubble:** Inline thumbnail (e.g. max 240px); tap → full-screen/lightbox with zoom, optional download.
- **Loading:** Skeleton or blur placeholder until loaded; error state: broken-image icon + “Couldn’t load” + retry if applicable.
- **Types:** Images (JPEG, PNG, WebP, GIF); video (MP4, etc.) with play icon overlay and duration if available.

---

## 5. Rate limit UX

**Goal:** Prevent spam and abuse without feeling punitive to normal users.

**Behavior:**

- **Hard limit:** e.g. 20 messages per 5 minutes per conversation (configurable).
- **When approaching limit:** After e.g. 15 messages in 5 min, show subtle inline hint: “You’re sending a lot of messages. Slow down to avoid limits.”
- **When at limit:** Disable send button; message under input: “You’ve hit the message limit. Try again in X minutes.” (Show countdown if possible.)
- **No aggressive modal:** Prefer inline, non-blocking copy so the thread stays readable.

**Accessibility:** Announce when limit is reached (live region); countdown or “try again in X min” readable by screen readers.

---

## 6. Empty / loading / error states

| Context        | Empty state | Loading state | Error state |
|----------------|------------|---------------|-------------|
| **Inbox (requests)** | “No message requests” + short explanation | Skeleton rows (avatar + 2 lines) | “Couldn’t load requests” + Retry |
| **Inbox (conversations)** | “No conversations yet” + CTA to discover creators | Skeleton rows | “Couldn’t load messages” + Retry |
| **Thread** | N/A (at least one message or request) | Skeleton bubbles (left/right alternating) | “Couldn’t load conversation” + Retry |
| **Attachment picker** | “No photos” (for library) | Spinner or skeleton grid | “Couldn’t load photos” / “Permission denied” |
| **Send message** | — | Send button spinner or “Sending…” | “Message failed to send” + Retry; keep draft |
| **Paid unlock** | — | “Processing…” on Pay | “Payment failed” + retry or change method |

**Principles:** One primary action (Retry, Unlock, etc.); short copy; no dead ends.

---

## 7. Accessibility notes

- **Keyboard (desktop):** Inbox list focusable (arrow keys); Enter opens thread; focus moves to composer when thread opens; Escape closes picker/modal.
- **Focus order:** Back → Header (name, menu) → Message list (optional “Skip to composer”) → Composer → Attachment → Send.
- **Focus visibility:** Clear 2px focus ring (e.g. brand color); no focus-only-on-keyboard (always show for clarity).
- **Labels:** “Messages”, “Message requests”, “Conversations”; “Send message”; “Add attachment”; “Accept/Decline request”; “Block”, “Report”; “Pay $X to unlock”.
- **Live regions:** New message in thread (optional, can be muted); “Message sent”; “Limit reached, try again in X minutes”; “Request accepted”.
- **Contrast:** Message bubbles and badges meet WCAG AA (4.5:1 for text, 3:1 for large text/graphics).
- **Reduced motion:** Prefer opacity/fade for new messages; avoid auto-scroll animation that can’t be disabled; respect `prefers-reduced-motion` for transitions.
- **Screen reader:** List items as “Conversation with [Name], subscriber, last message preview, time”; thread messages as “[Name], [time]: [content]” or “You, [time]: [content]”.

---

## 8. Component checklist (reference)

- **Inbox:** Conversation list, request row (with Accept/Decline), section headers, unread indicator.
- **Thread:** Message bubble (text, media, paid lock), thread header with overflow menu, composer with attachment + send.
- **Modals/sheets:** Request gate banner, block confirm, report reason, paid unlock confirm, attachment picker.
- **Shared:** Subscriber badge, skeleton (list + bubbles), toast (send failed, limit reached), empty state illustrations/copy.

This spec can be implemented incrementally: inbox + thread + requests first, then attachments, then paid message and richer safety flows.
