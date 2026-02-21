"use client";

import { useEffect, useRef, useState, type ReactNode, createElement } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  stagger?: boolean;
  staggerDelay?: number;
  scaleFrom?: number;
  blur?: boolean;
  threshold?: number;
  rootMargin?: string;
  duration?: number;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
}

export function ScrollReveal({
  children,
  className,
  direction = "up",
  stagger = false,
  staggerDelay = 100,
  scaleFrom,
  blur = false,
  threshold = 0.1,
  rootMargin = "0px 0px -60px 0px",
  duration,
  delay = 0,
  as = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");

            if (stagger) {
              const children = entry.target.querySelectorAll(".sr-child");
              children.forEach((child, i) => {
                (child as HTMLElement).style.transitionDelay = `${i * staggerDelay}ms`;
              });
            }

            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion, rootMargin, threshold, stagger, staggerDelay]);

  const dirClass = direction !== "up" ? ` scroll-reveal--${direction}` : "";
  const scaleClass = scaleFrom ? " scroll-reveal--scale" : "";
  const blurClass = blur ? " scroll-reveal--blur" : "";

  const style: Record<string, string | number> = {};
  if (scaleFrom) style["--sr-scale-from"] = scaleFrom;
  if (duration) style.transitionDuration = `${duration}ms`;
  if (delay) style.transitionDelay = `${delay}ms`;

  return createElement(
    as,
    {
      ref,
      className: `scroll-reveal${dirClass}${scaleClass}${blurClass} ${reduceMotion ? "is-visible" : ""} ${className ?? ""}`.trim(),
      style: Object.keys(style).length ? style : undefined,
    },
    children
  );
}
