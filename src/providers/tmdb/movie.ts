import { createZuuidData, type ZuuidData } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { attachSourceMetadata, createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { TMDB_BACKDROP_BASE_URL, TMDB_POSTER_BASE_URL, TMDB_PROVIDER } from "./constants.js";
import type { TmdbProvider } from "./client.js";
import type { TmdbTransformOptions } from "./types.js";

export const TMDB_MOVIE_CATEGORY = "movie";

export type FetchTmdbMovieInput = {
  id: string | number;
};

export type TmdbMoviePayload = {
  adult?: boolean;
  id?: number | string;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string;
  backdrop_path?: string;
  original_language?: string;
  genres?: { name?: string }[];
  imdb_id?: string;
  external_ids?: {
    imdb_id?: string | null;
    wikidata_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
  };
  alternative_titles?: {
    titles?: { iso_3166_1?: string; title?: string; type?: string }[];
  };
  translations?: {
    translations?: {
      iso_639_1?: string;
      iso_3166_1?: string;
      name?: string;
      english_name?: string;
      data?: { title?: string; overview?: string; homepage?: string };
    }[];
  };
  credits?: {
    cast?: TmdbCreditCast[];
    crew?: TmdbCreditCrew[];
  };
  keywords?: {
    keywords?: { id?: number; name?: string }[];
  };
  images?: {
    posters?: TmdbImage[];
    backdrops?: TmdbImage[];
    logos?: TmdbImage[];
  };
  recommendations?: TmdbMovieListResponse;
  similar?: TmdbMovieListResponse;
  belongs_to_collection?: { id?: number; name?: string; poster_path?: string; backdrop_path?: string } | null;
  production_companies?: { id?: number; name?: string; origin_country?: string; logo_path?: string | null }[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  origin_country?: string[];
  spoken_languages?: { english_name?: string; iso_639_1?: string; name?: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  popularity?: number;
  budget?: number;
  revenue?: number;
  homepage?: string;
  video?: boolean;
  softcore?: boolean;
  watch_providers?: { results?: Record<string, JsonValue> };
};

export type TmdbCreditCast = {
  id?: number;
  name?: string;
  character?: string;
  order?: number;
  profile_path?: string | null;
};

export type TmdbCreditCrew = {
  id?: number;
  name?: string;
  department?: string;
  job?: string;
  profile_path?: string | null;
};

export type TmdbImage = {
  file_path?: string;
  width?: number;
  height?: number;
  iso_639_1?: string | null;
  vote_average?: number;
};

export type TmdbMovieListResponse = {
  results?: TmdbRelatedMovie[];
};

export type TmdbRelatedMovie = {
  id?: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
};

export async function fetchTmdbMovieSourceRecord(
  provider: TmdbProvider,
  input: FetchTmdbMovieInput
): Promise<SourceRecord | undefined> {
  const id = String(input.id).trim();
  if (!id) {
    throw new Error("TMDB movie id must not be empty");
  }
  if (!/^\d+$/.test(id)) {
    throw new Error(`TMDB movie id must be numeric: ${id}`);
  }

  const payload = await provider.getJson<TmdbMoviePayload>(`/movie/${id}`, {
    language: provider.language,
    append_to_response: "alternative_titles,credits,external_ids,images,keywords,recommendations,similar,translations,watch_providers"
  });

  if (!payload) {
    return undefined;
  }

  return createSourceRecord({
    source: { provider: TMDB_PROVIDER, category: TMDB_MOVIE_CATEGORY, externalId: id },
    payload: payload as JsonValue
  });
}

export async function transformTmdbMovie(
  source: SourceRecord,
  options: TmdbTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== TMDB_PROVIDER || source.source.category !== TMDB_MOVIE_CATEGORY) {
    throw new Error(`unsupported TMDB source: ${source.source.provider}:${source.source.category}`);
  }

  const payload = source.payload as TmdbMoviePayload;
  const tmdbId = tmdbMovieId(source, payload);
  const title = stringField(payload.title) ?? stringField(payload.original_title);

  if (!title) {
    throw new Error("missing required TMDB movie field: title");
  }

  const zuuid = await providerZuuid({
    provider: TMDB_PROVIDER,
    category: TMDB_MOVIE_CATEGORY,
    externalId: tmdbId
  });
  const data = createZuuidData({
    zuuid,
    category: TMDB_MOVIE_CATEGORY,
    primaryTitle: title
  });

  const releaseDate = stringField(payload.release_date);
  if (releaseDate) {
    validateDate(releaseDate, "release_date");
    data.primaryDate = releaseDate;
  }

  if (typeof payload.vote_average === "number") {
    data.rating = payload.vote_average;
  }

  const overview = stringField(payload.overview);
  if (overview) {
    data.descriptions.push({
      language: stringField(payload.original_language),
      value: overview,
      source: TMDB_PROVIDER
    });
  }

  const originalTitle = stringField(payload.original_title);
  if (originalTitle && originalTitle !== title) {
    data.aliases.push({
      value: originalTitle,
      language: stringField(payload.original_language),
      aliasType: "original_title",
      isPrimary: false
    });
  }

  addExternalIds(data, payload);
  addAlternativeTitles(data, payload, title);
  addTranslations(data, payload, title);

  addImage(data, "poster", payload.poster_path, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, true);
  addImage(data, "backdrop", payload.backdrop_path, options.backdropBaseUrl ?? TMDB_BACKDROP_BASE_URL, false);
  addImages(data, payload, options);
  data.cover = data.media.find((media) => media.mediaCategory === "poster")?.url;

  addGenreTags(data, payload);
  addKeywordTags(data, payload);
  await addCredits(data, payload);
  await addCollectionsAndCompanies(data, payload, options);
  await addRelatedMovies(data, "similar", payload.similar, options);
  await addRelatedMovies(data, "related", payload.recommendations, options);

  addDetail(data, "original_language", payload.original_language);
  addDetail(data, "status", payload.status);
  addDetail(data, "tagline", payload.tagline);
  addNumberDetail(data, "runtime_minutes", payload.runtime);
  addNumberDetail(data, "vote_count", payload.vote_count);
  addNumberDetail(data, "popularity", payload.popularity);
  addNumberDetail(data, "budget", payload.budget);
  addNumberDetail(data, "revenue", payload.revenue);
  addDetail(data, "homepage", payload.homepage);
  addBooleanDetail(data, "adult", payload.adult);
  addBooleanDetail(data, "video", payload.video);
  addBooleanDetail(data, "softcore", payload.softcore);
  addArrayDetail(data, "origin_country", payload.origin_country);
  addStructuredDetail(data, "production_countries", payload.production_countries);
  addStructuredDetail(data, "spoken_languages", payload.spoken_languages);
  addStructuredDetail(data, "watch_providers", payload.watch_providers?.results);

  return attachSourceMetadata(data, source);
}

function tmdbMovieId(source: SourceRecord, payload: TmdbMoviePayload): string {
  const sourceId = source.source.externalId.trim();
  if (sourceId) {
    return sourceId;
  }
  const payloadId = payload.id === undefined ? undefined : String(payload.id).trim();
  if (payloadId) {
    return payloadId;
  }
  throw new Error("missing required TMDB movie field: id");
}

function addImage(
  data: ZuuidData,
  mediaCategory: string,
  path: string | undefined,
  baseUrl: string | null,
  isPrimary: boolean,
  image?: TmdbImage
): void {
  const value = stringField(path);
  if (!value) {
    return;
  }

  const url =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/${value.replace(/^\//, "")}`
        : value;

  data.media.push({
    url,
    mediaType: "image",
    mediaCategory,
    width: image?.width,
    height: image?.height,
    isPrimary,
    source: TMDB_PROVIDER
  });
}

function addImages(data: ZuuidData, payload: TmdbMoviePayload, options: TmdbTransformOptions): void {
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

function addExternalIds(data: ZuuidData, payload: TmdbMoviePayload): void {
  const ids = payload.external_ids ?? {};
  addExternalId(data, "imdb", TMDB_MOVIE_CATEGORY, stringField(ids.imdb_id ?? undefined) ?? stringField(payload.imdb_id));
  addExternalId(data, "wikidata", TMDB_MOVIE_CATEGORY, stringField(ids.wikidata_id ?? undefined));
  addExternalId(data, "facebook", TMDB_MOVIE_CATEGORY, stringField(ids.facebook_id ?? undefined));
  addExternalId(data, "instagram", TMDB_MOVIE_CATEGORY, stringField(ids.instagram_id ?? undefined));
  addExternalId(data, "twitter", TMDB_MOVIE_CATEGORY, stringField(ids.twitter_id ?? undefined));
}

function addExternalId(data: ZuuidData, source: string, category: string, value: string | undefined): void {
  if (!value || data.externalIds.some((id) => id.source === source && id.category === category && id.value === value)) {
    return;
  }
  data.externalIds.push({ source, category, value });
}

function addAlternativeTitles(data: ZuuidData, payload: TmdbMoviePayload, primaryTitle: string): void {
  for (const item of payload.alternative_titles?.titles ?? []) {
    const value = stringField(item.title);
    if (!value || value === primaryTitle) {
      continue;
    }
    data.aliases.push({
      value,
      region: stringField(item.iso_3166_1),
      aliasType: stringField(item.type) ?? "alternative_title",
      isPrimary: false,
      source: TMDB_PROVIDER
    });
  }
}

function addTranslations(data: ZuuidData, payload: TmdbMoviePayload, primaryTitle: string): void {
  for (const item of payload.translations?.translations ?? []) {
    const title = stringField(item.data?.title);
    const language = stringField(item.iso_639_1);
    const region = stringField(item.iso_3166_1);
    if (title && title !== primaryTitle) {
      data.aliases.push({
        value: title,
        language,
        region,
        aliasType: "translation",
        isPrimary: false,
        source: TMDB_PROVIDER
      });
    }
    const overview = stringField(item.data?.overview);
    if (overview) {
      data.descriptions.push({
        language,
        region,
        value: overview,
        source: TMDB_PROVIDER
      });
    }
  }
}

function addGenreTags(data: ZuuidData, payload: TmdbMoviePayload): void {
  for (const genre of payload.genres ?? []) {
    addTag(data, genre.name);
  }
}

function addKeywordTags(data: ZuuidData, payload: TmdbMoviePayload): void {
  for (const keyword of payload.keywords?.keywords ?? []) {
    addTag(data, keyword.name);
  }
}

function addTag(data: ZuuidData, value: string | undefined): void {
  const tag = stringField(value)?.toLowerCase();
  if (tag && !data.tags.includes(tag)) {
    data.tags.push(tag);
  }
}

async function addCredits(data: ZuuidData, payload: TmdbMoviePayload): Promise<void> {
  for (const cast of payload.credits?.cast ?? []) {
    const id = cast.id === undefined ? undefined : String(cast.id);
    const name = stringField(cast.name);
    if (!id || !name) {
      continue;
    }
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "person", externalId: id }),
      relationType: "performed_by",
      direction: "outgoing",
      relatedTitle: name,
      relatedCategory: "person",
      source: TMDB_PROVIDER,
      externalId: id,
      attribute: stringField(cast.character),
      order: cast.order
    });
  }

  for (const crew of payload.credits?.crew ?? []) {
    const id = crew.id === undefined ? undefined : String(crew.id);
    const name = stringField(crew.name);
    const job = stringField(crew.job);
    if (!id || !name || !job) {
      continue;
    }
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "person", externalId: id }),
      relationType: relationForCrewJob(job),
      direction: "outgoing",
      relatedTitle: name,
      relatedCategory: "person",
      source: TMDB_PROVIDER,
      externalId: id,
      attribute: job
    });
  }
}

async function addCollectionsAndCompanies(
  data: ZuuidData,
  payload: TmdbMoviePayload,
  options: TmdbTransformOptions
): Promise<void> {
  if (payload.belongs_to_collection?.id && payload.belongs_to_collection.name) {
    const id = String(payload.belongs_to_collection.id);
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "collection", externalId: id }),
      relationType: "part_of",
      direction: "outgoing",
      relatedTitle: payload.belongs_to_collection.name,
      relatedCategory: "collection",
      source: TMDB_PROVIDER,
      externalId: id
    });
  }

  for (const company of payload.production_companies ?? []) {
    if (!company.id || !company.name) {
      continue;
    }
    const id = String(company.id);
    data.relations.push({
      relatedZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: "company", externalId: id }),
      relationType: "published_by",
      direction: "outgoing",
      relatedTitle: company.name,
      relatedCategory: "company",
      source: TMDB_PROVIDER,
      externalId: id,
      attribute: stringField(company.origin_country)
    });
    addImage(data, "company_logo", company.logo_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, false);
  }
}

async function addRelatedMovies(
  data: ZuuidData,
  recommendationType: "similar" | "related",
  list: TmdbMovieListResponse | undefined,
  options: TmdbTransformOptions
): Promise<void> {
  for (const item of list?.results ?? []) {
    if (!item.id) {
      continue;
    }
    const id = String(item.id);
    const title = stringField(item.title) ?? stringField(item.original_title);
    data.recommendations.push({
      targetZuuid: await providerZuuid({ provider: TMDB_PROVIDER, category: TMDB_MOVIE_CATEGORY, externalId: id }),
      recommendationType,
      score: typeof item.vote_average === "number" ? item.vote_average : 0,
      source: TMDB_PROVIDER,
      targetTitle: title,
      targetCategory: TMDB_MOVIE_CATEGORY,
      targetDate: stringField(item.release_date),
      targetCover: mediaUrl(item.poster_path ?? undefined, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL),
      externalId: id,
      reasons: [recommendationType]
    });
  }
}

function relationForCrewJob(job: string): string {
  switch (job.toLowerCase()) {
    case "director":
      return "directed_by";
    case "screenplay":
    case "writer":
    case "novel":
      return "authored_by";
    case "producer":
      return "produced_by";
    default:
      return "related_to";
  }
}

function addDetail(data: ZuuidData, key: string, value: string | undefined): void {
  const normalized = stringField(value);
  if (!normalized) {
    return;
  }

  data.details.push({ key, value: normalized, source: TMDB_PROVIDER });
}

function addNumberDetail(data: ZuuidData, key: string, value: number | undefined): void {
  if (typeof value !== "number") {
    return;
  }

  data.details.push({ key, value: String(value), source: TMDB_PROVIDER });
}

function addBooleanDetail(data: ZuuidData, key: string, value: boolean | undefined): void {
  if (typeof value !== "boolean") {
    return;
  }

  data.details.push({ key, value: String(value), source: TMDB_PROVIDER });
}

function addArrayDetail(data: ZuuidData, key: string, value: string[] | undefined): void {
  if (!value?.length) {
    return;
  }

  data.details.push({ key, value: value.join(","), data: value, source: TMDB_PROVIDER });
}

function addStructuredDetail(data: ZuuidData, key: string, value: JsonValue | undefined): void {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return;
  }

  data.details.push({ key, value: JSON.stringify(value), data: value, source: TMDB_PROVIDER });
}

function stringField(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
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
    throw new Error(`invalid TMDB movie field ${field}: ${value}`);
  }
}
