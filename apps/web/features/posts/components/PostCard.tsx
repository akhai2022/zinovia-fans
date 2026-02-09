"use client";

import Link from "next/link";
import type { PostOut, PostWithCreator } from "../api";
import { PostMediaImage } from "./PostMediaImage";
import { PostMediaVideo } from "./PostMediaVideo";

type PostCardProps = {
  post: PostOut | PostWithCreator;
  /** If set, show creator header and link (e.g. feed). */
  creator?: { handle: string; display_name: string };
};

export function PostCard({ post, creator }: PostCardProps) {
  const isWithCreator = "creator" in post && post.creator;
  const creatorInfo = creator ?? (isWithCreator ? (post as PostWithCreator).creator : null);

  return (
    <article className="rounded-brand border border-border bg-card p-4 shadow-sm text-card-foreground">
      {creatorInfo && (
        <header className="mb-3 flex items-center gap-2 border-b border-border pb-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0">
            <Link
              href={`/creators/${creatorInfo.handle}`}
              className="font-medium text-foreground hover:underline"
            >
              {creatorInfo.display_name}
            </Link>
            <p className="text-xs text-muted-foreground">@{creatorInfo.handle}</p>
          </div>
        </header>
      )}
      {post.caption && (
        <p className="text-sm text-foreground">{post.caption}</p>
      )}
      {post.type === "IMAGE" && post.asset_ids && post.asset_ids.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {post.asset_ids.map((assetId) => (
            <div
              key={assetId}
              className="overflow-hidden rounded-lg border border-border bg-muted"
            >
              <PostMediaImage
                assetId={assetId}
                className="h-32 w-32 object-cover sm:h-40 sm:w-40"
              />
            </div>
          ))}
        </div>
      )}
      {post.type === "VIDEO" && post.asset_ids && post.asset_ids.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-muted aspect-video max-w-lg">
          <PostMediaVideo
            assetId={post.asset_ids[0]}
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {post.visibility} · {new Date(post.created_at).toLocaleDateString()}
      </p>
    </article>
  );
}
