"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { z } from "zod";
import { AuthService } from "@zinovia/contracts";
import { getMessages, getMediaDownloadUrl, listConversations, sendMessage, type MessageOut } from "@/features/messaging/api";
import { listVaultMedia } from "@/features/engagement/api";
import { createPpvIntent } from "@/lib/api/ppv";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { LockedMediaCard } from "@/components/media/LockedMediaCard";

const DEFAULT_CURRENCY = "eur";
const MIN_PPV_CENTS = 100;
const MAX_PPV_CENTS = 20000;
const ENABLE_PPVM = process.env.NEXT_PUBLIC_ENABLE_PPVM === "true";
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

const lockSchema = z.object({
  priceDollars: z.coerce.number().min(1).max(200),
});

function UnlockPaymentForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const res = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (res.error) {
      setError(res.error.message || "Payment failed.");
      setSubmitting(false);
      return;
    }
    onSuccess();
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" onClick={submit} disabled={submitting || !stripe || !elements}>
        {submitting ? "Processing..." : "Confirm unlock"}
      </Button>
    </div>
  );
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [vaultIds, setVaultIds] = useState<string[]>([]);
  const [selectedVault, setSelectedVault] = useState<string[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [priceInput, setPriceInput] = useState("5");
  const [unlockClientSecret, setUnlockClientSecret] = useState<string | null>(null);
  const [unlockingMediaId, setUnlockingMediaId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [messagesRes, convRes, me] = await Promise.all([
        getMessages(conversationId),
        listConversations(),
        AuthService.authMe(),
      ]);
      setMessages(messagesRes.items);
      const conv = convRes.items.find((item) => item.id === conversationId);
      if (conv) {
        setIsCreator(conv.creator_user_id === me.id);
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadVault = async () => {
    const res = await listVaultMedia(undefined, "image");
    setVaultIds(res.items.map((i) => i.id));
  };

  const sendText = async () => {
    if (!text.trim()) return;
    setComposerError(null);
    const created = await sendMessage(conversationId, { type: "TEXT", text: text.trim() });
    setMessages((prev) => [...prev, created]);
    setText("");
  };

  const sendMedia = async () => {
    if (selectedVault.length === 0) return;
    setComposerError(null);
    let body: {
      type: "MEDIA";
      media_ids: string[];
      lock?: { price_cents: number; currency: string };
    } = { type: "MEDIA", media_ids: selectedVault };
    if (lockEnabled && isCreator && ENABLE_PPVM) {
      const parsed = lockSchema.safeParse({ priceDollars: priceInput });
      if (!parsed.success) {
        setComposerError("Invalid PPV price.");
        return;
      }
      const cents = Math.round(parsed.data.priceDollars * 100);
      if (cents < MIN_PPV_CENTS || cents > MAX_PPV_CENTS) {
        setComposerError("PPV price out of bounds.");
        return;
      }
      body = {
        ...body,
        lock: { price_cents: cents, currency: DEFAULT_CURRENCY },
      };
    }
    const created = await sendMessage(conversationId, body);
    setMessages((prev) => [...prev, created]);
    setSelectedVault([]);
  };

  const viewMedia = async (messageMediaId: string) => {
    const res = await getMediaDownloadUrl(messageMediaId);
    window.open(res.download_url, "_blank", "noopener,noreferrer");
  };

  const startUnlock = async (messageMediaId: string) => {
    setUnlockingMediaId(messageMediaId);
    const intent = await createPpvIntent(messageMediaId);
    if (intent.status === "ALREADY_UNLOCKED") {
      await load();
      setUnlockingMediaId(null);
      return;
    }
    if (!intent.client_secret) {
      setComposerError("Unable to initialize payment.");
      setUnlockingMediaId(null);
      return;
    }
    setUnlockClientSecret(intent.client_secret);
  };

  return (
    <Page>
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">Conversation</h1>
      {status === "loading" && <p className="mt-3 text-muted-foreground">Loading…</p>}
      {status === "error" && <p className="mt-3 text-destructive">Unable to load messages.</p>}
      {status === "ready" && (
        <>
          <ul className="mt-4 space-y-3">
            {messages.map((msg) => (
              <li key={msg.id} className="rounded-brand border border-border bg-card p-3 text-sm shadow-premium-sm">
                <p>{msg.text ?? `[${msg.message_type}] ${msg.media.length} media`}</p>
                {msg.media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.media.map((media) => {
                      const unlocked = media.viewer_has_unlocked ?? media.unlocked;
                      if (!media.is_locked || unlocked) {
                        return (
                          <Button key={media.id} size="sm" variant="secondary" onClick={() => viewMedia(media.id)}>
                            View media
                          </Button>
                        );
                      }
                      if (!ENABLE_PPVM) {
                        return (
                          <div key={media.id} className="w-full max-w-[260px]">
                            <LockedMediaCard unavailable />
                          </div>
                        );
                      }
                      return (
                        <div key={media.id} className="w-full max-w-[260px]">
                          <LockedMediaCard
                            title="Locked media"
                            priceCents={media.price_cents}
                            currency={media.currency || "usd"}
                            onUnlock={() => startUnlock(media.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Modal
            open={Boolean(unlockingMediaId && unlockClientSecret && stripePromise)}
            onClose={() => {
              setUnlockClientSecret(null);
              setUnlockingMediaId(null);
            }}
            title="Unlock content"
          >
            {unlockClientSecret && stripePromise && (
              <Elements stripe={stripePromise} options={{ clientSecret: unlockClientSecret }}>
                <UnlockPaymentForm
                  onSuccess={async () => {
                    setUnlockClientSecret(null);
                    setUnlockingMediaId(null);
                    await load();
                  }}
                />
              </Elements>
            )}
          </Modal>
          <Card className="mt-4 p-3">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={sendText}>Send text</Button>
              <Button size="sm" variant="secondary" onClick={loadVault}>Choose from Vault</Button>
              <Button size="sm" variant="secondary" onClick={sendMedia} disabled={selectedVault.length === 0}>
                Send selected media
              </Button>
            </div>
            {isCreator && ENABLE_PPVM && (
              <div className="space-y-2 rounded border border-border bg-surface-alt p-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lockEnabled}
                    onChange={(e) => setLockEnabled(e.target.checked)}
                  />
                  Lock media (PPV)
                </label>
                {lockEnabled && (
                  <Input
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="Price in dollars (e.g. 5)"
                  />
                )}
              </div>
            )}
            {vaultIds.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {vaultIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSelectedVault((prev) =>
                        prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
                      )
                    }
                    className={`rounded border p-2 text-left text-xs ${selectedVault.includes(id) ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                  >
                    {id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
            {composerError && <p className="text-sm text-destructive">{composerError}</p>}
          </Card>
        </>
      )}
      <Button variant="ghost" size="sm" className="mt-4" asChild>
        <Link href="/messages">Back</Link>
      </Button>
    </Page>
  );
}

