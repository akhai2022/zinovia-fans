/**
 * Static demo asset paths for creators (used when no media from API).
 * Files live in public/creators/demo/.
 */
export const DEMO_ASSETS = {
  avatar: {
    256: "/creators/demo/avatar_256.png",
    512: "/creators/demo/avatar_512.png",
    1024: "/creators/demo/avatar_1024.png",
  },
  banner: {
    "1500x500": "/creators/demo/banner_1500x500.png",
    "1200x400": "/creators/demo/banner_1200x400.png",
  },
  tile: {
    600: "/creators/demo/tile_600.png",
    800: "/creators/demo/tile_800.png",
  },
  locked: "/creators/demo/locked_800.png",
} as const;

/**
 * Video walkthrough assets.
 * To activate: drop MP4 files at the `src` paths in public/demo/.
 * The poster SVG is shown until the user clicks play.
 */
export const DEMO_VIDEOS = {
  creator: {
    src: "/demo/creator-walkthrough.mp4",
    poster: "/demo/creator-walkthrough-poster.svg",
  },
  fan: {
    src: "/demo/fan-walkthrough.mp4",
    poster: "/demo/fan-walkthrough-poster.svg",
  },
} as const;

/** Step screenshot placeholders per walkthrough. */
export const DEMO_STEPS = {
  creator: [
    "/demo/steps/creator-01-signup.svg",
    "/demo/steps/creator-02-kyc.svg",
    "/demo/steps/creator-03-profile.svg",
    "/demo/steps/creator-04-pricing.svg",
    "/demo/steps/creator-05-posts.svg",
    "/demo/steps/creator-06-vault.svg",
    "/demo/steps/creator-07-collections.svg",
    "/demo/steps/creator-08-earnings.svg",
    "/demo/steps/creator-09-messages.svg",
    "/demo/steps/creator-10-ai.svg",
    "/demo/steps/creator-11-language.svg",
  ],
  fan: [
    "/demo/steps/fan-01-signup.svg",
    "/demo/steps/fan-02-discover.svg",
    "/demo/steps/fan-03-profiles.svg",
    "/demo/steps/fan-04-feed.svg",
    "/demo/steps/fan-05-ppv.svg",
    "/demo/steps/fan-06-messages.svg",
    "/demo/steps/fan-07-billing.svg",
    "/demo/steps/fan-08-notifications.svg",
    "/demo/steps/fan-09-language.svg",
  ],
} as const;
