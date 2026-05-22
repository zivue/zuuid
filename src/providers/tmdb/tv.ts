import { createZuuidData, type ZuuidData } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { attachSourceMetadata, createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { TMDB_BACKDROP_BASE_URL, TMDB_POSTER_BASE_URL, TMDB_PROVIDER } from "./constants.js";
import type { TmdbProvider } from "./client.js";
import type { TmdbTransformOptions } from "./types.js";

export const TMDB_TV_CATEGORY = "tv";
export const ZUUID_TV_CATEGORY = "tvshow";

export type FetchTmdbTvInput = {
  id: string | number;
};

export type TmdbTvPayload = {
  adult?: boolean;
  id?: number | string;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  last_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string;
  backdrop_path?: string;
  original_language?: string;
  genres?: { name?: string }[];
  homepage?: string;
  status?: string;
  type?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  popularity?: number;
  languages?: string[];
  in_production?: boolean;
  tagline?: string;
  softcore?: boolean;
  origin_country?: string[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  spoken_languages?: { english_name?: string; iso_639_1?: string; name?: string }[];
  created_by?: { id?: number; name?: string; profile_path?: string | null }[];
  networks?: { id?: number; name?: string; logo_path?: string | null; origin_country?: string }[];
  production_companies?: { id?: number; name?: string; logo_path?: string | null; origin_country?: string }[];
  seasons?: { id?: number; name?: string; season_number?: number; episode_count?: number; poster_path?: string | null; air_date?: string }[];
  external_ids?: {
    imdb_id?: string | null;
    tvdb_id?: number | string | null;
    tvrage_id?: number | string | null;
    wikidata_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
  };
  keywords?: { results?: { id?: number; name?: string }[] };
  aggregate_credits?: {
    cast?: TmdbAggregateCast[];
    crew?: TmdbAggregateCrew[];
  };
  images?: {
    posters?: TmdbTvImage[];
    backdrops?: TmdbTvImage[];
    logos?: TmdbTvImage[];
  };
  recommendations?: TmdbTvListResponse;
  similar?: TmdbTvListResponse;
  translations?: {
    translations?: {
      iso_639_1?: string;
      iso_3166_1?: string;
      data?: { name?: string; overview?: string; homepage?: string };
    }[];
  };
  watch_providers?: { results?: Record<string, JsonValue> };
  content_ratings?: { results?: { descriptors?: string[]; iso_3166_1?: string; rating?: string }[] };
  last_episode_to_air?: JsonValue;
  next_episode_to_air?: JsonValue;
};

export type TmdbAggregateRole = {
  credit_id?: string;
  character?: string;
  episode_count?: number;
};

export type TmdbAggregateJob = {
  credit_id?: string;
  job?: string;
  episode_count?: number;
};

export type TmdbAggregateCast = {
  id?: number;
  name?: string;
  original_name?: string;
  profile_path?: string | null;
  roles?: TmdbAggregateRole[];
  total_episode_count?: number;
};

export type TmdbAggregateCrew = {
  id?: number;
  name?: string;
  original_name?: string;
  profile_path?: string | null;
  department?: string;
  jobs?: TmdbAggregateJob[];
  total_episode_count?: number;
};

export type TmdbTvImage = {
  file_path?: string;
  width?: number;
  height?: number;
  iso_639_1?: string | null;
  vote_average?: number;
};

export type TmdbTvListResponse = {
  results?: TmdbRelatedTv[];
};

export type TmdbRelatedTv = {
  id?: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
};

export async function fetchTmdbTvSourceRecord(
  provider: TmdbProvider,
  input: FetchTmdbTvInput
): Promise<SourceRecord | undefined> {
  const id = String(input.id).trim();
  if (!id) {
    throw new Error("TMDB tv id must not be empty");
  }
  if (!/^\d+$/.test(id)) {
    throw new Error(`TMDB tv id must be numeric: ${id}`);
  }

  const payload = await provider.getJson<TmdbTvPayload>(`/tv/${id}`, {
    language: provider.language,
    append_to_response: "aggregate_credits,external_ids,images,keywords,recommendations,similar,translations,content_ratings"
  });

  if (!payload) {
    return undefined;
  }

  return createSourceRecord({
    source: { provider: TMDB_PROVIDER, category: TMDB_TV_CATEGORY, externalId: id },
    payload: payload as JsonValue
  });
}

export async function transformTmdbTv(
  source: SourceRecord,
  options: TmdbTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== TMDB_PROVIDER || source.source.category !== TMDB_TV_CATEGORY) {
    throw new Error(`unsupported TMDB source: ${source.source.provider}:${source.source.category}`);
  }

  const payload = source.payload as TmdbTvPayload;
  const tmdbId = tmdbTvId(source, payload);
  const title = stringField(payload.name) ?? stringField(payload.original_name);
  if (!title) {
    throw new Error("missing required TMDB tv field: name");
  }

  const zuuid = await providerZuuid({
    provider: TMDB_PROVIDER,
    category: TMDB_TV_CATEGORY,
    externalId: tmdbId
  });
  const data = createZuuidData({ zuuid, category: ZUUID_TV_CATEGORY, primaryTitle: title });

  const firstAirDate = stringField(payload.first_air_date);
  if (firstAirDate) {
    validateDate(firstAirDate, "first_air_date");
    data.primaryDate = firstAirDate;
  }
  if (typeof payload.vote_average === "number") {
    data.rating = payload.vote_average;
  }

  const overview = stringField(payload.overview);
  if (overview) {
    data.descriptions.push({ language: stringField(payload.original_language), value: overview, source: TMDB_PROVIDER });
  }

  const originalName = stringField(payload.original_name);
  if (originalName && originalName !== title) {
    data.aliases.push({
      value: originalName,
      language: stringField(payload.original_language),
      aliasType: "original_name",
      isPrimary: false,
      source: TMDB_PROVIDER
    });
  }

  addTranslations(data, payload, title);
  addExternalIds(data, payload);
  addImage(data, "poster", payload.poster_path, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, true);
  addImage(data, "backdrop", payload.backdrop_path, options.backdropBaseUrl ?? TMDB_BACKDROP_BASE_URL, false);
  addImages(data, payload, options);
  data.cover = data.media.find((media) => media.mediaCategory === "poster")?.url;

  for (const genre of payload.genres ?? []) {
    addTag(data, genre.name);
  }
  for (const keyword of payload.keywords?.results ?? []) {
    addTag(data, keyword.name);
  }

  await addCreatedByRelations(data, payload);
  await addAggregateCreditRelations(data, payload);
  await addNamedRelations(data, payload.networks, "network", "network");
  await addNamedRelations(data, payload.production_companies, "production_company", "company");
  await addSeasonRelations(data, payload, tmdbId, options);
  await addRelatedTv(data, "similar", payload.similar, options);
  await addRelatedTv(data, "related", payload.recommendations, options);

  addDetail(data, "original_language", payload.original_language);
  addDetail(data, "status", payload.status);
  addDetail(data, "show_type", payload.type);
  addDetail(data, "tagline", payload.tagline);
  addDetail(data, "homepage", payload.homepage);
  addDetail(data, "first_air_date", payload.first_air_date);
  addDetail(data, "last_air_date", payload.last_air_date);
  addNumberDetail(data, "season_count", payload.number_of_seasons);
  addNumberDetail(data, "episode_count", payload.number_of_episodes);
  addNumberDetail(data, "vote_count", payload.vote_count);
  addNumberDetail(data, "popularity", payload.popularity);
  addBooleanDetail(data, "adult", payload.adult);
  addBooleanDetail(data, "in_production", payload.in_production);
  addBooleanDetail(data, "softcore", payload.softcore);
  addNumberArrayDetail(data, "episode_run_time", payload.episode_run_time);
  addArrayDetail(data, "languages", payload.languages);
  addArrayDetail(data, "origin_country", payload.origin_country);
  addTvCertifications(data, payload);
  addStructuredDetail(data, "production_countries", payload.production_countries);
  addStructuredDetail(data, "spoken_languages", payload.spoken_languages);
  addStructuredDetail(data, "content_ratings", payload.content_ratings?.results);
  addStructuredDetail(data, "last_episode_to_air", payload.last_episode_to_air);
  addStructuredDetail(data, "next_episode_to_air", payload.next_episode_to_air);
  addStructuredDetail(data, "watch_providers", payload.watch_providers?.results);

  return attachSourceMetadata(data, source);
}

function tmdbTvId(source: SourceRecord, payload: TmdbTvPayload): string {
  const sourceId = source.source.externalId.trim();
  if (sourceId) {
    return sourceId;
  }
  const payloadId = payload.id === undefined ? undefined : String(payload.id).trim();
  if (payloadId) {
    return payloadId;
  }
  throw new Error("missing required TMDB tv field: id");
}

function addExternalIds(data: ZuuidData, payload: TmdbTvPayload): void {
  const ids = payload.external_ids ?? {};
  addExternalId(data, "imdb", ZUUID_TV_CATEGORY, stringField(ids.imdb_id ?? undefined));
  addExternalId(data, "tvdb", ZUUID_TV_CATEGORY, numberOrStringField(ids.tvdb_id));
  addExternalId(data, "tvrage", ZUUID_TV_CATEGORY, numberOrStringField(ids.tvrage_id));
  addExternalId(data, "wikidata", ZUUID_TV_CATEGORY, stringField(ids.wikidata_id ?? undefined));
  addExternalId(data, "facebook", ZUUID_TV_CATEGORY, stringField(ids.facebook_id ?? undefined));
  addExternalId(data, "instagram", ZUUID_TV_CATEGORY, stringField(ids.instagram_id ?? undefined));
  addExternalId(data, "twitter", ZUUID_TV_CATEGORY, stringField(ids.twitter_id ?? undefined));
}

function addExternalId(data: ZuuidData, source: string, category: string, value: string | undefined): void {
  if (!value || data.externalIds.some((id) => id.source === source && id.category === category && id.value === value)) {
    return;
  }
  data.externalIds.push({ source, category, value });
}

function addTranslations(data: ZuuidData, payload: TmdbTvPayload, primaryTitle: string): void {
  for (const item of payload.translations?.translations ?? []) {
    const title = stringField(item.data?.name);
    const language = stringField(item.iso_639_1);
    const region = stringField(item.iso_3166_1);
    if (title && title !== primaryTitle) {
      data.aliases.push({ value: title, language, region, aliasType: "translation", isPrimary: false, source: TMDB_PROVIDER });
    }
    const overview = stringField(item.data?.overview);
    if (overview) {
      data.descriptions.push({ language, region, value: overview, source: TMDB_PROVIDER });
    }
  }
}

async function addCreatedByRelations(data: ZuuidData, payload: TmdbTvPayload): Promise<void> {
  for (const creator of payload.created_by ?? []) {
    if (!creator.id || !creator.name) {
      continue;
    }
    const id = String(creator.id);
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "person", externalId: id }),
      relationType: "creator",
      direction: "outgoing",
      relatedTitle: creator.name,
      relatedCategory: "person",
      relatedImage: mediaUrl(creator.profile_path ?? undefined, TMDB_POSTER_BASE_URL),
      source: TMDB_PROVIDER,
      externalId: id
    });
  }
}

async function addAggregateCreditRelations(data: ZuuidData, payload: TmdbTvPayload): Promise<void> {
  for (const cast of payload.aggregate_credits?.cast ?? []) {
    if (!cast.id || !cast.name) {
      continue;
    }
    const id = String(cast.id);
    const primaryRole = cast.roles?.[0];
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "person", externalId: id }),
      relationType: "performed_by",
      direction: "outgoing",
      relatedTitle: cast.name,
      relatedCategory: "person",
      relatedImage: mediaUrl(cast.profile_path ?? undefined, TMDB_POSTER_BASE_URL),
      source: TMDB_PROVIDER,
      externalId: id,
      attribute: stringField(primaryRole?.character),
      order: 0,
      data: cast as JsonValue
    });
  }

  for (const crew of payload.aggregate_credits?.crew ?? []) {
    if (!crew.id || !crew.name) {
      continue;
    }
    const id = String(crew.id);
    const primaryJob = crew.jobs?.[0]?.job ?? crew.department;
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "person", externalId: id }),
      relationType: primaryJob ? relationForCrewJob(primaryJob) : "related_to",
      direction: "outgoing",
      relatedTitle: crew.name,
      relatedCategory: "person",
      relatedImage: mediaUrl(crew.profile_path ?? undefined, TMDB_POSTER_BASE_URL),
      source: TMDB_PROVIDER,
      externalId: id,
      attribute: stringField(primaryJob),
      order: 0,
      data: crew as JsonValue
    });
  }
}

async function addNamedRelations(
  data: ZuuidData,
  values: { id?: number; name?: string; origin_country?: string }[] | undefined,
  relationType: string,
  relatedCategory: string
): Promise<void> {
  for (const [index, value] of (values ?? []).entries()) {
    if (!value.id || !value.name) {
      continue;
    }
    const id = String(value.id);
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: relatedCategory, externalId: id }),
      relationType,
      direction: "outgoing",
      relatedTitle: value.name,
      relatedCategory,
      relatedImage: mediaUrl("logo_path" in value ? (value.logo_path as string | null | undefined) ?? undefined : undefined, TMDB_POSTER_BASE_URL),
      source: TMDB_PROVIDER,
      externalId: id,
      attribute: stringField(value.origin_country),
      order: index
    });
  }
}

async function addSeasonRelations(
  data: ZuuidData,
  payload: TmdbTvPayload,
  tvId: string,
  options: TmdbTransformOptions
): Promise<void> {
  for (const season of payload.seasons ?? []) {
    if (season.season_number === undefined || !season.name) {
      continue;
    }
    const externalId = `${tvId}-${season.season_number}`;
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "tvseason", externalId }),
      relationType: "contains",
      direction: "outgoing",
      relatedTitle: season.name,
      relatedCategory: "tvseason",
      source: TMDB_PROVIDER,
      externalId,
      attribute: `season:${season.name}`,
      order: season.season_number,
      data: season as JsonValue
    });
    addImage(data, "season_poster", season.poster_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, false);
  }
}

async function addRelatedTv(
  data: ZuuidData,
  recommendationType: "similar" | "related",
  list: TmdbTvListResponse | undefined,
  options: TmdbTransformOptions
): Promise<void> {
  for (const item of list?.results ?? []) {
    if (!item.id) {
      continue;
    }
    const id = String(item.id);
    const title = stringField(item.name) ?? stringField(item.original_name);
    data.recommendations.push({
      targetZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: TMDB_TV_CATEGORY, externalId: id }),
      recommendationType,
      score: typeof item.vote_average === "number" ? item.vote_average : 0,
      source: TMDB_PROVIDER,
      targetTitle: title,
      targetCategory: ZUUID_TV_CATEGORY,
      targetDate: stringField(item.first_air_date),
      targetCover: mediaUrl(item.poster_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL),
      externalId: id,
      reasons: [recommendationType]
    });
  }
}

function addImages(data: ZuuidData, payload: TmdbTvPayload, options: TmdbTransformOptions): void {
  for (const image of payload.images?.posters ?? []) {
    addImage(data, "poster", image.file_path, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, false, image);
  }
  for (const image of payload.images?.backdrops ?? []) {
    addImage(data, "backdrop", image.file_path, options.backdropBaseUrl ?? TMDB_BACKDROP_BASE_URL, false, image);
  }
  for (const image of payload.images?.logos ?? []) {
    addImage(data, "logo", image.file_path, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, false, image);
  }
}

function addImage(
  data: ZuuidData,
  mediaCategory: string,
  path: string | undefined,
  baseUrl: string | null,
  isPrimary: boolean,
  image?: TmdbTvImage
): void {
  const url = mediaUrl(path, baseUrl);
  if (!url) {
    return;
  }
  data.media.push({
    url,
    mediaType: "image",
    mediaCategory,
    width: image?.width,
    height: image?.height,
    isPrimary,
    data: image as JsonValue | undefined,
    source: TMDB_PROVIDER
  });
}

function addTag(data: ZuuidData, value: string | undefined): void {
  const tag = stringField(value)?.toLowerCase();
  if (tag && !data.tags.includes(tag)) {
    data.tags.push(tag);
  }
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

function addNumberArrayDetail(data: ZuuidData, key: string, value: number[] | undefined): void {
  if (value?.length) {
    data.details.push({ key, value, source: TMDB_PROVIDER });
  }
}

function addArrayDetail(data: ZuuidData, key: string, value: string[] | undefined): void {
  if (value?.length) {
    data.details.push({ key, value, source: TMDB_PROVIDER });
  }
}

function addTvCertifications(data: ZuuidData, payload: TmdbTvPayload): void {
  const certifications: Record<string, JsonValue>[] = [];

  for (const item of payload.content_ratings?.results ?? []) {
    const region = stringField(item.iso_3166_1);
    const certification = stringField(item.rating);
    if (!region || !certification) {
      continue;
    }

    certifications.push({
      region,
      certification,
      descriptors: item.descriptors ?? []
    });
  }

  if (!certifications.length) {
    return;
  }

  data.details.push({
    key: "certifications",
    value: certifications,
    source: TMDB_PROVIDER
  });
}

function addStructuredDetail(data: ZuuidData, key: string, value: JsonValue | undefined): void {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return;
  }
  data.details.push({ key, value, source: TMDB_PROVIDER });
}

function stringField(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function numberOrStringField(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return stringField(String(value));
}

function relationForCrewJob(job: string): string {
  switch (job.toLowerCase()) {
    case "creator":
    case "executive producer":
    case "producer":
      return "produced_by";
    case "director":
      return "directed_by";
    case "writer":
    case "screenplay":
    case "novel":
      return "authored_by";
    default:
      return "related_to";
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

function validateDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`invalid TMDB tv field ${field}: ${value}`);
  }
}
