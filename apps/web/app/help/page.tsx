import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Help Center — Zinovia Fans",
  description: "Get help with your Zinovia Fans account, billing, and creator tools.",
  alternates: { canonical: "https://zinovia.ai/help" },
};

const FAQ_ITEMS = [
  {
    question: "How do I create a creator account?",
    answer:
      'Click "Sign up" and complete the onboarding flow. You\'ll verify your email, set up your profile with a handle and display name, and choose your subscription pricing. Once your profile is published, fans can discover and subscribe to you.',
  },
  {
    question: "How do subscriptions and payments work?",
    answer:
      "Payments are processed securely through Stripe. Fans subscribe to creators at the price set by the creator. Creators receive payouts directly to their Stripe-connected account on Stripe's standard payout schedule.",
  },
  {
    question: "How do I change my email or password?",
    answer:
      "Go to Settings > Profile to update your display name, handle, and profile details. For email or password changes, contact support at support@zinovia.ai.",
  },
  {
    question: "I didn't receive my verification email.",
    answer:
      'Check your spam/junk folder. If it\'s not there, go to the verification page and click "Resend verification email" with the email you registered. If issues persist, contact support.',
  },
  {
    question: "How do I cancel a subscription?",
    answer:
      "You can manage your active subscriptions from your billing settings. Cancellations take effect at the end of the current billing period.",
  },
  {
    question: "What content is allowed on the platform?",
    answer:
      "All content must comply with our Terms of Service. Content involving minors, non-consensual material, or illegal activity is strictly prohibited. Creators are responsible for ensuring their content meets our guidelines.",
  },
  {
    question: "How do I report a problem or abusive content?",
    answer:
      "Email support@zinovia.ai with details including the creator handle, content description, and screenshots if possible. We review all reports within 24 hours.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Contact support@zinovia.ai to request account deletion. Active subscriptions will be cancelled, and personal data will be removed within 30 days per our Privacy Policy.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function HelpPage() {
  return (
    <Page className="max-w-3xl space-y-8 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <header className="space-y-2">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Help Center</h1>
        <p className="text-sm text-muted-foreground">
          Find answers to common questions. Can&apos;t find what you need?{" "}
          <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
            Contact support
          </Link>
          .
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <Card key={i} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">{item.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Quick Links</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/privacy"
              className="block rounded-brand border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link
              href="/terms"
              className="block rounded-brand border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Terms of Service
            </Link>
          </li>
          <li>
            <Link
              href="/contact"
              className="block rounded-brand border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Contact Support
            </Link>
          </li>
          <li>
            <Link
              href="/signup"
              className="block rounded-brand border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Create an Account
            </Link>
          </li>
        </ul>
      </section>
    </Page>
  );
}
