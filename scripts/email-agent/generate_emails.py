#!/usr/bin/env python3
"""
Zinovia.ai Outbound Email Generator + Sender

Generates personalized outreach emails for agencies and creators
using the OpenAI API, and optionally sends them via Resend.

Usage:
    # Dry run (preview only)
    python generate_emails.py targets.csv --dry-run

    # Generate to files
    python generate_emails.py targets.csv -o output/

    # Generate AND send via Resend
    python generate_emails.py targets.csv --send --from-email hello@zinovia.ai --from-name "Zinovia AI"

    # Send with language override
    python generate_emails.py targets.csv --send --from-email hello@zinovia.ai --lang French
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from pathlib import Path

from openai import OpenAI, APIError

SYSTEM_PROMPT = """\
You are a senior copywriter and growth marketer specialized in the \
creator economy and adult-friendly platforms (OnlyFans, Fanvue, Fansly, \
Patreon, ManyVids, etc.).

Your task is to write highly personalized, compliant outreach emails that \
invite agencies and independent creators to onboard to Zinovia.ai and its \
AI Tools Studio.

### Context about Zinovia.ai
- Zinovia.ai is an AI studio where creators and agencies can:
  - Centralize their content (photos, videos, texts) and launch AI workflows around it.
  - Use AI tools to generate captions, DMs, scripts, variations of photos, thumbnails, schedules, and campaigns.
  - Set up "always-on" AI agents for:
    - content planning and repurposing,
    - fan messaging scenarios,
    - upsell and retention campaigns for OnlyFans, Fanvue, Patreon, and other sites.
- The platform is creator-friendly, including adult content creators, \
provided everything is legal and consensual. We respect privacy and give \
creators control over what is uploaded and how it's used.
- Ideal targets:
  - Agencies managing multiple creators (adult and non-adult) who need \
automation across inboxes, content calendars, and custom funnels.
  - Individual creators and models (including "spicy" / adult creators) who want to:
    - monetize photos and videos more efficiently,
    - save time on admin and messaging,
    - grow revenue across several platforms (OnlyFans, Fanvue, Patreon, etc.).

### Tone and positioning
- Speak professionally but friendly, respecting sex workers and adult \
creators; never shame their content.
- Emphasize money, time saved, and control:
  - more recurring revenue from existing fans,
  - more consistent posting with less effort,
  - smarter use of their existing photos/videos through AI tools.
- Avoid explicit or graphic language; use terms like "adult content", \
"spicy", "NSFW", "premium content", "VIP fans" instead of explicit sexual details.
- Make it clear this is not a replacement for their main platform \
(OnlyFans/Fanvue/etc.) but a backend AI studio that boosts what they already do.

### Legal and compliance
- The email must be commercial but compliant:
  - Include optional lines for unsubscribe / opt-out wording.
  - Do not promise specific earnings; talk about potential and examples instead.
- No scraping language, no mention of how we got their contact; keep it \
neutral and privacy-respectful.

### What you must output
For the given target JSON, write:
1. **Email subject line** (max 8-10 words, curiosity + value).
2. **Preview line** (short line as inbox preview).
3. **Body**:
   - 3-6 short paragraphs, with:
     - a hook that references their niche / pain (time, burnout, inconsistent income);
     - 2-3 concrete benefits of Zinovia.ai (automation, AI studio, multi-platform support);
     - 1-2 simple examples of what our AI can do for them (e.g. "turn one photoset into a week of captions, DMs and promos");
     - a low-friction call-to-action (book a call, test a free workspace, reply "YES").
   - Include a polite opt-out sentence at the end (e.g. "If this isn't relevant, just reply STOP and we'll remove you.").

Output the email in the following format exactly:
---
SUBJECT: <subject line>
PREVIEW: <preview text>
---
<email body>
---

Write in the same language as requested. \
Keep everything non-explicit, platform-friendly and respectful.\
"""


def load_targets(filepath: str) -> list[dict]:
    """Load targets from JSON or CSV file."""
    path = Path(filepath)
    if not path.exists():
        print(f"Error: file not found: {filepath}", file=sys.stderr)
        sys.exit(1)

    suffix = path.suffix.lower()

    if suffix == ".json":
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return [data]
        return data

    if suffix == ".csv":
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)

    print(f"Error: unsupported file format '{suffix}'. Use .json or .csv", file=sys.stderr)
    sys.exit(1)


def generate_email(
    client: OpenAI,
    target: dict,
    model: str,
    lang: str | None = None,
) -> str:
    """Call OpenAI to generate a personalized email for one target."""
    user_message = f"Generate an outreach email for this target:\n\n```json\n{json.dumps(target, indent=2, ensure_ascii=False)}\n```"
    if lang:
        user_message += f"\n\nWrite the email in {lang}."

    response = client.chat.completions.create(
        model=model,
        max_tokens=2048,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    return response.choices[0].message.content or ""


def parse_email_parts(raw: str) -> dict:
    """Parse generated email text into subject, preview, and body."""
    subject = ""
    preview = ""
    body = raw

    subject_match = re.search(r"SUBJECT:\s*(.+)", raw)
    if subject_match:
        subject = subject_match.group(1).strip()

    preview_match = re.search(r"PREVIEW:\s*(.+)", raw)
    if preview_match:
        preview = preview_match.group(1).strip()

    # Extract body: everything between second --- and last ---
    sections = raw.split("---")
    if len(sections) >= 3:
        body = "---".join(sections[2:-1]).strip()

    return {"subject": subject, "preview": preview, "body": body}


def send_via_resend(
    to_email: str,
    subject: str,
    body: str,
    from_email: str,
    from_name: str,
    reply_to: str | None = None,
) -> str | None:
    """Send an email via Resend. Returns email ID on success."""
    import resend

    resend.api_key = os.environ.get("RESEND_API_KEY", "")

    # Convert plain text body to simple HTML
    html_body = body.replace("\n\n", "</p><p>").replace("\n", "<br>")
    html_body = f"<p>{html_body}</p>"

    params = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": body,
    }
    if reply_to:
        params["reply_to"] = reply_to

    result = resend.Emails.send(params)
    return result.get("id")


def sanitize_filename(name: str) -> str:
    """Create a safe filename from a target name/brand."""
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name)
    return safe.strip("_")[:80] or "target"


def main():
    parser = argparse.ArgumentParser(
        description="Generate personalized outreach emails for Zinovia.ai"
    )
    parser.add_argument(
        "targets_file",
        help="Path to JSON or CSV file with target data",
    )
    parser.add_argument(
        "-o", "--output-dir",
        default="output",
        help="Directory to write generated emails (default: output/)",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o",
        help="OpenAI model to use (default: gpt-4o)",
    )
    parser.add_argument(
        "--lang",
        default=None,
        help="Language for emails, e.g. 'French', 'Spanish' (default: auto from target)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print emails to stdout instead of writing files",
    )
    # Resend options
    parser.add_argument(
        "--send",
        action="store_true",
        help="Send emails via Resend (requires RESEND_API_KEY env var)",
    )
    parser.add_argument(
        "--from-email",
        default="hello@zinovia.ai",
        help="Sender email address (default: hello@zinovia.ai)",
    )
    parser.add_argument(
        "--from-name",
        default="Zinovia AI",
        help="Sender display name (default: Zinovia AI)",
    )
    parser.add_argument(
        "--reply-to",
        default=None,
        help="Reply-to email address",
    )
    parser.add_argument(
        "--send-delay",
        type=float,
        default=2.0,
        help="Seconds between sends to avoid rate limits (default: 2.0)",
    )
    args = parser.parse_args()

    # Validate env vars
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    if args.send:
        resend_key = os.environ.get("RESEND_API_KEY")
        if not resend_key:
            print("Error: RESEND_API_KEY environment variable is not set.", file=sys.stderr)
            sys.exit(1)

    client = OpenAI()
    targets = load_targets(args.targets_file)

    if not targets:
        print("No targets found in file.", file=sys.stderr)
        sys.exit(1)

    # Filter targets with emails when sending
    if args.send:
        targets_with_email = [t for t in targets if t.get("business_email")]
        skipped = len(targets) - len(targets_with_email)
        if skipped:
            print(f"Skipping {skipped} target(s) with no business_email.")
        targets = targets_with_email
        if not targets:
            print("No targets with business_email found. Nothing to send.", file=sys.stderr)
            sys.exit(1)

    print(f"Loaded {len(targets)} target(s). Model: {args.model}")
    if args.send:
        print(f"Mode: SEND via Resend from {args.from_name} <{args.from_email}>")
    elif args.dry_run:
        print("Mode: DRY RUN (preview only)")
    else:
        print(f"Mode: SAVE to {args.output_dir}/")

    output_dir = Path(args.output_dir)
    if not args.dry_run and not args.send:
        output_dir.mkdir(parents=True, exist_ok=True)

    sent_count = 0
    error_count = 0

    for i, target in enumerate(targets, 1):
        identifier = target.get("brand_name") or target.get("name") or f"target_{i}"
        print(f"\n[{i}/{len(targets)}] Generating email for: {identifier} ...")

        try:
            email_text = generate_email(client, target, args.model, args.lang)
        except APIError as e:
            print(f"  OpenAI error: {e}", file=sys.stderr)
            error_count += 1
            continue

        parts = parse_email_parts(email_text)

        if args.dry_run:
            print(f"\n{'='*60}")
            print(f"TARGET: {identifier}")
            to = target.get("business_email", "(no email)")
            print(f"TO: {to}")
            print(f"{'='*60}")
            print(email_text)

        elif args.send:
            to_email = target.get("business_email", "")
            print(f"  Sending to: {to_email}")
            try:
                email_id = send_via_resend(
                    to_email=to_email,
                    subject=parts["subject"],
                    body=parts["body"],
                    from_email=args.from_email,
                    from_name=args.from_name,
                    reply_to=args.reply_to,
                )
                print(f"  Sent! ID: {email_id}")
                sent_count += 1
            except Exception as e:
                print(f"  Resend error: {e}", file=sys.stderr)
                error_count += 1

            # Rate limit delay between sends
            if i < len(targets):
                time.sleep(args.send_delay)
        else:
            filename = f"{i:03d}_{sanitize_filename(identifier)}.txt"
            filepath = output_dir / filename
            filepath.write_text(email_text, encoding="utf-8")
            print(f"  Saved: {filepath}")

    print(f"\nDone. Processed {len(targets)} target(s).")
    if args.send:
        print(f"  Sent: {sent_count} | Errors: {error_count}")


if __name__ == "__main__":
    main()
