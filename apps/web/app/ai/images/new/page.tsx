"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { AiImagesService } from "@/features/ai/api";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { useTranslation, interpolate } from "@/lib/i18n";
import "@/lib/api";

const IMAGE_TYPE_VALUES = ["HERO", "AVATAR", "BANNER"] as const;

function AiImagesNewPageContent() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const applyHint = searchParams.get("apply") as "creator.avatar" | "creator.banner" | null;
  const [imageType, setImageType] = useState<"HERO" | "AVATAR" | "BANNER">(
    applyHint === "creator.avatar" ? "AVATAR" : applyHint === "creator.banner" ? "BANNER" : "AVATAR"
  );
  const [subject, setSubject] = useState("");
  const [vibe, setVibe] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetForType = imageType === "HERO" ? "hero_marketing" : imageType === "BANNER" ? "creator_banner" : "creator_avatar";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { job_id } = await AiImagesService.generate({
        image_type: imageType,
        preset: presetForType,
        subject: subject || undefined,
        vibe: vibe || undefined,
        accent_color: accentColor || undefined,
        count: 1,
      });
      addToast(t.aiImages.toastGenerationStarted, "success");
      router.push(`/ai/images/${job_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.aiImages.errorFallback;
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!authorized) return null;

  return (
    <Page>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai/images"><Icon name="arrow_back" className="mr-1.5 icon-sm" />{t.aiImages.backToAiStudio}</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t.aiImages.title}
      </h1>
      {applyHint && (
        <p className="mt-1 text-sm text-muted-foreground">
          {applyHint === "creator.avatar" ? t.aiImages.applyHintAvatar : t.aiImages.applyHintBanner}
        </p>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t.aiImages.settingsTitle}</CardTitle>
          <CardDescription>
            {t.aiImages.settingsDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.aiImages.imageTypeLabel}</Label>
              <div className="flex gap-2">
                {IMAGE_TYPE_VALUES.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={imageType === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImageType(value)}
                  >
                    {value === "HERO" ? t.aiImages.imageTypeHero : value === "AVATAR" ? t.aiImages.imageTypeAvatar : t.aiImages.imageTypeBanner}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {interpolate(t.aiImages.presetLabel, {
                presetName: presetForType === "hero_marketing" ? t.aiImages.presetHeroMarketing : presetForType === "creator_banner" ? t.aiImages.presetCreatorBanner : t.aiImages.presetCreatorAvatar,
              })}
            </p>
            <div className="space-y-2">
              <Label htmlFor="subject">{t.aiImages.subjectLabel}</Label>
              <Input
                id="subject"
                placeholder={t.aiImages.subjectPlaceholder}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vibe">{t.aiImages.vibeLabel}</Label>
              <Input
                id="vibe"
                placeholder={t.aiImages.vibePlaceholder}
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent">{t.aiImages.accentColorLabel}</Label>
              <Input
                id="accent"
                placeholder={t.aiImages.accentColorPlaceholder}
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              <Icon name="auto_awesome" className="mr-1.5 icon-sm" />{loading ? t.aiImages.generateButtonLoading : t.aiImages.generateButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}

export default function AiImagesNewPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <Page>
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ai/images"><Icon name="arrow_back" className="mr-1.5 icon-sm" />{t.aiImages.backToAiStudio}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t.aiImages.loadingFallback}</p>
        </Page>
      }
    >
      <AiImagesNewPageContent />
    </Suspense>
  );
}
