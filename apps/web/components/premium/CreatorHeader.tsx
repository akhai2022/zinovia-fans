"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreatorAvatarAsset } from "@/features/creators/components/CreatorAvatarAsset";
import { cn } from "@/lib/utils";

export interface CreatorHeaderProps {
  displayName: string;
  handle: string;
  /** Optional avatar URL (from media service) */
  avatarUrl?: string | null;
  /** Optional avatar media asset ID (resolved via signed URL when provided) */
  avatarAssetId?: string | null;
  /** Show a verified or subscriber badge */
  badge?: "verified" | "subscriber" | null;
  /** Optional bio snippet */
  bio?: string | null;
  /** Link target for name/avatar, e.g. /creators/[handle] */
  href?: string;
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Hide link (e.g. when already on profile) */
  noLink?: boolean;
}

const sizeClasses = {
  sm: { avatar: "h-8 w-8", name: "text-premium-body-sm" },
  md: { avatar: "h-10 w-10", name: "text-premium-body" },
  lg: { avatar: "h-16 w-16 sm:h-20 sm:w-20", name: "text-premium-h3" },
};

export function CreatorHeader({
  displayName,
  handle,
  avatarUrl,
  avatarAssetId,
  badge,
  bio,
  href,
  className,
  size = "md",
  noLink,
}: CreatorHeaderProps) {
  const { avatar, name } = sizeClasses[size];
  const avatarNode = avatarAssetId ? (
    <CreatorAvatarAsset
      assetId={avatarAssetId}
      displayName={displayName}
      handle={handle}
      size={size}
      withRing={false}
      className={cn("shrink-0 border-2 border-card shadow-premium-sm", avatar)}
    />
  ) : (
    <Avatar className={cn("shrink-0 border-2 border-card shadow-premium-sm", avatar)}>
      <AvatarImage src={avatarUrl ?? undefined} alt="" />
      <AvatarFallback className="bg-muted text-muted-foreground text-premium-small">
        {displayName.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
  const content = (
    <>
      {avatarNode}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate font-semibold text-inherit", name)}>
            {displayName}
          </span>
          {badge === "verified" && (
            <span
              className="shrink-0 rounded-full bg-success-bg px-1.5 py-0.5 text-premium-label uppercase tracking-wide text-success-500"
              aria-label="Verified creator"
            >
              Verified
            </span>
          )}
          {badge === "subscriber" && (
            <span
              className="shrink-0 rounded-full bg-accent-50 px-1.5 py-0.5 text-premium-label font-medium text-accent-700"
              aria-hidden
            >
              Subscriber
            </span>
          )}
        </div>
        <p className="text-premium-small text-muted-foreground">@{handle}</p>
        {bio && size !== "sm" && (
          <p className="mt-1 line-clamp-2 text-premium-body-sm text-muted-foreground">
            {bio}
          </p>
        )}
      </div>
    </>
  );

  const wrapperClass = cn("flex items-start gap-3", className);

  if (noLink || !href) {
    return <div className={wrapperClass}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        wrapperClass,
        "link-accent focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      )}
      aria-label={`View ${displayName}'s profile`}
    >
      {content}
    </Link>
  );
}
