"""Template-based promotional copy generator. Pure Python, no ML."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass

STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "about", "up",
    "it", "its", "this", "that", "these", "those", "i", "me", "my",
    "we", "our", "you", "your", "he", "him", "his", "she", "her",
    "they", "them", "their", "what", "which", "who", "whom",
    "image", "photo", "picture", "shows", "showing", "man", "woman",
    "person", "people", "wearing", "standing", "sitting", "looking",
})


@dataclass
class PromoResult:
    title: str
    description: str
    cta_lines: list[str]
    hashtags: list[str]


# ---------------------------------------------------------------------------
# Title templates per tone
# ---------------------------------------------------------------------------

TITLE_TEMPLATES: dict[str, list[str]] = {
    "professional": [
        "Exclusive: {keyword}",
        "Premium {keyword} Content",
        "New Release: {keyword}",
        "{keyword} — Members Only",
        "Latest Drop: {keyword}",
    ],
    "playful": [
        "You won't want to miss this {keyword}!",
        "{keyword} vibes incoming!",
        "Guess what? New {keyword}!",
        "Fresh {keyword} just dropped!",
        "Something special: {keyword}",
    ],
    "teasing": [
        "A little peek at {keyword}...",
        "Curious about {keyword}?",
        "Unlock to see more {keyword}...",
        "Just a taste of {keyword}...",
        "Can you handle this {keyword}?",
    ],
}

# ---------------------------------------------------------------------------
# Description templates per tone
# ---------------------------------------------------------------------------

DESCRIPTION_TEMPLATES: dict[str, list[str]] = {
    "professional": [
        "High-quality {keyword} content created exclusively for my subscribers. Don't miss out on this premium release.",
        "New {keyword} content is now available. Subscribe to access the full collection and stay updated.",
        "Check out my latest {keyword} post — crafted with care for my most loyal fans.",
        "Exclusive {keyword} content you won't find anywhere else. Available now for subscribers.",
    ],
    "playful": [
        "Hey loves! Just uploaded some amazing {keyword} content — come check it out and show some love!",
        "New {keyword} alert! I had so much fun creating this one. Hope you enjoy it as much as I do!",
        "Surprise! Fresh {keyword} content just for you. Let me know what you think in the DMs!",
        "Been working on this {keyword} content all week and I'm so excited to finally share it with you!",
    ],
    "teasing": [
        "I've got something special waiting for you... this {keyword} content is for your eyes only.",
        "This {keyword} preview is just the beginning. Unlock to see everything I've been saving for you.",
        "Want to see more? This {keyword} content is too good not to share — but only for subscribers.",
        "I know you're curious about this {keyword} content... unlock it and thank me later.",
    ],
}

# ---------------------------------------------------------------------------
# CTA templates per tone
# ---------------------------------------------------------------------------

CTA_TEMPLATES: dict[str, list[list[str]]] = {
    "professional": [
        ["Subscribe now to unlock", "View full content", "Join for exclusive access"],
        ["Get instant access", "Unlock premium content", "Subscribe to see more"],
        ["Start your subscription", "Access the full post", "Join my community"],
    ],
    "playful": [
        ["Come join the fun!", "Tap to unlock!", "Don't miss out!"],
        ["Let's go!", "Unlock the magic!", "Jump in!"],
        ["Show some love!", "Treat yourself!", "You deserve this!"],
    ],
    "teasing": [
        ["Unlock to see everything...", "Ready to see more?", "Subscribe for the full reveal"],
        ["Curious? Unlock now", "Want the full view?", "Only one click away..."],
        ["See what you're missing", "Unlock my secret content", "Come closer..."],
    ],
}

# ---------------------------------------------------------------------------
# Hashtag pools (niche-related base tags)
# ---------------------------------------------------------------------------

BASE_HASHTAGS = [
    "exclusive", "subscribers", "premium", "newcontent", "contentcreator",
    "fansonly", "supportcreators", "creatorlife", "original", "behindthescenes",
    "subscribe", "unlock", "vip", "hottopic", "trending",
    "lifestyle", "creator", "community", "content", "digital",
]


def _extract_keywords(text: str, tags: list[str] | None = None) -> list[str]:
    """Extract meaningful keywords from caption text and optional tags."""
    words: list[str] = []

    if text:
        # Split on non-alpha characters, lowercase, filter
        raw = re.findall(r"[a-zA-Z]{3,}", text.lower())
        words.extend(w for w in raw if w not in STOPWORDS)

    if tags:
        words.extend(t.lower().strip() for t in tags if len(t.strip()) >= 3)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for w in words:
        if w not in seen:
            seen.add(w)
            unique.append(w)
    return unique[:15]


def _pick_keyword(keywords: list[str]) -> str:
    """Pick a keyword for template insertion, or fallback."""
    if keywords:
        return random.choice(keywords[:5]).title()
    return "Content"


def _generate_hashtags(keywords: list[str], count: int = 10) -> list[str]:
    """Generate hashtag suggestions from keywords + base pool."""
    tags: list[str] = []

    # Add keyword-based hashtags first
    for kw in keywords[:6]:
        tag = kw.replace(" ", "").lower()
        if len(tag) >= 3 and tag not in tags:
            tags.append(tag)

    # Fill from base pool (shuffled)
    pool = list(BASE_HASHTAGS)
    random.shuffle(pool)
    for tag in pool:
        if tag not in tags:
            tags.append(tag)
        if len(tags) >= count:
            break

    return [f"#{t}" for t in tags[:count]]


def generate_promo(
    caption: str,
    tone: str,
    tags: list[str] | None = None,
) -> PromoResult:
    """Generate promotional copy from caption + tags using templates.

    Args:
        caption: Post caption text
        tone: One of "professional", "playful", "teasing"
        tags: Optional list of AI-extracted tags

    Returns:
        PromoResult with title, description, 3 CTAs, 10 hashtags
    """
    if tone not in TITLE_TEMPLATES:
        tone = "professional"

    keywords = _extract_keywords(caption, tags)
    keyword = _pick_keyword(keywords)

    title = random.choice(TITLE_TEMPLATES[tone]).format(keyword=keyword)
    description = random.choice(DESCRIPTION_TEMPLATES[tone]).format(keyword=keyword.lower())
    cta_lines = random.choice(CTA_TEMPLATES[tone])
    hashtags = _generate_hashtags(keywords)

    return PromoResult(
        title=title,
        description=description,
        cta_lines=list(cta_lines),
        hashtags=hashtags,
    )
