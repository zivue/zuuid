import { uuidV5 } from "./uuid.js";

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

export type ProviderNamespace = {
  provider: ProviderName;
  namespace: string;
};

export type ProviderZuuidInput = {
  provider: string;
  category: string;
  externalId: string | number;
};

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

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}
