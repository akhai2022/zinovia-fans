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
  "ai-tools": {
    slug: "ai-tools",
    name: "AI Creator Tools",
    title: "AI Creator Tools — Smart Captions, Auto-Tagging & Thumbnails | Zinovia",
    description: "Zinovia's AI creator tools automate captions, tagging, NSFW screening, thumbnail generation, and blurhash previews. Save hours on every upload.",
    heroHeading: "Create smarter.",
    heroAccent: "AI does the rest.",
    heroDescription: "Smart captions, auto-tagging, NSFW auto-screening, AI thumbnail generation, and blurhash previews — Zinovia's AI tools handle the busywork so you can focus on creating.",
    benefits: [
      { title: "Smart Captions", description: "AI analyses your media and suggests engaging captions in seconds. Edit, approve, or regenerate — you stay in control of your voice." },
      { title: "Auto-Tagging", description: "Every upload is automatically tagged with relevant keywords. Fans find your content faster, and your posts surface in more searches." },
      { title: "NSFW Auto-Screening", description: "AI scans uploads in real time and flags content that may need age-gating or review. Stay compliant without manually reviewing every post." },
      { title: "AI Thumbnail Generation", description: "Automatically generate eye-catching thumbnails for your videos and galleries. No design skills required — AI picks the best frame and crops it." },
    ],
    details: [
      { title: "Blurhash Previews", description: "Every image gets a lightweight blurhash placeholder generated on upload. Fans see a beautiful colour preview while content loads, improving perceived performance." },
      { title: "Batch Processing", description: "Upload multiple files at once and AI processes them all in parallel — captions, tags, thumbnails, and screening happen simultaneously." },
      { title: "Language-Aware Captions", description: "Smart captions detect the language context of your audience and generate suggestions accordingly. Multi-language support out of the box." },
      { title: "Creator Override", description: "Every AI suggestion is editable. Accept, modify, or discard any auto-generated caption, tag, or thumbnail before publishing." },
    ],
    faqs: [
      { q: "How does AI captioning work on Zinovia?", a: "When you upload media, Zinovia's AI analyses the visual content and your posting history to generate a relevant caption suggestion. You can accept it as-is, edit it, or regenerate a new suggestion before publishing." },
      { q: "Is the NSFW screening automatic?", a: "Yes. Every upload is automatically scanned by AI in real time. Content flagged as potentially explicit is marked for age-gated access. You can review and adjust the classification before the post goes live." },
      { q: "Can I disable auto-tagging?", a: "Yes. Auto-tagging is enabled by default but can be toggled off in your creator settings. You can also manually edit or remove any tags the AI generates on a per-post basis." },
      { q: "How are AI thumbnails generated?", a: "For videos, the AI analyses keyframes and selects the most visually engaging frame as a thumbnail. For galleries, it picks the strongest image. You can always swap the thumbnail for a different frame or upload your own." },
      { q: "What is a blurhash preview?", a: "Blurhash is a compact representation of the colours and shapes in an image. While the full image loads, fans see a smooth, blurred colour preview instead of a blank space. It's generated automatically for every image you upload." },
    ],
  },
  "content-security": {
    slug: "content-security",
    name: "Content Security",
    title: "Content Security — Signed URLs, Encryption & Watermarking | Zinovia",
    description: "Zinovia protects creator content with signed URLs, AES encryption, invisible watermarking, DMCA takedown support, and age-gated access. Your content, secured.",
    heroHeading: "Your content.",
    heroAccent: "Locked down.",
    heroDescription: "Signed URLs, AES encryption, invisible watermarking, DMCA takedown support, and age-gated access — Zinovia protects your work at every layer.",
    benefits: [
      { title: "Signed URLs", description: "Every media file is served through time-limited, cryptographically signed URLs. Links expire quickly, preventing hotlinking and unauthorized sharing." },
      { title: "AES Encryption", description: "All media is encrypted at rest using AES-256. Even if storage is compromised, your content remains unreadable without the decryption keys." },
      { title: "Invisible Watermarking", description: "Unique, invisible watermarks are embedded in media delivered to each subscriber. If content leaks, you can trace it back to the source." },
      { title: "DMCA Takedown Support", description: "Zinovia provides a dedicated DMCA process. Report stolen content, and our team issues takedown notices on your behalf to hosting providers and search engines." },
    ],
    details: [
      { title: "Age-Gated Access", description: "Content flagged as explicit — manually or by AI — is automatically gated behind age verification. Only verified users can access restricted content." },
      { title: "Download Prevention", description: "Right-click saving, screen recording detection hints, and disabled hotlinking work together to deter casual content theft." },
      { title: "Access Revocation", description: "When a subscription expires or a user is blocked, access to all signed URLs is immediately revoked. No lingering access to old content." },
      { title: "Audit Logging", description: "Every content access event is logged. See who accessed your content, when, and from what device — useful for investigating potential leaks." },
    ],
    faqs: [
      { q: "What are signed URLs?", a: "Signed URLs are temporary, cryptographically secured links to your media. Each URL contains an expiration timestamp and a signature that proves it was issued by Zinovia. Once expired, the link returns an error — preventing bookmark-and-share piracy." },
      { q: "How does invisible watermarking work?", a: "When a subscriber views or downloads your content, a unique, imperceptible watermark is embedded in the media. The watermark is invisible to the human eye but can be extracted by Zinovia's detection tools to identify the subscriber who leaked the content." },
      { q: "Does Zinovia handle DMCA takedowns for me?", a: "Yes. When you report leaked content through your creator dashboard, Zinovia's trust and safety team prepares and sends DMCA takedown notices to the infringing sites, hosting providers, and search engines on your behalf." },
      { q: "Is my content encrypted at rest?", a: "Yes. All media uploaded to Zinovia is encrypted using AES-256 encryption before being stored. Decryption happens on-the-fly when an authorized user requests the content through a valid signed URL." },
      { q: "How does age-gated access work?", a: "Content that is classified as explicit — either by the creator or by Zinovia's AI screening — requires users to complete age verification before access is granted. Unverified users see a blurred placeholder and a prompt to verify their age." },
    ],
  },
  analytics: {
    slug: "analytics",
    name: "Creator Analytics",
    title: "Creator Analytics — Real-Time Growth & Revenue Insights | Zinovia",
    description: "Zinovia's creator analytics dashboard tracks subscriber growth, earnings trends, content performance, retention metrics, and revenue breakdown in real time.",
    heroHeading: "Know your numbers.",
    heroAccent: "Grow with data.",
    heroDescription: "Real-time subscriber growth, earnings trends, content performance, retention metrics, and revenue breakdown — everything you need to make smarter decisions.",
    benefits: [
      { title: "Real-Time Subscriber Growth", description: "Watch your subscriber count update in real time. See new signups, churned subscribers, and net growth at a glance on your dashboard." },
      { title: "Earnings Trends", description: "Track daily, weekly, and monthly revenue with clear trend charts. Spot patterns, identify your best earning periods, and plan content accordingly." },
      { title: "Content Performance", description: "See which posts earn the most, get the most engagement, and drive new subscriptions. Use data to double down on what works." },
      { title: "Retention Metrics", description: "Understand how long subscribers stay and why they leave. Retention cohort charts show your month-over-month subscriber stickiness." },
    ],
    details: [
      { title: "Revenue Breakdown", description: "See exactly where your money comes from — subscriptions, tips, paid unlocks, and messaging. Identify your strongest revenue streams and grow them." },
      { title: "Geographic Insights", description: "Understand where your audience lives. Country and region breakdowns help you tailor content, posting times, and pricing to your top markets." },
      { title: "Device & Platform Data", description: "Know whether your fans browse on mobile, desktop, or tablet. Optimise your content format for the devices your audience actually uses." },
      { title: "Export & Reporting", description: "Download your analytics data as CSV or PDF. Use it for tax reporting, sponsorship pitches, or your own business planning." },
    ],
    faqs: [
      { q: "Is the analytics dashboard real-time?", a: "Yes. Subscriber counts, earnings, and engagement metrics update in real time. Revenue figures reflect cleared payments and are updated as transactions are processed." },
      { q: "Can I see which posts perform best?", a: "Yes. The content performance section ranks your posts by earnings, views, likes, and unlock rate. You can filter by date range and content type to understand what resonates with your audience." },
      { q: "How are retention metrics calculated?", a: "Retention is measured using monthly cohort analysis. Each cohort represents subscribers who joined in a given month, and the chart tracks what percentage remain active in subsequent months." },
      { q: "Can I export my analytics data?", a: "Yes. You can export your full analytics data as CSV or PDF from the dashboard. This is useful for tax preparation, sponsorship proposals, or personal record-keeping." },
      { q: "What is the revenue breakdown?", a: "The revenue breakdown splits your total earnings into categories: subscriptions, tips, paid unlocks, and paid messaging. Each category shows its contribution as both a dollar amount and a percentage of total revenue, updated in real time." },
    ],
  },
};

export function getFeature(slug: string): FeatureData | undefined {
  return FEATURES[slug];
}

export function getAllFeatureSlugs(): string[] {
  return Object.keys(FEATURES);
}
