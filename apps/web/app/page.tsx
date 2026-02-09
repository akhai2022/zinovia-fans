import {
  Hero,
  TrustRow,
  HowItWorks,
  FeatureGrid,
  SocialProof,
  PricingSection,
  TrustSafety,
  FAQSection,
  Footer,
} from "@/components/landing";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Hero />
      <TrustRow />
      <HowItWorks />
      <SocialProof />
      <FeatureGrid />
      <PricingSection />
      <TrustSafety />
      <FAQSection />
      <Footer />
    </div>
  );
}
