import type { SourceRecord } from "../../source.js";
import type { ZuuidData } from "../../entity.js";
import { IMDB_DEFAULT_USER_AGENT, IMDB_SUGGESTION_BASE_URL, IMDB_TITLE_BASE_URL } from "./constants.js";
import { fetchImdbMovieSourceRecord, fetchImdbTvSourceRecord, transformImdbMovie, transformImdbTv, type FetchImdbTitleInput } from "./movie.js";
import type { ImdbFetchLike, ImdbProviderOptions, ImdbTransformOptions } from "./types.js";

export class ImdbProvider {
  readonly fetcher: ImdbFetchLike;
  readonly titleBaseUrl: string | null;
  readonly suggestionBaseUrl: string | null;
  readonly userAgent: string;

  constructor(options: ImdbProviderOptions = {}) {
    this.fetcher = options.fetch ?? fetch;
    this.titleBaseUrl = options.titleBaseUrl === undefined ? IMDB_TITLE_BASE_URL : options.titleBaseUrl;
    this.suggestionBaseUrl = options.suggestionBaseUrl === undefined ? IMDB_SUGGESTION_BASE_URL : options.suggestionBaseUrl;
    this.userAgent = options.userAgent ?? IMDB_DEFAULT_USER_AGENT;
  }

  transformOptions(): ImdbTransformOptions {
    return { titleBaseUrl: this.titleBaseUrl, suggestionBaseUrl: this.suggestionBaseUrl };
  }

  async fetchMovieSourceRecord(input: FetchImdbTitleInput): Promise<SourceRecord | undefined> {
    return fetchImdbMovieSourceRecord(this, input);
  }

  async fetchMovie(input: FetchImdbTitleInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchMovieSourceRecord(input);
    return source ? transformImdbMovie(source, this.transformOptions()) : undefined;
  }

  async fetchTvSourceRecord(input: FetchImdbTitleInput): Promise<SourceRecord | undefined> {
    return fetchImdbTvSourceRecord(this, input);
  }

  async fetchTv(input: FetchImdbTitleInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchTvSourceRecord(input);
    return source ? transformImdbTv(source, this.transformOptions()) : undefined;
  }
}
