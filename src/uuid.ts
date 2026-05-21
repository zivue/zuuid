const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeUuid(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`invalid UUID: ${value}`);
  }

  return normalized;
}

export async function uuidV5(name: string, namespace: string): Promise<string> {
  const namespaceBytes = uuidToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const bytes = new Uint8Array(namespaceBytes.length + nameBytes.length);
  bytes.set(namespaceBytes);
  bytes.set(nameBytes, namespaceBytes.length);

  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-1", bytes));
  const uuid = digest.slice(0, 16);

  uuid[6] = (uuid[6] & 0x0f) | 0x50;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;

  return bytesToUuid(uuid);
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = normalizeUuid(uuid).replaceAll("-", "");
  const bytes = new Uint8Array(16);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
