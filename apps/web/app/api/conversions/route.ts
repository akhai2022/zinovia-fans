import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { createHash } from "node:crypto";

/**
 * Server-side conversion endpoint.
 * Forwards conversion events to Meta CAPI and Google Ads enhanced conversions.
 *
 * POST /api/conversions
 * Body: { event_name, email?, value?, currency?, source_url?, user_agent?, click_ids? }
 */

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const META_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
const GOOGLE_ADS_CONVERSION_LABEL = process.env.GOOGLE_ADS_CONVERSION_LABEL || "";
const GOOGLE_ADS_API_TOKEN = process.env.GOOGLE_ADS_API_TOKEN || "";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// Map our event names to Meta standard events
const META_EVENT_MAP: Record<string, string> = {
  sign_up: "CompleteRegistration",
  purchase: "Purchase",
  subscribe: "Subscribe",
  lead: "Lead",
  search: "Search",
};

async function sendMetaCapi(body: {
  event_name: string;
  email?: string;
  value?: number;
  currency?: string;
  source_url?: string;
  user_agent?: string;
  click_ids?: { fbclid?: string };
}) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) return;

  const metaEvent = META_EVENT_MAP[body.event_name] || body.event_name;
  const eventData: Record<string, unknown> = {
    event_name: metaEvent,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_source_url: body.source_url || "https://zinovia.ai",
    user_data: {
      ...(body.email ? { em: [sha256(body.email)] } : {}),
      ...(body.click_ids?.fbclid ? { fbc: `fb.1.${Date.now()}.${body.click_ids.fbclid}` } : {}),
      ...(body.user_agent ? { client_user_agent: body.user_agent } : {}),
    },
    ...(body.value != null
      ? { custom_data: { value: body.value, currency: body.currency || "EUR" } }
      : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          ...(process.env.NODE_ENV !== "production" ? { test_event_code: "TEST_CODE" } : {}),
        }),
      },
    );
    if (!res.ok) {
      console.error("[META CAPI] Error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[META CAPI] Network error:", err);
  }
}

async function sendGoogleEnhancedConversion(body: {
  event_name: string;
  email?: string;
  value?: number;
  currency?: string;
  click_ids?: { gclid?: string };
}) {
  // Google Ads enhanced conversions via Measurement Protocol
  if (!GOOGLE_ADS_ID || !GOOGLE_ADS_API_TOKEN) return;

  try {
    const conversionData: Record<string, unknown> = {
      conversionAction: `customers/${GOOGLE_ADS_ID}/conversionActions/${GOOGLE_ADS_CONVERSION_LABEL}`,
      conversionDateTime: new Date().toISOString().replace("T", " ").slice(0, 19) + " +0000",
      ...(body.value != null
        ? { conversionValue: body.value, currencyCode: body.currency || "EUR" }
        : {}),
      ...(body.click_ids?.gclid ? { gclid: body.click_ids.gclid } : {}),
      ...(body.email
        ? {
            userIdentifiers: [
              { hashedEmail: sha256(body.email) },
            ],
          }
        : {}),
    };

    // Google Ads API for offline conversions
    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${GOOGLE_ADS_ID}:uploadClickConversions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GOOGLE_ADS_API_TOKEN}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        },
        body: JSON.stringify({
          conversions: [conversionData],
          partialFailure: true,
        }),
      },
    );
    if (!res.ok) {
      console.error("[GOOGLE ADS] Error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[GOOGLE ADS] Network error:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_name, email, value, currency, source_url, click_ids } = body;

    if (!event_name) {
      return NextResponse.json({ error: "event_name required" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") || undefined;

    // Fire to both platforms in parallel
    await Promise.allSettled([
      sendMetaCapi({ event_name, email, value, currency, source_url, user_agent: userAgent, click_ids }),
      sendGoogleEnhancedConversion({ event_name, email, value, currency, click_ids }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
