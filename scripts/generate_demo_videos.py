#!/usr/bin/env python3
"""
Generate narrated demo walkthrough videos for Zinovia.

Pipeline:
1. Convert SVG step screenshots to PNG using Rsvg (via PyGObject)
2. Synthesize narration audio with Amazon Polly (Neural engine, Danielle voice)
3. Combine image + audio per step with ffmpeg
4. Concatenate all steps into one walkthrough MP4

Usage:
    python3 scripts/generate_demo_videos.py

Output:
    apps/web/public/demo/creator-walkthrough.mp4
    apps/web/public/demo/fan-walkthrough.mp4
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

import gi
gi.require_version("Rsvg", "2.0")
gi.require_version("GdkPixbuf", "2.0")
from gi.repository import Rsvg, GdkPixbuf
import cairo

# --- Config ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / "apps" / "web" / "public"
DEMO_DIR = PUBLIC_DIR / "demo"
STEPS_DIR = DEMO_DIR / "steps"
FFMPEG = PROJECT_ROOT / "node_modules" / "@ffmpeg-installer" / "linux-x64" / "ffmpeg"

# Video dimensions (16:9)
VIDEO_W = 1280
VIDEO_H = 720

POLLY_VOICE = "Danielle"
POLLY_ENGINE = "neural"

# --- Narration Scripts ---

CREATOR_NARRATION = [
    {
        "title": "Sign Up",
        "text": (
            "Welcome to Zinovia! Let's walk through how to get started as a creator. "
            "First, head to zinovia.ai and click Sign Up. Enter your email address, "
            "choose a strong password, and you're in. It takes less than a minute."
        ),
    },
    {
        "title": "Identity Verification",
        "text": (
            "Next, complete your identity verification. This is required for all creators "
            "to ensure a safe community. Upload a valid government ID and a selfie. "
            "Our team reviews submissions quickly so you can start creating right away."
        ),
    },
    {
        "title": "Set Up Your Profile",
        "text": (
            "Now let's build your profile. Add a profile photo, a banner image, "
            "your display name, and a bio that tells fans what to expect. "
            "Choose a unique handle — this becomes your personal URL on Zinovia."
        ),
    },
    {
        "title": "Set Your Pricing",
        "text": (
            "Set your subscription price. You can offer monthly subscriptions "
            "at a price that works for you. Fans subscribe to access your exclusive content. "
            "You keep the majority of every subscription."
        ),
    },
    {
        "title": "Publish Content",
        "text": (
            "Start publishing! Upload photos and videos, write captions, "
            "and share with your subscribers. You can also create pay-per-view posts "
            "for premium content that fans can unlock individually."
        ),
    },
    {
        "title": "Media Vault",
        "text": (
            "Your Media Vault stores all your uploaded content in one organized place. "
            "Drag and drop files to upload, and reuse them across multiple posts. "
            "Everything stays organized and easy to find."
        ),
    },
    {
        "title": "Collections",
        "text": (
            "Organize your posts into themed collections. Group content by topic, "
            "series, or any category you like. Collections help fans discover "
            "and browse your content more easily."
        ),
    },
    {
        "title": "Track Your Earnings",
        "text": (
            "Monitor your revenue in real time. The earnings dashboard shows "
            "your subscription income, pay-per-view sales, and total earnings. "
            "Get detailed breakdowns by day, week, or month."
        ),
    },
    {
        "title": "Messages",
        "text": (
            "Connect with your fans through direct messaging. "
            "Send and receive messages, share exclusive content privately, "
            "and build stronger relationships with your audience."
        ),
    },
    {
        "title": "AI Studio",
        "text": (
            "Boost your content with AI-powered tools. Generate promotional captions "
            "in different tones — professional, playful, or teasing. "
            "Translate your posts into multiple languages to reach a global audience."
        ),
    },
    {
        "title": "Language Settings",
        "text": (
            "Zinovia supports nine languages. Switch the entire interface "
            "to English, French, Spanish, German, Italian, Portuguese, Turkish, "
            "Polish, or Romanian. Your fans see the platform in their preferred language too."
        ),
    },
]

FAN_NARRATION = [
    {
        "title": "Sign Up",
        "text": (
            "Welcome to Zinovia! Signing up as a fan is quick and easy. "
            "Visit zinovia.ai, click Sign Up, enter your email and a password, "
            "and you're ready to explore."
        ),
    },
    {
        "title": "Discover Creators",
        "text": (
            "Browse the Discover page to find creators you love. "
            "Search by name, explore featured profiles, or filter by category. "
            "Every creator has a preview so you know what to expect before subscribing."
        ),
    },
    {
        "title": "Creator Profiles",
        "text": (
            "Visit a creator's profile to see their bio, preview content, "
            "and subscription pricing. Check out their collections and posts "
            "to decide if they're the right fit for you."
        ),
    },
    {
        "title": "Your Feed",
        "text": (
            "Once you subscribe, your feed fills with exclusive content "
            "from your favorite creators. Scroll through photos, videos, and posts — "
            "all in one personalized timeline."
        ),
    },
    {
        "title": "Pay-Per-View Content",
        "text": (
            "Some posts are available as pay-per-view. Unlock premium content "
            "with a single purchase — no subscription required. "
            "Once unlocked, the content is yours to view anytime."
        ),
    },
    {
        "title": "Messages",
        "text": (
            "Send direct messages to your favorite creators. "
            "Have private conversations, ask questions, or just show your support. "
            "Messaging makes the experience personal and interactive."
        ),
    },
    {
        "title": "Billing & Subscriptions",
        "text": (
            "Manage all your subscriptions and payments in one place. "
            "View active subscriptions, see payment history, "
            "and update your billing details anytime. Everything is secure and transparent."
        ),
    },
    {
        "title": "Notifications",
        "text": (
            "Stay up to date with real-time notifications. "
            "Get alerts when your favorite creators post new content, "
            "when you receive messages, or when there are special updates."
        ),
    },
    {
        "title": "Language Settings",
        "text": (
            "Switch the platform language to your preference. "
            "Zinovia supports nine languages including English, French, Spanish, "
            "German, and more. The entire interface adapts to your choice."
        ),
    },
]


def svg_to_png(svg_path: Path, png_path: Path, width: int, height: int):
    """Convert an SVG file to PNG using Rsvg + GdkPixbuf."""
    handle = Rsvg.Handle.new_from_file(str(svg_path))
    pixbuf = handle.get_pixbuf()
    # Scale to target dimensions
    scaled = pixbuf.scale_simple(width, height, GdkPixbuf.InterpType.BILINEAR)
    scaled.savev(str(png_path), "png", [], [])
    print(f"  PNG: {png_path.name}")


def synthesize_speech(text: str, output_path: Path):
    """Use Amazon Polly to synthesize speech and save as MP3."""
    cmd = [
        "aws", "polly", "synthesize-speech",
        "--text", text,
        "--output-format", "mp3",
        "--voice-id", POLLY_VOICE,
        "--engine", POLLY_ENGINE,
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Polly error: {result.stderr}")
        raise RuntimeError(f"Polly failed: {result.stderr}")
    print(f"  Audio: {output_path.name}")


def get_audio_duration(audio_path: Path) -> float:
    """Get audio duration in seconds using ffprobe."""
    cmd = [
        str(FFMPEG).replace("ffmpeg", "ffprobe") if (Path(str(FFMPEG).replace("ffmpeg", "ffprobe"))).exists()
        else "ffprobe",
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "json",
        str(audio_path),
    ]
    # Try with ffprobe from same dir as ffmpeg
    ffprobe_path = Path(str(FFMPEG).replace("ffmpeg", "ffprobe"))
    if not ffprobe_path.exists():
        # Use ffmpeg to get duration instead
        cmd2 = [
            str(FFMPEG), "-i", str(audio_path),
            "-f", "null", "-",
        ]
        result = subprocess.run(cmd2, capture_output=True, text=True)
        # Parse duration from stderr
        for line in result.stderr.split("\n"):
            if "Duration:" in line:
                parts = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = parts.split(":")
                return float(h) * 3600 + float(m) * 60 + float(s)
        return 10.0  # fallback
    else:
        result = subprocess.run(cmd, capture_output=True, text=True)
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])


def create_step_video(png_path: Path, audio_path: Path, output_path: Path, duration: float):
    """Create a video from a still image + audio using ffmpeg."""
    # Add 1 second padding after audio
    total_duration = duration + 1.0

    cmd = [
        str(FFMPEG), "-y",
        "-loop", "1",
        "-i", str(png_path),
        "-i", str(audio_path),
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-vf", f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=decrease,pad={VIDEO_W}:{VIDEO_H}:(ow-iw)/2:(oh-ih)/2:color=black",
        "-t", str(total_duration),
        "-shortest",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[-500:]}")
        raise RuntimeError("ffmpeg failed")
    print(f"  Video: {output_path.name} ({total_duration:.1f}s)")


def create_title_card(title: str, subtitle: str, png_path: Path, accent_color: str = "#a855f7"):
    """Create a title card PNG with text using Cairo."""
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, VIDEO_W, VIDEO_H)
    ctx = cairo.Context(surface)

    # Dark gradient background
    pat = cairo.LinearGradient(0, 0, VIDEO_W, VIDEO_H)
    pat.add_color_stop_rgb(0, 0.04, 0.04, 0.06)
    pat.add_color_stop_rgb(0.5, 0.06, 0.08, 0.10)
    pat.add_color_stop_rgb(1, 0.04, 0.06, 0.06)
    ctx.set_source(pat)
    ctx.rectangle(0, 0, VIDEO_W, VIDEO_H)
    ctx.fill()

    # Title text
    ctx.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(56)
    ext = ctx.text_extents(title)
    ctx.move_to((VIDEO_W - ext.width) / 2, VIDEO_H / 2 - 20)
    ctx.set_source_rgb(1, 1, 1)
    ctx.show_text(title)

    # Subtitle text
    ctx.set_font_size(24)
    ctx.set_source_rgba(1, 1, 1, 0.6)
    ext2 = ctx.text_extents(subtitle)
    ctx.move_to((VIDEO_W - ext2.width) / 2, VIDEO_H / 2 + 30)
    ctx.show_text(subtitle)

    surface.write_to_png(str(png_path))


def create_title_video(png_path: Path, output_path: Path, duration: float = 3.0):
    """Create a silent title card video."""
    cmd = [
        str(FFMPEG), "-y",
        "-loop", "1",
        "-i", str(png_path),
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        "-t", str(duration),
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg title card failed: {result.stderr[-300:]}")


def concatenate_videos(segment_paths: list[Path], output_path: Path):
    """Concatenate multiple video segments into one MP4 using filter_complex."""
    n = len(segment_paths)
    # Build input args and filter_complex string
    inputs: list[str] = []
    for p in segment_paths:
        inputs.extend(["-i", str(p)])

    # Create concat filter: [0:v][0:a][1:v][1:a]...[n:v][n:a]concat=n=N:v=1:a=1
    filter_parts = "".join(f"[{i}:v][{i}:a]" for i in range(n))
    filter_str = f"{filter_parts}concat=n={n}:v=1:a=1[outv][outa]"

    cmd = [
        str(FFMPEG), "-y",
        *inputs,
        "-filter_complex", filter_str,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  concat error: {result.stderr[-500:]}")
        raise RuntimeError("concat failed")
    print(f"  Final: {output_path.name}")


def generate_walkthrough(
    role: str,
    narration_steps: list[dict],
    svg_files: list[str],
    output_filename: str,
):
    """Generate a full walkthrough video for a role (creator or fan)."""
    print(f"\n{'='*60}")
    print(f"Generating {role} walkthrough ({len(narration_steps)} steps)")
    print(f"{'='*60}")

    with tempfile.TemporaryDirectory(prefix=f"zinovia_demo_{role}_") as tmpdir:
        tmp = Path(tmpdir)
        segments: list[Path] = []

        # 1. Title card
        print("\nCreating title card...")
        title_png = tmp / "title.png"
        title_mp4 = tmp / "title.mp4"
        create_title_card(
            f"Zinovia — {role.capitalize()} Demo",
            f"A step-by-step walkthrough of every {role} feature",
            title_png,
        )
        create_title_video(title_png, title_mp4, duration=3.0)
        segments.append(title_mp4)

        # 2. Process each step
        for i, (narration, svg_file) in enumerate(zip(narration_steps, svg_files)):
            step_num = i + 1
            print(f"\nStep {step_num}/{len(narration_steps)}: {narration['title']}")

            svg_path = STEPS_DIR / svg_file
            png_path = tmp / f"step_{step_num:02d}.png"
            audio_path = tmp / f"step_{step_num:02d}.mp3"
            video_path = tmp / f"step_{step_num:02d}.mp4"

            # Convert SVG to PNG
            svg_to_png(svg_path, png_path, VIDEO_W, VIDEO_H)

            # Generate TTS audio
            synthesize_speech(narration["text"], audio_path)

            # Get audio duration
            duration = get_audio_duration(audio_path)
            print(f"  Duration: {duration:.1f}s")

            # Create video segment
            create_step_video(png_path, audio_path, video_path, duration)
            segments.append(video_path)

        # 3. Outro title card
        print("\nCreating outro...")
        outro_png = tmp / "outro.png"
        outro_mp4 = tmp / "outro.mp4"
        create_title_card(
            "Get Started Today",
            "Sign up free at zinovia.ai",
            outro_png,
        )
        create_title_video(outro_png, outro_mp4, duration=3.0)
        segments.append(outro_mp4)

        # 4. Concatenate all segments
        print("\nConcatenating segments...")
        output_path = DEMO_DIR / output_filename
        concatenate_videos(segments, output_path)

        # File size
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"\nDone! {output_path} ({size_mb:.1f} MB)")


def main():
    # Creator walkthrough
    creator_svgs = [
        "creator-01-signup.svg",
        "creator-02-kyc.svg",
        "creator-03-profile.svg",
        "creator-04-pricing.svg",
        "creator-05-posts.svg",
        "creator-06-vault.svg",
        "creator-07-collections.svg",
        "creator-08-earnings.svg",
        "creator-09-messages.svg",
        "creator-10-ai.svg",
        "creator-11-language.svg",
    ]
    generate_walkthrough("creator", CREATOR_NARRATION, creator_svgs, "creator-walkthrough.mp4")

    # Fan walkthrough
    fan_svgs = [
        "fan-01-signup.svg",
        "fan-02-discover.svg",
        "fan-03-profiles.svg",
        "fan-04-feed.svg",
        "fan-05-ppv.svg",
        "fan-06-messages.svg",
        "fan-07-billing.svg",
        "fan-08-notifications.svg",
        "fan-09-language.svg",
    ]
    generate_walkthrough("fan", FAN_NARRATION, fan_svgs, "fan-walkthrough.mp4")


if __name__ == "__main__":
    main()
