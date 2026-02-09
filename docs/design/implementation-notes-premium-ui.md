# Premium UI Implementation Notes

**Implementation order (from design docs):**  
1. Landing (full spec: hero → how it works → social proof → feature grid → testimonials → pricing teaser → trust → FAQ → footer IA)  
2. Creator profile (bio with Read more, tags structure, what you get, grid, sticky bar, subscribe sheet)  
3. Feed (media-first cards, locked overlay, skeleton, empty state, card actions placeholder)  
4. Post composer (options, draft, preview) — deferred  
5. DMs (inbox, thread, etc.) — see `dms-feature-spec.md`

## File tree changes

```
apps/web/
├── app/
│   ├── page.tsx                    # Updated: landing sections (hero, how it works, features, CTA, footer)
│   ├── error.tsx                   # New: global error boundary
│   ├── feed/
│   │   └── page.tsx                # Updated: FeedCard, skeletons, empty state
│   └── c/
│       └── [handle]/
│           └── page.tsx           # New: premium creator profile + grid + SubscribeSheet
├── components/
│   ├── premium/                    # Premium design system components
│   │   ├── index.ts
│   │   ├── BioExpand.tsx           # Bio with "Read more" (creator profile)
│   │   ├── CreatorHeader.tsx
│   │   ├── LockedOverlay.tsx
│   │   ├── MediaGrid.tsx
│   │   ├── PricingCard.tsx
│   │   └── SubscribeSheet.tsx
│   └── ui/
│       └── accordion.tsx           # FAQ accordion (landing)
├── features/
│   └── posts/
│       └── components/
│           └── FeedCard.tsx        # New: feed card with locked overlay pattern
├── types/
│   └── creator.ts                 # New: PostItem, CreatorProfile, SubscriptionOffer, DEFAULT_SUBSCRIPTION_OFFER
├── app/globals.css                 # Updated: premium CSS variables (tokens)
└── tailwind.config.ts              # Updated: premium theme (colors, radii, shadow, font, motion)
```

## Component summary

| Component | Purpose |
|-----------|---------|
| **LockedOverlay** | Wraps content with a gradient + lock icon + label; optional Unlock button. Used on grid cells and feed cards. |
| **CreatorHeader** | Avatar + name + handle + optional badge (verified/subscriber) + optional bio. Used in profile and feed cards. |
| **MediaGrid** | 2/3/4-column grid of post cells with LockedOverlay; empty state when no posts. |
| **PricingCard** | Plan price, perks list, “DM included”, cancel clarity, primary CTA, trust line. |
| **SubscribeSheet** | Portal modal: bottom sheet on mobile, centered on desktop. Uses PricingCard; Escape to close, focus trap. |
| **FeedCard** | Feed item: CreatorHeader + LockedOverlay-wrapped body (caption, media placeholder, meta). |

## Styling tokens

- **globals.css**: Premium variables under `:root` (--font-size-h1, --neutral-*, --accent-500/600/700, --radius-sm/md/lg/xl, --shadow-xs..xl, --duration-fast/normal, --ease-out, --bg-overlay). Desktop type scale and `prefers-reduced-motion` overrides included.
- **Tailwind**: `theme.extend` maps to those variables: `colors.neutral`, `colors.accent[50|500|600|700]`, `colors.success`, `colors.error`, `borderRadius.premium-*`, `fontSize.premium-*`, `boxShadow.premium-*`, `transitionDuration.fast/normal`, `transitionTimingFunction.premium-out/in-out`.

## Mock data and types

- **types/creator.ts**: `PostItem`, `CreatorProfile`, `CreatorSummary`, `SubscriptionOffer`, `DEFAULT_SUBSCRIPTION_OFFER`. Align with API/contracts; used by premium components and `/c/[handle]`.
- Creator profile and feed use real API (CreatorsService, FeedService, BillingService). Subscribe sheet uses `DEFAULT_SUBSCRIPTION_OFFER` when plan is not yet returned by API.

## Performance

- **Images**: Use `next/image` for creator avatar and post thumbnails when URLs are available (e.g. signed media URLs). Placeholders used until then.
- **Skeletons**: Feed and creator profile use skeleton UIs (FeedSkeleton, grid placeholders) to avoid layout shift and signal loading.
- **Suspense**: Feed and `/c/[handle]` are client components with `useEffect` data fetch. For SSR, wrap in `<Suspense>` and use server data fetching where appropriate.
- **Subscribe sheet**: Rendered via `createPortal` only when `open`; no DOM when closed. Body scroll locked while open.

## Accessibility

- **Focus**: `:focus-visible` ring in globals; buttons and links use `focus-visible:ring-2` and `ring-offset-2`.
- **Labels**: SubscribeSheet has `aria-labelledby="subscribe-sheet-title"` and `aria-modal="true"`. LockedOverlay unlock button has `aria-label="Subscribe to unlock this content"`. Feed and grid use `aria-label` where needed.
- **Reduced motion**: Token `--duration-fast` and `--duration-normal` set to `0ms` in `prefers-reduced-motion: reduce` in globals.

## Basic test (example)

Add Vitest + React Testing Library, then for example:

```tsx
// components/premium/__tests__/LockedOverlay.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LockedOverlay } from "../LockedOverlay";

describe("LockedOverlay", () => {
  it("shows overlay and label when locked", () => {
    render(
      <LockedOverlay locked label="Subscriber only">
        <div>Content</div>
      </LockedOverlay>
    );
    expect(screen.getByText("Subscriber only")).toBeInTheDocument();
  });

  it("hides overlay when not locked", () => {
    render(
      <LockedOverlay locked={false} label="Subscriber only">
        <div>Content</div>
      </LockedOverlay>
    );
    expect(screen.queryByText("Subscriber only")).not.toBeInTheDocument();
  });

  it("calls onUnlockClick when Unlock is clicked", async () => {
    const onUnlock = jest.fn();
    render(
      <LockedOverlay locked label="Locked" onUnlockClick={onUnlock}>
        <div>Content</div>
      </LockedOverlay>
    );
    await userEvent.click(screen.getByRole("button", { name: /subscribe to unlock/i }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
```

## Routes

- **/** — Landing (hero, how it works, feature grid, CTA, footer).
- **/c/[handle]** — Premium creator profile: banner, CreatorHeader, “What you get”, MediaGrid, sticky subscribe bar (mobile), SubscribeSheet.
- **/feed** — Feed with FeedCard list; locked overlay when `visibility === "SUBSCRIBERS"`; skeletons and empty state.
- **/creators/[handle]** — Existing creator page (unchanged).
