import { kindForCategory, type SearchResponse, type ZuuidData, type ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { datePrefix, nestedString, stringField, valueAsString } from "../common.js";
import {
  COMICVINE_API_BASE,
  COMICVINE_CHARACTER_CATEGORY,
  COMICVINE_DEFAULT_USER_AGENT,
  COMICVINE_ISSUE_CATEGORY,
  COMICVINE_PERSON_CATEGORY,
  COMICVINE_PROVIDER,
  COMICVINE_PUBLISHER_CATEGORY,
  COMICVINE_STORY_ARC_CATEGORY,
  COMICVINE_VOLUME_CATEGORY
} from "./constants.js";
import { transformComicVine } from "./transform.js";
import type { ComicVineApiResponse, ComicVineFetchLike, ComicVineProviderOptions, ComicVineSearchInput, FetchComicVineInput } from "./types.js";

const CATEGORY_CONFIG = {
  [COMICVINE_VOLUME_CATEGORY]: { detailPath: "volume", searchResource: "volume", idPrefix: "4050", publicCategory: "comic" },
  [COMICVINE_ISSUE_CATEGORY]: { detailPath: "issue", searchResource: "issue", idPrefix: "4000", publicCategory: "comic" },
  [COMICVINE_STORY_ARC_CATEGORY]: { detailPath: "story_arc", searchResource: "story_arc", idPrefix: "4045", publicCategory: "comic" },
  [COMICVINE_CHARACTER_CATEGORY]: { detailPath: "character", searchResource: "character", idPrefix: "4005", publicCategory: "person" },
  [COMICVINE_PERSON_CATEGORY]: { detailPath: "person", searchResource: "person", idPrefix: "4040", publicCategory: "person" },
  [COMICVINE_PUBLISHER_CATEGORY]: { detailPath: "publisher", searchResource: "publisher", idPrefix: "4010", publicCategory: "organization" }
} as const;

type ComicVineCategory = keyof typeof CATEGORY_CONFIG;

export class ComicVineProvider {
  readonly apiBase: string;
  readonly userAgent: string;
  private readonly apiKey: string;
  private readonly fetchImpl: ComicVineFetchLike;

  constructor(options: ComicVineProviderOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) throw new Error("ComicVine API key must not be empty");
    this.apiBase = options.apiBase ?? COMICVINE_API_BASE;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.userAgent = options.userAgent ?? COMICVINE_DEFAULT_USER_AGENT;
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("format", "json");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await this.fetchImpl(url, { headers: { accept: "application/json", "user-agent": this.userAgent } });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ComicVine API returned ${response.status}: ${body}`);
    }

    const payload = await response.json() as ComicVineApiResponse<T>;
    if (payload.status_code === 101) return undefined;
    if (payload.status_code !== undefined && payload.status_code !== 1) {
      throw new Error(`ComicVine API returned status ${payload.status_code}: ${payload.error ?? "unknown error"}`);
    }
    return payload.results;
  }

  async getEnvelope<T>(path: string, params: Record<string, string>): Promise<ComicVineApiResponse<T>> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("format", "json");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await this.fetchImpl(url, { headers: { accept: "application/json", "user-agent": this.userAgent } });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ComicVine API returned ${response.status}: ${body}`);
    }
    const payload = await response.json() as ComicVineApiResponse<T>;
    if (payload.status_code !== undefined && payload.status_code !== 1) {
      throw new Error(`ComicVine API returned status ${payload.status_code}: ${payload.error ?? "unknown error"}`);
    }
    return payload;
  }

  async fetchVolumeSourceRecord(input: FetchComicVineInput) { return fetchComicVineSourceRecord(this, COMICVINE_VOLUME_CATEGORY, input); }
  async fetchVolume(input: FetchComicVineInput): Promise<ZuuidData | undefined> { const source = await this.fetchVolumeSourceRecord(input); return source ? transformComicVine(source) : undefined; }
  async searchVolumeSourceRecords(input: ComicVineSearchInput) { return searchComicVineSourceRecords(this, COMICVINE_VOLUME_CATEGORY, input); }
  async searchVolumes(input: ComicVineSearchInput) { return searchComicVine(this, COMICVINE_VOLUME_CATEGORY, input); }

  async fetchIssueSourceRecord(input: FetchComicVineInput) { return fetchComicVineSourceRecord(this, COMICVINE_ISSUE_CATEGORY, input); }
  async fetchIssue(input: FetchComicVineInput): Promise<ZuuidData | undefined> { const source = await this.fetchIssueSourceRecord(input); return source ? transformComicVine(source) : undefined; }
  async searchIssueSourceRecords(input: ComicVineSearchInput) { return searchComicVineSourceRecords(this, COMICVINE_ISSUE_CATEGORY, input); }
  async searchIssues(input: ComicVineSearchInput) { return searchComicVine(this, COMICVINE_ISSUE_CATEGORY, input); }

  async fetchStoryArcSourceRecord(input: FetchComicVineInput) { return fetchComicVineSourceRecord(this, COMICVINE_STORY_ARC_CATEGORY, input); }
  async fetchStoryArc(input: FetchComicVineInput): Promise<ZuuidData | undefined> { const source = await this.fetchStoryArcSourceRecord(input); return source ? transformComicVine(source) : undefined; }
  async searchStoryArcSourceRecords(input: ComicVineSearchInput) { return searchComicVineSourceRecords(this, COMICVINE_STORY_ARC_CATEGORY, input); }
  async searchStoryArcs(input: ComicVineSearchInput) { return searchComicVine(this, COMICVINE_STORY_ARC_CATEGORY, input); }

  async fetchCharacterSourceRecord(input: FetchComicVineInput) { return fetchComicVineSourceRecord(this, COMICVINE_CHARACTER_CATEGORY, input); }
  async fetchCharacter(input: FetchComicVineInput): Promise<ZuuidData | undefined> { const source = await this.fetchCharacterSourceRecord(input); return source ? transformComicVine(source) : undefined; }
  async searchCharacterSourceRecords(input: ComicVineSearchInput) { return searchComicVineSourceRecords(this, COMICVINE_CHARACTER_CATEGORY, input); }
  async searchCharacters(input: ComicVineSearchInput) { return searchComicVine(this, COMICVINE_CHARACTER_CATEGORY, input); }

  async fetchPersonSourceRecord(input: FetchComicVineInput) { return fetchComicVineSourceRecord(this, COMICVINE_PERSON_CATEGORY, input); }
  async fetchPerson(input: FetchComicVineInput): Promise<ZuuidData | undefined> { const source = await this.fetchPersonSourceRecord(input); return source ? transformComicVine(source) : undefined; }
  async searchPersonSourceRecords(input: ComicVineSearchInput) { return searchComicVineSourceRecords(this, COMICVINE_PERSON_CATEGORY, input); }
  async searchPeople(input: ComicVineSearchInput) { return searchComicVine(this, COMICVINE_PERSON_CATEGORY, input); }

  async fetchPublisherSourceRecord(input: FetchComicVineInput) { return fetchComicVineSourceRecord(this, COMICVINE_PUBLISHER_CATEGORY, input); }
  async fetchPublisher(input: FetchComicVineInput): Promise<ZuuidData | undefined> { const source = await this.fetchPublisherSourceRecord(input); return source ? transformComicVine(source) : undefined; }
  async searchPublisherSourceRecords(input: ComicVineSearchInput) { return searchComicVineSourceRecords(this, COMICVINE_PUBLISHER_CATEGORY, input); }
  async searchPublishers(input: ComicVineSearchInput) { return searchComicVine(this, COMICVINE_PUBLISHER_CATEGORY, input); }
}

export async function fetchComicVineSourceRecord(provider: ComicVineProvider, category: string, input: FetchComicVineInput): Promise<SourceRecord | undefined> {
  const comicCategory = requireCategory(category);
  const id = comicVineId(input.id);
  const config = CATEGORY_CONFIG[comicCategory];
  const payload = await provider.getJson<JsonValue>(`/${config.detailPath}/${config.idPrefix}-${id}/`, {});
  if (!payload) return undefined;
  return createSourceRecord({ source: { provider: COMICVINE_PROVIDER, category, externalId: id }, payload });
}

export async function searchComicVineSourceRecords(provider: ComicVineProvider, category: string, input: ComicVineSearchInput): Promise<SearchResponse<SourceRecord>> {
  const payload = await searchPayload(provider, category, input);
  const comicCategory = requireCategory(category);
  return {
    results: await Promise.all(searchItems(payload).map((item) => createSourceRecord({ source: { provider: COMICVINE_PROVIDER, category, externalId: resultId(item, comicCategory) ?? "" }, payload: item as JsonValue }))),
    pagination: pagination(payload, input.page)
  };
}

export async function searchComicVine(provider: ComicVineProvider, category: string, input: ComicVineSearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = await searchPayload(provider, category, input);
  const comicCategory = requireCategory(category);
  const results: ZuuidSearchResult[] = [];
  for (const item of searchItems(payload)) {
    const externalId = resultId(item, comicCategory);
    const title = stringField(item, "name") ?? stringField(item, "title");
    if (!externalId || !title) continue;
    const zuuid = await providerZuuid({ provider: COMICVINE_PROVIDER, category, externalId });
    const publicCategory = CATEGORY_CONFIG[comicCategory].publicCategory;
    results.push({
      id: zuuid,
      zuuid,
      category: publicCategory,
      kind: kindForCategory(publicCategory),
      title,
      date: dateFor(item),
      cover: nestedString(item, ["image", "super_url"]) ?? nestedString(item, ["image", "original_url"]) ?? nestedString(item, ["image", "medium_url"]) ?? null,
      rating: null,
      weight: numberValue(item, "score"),
      relationType: null,
      attribute: attributeFor(item, comicCategory),
      order: null,
      source: { source: COMICVINE_PROVIDER, category, value: externalId }
    });
  }
  return { results, pagination: pagination(payload, input.page) };
}

async function searchPayload(provider: ComicVineProvider, category: string, input: ComicVineSearchInput): Promise<ComicVineApiResponse<JsonValue[]>> {
  const comicCategory = requireCategory(category);
  const query = input.query.trim();
  if (!query) throw new Error("ComicVine search query must not be empty");
  return provider.getEnvelope<JsonValue[]>("/search/", {
    query,
    resources: CATEGORY_CONFIG[comicCategory].searchResource,
    limit: String(input.limit ?? 25),
    page: String(input.page ?? 1),
    ...(input.fieldList?.length ? { field_list: input.fieldList.join(",") } : {})
  });
}

function searchItems(payload: ComicVineApiResponse<JsonValue[]>): Record<string, JsonValue>[] {
  return Array.isArray(payload.results) ? payload.results.filter(isObject) : [];
}

function pagination(payload: ComicVineApiResponse<JsonValue[]>, requestedPage = 1) {
  const total = payload.number_of_total_results ?? searchItems(payload).length;
  const limit = payload.limit ?? payload.number_of_page_results ?? searchItems(payload).length;
  return { page: requestedPage, totalPages: limit > 0 ? Math.ceil(total / limit) : 0, totalResults: total };
}

function requireCategory(category: string): ComicVineCategory {
  if (category in CATEGORY_CONFIG) return category as ComicVineCategory;
  throw new Error(`unsupported ComicVine category: ${category}`);
}

function comicVineId(value: string | number): string {
  const id = String(value).trim();
  const normalized = id.includes("-") ? id.split("-").pop() ?? "" : id;
  if (!/^\d+$/.test(normalized)) throw new Error(`ComicVine id must be numeric: ${value}`);
  return normalized;
}

function resultId(item: Record<string, JsonValue>, category: ComicVineCategory): string | undefined {
  const raw = valueAsString(item.id);
  if (!raw) return undefined;
  return raw.startsWith(`${CATEGORY_CONFIG[category].idPrefix}-`) ? raw.slice(CATEGORY_CONFIG[category].idPrefix.length + 1) : raw;
}

function dateFor(item: Record<string, JsonValue>): string | null {
  return datePrefix(stringField(item, "cover_date")) ?? datePrefix(stringField(item, "store_date")) ?? stringField(item, "start_year") ?? null;
}

function attributeFor(item: Record<string, JsonValue>, category: ComicVineCategory): string | null {
  if (category === COMICVINE_ISSUE_CATEGORY) return stringField(item, "issue_number") ?? null;
  if (category === COMICVINE_PERSON_CATEGORY || category === COMICVINE_CHARACTER_CATEGORY) return stringField(item, "real_name") ?? null;
  return stringField(item, "deck") ?? null;
}

function numberValue(item: Record<string, JsonValue>, key: string): number | null {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isObject(value: JsonValue): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
