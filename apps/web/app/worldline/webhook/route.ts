import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET — Worldline endpoint verification.
 * Worldline sends a GET with X-GCS-Webhooks-Endpoint-Verification header.
 * We must echo the value back as plain text to prove ownership.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-gcs-webhooks-endpoint-verification");

  if (!token) {
    return new NextResponse("missing verification header", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(token, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * POST — Worldline webhook events (payment status updates).
 * Signature verification uses the Webhooks key (not the API secret key).
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-gcs-signature");
  const keyId = req.headers.get("x-gcs-keyid");

  if (!signature || !keyId) {
    return new NextResponse("missing signature headers", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const rawBody = await req.text();

  // Forward the webhook to the API backend for processing
  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  try {
    const upstream = await fetch(`${apiBase}/billing/webhooks/worldline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GCS-Signature": signature,
        "X-GCS-KeyId": keyId,
      },
      body: rawBody,
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    console.error("[worldline-webhook] Failed to forward to API");
    return new NextResponse("ok", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
