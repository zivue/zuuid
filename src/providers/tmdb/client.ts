import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { TMDB_API_BASE, TMDB_BACKDROP_BASE_URL, TMDB_POSTER_BASE_URL } from "./constants.js";
import { fetchTmdbMovieSourceRecord, searchTmdbMovieSourceRecords, type FetchTmdbMovieInput, transformTmdbMovie } from "./movie.js";
import { fetchTmdbPersonSourceRecord, searchTmdbPersonSourceRecords, type FetchTmdbPersonInput, transformTmdbPerson } from "./person.js";
import { fetchTmdbTvSourceRecord, searchTmdbTvSourceRecords, type FetchTmdbTvInput, transformTmdbTv } from "./tv.js";
import type { FetchLike, TmdbCredential, TmdbProviderOptions, TmdbSearchInput, TmdbTransformOptions } from "./types.js";

export class TmdbProvider {
  readonly apiBase: string;
  readonly posterBaseUrl: string | null;
  readonly backdropBaseUrl: string | null;
  readonly language: string;

  private readonly fetchImpl: FetchLike;
  private readonly credential: TmdbCredential;

  constructor(options: TmdbProviderOptions) {
    this.apiBase = options.apiBase ?? TMDB_API_BASE;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.posterBaseUrl = options.posterBaseUrl === undefined ? TMDB_POSTER_BASE_URL : options.posterBaseUrl;
    this.backdropBaseUrl = options.backdropBaseUrl === undefined ? TMDB_BACKDROP_BASE_URL : options.backdropBaseUrl;
    this.language = options.language ?? "en-US";
    this.credential =
      options.bearerToken !== undefined
        ? { bearerToken: options.bearerToken.trim() }
        : { apiKey: options.apiKey.trim() };
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const headers = new Headers();
    headers.set("accept", "application/json");

    if (this.credential.apiKey !== undefined) {
      url.searchParams.set("api_key", this.credential.apiKey);
    } else {
      headers.set("authorization", `Bearer ${this.credential.bearerToken}`);
    }

    const response = await this.fetchImpl(url, { headers });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const authMode = this.credential.apiKey !== undefined ? "api_key" : "bearer";
      throw new Error(`TMDB API returned ${response.status} using ${authMode}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async fetchMovieSourceRecord(input: FetchTmdbMovieInput): Promise<SourceRecord | undefined> {
    return fetchTmdbMovieSourceRecord(this, input);
  }

  async fetchMovie(input: FetchTmdbMovieInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchMovieSourceRecord(input);
    return source ? transformTmdbMovie(source, this.transformOptions()) : undefined;
  }

  async searchMovieSourceRecords(input: TmdbSearchInput): Promise<SourceRecord[]> {
    return searchTmdbMovieSourceRecords(this, input);
  }

  async fetchTvSourceRecord(input: FetchTmdbTvInput): Promise<SourceRecord | undefined> {
    return fetchTmdbTvSourceRecord(this, input);
  }

  async fetchTv(input: FetchTmdbTvInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchTvSourceRecord(input);
    return source ? transformTmdbTv(source, this.transformOptions()) : undefined;
  }

  async searchTvSourceRecords(input: TmdbSearchInput): Promise<SourceRecord[]> {
    return searchTmdbTvSourceRecords(this, input);
  }

  async fetchPersonSourceRecord(input: FetchTmdbPersonInput): Promise<SourceRecord | undefined> {
    return fetchTmdbPersonSourceRecord(this, input);
  }

  async fetchPerson(input: FetchTmdbPersonInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchPersonSourceRecord(input);
    return source ? transformTmdbPerson(source, this.transformOptions()) : undefined;
  }

  async searchPersonSourceRecords(input: TmdbSearchInput): Promise<SourceRecord[]> {
    return searchTmdbPersonSourceRecords(this, input);
  }

  transformOptions(): TmdbTransformOptions {
    return {
      posterBaseUrl: this.posterBaseUrl,
      backdropBaseUrl: this.backdropBaseUrl
    };
  }
}
