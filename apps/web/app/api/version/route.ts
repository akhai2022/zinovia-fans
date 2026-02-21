import { NextResponse } from "next/server";

const BUILD_ID = process.env.BUILD_ID || "dev";

export function GET() {
  return NextResponse.json(
    { id: BUILD_ID },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
  );
}
