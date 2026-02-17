"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiError } from "@zinovia/contracts";
import { MediaService } from "@/features/media/api";
import { Button } from "@/components/ui/button";
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage("Image is too large (max 25 MB).");
      setStatus("error");
      return;
    }

    setStatus("uploading");
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

      const putRes = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`);
      }

      const { download_url } = await MediaService.mediaDownloadUrl(asset_id);
      if (download_url) {
        setPreviewUrl(download_url);
      }
      setStatus("done");
      onUploadComplete(asset_id, download_url ?? null);
      if (allowMultiple) {
        setPreviewUrl(null);
        setStatus("idle");
      }
    } catch (err) {
      setStatus("error");
      const { kind, message } = getApiErrorMessage(err);
      const isUnauth = kind === "unauthorized" || (err instanceof ApiError && err.status === 401);
      setUnauthorized(isUnauth);
      setErrorMessage(isUnauth ? "Sign in to upload" : message || "Upload failed");
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
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || status === "uploading"}
        >
          {status === "uploading"
            ? "Uploading…"
            : status === "done" && allowMultiple
              ? "Add another image"
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
