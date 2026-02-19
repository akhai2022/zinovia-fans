export type NicheData = {
  slug: string;
  name: string;
  title: string;
  description: string;
  heroHeading: string;
  heroAccent: string;
  heroDescription: string;
  painPoints: { title: string; description: string }[];
  features: { title: string; description: string; icon: string }[];
  faqs: { q: string; a: string }[];
};

const FEATURE_ICONS = {
  subscription: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  message: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  money: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  bolt: "M13 10V3L4 14h7v7l9-11h-7z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
};

export const NICHES: Record<string, NicheData> = {
  "fitness-creators": {
    slug: "fitness-creators",
    name: "Fitness Creators",
    title: "Fitness Creator Platform — Monetize Workouts & Training | Zinovia",
    description: "Build a subscription fitness business on Zinovia. Publish exclusive workouts, training plans, and coaching content. Fast payouts, secure delivery.",
    heroHeading: "Monetize your fitness content.",
    heroAccent: "Your way.",
    heroDescription: "Publish exclusive workouts, training programmes, and coaching sessions. Your subscribers get premium access, you get paid within 48 hours.",
    painPoints: [
      { title: "Social media doesn't pay enough", description: "Millions of views on Instagram and TikTok, but almost nothing in earnings. Ad revenue is unpredictable and out of your control." },
      { title: "Coaching doesn't scale", description: "1-on-1 coaching limits your income to the hours in your day. You need a model that grows with your audience, not your calendar." },
      { title: "Content gets leaked", description: "Workout plans and videos you sell get shared freely. You need a platform that protects your premium content with real security." },
    ],
    features: [
      { title: "Monthly Subscriptions", description: "Set your price. Fans pay monthly for access to your exclusive workouts, plans, and content.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Unlocks", description: "Sell individual workout programmes, meal plans, or coaching sessions as one-time purchases.", icon: FEATURE_ICONS.lock },
      { title: "Direct Messaging", description: "Offer personalised coaching and form checks through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "48-Hour Payouts", description: "Get your earnings fast. No waiting 30 days — Stripe Connect pays you within 48 hours.", icon: FEATURE_ICONS.bolt },
      { title: "Content Security", description: "Signed, time-limited URLs prevent your workout videos from being downloaded or leaked.", icon: FEATURE_ICONS.lock },
      { title: "Growth Analytics", description: "Track subscriber growth, revenue trends, and content performance to optimize your strategy.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell workout programmes on Zinovia?", a: "Yes. You can publish exclusive workout videos, training programmes, meal plans, and coaching content. Offer them as part of your monthly subscription or as individual paid unlocks." },
      { q: "How much can fitness creators earn on Zinovia?", a: "It depends on your audience size and pricing. Creators with 1,000 subscribers at €9.99/month earn approximately €9,990/month before fees. Zinovia's competitive fees mean you keep more." },
      { q: "Is my content protected from downloading?", a: "Yes. All media on Zinovia is delivered through signed, time-limited URLs with AES encryption. This makes it significantly harder for content to be leaked or redistributed." },
      { q: "Can I offer personalised coaching?", a: "Yes. Use Zinovia's built-in messaging to offer form checks, personalised feedback, and coaching interactions directly with your subscribers." },
      { q: "How fast do I get paid?", a: "Zinovia processes payouts through Stripe Connect. Your earnings are transferred to your bank account within 48 hours." },
    ],
  },
  musicians: {
    slug: "musicians",
    name: "Musicians",
    title: "Music Monetization Platform for Independent Artists | Zinovia",
    description: "Monetize your music on Zinovia. Share exclusive tracks, behind-the-scenes content, and connect with fans who pay. Fast payouts via Stripe.",
    heroHeading: "Turn your fans into subscribers.",
    heroAccent: "Get paid for your music.",
    heroDescription: "Share exclusive tracks, studio sessions, and behind-the-scenes content with paying subscribers. Build sustainable income beyond streaming royalties.",
    painPoints: [
      { title: "Streaming pays pennies", description: "You need thousands of streams to earn what one subscriber pays monthly. The streaming model works for labels, not independent artists." },
      { title: "Merch and touring are unpredictable", description: "Physical merch has upfront costs and touring is expensive. You need recurring revenue that doesn't depend on logistics." },
      { title: "Fans want more than what's on Spotify", description: "Your biggest fans want demos, acoustic versions, studio vlogs, and early access. Give them a place to get it — and pay for it." },
    ],
    features: [
      { title: "Exclusive Releases", description: "Drop tracks, demos, and unreleased material to subscribers before anywhere else.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Content", description: "Sell studio sessions, sample packs, or tutorials as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Fan Messaging", description: "Connect directly with your most dedicated fans through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "Earn from day one. Stripe Connect delivers your earnings to your bank within 48 hours.", icon: FEATURE_ICONS.bolt },
      { title: "Secure Delivery", description: "Your exclusive tracks are protected by signed URLs and encryption — no unauthorized downloads.", icon: FEATURE_ICONS.lock },
      { title: "Analytics", description: "See which content resonates, track subscriber growth, and optimise your release strategy.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I release music exclusively on Zinovia?", a: "Yes. Many musicians use Zinovia for early access releases, demos, acoustic versions, and exclusive content that isn't available on streaming platforms." },
      { q: "How does Zinovia compare to streaming royalties?", a: "One subscriber at €5/month pays more than thousands of Spotify streams. Zinovia gives you direct, recurring revenue from your most dedicated fans." },
      { q: "Can I sell beats or sample packs?", a: "Yes. Use paid unlocks to sell individual items like beats, sample packs, sheet music, or production tutorials alongside your subscription content." },
      { q: "Is my music protected from downloading?", a: "Yes. Zinovia delivers all media through signed, time-limited URLs with encryption. Unauthorized downloading and sharing is prevented at the infrastructure level." },
      { q: "Do I keep my rights?", a: "Absolutely. You retain full ownership of all content you publish on Zinovia. We simply provide the platform for delivery and monetisation." },
    ],
  },
  podcasters: {
    slug: "podcasters",
    name: "Podcasters",
    title: "Podcast Subscription Platform — Monetize Your Show | Zinovia",
    description: "Go beyond ads. Offer premium podcast episodes, bonus content, and exclusive access to paying subscribers on Zinovia. 48-hour payouts.",
    heroHeading: "Monetize your podcast.",
    heroAccent: "Beyond ads.",
    heroDescription: "Offer premium episodes, bonus content, and exclusive access to paying subscribers. Build recurring revenue that doesn't depend on download numbers.",
    painPoints: [
      { title: "Ad revenue requires massive scale", description: "Most podcast ad networks require 10,000+ downloads per episode. Smaller shows can't access this revenue stream." },
      { title: "Sponsorships are inconsistent", description: "Sponsors come and go. One bad quarter and your income drops. You need predictable, recurring revenue from your audience." },
      { title: "Free content creates an expectation", description: "Once listeners expect everything for free, it's hard to introduce premium tiers. Start building subscription habits early." },
    ],
    features: [
      { title: "Premium Episodes", description: "Publish subscriber-only episodes, extended cuts, and ad-free versions of your show.", icon: FEATURE_ICONS.subscription },
      { title: "Bonus Content", description: "Sell Q&A sessions, behind-the-scenes recordings, or course material as paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Listener Messaging", description: "Let premium subscribers send you questions and feedback through built-in direct messaging.", icon: FEATURE_ICONS.message },
      { title: "48-Hour Payouts", description: "Don't wait months for ad payments. Stripe Connect pays you within 48 hours.", icon: FEATURE_ICONS.bolt },
      { title: "Secure Audio Delivery", description: "Premium episodes are delivered through signed URLs — no unauthorized RSS scraping.", icon: FEATURE_ICONS.lock },
      { title: "Audience Insights", description: "Track subscriber growth, engagement, and revenue to understand what your audience values most.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I use Zinovia alongside my free podcast?", a: "Yes. Many podcasters keep their main show free on Apple Podcasts and Spotify, then offer bonus episodes, extended cuts, and exclusive content on Zinovia." },
      { q: "How is this different from Patreon for podcasters?", a: "Zinovia offers faster payouts (48 hours vs 30+ days), built-in messaging, content encryption, and 9-language support. It's purpose-built for content monetisation." },
      { q: "Can I sell individual episodes?", a: "Yes. Use paid unlocks to sell specific episodes, series, or supplementary content as one-time purchases, alongside your subscription offering." },
      { q: "Do I need a large audience to start?", a: "No. Even 100 dedicated listeners at €5/month generates €500/month in recurring revenue. Start small and grow with your audience." },
      { q: "Is my premium content protected?", a: "Yes. All audio and media is delivered through signed, time-limited URLs with encryption — preventing unauthorized access and redistribution." },
    ],
  },
  artists: {
    slug: "artists",
    name: "Artists",
    title: "Art Subscription Platform for Digital & Visual Artists | Zinovia",
    description: "Monetize your art on Zinovia. Share exclusive artwork, process videos, tutorials, and commissions with paying subscribers. 48-hour payouts.",
    heroHeading: "Earn from your art.",
    heroAccent: "On your terms.",
    heroDescription: "Publish exclusive artwork, process videos, tutorials, and behind-the-scenes content. Build a sustainable income from fans who value your creative work.",
    painPoints: [
      { title: "Commission work is feast or famine", description: "Some months you're overbooked, others you have nothing. Subscriptions create predictable monthly income regardless of commission volume." },
      { title: "Social media devalues your work", description: "Posting free art on Instagram gets likes but doesn't pay rent. Your most dedicated fans would pay for exclusive access if you gave them the option." },
      { title: "Digital art gets stolen easily", description: "Screenshots, right-click saves, and reposts. You need a platform that takes content protection seriously." },
    ],
    features: [
      { title: "Art Subscriptions", description: "Fans pay monthly for access to your exclusive artwork, sketches, and creative process.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Downloads", description: "Sell high-resolution files, brushes, textures, or tutorials as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Fan Interaction", description: "Discuss commissions, take requests, and share progress through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "Get paid within 48 hours. No waiting for monthly payouts or hitting minimum thresholds.", icon: FEATURE_ICONS.bolt },
      { title: "Content Protection", description: "Signed URLs and encryption protect your artwork from unauthorized downloading and redistribution.", icon: FEATURE_ICONS.lock },
      { title: "Growth Tracking", description: "Monitor subscriber growth, revenue trends, and which content your fans engage with most.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell digital art files on Zinovia?", a: "Yes. Use paid unlocks to sell high-resolution downloads, brushes, textures, PSD files, tutorials, or any digital art asset." },
      { q: "Is my artwork protected from theft?", a: "Yes. Zinovia delivers all media through signed, time-limited URLs with AES encryption. This prevents unauthorized downloading, screenshotting tools, and redistribution." },
      { q: "Can I take commissions through Zinovia?", a: "Yes. Use the built-in messaging feature to discuss commissions with subscribers, and paid unlocks to deliver the finished work securely." },
      { q: "How much can artists earn?", a: "It depends on your audience and pricing. Artists with 500 subscribers at €7/month earn approximately €3,500/month before fees. Many artists find subscriptions more stable than commissions alone." },
      { q: "Do I keep ownership of my art?", a: "Absolutely. You retain full ownership and copyright of all artwork you publish. Zinovia is just the platform for delivery and monetisation." },
    ],
  },
};

export function getNiche(slug: string): NicheData | undefined {
  return NICHES[slug];
}

export function getAllNicheSlugs(): string[] {
  return Object.keys(NICHES);
}
