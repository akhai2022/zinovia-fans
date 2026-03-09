#!/usr/bin/env python3
"""
Zinovia Fans — Automated YouTube Promo Video Generator.

Captures live app screenshots, generates AI voiceover, creates text overlays,
and assembles everything into a polished MP4 with transitions and music.

Usage:
    source scripts/video/venv/bin/activate
    python scripts/video/generate_video.py

Output:
    scripts/video/output/zinovia-final.mp4          (1920x1080 landscape)
    scripts/video/output/zinovia-final-vertical.mp4  (1080x1920 vertical)
"""

import asyncio
import os
import math
import wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright
from moviepy import (
    ImageClip,
    AudioFileClip,
    TextClip,
    CompositeVideoClip,
    CompositeAudioClip,
    concatenate_videoclips,
)
from moviepy.video.fx import CrossFadeIn, CrossFadeOut
import edge_tts
import numpy as np

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
FRAMES_DIR = BASE_DIR / "frames"
AUDIO_DIR = BASE_DIR / "audio"
OUTPUT_DIR = BASE_DIR / "output"
for d in (FRAMES_DIR, AUDIO_DIR, OUTPUT_DIR):
    d.mkdir(exist_ok=True)

# ── Config ─────────────────────────────────────────────────────────────────
WIDTH = 1920
HEIGHT = 1080
FPS = 30
SITE = "https://zinovia.ai"
TTS_VOICE = "en-US-AndrewMultilingualNeural"  # Warm, confident male voice

# Brand colors
BG_COLOR = (12, 10, 15)
PINK = (236, 72, 153)
PURPLE = (192, 132, 252)
WHITE = (245, 245, 250)
RED = (239, 68, 68)
GREEN = (16, 185, 129)

# ── Scenes ─────────────────────────────────────────────────────────────────
SCENES = [
    # (id, type, duration, url/None, scroll, overlay_text, voiceover)
    {
        "id": "01-hook",
        "type": "title",
        "duration": 4,
        "lines": ["Your content.", "Your fans.", "Your money."],
        "subtitle": "zinovia.ai",
        "voiceover": "What if you could earn from your fanbase, starting today?",
    },
    {
        "id": "02-problem",
        "type": "title",
        "duration": 5,
        "lines": ["Slow payouts", "No AI tools", "No content protection"],
        "subtitle": "Other platforms hold you back.",
        "voiceover": "Other platforms make you wait weeks for payouts, offer zero tools, and leave your content unprotected.",
    },
    {
        "id": "03-homepage",
        "type": "screenshot",
        "duration": 5,
        "url": SITE,
        "scroll": 0,
        "overlay": "Meet Zinovia Fans — AI-Powered Creator Platform",
        "voiceover": "Zinovia Fans is the AI-powered subscription platform built for creators who want more.",
    },
    {
        "id": "04-features-scroll",
        "type": "screenshot",
        "duration": 4,
        "url": SITE,
        "scroll": 900,
        "overlay": "Subscriptions — Tips — Pay-Per-View — AI Tools",
        "voiceover": "Subscriptions, tips, pay-per-view, and powerful AI tools. All in one platform.",
    },
    {
        "id": "05-signup",
        "type": "screenshot",
        "duration": 5,
        "url": f"{SITE}/signup",
        "scroll": 0,
        "overlay": "Sign up in 30 seconds — Creator or Fan",
        "voiceover": "Sign up in 30 seconds. Choose creator or fan, and you're in.",
    },
    {
        "id": "06-features",
        "type": "screenshot",
        "duration": 4,
        "url": f"{SITE}/features",
        "scroll": 0,
        "overlay": "Everything you need to monetize your content",
        "voiceover": "Everything you need to monetize your content, built right into the platform.",
    },
    {
        "id": "07-ai",
        "type": "screenshot",
        "duration": 5,
        "url": f"{SITE}/ai",
        "scroll": 0,
        "overlay": "AI Studio — Your Creative Superpower",
        "voiceover": "AI writes your captions, generates promos, creates cartoon avatars, and translates to 11 languages.",
    },
    {
        "id": "08-payouts",
        "type": "screenshot",
        "duration": 5,
        "url": f"{SITE}/fast-payouts",
        "scroll": 0,
        "overlay": "48-Hour Payouts — Not 30 Days",
        "voiceover": "See your earnings in real time. Get paid in 48 hours, not 30 days.",
    },
    {
        "id": "09-security",
        "type": "screenshot",
        "duration": 4,
        "url": f"{SITE}/content-protection",
        "scroll": 0,
        "overlay": "AES-256 Encryption — KYC Verified — AI Safety",
        "voiceover": "Your content is encrypted, your identity verified, and your privacy protected. Always.",
    },
    {
        "id": "10-alternatives",
        "type": "screenshot",
        "duration": 4,
        "url": f"{SITE}/alternatives",
        "scroll": 0,
        "overlay": "The Best Alternative to OnlyFans",
        "voiceover": "Looking for an alternative? Zinovia gives you more tools, faster payouts, and better security.",
    },
    {
        "id": "11-creators",
        "type": "screenshot",
        "duration": 4,
        "url": f"{SITE}/creators",
        "scroll": 0,
        "overlay": "Discover creators already earning on Zinovia",
        "voiceover": "Creators are already building their audience and earning on Zinovia.",
    },
    {
        "id": "12-how",
        "type": "screenshot",
        "duration": 4,
        "url": f"{SITE}/how-it-works",
        "scroll": 0,
        "overlay": "3 Simple Steps to Start Earning",
        "voiceover": "Three simple steps. Sign up, verify, and start posting. It's that easy.",
    },
    {
        "id": "13-cta",
        "type": "title",
        "duration": 6,
        "lines": ["Free to join.", "No setup fees.", "Start earning today."],
        "subtitle": "zinovia.ai/signup",
        "voiceover": "Join Zinovia Fans for free. Start earning from your content today. Link in the description.",
    },
]


# ── Title frame generation (Pillow) ───────────────────────────────────────

def load_font(size: int) -> ImageFont.FreeTypeFont:
    """Try to load a good sans-serif font, fall back to default."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def create_title_frame(output_path: Path, lines: list[str], subtitle: str):
    """Create a branded title card with centered text."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Gradient bar at bottom (pink → purple)
    for x in range(WIDTH):
        ratio = x / WIDTH
        r = int(PINK[0] * (1 - ratio) + PURPLE[0] * ratio)
        g = int(PINK[1] * (1 - ratio) + PURPLE[1] * ratio)
        b = int(PINK[2] * (1 - ratio) + PURPLE[2] * ratio)
        draw.line([(x, HEIGHT - 6), (x, HEIGHT)], fill=(r, g, b))

    font_big = load_font(60)
    font_sub = load_font(32)

    # Calculate total text height
    line_height = 80
    total_h = len(lines) * line_height
    start_y = (HEIGHT - total_h) // 2 - 30

    for i, line in enumerate(lines):
        color = RED if any(c in line for c in ["✗", "Slow", "No "]) else WHITE
        bbox = draw.textbbox((0, 0), line, font=font_big)
        tw = bbox[2] - bbox[0]
        x = (WIDTH - tw) // 2
        y = start_y + i * line_height
        draw.text((x, y), line, fill=color, font=font_big)

    if subtitle:
        bbox = draw.textbbox((0, 0), subtitle, font=font_sub)
        tw = bbox[2] - bbox[0]
        x = (WIDTH - tw) // 2
        y = start_y + len(lines) * line_height + 30
        draw.text((x, y), subtitle, fill=PINK, font=font_sub)

    img.save(str(output_path), "PNG")


def add_overlay_bar(input_path: Path, output_path: Path, text: str):
    """Add a semi-transparent text bar at the bottom of a screenshot."""
    img = Image.open(str(input_path)).convert("RGBA")
    # Resize to target resolution
    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)

    # Create overlay bar
    bar_h = 80
    overlay = Image.new("RGBA", (WIDTH, bar_h), (12, 10, 15, 220))
    draw = ImageDraw.Draw(overlay)

    font = load_font(28)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (WIDTH - tw) // 2
    y = (bar_h - th) // 2
    draw.text((x, y), text, fill=WHITE, font=font)

    # Paste overlay onto image
    img.paste(overlay, (0, HEIGHT - bar_h), overlay)
    img.convert("RGB").save(str(output_path), "PNG")


# ── Screenshot capture (Playwright) ───────────────────────────────────────

async def capture_screenshots():
    """Capture live app screenshots using headless Chromium."""
    print("🎬 Launching browser...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1,
            color_scheme="dark",
        )

        for scene in SCENES:
            if scene["type"] != "screenshot":
                continue

            url = scene["url"]
            print(f"  📸 {scene['id']}: {url}")
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    print(f"    ⚠️ Could not load {url}")

            await page.wait_for_timeout(2500)

            if scene.get("scroll", 0) > 0:
                await page.evaluate(f"window.scrollTo({{top: {scene['scroll']}, behavior: 'instant'}})")
                await page.wait_for_timeout(800)

            raw_path = FRAMES_DIR / f"{scene['id']}-raw.png"
            final_path = FRAMES_DIR / f"{scene['id']}.png"

            await page.screenshot(path=str(raw_path))

            if scene.get("overlay"):
                add_overlay_bar(raw_path, final_path, scene["overlay"])
            else:
                import shutil
                shutil.copy(str(raw_path), str(final_path))

            await page.close()

        await browser.close()
    print("✅ Screenshots captured")


# ── Voiceover generation (edge-tts) ──────────────────────────────────────

async def generate_voiceover():
    """Generate AI voiceover for each scene using Microsoft Edge TTS (free)."""
    print("🎙️ Generating voiceover...")

    for scene in SCENES:
        vo_text = scene.get("voiceover", "")
        if not vo_text:
            continue

        output_path = AUDIO_DIR / f"{scene['id']}.mp3"
        if output_path.exists():
            print(f"  ⏭️ {scene['id']} (cached)")
            continue

        print(f"  🔊 {scene['id']}: {vo_text[:50]}...")
        communicate = edge_tts.Communicate(vo_text, TTS_VOICE, rate="+5%")
        await communicate.save(str(output_path))

    # Generate combined full voiceover
    print("  🔗 Combining all voiceover segments...")
    full_text = " ... ".join(s.get("voiceover", "") for s in SCENES if s.get("voiceover"))
    full_path = AUDIO_DIR / "full-voiceover.mp3"
    communicate = edge_tts.Communicate(full_text, TTS_VOICE, rate="+5%")
    await communicate.save(str(full_path))

    print("✅ Voiceover generated")


# ── Background music generation (numpy) ──────────────────────────────────

def generate_background_music(duration: float) -> str:
    """Generate a subtle electronic/lo-fi background beat using numpy.

    Creates a layered ambient track with:
    - Soft bass pulse (kick pattern)
    - Warm pad chords (pink + purple brand tones)
    - Hi-hat rhythm
    - Gentle reverb-like tail
    """
    print("  🎵 Generating background music...")
    sr = 44100
    n_samples = int(sr * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)

    output = np.zeros(n_samples, dtype=np.float64)

    # ── BPM and timing ──
    bpm = 100
    beat_dur = 60.0 / bpm  # seconds per beat
    bar_dur = beat_dur * 4  # 4/4 time

    # ── 1. Soft bass kick (sine burst on beats 1 and 3) ──
    kick = np.zeros(n_samples)
    for beat_time in np.arange(0, duration, beat_dur * 2):
        idx_start = int(beat_time * sr)
        kick_len = int(0.15 * sr)  # 150ms decay
        idx_end = min(idx_start + kick_len, n_samples)
        k_t = np.arange(0, idx_end - idx_start) / sr
        envelope = np.exp(-k_t * 20)  # fast decay
        freq_sweep = 80 * np.exp(-k_t * 8) + 40  # pitch drop 80→40 Hz
        phase = np.cumsum(2 * np.pi * freq_sweep / sr)
        kick[idx_start:idx_end] += np.sin(phase) * envelope * 0.25
    output += kick

    # ── 2. Warm pad (layered detuned sines with slow LFO) ──
    # Chord: Am7 root notes cycling
    chord_freqs_list = [
        [220.0, 261.6, 329.6],   # Am (A3, C4, E4)
        [196.0, 246.9, 293.7],   # G  (G3, B3, D4)
        [174.6, 220.0, 261.6],   # F  (F3, A3, C4)
        [196.0, 246.9, 329.6],   # G/E (G3, B3, E4)
    ]
    pad = np.zeros(n_samples)
    chord_dur = bar_dur * 2  # each chord lasts 2 bars
    for ci, chord_freqs in enumerate(chord_freqs_list):
        c_start = int(ci * chord_dur * sr)
        c_end = int((ci + 1) * chord_dur * sr)
        # Loop chords across full duration
        for offset in range(0, n_samples, int(len(chord_freqs_list) * chord_dur * sr)):
            s = c_start + offset
            e = min(c_end + offset, n_samples)
            if s >= n_samples:
                break
            seg_t = np.arange(0, e - s) / sr
            # Fade in/out for each chord segment
            seg_dur = (e - s) / sr
            fade_env = np.ones(e - s)
            fade_samples = int(0.5 * sr)
            if e - s > fade_samples * 2:
                fade_env[:fade_samples] = np.linspace(0, 1, fade_samples)
                fade_env[-fade_samples:] = np.linspace(1, 0, fade_samples)

            for freq in chord_freqs:
                # Slight detuning for warmth
                for detune in [-1.5, 0, 1.5]:
                    f = freq + detune
                    pad[s:e] += np.sin(2 * np.pi * f * seg_t) * fade_env * 0.02

    # Slow tremolo LFO on the pad
    lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.25 * t)
    pad *= lfo
    output += pad

    # ── 3. Hi-hat (filtered noise on off-beats) ──
    hihat = np.zeros(n_samples)
    for beat_time in np.arange(beat_dur, duration, beat_dur):
        idx = int(beat_time * sr)
        hh_len = int(0.04 * sr)  # 40ms
        idx_end = min(idx + hh_len, n_samples)
        seg_len = idx_end - idx
        noise = np.random.randn(seg_len)
        # High-pass effect: differentiate
        noise = np.diff(np.concatenate([[0], noise]))[:seg_len]
        env = np.exp(-np.arange(seg_len) / sr * 60)
        hihat[idx:idx_end] += noise * env * 0.04
    output += hihat

    # ── 4. Gentle sub-bass drone ──
    sub = np.sin(2 * np.pi * 55 * t) * 0.06
    # Slow volume swell
    sub *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t)
    output += sub

    # ── Master: soft-clip and normalize ──
    output = np.tanh(output * 2) * 0.5  # soft saturation
    peak = np.max(np.abs(output))
    if peak > 0:
        output = output / peak * 0.4  # keep it low for mixing under voiceover

    # Overall fade in (2s) and fade out (3s)
    fade_in_samples = int(2.0 * sr)
    fade_out_samples = int(3.0 * sr)
    output[:fade_in_samples] *= np.linspace(0, 1, fade_in_samples)
    output[-fade_out_samples:] *= np.linspace(1, 0, fade_out_samples)

    # Save as WAV
    music_path = AUDIO_DIR / "background-music.wav"
    samples_16 = (output * 32767).astype(np.int16)
    with wave.open(str(music_path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(samples_16.tobytes())

    print(f"  ✅ Background music: {music_path} ({duration:.0f}s)")
    return str(music_path)


# ── Video assembly (moviepy) ─────────────────────────────────────────────

def assemble_video():
    """Assemble all frames + audio + music + description text into final MP4."""
    print("🎥 Assembling video...")

    clips = []
    audio_clips = []
    current_time = 0.0

    for scene in SCENES:
        frame_path = FRAMES_DIR / f"{scene['id']}.png"
        if not frame_path.exists():
            print(f"  ⚠️ Missing frame: {frame_path}")
            continue

        duration = scene["duration"]

        # Create image clip with fade
        clip = (
            ImageClip(str(frame_path))
            .resized((WIDTH, HEIGHT))
            .with_duration(duration)
        )

        # Add description text overlay (voiceover text as subtitles)
        vo_text = scene.get("voiceover", "")
        if vo_text:
            # Wrap long text
            max_chars = 55
            words = vo_text.split()
            lines = []
            current_line = ""
            for word in words:
                if len(current_line) + len(word) + 1 <= max_chars:
                    current_line = f"{current_line} {word}" if current_line else word
                else:
                    lines.append(current_line)
                    current_line = word
            if current_line:
                lines.append(current_line)
            wrapped_text = "\n".join(lines)

            try:
                txt_clip = (
                    TextClip(
                        text=wrapped_text,
                        font_size=30,
                        color="white",
                        font="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                        stroke_color="black",
                        stroke_width=1.5,
                        text_align="center",
                        size=(WIDTH - 200, None),
                        method="caption",
                    )
                    .with_duration(duration)
                    .with_position(("center", HEIGHT - 160))
                )

                # Semi-transparent background bar for readability
                txt_w, txt_h = txt_clip.size
                bg_bar = (
                    ImageClip(
                        create_text_bg(WIDTH, txt_h + 30, (12, 10, 15, 200)),
                        is_mask=False,
                    )
                    .with_duration(duration)
                    .with_position(("center", HEIGHT - 160 - 15))
                )

                clip = CompositeVideoClip(
                    [clip, bg_bar, txt_clip],
                    size=(WIDTH, HEIGHT),
                )
            except Exception as e:
                print(f"  ⚠️ Text overlay error for {scene['id']}: {e}")

        # Add fade in/out
        effects = [CrossFadeOut(0.5)]
        if len(clips) > 0:
            effects.append(CrossFadeIn(0.5))
        clip = clip.with_effects(effects)

        clips.append(clip)

        # Add per-scene voiceover audio
        audio_path = AUDIO_DIR / f"{scene['id']}.mp3"
        if audio_path.exists():
            try:
                a = AudioFileClip(str(audio_path))
                # Trim audio to fit scene duration
                if a.duration > duration:
                    a = a.subclipped(0, duration)
                a = a.with_start(current_time)
                audio_clips.append(a)
            except Exception as e:
                print(f"  ⚠️ Audio error for {scene['id']}: {e}")

        current_time += duration - 0.5  # overlap for crossfade

    # Concatenate with crossfade
    print("  🔗 Concatenating clips...")
    final_video = concatenate_videoclips(clips, method="compose", padding=-0.5)

    # Generate background music for full video duration
    music_path = generate_background_music(final_video.duration)

    # Combine audio: voiceover + background music
    print("  🔊 Mixing audio...")
    music_clip = AudioFileClip(music_path)
    if music_clip.duration > final_video.duration:
        music_clip = music_clip.subclipped(0, final_video.duration)
    # Lower music volume to sit under voiceover
    music_clip = music_clip.with_volume_scaled(0.3)

    all_audio = [music_clip]
    if audio_clips:
        all_audio.extend(audio_clips)

    combined_audio = CompositeAudioClip(all_audio)
    if combined_audio.duration > final_video.duration:
        combined_audio = combined_audio.subclipped(0, final_video.duration)
    final_video = final_video.with_audio(combined_audio)

    # Export landscape
    output_path = OUTPUT_DIR / "zinovia-final.mp4"
    print(f"  💾 Encoding landscape video ({final_video.duration:.0f}s)...")
    final_video.write_videofile(
        str(output_path),
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        bitrate="4000k",
        audio_bitrate="192k",
        logger="bar",
    )
    print(f"✅ Landscape video: {output_path}")

    # Export vertical (9:16) — first 30 seconds
    print("  📱 Generating vertical cut...")
    vertical_duration = min(30, final_video.duration)
    v_clip = final_video.subclipped(0, vertical_duration)

    # Create vertical canvas
    v_bg = ImageClip(
        create_solid_frame(1080, 1920, BG_COLOR),
        is_mask=False,
    ).with_duration(vertical_duration)

    # Scale video to fit width, center vertically
    scale_factor = 1080 / WIDTH
    v_scaled = v_clip.resized(scale_factor)
    v_y = (1920 - int(HEIGHT * scale_factor)) // 2
    v_composed = CompositeVideoClip(
        [v_bg, v_scaled.with_position(("center", v_y))],
        size=(1080, 1920),
    )
    if v_clip.audio:
        v_composed = v_composed.with_audio(v_clip.audio)

    vertical_path = OUTPUT_DIR / "zinovia-final-vertical.mp4"
    v_composed.write_videofile(
        str(vertical_path),
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        bitrate="3000k",
        audio_bitrate="192k",
        logger="bar",
    )
    print(f"✅ Vertical video: {vertical_path}")

    # Cleanup
    final_video.close()
    music_clip.close()
    for a in audio_clips:
        a.close()

    return output_path, vertical_path


def create_solid_frame(w: int, h: int, color: tuple) -> str:
    """Create a solid color PNG and return its path."""
    path = FRAMES_DIR / f"_solid_{w}x{h}.png"
    if not path.exists():
        img = Image.new("RGB", (w, h), color)
        img.save(str(path), "PNG")
    return str(path)


def create_text_bg(w: int, h: int, color: tuple) -> str:
    """Create a semi-transparent background bar for text overlays."""
    path = FRAMES_DIR / f"_textbg_{w}x{h}.png"
    if not path.exists():
        img = Image.new("RGBA", (w, h), color)
        img.save(str(path), "PNG")
    return str(path)


# ── Main ─────────────────────────────────────────────────────────────────

async def main():
    print("═" * 55)
    print("  ZINOVIA FANS — Promo Video Generator (Python)")
    print("═" * 55)
    print()

    # Step 1: Generate title frames
    print("🎨 Generating title frames...")
    for scene in SCENES:
        if scene["type"] == "title":
            path = FRAMES_DIR / f"{scene['id']}.png"
            create_title_frame(path, scene["lines"], scene.get("subtitle", ""))
            print(f"  ✓ {scene['id']}")
    print("✅ Title frames done\n")

    # Step 2: Capture screenshots
    await capture_screenshots()
    print()

    # Step 3: Generate voiceover
    await generate_voiceover()
    print()

    # Step 4: Assemble video
    landscape, vertical = assemble_video()

    # Copy to Downloads
    import shutil
    dl = Path.home() / "Téléchargements"
    if dl.exists():
        shutil.copy(str(landscape), str(dl / landscape.name))
        shutil.copy(str(vertical), str(dl / vertical.name))
        print(f"\n📁 Copied to {dl}/")

    print()
    print("═" * 55)
    print("  DONE!")
    print("═" * 55)
    print(f"""
Output files:
  🎬 {landscape}
  📱 {vertical}

YouTube metadata ready in: video-script-youtube.md

Upload checklist:
  1. Upload zinovia-final.mp4 to YouTube
  2. Upload zinovia-final-vertical.mp4 as a YouTube Short
  3. Copy title/description/tags from video-script-youtube.md
  4. Set thumbnail: screenshot of earnings dashboard + bold text
""")


if __name__ == "__main__":
    asyncio.run(main())
