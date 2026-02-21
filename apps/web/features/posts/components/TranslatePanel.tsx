"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/client";
import { featureFlags } from "@/lib/featureFlags";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

type Translation = {
  id: string;
  target_language: string;
  translated_text: string | null;
  status: string;
};

type Props = {
  postId: string | null;
  caption: string;
};

const LANGUAGES = [
  { code: "fr", label: "French", flag: "FR" },
  { code: "es", label: "Spanish", flag: "ES" },
  { code: "ar", label: "Arabic", flag: "AR", comingSoon: true },
];

export function TranslatePanel({ postId, caption }: Props) {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addToast } = useToast();

  if (!featureFlags.translations) return null;

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const requestTranslation = async () => {
    if (!postId || selectedLangs.length === 0) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Translation[] }>("/ai-tools/translate", {
        method: "POST",
        body: { post_id: postId, target_languages: selectedLangs },
      });
      setTranslations(data.items);

      // Start polling if any are pending
      const hasPending = data.items.some((t) => t.status === "pending");
      if (hasPending) {
        startPolling();
      }
    } catch {
      addToast("Translation request failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    setPolling(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 15 || !postId) {
        stopPolling();
        return;
      }
      try {
        const data = await apiFetch<{ items: Translation[] }>(
          `/ai-tools/posts/${postId}/translations`
        );
        setTranslations(data.items);
        const allDone = data.items.every((t) => t.status !== "pending");
        if (allDone) stopPolling();
      } catch {
        stopPolling();
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast("Copied to clipboard", "success");
    });
  };

  if (!caption || caption.trim().length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="translate" className="icon-base text-primary" />
          <span className="text-sm font-medium text-foreground">Translate caption</span>
        </div>

        {/* Language selector */}
        <div className="flex gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              disabled={lang.comingSoon}
              onClick={() => !lang.comingSoon && toggleLang(lang.code)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                lang.comingSoon
                  ? "bg-surface-alt text-muted-foreground/50 cursor-not-allowed"
                  : selectedLangs.includes(lang.code)
                    ? "bg-primary text-white"
                    : "bg-surface-alt text-muted-foreground hover:text-foreground"
              }`}
              title={lang.comingSoon ? "Coming soon" : lang.label}
            >
              {lang.flag}
              {lang.comingSoon && (
                <span className="ml-1 text-[10px]">soon</span>
              )}
            </button>
          ))}
        </div>

        {/* Translate button */}
        {translations.length === 0 && !loading && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={requestTranslation}
            disabled={selectedLangs.length === 0 || !postId}
          >
            <Icon name="translate" className="mr-1.5 icon-sm" />
            Translate
          </Button>
        )}

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {/* Translation results */}
        {translations.length > 0 && (
          <div className="space-y-2">
            {translations.map((t) => {
              const lang = LANGUAGES.find((l) => l.code === t.target_language);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-border bg-surface-alt p-3"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                      {lang?.label ?? t.target_language}
                    </span>
                    {t.status === "pending" && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Spinner className="icon-xs" />
                        Translating...
                      </span>
                    )}
                    {t.status === "completed" && t.translated_text && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(t.translated_text!)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Icon name="content_copy" className="icon-sm" />
                      </button>
                    )}
                    {t.status === "failed" && (
                      <span className="text-[10px] text-destructive">Failed</span>
                    )}
                  </div>
                  {t.status === "completed" && t.translated_text ? (
                    <p className="text-sm text-foreground leading-relaxed">
                      {t.translated_text}
                    </p>
                  ) : t.status === "pending" ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Translation unavailable
                    </p>
                  )}
                </div>
              );
            })}

            {/* Re-translate button */}
            {!polling && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={requestTranslation}
              >
                <Icon name="translate" className="mr-1 icon-xs" />
                Translate again
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
