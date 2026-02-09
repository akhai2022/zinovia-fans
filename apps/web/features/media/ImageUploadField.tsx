"use client";

import { useRef, useState } from "react";
import { MediaService } from "@/features/media/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import "@/lib/api";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setStatus("uploading");
    setErrorMessage(null);
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
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
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
