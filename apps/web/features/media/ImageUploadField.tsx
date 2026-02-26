"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiError } from "@zinovia/contracts";
import { MediaService } from "@/features/media/api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
/** Mirror server default (MEDIA_MAX_IMAGE_BYTES); reject oversized files early. */
const MAX_IMAGE_BYTES = 26_214_400; // 25 MiB
const MAX_OBJECT_KEY_LENGTH = 255;

function makeObjectKey(file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const key = `posts/${Date.now()}-${safeName}`;
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

export interface ImageUploadFieldProps {
  /** Called with asset_id and optional preview URL after successful upload. */
  onUploadComplete: (assetId: string, previewUrl?: string | null) => void;
  disabled?: boolean;
  /** Allow adding another image after one is uploaded (for multi-image flows). */
  allowMultiple?: boolean;
}

export function ImageUploadField({
  onUploadComplete,
  disabled,
  allowMultiple = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadSingleFile = async (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage("Image is too large (max 25 MB).");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setErrorMessage(null);
    setUnauthorized(false);
    setPreviewUrl(null);

    const objectKey = makeObjectKey(file);
    const contentType = file.type || "image/jpeg";
    const sizeBytes = file.size;

    try {
      const { asset_id, upload_url } = await MediaService.mediaUploadUrl({
        object_key: objectKey,
        content_type: contentType,
        size_bytes: sizeBytes,
      });

      await uploadWithProgress(upload_url, file, contentType, setProgress);

      const { download_url } = await MediaService.mediaDownloadUrl(asset_id);
      if (download_url) {
        setPreviewUrl(download_url);
      }
      setStatus("done");
      onUploadComplete(asset_id, download_url ?? null);
      if (allowMultiple) {
        setPreviewUrl(null);
        setStatus("idle");
        setProgress(0);
      }
    } catch (err) {
      setStatus("error");
      setProgress(0);
      const { kind, message } = getApiErrorMessage(err);
      const isUnauth = kind === "unauthorized" || (err instanceof ApiError && err.status === 401);
      setUnauthorized(isUnauth);
      setErrorMessage(isUnauth ? "Sign in to upload" : message || "Upload failed");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = "";

    if (allowMultiple && files.length > 1) {
      // Upload all selected files sequentially
      for (const file of Array.from(files)) {
        await uploadSingleFile(file);
      }
    } else {
      await uploadSingleFile(files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Image</Label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose image"
        onChange={handleFileSelect}
        disabled={disabled}
        multiple={allowMultiple}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || status === "uploading"}
        >
          <Icon name="upload" className="mr-1.5 icon-sm" />
          {status === "uploading"
            ? `Uploading ${progress}%`
            : status === "done" && allowMultiple
              ? "Add more images"
              : allowMultiple
                ? "Choose images"
                : "Choose image"}
        </Button>
        {status === "done" && !allowMultiple && (
          <span className="text-sm text-muted-foreground">Uploaded</span>
        )}
        {status === "error" && errorMessage && (
          <span className="text-sm text-destructive" role="alert">
            {errorMessage}
            {unauthorized && (
              <>
                {" "}
                <Link href="/login" className="underline focus:outline-none focus:ring-2 focus:ring-ring rounded">
                  Sign in
                </Link>
              </>
            )}
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
      {previewUrl && (
        <div className="mt-2">
          <img
            src={previewUrl}
            alt="Upload preview"
            className="max-h-32 rounded-lg border border-border object-cover"
          />
        </div>
      )}
    </div>
  );
}
