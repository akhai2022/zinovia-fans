import { v4 as uuidv4 } from "uuid";

/**
 * Shared UUID helpers.
 *
 * Guardrail: do not import `crypto`/`node:crypto` in client code.
 * Use `uuidClient()` in client components and `uuidServer()` in server-only code.
 */
function fallbackUuid(): string {
  try {
    return uuidv4();
  } catch {
    // Last-resort fallback for extremely constrained runtimes.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}

function webCryptoUuid(): string | null {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return null;
}

function nodeCryptoUuid(): string | null {
  // Test-only switch to simulate missing Node crypto APIs.
  if (typeof process !== "undefined" && process.env.UUID_FORCE_FALLBACK === "1") {
    return null;
  }
  if (
    typeof process === "undefined" ||
    !process.versions ||
    typeof process.versions.node !== "string"
  ) {
    return null;
  }
  try {
    const dynamicRequire =
      // Avoid top-level Node imports so client bundles stay clean.
      Function("return typeof require !== 'undefined' ? require : undefined")() as
        | ((id: string) => unknown)
        | undefined;
    if (!dynamicRequire) return null;
    const cryptoModule = dynamicRequire("node:crypto") as {
      randomUUID?: () => string;
    };
    if (typeof cryptoModule.randomUUID === "function") {
      return cryptoModule.randomUUID();
    }
  } catch {
    return null;
  }
  return null;
}

export function uuidClient(): string {
  return webCryptoUuid() ?? fallbackUuid();
}

export function uuidServer(): string {
  return webCryptoUuid() ?? nodeCryptoUuid() ?? fallbackUuid();
}

export function uuidUniversal(): string {
  if (typeof window !== "undefined") {
    return uuidClient();
  }
  return uuidServer();
}
