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
  runtime?: number;
  status?: string;
  popularity?: number;
  budget?: number;
  revenue?: number;
  homepage?: string;
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
    append_to_response: "credits,external_ids,images,keywords"
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

  const imdbId = stringField(payload.imdb_id);
  if (imdbId) {
    data.externalIds.push({ source: "imdb", category: TMDB_MOVIE_CATEGORY, value: imdbId });
  }

  addImage(data, "poster", payload.poster_path, options.posterBaseUrl ?? TMDB_POSTER_BASE_URL, true);
  addImage(data, "backdrop", payload.backdrop_path, options.backdropBaseUrl ?? TMDB_BACKDROP_BASE_URL, false);
  data.cover = data.media.find((media) => media.mediaCategory === "poster")?.url;

  for (const genre of payload.genres ?? []) {
    const tag = stringField(genre.name)?.toLowerCase();
    if (tag && !data.tags.includes(tag)) {
      data.tags.push(tag);
    }
  }

  addDetail(data, "original_language", payload.original_language);
  addDetail(data, "status", payload.status);
  addNumberDetail(data, "runtime_minutes", payload.runtime);
  addNumberDetail(data, "vote_count", payload.vote_count);
  addNumberDetail(data, "popularity", payload.popularity);
  addNumberDetail(data, "budget", payload.budget);
  addNumberDetail(data, "revenue", payload.revenue);
  addDetail(data, "homepage", payload.homepage);

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
  isPrimary: boolean
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
    isPrimary,
    source: TMDB_PROVIDER
  });
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

function stringField(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validateDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`invalid TMDB movie field ${field}: ${value}`);
  }
}
