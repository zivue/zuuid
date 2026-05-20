export type HashAlgorithm = "sha256";

export type ByteInput = string | ArrayBuffer | ArrayBufferView;

export type CreateZuuidInput = {
  bytes: ByteInput;
  mediaType?: string;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type CreateZuuidRecordInput<TData extends JsonValue = JsonValue> = {
  data: TData;
  type?: string;
  meta?: Record<string, JsonValue>;
  links?: Record<string, string | string[]>;
};

export type ParsedZuuid = {
  version: 1;
  mediaType: string;
  algorithm: HashAlgorithm;
  digest: string;
};

export type ZuuidRecord<TData extends JsonValue = JsonValue> = ParsedZuuid & {
  id: string;
  type: string;
  data: TData;
  meta: Record<string, JsonValue>;
  links: Record<string, string | string[]>;
};

export type StorageKeyInput = {
  id: string;
  extension?: string;
  prefix?: string;
  shardDepth?: number;
  shardSize?: number;
};

export type CreateMediaDescriptorInput = CreateZuuidInput & {
  filename?: string;
  extension?: string;
  prefix?: string;
  shardDepth?: number;
  shardSize?: number;
};

export type MediaDescriptor = ParsedZuuid & {
  id: string;
  byteLength: number;
  extension?: string;
  storageKey: string;
};

const DEFAULT_MEDIA_TYPE = "application/octet-stream";
const ZUUID_PATTERN = /^zuuid:v(\d+):([^:]+):([a-z0-9-]+):([a-f0-9]{64})$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

const MEDIA_TYPE_EXTENSIONS = new Map<string, string>([
  ["application/json", "json"],
  ["application/pdf", "pdf"],
  ["application/xml", "xml"],
  ["audio/aac", "aac"],
  ["audio/flac", "flac"],
  ["audio/mpeg", "mp3"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
  ["audio/webm", "webm"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/svg+xml", "svg"],
  ["image/webp", "webp"],
  ["text/csv", "csv"],
  ["text/html", "html"],
  ["text/markdown", "md"],
  ["text/plain", "txt"],
  ["video/mp4", "mp4"],
  ["video/mpeg", "mpeg"],
  ["video/ogg", "ogv"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"]
]);

export async function createZuuid(input: CreateZuuidInput): Promise<string> {
  const bytes = toUint8Array(input.bytes);
  const mediaType = normalizeMediaType(input.mediaType);
  const digest = await sha256Hex(bytes);

  return `zuuid:v1:${mediaType}:sha256:${digest}`;
}

export async function createZuuidRecord<TData extends JsonValue>(
  input: CreateZuuidRecordInput<TData>
): Promise<ZuuidRecord<TData>> {
  const type = normalizeMediaType(input.type);
  const bytes = canonicalJsonBytes(input.data);
  const id = await createZuuid({ bytes, mediaType: type });
  const parsed = parseZuuid(id);

  return {
    ...parsed,
    id,
    type,
    data: input.data,
    meta: input.meta ?? {},
    links: input.links ?? {}
  };
}

export async function createMediaDescriptor(
  input: CreateMediaDescriptorInput
): Promise<MediaDescriptor> {
  const bytes = toUint8Array(input.bytes);
  const id = await createZuuid({ bytes, mediaType: input.mediaType });
  const parsed = parseZuuid(id);
  const extension = normalizeExtension(
    input.extension ?? extensionFromFilename(input.filename) ?? extensionFromMediaType(parsed.mediaType)
  );
  const storageKey = formatStorageKey({
    id,
    extension,
    prefix: input.prefix,
    shardDepth: input.shardDepth,
    shardSize: input.shardSize
  });

  return {
    ...parsed,
    id,
    byteLength: bytes.byteLength,
    extension,
    storageKey
  };
}

export function parseZuuid(id: string): ParsedZuuid {
  const match = ZUUID_PATTERN.exec(id);

  if (!match) {
    throw new Error(`Invalid ZUUID: ${id}`);
  }

  const version = Number(match[1]);
  const mediaType = match[2];
  const algorithm = match[3];
  const digest = match[4];

  if (version !== 1) {
    throw new Error(`Unsupported ZUUID version: ${version}`);
  }

  if (algorithm !== "sha256") {
    throw new Error(`Unsupported ZUUID hash algorithm: ${algorithm}`);
  }

  if (!isNormalizedMediaType(mediaType)) {
    throw new Error(`Invalid ZUUID media type: ${mediaType}`);
  }

  return {
    version,
    mediaType,
    algorithm,
    digest
  };
}

export function formatStorageKey(input: StorageKeyInput): string {
  const parsed = parseZuuid(input.id);
  const prefix = normalizePrefix(input.prefix);
  const shardDepth = input.shardDepth ?? 2;
  const shardSize = input.shardSize ?? 2;

  if (!Number.isInteger(shardDepth) || shardDepth < 0 || shardDepth > 8) {
    throw new Error("shardDepth must be an integer from 0 to 8");
  }

  if (!Number.isInteger(shardSize) || shardSize < 1 || shardSize > 8) {
    throw new Error("shardSize must be an integer from 1 to 8");
  }

  const shardLength = shardDepth * shardSize;

  if (shardLength > parsed.digest.length) {
    throw new Error("shardDepth multiplied by shardSize cannot exceed the digest length");
  }

  const shards = Array.from({ length: shardDepth }, (_, index) => {
    const offset = index * shardSize;
    return parsed.digest.slice(offset, offset + shardSize);
  });
  const extension = normalizeExtension(input.extension);
  const filename = extension ? `${safeId(input.id)}.${extension}` : safeId(input.id);

  return [prefix, parsed.algorithm, ...shards, filename].filter(Boolean).join("/");
}

export function normalizeMediaType(mediaType?: string): string {
  const normalized = (mediaType ?? DEFAULT_MEDIA_TYPE).split(";")[0]?.trim().toLowerCase();

  if (!normalized || !isNormalizedMediaType(normalized)) {
    throw new Error(`Invalid media type: ${mediaType ?? ""}`);
  }

  return normalized;
}

export function extensionFromMediaType(mediaType: string): string | undefined {
  return MEDIA_TYPE_EXTENSIONS.get(normalizeMediaType(mediaType));
}

function extensionFromFilename(filename?: string): string | undefined {
  if (!filename) {
    return undefined;
  }

  const leaf = filename.split(/[\\/]/).pop() ?? "";
  const dotIndex = leaf.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === leaf.length - 1) {
    return undefined;
  }

  return leaf.slice(dotIndex + 1);
}

function normalizeExtension(extension?: string): string | undefined {
  if (!extension) {
    return undefined;
  }

  const normalized = extension.replace(/^\./, "").trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9.+-]{0,31}$/.test(normalized)) {
    throw new Error(`Invalid file extension: ${extension}`);
  }

  return normalized;
}

function normalizePrefix(prefix?: string): string {
  if (!prefix) {
    return "";
  }

  return prefix
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function safeId(id: string): string {
  return id.replaceAll(":", "-").replaceAll("/", "-");
}

function isNormalizedMediaType(mediaType: string): boolean {
  return MEDIA_TYPE_PATTERN.test(mediaType);
}

function toUint8Array(input: ByteInput): Uint8Array {
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function canonicalJsonBytes(value: JsonValue): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as JsonValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto subtle digest support is required");
  }

  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
