"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
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
      {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-1 h-4 w-4" />}
      Message
    </Button>
  );
}
