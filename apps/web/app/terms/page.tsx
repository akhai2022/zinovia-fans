import { Page } from "@/components/brand/Page";

export const metadata = {
  title: "Terms of Service — Zinovia Fans",
  description: "Terms governing your use of the Zinovia Fans platform.",
  alternates: { canonical: "https://zinovia.ai/terms" },
};

const LAST_UPDATED = "2026-02-14";

export default function TermsPage() {
  return (
    <Page className="max-w-3xl space-y-8 py-12">
      <header className="space-y-2">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          By creating an account or using Zinovia Fans (&quot;the Platform&quot;), you agree to these Terms of
          Service. If you do not agree, do not use the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">2. Eligibility</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          You must be at least 18 years of age to use the Platform. By registering, you represent that you meet
          this requirement and that the information you provide is accurate and current.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">3. Accounts</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-foreground/90">
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You may not share, transfer, or sell your account.</li>
          <li>You must notify us immediately of any unauthorized access at support@zinovia.ai.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">4. Creator Accounts</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          Creators may set subscription prices, publish content, and receive payments through Stripe. Creators
          agree to comply with all applicable laws and our Content Policy. We reserve the right to review,
          restrict, or remove any content that violates these terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">5. Payments and Billing</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-foreground/90">
          <li>All payments are processed by Stripe. We do not store your full payment card information.</li>
          <li>Subscription fees are billed on a recurring basis until cancelled.</li>
          <li>Refunds are handled on a case-by-case basis. Contact support for assistance.</li>
          <li>Creators receive payouts according to Stripe&apos;s payout schedule, less applicable platform fees.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">6. Prohibited Conduct</h2>
        <p className="text-sm leading-relaxed text-foreground/90">You agree not to:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-foreground/90">
          <li>Post content involving minors, non-consensual material, or illegal activity.</li>
          <li>Harass, threaten, or impersonate other users.</li>
          <li>Use bots, scrapers, or automated tools without authorization.</li>
          <li>Circumvent payment or access controls.</li>
          <li>Distribute malware or engage in phishing.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">7. Intellectual Property</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          Creators retain ownership of the content they upload. By posting content, you grant Zinovia Fans a
          non-exclusive, worldwide license to display, distribute, and promote your content as part of the
          Platform&apos;s operation. You may revoke this license by deleting your content.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">8. Termination</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We may suspend or terminate your account for violations of these terms, illegal activity, or at our
          discretion with notice. You may delete your account at any time through account settings or by
          contacting support.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">9. Disclaimers</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          The Platform is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
          uninterrupted service, specific revenue outcomes for creators, or the accuracy of user-generated
          content.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">10. Limitation of Liability</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          To the maximum extent permitted by law, Zinovia Fans is not liable for indirect, incidental, or
          consequential damages arising from your use of the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">11. Changes to Terms</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We may update these terms at any time. Material changes will be notified via email or a prominent
          notice on the Platform. Continued use after changes constitutes acceptance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">12. Contact</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          Questions about these terms? Email{" "}
          <a href="mailto:legal@zinovia.ai" className="text-primary underline-offset-4 hover:underline">
            legal@zinovia.ai
          </a>
          .
        </p>
      </section>
    </Page>
  );
}
