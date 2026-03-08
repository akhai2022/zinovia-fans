export type PlatformInfo = {
  name: string;
  fee: string;
  payoutSpeed: string;
  aiTools: string;
  contentProtection: string;
  multilingual: string;
  bestFor: string;
};

export type AlternativeData = {
  slug: string;
  name: string;
  title: string;
  description: string;
  summary: string;
  platforms: PlatformInfo[];
  faqs: { q: string; a: string }[];
};

export const ALTERNATIVES: Record<string, AlternativeData> = {
  "onlyfans-alternatives": {
    slug: "onlyfans-alternatives",
    name: "OnlyFans Alternatives",
    title: "Best OnlyFans Alternatives for Creators in 2026",
    description:
      "Discover the best OnlyFans alternatives for creators in 2026. Compare fees, payouts, content protection, and features across 8 top platforms.",
    summary:
      "Whether you want lower fees, faster payouts, better content security, or a platform that serves all niches — these OnlyFans alternatives give creators more options in 2026. We compare pricing, payout speed, AI tools, and content protection so you can choose the right fit.",
    platforms: [
      {
        name: "Zinovia",
        fee: "Competitive",
        payoutSpeed: "48 hours",
        aiTools: "Planned",
        contentProtection: "Signed URLs + AES encryption",
        multilingual: "9 languages",
        bestFor:
          "Creators who want the fastest payouts, enterprise-grade content security, multilingual reach, and a platform that serves all niches equally.",
      },
      {
        name: "Fansly",
        fee: "20%",
        payoutSpeed: "7–14 days",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "English only",
        bestFor:
          "Creators who want tiered subscription models, live streaming, and a growing user base as an alternative to OnlyFans.",
      },
      {
        name: "FanVue",
        fee: "15%",
        payoutSpeed: "7–14 days",
        aiTools: "Yes",
        contentProtection: "Basic",
        multilingual: "Limited",
        bestFor:
          "Creators looking for AI-powered features, a referral programme, and a lower platform fee than OnlyFans.",
      },
      {
        name: "LoyalFans",
        fee: "20%",
        payoutSpeed: "7 days (weekly)",
        aiTools: "No",
        contentProtection: "Basic DRM",
        multilingual: "English primary",
        bestFor:
          "Adult content creators who want live streaming, a clip store, and a dedicated adult-focused audience.",
      },
      {
        name: "Passes",
        fee: "10%",
        payoutSpeed: "7 days (weekly)",
        aiTools: "No",
        contentProtection: "Anti-screenshot tech",
        multilingual: "English primary",
        bestFor:
          "Creators who want built-in CRM tools, anti-screenshot protection, and one of the lowest platform fees in the industry.",
      },
      {
        name: "MYM.fans",
        fee: "25%",
        payoutSpeed: "Monthly",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "French / English",
        bestFor:
          "European and French-speaking creators who want built-in content request features and a Europe-based platform.",
      },
      {
        name: "Unfiltrd",
        fee: "20%",
        payoutSpeed: "7–14 days",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "English only",
        bestFor:
          "Creators looking for a newer platform alternative with standard subscription and tipping features.",
      },
      {
        name: "Fanfix",
        fee: "20%",
        payoutSpeed: "14–30 days",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "English only",
        bestFor:
          "SFW Gen Z creators and influencers who want a clean-content-only platform with brand-safe positioning.",
      },
    ],
    faqs: [
      {
        q: "What is the best OnlyFans alternative in 2026?",
        a: "Zinovia stands out with 48-hour payouts (the fastest in the industry), enterprise-grade content encryption via signed URLs and AES, support for 9 languages, and competitive fees. Fansly and Passes are also strong alternatives depending on your needs.",
      },
      {
        q: "Which OnlyFans alternative has the lowest fees?",
        a: "Passes charges just 10%, making it one of the lowest-fee platforms. Zinovia charges a competitive platform fee with no hidden costs. FanVue charges 15%. OnlyFans, Fansly, LoyalFans, Unfiltrd, and Fanfix all charge 20%, while MYM.fans takes 25%.",
      },
      {
        q: "Which OnlyFans alternative pays creators fastest?",
        a: "Zinovia pays creators within 48 hours — faster than any other platform on this list. Most alternatives take 7–30 days to process payouts.",
      },
      {
        q: "Can I use multiple creator platforms at once?",
        a: "Yes. Many creators diversify their income by maintaining profiles on multiple platforms. You can cross-promote your Zinovia profile alongside other platforms to maximise reach and revenue.",
      },
      {
        q: "Are OnlyFans alternatives safe for content creators?",
        a: "Safety varies by platform. Zinovia uses signed, time-limited URLs and AES encryption for content delivery, making it significantly harder for content to be leaked. Passes uses anti-screenshot technology. Other platforms offer basic content protection. Always review each platform's security features before uploading sensitive content.",
      },
      {
        q: "Do I need to leave OnlyFans to use an alternative?",
        a: "No. You can maintain your OnlyFans profile while building a presence on alternative platforms. This lets you test other options without losing your existing subscriber base.",
      },
    ],
  },
  "patreon-alternatives": {
    slug: "patreon-alternatives",
    name: "Patreon Alternatives",
    title: "Best Patreon Alternatives for Creators in 2026",
    description:
      "Find the best Patreon alternatives in 2026. Compare fees, features, payout speed, and creator tools across 8 top monetisation platforms.",
    summary:
      "Patreon pioneered creator subscriptions, but its 5–12% fees and 30-day payout cycles have pushed many creators to explore alternatives. From subscription-first platforms to digital product stores and tip jars, these 8 alternatives offer better fees, faster payouts, or specialised features.",
    platforms: [
      {
        name: "Zinovia",
        fee: "Competitive",
        payoutSpeed: "48 hours",
        aiTools: "Planned",
        contentProtection: "Signed URLs + AES encryption",
        multilingual: "9 languages",
        bestFor:
          "Creators who want fast payouts, encrypted content delivery, built-in private messaging, and multilingual global reach — all without Patreon's tiered pricing.",
      },
      {
        name: "Ko-fi",
        fee: "0% on donations, 5% on shop",
        payoutSpeed: "Instant (via PayPal)",
        aiTools: "No",
        contentProtection: "None",
        multilingual: "English primary",
        bestFor:
          "SFW creators who want zero-fee donations, a simple digital shop, and instant PayPal payouts with minimal setup.",
      },
      {
        name: "Gumroad",
        fee: "10%",
        payoutSpeed: "Instant (via Stripe Connect)",
        aiTools: "No",
        contentProtection: "Basic link protection",
        multilingual: "English primary",
        bestFor:
          "Digital product sellers (ebooks, courses, templates) who want a simple storefront with built-in email marketing and affiliate tools.",
      },
      {
        name: "Fourthwall",
        fee: "0% on memberships",
        payoutSpeed: "14–30 days",
        aiTools: "No",
        contentProtection: "None",
        multilingual: "English primary",
        bestFor:
          "YouTubers and streamers who want to sell branded merchandise alongside memberships with YouTube and Twitch integration.",
      },
      {
        name: "Fanfix",
        fee: "20%",
        payoutSpeed: "14–30 days",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "English only",
        bestFor:
          "SFW Gen Z creators and influencers who want a clean-content-only, brand-safe subscription platform.",
      },
      {
        name: "Passes",
        fee: "10%",
        payoutSpeed: "7 days (weekly)",
        aiTools: "No",
        contentProtection: "Anti-screenshot tech",
        multilingual: "English primary",
        bestFor:
          "Creators who want built-in CRM, anti-leak technology, and one of the lowest platform fees in the industry.",
      },
      {
        name: "Buy Me a Coffee",
        fee: "5%",
        payoutSpeed: "Instant (via Stripe)",
        aiTools: "No",
        contentProtection: "None",
        multilingual: "English primary",
        bestFor:
          "Creators who want a lightweight tipping and membership page with a low 5% fee and instant Stripe payouts.",
      },
      {
        name: "Memberful",
        fee: "10% (free) / 4.9% (pro at $25/mo)",
        payoutSpeed: "Via Stripe (2–7 days)",
        aiTools: "No",
        contentProtection: "Gated access via Stripe",
        multilingual: "English primary",
        bestFor:
          "Creators and publishers who want to add paid memberships to their existing website with WordPress or custom integrations.",
      },
    ],
    faqs: [
      {
        q: "What is the best Patreon alternative in 2026?",
        a: "It depends on your needs. Zinovia is ideal for creators who want fast payouts (48 hours), encrypted content delivery, and multilingual support. Ko-fi is great for zero-fee donations. Gumroad excels at digital product sales. Fourthwall is perfect for merch-focused YouTubers.",
      },
      {
        q: "Which Patreon alternative has the lowest fees?",
        a: "Ko-fi charges 0% on donations (5% on shop sales). Fourthwall charges 0% on memberships. Buy Me a Coffee charges 5%. Zinovia, Gumroad, and Passes charge competitive rates between 10% and competitive. Patreon charges 5–12% depending on your plan.",
      },
      {
        q: "Why are creators leaving Patreon?",
        a: "Common reasons include Patreon's 5–12% tiered fees, 30+ day payout cycles, limited content security, and a platform that has become increasingly complex. Alternatives offer lower fees, faster payouts, and specialised features.",
      },
      {
        q: "Can I migrate my Patreon subscribers to another platform?",
        a: "You cannot directly transfer subscribers, but you can redirect your audience by announcing your move, sharing your new page link, and offering incentives to re-subscribe. Many creators run both platforms simultaneously during the transition.",
      },
      {
        q: "Which Patreon alternative pays creators fastest?",
        a: "Ko-fi and Buy Me a Coffee offer instant PayPal or Stripe payouts. Gumroad offers instant payouts via Stripe Connect. Zinovia pays within 48 hours via secure bank transfer. Patreon takes 30+ days.",
      },
      {
        q: "Do Patreon alternatives support recurring subscriptions?",
        a: "Yes. Zinovia, Fourthwall, Fanfix, Passes, Buy Me a Coffee, and Memberful all support recurring monthly subscriptions. Ko-fi offers memberships through Ko-fi Gold ($6/month). Gumroad supports memberships alongside one-time product sales.",
      },
    ],
  },
  "creator-platforms": {
    slug: "creator-platforms",
    name: "Best Creator Platforms",
    title: "Best Creator Monetisation Platforms 2026 — Complete Guide",
    description:
      "Comprehensive ranking of the best creator monetisation platforms in 2026. Compare fees, payouts, features, and tools across 12 top platforms.",
    summary:
      "The creator economy is bigger than ever in 2026, and choosing the right platform can make or break your income. This guide ranks and compares 12 leading creator monetisation platforms across fees, payout speed, content security, multilingual support, and specialised features — so you can find the perfect fit for your creative business.",
    platforms: [
      {
        name: "Zinovia",
        fee: "Competitive",
        payoutSpeed: "48 hours",
        aiTools: "Planned",
        contentProtection: "Signed URLs + AES encryption",
        multilingual: "9 languages",
        bestFor:
          "Creators who want the fastest payouts in the industry, enterprise-grade content security, built-in messaging, and multilingual global reach across 9 languages.",
      },
      {
        name: "OnlyFans",
        fee: "20%",
        payoutSpeed: "21 days",
        aiTools: "No",
        contentProtection: "Basic DRM",
        multilingual: "English only",
        bestFor:
          "Adult content creators who want access to the largest established user base in the creator subscription space.",
      },
      {
        name: "Patreon",
        fee: "5–12%",
        payoutSpeed: "30+ days",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "English primary",
        bestFor:
          "Creators with established audiences who want tiered membership plans and integrations with podcasting and video tools.",
      },
      {
        name: "Fansly",
        fee: "20%",
        payoutSpeed: "7–14 days",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "English only",
        bestFor:
          "Creators who want tiered subscriptions, live streaming, and a growing platform as an alternative to OnlyFans.",
      },
      {
        name: "FanVue",
        fee: "15%",
        payoutSpeed: "7–14 days",
        aiTools: "Yes",
        contentProtection: "Basic",
        multilingual: "Limited",
        bestFor:
          "Creators looking for AI-powered tools, a referral programme, and a lower fee than most subscription platforms.",
      },
      {
        name: "Passes",
        fee: "10%",
        payoutSpeed: "7 days (weekly)",
        aiTools: "No",
        contentProtection: "Anti-screenshot tech",
        multilingual: "English primary",
        bestFor:
          "Creators who want built-in CRM, anti-screenshot protection, and one of the lowest platform fees available.",
      },
      {
        name: "Ko-fi",
        fee: "0% on donations, 5% on shop",
        payoutSpeed: "Instant (via PayPal)",
        aiTools: "No",
        contentProtection: "None",
        multilingual: "English primary",
        bestFor:
          "SFW creators who want zero-fee tips, a simple digital shop, and instant PayPal payouts with minimal setup.",
      },
      {
        name: "Gumroad",
        fee: "10%",
        payoutSpeed: "Instant (via Stripe Connect)",
        aiTools: "No",
        contentProtection: "Basic link protection",
        multilingual: "English primary",
        bestFor:
          "Digital product sellers who want a simple storefront with built-in email marketing and affiliate tools.",
      },
      {
        name: "Fourthwall",
        fee: "0% on memberships",
        payoutSpeed: "14–30 days",
        aiTools: "No",
        contentProtection: "None",
        multilingual: "English primary",
        bestFor:
          "YouTubers and streamers who want branded merchandise sales alongside memberships with YouTube and Twitch integration.",
      },
      {
        name: "Buy Me a Coffee",
        fee: "5%",
        payoutSpeed: "Instant (via Stripe)",
        aiTools: "No",
        contentProtection: "None",
        multilingual: "English primary",
        bestFor:
          "Creators who want a lightweight tipping and membership page with a low fee and instant payouts.",
      },
      {
        name: "LoyalFans",
        fee: "20%",
        payoutSpeed: "7 days (weekly)",
        aiTools: "No",
        contentProtection: "Basic DRM",
        multilingual: "English primary",
        bestFor:
          "Adult content creators who want live streaming, a clip store, and a dedicated adult-focused audience.",
      },
      {
        name: "MYM.fans",
        fee: "25%",
        payoutSpeed: "Monthly",
        aiTools: "No",
        contentProtection: "Basic",
        multilingual: "French / English",
        bestFor:
          "European and French-speaking creators who want built-in content request features and a Europe-based platform.",
      },
    ],
    faqs: [
      {
        q: "What is the best creator platform in 2026?",
        a: "The best platform depends on your content type and priorities. Zinovia leads in payout speed (48 hours) and content security. OnlyFans has the largest user base. Patreon is established for podcasters and educators. Ko-fi is best for zero-fee donations. Choose based on your specific needs.",
      },
      {
        q: "Which creator platform takes the lowest cut?",
        a: "Ko-fi takes 0% on donations. Fourthwall takes 0% on memberships. Buy Me a Coffee takes 5%. Passes and Gumroad take 10%. Zinovia charges competitive rates. OnlyFans, Fansly, LoyalFans, and Fanfix all take 20%. MYM.fans takes the highest cut at 25%.",
      },
      {
        q: "Which creator platform has the fastest payouts?",
        a: "Ko-fi, Buy Me a Coffee, and Gumroad offer instant payouts via PayPal or Stripe. Zinovia processes payouts within 48 hours via secure bank transfer — the fastest among subscription-first platforms. Most other platforms take 7–30+ days.",
      },
      {
        q: "Can I use more than one creator platform?",
        a: "Yes, and many successful creators do. Diversifying across platforms reduces risk and expands your audience reach. You can use Zinovia for subscriptions, Gumroad for digital products, and Ko-fi for tips, for example.",
      },
      {
        q: "Which creator platforms protect content from leaks?",
        a: "Zinovia offers the strongest content protection with signed, time-limited URLs and AES encryption. Passes uses anti-screenshot technology. OnlyFans and LoyalFans offer basic DRM. Most other platforms offer minimal or no content protection.",
      },
      {
        q: "What should I look for when choosing a creator platform?",
        a: "Key factors include platform fees, payout speed, content security, audience size, content policies, supported payment methods, and specialised features. Also consider multilingual support if you have a global audience, and whether the platform serves your specific content niche.",
      },
      {
        q: "Are there creator platforms with no monthly fees?",
        a: "Yes. Most platforms on this list, including Zinovia, OnlyFans, Fansly, Passes, and Gumroad, charge no monthly fees — they take a percentage of your earnings instead. Ko-fi is free for basic use but charges $6/month for Ko-fi Gold features. Memberful charges $25/month for its Pro plan.",
      },
    ],
  },
};

export function getAlternative(slug: string): AlternativeData | undefined {
  return ALTERNATIVES[slug];
}

export function getAllAlternativeSlugs(): string[] {
  return Object.keys(ALTERNATIVES);
}
