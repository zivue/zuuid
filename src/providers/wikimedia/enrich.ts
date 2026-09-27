import type { ZuuidData } from "../../entity.js";
import { stablePayloadHash } from "../../hash.js";
import type { JsonValue } from "../../types.js";
import { addDescription, addDetail, addLink, objectPayload, stripHtml } from "../common.js";

const WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData";
const COMMONS_API_BASE = "https://commons.wikimedia.org/w/api.php";
const ENGLISH_WIKIPEDIA_API_BASE = "https://en.wikipedia.org/w/api.php";

export type WikimediaFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type WikimediaEnrichmentOptions = {
  fetch?: WikimediaFetchLike;
  userAgent?: string;
  wikidataEntityBaseUrl?: string;
  commonsApiBaseUrl?: string;
  wikipediaApiBaseUrl?: string;
  mediaCategory?: string;
};

type EnrichmentContext = {
  fetch: WikimediaFetchLike;
  userAgent: string;
  options: WikimediaEnrichmentOptions;
  observedAt: string;
};

export async function enrichFromWikimedia(data: ZuuidData, options: WikimediaEnrichmentOptions = {}): Promise<ZuuidData> {
  const wikidataId = data.externalIds.find((externalId) => externalId.source === "wikidata")?.value;
  if (!wikidataId || !/^Q\d+$/i.test(wikidataId)) return data;
  const context: EnrichmentContext = {
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    userAgent: options.userAgent ?? "@zivue/zuuid Wikimedia enrichment (+https://github.com/zivue/zuuid)",
    options,
    observedAt: new Date().toISOString(),
  };

  const wikidata = await fetchWikidataEntity(wikidataId, context).catch(() => undefined);
  if (!wikidata) return data;
  await addProvenance(data, "wikidata", "entity", wikidataId, wikidata.payload, context.observedAt);
  addWikidataDescription(data, wikidata.entity);
  await Promise.allSettled([
    enrichWikipediaDescription(data, wikidata.entity, context),
    enrichCommonsImage(data, wikidata.entity, wikidataId, context),
  ]);
  return data;
}

async function fetchJson(url: URL, context: EnrichmentContext): Promise<JsonValue | undefined> {
  const response = await context.fetch(url, {
    headers: { accept: "application/json", "user-agent": context.userAgent },
  });
  if (!response.ok) return undefined;
  return response.json() as Promise<JsonValue>;
}

async function addProvenance(
  data: ZuuidData,
  provider: string,
  category: string,
  externalId: string,
  payload: JsonValue,
  observedAt: string,
): Promise<void> {
  const contentHash = await stablePayloadHash(payload);
  if (data.provenance.some((entry) => entry.source.provider === provider && entry.source.category === category && entry.contentHash === contentHash)) return;
  data.provenance.push({ source: { provider, category, externalId }, observedAt, confidence: 1, contentHash });
}

async function fetchWikidataEntity(id: string, context: EnrichmentContext): Promise<{ entity: Record<string, JsonValue>; payload: JsonValue } | undefined> {
  const base = context.options.wikidataEntityBaseUrl ?? WIKIDATA_ENTITY_BASE;
  const raw = await fetchJson(new URL(`${base.replace(/\/$/, "")}/${id}.json`), context);
  if (!raw) return undefined;
  const payload = objectPayload(raw);
  const entities = objectPayload(payload.entities ?? {});
  const entity = objectPayload(entities[id] ?? entities[id.toUpperCase()] ?? {});
  return Object.keys(entity).length ? { entity, payload: raw } : undefined;
}

function localizedValue(container: JsonValue | undefined, language: string): string | undefined {
  const entry = objectPayload(objectPayload(container ?? {})[language] ?? {});
  const value = entry.value;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function addWikidataDescription(data: ZuuidData, entity: Record<string, JsonValue>): void {
  const description = localizedValue(entity.descriptions, "en");
  if (description && !data.descriptions.some((item) => item.value === description)) addDescription(data, "wikidata", description, "en");
}

function englishWikipediaTitle(entity: Record<string, JsonValue>): string | undefined {
  const sitelink = objectPayload(objectPayload(entity.sitelinks ?? {}).enwiki ?? {});
  const title = sitelink.title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

async function enrichWikipediaDescription(data: ZuuidData, entity: Record<string, JsonValue>, context: EnrichmentContext): Promise<void> {
  const title = englishWikipediaTitle(entity);
  if (!title) return;
  const url = new URL(context.options.wikipediaApiBaseUrl ?? ENGLISH_WIKIPEDIA_API_BASE);
  for (const [key, value] of Object.entries({
    action: "query", format: "json", prop: "extracts|info", exintro: "1", explaintext: "1", inprop: "url", redirects: "1", titles: title,
  })) url.searchParams.set(key, value);
  const raw = await fetchJson(url, context);
  if (!raw) return;
  const payload = objectPayload(raw);
  const pages = objectPayload(objectPayload(payload.query ?? {}).pages ?? {});
  const page = Object.values(pages).map(objectPayload).find((value) => typeof value.pageid === "number");
  if (!page) return;
  await addProvenance(data, "wikipedia", "article", title, raw, context.observedAt);
  const extract = typeof page.extract === "string" ? page.extract.trim() : "";
  const canonicalUrl = typeof page.canonicalurl === "string"
    ? page.canonicalurl
    : `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
  if (extract && !data.descriptions.some((item) => item.value === extract)) addDescription(data, "wikipedia", extract, "en");
  addLink(data, "wikipedia", canonicalUrl, "reference", { service: "wikipedia", language: "en" });
  addDetail(data, "wikipedia", "wikipedia", canonicalUrl);
}

function preferredCommonsFilename(entity: Record<string, JsonValue>): string | undefined {
  const claims = objectPayload(entity.claims ?? {});
  const images = Array.isArray(claims.P18) ? claims.P18 : [];
  const ordered = [...images].sort((left, right) => {
    const rank = (value: JsonValue) => objectPayload(value).rank === "preferred" ? 0 : 1;
    return rank(left) - rank(right);
  });
  for (const claim of ordered) {
    const value = objectPayload(objectPayload(objectPayload(claim).mainsnak ?? {}).datavalue ?? {}).value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function metadataValue(metadata: Record<string, JsonValue>, key: string): string | undefined {
  const raw = objectPayload(metadata[key] ?? {}).value;
  return typeof raw === "string" && raw.trim() ? stripHtml(raw) : undefined;
}

async function enrichCommonsImage(data: ZuuidData, entity: Record<string, JsonValue>, wikidataId: string, context: EnrichmentContext): Promise<void> {
  const filename = preferredCommonsFilename(entity);
  if (!filename) return;
  const url = new URL(context.options.commonsApiBaseUrl ?? COMMONS_API_BASE);
  for (const [key, value] of Object.entries({
    action: "query", format: "json", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "900", titles: `File:${filename}`,
  })) url.searchParams.set(key, value);
  const raw = await fetchJson(url, context);
  if (!raw) return;
  const payload = objectPayload(raw);
  const pages = objectPayload(objectPayload(payload.query ?? {}).pages ?? {});
  const page = Object.values(pages).map(objectPayload).find((value) => Array.isArray(value.imageinfo));
  const imageInfo = page && Array.isArray(page.imageinfo) ? objectPayload(page.imageinfo[0] ?? {}) : undefined;
  if (!imageInfo) return;
  const imageUrl = typeof imageInfo.thumburl === "string" ? imageInfo.thumburl : typeof imageInfo.url === "string" ? imageInfo.url : undefined;
  if (!imageUrl) return;
  await addProvenance(data, "wikimedia", "file", filename, raw, context.observedAt);
  const metadata = objectPayload(imageInfo.extmetadata ?? {});
  const sourceUrl = typeof imageInfo.descriptionurl === "string" ? imageInfo.descriptionurl : `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(" ", "_"))}`;
  const width = typeof imageInfo.thumbwidth === "number" ? imageInfo.thumbwidth : typeof imageInfo.width === "number" ? imageInfo.width : undefined;
  const height = typeof imageInfo.thumbheight === "number" ? imageInfo.thumbheight : typeof imageInfo.height === "number" ? imageInfo.height : undefined;
  const attribution: Record<string, JsonValue> = { filename, sourceUrl, wikidataId };
  for (const [target, source] of [["artist", "Artist"], ["credit", "Credit"], ["license", "LicenseShortName"], ["licenseUrl", "LicenseUrl"]] as const) {
    const value = metadataValue(metadata, source);
    if (value) attribution[target] = value;
  }
  const isPrimary = !data.cover;
  data.media.push({
    url: imageUrl,
    mediaType: "image",
    mediaCategory: context.options.mediaCategory ?? "profile",
    isPrimary,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    data: attribution,
    source: "wikimedia",
  });
  if (isPrimary) data.cover = imageUrl;
  addLink(data, "wikimedia", sourceUrl, "reference", { service: "wikimedia_commons" });
  addDetail(data, "wikimedia", "wikimedia_commons", sourceUrl);
}
