import type { SearchResponse, ZuuidData } from "../../entity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import {
  addAlias,
  addDescription,
  addDetail,
  addMedia,
  addRelation,
  addTag,
  baseDataFromSource,
  datePrefix,
  finalizeData,
  normalizeRating,
  objectPayload,
  stringField,
  valueAsString
} from "../common.js";
import { IMDB_PROVIDER } from "./constants.js";
import type { ImdbProvider } from "./client.js";
import type { ImdbTransformOptions } from "./types.js";

export type FetchImdbTitleInput = {
  id: string | number;
};

export type ImdbSearchInput = {
  query: string;
};

export async function fetchImdbMovieSourceRecord(provider: ImdbProvider, input: FetchImdbTitleInput): Promise<SourceRecord | undefined> {
  return fetchImdbTitleSourceRecord(provider, input, "movie");
}

export async function fetchImdbTvSourceRecord(provider: ImdbProvider, input: FetchImdbTitleInput): Promise<SourceRecord | undefined> {
  return fetchImdbTitleSourceRecord(provider, input, "tv");
}

export async function transformImdbMovie(source: SourceRecord, options: ImdbTransformOptions = {}): Promise<ZuuidData> {
  return transformImdbTitle(source, "movie", options);
}

export async function transformImdbTv(source: SourceRecord, options: ImdbTransformOptions = {}): Promise<ZuuidData> {
  return transformImdbTitle(source, "tv", options);
}

export async function searchImdbMovies(): Promise<SearchResponse<never>> {
  throw new Error("IMDb search is not implemented; fetch by IMDb title id instead.");
}

async function fetchImdbTitleSourceRecord(provider: ImdbProvider, input: FetchImdbTitleInput, category: "movie" | "tv"): Promise<SourceRecord | undefined> {
  const id = normalizeImdbTitleId(input.id);
  const baseUrl = provider.titleBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("IMDb title base URL is disabled");
  }

  const url = `${baseUrl}/${id}/`;
  const response = await provider.fetcher(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": provider.userAgent
    }
  });

  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`IMDb title request failed with status ${response.status}`);
  }

  const html = await response.text();
  const pagePayload = extractImdbPayload(url, html);
  const suggestion = await fetchSuggestionPayload(provider, id);
  return createSourceRecord({
    source: { provider: IMDB_PROVIDER, category, externalId: id },
    payload: { ...objectPayload(pagePayload), suggestion: suggestion ?? null }
  });
}

async function transformImdbTitle(source: SourceRecord, fallbackCategory: "movie" | "tv", options: ImdbTransformOptions = {}): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const jsonLd = objectPayload(payload.jsonLd ?? {});
  const externalId = normalizeImdbTitleId(source.source.externalId);
  const suggestion = suggestionItem(payload, externalId);
  const category = source.source.category === "tv" || schemaType(jsonLd).includes("TVSeries") || stringField(suggestion, "qid")?.startsWith("tv") ? "tv" : fallbackCategory;
  const title = stringField(jsonLd, "name") ?? stringField(suggestion, "l") ?? fallbackTitle(payload) ?? externalId;
  const data = await baseDataFromSource(source, IMDB_PROVIDER, category, category, externalId, title);

  data.primaryDate = datePrefix(stringField(jsonLd, "datePublished")) ?? suggestionYearDate(suggestion);
  addAlias(data, title, "primary", true, IMDB_PROVIDER);
  addDescription(data, IMDB_PROVIDER, stringField(jsonLd, "description"));
  addMedia(data, IMDB_PROVIDER, stringField(jsonLd, "image") ?? nestedSuggestionImage(suggestion), "poster");

  const aggregateRating = objectPayload(jsonLd.aggregateRating ?? {});
  const nativeRating = numericValue(aggregateRating.ratingValue);
  const normalizedRating = normalizeRating(nativeRating, 0, 10);
  if (normalizedRating !== undefined) {
    data.rating = normalizedRating;
  }
  addDetail(data, IMDB_PROVIDER, "provider_rating", nativeRating);
  addDetail(data, IMDB_PROVIDER, "rating_count", numericValue(aggregateRating.ratingCount));
  addDetail(data, IMDB_PROVIDER, "best_rating", numericValue(aggregateRating.bestRating));
  addDetail(data, IMDB_PROVIDER, "content_rating", stringField(jsonLd, "contentRating"));
  addDetail(data, IMDB_PROVIDER, "duration", stringField(jsonLd, "duration"));
  addDetail(data, IMDB_PROVIDER, "schema_type", valueAsString(jsonLd["@type"]));
  addDetail(data, IMDB_PROVIDER, "url", stringField(payload, "url") ?? imdbTitleUrl(externalId, options.titleBaseUrl));
  addDetail(data, IMDB_PROVIDER, "page_status", payload.challenge === true ? "challenge" : undefined);
  addDetail(data, IMDB_PROVIDER, "imdb_type", stringField(suggestion, "q"));
  addDetail(data, IMDB_PROVIDER, "imdb_type_id", stringField(suggestion, "qid"));
  addDetail(data, IMDB_PROVIDER, "rank", numericValue(suggestion.rank));
  addDetail(data, IMDB_PROVIDER, "year", numericValue(suggestion.y));
  addDetail(data, IMDB_PROVIDER, "cast_summary", stringField(suggestion, "s"));

  for (const genre of stringArray(jsonLd.genre)) {
    addTag(data, genre);
  }

  for (const actor of personArray(jsonLd.actor)) {
    await addPersonRelation(data, actor, "performed_by");
  }
  for (const director of personArray(jsonLd.director)) {
    await addPersonRelation(data, director, "directed_by");
  }
  for (const creator of personArray(jsonLd.creator)) {
    await addPersonRelation(data, creator, "created_by");
  }

  return finalizeData(data, source);
}

function extractImdbPayload(url: string, html: string): JsonValue {
  return {
    url,
    html,
    title: cleanPageTitle(decodeHtml(textFromMatch(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]))) ?? null,
    jsonLd: parseJsonScript(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i) ?? null,
    nextData: parseJsonScript(html, /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i) ?? null,
    challenge: isChallengePage(html)
  };
}

async function fetchSuggestionPayload(provider: ImdbProvider, id: string): Promise<JsonValue | undefined> {
  const baseUrl = provider.suggestionBaseUrl?.replace(/\/$/, "");
  if (!baseUrl) {
    return undefined;
  }
  const bucket = id.slice(0, 1);
  const response = await provider.fetcher(`${baseUrl}/${bucket}/${id}.json`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": provider.userAgent
    }
  });
  if (!response.ok) {
    return undefined;
  }
  return response.json() as Promise<JsonValue>;
}

function isChallengePage(html: string): boolean {
  return html.includes("AwsWafIntegration") || html.includes("awsWafCookieDomainList") || html.includes("challenge-container");
}

function parseJsonScript(html: string, pattern: RegExp): JsonValue | undefined {
  const raw = html.match(pattern)?.[1];
  const text = textFromMatch(raw);
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(decodeHtml(text) ?? text) as JsonValue;
  } catch {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return undefined;
    }
  }
}

function textFromMatch(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeImdbTitleId(value: string | number): string {
  const raw = String(value).trim();
  const withoutUrl = raw.match(/title\/(tt\d+)/i)?.[1] ?? raw;
  const normalized = withoutUrl.toLowerCase().startsWith("tt") ? withoutUrl : `tt${withoutUrl.padStart(7, "0")}`;
  if (!/^tt\d+$/i.test(normalized)) {
    throw new Error(`Invalid IMDb title id: ${value}`);
  }
  return normalized.toLowerCase();
}

function imdbTitleUrl(id: string, titleBaseUrl: string | null | undefined): string | undefined {
  const base = titleBaseUrl?.replace(/\/$/, "");
  return base ? `${base}/${id}/` : undefined;
}

function suggestionItem(payload: Record<string, JsonValue>, externalId: string): Record<string, JsonValue> {
  const suggestion = objectPayload(payload.suggestion ?? {});
  const items = Array.isArray(suggestion.d) ? suggestion.d : [];
  const matched = items.find((item) => item && typeof item === "object" && !Array.isArray(item) && stringField(item as Record<string, JsonValue>, "id") === externalId);
  return matched && typeof matched === "object" && !Array.isArray(matched) ? matched as Record<string, JsonValue> : {};
}

function nestedSuggestionImage(suggestion: Record<string, JsonValue>): string | undefined {
  const image = objectPayload(suggestion.i ?? {});
  return stringField(image, "imageUrl");
}

function suggestionYearDate(suggestion: Record<string, JsonValue>): string | undefined {
  const year = numericValue(suggestion.y);
  return year ? `${Math.trunc(year)}-01-01` : undefined;
}

function schemaType(jsonLd: Record<string, JsonValue>): string {
  const value = jsonLd["@type"];
  return Array.isArray(value) ? value.map((item) => valueAsString(item)).filter(Boolean).join(",") : valueAsString(value) ?? "";
}

function fallbackTitle(payload: Record<string, JsonValue>): string | undefined {
  return cleanPageTitle(stringField(payload, "title"));
}

function cleanPageTitle(title: string | undefined): string | undefined {
  return title?.replace(/\s*-\s*IMDb\s*$/i, "").trim() || undefined;
}

function numericValue(value: JsonValue | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stringArray(value: JsonValue | undefined): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  return [];
}

function personArray(value: JsonValue | undefined): Record<string, JsonValue>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, JsonValue> => !!item && typeof item === "object" && !Array.isArray(item));
  }
  return value && typeof value === "object" && !Array.isArray(value) ? [value as Record<string, JsonValue>] : [];
}

async function addPersonRelation(data: ZuuidData, person: Record<string, JsonValue>, relationType: string): Promise<void> {
  const name = stringField(person, "name");
  const externalId = imdbNameId(stringField(person, "url"));
  if (!name || !externalId) {
    return;
  }
  await addRelation(data, IMDB_PROVIDER, "person", externalId, relationType, name);
}

function imdbNameId(url: string | undefined): string | undefined {
  return url?.match(/name\/(nm\d+)/i)?.[1]?.toLowerCase();
}

function decodeHtml(value: string | undefined): string | undefined {
  return value
    ?.replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
