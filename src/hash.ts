import type { JsonValue } from "./types.js";

export async function stablePayloadHash(payload: JsonValue): Promise<string> {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(payload)));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", digestInput));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
