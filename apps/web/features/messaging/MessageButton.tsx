"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { createConversation } from "@/features/messaging/api";
import { useTranslation } from "@/lib/i18n";

interface MessageButtonProps {
  creatorId: string;
}

export function MessageButton({ creatorId }: MessageButtonProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const { conversation_id } = await createConversation({ creator_id: creatorId });
      router.push(`/messages/${conversation_id}`);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      if (detail === "subscription_required") {
        setError(t.messages.subscriptionRequired);
      } else {
        router.push("/messages");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Spinner className="mr-1 icon-base" /> : <Icon name="chat_bubble" className="mr-1 icon-base" />}
        {t.messages.messageButton}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
