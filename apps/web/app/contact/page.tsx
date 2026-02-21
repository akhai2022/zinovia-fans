"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { getApiBaseUrl } from "@/lib/apiBase";

const CONTACT_CHANNELS = [
  {
    titleKey: "categoryGeneral" as const,
    description: "Account issues, billing questions, technical problems.",
    email: "support@zinovia.ai",
    responseTime: "24 hours",
  },
  {
    titleKey: "categoryPrivacy" as const,
    description: "Data access, correction, deletion requests under privacy regulations.",
    email: "privacy@zinovia.ai",
    responseTime: "30 days",
  },
  {
    titleKey: "categoryPartnerships" as const,
    description: "Interested in becoming a featured creator or partnership opportunities.",
    email: "creators@zinovia.ai",
    responseTime: "3 business days",
  },
];

type FormStatus = "idle" | "sending" | "success" | "error";

export default function ContactPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FormStatus>("idle");
  const [category, setCategory] = useState("general");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const categoryOptions = [
    { value: "general", label: t.contact.categoryGeneral },
    { value: "billing", label: t.contact.categoryBilling },
    { value: "account", label: t.contact.categoryAccount },
    { value: "content_report", label: t.contact.categoryContentReport },
    { value: "partnerships", label: t.contact.categoryPartnerships },
    { value: "privacy", label: t.contact.categoryPrivacy },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`${getApiBaseUrl()}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, email, subject, message }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Page className="max-w-3xl space-y-8 py-12">
      <header className="space-y-2">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          {t.contact.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.contact.subtitle}</p>
      </header>

      {status === "success" ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-start gap-4 py-8">
            <Icon name="check_circle" className="mt-0.5 icon-lg shrink-0 text-emerald-500" />
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {t.contact.successTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.contact.successMessage}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setStatus("idle")}
              >
                <Icon name="edit" className="mr-1.5 icon-sm" />
                Send another message
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="category">{t.contact.categoryLabel}</Label>
                <Select
                  id="category"
                  options={categoryOptions}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.contact.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.contact.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">{t.contact.subjectLabel}</Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder={t.contact.subjectPlaceholder}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t.contact.messageLabel}</Label>
                <Textarea
                  id="message"
                  placeholder={t.contact.messagePlaceholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                />
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 rounded-brand border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <Icon name="error" className="icon-base shrink-0" />
                  {t.contact.errorMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={status === "sending"}
                className="btn-cta-primary w-full sm:w-auto"
              >
                {status === "sending" ? (
                  t.contact.sending
                ) : (
                  <>
                    <Icon name="send" className="mr-2 icon-base" />
                    {t.contact.submit}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Contact channels */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t.contact.channelsTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CONTACT_CHANNELS.map((channel) => (
            <Card key={channel.email} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  {t.contact[channel.titleKey]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{channel.description}</p>
                <a
                  href={`mailto:${channel.email}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  <Icon name="mail" className="icon-sm" />
                  {channel.email}
                </a>
                <p className="text-xs text-muted-foreground">
                  {t.contact.responseTime}: {channel.responseTime}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Before you contact us */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t.contact.beforeContactTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.contact.beforeContactDescription.split("Help Center")[0]}
          <Link href="/help" className="text-primary underline-offset-4 hover:underline">
            Help Center
          </Link>
          {t.contact.beforeContactDescription.split("Help Center")[1] ?? "."}
        </p>
      </section>

      {/* Abuse reporting */}
      <section className="rounded-brand border border-border bg-surface-alt p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t.contact.abuseTitle}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.contact.abuseDescription}{" "}
          <a
            href="mailto:safety@zinovia.ai"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            safety@zinovia.ai
          </a>
          .
        </p>
      </section>
    </Page>
  );
}
