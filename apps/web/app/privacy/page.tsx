import { Page } from "@/components/brand/Page";

export const metadata = {
  title: "Privacy Policy — Zinovia Fans",
  description: "How Zinovia Fans collects, uses, and protects your personal information.",
  alternates: { canonical: "https://zinovia.ai/privacy" },
};

const LAST_UPDATED = "2026-02-14";

export default function PrivacyPage() {
  return (
    <Page className="max-w-3xl space-y-8 py-12">
      <header className="space-y-2">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">1. Introduction</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          Zinovia Fans (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the zinovia.ai website and
          related services. This Privacy Policy explains how we collect, use, disclose, and safeguard your
          personal information when you use our platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">2. Information We Collect</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-foreground/90">
          <li>
            <strong>Account information:</strong> Email address, hashed password, display name, and profile
            details you provide during registration and onboarding.
          </li>
          <li>
            <strong>Payment information:</strong> Billing details are processed directly by our secure payment processor. We store
            only customer and subscription identifiers — never full card numbers.
          </li>
          <li>
            <strong>Usage data:</strong> Pages visited, features used, device type, browser, IP address, and
            timestamps — collected automatically for analytics and security.
          </li>
          <li>
            <strong>Content you create:</strong> Posts, messages, media uploads, and profile content you
            publish on the platform.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-foreground/90">
          <li>Provide and maintain the platform, including account management and content delivery.</li>
          <li>Process payments and manage creator subscriptions.</li>
          <li>Send transactional emails (verification, billing receipts, security alerts).</li>
          <li>Enforce our Terms of Service and prevent fraud or abuse.</li>
          <li>Improve and personalize the platform experience.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">4. Data Sharing</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We do not sell your personal information. We share data only with:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-foreground/90">
          <li><strong>Payment processor:</strong> Secure payment processing.</li>
          <li><strong>AWS:</strong> Infrastructure hosting and email delivery (Amazon SES).</li>
          <li><strong>Law enforcement:</strong> When required by applicable law or court order.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">5. Data Retention</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We retain your account data for as long as your account is active. If you delete your account, we
          remove personally identifiable information within 30 days, except where retention is required by law
          (e.g., financial transaction records).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">6. Your Rights</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          You may request access to, correction of, or deletion of your personal data by contacting us at{" "}
          <a href="mailto:privacy@zinovia.ai" className="text-primary underline-offset-4 hover:underline">
            privacy@zinovia.ai
          </a>
          . We respond to requests within 30 days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">7. Security</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We use industry-standard security measures including TLS encryption in transit, encrypted storage at
          rest, and role-based access controls. No system is 100% secure; we encourage you to use strong,
          unique passwords and enable available security features.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">8. Cookies</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We use essential cookies for authentication and session management. We do not use third-party
          advertising cookies. Analytics cookies (if any) are anonymized.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          We may update this policy periodically. Material changes will be posted on this page with a revised
          &quot;Last updated&quot; date. Continued use of the platform after changes constitutes acceptance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">10. Contact</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          Questions about this policy? Email{" "}
          <a href="mailto:privacy@zinovia.ai" className="text-primary underline-offset-4 hover:underline">
            privacy@zinovia.ai
          </a>
          .
        </p>
      </section>
    </Page>
  );
}
