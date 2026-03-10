# Email Agent — Zinovia.ai Outbound Email Generator & Sender

AI-powered outreach email generator for Zinovia.ai. Generates personalized marketing emails for agencies and creators using OpenAI (GPT-4o), and sends them via [Resend](https://resend.com).

## Directory Structure

```
scripts/email-agent/
├── generate_emails.py      # Main script — generates and/or sends emails
├── zinovia_targets.csv      # Production target list (28 agencies + creators)
├── targets.csv              # Demo target list (5 sample entries)
├── sample_targets.json      # JSON format example (3 entries)
└── README.md                # This file
```

## Requirements

- Python 3.10+
- `openai` — OpenAI API client
- `resend` — Resend email delivery SDK

### Install dependencies

```bash
pip install openai resend
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Always | OpenAI API key for email generation |
| `RESEND_API_KEY` | Only with `--send` | Resend API key for email delivery |

The Resend API key used in production is stored in AWS Secrets Manager under `zinovia-fans-prod-resend-api-key`. Retrieve it with:

```bash
aws secretsmanager get-secret-value \
  --secret-id zinovia-fans-prod-resend-api-key \
  --query SecretString --output text
```

## Usage

All commands are run from the repository root (`zinovia-fans/`).

### 1. Dry Run (preview only — nothing sent)

```bash
OPENAI_API_KEY="sk-..." \
  python scripts/email-agent/generate_emails.py \
  scripts/email-agent/zinovia_targets.csv \
  --dry-run
```

Prints each generated email to stdout with target name, recipient, subject, and body.

### 2. Save to Files

```bash
OPENAI_API_KEY="sk-..." \
  python scripts/email-agent/generate_emails.py \
  scripts/email-agent/zinovia_targets.csv \
  -o scripts/email-agent/output/
```

Writes one `.txt` file per target into the output directory (e.g. `001_AROA_Agency.txt`).

### 3. Send via Resend

```bash
OPENAI_API_KEY="sk-..." \
RESEND_API_KEY="re_..." \
  python scripts/email-agent/generate_emails.py \
  scripts/email-agent/zinovia_targets.csv \
  --send \
  --from-email hello@zinovia.ai \
  --from-name "Zinovia AI" \
  --reply-to support@zinovia.ai \
  --send-delay 3
```

Generates a personalized email for each target via GPT-4o, then sends it through Resend. Each sent email returns a Resend ID for tracking.

### 4. Send in a Specific Language

```bash
OPENAI_API_KEY="sk-..." \
RESEND_API_KEY="re_..." \
  python scripts/email-agent/generate_emails.py \
  scripts/email-agent/zinovia_targets.csv \
  --send \
  --from-email hello@zinovia.ai \
  --from-name "Zinovia AI" \
  --lang French
```

Overrides the language for all generated emails. Useful for region-specific campaigns.

## CLI Flags Reference

| Flag | Default | Description |
|------|---------|-------------|
| `targets_file` | *(required)* | Path to `.csv` or `.json` target file |
| `-o`, `--output-dir` | `output/` | Directory for saved email files |
| `--model` | `gpt-4o` | OpenAI model for email generation |
| `--lang` | auto | Force language (e.g. `French`, `Spanish`, `English`) |
| `--dry-run` | off | Print emails to stdout, don't save or send |
| `--send` | off | Send emails via Resend |
| `--from-email` | `hello@zinovia.ai` | Sender email address |
| `--from-name` | `Zinovia AI` | Sender display name |
| `--reply-to` | *(none)* | Reply-to email address |
| `--send-delay` | `2.0` | Seconds between sends (rate limiting) |

## Target CSV Format

The CSV must have a header row. Key columns used by the email generator:

```
type,name,brand_name,role,platform,business_email,country,niche,follower_hint,link_context,website_or_profile
```

| Column | Description | Example |
|--------|-------------|---------|
| `type` | `agency` or `creator` | `agency` |
| `name` | Contact person name (optional for agencies) | `Amanda Cerny` |
| `brand_name` | Agency or brand name | `AROA Agency` |
| `role` | `agency`, `solo creator`, `AI creator` | `solo creator` |
| `platform` | Primary platform(s) | `OnlyFans, Fanvue` |
| `business_email` | Target email address | `office@aroaagency.com` |
| `country` | Country (used for language/tone hints) | `France` |
| `niche` | Content niche | `fitness & lifestyle` |
| `follower_hint` | Audience size hint (optional) | `top 2% creator` |
| `link_context` | Extra context for personalization | `talks about burnout` |
| `website_or_profile` | Website or social profile URL | `https://aroaagency.com` |

Targets without a `business_email` are automatically skipped when using `--send`.

## Target JSON Format (Alternative)

```json
[
  {
    "name": "Luna",
    "brand_name": "LunaX",
    "role": "solo creator",
    "niche": "cosplay & lingerie",
    "platform": "OnlyFans",
    "follower_hint": "top 2% creator",
    "country": "France",
    "link_context": "talks a lot about burnout and time management"
  }
]
```

## How It Works

1. Loads targets from CSV or JSON
2. For each target, sends the target data to GPT-4o with a specialized system prompt
3. GPT-4o generates a personalized email with:
   - Subject line (8-10 words, curiosity + value)
   - Preview text (inbox snippet)
   - Body (3-6 paragraphs: hook, benefits, examples, CTA, opt-out)
4. Depending on mode:
   - `--dry-run` → prints to stdout
   - `-o` → saves to `.txt` files
   - `--send` → delivers via Resend API

## Current Target List (`zinovia_targets.csv`)

**18 Agencies:**
AROA Agency, CharaBoost, Empire Of Agency, HoneyFans Agency, Louna's Models, Lush Management, OF Marketing Agency, OnlyXAgency, Rare X Network, Red Fox Agency, SEO Bounty, Socedo Agency, SweetLux Agency, TDM Business, TEASY Agency, The 10x Agency, The Clueless, XL Management

**10 Creators:**
Aitana Lopez, Amanda Cerny, Amanda Elise Lee, Ana Cheri, Brandie Diaz, Darren Till, Jala Sue, Katelyn Runck, Whitney Johns, Yanet Garcia

## Adding New Targets

Append rows to `zinovia_targets.csv` following the same column format. Only `brand_name` and `business_email` are strictly required — the more context you provide (niche, platform, link_context), the more personalized the generated email will be.

## Email Compliance

All generated emails include:
- No mention of how the contact was obtained
- No specific earnings promises
- An opt-out sentence (reply STOP)
- Professional, non-explicit language appropriate for adult content industry outreach
