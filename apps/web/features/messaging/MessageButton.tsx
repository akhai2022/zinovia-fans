"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { createConversation } from "@/features/messaging/api";

interface MessageButtonProps {
  creatorId: string;
}

export function MessageButton({ creatorId }: MessageButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { conversation_id } = await createConversation({ creator_id: creatorId });
      router.push(`/messages/${conversation_id}`);
    } catch {
      router.push("/messages");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? <Spinner className="mr-1 icon-base" /> : <Icon name="chat_bubble" className="mr-1 icon-base" />}
      Message
    </Button>
  );
}
