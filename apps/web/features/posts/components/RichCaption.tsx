"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight rich-text renderer for post captions.
 * Supports: **bold**, *italic*, [links](url), auto-linked URLs, and line breaks.
 * No external dependencies — XSS-safe via explicit allowlist rendering.
 */

type Segment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "link"; label: string; href: string }
  | { type: "br" };

const URL_RE =
  /https?:\/\/[^\s<>)\]"']+/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function parseCaption(raw: string): Segment[] {
  const segments: Segment[] = [];
  const lines = raw.split("\n");

  for (let li = 0; li < lines.length; li++) {
    if (li > 0) segments.push({ type: "br" });
    const line = lines[li];

    // Tokenize: first extract markdown links, then bold, italic, then auto-link URLs
    let remaining = line;
    const tokens: Segment[] = [];

    // Phase 1: Extract markdown links [label](url)
    let lastIndex = 0;
    for (const match of remaining.matchAll(MD_LINK_RE)) {
      const before = remaining.slice(lastIndex, match.index);
      if (before) tokens.push({ type: "text", value: before });
      tokens.push({ type: "link", label: match[1], href: match[2] });
      lastIndex = match.index! + match[0].length;
    }
    if (lastIndex < remaining.length) {
      tokens.push({ type: "text", value: remaining.slice(lastIndex) });
    }

    // Phase 2: Within text tokens, extract bold/italic/URLs
    for (const token of tokens) {
      if (token.type !== "text") {
        segments.push(token);
        continue;
      }
      let text = token.value;
      // Extract bold
      let parts: Segment[] = [];
      let idx = 0;
      for (const m of text.matchAll(BOLD_RE)) {
        if (m.index! > idx) parts.push({ type: "text", value: text.slice(idx, m.index) });
        parts.push({ type: "bold", value: m[1] });
        idx = m.index! + m[0].length;
      }
      if (idx < text.length) parts.push({ type: "text", value: text.slice(idx) });
      if (parts.length === 0) parts.push({ type: "text", value: text });

      // Extract italic from remaining text segments
      const withItalic: Segment[] = [];
      for (const p of parts) {
        if (p.type !== "text") {
          withItalic.push(p);
          continue;
        }
        let iIdx = 0;
        for (const m of p.value.matchAll(ITALIC_RE)) {
          if (m.index! > iIdx) withItalic.push({ type: "text", value: p.value.slice(iIdx, m.index) });
          withItalic.push({ type: "italic", value: m[1] });
          iIdx = m.index! + m[0].length;
        }
        if (iIdx < p.value.length) withItalic.push({ type: "text", value: p.value.slice(iIdx) });
        if (iIdx === 0) withItalic.push(p);
      }

      // Extract auto-linked URLs from remaining text segments
      for (const p of withItalic) {
        if (p.type !== "text") {
          segments.push(p);
          continue;
        }
        let uIdx = 0;
        for (const m of p.value.matchAll(URL_RE)) {
          if (m.index! > uIdx) segments.push({ type: "text", value: p.value.slice(uIdx, m.index) });
          segments.push({ type: "link", label: m[0], href: m[0] });
          uIdx = m.index! + m[0].length;
        }
        if (uIdx < p.value.length) segments.push({ type: "text", value: p.value.slice(uIdx) });
        if (uIdx === 0) segments.push(p);
      }
    }
  }

  return segments;
}

interface RichCaptionProps {
  text: string;
  className?: string;
}

export function RichCaption({ text, className }: RichCaptionProps) {
  const segments = useMemo(() => parseCaption(text), [text]);

  return (
    <p className={cn("text-premium-body-sm text-foreground whitespace-pre-wrap break-words", className)}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "text":
            return <span key={i}>{seg.value}</span>;
          case "bold":
            return <strong key={i}>{seg.value}</strong>;
          case "italic":
            return <em key={i}>{seg.value}</em>;
          case "link":
            return (
              <a
                key={i}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {seg.label}
              </a>
            );
          case "br":
            return <br key={i} />;
        }
      })}
    </p>
  );
}
