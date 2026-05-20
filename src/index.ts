export type ProviderName =
  | "musicbrainz"
  | "gamesdb"
  | "openlibrary"
  | "tmdb"
  | "jikan"
  | "comicvine"
  | "setlistfm"
  | "ticketmaster"
  | "podcast"
  | "openstreetmap"
  | "wger"
  | "openfoodfacts"
  | "goodreads"
  | "rss"
  | "web";

export type EntityKind = "event" | "listen" | "people" | "play" | "read" | "visit" | "watch" | string;

export type EntityCategory = {
  kind: EntityKind;
  value: string;
};

export type SourceRecordRef = {
  provider: string;
  category: string;
  externalId: string;
};

export type ExternalId = {
  source: string;
  category: string;
  value: string;
};

export type Provenance = {
  source: SourceRecordRef;
  observedAt: string;
  confidence?: number;
  contentHash?: string;
};

export type Alias = {
  value: string;
  language?: string;
  aliasType: string;
  isPrimary: boolean;
};

export type Description = {
  language?: string;
  value: string;
  source?: string;
};

export type Detail = {
  key: string;
  value: string;
  source?: string;
};

export type MediaAsset = {
  url: string;
  mediaType: string;
  mediaCategory: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
  source?: string;
};

export type EntityRelation = {
  relatedZuuid: string;
  relationType: string;
  direction: "outgoing" | "incoming" | "symmetric";
  attribute?: string;
  confidence?: number;
  order?: number;
};

export type RecommendationEdge = {
  targetZuuid: string;
  recommendationType: string;
  score: number;
  source?: string;
  reasons: string[];
};

export type EntityPublicData = {
  kind: EntityKind;
  category: EntityCategory;
  primaryTitle: string;
  primaryDate?: string;
  rating?: number;
  cover?: string;
  aliases: Alias[];
  descriptions: Description[];
  details: Detail[];
  media: MediaAsset[];
  relations: EntityRelation[];
  recommendations: RecommendationEdge[];
  tags: string[];
  externalIds: ExternalId[];
  provenance: Provenance[];
};

export type SourcePayloadState = {
  source: SourceRecordRef;
  contentHash: string;
  transformedAt?: string;
  publishedAt?: string;
  lastError?: string;
};

export type EntityInternalData = {
  matchCandidates: unknown[];
  flags: string[];
  review?: unknown;
  indexState?: unknown;
  sourcePayloads: SourcePayloadState[];
};

export type RecordMetadata = {
  schemaVersion: number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  publicProjectionHash?: string;
};

export type ZuuidEntityRecord = {
  zuuid: string;
  public: EntityPublicData;
  internal: EntityInternalData;
  record: RecordMetadata;
};

export type CreateEntityRecordInput = {
  zuuid: string;
  category: string | EntityCategory;
  primaryTitle: string;
};

export type ProviderZuuidInput = {
  provider: string;
  category: string;
  externalId: string | number;
};

export type ProviderNamespace = {
  provider: ProviderName;
  namespace: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PROVIDER_NAMESPACES: ProviderNamespace[] = [
  { provider: "musicbrainz", namespace: "9e4a2c71-f528-4d83-b710-a40c3e917f2a" },
  { provider: "gamesdb", namespace: "7ca1b820-aebc-41d2-90c5-00d05fe440d9" },
  { provider: "openlibrary", namespace: "3ea1c742-b50f-4a93-912d-7c8e1fa364d1" },
  { provider: "tmdb", namespace: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
  { provider: "jikan", namespace: "7ca8b920-aebe-22e2-91c5-01d15ee541d9" },
  { provider: "comicvine", namespace: "8db9ca31-bfcf-33f3-a2d6-12e26ff652ea" },
  { provider: "setlistfm", namespace: "9ecadb42-c0d0-4404-b3e7-23f3700763fb" },
  { provider: "ticketmaster", namespace: "afdbec53-d1e1-5515-c4f8-34048118740c" },
  { provider: "podcast", namespace: "befb0c64-e2f2-6626-d509-45159229851d" },
  { provider: "openstreetmap", namespace: "cf0c1d75-f303-7737-e60a-5626a33a962e" },
  { provider: "wger", namespace: "3e8fa214-c75b-4d91-a36e-11b27af8634c" },
  { provider: "openfoodfacts", namespace: "b472d18a-5e3f-497c-821d-9a0e55c67b31" },
  { provider: "goodreads", namespace: "913a7c05-e48b-4d3a-a16f-b7520cd9834e" },
  { provider: "rss", namespace: "2540ad68-f1e4-4a1d-98c5-76f08f499121" },
  { provider: "web", namespace: "3f7b7add-b417-4892-862c-2db2df12f981" }
];

export function providerNamespace(provider: string): string | undefined {
  return PROVIDER_NAMESPACES.find((entry) => entry.provider === provider)?.namespace;
}

export async function providerZuuid(input: ProviderZuuidInput): Promise<string> {
  const namespace = providerNamespace(input.provider);

  if (!namespace) {
    throw new Error(`unknown provider namespace: ${input.provider}`);
  }

  const category = normalizeKeyPart(input.category);
  if (!category) {
    throw new Error("category must not be empty");
  }

  const externalId = String(input.externalId).trim();
  if (!externalId) {
    throw new Error("external id must not be empty");
  }

  return uuidV5(`${category}:${externalId}`, namespace);
}

export function createEntityRecord(input: CreateEntityRecordInput): ZuuidEntityRecord {
  const zuuid = normalizeUuid(input.zuuid);
  const category = typeof input.category === "string" ? categoryFor(input.category) : input.category;

  return {
    zuuid,
    public: createPublicData(category, input.primaryTitle),
    internal: {
      matchCandidates: [],
      flags: [],
      sourcePayloads: []
    },
    record: {
      schemaVersion: 1,
      version: 1
    }
  };
}

export function createPublicData(category: EntityCategory, primaryTitle: string): EntityPublicData {
  return {
    kind: category.kind,
    category,
    primaryTitle,
    aliases: [],
    descriptions: [],
    details: [],
    media: [],
    relations: [],
    recommendations: [],
    tags: [],
    externalIds: [],
    provenance: []
  };
}

export function categoryFor(value: string): EntityCategory {
  const normalized = normalizeKeyPart(value);
  return {
    kind: kindForCategory(normalized),
    value: normalized
  };
}

export function kindForCategory(category: string): EntityKind {
  switch (normalizeKeyPart(category)) {
    case "movie":
    case "film":
    case "tv":
    case "tvshow":
    case "tv_show":
    case "tvseason":
    case "tv_season":
    case "series":
    case "anime":
    case "documentary":
    case "video":
      return "watch";
    case "album":
    case "music":
    case "musicalbum":
    case "release":
    case "master":
    case "track":
    case "recording":
    case "podcast":
    case "podcast_episode":
    case "audiobook":
      return "listen";
    case "book":
    case "work":
    case "article":
    case "web_page":
    case "comic":
    case "manga":
    case "paper":
    case "blog_post":
      return "read";
    case "game":
    case "videogame":
    case "boardgame":
    case "platform":
      return "play";
    case "place":
    case "location":
    case "venue":
    case "restaurant":
    case "route":
    case "city":
    case "country":
      return "visit";
    case "event":
    case "concert":
    case "screening":
    case "exhibition":
    case "match":
    case "festival":
      return "event";
    case "person":
    case "people":
    case "artist":
    case "author":
    case "actor":
    case "creator":
    case "organization":
    case "company":
    case "team":
      return "people";
    default:
      return normalizeKeyPart(category);
  }
}

export function entityRecordKey(zuuid: string, extension = "json"): string {
  const normalized = normalizeUuid(zuuid);
  const simple = normalized.replaceAll("-", "");
  const cleanExtension = extension.replace(/^\./, "").trim();

  if (!cleanExtension) {
    throw new Error("extension must not be empty");
  }

  return `entities/${simple.slice(0, 2)}/${simple.slice(2, 4)}/${normalized}.${cleanExtension}`;
}

export function normalizeUuid(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`invalid UUID: ${value}`);
  }

  return normalized;
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

async function uuidV5(name: string, namespace: string): Promise<string> {
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
