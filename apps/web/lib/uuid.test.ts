import { afterEach, describe, expect, it, vi } from "vitest";

import { uuidClient, uuidServer } from "./uuid";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const originalForceFallback = process.env.UUID_FORCE_FALLBACK;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalForceFallback === undefined) {
    delete process.env.UUID_FORCE_FALLBACK;
  } else {
    process.env.UUID_FORCE_FALLBACK = originalForceFallback;
  }
});

describe("uuid helpers", () => {
  it("uuidClient returns UUID string when Web Crypto is missing", () => {
    vi.stubGlobal("crypto", undefined);
    const value = uuidClient();
    expect(value).toMatch(UUID_REGEX);
  });

  it("uuidServer falls back when Node/Web crypto UUID is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    process.env.UUID_FORCE_FALLBACK = "1";
    const value = uuidServer();
    expect(value).toMatch(UUID_REGEX);
  });
});
