#!/usr/bin/env node
/**
 * Automated YouTube promo video generator for Zinovia Fans.
 *
 * Steps:
 *   1. Captures app screenshots via Playwright (headless Chromium)
 *   2. Generates text overlay frames with sharp (libvips)
 *   3. Assembles everything into an MP4 with ffmpeg (transitions, timing, music)
 *
 * Usage:
 *   node scripts/video/generate.mjs
 *
 * Output:
 *   scripts/video/output/zinovia-promo.mp4
 */

import { chromium } from "playwright";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { mkdirSync, existsSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = join(__dirname, "frames");
const OUTPUT_DIR = join(__dirname, "output");
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const SITE = "https://zinovia.ai";

ffmpeg.setFfmpegPath(ffmpegPath);

// ── Brand colors ──────────────────────────────────────────────────────────
const BRAND = {
  bg: "#0c0a0f",
  card: "#141119",
  pink: "#ec4899",
  purple: "#c084fc",
  white: "#f5f5fa",
  green: "#10b981",
  gold: "#d4af37",
};

// ── Scene definitions ─────────────────────────────────────────────────────
const SCENES = [
  // Scene 1: Hook / Title
  {
    id: "01-hook",
    type: "title",
    duration: 4,
    lines: ["Your content.", "Your fans.", "Your money."],
    subtitle: "zinovia.ai",
  },
  // Scene 2: Problem
  {
    id: "02-problem",
    type: "title",
    duration: 4,
    lines: ["Slow payouts ✗", "No AI tools ✗", "No content protection ✗"],
    subtitle: "Other platforms hold you back.",
  },
  // Scene 3: Homepage hero
  {
    id: "03-homepage",
    type: "screenshot",
    duration: 5,
    url: SITE,
    waitFor: 3000,
    scrollY: 0,
    overlay: "Meet Zinovia Fans — AI-Powered Creator Platform",
  },
  // Scene 4: Homepage features scroll
  {
    id: "04-features-scroll",
    type: "screenshot",
    duration: 4,
    url: SITE,
    waitFor: 2000,
    scrollY: 900,
    overlay: "Subscriptions • Tips • Pay-Per-View • AI Tools",
  },
  // Scene 5: Signup page
  {
    id: "05-signup",
    type: "screenshot",
    duration: 5,
    url: `${SITE}/signup`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "Sign up in 30 seconds — Creator or Fan",
  },
  // Scene 6: Features page
  {
    id: "06-features",
    type: "screenshot",
    duration: 4,
    url: `${SITE}/features`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "Everything you need to monetize your content",
  },
  // Scene 7: AI page
  {
    id: "07-ai",
    type: "screenshot",
    duration: 5,
    url: `${SITE}/ai`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "AI Studio — Your Creative Superpower",
  },
  // Scene 8: Fast payouts
  {
    id: "08-payouts",
    type: "screenshot",
    duration: 4,
    url: `${SITE}/fast-payouts`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "48-Hour Payouts — Not 30 Days",
  },
  // Scene 9: Content protection
  {
    id: "09-security",
    type: "screenshot",
    duration: 4,
    url: `${SITE}/content-protection`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "AES-256 Encryption • KYC Verified • AI Safety",
  },
  // Scene 10: Alternatives page
  {
    id: "10-alternatives",
    type: "screenshot",
    duration: 4,
    url: `${SITE}/alternatives`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "The #1 Alternative to OnlyFans",
  },
  // Scene 11: Creator discovery
  {
    id: "11-creators",
    type: "screenshot",
    duration: 4,
    url: `${SITE}/creators`,
    waitFor: 3000,
    scrollY: 0,
    overlay: "Discover creators already earning on Zinovia",
  },
  // Scene 12: How it works
  {
    id: "12-how",
    type: "screenshot",
    duration: 4,
    url: `${SITE}/how-it-works`,
    waitFor: 2000,
    scrollY: 0,
    overlay: "3 Simple Steps to Start Earning",
  },
  // Scene 13: CTA
  {
    id: "13-cta",
    type: "title",
    duration: 5,
    lines: ["Free to join", "No setup fees", "Start earning today"],
    subtitle: "zinovia.ai/signup",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a solid-color PNG with centered text using sharp */
async function createTitleFrame(outputPath, { lines, subtitle, width, height }) {
  // Build an SVG with the text
  const lineHeight = 72;
  const startY = height / 2 - (lines.length * lineHeight) / 2;

  const textElements = lines
    .map((line, i) => {
      const color = line.includes("✗") ? "#ef4444" : BRAND.white;
      return `<text x="${width / 2}" y="${startY + i * lineHeight}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="700" fill="${color}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const subtitleEl = subtitle
    ? `<text x="${width / 2}" y="${startY + lines.length * lineHeight + 40}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="400" fill="${BRAND.pink}">${escapeXml(subtitle)}</text>`
    : "";

  // Gradient accent bar at bottom
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${BRAND.pink}"/>
        <stop offset="100%" style="stop-color:${BRAND.purple}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="${BRAND.bg}"/>
    <rect y="${height - 4}" width="${width}" height="4" fill="url(#grad)"/>
    ${textElements}
    ${subtitleEl}
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

/** Add a text overlay bar to a screenshot */
async function addOverlay(inputPath, outputPath, text) {
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const w = meta.width || WIDTH;
  const h = meta.height || HEIGHT;

  // Semi-transparent bar at bottom with text
  const barH = 80;
  const svg = `<svg width="${w}" height="${barH}">
    <rect width="${w}" height="${barH}" fill="rgba(12,10,15,0.85)" rx="0"/>
    <text x="${w / 2}" y="${barH / 2 + 8}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="${BRAND.white}">${escapeXml(text)}</text>
  </svg>`;

  await sharp(inputPath)
    .composite([
      {
        input: Buffer.from(svg),
        top: h - barH,
        left: 0,
      },
    ])
    .png()
    .toFile(outputPath);
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Main pipeline ─────────────────────────────────────────────────────────

async function captureScreenshots() {
  console.log("🎬 Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });

  for (const scene of SCENES) {
    if (scene.type !== "screenshot") continue;

    console.log(`📸 Capturing ${scene.id}: ${scene.url}`);
    const page = await context.newPage();

    try {
      await page.goto(scene.url, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      // networkidle can timeout on some pages, try domcontentloaded
      try {
        await page.goto(scene.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch {
        console.warn(`  ⚠️ Could not load ${scene.url}, using fallback`);
      }
    }

    // Wait for rendering
    await page.waitForTimeout(scene.waitFor || 2000);

    // Scroll if needed
    if (scene.scrollY) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scene.scrollY);
      await page.waitForTimeout(500);
    }

    const rawPath = join(FRAMES_DIR, `${scene.id}-raw.png`);
    const finalPath = join(FRAMES_DIR, `${scene.id}.png`);

    await page.screenshot({ path: rawPath, fullPage: false });

    // Add overlay text
    if (scene.overlay) {
      await addOverlay(rawPath, finalPath, scene.overlay);
    } else {
      const { copyFileSync } = await import("fs");
      copyFileSync(rawPath, finalPath);
    }

    await page.close();
  }

  await browser.close();
  console.log("✅ Screenshots captured");
}

async function generateTitleFrames() {
  console.log("🎨 Generating title frames...");
  for (const scene of SCENES) {
    if (scene.type !== "title") continue;
    const outputPath = join(FRAMES_DIR, `${scene.id}.png`);
    await createTitleFrame(outputPath, {
      lines: scene.lines,
      subtitle: scene.subtitle,
      width: WIDTH,
      height: HEIGHT,
    });
    console.log(`  ✓ ${scene.id}`);
  }
  console.log("✅ Title frames generated");
}

async function assembleVideo() {
  console.log("🎥 Assembling video...");

  // Build ffmpeg concat filter
  // Each scene: show image for N seconds with fade transitions
  const inputs = [];
  const filterParts = [];
  const concatInputs = [];

  SCENES.forEach((scene, i) => {
    const framePath = join(FRAMES_DIR, `${scene.id}.png`);
    if (!existsSync(framePath)) {
      console.warn(`  ⚠️ Missing frame: ${framePath}`);
      return;
    }
    inputs.push(framePath);

    // Loop image for scene duration, add fade in/out
    const fadeIn = i === 0 ? 0 : 0.5;
    const fadeOutStart = scene.duration - 0.5;

    filterParts.push(
      `[${i}:v]loop=loop=${scene.duration * FPS}:size=1:start=0,setpts=N/${FPS}/TB,` +
        `fade=t=in:st=0:d=${fadeIn},` +
        `fade=t=out:st=${fadeOutStart}:d=0.5,` +
        `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
        `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x0c0a0f` +
        `[v${i}]`
    );
    concatInputs.push(`[v${i}]`);
  });

  const totalDuration = SCENES.reduce((sum, s) => sum + s.duration, 0);
  const filterComplex =
    filterParts.join("; ") +
    `; ${concatInputs.join("")}concat=n=${concatInputs.length}:v=1:a=0[outv]`;

  const outputPath = join(OUTPUT_DIR, "zinovia-promo.mp4");

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();

    inputs.forEach((input) => {
      cmd = cmd.input(input);
    });

    cmd
      .complexFilter(filterComplex)
      .outputOptions([
        "-map", "[outv]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-r", String(FPS),
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("start", (cmdLine) => {
        console.log("  ffmpeg command:", cmdLine.slice(0, 200) + "...");
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r  Progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on("end", () => {
        console.log(`\n✅ Video saved to: ${outputPath}`);
        console.log(`   Duration: ~${totalDuration}s`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("❌ ffmpeg error:", err.message);
        reject(err);
      })
      .run();
  });
}

/** Generate a vertical (9:16) version for Shorts/Reels/TikTok */
async function generateVerticalCut() {
  console.log("📱 Generating vertical cut (9:16)...");

  const inputPath = join(OUTPUT_DIR, "zinovia-promo.mp4");
  const outputPath = join(OUTPUT_DIR, "zinovia-promo-vertical.mp4");

  if (!existsSync(inputPath)) {
    console.warn("  ⚠️ Main video not found, skipping vertical cut");
    return;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0c0a0f`,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-t", "30",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("end", () => {
        console.log(`✅ Vertical video saved to: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("❌ Vertical cut error:", err.message);
        reject(err);
      })
      .run();
  });
}

// ── Run ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  ZINOVIA FANS — Promo Video Generator");
  console.log("═══════════════════════════════════════════════\n");

  // Create output directories
  mkdirSync(FRAMES_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Generate title frames
  await generateTitleFrames();

  // Step 2: Capture app screenshots
  await captureScreenshots();

  // Step 3: Assemble final video
  await assembleVideo();

  // Step 4: Generate vertical cut
  await generateVerticalCut();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  DONE! Files in: scripts/video/output/");
  console.log("═══════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Add voiceover: use ElevenLabs (free) with the script");
  console.log("  2. Add music: download from Uppbeat (free)");
  console.log("  3. Combine: ffmpeg -i zinovia-promo.mp4 -i voiceover.mp3 -i music.mp3 \\");
  console.log("       -filter_complex '[1:a]volume=1[vo];[2:a]volume=0.15[bg];[vo][bg]amix=2[a]' \\");
  console.log("       -map 0:v -map '[a]' -shortest final.mp4");
  console.log("  4. Upload to YouTube with metadata from video-script-youtube.md");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
