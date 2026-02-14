import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Contact — Zinovia Fans",
  description: "Get in touch with the Zinovia Fans team for support, partnerships, or press inquiries.",
};

const CONTACT_CHANNELS = [
  {
    title: "General Support",
    description: "Account issues, billing questions, technical problems.",
    email: "support@zinovia.ai",
    responseTime: "Within 24 hours",
  },
  {
    title: "Privacy & Data Requests",
    description: "Data access, correction, deletion requests under privacy regulations.",
    email: "privacy@zinovia.ai",
    responseTime: "Within 30 days",
  },
  {
    title: "Legal",
    description: "Terms of service questions, DMCA notices, legal inquiries.",
    email: "legal@zinovia.ai",
    responseTime: "Within 5 business days",
  },
  {
    title: "Creator Partnerships",
    description: "Interested in becoming a featured creator or partnership opportunities.",
    email: "creators@zinovia.ai",
    responseTime: "Within 3 business days",
  },
] as const;

export default function ContactPage() {
  return (
    <Page className="max-w-3xl space-y-8 py-12">
      <header className="space-y-2">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Contact Us</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;re here to help. Reach out through the appropriate channel below.
        </p>
      </header>

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {CONTACT_CHANNELS.map((channel) => (
            <Card key={channel.email} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">{channel.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{channel.description}</p>
                <a
                  href={`mailto:${channel.email}`}
                  className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {channel.email}
                </a>
                <p className="text-xs text-muted-foreground">Response time: {channel.responseTime}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Before You Contact Us</h2>
        <p className="text-sm text-muted-foreground">
          Many questions are already answered in our{" "}
          <Link href="/help" className="text-primary underline-offset-4 hover:underline">
            Help Center
          </Link>
          . Check there first for the fastest resolution.
        </p>
      </section>

      <section className="rounded-brand border border-border bg-surface-alt p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Report Abuse or Safety Concerns</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If you encounter content that violates our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          , or if you have a safety concern, please email{" "}
          <a
            href="mailto:safety@zinovia.ai"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            safety@zinovia.ai
          </a>{" "}
          with as much detail as possible. These reports are prioritized and reviewed within 12 hours.
        </p>
      </section>
    </Page>
  );
}
