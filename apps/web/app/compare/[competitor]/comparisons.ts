export type ComparisonData = {
  name: string;
  slug: string;
  title: string;
  description: string;
  summary: string;
  features: { feature: string; zinovia: string; competitor: string }[];
  fees: { label: string; zinovia: string; competitor: string }[];
  payoutSpeed: { zinovia: string; competitor: string };
  bestFor: { zinovia: string; competitor: string };
  faqs: { q: string; a: string }[];
};

export const COMPARISONS: Record<string, ComparisonData> = {
  patreon: {
    name: "Patreon",
    slug: "patreon",
    title: "Zinovia vs Patreon: Fees, Features & Payouts (2026)",
    description: "Compare Zinovia vs Patreon: fees, payout speed, features, and creator tools side by side. See why creators are switching.",
    summary: "Zinovia offers faster payouts (48 hours vs 30+ days), lower platform fees, built-in private messaging, and signed-URL content security — features Patreon charges extra for or doesn't offer.",
    features: [
      { feature: "Monthly Subscriptions", zinovia: "Yes", competitor: "Yes" },
      { feature: "Pay-Per-View Content", zinovia: "Yes", competitor: "Limited" },
      { feature: "Direct Messaging", zinovia: "Built-in", competitor: "Add-on" },
      { feature: "Content Encryption", zinovia: "Signed URLs + AES", competitor: "Basic" },
      { feature: "Creator Verification (KYC)", zinovia: "Yes", competitor: "No" },
      { feature: "Fan Tips", zinovia: "Yes", competitor: "Yes" },
      { feature: "Analytics Dashboard", zinovia: "Yes", competitor: "Yes" },
      { feature: "Multi-Language Platform", zinovia: "9 languages", competitor: "English primary" },
      { feature: "Age Verification", zinovia: "Built-in", competitor: "No" },
      { feature: "Custom Creator Profiles", zinovia: "Yes", competitor: "Yes" },
    ],
    fees: [
      { label: "Platform Fee", zinovia: "Competitive", competitor: "5-12%" },
      { label: "Payment Processing", zinovia: "Stripe (2.9% + 30¢)", competitor: "Included in platform fee" },
      { label: "Monthly Fee", zinovia: "None", competitor: "None" },
      { label: "Payout Fee", zinovia: "None", competitor: "Varies by method" },
    ],
    payoutSpeed: { zinovia: "48 hours", competitor: "30+ days" },
    bestFor: {
      zinovia: "Creators who want fast payouts, private content delivery, multilingual reach, and built-in messaging.",
      competitor: "Creators with established audiences who primarily use English and don't need fast payouts.",
    },
    faqs: [
      { q: "Is Zinovia a good alternative to Patreon?", a: "Yes. Zinovia offers faster payouts (48 hours vs 30+ days), built-in private messaging, content encryption with signed URLs, and support for 9 languages — all with competitive fees." },
      { q: "Can I migrate from Patreon to Zinovia?", a: "Yes. Create your Zinovia account, set up your profile and subscription tiers, then redirect your audience to your new page. Your content and subscriber relationships transfer with you." },
      { q: "How do Zinovia's fees compare to Patreon?", a: "Zinovia charges a competitive platform fee with no hidden charges. Patreon charges 5-12% depending on your plan, plus payment processing fees on some tiers." },
      { q: "Does Zinovia support the same content types as Patreon?", a: "Yes. Zinovia supports text posts, images, videos, paid unlocks, subscriptions, tips, and direct messaging — plus additional features like content encryption and age verification." },
      { q: "Which platform has better payout speed?", a: "Zinovia pays creators within 48 hours via Stripe Connect. Patreon processes payouts monthly, typically taking 30+ days from when a patron is charged." },
    ],
  },
  onlyfans: {
    name: "OnlyFans",
    slug: "onlyfans",
    title: "Zinovia vs OnlyFans: Which Platform Is Better for Creators?",
    description: "Compare Zinovia vs OnlyFans: fees, features, content security, and payouts. Find the right creator platform for your needs.",
    summary: "Zinovia provides better content security (signed URLs), faster payouts (48 hours), multilingual support (9 languages), and creator verification — while OnlyFans has a larger existing user base.",
    features: [
      { feature: "Monthly Subscriptions", zinovia: "Yes", competitor: "Yes" },
      { feature: "Pay-Per-View Content", zinovia: "Yes", competitor: "Yes" },
      { feature: "Direct Messaging", zinovia: "Built-in", competitor: "Yes" },
      { feature: "Content Encryption", zinovia: "Signed URLs + AES", competitor: "Basic DRM" },
      { feature: "Creator Verification (KYC)", zinovia: "Yes", competitor: "Yes" },
      { feature: "Fan Tips", zinovia: "Yes", competitor: "Yes" },
      { feature: "Analytics Dashboard", zinovia: "Yes", competitor: "Basic" },
      { feature: "Multi-Language Platform", zinovia: "9 languages", competitor: "English only" },
      { feature: "Age Verification", zinovia: "Built-in", competitor: "Yes" },
      { feature: "Mainstream Creator Focus", zinovia: "All niches", competitor: "Adult-focused" },
    ],
    fees: [
      { label: "Platform Fee", zinovia: "Competitive", competitor: "20%" },
      { label: "Payment Processing", zinovia: "Stripe (2.9% + 30¢)", competitor: "Included" },
      { label: "Monthly Fee", zinovia: "None", competitor: "None" },
      { label: "Payout Fee", zinovia: "None", competitor: "Varies" },
    ],
    payoutSpeed: { zinovia: "48 hours", competitor: "21 days" },
    bestFor: {
      zinovia: "Creators who want better content security, faster payouts, multilingual reach, and a platform that serves all niches equally.",
      competitor: "Adult content creators who want access to OnlyFans' large existing user base.",
    },
    faqs: [
      { q: "Is Zinovia better than OnlyFans?", a: "It depends on your needs. Zinovia offers lower fees, faster payouts (48hr vs 21 days), better content security, and 9-language support. OnlyFans has a larger established user base." },
      { q: "Does Zinovia allow the same content as OnlyFans?", a: "Zinovia supports all content types within our Terms of Service. We serve creators across all niches including fitness, art, music, education, and more." },
      { q: "How much does OnlyFans take vs Zinovia?", a: "OnlyFans takes a flat 20% of creator earnings. Zinovia charges a competitive platform fee that allows creators to keep more of what they earn." },
      { q: "Can I use both Zinovia and OnlyFans?", a: "Yes. Many creators use multiple platforms to diversify their income. You can maintain profiles on both and cross-promote." },
      { q: "Is Zinovia safer than OnlyFans for content?", a: "Zinovia uses signed, time-limited URLs and AES encryption for content delivery, making it significantly harder for content to be leaked or downloaded without authorization." },
    ],
  },
  fanvue: {
    name: "Fanvue",
    slug: "fanvue",
    title: "Zinovia vs Fanvue: Complete Platform Comparison (2026)",
    description: "Compare Zinovia vs Fanvue: features, fees, payout speed, and creator tools. See which platform is right for you.",
    summary: "Both platforms cater to creators, but Zinovia offers faster payouts (48 hours), 9-language support, built-in KYC verification, and Stripe-powered payments for global reach.",
    features: [
      { feature: "Monthly Subscriptions", zinovia: "Yes", competitor: "Yes" },
      { feature: "Pay-Per-View Content", zinovia: "Yes", competitor: "Yes" },
      { feature: "Direct Messaging", zinovia: "Built-in", competitor: "Yes" },
      { feature: "Content Encryption", zinovia: "Signed URLs + AES", competitor: "Basic" },
      { feature: "Creator Verification (KYC)", zinovia: "Yes", competitor: "Yes" },
      { feature: "Fan Tips", zinovia: "Yes", competitor: "Yes" },
      { feature: "Analytics Dashboard", zinovia: "Yes", competitor: "Yes" },
      { feature: "Multi-Language Platform", zinovia: "9 languages", competitor: "Limited" },
      { feature: "AI Tools", zinovia: "Planned", competitor: "Yes" },
      { feature: "Referral Program", zinovia: "Planned", competitor: "Yes" },
    ],
    fees: [
      { label: "Platform Fee", zinovia: "Competitive", competitor: "15%" },
      { label: "Payment Processing", zinovia: "Stripe (2.9% + 30¢)", competitor: "Included" },
      { label: "Monthly Fee", zinovia: "None", competitor: "None" },
      { label: "Payout Fee", zinovia: "None", competitor: "Varies" },
    ],
    payoutSpeed: { zinovia: "48 hours", competitor: "7-14 days" },
    bestFor: {
      zinovia: "Creators who prioritise fast payouts, content security, and multilingual global reach with transparent Stripe payments.",
      competitor: "Creators interested in AI-powered tools and built-in referral features.",
    },
    faqs: [
      { q: "How does Zinovia compare to Fanvue?", a: "Zinovia offers faster payouts (48hr vs 7-14 days), stronger content encryption (signed URLs + AES), and support for 9 languages. Fanvue offers AI tools and a referral program." },
      { q: "Which has lower fees: Zinovia or Fanvue?", a: "Zinovia charges a competitive platform fee. Fanvue charges 15%. Compare both to see which gives you better take-home earnings for your audience size." },
      { q: "Can I switch from Fanvue to Zinovia?", a: "Yes. Create your Zinovia account, verify your identity, set up your subscription tiers, and start redirecting your audience. The process takes less than 10 minutes." },
      { q: "Does Zinovia have AI features like Fanvue?", a: "AI features are on Zinovia's roadmap. Currently, Zinovia focuses on core monetisation features: subscriptions, paid unlocks, messaging, tips, and secure content delivery." },
      { q: "Which platform is more secure?", a: "Zinovia uses signed, time-limited URLs and AES encryption to protect creator content. This makes it significantly harder for content to be redistributed without permission." },
    ],
  },
  fansly: {
    name: "Fansly",
    slug: "fansly",
    title: "Zinovia vs Fansly: Features, Fees & Creator Tools (2026)",
    description: "Compare Zinovia vs Fansly: subscription features, fees, payout speed, and content security. Make an informed platform choice.",
    summary: "Zinovia differentiates with 48-hour payouts, 9-language multilingual support, Stripe-powered global payments, and enterprise-grade content encryption.",
    features: [
      { feature: "Monthly Subscriptions", zinovia: "Yes", competitor: "Yes" },
      { feature: "Pay-Per-View Content", zinovia: "Yes", competitor: "Yes" },
      { feature: "Direct Messaging", zinovia: "Built-in", competitor: "Yes" },
      { feature: "Content Encryption", zinovia: "Signed URLs + AES", competitor: "Basic" },
      { feature: "Creator Verification (KYC)", zinovia: "Yes", competitor: "Yes" },
      { feature: "Fan Tips", zinovia: "Yes", competitor: "Yes" },
      { feature: "Analytics Dashboard", zinovia: "Yes", competitor: "Basic" },
      { feature: "Multi-Language Platform", zinovia: "9 languages", competitor: "English only" },
      { feature: "Tiered Subscriptions", zinovia: "Planned", competitor: "Yes" },
      { feature: "Streaming", zinovia: "Planned", competitor: "Yes" },
    ],
    fees: [
      { label: "Platform Fee", zinovia: "Competitive", competitor: "20%" },
      { label: "Payment Processing", zinovia: "Stripe (2.9% + 30¢)", competitor: "Included" },
      { label: "Monthly Fee", zinovia: "None", competitor: "None" },
      { label: "Payout Fee", zinovia: "None", competitor: "Varies" },
    ],
    payoutSpeed: { zinovia: "48 hours", competitor: "7-14 days" },
    bestFor: {
      zinovia: "Creators who want fast payouts, top-tier content security, multilingual reach, and Stripe-powered global payments.",
      competitor: "Creators who want tiered subscription models and live streaming built into the platform.",
    },
    faqs: [
      { q: "Is Zinovia better than Fansly?", a: "Both platforms serve creators well. Zinovia excels in payout speed (48 hours), content security (signed URLs + AES), and multilingual support (9 languages). Fansly offers tiered subscriptions and streaming." },
      { q: "What are Fansly's fees compared to Zinovia?", a: "Fansly charges 20% of creator earnings. Zinovia charges a competitive platform fee, allowing creators to retain more of their income." },
      { q: "Can I use Zinovia and Fansly together?", a: "Yes. Many creators maintain profiles on multiple platforms to maximise their reach and diversify income sources." },
      { q: "Does Zinovia support streaming like Fansly?", a: "Live streaming is on Zinovia's roadmap. Currently, Zinovia focuses on subscriptions, paid content, messaging, tips, and secure media delivery." },
      { q: "Which platform handles payouts faster?", a: "Zinovia processes payouts within 48 hours via Stripe Connect. Fansly typically takes 7-14 days for payouts to reach your bank account." },
    ],
  },
};

export function getComparison(slug: string): ComparisonData | undefined {
  return COMPARISONS[slug];
}

export function getAllComparisonSlugs(): string[] {
  return Object.keys(COMPARISONS);
}
