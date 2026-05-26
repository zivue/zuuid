import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { datePrefix, nestedString, objectPayload, stringField, valueAsString } from "../common.js";
import {
  MUSICBRAINZ_API_BASE,
  MUSICBRAINZ_ARTIST_CATEGORY,
  MUSICBRAINZ_COVER_ART_BASE_URL,
  MUSICBRAINZ_DEFAULT_USER_AGENT,
  MUSICBRAINZ_LABEL_CATEGORY,
  MUSICBRAINZ_PROVIDER,
  MUSICBRAINZ_RECORDING_CATEGORY,
  MUSICBRAINZ_RELEASE_CATEGORY,
  MUSICBRAINZ_RELEASE_GROUP_CATEGORY,
  MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL,
  MUSICBRAINZ_WORK_CATEGORY
} from "./constants.js";
import { transformMusicBrainzArtist } from "./artist.js";
import { transformMusicBrainzLabel } from "./label.js";
import { transformMusicBrainzRecording } from "./recording.js";
import { transformMusicBrainzRelease } from "./release.js";
import { transformMusicBrainzReleaseGroup } from "./release-group.js";
import { transformMusicBrainzWork } from "./work.js";
import type { FetchMusicBrainzInput, MusicBrainzFetchLike, MusicBrainzProviderOptions, MusicBrainzSearchInput, MusicBrainzProviderTransformOptions } from "./types.js";

export class MusicBrainzProvider {
  readonly apiBase: string;
  readonly coverArtBaseUrl: string | null;
  readonly releaseGroupCoverArtBaseUrl: string | null;
  readonly userAgent: string;
  private readonly fetchImpl: MusicBrainzFetchLike;

  constructor(options: MusicBrainzProviderOptions = {}) {
    this.apiBase = options.apiBase ?? MUSICBRAINZ_API_BASE;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.coverArtBaseUrl = options.coverArtBaseUrl === undefined ? MUSICBRAINZ_COVER_ART_BASE_URL : options.coverArtBaseUrl;
    this.releaseGroupCoverArtBaseUrl = options.releaseGroupCoverArtBaseUrl === undefined ? MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL : options.releaseGroupCoverArtBaseUrl;
    this.userAgent = options.userAgent ?? MUSICBRAINZ_DEFAULT_USER_AGENT;
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    url.searchParams.set("fmt", "json");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.fetchImpl(url, { headers: { accept: "application/json", "user-agent": this.userAgent } });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`MusicBrainz API returned ${response.status}: ${body}`);
    }
    return response.json() as Promise<T>;
  }

  transformOptions(): MusicBrainzProviderTransformOptions {
    return { coverArtBaseUrl: this.coverArtBaseUrl, releaseGroupCoverArtBaseUrl: this.releaseGroupCoverArtBaseUrl };
  }

  async fetchReleaseSourceRecord(input: FetchMusicBrainzInput) { return fetchMusicBrainzSourceRecord(this, MUSICBRAINZ_RELEASE_CATEGORY, input); }
  async fetchRelease(input: FetchMusicBrainzInput): Promise<ZuuidData | undefined> { const source = await this.fetchReleaseSourceRecord(input); return source ? transformMusicBrainzRelease(source, this.transformOptions()) : undefined; }
  async searchReleaseSourceRecords(input: MusicBrainzSearchInput) { return searchMusicBrainzSourceRecords(this, MUSICBRAINZ_RELEASE_CATEGORY, input); }
  async searchReleases(input: MusicBrainzSearchInput) { return searchMusicBrainz(this, MUSICBRAINZ_RELEASE_CATEGORY, input, this.transformOptions()); }

  async fetchReleaseGroupSourceRecord(input: FetchMusicBrainzInput) { return fetchMusicBrainzSourceRecord(this, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, input); }
  async fetchReleaseGroup(input: FetchMusicBrainzInput): Promise<ZuuidData | undefined> { const source = await this.fetchReleaseGroupSourceRecord(input); return source ? transformMusicBrainzReleaseGroup(source, { coverArtBaseUrl: this.releaseGroupCoverArtBaseUrl }) : undefined; }
  async searchReleaseGroupSourceRecords(input: MusicBrainzSearchInput) { return searchMusicBrainzSourceRecords(this, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, input); }
  async searchReleaseGroups(input: MusicBrainzSearchInput) { return searchMusicBrainz(this, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, input, this.transformOptions()); }

  async fetchRecordingSourceRecord(input: FetchMusicBrainzInput) { return fetchMusicBrainzSourceRecord(this, MUSICBRAINZ_RECORDING_CATEGORY, input); }
  async fetchRecording(input: FetchMusicBrainzInput): Promise<ZuuidData | undefined> { const source = await this.fetchRecordingSourceRecord(input); return source ? transformMusicBrainzRecording(source) : undefined; }
  async searchRecordingSourceRecords(input: MusicBrainzSearchInput) { return searchMusicBrainzSourceRecords(this, MUSICBRAINZ_RECORDING_CATEGORY, input); }
  async searchRecordings(input: MusicBrainzSearchInput) { return searchMusicBrainz(this, MUSICBRAINZ_RECORDING_CATEGORY, input, this.transformOptions()); }

  async fetchArtistSourceRecord(input: FetchMusicBrainzInput) { return fetchMusicBrainzSourceRecord(this, MUSICBRAINZ_ARTIST_CATEGORY, input); }
  async fetchArtist(input: FetchMusicBrainzInput): Promise<ZuuidData | undefined> { const source = await this.fetchArtistSourceRecord(input); return source ? transformMusicBrainzArtist(source) : undefined; }
  async searchArtistSourceRecords(input: MusicBrainzSearchInput) { return searchMusicBrainzSourceRecords(this, MUSICBRAINZ_ARTIST_CATEGORY, input); }
  async searchArtists(input: MusicBrainzSearchInput) { return searchMusicBrainz(this, MUSICBRAINZ_ARTIST_CATEGORY, input, this.transformOptions()); }

  async fetchLabelSourceRecord(input: FetchMusicBrainzInput) { return fetchMusicBrainzSourceRecord(this, MUSICBRAINZ_LABEL_CATEGORY, input); }
  async fetchLabel(input: FetchMusicBrainzInput): Promise<ZuuidData | undefined> { const source = await this.fetchLabelSourceRecord(input); return source ? transformMusicBrainzLabel(source) : undefined; }
  async searchLabelSourceRecords(input: MusicBrainzSearchInput) { return searchMusicBrainzSourceRecords(this, MUSICBRAINZ_LABEL_CATEGORY, input); }
  async searchLabels(input: MusicBrainzSearchInput) { return searchMusicBrainz(this, MUSICBRAINZ_LABEL_CATEGORY, input, this.transformOptions()); }

  async fetchWorkSourceRecord(input: FetchMusicBrainzInput) { return fetchMusicBrainzSourceRecord(this, MUSICBRAINZ_WORK_CATEGORY, input); }
  async fetchWork(input: FetchMusicBrainzInput): Promise<ZuuidData | undefined> { const source = await this.fetchWorkSourceRecord(input); return source ? transformMusicBrainzWork(source) : undefined; }
  async searchWorkSourceRecords(input: MusicBrainzSearchInput) { return searchMusicBrainzSourceRecords(this, MUSICBRAINZ_WORK_CATEGORY, input); }
  async searchWorks(input: MusicBrainzSearchInput) { return searchMusicBrainz(this, MUSICBRAINZ_WORK_CATEGORY, input, this.transformOptions()); }
}

export async function fetchMusicBrainzSourceRecord(provider: MusicBrainzProvider, category: string, input: FetchMusicBrainzInput): Promise<SourceRecord | undefined> {
  const id = musicBrainzId(input.id);
  const payload = await provider.getJson<JsonValue>(`/${entityPath(category)}/${id}`, { inc: lookupIncludes(category) });
  if (!payload) return undefined;
  return createSourceRecord({ source: { provider: MUSICBRAINZ_PROVIDER, category, externalId: id }, payload });
}

export async function searchMusicBrainzSourceRecords(provider: MusicBrainzProvider, category: string, input: MusicBrainzSearchInput): Promise<SearchResponse<SourceRecord>> {
  const payload = await searchPayload(provider, category, input);
  const results = searchItems(payload, category);
  return {
    results: await Promise.all(results.map((item) => createSourceRecord({ source: { provider: MUSICBRAINZ_PROVIDER, category, externalId: stringField(item, "id") ?? "" }, payload: item as JsonValue }))),
    pagination: pagination(payload)
  };
}

export async function searchMusicBrainz(provider: MusicBrainzProvider, category: string, input: MusicBrainzSearchInput, options: MusicBrainzProviderTransformOptions = {}): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = await searchPayload(provider, category, input);
  const results: ZuuidSearchResult[] = [];
  for (const item of searchItems(payload, category)) {
    const externalId = stringField(item, "id");
    const title = titleFor(item, category);
    if (!externalId || !title) continue;
    const zuuid = await providerZuuid({ provider: MUSICBRAINZ_PROVIDER, category, externalId });
    results.push({
      id: zuuid,
      zuuid,
      category: publicCategory(category),
      title,
      date: dateFor(item, category),
      cover: coverFor(item, category, options),
      rating: null,
      weight: numberValue(item.score),
      relationType: null,
      attribute: attributeFor(item, category),
      order: null,
      source: { source: MUSICBRAINZ_PROVIDER, category, value: externalId }
    });
  }
  return { results, pagination: pagination(payload) };
}

async function searchPayload(provider: MusicBrainzProvider, category: string, input: MusicBrainzSearchInput): Promise<Record<string, JsonValue>> {
  const query = input.query.trim();
  if (!query) throw new Error("MusicBrainz search query must not be empty");
  return objectPayload(await provider.getJson<JsonValue>(`/${entityPath(category)}`, {
    query,
    limit: String(input.limit ?? 25),
    offset: String(input.offset ?? 0)
  }) ?? {});
}

function searchItems(payload: Record<string, JsonValue>, category: string): Record<string, JsonValue>[] {
  const value = payload[searchKey(category)];
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function pagination(payload: Record<string, JsonValue>) {
  const count = numberValue(payload.count) ?? 0;
  const offset = numberValue(payload.offset) ?? 0;
  const limit = Array.isArray(payload[searchKeyFromPayload(payload)]) ? (payload[searchKeyFromPayload(payload)] as JsonValue[]).length : 0;
  return { page: limit > 0 ? Math.floor(offset / limit) + 1 : 1, totalPages: limit > 0 ? Math.ceil(count / limit) : 0, totalResults: count };
}

function searchKeyFromPayload(payload: Record<string, JsonValue>): string {
  return ["releases", "release-groups", "recordings", "artists", "labels", "works"].find((key) => Array.isArray(payload[key])) ?? "";
}

function lookupIncludes(category: string): string {
  switch (category) {
    case MUSICBRAINZ_RELEASE_CATEGORY:
      return "artists+labels+release-groups+media+recordings+genres+tags+url-rels";
    case MUSICBRAINZ_RELEASE_GROUP_CATEGORY:
      return "artists+releases+genres+tags+url-rels";
    case MUSICBRAINZ_RECORDING_CATEGORY:
      return "artists+releases+isrcs+genres+tags+work-rels+url-rels";
    case MUSICBRAINZ_ARTIST_CATEGORY:
      return "aliases+annotation+genres+tags+area-rels+url-rels";
    case MUSICBRAINZ_LABEL_CATEGORY:
      return "aliases+annotation+genres+tags+area-rels+url-rels";
    case MUSICBRAINZ_WORK_CATEGORY:
      return "aliases+annotation+genres+tags+artist-rels+url-rels";
    default:
      return "genres+tags";
  }
}

function entityPath(category: string): string { return category === MUSICBRAINZ_RELEASE_GROUP_CATEGORY ? "release-group" : category; }
function searchKey(category: string): string { return category === MUSICBRAINZ_RELEASE_GROUP_CATEGORY ? "release-groups" : `${category}s`; }
function publicCategory(category: string): string { return category === MUSICBRAINZ_RELEASE_GROUP_CATEGORY ? "release_group" : category === MUSICBRAINZ_WORK_CATEGORY ? "musical_work" : category; }
function titleFor(item: Record<string, JsonValue>, category: string): string | undefined { return category === MUSICBRAINZ_ARTIST_CATEGORY || category === MUSICBRAINZ_LABEL_CATEGORY ? stringField(item, "name") : stringField(item, "title"); }
function dateFor(item: Record<string, JsonValue>, category: string): string | null { return (category === MUSICBRAINZ_RELEASE_GROUP_CATEGORY ? stringField(item, "first-release-date") : category === MUSICBRAINZ_RECORDING_CATEGORY ? stringField(item, "first-release-date") : category === MUSICBRAINZ_ARTIST_CATEGORY || category === MUSICBRAINZ_LABEL_CATEGORY ? nestedString(item, ["life-span", "begin"]) : stringField(item, "date")) ?? null; }
function attributeFor(item: Record<string, JsonValue>, category: string): string | null { return category === MUSICBRAINZ_ARTIST_CATEGORY || category === MUSICBRAINZ_LABEL_CATEGORY || category === MUSICBRAINZ_WORK_CATEGORY ? stringField(item, "type") ?? null : stringField(item, "primary-type") ?? stringField(item, "status") ?? null; }
function coverFor(item: Record<string, JsonValue>, category: string, options: MusicBrainzProviderTransformOptions): string | null { const id = stringField(item, "id"); if (!id) return null; if (category === MUSICBRAINZ_RELEASE_GROUP_CATEGORY && options.releaseGroupCoverArtBaseUrl) return `${options.releaseGroupCoverArtBaseUrl.replace(/\/$/, "")}/${id}/front`; if (category === MUSICBRAINZ_RELEASE_CATEGORY && options.coverArtBaseUrl && objectPayload(item["cover-art-archive"] ?? {}).front === true) return `${options.coverArtBaseUrl.replace(/\/$/, "")}/${id}/front`; return null; }
function numberValue(value: JsonValue | undefined): number | null { if (typeof value === "number" && Number.isFinite(value)) return value; if (typeof value === "string") { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; } return null; }
function isObject(value: JsonValue): value is Record<string, JsonValue> { return !!value && typeof value === "object" && !Array.isArray(value); }

function musicBrainzId(value: string): string {
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error(`Invalid MusicBrainz MBID: ${value}`);
  return id.toLowerCase();
}
