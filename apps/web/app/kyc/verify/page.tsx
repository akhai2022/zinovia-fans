"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/components/brand/Page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { kycComplete } from "@/lib/onboardingApi";
import { useTranslation, interpolate } from "@/lib/i18n";
import "@/lib/api";

function getAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function SelfieStep({
  selfieFile,
  onCapture,
  onBack,
  onSubmit,
  submitting,
}: {
  selfieFile: File | null;
  onCapture: (file: File | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError(t.kyc.cameraAccessDenied);
    }
  }, [t]);

  useEffect(() => {
    if (!selfieFile && !previewUrl) {
      startCamera();
    }
    return () => stopCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Center-crop and mirror for front camera
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    ctx.restore();
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        onCapture(file);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, stopCamera]);

  const retake = useCallback(() => {
    onCapture(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    startCamera();
  }, [onCapture, previewUrl, startCamera]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t.kyc.selfieLabel}</Label>
        <p className="text-xs text-muted-foreground">
          {t.kyc.selfieInstructions}
        </p>
        <div className="overflow-hidden rounded-lg border-2 border-border bg-black">
          {selfieFile && previewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t.kyc.selfiePreviewAlt}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-4">
                <Button variant="secondary" size="sm" onClick={retake}>
                  {t.kyc.retakeButton}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-square w-full object-cover [transform:scaleX(-1)]"
              />
              {cameraReady && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/60 to-transparent p-4">
                  <button
                    type="button"
                    onClick={takePhoto}
                    className="h-14 w-14 rounded-full border-4 border-white bg-white/30 transition-transform active:scale-90"
                    aria-label={t.kyc.takePhotoAriaLabel}
                  />
                </div>
              )}
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-white/70">{t.kyc.startingCamera}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {cameraError && (
          <p className="text-xs text-destructive">{cameraError}</p>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t.kyc.backButton}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting || !selfieFile}
          className="flex-1"
        >
          {submitting ? t.kyc.submittingButton : t.kyc.submitButton}
        </Button>
      </div>
    </div>
  );
}

export default function KycVerifyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const { addToast } = useToast();
  const { t } = useTranslation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dob, setDob] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onNextAge = useCallback(() => {
    if (!dob) {
      addToast(t.kyc.toastDobRequired, "error");
      return;
    }
    const age = getAge(dob);
    if (age < 18) {
      addToast(t.kyc.toastAgeRestriction, "error");
      return;
    }
    setStep(2);
  }, [dob, addToast, t]);

  const onNextId = useCallback(() => {
    if (!idFile) {
      addToast(t.kyc.toastIdRequired, "error");
      return;
    }
    setStep(3);
  }, [idFile, addToast, t]);

  const onSubmit = useCallback(async () => {
    if (!selfieFile) {
      addToast(t.kyc.toastSelfieRequired, "error");
      return;
    }
    if (!sessionId) {
      addToast(t.kyc.toastInvalidSession, "error");
      return;
    }
    setSubmitting(true);
    try {
      await kycComplete(sessionId, "APPROVED");
      setDone(true);
      addToast(t.kyc.toastVerified, "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t.kyc.toastVerificationFailed;
      addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }, [selfieFile, sessionId, addToast, t]);

  if (!sessionId) {
    return (
      <Page className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">
              {t.kyc.invalidLinkMessage.split("{onboardingLink}")[0]}
              <a href="/onboarding" className="underline">
                {t.kyc.onboardingLinkText}
              </a>
              {t.kyc.invalidLinkMessage.split("{onboardingLink}")[1]}
            </p>
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (done) {
    return (
      <Page className="flex min-h-[60vh] items-center justify-center hero-bg">
        <Card className="w-full max-w-md border-border shadow-premium-md">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-premium-h3">
              {t.kyc.verificationCompleteTitle}
            </CardTitle>
            <CardDescription>
              {t.kyc.verificationCompleteDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push("/settings/profile")}>
              {t.kyc.setUpProfile}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/creator/post/new")}
            >
              {t.kyc.createFirstPost}
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="flex min-h-[70vh] items-center justify-center hero-bg">
      <Card className="w-full max-w-md border-border shadow-premium-md">
        <CardHeader>
          <CardTitle className="font-display text-premium-h3">
            {t.kyc.identityVerificationTitle}
          </CardTitle>
          <CardDescription>
            {interpolate(t.kyc.stepDescription, { step })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  s <= step ? "bg-brand" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Age verification */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dob">{t.kyc.dobLabel}</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
                <p className="text-xs text-muted-foreground">
                  {t.kyc.dobAgeRequirement}
                </p>
              </div>
              <Button onClick={onNextAge} className="w-full">
                {t.kyc.continueButton}
              </Button>
            </div>
          )}

          {/* Step 2: ID card upload */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="id-upload">
                  {t.kyc.idUploadLabel}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t.kyc.idUploadInstructions}
                </p>
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center">
                  {idFile ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {idFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {interpolate(t.kyc.idUploadFileSizeInfo, { size: (idFile.size / 1024 / 1024).toFixed(1) })}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIdFile(null)}
                      >
                        {t.kyc.removeButton}
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="id-upload"
                      className="cursor-pointer space-y-1"
                    >
                      <p className="text-sm text-muted-foreground">
                        {t.kyc.clickToSelectFile}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.kyc.fileFormats}
                      </p>
                    </label>
                  )}
                  <input
                    id="id-upload"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          addToast(t.kyc.toastFileTooLarge, "error");
                          return;
                        }
                        setIdFile(file);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  {t.kyc.backButton}
                </Button>
                <Button onClick={onNextId} className="flex-1">
                  {t.kyc.continueButton}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Selfie via camera */}
          {step === 3 && (
            <SelfieStep
              selfieFile={selfieFile}
              onCapture={setSelfieFile}
              onBack={() => setStep(2)}
              onSubmit={onSubmit}
              submitting={submitting}
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
