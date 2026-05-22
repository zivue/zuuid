import { createZuuidData, type SearchResponse, type ZuuidData, type ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { attachSourceMetadata, createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { TMDB_POSTER_BASE_URL, TMDB_PROVIDER } from "./constants.js";
import type { TmdbProvider } from "./client.js";
import type { TmdbSearchInput, TmdbSearchResponse, TmdbTransformOptions } from "./types.js";

export const TMDB_PERSON_CATEGORY = "person";
export const ZUUID_PERSON_CATEGORY = "person";

export type FetchTmdbPersonInput = {
  id: string | number;
};

export type TmdbPersonPayload = {
  adult?: boolean;
  also_known_as?: string[];
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  gender?: number;
  homepage?: string | null;
  id?: number | string;
  imdb_id?: string | null;
  known_for_department?: string;
  name?: string;
  place_of_birth?: string | null;
  popularity?: number;
  profile_path?: string | null;
  external_ids?: {
    imdb_id?: string | null;
    wikidata_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
    tiktok_id?: string | null;
    youtube_id?: string | null;
  };
  combined_credits?: {
    cast?: TmdbPersonCredit[];
    crew?: TmdbPersonCredit[];
  };
  images?: {
    profiles?: TmdbPersonImage[];
  };
};

export type TmdbPersonCredit = {
  id?: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  media_type?: string;
  character?: string;
  job?: string;
  department?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  credit_id?: string;
  episode_count?: number;
  order?: number;
};

export type TmdbPersonImage = {
  file_path?: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  vote_average?: number;
  vote_count?: number;
};

export type TmdbPersonSearchResult = {
  adult?: boolean;
  gender?: number;
  id?: number;
  known_for?: JsonValue[];
  known_for_department?: string;
  name?: string;
  original_name?: string;
  popularity?: number;
  profile_path?: string | null;
};

export async function fetchTmdbPersonSourceRecord(
  provider: TmdbProvider,
  input: FetchTmdbPersonInput
): Promise<SourceRecord | undefined> {
  const id = String(input.id).trim();
  if (!id) {
    throw new Error("TMDB person id must not be empty");
  }
  if (!/^\d+$/.test(id)) {
    throw new Error(`TMDB person id must be numeric: ${id}`);
  }

  const payload = await provider.getJson<TmdbPersonPayload>(`/person/${id}`, {
    language: provider.language,
    append_to_response: "combined_credits,external_ids,images"
  });

  if (!payload) {
    return undefined;
  }

  return createSourceRecord({
    source: { provider: TMDB_PROVIDER, category: TMDB_PERSON_CATEGORY, externalId: id },
    payload: payload as JsonValue
  });
}

export async function searchTmdbPersonSourceRecords(
  provider: TmdbProvider,
  input: TmdbSearchInput
): Promise<SearchResponse<SourceRecord>> {
  const payload = await fetchTmdbPersonSearchResults(provider, input);
  return {
    results: await sourceRecordsFromSearchResults(TMDB_PERSON_CATEGORY, payload.results),
    pagination: paginationFromTmdbSearchResponse(payload)
  };
}

export async function searchTmdbPeople(
  provider: TmdbProvider,
  input: TmdbSearchInput,
  options: TmdbTransformOptions = {}
): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = await fetchTmdbPersonSearchResults(provider, input);
  const searchResults: ZuuidSearchResult[] = [];

  for (const result of payload.results ?? []) {
    if (!result.id) {
      continue;
    }
    const externalId = String(result.id);
    const title = stringField(result.name) ?? stringField(result.original_name);
    if (!title) {
      continue;
    }
    const zuuid = await providerZuuid({ provider: TMDB_PROVIDER, category: TMDB_PERSON_CATEGORY, externalId });
    searchResults.push({
      id: zuuid,
      zuuid,
      category: ZUUID_PERSON_CATEGORY,
      title,
      date: null,
      cover: mediaUrl(result.profile_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL) ?? null,
      rating: null,
      weight: typeof result.popularity === "number" ? result.popularity : null,
      relationType: null,
      attribute: stringField(result.known_for_department) ?? null,
      order: null,
      source: { source: TMDB_PROVIDER, category: TMDB_PERSON_CATEGORY, value: externalId }
    });
  }

  return {
    results: searchResults,
    pagination: paginationFromTmdbSearchResponse(payload)
  };
}

async function fetchTmdbPersonSearchResults(
  provider: TmdbProvider,
  input: TmdbSearchInput
): Promise<TmdbSearchResponse<TmdbPersonSearchResult>> {
  const query = searchQuery(input.query, "TMDB person search query");
  const payload = await provider.getJson<TmdbSearchResponse<TmdbPersonSearchResult>>("/search/person", {
    ...searchParams(provider, input),
    query
  });

  return payload ?? {};
}

export async function transformTmdbPerson(
  source: SourceRecord,
  options: TmdbTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== TMDB_PROVIDER || source.source.category !== TMDB_PERSON_CATEGORY) {
    throw new Error(`unsupported TMDB source: ${source.source.provider}:${source.source.category}`);
  }

  const payload = source.payload as TmdbPersonPayload;
  const tmdbId = tmdbPersonId(source, payload);
  const name = stringField(payload.name);
  if (!name) {
    throw new Error("missing required TMDB person field: name");
  }

  const zuuid = await providerZuuid({
    provider: TMDB_PROVIDER,
    category: TMDB_PERSON_CATEGORY,
    externalId: tmdbId
  });
  const data = createZuuidData({ zuuid, category: ZUUID_PERSON_CATEGORY, primaryTitle: name });

  const birthday = stringField(payload.birthday ?? undefined);
  if (birthday) {
    validateDate(birthday, "birthday");
    data.primaryDate = birthday;
  }

  const biography = stringField(payload.biography);
  if (biography) {
    data.descriptions.push({ value: biography, source: TMDB_PROVIDER });
  }

  for (const alias of payload.also_known_as ?? []) {
    const value = stringField(alias);
    if (value && value !== name && !data.aliases.some((item) => item.value === value)) {
      data.aliases.push({ value, aliasType: "also_known_as", isPrimary: false, source: TMDB_PROVIDER });
    }
  }

  addExternalIds(data, payload);
  addImage(data, "profile", payload.profile_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, true);
  addImages(data, payload, options);
  data.cover = data.media.find((media) => media.mediaCategory === "profile")?.url;

  addDetail(data, "known_for_department", payload.known_for_department);
  addDetail(data, "birthday", payload.birthday ?? undefined);
  addDetail(data, "deathday", payload.deathday ?? undefined);
  addDetail(data, "place_of_birth", payload.place_of_birth ?? undefined);
  addDetail(data, "homepage", payload.homepage ?? undefined);
  addNumberDetail(data, "gender", payload.gender);
  addNumberDetail(data, "popularity", payload.popularity);
  addBooleanDetail(data, "adult", payload.adult);

  await addCombinedCredits(data, payload, options);

  return attachSourceMetadata(data, source);
}

function tmdbPersonId(source: SourceRecord, payload: TmdbPersonPayload): string {
  const sourceId = source.source.externalId.trim();
  if (sourceId) {
    return sourceId;
  }
  const payloadId = payload.id === undefined ? undefined : String(payload.id).trim();
  if (payloadId) {
    return payloadId;
  }
  throw new Error("missing required TMDB person field: id");
}

function addExternalIds(data: ZuuidData, payload: TmdbPersonPayload): void {
  const ids = payload.external_ids ?? {};
  addExternalId(data, "imdb", ZUUID_PERSON_CATEGORY, stringField(ids.imdb_id ?? payload.imdb_id ?? undefined));
  addExternalId(data, "wikidata", ZUUID_PERSON_CATEGORY, stringField(ids.wikidata_id ?? undefined));
  addExternalId(data, "facebook", ZUUID_PERSON_CATEGORY, stringField(ids.facebook_id ?? undefined));
  addExternalId(data, "instagram", ZUUID_PERSON_CATEGORY, stringField(ids.instagram_id ?? undefined));
  addExternalId(data, "twitter", ZUUID_PERSON_CATEGORY, stringField(ids.twitter_id ?? undefined));
  addExternalId(data, "tiktok", ZUUID_PERSON_CATEGORY, stringField(ids.tiktok_id ?? undefined));
  addExternalId(data, "youtube", ZUUID_PERSON_CATEGORY, stringField(ids.youtube_id ?? undefined));
}

function addExternalId(data: ZuuidData, source: string, category: string, value: string | undefined): void {
  if (!value || data.externalIds.some((id) => id.source === source && id.category === category && id.value === value)) {
    return;
  }
  data.externalIds.push({ source, category, value });
}

function addImages(data: ZuuidData, payload: TmdbPersonPayload, options: TmdbTransformOptions): void {
  for (const image of payload.images?.profiles ?? []) {
    addImage(data, "profile", image.file_path, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, false, image);
  }
}

function addImage(
  data: ZuuidData,
  mediaCategory: string,
  path: string | undefined,
  baseUrl: string | null,
  isPrimary: boolean,
  image?: TmdbPersonImage
): void {
  const url = mediaUrl(path, baseUrl);
  if (!url || data.media.some((media) => media.mediaCategory === mediaCategory && media.url === url)) {
    if (isPrimary) {
      const existing = data.media.find((media) => media.mediaCategory === mediaCategory && media.url === url);
      if (existing) {
        existing.isPrimary = true;
      }
    }
    return;
  }

  data.media.push({
    url,
    mediaType: "image",
    mediaCategory,
    width: image?.width,
    height: image?.height,
    isPrimary,
    data: compactImageData(image),
    source: TMDB_PROVIDER
  });
}

async function addCombinedCredits(
  data: ZuuidData,
  payload: TmdbPersonPayload,
  options: TmdbTransformOptions
): Promise<void> {
  for (const [index, credit] of (payload.combined_credits?.cast ?? []).entries()) {
    await addCreditRelation(data, credit, "appears_in", credit.character, index, options);
  }
  for (const [index, credit] of (payload.combined_credits?.crew ?? []).entries()) {
    await addCreditRelation(data, credit, relationForCrewJob(credit.job ?? credit.department), credit.job ?? credit.department, index, options);
  }
}

async function addCreditRelation(
  data: ZuuidData,
  credit: TmdbPersonCredit,
  relationType: string,
  attribute: string | undefined,
  order: number,
  options: TmdbTransformOptions
): Promise<void> {
  if (!credit.id) {
    return;
  }

  const category = categoryForMediaType(credit.media_type);
  if (!category) {
    return;
  }

  const title = stringField(credit.title) ?? stringField(credit.name) ?? stringField(credit.original_title) ?? stringField(credit.original_name);
  const externalId = String(credit.id);
  data.relations.push({
    relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: credit.media_type === "tv" ? "tv" : "movie", externalId }),
    relationType,
    direction: "outgoing",
    relatedTitle: title,
    relatedCategory: category,
    relatedImage: mediaUrl(credit.poster_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL),
    source: TMDB_PROVIDER,
    externalId,
    attribute: stringField(attribute),
    order,
    data: compactCreditData(credit)
  });
}

function compactCreditData(credit: TmdbPersonCredit): JsonValue | undefined {
  const value: Record<string, JsonValue> = {};
  if (credit.credit_id) {
    value.creditId = credit.credit_id;
  }
  if (credit.release_date) {
    value.releaseDate = credit.release_date;
  }
  if (credit.first_air_date) {
    value.firstAirDate = credit.first_air_date;
  }
  if (typeof credit.vote_average === "number") {
    value.voteAverage = credit.vote_average;
  }
  if (typeof credit.episode_count === "number") {
    value.episodeCount = credit.episode_count;
  }
  return Object.keys(value).length ? value : undefined;
}

function compactImageData(image: TmdbPersonImage | undefined): JsonValue | undefined {
  if (!image) {
    return undefined;
  }

  const value: Record<string, JsonValue> = {};
  if (typeof image.aspect_ratio === "number") {
    value.aspectRatio = image.aspect_ratio;
  }
  if (typeof image.vote_average === "number") {
    value.voteAverage = image.vote_average;
  }
  if (typeof image.vote_count === "number") {
    value.voteCount = image.vote_count;
  }
  return Object.keys(value).length ? value : undefined;
}

function addDetail(data: ZuuidData, key: string, value: string | undefined): void {
  const normalized = stringField(value);
  if (normalized) {
    data.details.push({ key, value: normalized, source: TMDB_PROVIDER });
  }
}

function addNumberDetail(data: ZuuidData, key: string, value: number | undefined): void {
  if (typeof value === "number") {
    data.details.push({ key, value, source: TMDB_PROVIDER });
  }
}

function addBooleanDetail(data: ZuuidData, key: string, value: boolean | undefined): void {
  if (typeof value === "boolean") {
    data.details.push({ key, value, source: TMDB_PROVIDER });
  }
}

function categoryForMediaType(value: string | undefined): string | undefined {
  switch (value) {
    case "movie":
      return "movie";
    case "tv":
      return "tvshow";
    default:
      return undefined;
  }
}

function relationForCrewJob(job: string | undefined): string {
  switch (job?.toLowerCase()) {
    case "director":
      return "directed";
    case "writer":
    case "screenplay":
    case "novel":
      return "authored";
    case "creator":
    case "executive producer":
    case "producer":
      return "produced";
    default:
      return "worked_on";
  }
}

function mediaUrl(path: string | undefined, baseUrl: string | null): string | undefined {
  const value = stringField(path);
  if (!value) {
    return undefined;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/${value.replace(/^\//, "")}` : value;
}

function stringField(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validateDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`invalid TMDB person field ${field}: ${value}`);
  }
}

function searchQuery(value: string, field: string): string {
  const normalized = stringField(value);
  if (!normalized) {
    throw new Error(`${field} must not be empty`);
  }
  return normalized;
}

function searchParams(provider: TmdbProvider, input: TmdbSearchInput): Record<string, string> {
  return {
    language: input.language ?? provider.language,
    page: String(input.page ?? 1),
    include_adult: String(input.includeAdult ?? false)
  };
}

async function sourceRecordsFromSearchResults(
  category: string,
  results: TmdbPersonSearchResult[] | undefined
): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];
  for (const result of results ?? []) {
    if (!result.id) {
      continue;
    }
    records.push(
      await createSourceRecord({
        source: { provider: TMDB_PROVIDER, category, externalId: String(result.id) },
        payload: result as JsonValue
      })
    );
  }
  return records;
}

function paginationFromTmdbSearchResponse<T>(payload: TmdbSearchResponse<T>): SearchResponse<T>["pagination"] {
  return {
    page: payload.page ?? 1,
    totalPages: payload.total_pages ?? 0,
    totalResults: payload.total_results ?? 0
  };
}
