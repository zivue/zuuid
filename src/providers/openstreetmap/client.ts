import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { nestedString, normalizeRating, objectPayload, stringField, valueAsString } from "../common.js";
import {
  OPENSTREETMAP_API_BASE,
  OPENSTREETMAP_CITY_CATEGORY,
  OPENSTREETMAP_COUNTRY_CATEGORY,
  OPENSTREETMAP_DEFAULT_USER_AGENT,
  OPENSTREETMAP_PLACE_CATEGORY,
  OPENSTREETMAP_PROVIDER,
  OPENSTREETMAP_VENUE_CATEGORY
} from "./constants.js";
import { transformOpenStreetMapPlace } from "./place.js";
import type { FetchOpenStreetMapInput, OpenStreetMapFetchLike, OpenStreetMapProviderOptions, OpenStreetMapSearchInput } from "./types.js";

const CATEGORIES = [OPENSTREETMAP_CITY_CATEGORY, OPENSTREETMAP_COUNTRY_CATEGORY, OPENSTREETMAP_PLACE_CATEGORY, OPENSTREETMAP_VENUE_CATEGORY] as const;
type OpenStreetMapCategory = typeof CATEGORIES[number];

export class OpenStreetMapProvider {
  readonly apiBase: string;
  readonly userAgent: string;
  readonly language: string;
  private readonly fetchImpl: OpenStreetMapFetchLike;

  constructor(options: OpenStreetMapProviderOptions = {}) {
    this.apiBase = options.apiBase ?? OPENSTREETMAP_API_BASE;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.userAgent = options.userAgent ?? OPENSTREETMAP_DEFAULT_USER_AGENT;
    this.language = options.language ?? "en-US,en;q=0.9";
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.fetchImpl(url, { headers: { accept: "application/json", "accept-language": this.language, "user-agent": this.userAgent } });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenStreetMap API returned ${response.status}: ${body}`);
    }
    return response.json() as Promise<T>;
  }

  async fetchCitySourceRecord(input: FetchOpenStreetMapInput) { return fetchOpenStreetMapSourceRecord(this, OPENSTREETMAP_CITY_CATEGORY, input); }
  async fetchCity(input: FetchOpenStreetMapInput): Promise<ZuuidData | undefined> { const source = await this.fetchCitySourceRecord(input); return source ? transformOpenStreetMapPlace(source) : undefined; }
  async searchCitySourceRecords(input: OpenStreetMapSearchInput) { return searchOpenStreetMapSourceRecords(this, OPENSTREETMAP_CITY_CATEGORY, input); }
  async searchCities(input: OpenStreetMapSearchInput) { return searchOpenStreetMap(this, OPENSTREETMAP_CITY_CATEGORY, input); }

  async fetchCountrySourceRecord(input: FetchOpenStreetMapInput) { return fetchOpenStreetMapSourceRecord(this, OPENSTREETMAP_COUNTRY_CATEGORY, input); }
  async fetchCountry(input: FetchOpenStreetMapInput): Promise<ZuuidData | undefined> { const source = await this.fetchCountrySourceRecord(input); return source ? transformOpenStreetMapPlace(source) : undefined; }
  async searchCountrySourceRecords(input: OpenStreetMapSearchInput) { return searchOpenStreetMapSourceRecords(this, OPENSTREETMAP_COUNTRY_CATEGORY, input); }
  async searchCountries(input: OpenStreetMapSearchInput) { return searchOpenStreetMap(this, OPENSTREETMAP_COUNTRY_CATEGORY, input); }

  async fetchPlaceSourceRecord(input: FetchOpenStreetMapInput) { return fetchOpenStreetMapSourceRecord(this, OPENSTREETMAP_PLACE_CATEGORY, input); }
  async fetchPlace(input: FetchOpenStreetMapInput): Promise<ZuuidData | undefined> { const source = await this.fetchPlaceSourceRecord(input); return source ? transformOpenStreetMapPlace(source) : undefined; }
  async searchPlaceSourceRecords(input: OpenStreetMapSearchInput) { return searchOpenStreetMapSourceRecords(this, OPENSTREETMAP_PLACE_CATEGORY, input); }
  async searchPlaces(input: OpenStreetMapSearchInput) { return searchOpenStreetMap(this, OPENSTREETMAP_PLACE_CATEGORY, input); }

  async fetchVenueSourceRecord(input: FetchOpenStreetMapInput) { return fetchOpenStreetMapSourceRecord(this, OPENSTREETMAP_VENUE_CATEGORY, input); }
  async fetchVenue(input: FetchOpenStreetMapInput): Promise<ZuuidData | undefined> { const source = await this.fetchVenueSourceRecord(input); return source ? transformOpenStreetMapPlace(source) : undefined; }
  async searchVenueSourceRecords(input: OpenStreetMapSearchInput) { return searchOpenStreetMapSourceRecords(this, OPENSTREETMAP_VENUE_CATEGORY, input); }
  async searchVenues(input: OpenStreetMapSearchInput) { return searchOpenStreetMap(this, OPENSTREETMAP_VENUE_CATEGORY, input); }
}

export async function fetchOpenStreetMapSourceRecord(provider: OpenStreetMapProvider, category: string, input: FetchOpenStreetMapInput): Promise<SourceRecord | undefined> {
  const osmId = normalizeOsmId(input.id);
  const payload = await provider.getJson<JsonValue[]>("/lookup", {
    osm_ids: osmId,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1"
  });
  const item = Array.isArray(payload) ? payload.find(isObject) : undefined;
  if (!item) return undefined;
  return createSourceRecord({ source: { provider: OPENSTREETMAP_PROVIDER, category: requireCategory(category), externalId: osmId }, payload: item });
}

export async function searchOpenStreetMapSourceRecords(provider: OpenStreetMapProvider, category: string, input: OpenStreetMapSearchInput): Promise<SearchResponse<SourceRecord>> {
  const items = await searchPayload(provider, input);
  const normalizedCategory = requireCategory(category);
  return {
    results: await Promise.all(items.map((item) => createSourceRecord({ source: { provider: OPENSTREETMAP_PROVIDER, category: normalizedCategory, externalId: osmExternalId(item) ?? valueAsString(item.place_id) ?? "" }, payload: item as JsonValue }))),
    pagination: pagination(items, input.limit)
  };
}

export async function searchOpenStreetMap(provider: OpenStreetMapProvider, category: string, input: OpenStreetMapSearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
  const items = await searchPayload(provider, input);
  const normalizedCategory = requireCategory(category);
  const results: ZuuidSearchResult[] = [];
  for (const item of items) {
    const externalId = osmExternalId(item) ?? valueAsString(item.place_id);
    const title = stringField(item, "name") ?? stringField(item, "display_name");
    if (!externalId || !title) continue;
    const zuuid = await providerZuuid({ provider: OPENSTREETMAP_PROVIDER, category: normalizedCategory, externalId });
    results.push({
      id: zuuid,
      zuuid,
      category: normalizedCategory,
      title,
      date: null,
      cover: stringField(item, "icon") ?? null,
      rating: normalizeRating(typeof item.importance === "number" ? item.importance : undefined, 0, 1) ?? null,
      weight: typeof item.importance === "number" ? item.importance : null,
      relationType: null,
      attribute: [stringField(item, "class"), stringField(item, "type")].filter(Boolean).join(":") || null,
      order: null,
      source: { source: OPENSTREETMAP_PROVIDER, category: normalizedCategory, value: externalId }
    });
  }
  return { results, pagination: pagination(items, input.limit) };
}

async function searchPayload(provider: OpenStreetMapProvider, input: OpenStreetMapSearchInput): Promise<Record<string, JsonValue>[]> {
  const query = input.query.trim();
  if (!query) throw new Error("OpenStreetMap search query must not be empty");
  const payload = await provider.getJson<JsonValue[]>("/search", {
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    limit: String(input.limit ?? 10),
    ...(input.language ? { "accept-language": input.language } : {})
  });
  return Array.isArray(payload) ? payload.filter(isObject) : [];
}

function pagination(items: Record<string, JsonValue>[], limit: number | undefined) {
  const pageSize = limit ?? items.length;
  return { page: 1, totalPages: pageSize > 0 && items.length > 0 ? 1 : 0, totalResults: items.length };
}

function normalizeOsmId(value: string | number): string {
  const raw = String(value).trim();
  const prefixed = raw.match(/^([NWR])\s*(\d+)$/i);
  if (prefixed) return `${prefixed[1].toUpperCase()}${prefixed[2]}`;
  const typed = raw.match(/^(node|way|relation)[-:\s]*(\d+)$/i);
  if (typed) return `${typePrefix(typed[1])}${typed[2]}`;
  if (/^\d+$/.test(raw)) throw new Error(`OpenStreetMap id must include an OSM type prefix N, W, or R: ${value}`);
  throw new Error(`Invalid OpenStreetMap id: ${value}`);
}

function typePrefix(value: string): string {
  const normalized = value.toLowerCase();
  return normalized === "node" ? "N" : normalized === "way" ? "W" : "R";
}

function osmExternalId(payload: Record<string, JsonValue>): string | undefined {
  const osmType = stringField(payload, "osm_type");
  const id = valueAsString(payload.osm_id);
  if (!osmType || !id) return undefined;
  return `${typePrefix(osmType)}${id}`;
}

function requireCategory(category: string): OpenStreetMapCategory {
  if ((CATEGORIES as readonly string[]).includes(category)) return category as OpenStreetMapCategory;
  throw new Error(`unsupported OpenStreetMap category: ${category}`);
}

function isObject(value: JsonValue): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
