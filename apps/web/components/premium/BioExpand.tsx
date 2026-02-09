"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BioExpandProps {
  text: string;
  className?: string;
  /** Approximate line length to detect "long" bio (chars). */
  expandThreshold?: number;
}

export function BioExpand({
  text,
  className,
  expandThreshold = 120,
}: BioExpandProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > expandThreshold;

  return (
    <div className={cn("text-premium-body-sm text-muted-foreground", className)}>
      <p className={cn(!expanded && isLong && "line-clamp-3")}>
        {text}
      </p>
      {isLong && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-premium-small font-medium text-accent-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          aria-expanded="false"
          aria-label="Read more"
        >
          Read more
        </button>
      )}
    </div>
  );
}
