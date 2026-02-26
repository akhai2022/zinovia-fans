"use client";

import { useState, useRef } from "react";

type Props = {
  src: string;
  poster: string;
  accentColor?: string;
};

export function DemoVideoPlayer({ src, poster, accentColor = "bg-primary/90" }: Props) {
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    video.play().catch(() => {
      setError(true);
      setStarted(false);
    });
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden">
      {/* Video is always mounted but hidden until user clicks play */}
      <video
        ref={videoRef}
        src={src}
        controls={started}
        playsInline
        preload="auto"
        className={`h-full w-full object-cover ${started && !error ? "" : "hidden"}`}
        onError={() => {
          if (started) {
            setError(true);
            setStarted(false);
          }
        }}
        poster={poster}
      />

      {/* Poster + play button overlay (shown when not started or on error) */}
      {(!started || error) && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt="Video walkthrough preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <button
              type="button"
              onClick={handlePlay}
              className={`flex h-16 w-16 items-center justify-center rounded-full ${accentColor} text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-110 sm:h-20 sm:w-20`}
              aria-label="Play video walkthrough"
            >
              <svg className="ml-1 h-7 w-7 sm:h-8 sm:w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          {error && (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                Video could not be played.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
