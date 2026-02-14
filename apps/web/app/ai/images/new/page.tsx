"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AiImagesService } from "@/features/ai/api";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import "@/lib/api";

const PRESETS: Record<string, string> = {
  hero_marketing: "Hero (marketing)",
  creator_avatar: "Creator avatar",
  creator_banner: "Creator banner",
};

const IMAGE_TYPES = [
  { value: "HERO", label: "Hero" },
  { value: "AVATAR", label: "Avatar" },
  { value: "BANNER", label: "Banner" },
] as const;

function AiImagesNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
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
      addToast("Generation started", "success");
      router.push(`/ai/images/${job_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start generation";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ai/images">← Back to AI Studio</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Generate AI image
      </h1>
      {applyHint && (
        <p className="mt-1 text-sm text-muted-foreground">
          After generating, you can apply this image as your{" "}
          {applyHint === "creator.avatar" ? "avatar" : "banner"}.
        </p>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Choose preset and optional modifiers. The server builds the final prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Image type</Label>
              <div className="flex gap-2">
                {IMAGE_TYPES.map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={imageType === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImageType(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Preset: {PRESETS[presetForType] ?? presetForType}
            </p>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input
                id="subject"
                placeholder="e.g. modern aesthetic"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vibe">Vibe (optional)</Label>
              <Input
                id="vibe"
                placeholder="e.g. elegant"
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent">Accent color (optional)</Label>
              <Input
                id="accent"
                placeholder="e.g. soft gold"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Starting…" : "Generate"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}

export default function AiImagesNewPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ai/images">← Back to AI Studio</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Loading AI Studio…</p>
        </Page>
      }
    >
      <AiImagesNewPageContent />
    </Suspense>
  );
}
