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
      { title: "48-Hour Payouts", description: "Get your earnings fast. No waiting 30 days — secure bank transfers pay you within 48 hours.", icon: FEATURE_ICONS.bolt },
      { title: "Content Security", description: "Signed, time-limited URLs prevent your workout videos from being downloaded or leaked.", icon: FEATURE_ICONS.lock },
      { title: "Growth Analytics", description: "Track subscriber growth, revenue trends, and content performance to optimize your strategy.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell workout programmes on Zinovia?", a: "Yes. You can publish exclusive workout videos, training programmes, meal plans, and coaching content. Offer them as part of your monthly subscription or as individual paid unlocks." },
      { q: "How much can fitness creators earn on Zinovia?", a: "It depends on your audience size and pricing. Creators with 1,000 subscribers at €9.99/month earn approximately €9,990/month before fees. Zinovia's competitive fees mean you keep more." },
      { q: "Is my content protected from downloading?", a: "Yes. All media on Zinovia is delivered through signed, time-limited URLs with AES encryption. This makes it significantly harder for content to be leaked or redistributed." },
      { q: "Can I offer personalised coaching?", a: "Yes. Use Zinovia's built-in messaging to offer form checks, personalised feedback, and coaching interactions directly with your subscribers." },
      { q: "How fast do I get paid?", a: "Zinovia processes payouts via secure bank transfer. Your earnings are transferred to your bank account within 48 hours." },
    ],
  },
  musicians: {
    slug: "musicians",
    name: "Musicians",
    title: "Music Monetization Platform for Independent Artists | Zinovia",
    description: "Monetize your music on Zinovia. Share exclusive tracks, behind-the-scenes content, and connect with fans who pay. Fast 48-hour payouts.",
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
      { title: "Fast Payouts", description: "Earn from day one. Your earnings are delivered to your bank within 48 hours via secure transfer.", icon: FEATURE_ICONS.bolt },
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
      { title: "48-Hour Payouts", description: "Don't wait months for ad payments. Secure bank transfers pay you within 48 hours.", icon: FEATURE_ICONS.bolt },
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
  cosplayers: {
    slug: "cosplayers",
    name: "Cosplayers",
    title: "Cosplay Creator Platform — Monetize Costumes & Tutorials | Zinovia",
    description: "Monetize your cosplay on Zinovia. Sell exclusive costume tutorials, behind-the-scenes build logs, and premium photoshoots to paying subscribers. 48-hour payouts.",
    heroHeading: "Turn your cosplay into income.",
    heroAccent: "Build. Create. Earn.",
    heroDescription: "Share exclusive costume tutorials, build breakdowns, behind-the-scenes content, and premium photoshoots with subscribers who love your craft.",
    painPoints: [
      { title: "Costumes are expensive to make", description: "Materials, tools, and countless hours of work go into every build — but social media likes don't cover those costs. You need a revenue model that values your craftsmanship." },
      { title: "Social platforms suppress your reach", description: "Algorithm changes can tank your visibility overnight. Building on rented land means your income is never secure. Own the relationship with your fans instead." },
      { title: "Free content sets the wrong expectation", description: "Posting every build for free trains your audience to never pay. Offer exclusive tiers so your most dedicated fans can support you directly." },
    ],
    features: [
      { title: "Cosplay Subscriptions", description: "Fans pay monthly for access to exclusive build logs, tutorials, and behind-the-scenes cosplay content.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Tutorials", description: "Sell detailed costume-making tutorials, pattern files, or prop-building guides as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Fan Messaging", description: "Answer build questions, discuss commissions, and interact with fans through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "Get your earnings within 48 hours via secure bank transfer. No waiting months for sponsorship cheques.", icon: FEATURE_ICONS.bolt },
      { title: "Content Protection", description: "Signed, time-limited URLs and encryption keep your exclusive photos and videos from being leaked or redistributed.", icon: FEATURE_ICONS.lock },
      { title: "Performance Analytics", description: "Track subscriber growth, revenue trends, and which builds and tutorials your audience engages with most.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell cosplay tutorials on Zinovia?", a: "Yes. You can publish detailed build tutorials, pattern files, material guides, and prop-making videos. Offer them as part of your subscription or as individual paid unlocks." },
      { q: "How much can cosplayers earn on Zinovia?", a: "It depends on your audience and pricing. A cosplayer with 500 subscribers at €8/month earns approximately €4,000/month before fees. Many cosplayers find subscriptions more sustainable than sponsorships." },
      { q: "Is my exclusive cosplay content protected?", a: "Yes. All media on Zinovia is delivered through signed, time-limited URLs with AES encryption, making it significantly harder for content to be leaked or redistributed." },
      { q: "Can I offer cosplay commissions through Zinovia?", a: "Yes. Use the built-in messaging feature to discuss commissions with subscribers, share progress photos, and deliver finished content securely through paid unlocks." },
      { q: "Do I need a huge following to start earning?", a: "No. Even 200 dedicated fans at €8/month generates €1,600/month in recurring revenue. Start with your most engaged followers and grow from there." },
    ],
  },
  writers: {
    slug: "writers",
    name: "Writers",
    title: "Writing Monetization Platform for Authors & Writers | Zinovia",
    description: "Monetize your writing on Zinovia. Publish exclusive chapters, short stories, writing courses, and premium content for paying subscribers. 48-hour payouts.",
    heroHeading: "Get paid for your words.",
    heroAccent: "Readers who invest in you.",
    heroDescription: "Publish exclusive chapters, serialized fiction, short stories, and writing courses. Build recurring revenue from readers who value your craft.",
    painPoints: [
      { title: "Publishing deals are hard to land", description: "Traditional publishing is a gatekeeper-heavy process. Agents, editors, and publishers decide who gets paid. Take your income into your own hands." },
      { title: "Amazon royalties are razor-thin", description: "Self-publishing on Amazon means competing on price in a race to the bottom. Subscriptions let your most dedicated readers support you at a fair price." },
      { title: "Free platforms don't pay the bills", description: "Wattpad, Medium, and Substack give you reach but limited earning potential. You need a platform built for creators who want to earn, not just publish." },
    ],
    features: [
      { title: "Reader Subscriptions", description: "Fans pay monthly for access to exclusive chapters, serialized fiction, and premium writing content.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Stories & Courses", description: "Sell individual short stories, completed manuscripts, or writing courses as one-time paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Reader Messaging", description: "Connect with your most dedicated readers, take feedback, and build community through built-in messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "Earn from day one. Your earnings are delivered to your bank within 48 hours via secure transfer.", icon: FEATURE_ICONS.bolt },
      { title: "Content Security", description: "Your exclusive writing is delivered through signed URLs and encryption — no copy-paste scraping or unauthorized sharing.", icon: FEATURE_ICONS.lock },
      { title: "Audience Analytics", description: "Track subscriber growth, revenue trends, and which stories and content resonate most with your readers.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I publish serialized fiction on Zinovia?", a: "Yes. Many writers use Zinovia to release exclusive chapters on a schedule, building a subscriber base around serialized novels, novellas, and short story collections." },
      { q: "How does Zinovia compare to Substack for writers?", a: "Zinovia offers faster payouts (48 hours vs monthly), built-in content protection, direct messaging, and flexible monetisation through both subscriptions and paid unlocks." },
      { q: "Can I sell writing courses on Zinovia?", a: "Yes. Use paid unlocks to sell writing workshops, craft courses, editing guides, or any educational content alongside your subscription offering." },
      { q: "Is my writing protected from piracy?", a: "Yes. All content on Zinovia is delivered through signed, time-limited URLs with encryption, preventing unauthorized copying and redistribution." },
      { q: "Do I keep the rights to my writing?", a: "Absolutely. You retain full ownership and copyright of everything you publish. Zinovia is simply the platform for delivery and monetisation." },
    ],
  },
  educators: {
    slug: "educators",
    name: "Educators",
    title: "Online Education Platform for Course Creators & Tutors | Zinovia",
    description: "Monetize your knowledge on Zinovia. Sell courses, tutoring sessions, and educational content to paying subscribers. 48-hour payouts, content protection built in.",
    heroHeading: "Monetize your expertise.",
    heroAccent: "Teach. Earn. Scale.",
    heroDescription: "Sell courses, tutoring sessions, and premium educational content. Build sustainable recurring revenue from students who value your knowledge.",
    painPoints: [
      { title: "Course platforms take huge cuts", description: "Udemy, Skillshare, and others take 50–75% of your revenue. You do the teaching, they keep most of the money. Keep more of what you earn." },
      { title: "1-on-1 tutoring doesn't scale", description: "Trading hours for dollars limits your income. Package your knowledge into content that earns while you sleep." },
      { title: "YouTube gives knowledge away for free", description: "Free educational content builds your reputation but not your bank account. Offer premium depth that justifies a subscription." },
    ],
    features: [
      { title: "Student Subscriptions", description: "Students pay monthly for ongoing access to your courses, lessons, and premium educational materials.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Courses & Resources", description: "Sell individual courses, study guides, templates, or supplementary materials as one-time paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Student Messaging", description: "Offer office hours, answer questions, and provide feedback through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "48-Hour Payouts", description: "No waiting for monthly course platform payouts. Secure bank transfers pay you within 48 hours.", icon: FEATURE_ICONS.money },
      { title: "Content Protection", description: "Your courses and materials are delivered through signed URLs with encryption — preventing piracy and unauthorized sharing.", icon: FEATURE_ICONS.lock },
      { title: "Student Analytics", description: "Track subscriber growth, revenue, and engagement to understand what your students value most.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell online courses on Zinovia?", a: "Yes. You can publish full courses, individual lessons, study materials, templates, and supplementary resources. Offer them as subscriptions or one-time purchases." },
      { q: "How does Zinovia compare to Udemy or Teachable?", a: "Zinovia takes significantly lower fees, pays out within 48 hours, and includes built-in messaging and content protection. You keep more and connect directly with students." },
      { q: "Can I offer tutoring alongside courses?", a: "Yes. Use the built-in messaging feature for Q&A, office hours, and personalised feedback alongside your published course content." },
      { q: "Is my course content protected from piracy?", a: "Yes. All videos and materials on Zinovia are delivered through signed, time-limited URLs with AES encryption, preventing unauthorized downloading and redistribution." },
      { q: "Do I need a large following to start?", a: "No. Even 100 students at €12/month generates €1,200/month in recurring revenue. Start with your existing audience and grow organically." },
    ],
  },
  "fashion-creators": {
    slug: "fashion-creators",
    name: "Fashion Creators",
    title: "Fashion Creator Platform — Monetize Style Content & Guides | Zinovia",
    description: "Monetize your fashion content on Zinovia. Sell exclusive outfit guides, style advice, lookbooks, and hauls to paying subscribers. 48-hour payouts.",
    heroHeading: "Turn your style into a business.",
    heroAccent: "Get paid for fashion.",
    heroDescription: "Publish exclusive outfit guides, styling tips, lookbooks, and haul breakdowns. Build recurring revenue from followers who trust your fashion sense.",
    painPoints: [
      { title: "Affiliate links are unreliable", description: "Commission rates change, links expire, and platforms cut payouts without warning. You need income that doesn't depend on someone else's business decisions." },
      { title: "Brand deals are inconsistent", description: "Sponsorships come and go with trends and budgets. Subscriptions give you predictable monthly income regardless of brand partnership cycles." },
      { title: "Followers want more than Instagram posts", description: "Your most engaged followers want detailed styling breakdowns, size guides, and personal recommendations. Give them a premium destination for it." },
    ],
    features: [
      { title: "Style Subscriptions", description: "Fans pay monthly for access to exclusive outfit guides, styling tips, and curated fashion content.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Lookbooks & Guides", description: "Sell seasonal lookbooks, capsule wardrobe guides, or shopping lists as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Styling DMs", description: "Offer personal styling advice and answer fashion questions through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "No waiting for affiliate commissions to clear. Secure bank transfers pay you within 48 hours.", icon: FEATURE_ICONS.money },
      { title: "Content Protection", description: "Your exclusive lookbooks and style guides are protected by signed URLs and encryption — no unauthorized redistribution.", icon: FEATURE_ICONS.lock },
      { title: "Audience Insights", description: "Track subscriber growth, revenue trends, and which styles and content resonate most with your audience.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell style guides on Zinovia?", a: "Yes. You can publish outfit guides, capsule wardrobe plans, seasonal lookbooks, and shopping lists. Offer them as subscriptions or individual paid unlocks." },
      { q: "How does Zinovia compare to affiliate marketing for fashion creators?", a: "Unlike affiliate links, Zinovia gives you direct recurring revenue from subscribers. No middlemen, no changing commission rates — you set your price and keep the majority." },
      { q: "Can I offer personal styling advice?", a: "Yes. Use the built-in messaging feature to provide personal styling recommendations, answer questions, and interact directly with your subscribers." },
      { q: "How much can fashion creators earn?", a: "It depends on your audience and pricing. A fashion creator with 800 subscribers at €7/month earns approximately €5,600/month before fees — more predictable than brand deals alone." },
      { q: "Is my content protected?", a: "Yes. All media on Zinovia is delivered through signed, time-limited URLs with encryption, preventing unauthorized downloading and sharing of your exclusive content." },
    ],
  },
  "travel-creators": {
    slug: "travel-creators",
    name: "Travel Creators",
    title: "Travel Creator Platform — Monetize Guides & Itineraries | Zinovia",
    description: "Monetize your travel content on Zinovia. Sell exclusive travel guides, detailed itineraries, and premium vlogs to paying subscribers. 48-hour payouts.",
    heroHeading: "Monetize your travel content.",
    heroAccent: "Beyond brand deals.",
    heroDescription: "Publish exclusive travel guides, detailed itineraries, hidden-gem recommendations, and premium vlogs. Build recurring income from followers who trust your travel expertise.",
    painPoints: [
      { title: "Travel content is expensive to produce", description: "Flights, hotels, and gear cost thousands. Social media reach alone doesn't cover production costs. You need revenue that matches the investment." },
      { title: "Brand deals dry up between trips", description: "Sponsorships are tied to posting schedules and travel seasons. Subscriptions give you consistent income even when you're not on the road." },
      { title: "Free guides get reshared without credit", description: "You spend hours researching the perfect itinerary, then it gets screenshotted and shared everywhere. Protect your premium content behind a paywall." },
    ],
    features: [
      { title: "Travel Subscriptions", description: "Followers pay monthly for access to exclusive travel guides, itineraries, and behind-the-scenes vlogs.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Itineraries & Guides", description: "Sell detailed city guides, multi-day itineraries, or packing lists as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Traveller Messaging", description: "Answer travel questions, give personalised recommendations, and connect with followers through built-in messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "Fund your next trip faster. Secure bank transfers pay you within 48 hours — no 30-day wait.", icon: FEATURE_ICONS.money },
      { title: "Content Security", description: "Your premium guides and itineraries are protected by signed URLs and encryption — no unauthorized downloads or resharing.", icon: FEATURE_ICONS.lock },
      { title: "Revenue Analytics", description: "Track subscriber growth, revenue by content type, and which destinations your audience cares about most.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I sell travel itineraries on Zinovia?", a: "Yes. You can publish detailed itineraries, city guides, hidden-gem lists, packing guides, and budget breakdowns. Offer them as subscriptions or one-time paid unlocks." },
      { q: "How much can travel creators earn on Zinovia?", a: "It depends on your audience and pricing. A travel creator with 600 subscribers at €10/month earns approximately €6,000/month before fees — enough to fund regular travel." },
      { q: "Can I share travel vlogs exclusively on Zinovia?", a: "Yes. Many travel creators publish premium vlogs, behind-the-scenes footage, and extended cuts exclusively for their Zinovia subscribers." },
      { q: "Is my content protected from being copied?", a: "Yes. All content on Zinovia is delivered through signed, time-limited URLs with AES encryption, preventing screenshots, downloads, and unauthorised redistribution." },
      { q: "Can I interact with my audience directly?", a: "Yes. Use Zinovia's built-in messaging to answer travel questions, give personalised recommendations, and build a community around your travel expertise." },
    ],
  },
  "gen-z-creators": {
    slug: "gen-z-creators",
    name: "Gen Z Creators",
    title: "Creator Platform for Gen Z — Monetize TikTok & Instagram Content | Zinovia",
    description: "Monetize your social media presence on Zinovia. Turn TikTok and Instagram followers into paying subscribers. SFW creator platform with 48-hour payouts.",
    heroHeading: "Your audience is worth more.",
    heroAccent: "Turn followers into income.",
    heroDescription: "Turn your TikTok and Instagram following into real recurring revenue. Offer exclusive content, behind-the-scenes access, and premium interactions to your biggest fans.",
    painPoints: [
      { title: "Creator funds pay almost nothing", description: "TikTok's Creator Fund pays fractions of a cent per view. Millions of views barely cover a coffee. You deserve real compensation for the content you create." },
      { title: "Algorithms control your income", description: "One algorithm change can tank your reach overnight. Building on rented land means your livelihood depends on a platform's decisions, not your talent." },
      { title: "Brand deals require constant hustle", description: "Chasing sponsorships is a full-time job on top of content creation. Subscriptions give you predictable income without the pitch cycle." },
    ],
    features: [
      { title: "Fan Subscriptions", description: "Your biggest fans pay monthly for exclusive content, early access, and behind-the-scenes moments.", icon: FEATURE_ICONS.subscription },
      { title: "Exclusive Drops", description: "Sell exclusive photo sets, video content, presets, or digital products as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Direct Fan Chat", description: "Build deeper connections with your top supporters through built-in private messaging.", icon: FEATURE_ICONS.message },
      { title: "48-Hour Payouts", description: "Get paid fast. No waiting for creator fund calculations — secure bank transfers within 48 hours.", icon: FEATURE_ICONS.bolt },
      { title: "Content Protection", description: "Your exclusive content stays exclusive. Signed URLs and encryption prevent leaks and unauthorized sharing.", icon: FEATURE_ICONS.lock },
      { title: "Growth Dashboard", description: "Track subscriber count, revenue trends, and fan engagement to level up your creator business.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "Can I use Zinovia alongside TikTok and Instagram?", a: "Yes. Most Gen Z creators use Zinovia as a premium destination for their most engaged followers, while keeping free content on TikTok and Instagram to grow their audience." },
      { q: "Is Zinovia safe for younger creators?", a: "Yes. Zinovia supports SFW content creators of all types. The platform includes content protection, secure payments, and direct control over your subscriber community." },
      { q: "How much can Gen Z creators earn?", a: "It depends on your audience and pricing. A creator with 1,000 subscribers at €5/month earns approximately €5,000/month — far more than creator fund payouts for most influencers." },
      { q: "What kind of content can I sell?", a: "Anything SFW — behind-the-scenes content, exclusive photos and videos, presets, day-in-my-life vlogs, tutorials, Q&As, and more. Subscriptions or one-time paid unlocks." },
      { q: "How fast do I get paid?", a: "Zinovia processes payouts via secure bank transfer within 48 hours. No minimum thresholds, no waiting for monthly cycles." },
    ],
  },
  "lifestyle-creators": {
    slug: "lifestyle-creators",
    name: "Lifestyle Creators",
    title: "Lifestyle Creator Platform — Monetize Cooking, Home & Wellness Content | Zinovia",
    description: "Monetize your lifestyle content on Zinovia. Sell exclusive recipes, home decor guides, wellness routines, and premium content to paying subscribers. 48-hour payouts.",
    heroHeading: "Monetize your lifestyle brand.",
    heroAccent: "Content that pays.",
    heroDescription: "Publish exclusive recipes, home decor guides, wellness routines, and day-in-my-life content. Build recurring revenue from followers who love your lifestyle.",
    painPoints: [
      { title: "Ad revenue doesn't match the effort", description: "Hours of filming, editing, and styling for a recipe video that earns pennies in ad revenue. Your content deserves direct compensation from fans who value it." },
      { title: "Affiliate income fluctuates wildly", description: "Product links get deactivated, commission rates drop, and seasonal trends shift. Subscriptions give you stable monthly income you can rely on." },
      { title: "Platforms commoditize your content", description: "Your recipes and routines get buried in an ocean of similar content. A subscription model lets your most loyal followers access your best work directly." },
    ],
    features: [
      { title: "Lifestyle Subscriptions", description: "Fans pay monthly for access to exclusive recipes, wellness routines, home tips, and behind-the-scenes content.", icon: FEATURE_ICONS.subscription },
      { title: "Paid Guides & Recipes", description: "Sell recipe collections, meal plans, home decor guides, or wellness programmes as individual paid unlocks.", icon: FEATURE_ICONS.lock },
      { title: "Community Messaging", description: "Share tips, answer questions, and build a community around your lifestyle brand through built-in messaging.", icon: FEATURE_ICONS.message },
      { title: "Fast Payouts", description: "Your earnings hit your bank within 48 hours. No waiting for ad revenue calculations or affiliate payouts.", icon: FEATURE_ICONS.money },
      { title: "Content Protection", description: "Your exclusive recipes, videos, and guides are protected by signed URLs and encryption — no unauthorized copying.", icon: FEATURE_ICONS.lock },
      { title: "Engagement Analytics", description: "Track subscriber growth, revenue trends, and which content categories your audience engages with most.", icon: FEATURE_ICONS.chart },
    ],
    faqs: [
      { q: "What kind of lifestyle content can I sell on Zinovia?", a: "Anything from recipes and meal plans to home decor guides, wellness routines, cleaning schedules, organisation tips, and day-in-my-life vlogs. Subscriptions or one-time purchases." },
      { q: "How does Zinovia compare to a blog for lifestyle creators?", a: "Zinovia offers direct recurring revenue from subscribers, 48-hour payouts, content protection, and built-in messaging — no relying on unpredictable ad revenue or SEO traffic." },
      { q: "Can I sell recipe collections or meal plans?", a: "Yes. Use paid unlocks to sell recipe e-books, weekly meal plans, shopping lists, or seasonal cooking guides alongside your subscription content." },
      { q: "How much can lifestyle creators earn?", a: "It depends on your audience and pricing. A lifestyle creator with 700 subscribers at €8/month earns approximately €5,600/month before fees — more stable than ad or affiliate income." },
      { q: "Is my content protected from being copied?", a: "Yes. All media on Zinovia is delivered through signed, time-limited URLs with AES encryption, preventing unauthorized downloading, screenshotting, and redistribution." },
    ],
  },
};

export function getNiche(slug: string): NicheData | undefined {
  return NICHES[slug];
}

export function getAllNicheSlugs(): string[] {
  return Object.keys(NICHES);
}
