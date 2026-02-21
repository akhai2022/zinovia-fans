"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { CreatorsService } from "../api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/errors";

type FollowButtonProps = {
  creatorId: string;
  initialFollowing: boolean;
  onToggle?: (following: boolean) => void;
};

export function FollowButton({
  creatorId,
  initialFollowing,
  onToggle,
}: FollowButtonProps) {
  const { addToast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"unauthorized" | "error" | null>(null);

  const handleClick = async () => {
    setError(null);
    setErrorKind(null);
    setLoading(true);
    const previous = following;
    setFollowing(!following);
    try {
      if (following) {
        await CreatorsService.creatorsUnfollow(creatorId);
        onToggle?.(false);
        addToast("Unfollowed", "success");
      } else {
        await CreatorsService.creatorsFollow(creatorId);
        onToggle?.(true);
        addToast("Following", "success");
      }
    } catch (err) {
      setFollowing(previous);
      onToggle?.(previous);
      const { kind, message } = getApiErrorMessage(err);
      const code = getApiErrorCode(err);
      const displayMessage =
        kind === "unauthorized"
          ? "Sign in to follow"
          : code === "cannot_follow_self"
            ? "You can't follow yourself"
            : message;
      setError(displayMessage);
      setErrorKind(kind === "unauthorized" ? "unauthorized" : "error");
      addToast(displayMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <Spinner className="icon-base" />
        ) : following ? (
          <Icon name="how_to_reg" className="icon-base" />
        ) : (
          <Icon name="person_add" className="icon-base" />
        )}
        {loading ? "…" : following ? "Unfollow" : "Follow"}
      </Button>
      {error && (
        <p className="text-xs text-destructive">
          {error}
          {errorKind === "unauthorized" && (
            <>
              {" "}
              <Link href="/login" className="underline focus:outline-none focus:ring-2 focus:ring-ring rounded">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
