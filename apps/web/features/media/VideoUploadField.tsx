"use client";

import { useRef, useState } from "react";
import { MediaService } from "@/features/media/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import "@/lib/api";

const ACCEPT = "video/mp4";
const MAX_OBJECT_KEY_LENGTH = 255;
/** Mirror server default (MEDIA_MAX_VIDEO_BYTES); avoid uploading oversized files. */
const MAX_VIDEO_BYTES = 200_000_000;

function makeObjectKey(file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const key = `posts/video-${Date.now()}-${safeName}`;
  return key.length > MAX_OBJECT_KEY_LENGTH ? key.slice(0, MAX_OBJECT_KEY_LENGTH) : key;
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}

export interface VideoUploadFieldProps {
  onUploadComplete: (assetId: string) => void;
  disabled?: boolean;
}

export function VideoUploadField({
  onUploadComplete,
  disabled,
}: VideoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.type !== "video/mp4") {
      setErrorMessage("Only MP4 videos are supported.");
      setStatus("error");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setErrorMessage("Video is too large (max 200MB).");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setErrorMessage(null);

    const objectKey = makeObjectKey(file);
    const contentType = "video/mp4";
    const sizeBytes = file.size;

    try {
      const { asset_id, upload_url } = await MediaService.mediaUploadUrl({
        object_key: objectKey,
        content_type: contentType,
        size_bytes: sizeBytes,
      });

      await uploadWithProgress(upload_url, file, contentType, setProgress);

      setStatus("done");
      onUploadComplete(asset_id);
    } catch (err) {
      setStatus("error");
      setProgress(0);
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="space-y-2">
      <Label>Video (MP4)</Label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose video (MP4)"
        onChange={handleFileSelect}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || status === "uploading"}
        >
          {status === "uploading" ? `Uploading ${progress}%` : status === "done" ? "Uploaded" : "Choose video"}
        </Button>
        {status === "error" && errorMessage && (
          <span className="text-sm text-destructive" role="alert">
            {errorMessage}
          </span>
        )}
      </div>
      {status === "uploading" && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          />
        </div>
      )}
    </div>
  );
}
