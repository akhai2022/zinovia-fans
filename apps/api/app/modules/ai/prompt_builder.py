"""Compose final prompts from preset and user inputs. Client never sends raw full prompt."""

from __future__ import annotations

# Preset definitions: (prompt_template, negative_prompt_template)
# Templates use {subject}, {vibe}, {accent_color} placeholders
AI_IMAGE_PRESETS: dict[str, tuple[str, str]] = {
    "hero_marketing": (
        "Professional marketing hero image, cinematic lighting, "
        "high-quality digital art, {subject}, {vibe} atmosphere, accent colors {accent_color}",
        "blurry, low resolution, distorted, watermark",
    ),
    "creator_avatar": (
        "Professional portrait photograph, soft lighting, "
        "clean background, {subject}, {vibe} mood, subtle {accent_color} accents",
        "blurry, distorted, multiple faces, watermark",
    ),
    "creator_banner": (
        "Wide banner image, atmospheric, professional quality, "
        "{subject}, {vibe} vibe, {accent_color} color palette",
        "blurry, text, watermark, cluttered",
    ),
}

DEFAULT_SUBJECT = "modern aesthetic"
DEFAULT_VIBE = "elegant"
DEFAULT_ACCENT = "soft gold"


def build_prompt(
    preset: str,
    *,
    subject: str | None = None,
    vibe: str | None = None,
    accent_color: str | None = None,
) -> tuple[str, str]:
    """
    Build (prompt, negative_prompt) from preset and optional inputs.
    Raises ValueError if preset is unknown.
    """
    if preset not in AI_IMAGE_PRESETS:
        raise ValueError(f"unknown_preset: {preset}")

    template, neg_template = AI_IMAGE_PRESETS[preset]
    subj = (subject or "").strip() or DEFAULT_SUBJECT
    vib = (vibe or "").strip() or DEFAULT_VIBE
    acc = (accent_color or "").strip() or DEFAULT_ACCENT

    prompt = template.format(
        subject=subj,
        vibe=vib,
        accent_color=acc,
    )
    negative_prompt = neg_template
    return prompt, negative_prompt
