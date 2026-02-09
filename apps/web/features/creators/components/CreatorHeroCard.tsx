"use client";

import type { CreatorProfilePublic } from "../api";
import { StatPill } from "@/components/brand/StatPill";
import { cn } from "@/lib/utils";

type CreatorHeroCardProps = {
  creator: CreatorProfilePublic;
  children?: React.ReactNode;
};

export function CreatorHeroCard({ creator, children }: CreatorHeroCardProps) {
  return (
    <div className="overflow-hidden rounded-brand border border-border bg-card shadow-sm">
      {/* Banner area with accent tint */}
      <div
        className={cn(
          "h-24 w-full sm:h-28",
          !creator.banner_media_id && "bg-gradient-to-br from-accent-50/80 to-muted",
          creator.banner_media_id && "bg-muted"
        )}
      />
      <div className="relative px-4 pb-4 pt-0 sm:px-6">
        {/* Avatar overlapping banner */}
        <div className="-mt-10 sm:-mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="h-20 w-20 shrink-0 rounded-full border-4 border-card bg-muted sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
                {creator.display_name}
              </h1>
              <p className="text-sm text-muted-foreground">@{creator.handle}</p>
              {creator.bio && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {creator.bio}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <StatPill
                  value={creator.followers_count}
                  label={creator.followers_count === 1 ? "follower" : "followers"}
                />
                {typeof creator.posts_count === "number" && (
                  <StatPill
                    value={creator.posts_count}
                    label={creator.posts_count === 1 ? "post" : "posts"}
                  />
                )}
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
