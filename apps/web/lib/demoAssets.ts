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
