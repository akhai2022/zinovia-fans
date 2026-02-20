export type FeatureData = {
  slug: string;
  name: string;
  title: string;
  description: string;
  heroHeading: string;
  heroAccent: string;
  heroDescription: string;
  benefits: { title: string; description: string }[];
  details: { title: string; description: string }[];
  faqs: { q: string; a: string }[];
};

export const FEATURES: Record<string, FeatureData> = {
  subscriptions: {
    slug: "subscriptions",
    name: "Monthly Subscriptions",
    title: "Monthly Subscriptions — Recurring Revenue for Creators | Zinovia",
    description: "Build predictable monthly income with creator subscriptions on Zinovia. Set your price, publish exclusive content, earn recurring revenue. 48-hour payouts.",
    heroHeading: "Recurring revenue.",
    heroAccent: "Predictable growth.",
    heroDescription: "Set your subscription price, publish exclusive content, and build predictable monthly income from fans who value your work.",
    benefits: [
      { title: "Predictable Income", description: "Know what you'll earn each month. Subscriptions create steady, recurring revenue that grows with your audience." },
      { title: "You Set the Price", description: "Complete control over your subscription pricing. Charge what your content is worth — no platform-imposed pricing tiers." },
      { title: "Automatic Billing", description: "Our payment system handles all billing, renewals, and failed payment recovery. You focus on creating, we handle the payments." },
      { title: "48-Hour Payouts", description: "Your earnings arrive within 48 hours via secure bank transfer. No waiting weeks or months to access your money." },
    ],
    details: [
      { title: "Flexible Pricing", description: "Set any monthly price for your subscription. Adjust it anytime as your content library and audience grows." },
      { title: "Subscriber Management", description: "See who's subscribed, track retention, and understand your audience through the creator analytics dashboard." },
      { title: "Exclusive Content Delivery", description: "Subscriber-only posts, media, and messages. Content is protected by signed URLs and encryption." },
      { title: "Global Payments", description: "Accept payments from fans worldwide. Support for all major cards and payment methods." },
    ],
    faqs: [
      { q: "How do I set my subscription price?", a: "During onboarding, you choose your monthly subscription price. You can change it anytime from your creator settings. Existing subscribers keep their current price until their next renewal." },
      { q: "What payment methods do subscribers use?", a: "Our secure payment processor supports all major credit and debit cards, Apple Pay, Google Pay, and other local payment methods depending on the subscriber's country." },
      { q: "How quickly do I get paid?", a: "Zinovia processes payouts via secure bank transfer. Your earnings are transferred to your bank account within 48 hours of clearing." },
      { q: "Can I offer free trials?", a: "Currently, subscriptions start immediately at your set price. Free trial support is on our roadmap for future release." },
      { q: "What happens if a payment fails?", a: "Our payment system automatically retries failed payments over several days. If the payment ultimately fails, the subscription is cancelled and the fan loses access to exclusive content." },
    ],
  },
  payouts: {
    slug: "payouts",
    name: "Fast Payouts",
    title: "Fast Creator Payouts — Get Paid in 48 Hours | Zinovia",
    description: "Get paid within 48 hours on Zinovia. Secure bank transfers power instant creator payouts to your bank account. No minimum thresholds, no monthly delays.",
    heroHeading: "Get paid fast.",
    heroAccent: "48 hours.",
    heroDescription: "No waiting weeks for your earnings. Zinovia pays creators within 48 hours via secure bank transfer — directly to your bank account.",
    benefits: [
      { title: "48-Hour Speed", description: "Your earnings reach your bank account within 48 hours. Most other platforms take 7-30+ days." },
      { title: "No Minimum Threshold", description: "Get paid regardless of the amount. No need to accumulate a minimum balance before requesting a payout." },
      { title: "Secure Payment Infrastructure", description: "Industry-leading payment infrastructure handles your payouts. Secure, reliable, and globally available." },
      { title: "Transparent Fees", description: "Know exactly what you'll earn. No hidden deductions, no surprise charges on payout day." },
    ],
    details: [
      { title: "Automatic Processing", description: "Payouts are processed automatically once your earnings clear. No manual withdrawal requests needed." },
      { title: "Global Bank Support", description: "Our payment system supports bank accounts in 40+ countries. Get paid in your local currency." },
      { title: "Earnings Dashboard", description: "Track your earnings, pending payouts, and payout history in real time from your creator dashboard." },
      { title: "Tax Documentation", description: "Tax forms and documentation are provided to help you stay compliant with your local tax requirements." },
    ],
    faqs: [
      { q: "How fast are payouts on Zinovia?", a: "Payouts are processed within 48 hours via secure bank transfer. The exact timing depends on your bank's processing speed, but most creators receive funds within 2 business days." },
      { q: "Is there a minimum payout amount?", a: "No. Zinovia doesn't impose a minimum payout threshold. You receive your earnings regardless of the amount." },
      { q: "Which countries are supported?", a: "Zinovia supports payouts to bank accounts in 40+ countries. Check our help center for the full list of supported countries." },
      { q: "What currency will I receive?", a: "You receive payouts in your local currency. Currency conversion is handled automatically at competitive exchange rates." },
      { q: "How do I track my earnings?", a: "Your creator dashboard shows real-time earnings, pending payouts, payout history, and a breakdown by revenue source (subscriptions, tips, paid content, messaging)." },
    ],
  },
  messaging: {
    slug: "messaging",
    name: "Private Messaging",
    title: "Private Creator Messaging — DMs with Fans | Zinovia",
    description: "Connect with fans through private messaging on Zinovia. Built-in DMs for creators — monetize conversations, share exclusive content, build relationships.",
    heroHeading: "Talk to your fans.",
    heroAccent: "Directly.",
    heroDescription: "Built-in private messaging lets you connect with subscribers, share exclusive content, and build deeper relationships with your audience.",
    benefits: [
      { title: "Direct Connection", description: "No algorithm between you and your fans. Message subscribers directly through the platform they're already on." },
      { title: "Additional Revenue", description: "Messaging creates another monetisation channel. Offer paid DM access, personalised content, or premium interactions." },
      { title: "Built-In, Not Bolted On", description: "Messaging is native to Zinovia — not a third-party add-on. Seamless experience for both creators and fans." },
      { title: "Content Sharing", description: "Share media, links, and exclusive content directly in conversations. All protected by the same encryption as your posts." },
    ],
    details: [
      { title: "Real-Time Messages", description: "WebSocket-powered real-time messaging. Messages appear instantly, just like any modern messaging app." },
      { title: "Media Support", description: "Share images and videos directly in conversations. All media is encrypted and delivered through signed URLs." },
      { title: "Notification System", description: "Creators and fans receive notifications for new messages. Never miss an important conversation." },
      { title: "Privacy First", description: "End-to-end message delivery with encrypted storage. Your conversations remain private and secure." },
    ],
    faqs: [
      { q: "Can all subscribers message me?", a: "Yes. Active subscribers can send you direct messages through the platform. You control how and when you respond." },
      { q: "Can I send mass messages?", a: "Currently, messaging is 1-on-1 between creators and fans. Broadcast messaging features are planned for future release." },
      { q: "Is messaging included in the subscription?", a: "Basic messaging is available to all subscribers. Creators can optionally charge for premium messaging access or personalised interactions." },
      { q: "Are messages encrypted?", a: "Yes. Messages are encrypted in transit and at rest. Media shared in conversations is delivered through the same signed URL system used for posts." },
      { q: "Can I block users?", a: "Yes. You can block any user from messaging you. Blocked users cannot send you messages or view your online status." },
    ],
  },
  "paid-content": {
    slug: "paid-content",
    name: "Paid Unlocks",
    title: "Paid Unlocks — Monetize Individual Posts | Zinovia",
    description: "Sell individual posts, photos, and videos with paid unlocks on Zinovia. Let fans purchase specific content without a subscription. Secure delivery.",
    heroHeading: "Sell individual content.",
    heroAccent: "Your price, your rules.",
    heroDescription: "Not everything needs a subscription. Sell specific posts, photos, videos, or files as one-time purchases with paid unlocks.",
    benefits: [
      { title: "Flexible Monetisation", description: "Sell premium content to fans who aren't ready for a subscription. Lower the barrier to that first purchase." },
      { title: "Higher Revenue per Piece", description: "Premium content can be priced individually. A special photoshoot or tutorial can earn more as a paid unlock than as part of a subscription." },
      { title: "Subscriber Upsells", description: "Even subscribers can unlock premium content. Use paid unlocks for special releases, limited editions, or high-value items." },
      { title: "Instant Access", description: "Fans pay once and get immediate access to the content. No recurring commitment required." },
    ],
    details: [
      { title: "Custom Pricing", description: "Set any price for each paid unlock. Price premium content higher, promotional content lower." },
      { title: "Blurred Previews", description: "Locked content shows a blurred preview to entice fans. They see what they're getting before they pay." },
      { title: "Secure Delivery", description: "Once purchased, content is delivered through signed, time-limited URLs. No unauthorized sharing." },
      { title: "Revenue Tracking", description: "Track paid unlock revenue separately in your analytics dashboard. See which content sells best." },
    ],
    faqs: [
      { q: "How do paid unlocks work?", a: "You create a post and mark it as paid. Fans see a blurred preview and a price. When they pay, they get instant access to the full content." },
      { q: "Can subscribers also purchase paid unlocks?", a: "Yes. Paid unlocks are available to all users, including existing subscribers. Use them for premium content that goes beyond your regular subscription offering." },
      { q: "How much can I charge?", a: "You set the price for each individual paid unlock. There's no minimum or maximum — price your content based on its value to your audience." },
      { q: "When do I get paid for unlocks?", a: "Paid unlock earnings are processed in the same 48-hour payout cycle as all other Zinovia earnings. No separate waiting period." },
      { q: "Can fans preview locked content?", a: "Yes. Locked posts show a blurred preview of the content along with your caption and the unlock price. This helps fans make informed purchasing decisions." },
    ],
  },
};

export function getFeature(slug: string): FeatureData | undefined {
  return FEATURES[slug];
}

export function getAllFeatureSlugs(): string[] {
  return Object.keys(FEATURES);
}
