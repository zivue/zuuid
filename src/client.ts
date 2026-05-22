import type { ZuuidData } from "./entity.js";
import {
  TmdbProvider,
  transformTmdbMovie,
  transformTmdbPerson,
  transformTmdbTv,
  type FetchTmdbMovieInput,
  type FetchTmdbPersonInput,
  type FetchTmdbTvInput,
  type TmdbProviderOptions,
  type TmdbSearchInput
} from "./providers/tmdb/index.js";
import type { SourceRecord } from "./source.js";

export type ProviderConfigs = {
  tmdb?: TmdbProviderOptions;
};

export type ZuuidClientConfig = {
  providers?: ProviderConfigs;
};

export type MovieProviderClient<TFetchInput> = {
  fetch(input: TFetchInput): Promise<ZuuidData | undefined>;
  fetchSourceRecord(input: TFetchInput): Promise<SourceRecord | undefined>;
  search(input: TmdbSearchInput): Promise<SourceRecord[]>;
  transform(source: SourceRecord): Promise<ZuuidData>;
};

export type ZuuidClient = {
  movie: {
    tmdb?: MovieProviderClient<FetchTmdbMovieInput>;
  };
  tv: {
    tmdb?: MovieProviderClient<FetchTmdbTvInput>;
  };
  people: {
    tmdb?: MovieProviderClient<FetchTmdbPersonInput>;
  };
};

export function createZuuidClient(config: ZuuidClientConfig = {}): ZuuidClient {
  const tmdb = config.providers?.tmdb ? new TmdbProvider(config.providers.tmdb) : undefined;

  return Object.freeze({
    movie: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbMovieInput) => tmdb.fetchMovie(input),
            fetchSourceRecord: (input: FetchTmdbMovieInput) => tmdb.fetchMovieSourceRecord(input),
            search: (input: TmdbSearchInput) => tmdb.searchMovieSourceRecords(input),
            transform: (source: SourceRecord) => transformTmdbMovie(source, tmdb.transformOptions())
          })
        : undefined
    }),
    tv: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbTvInput) => tmdb.fetchTv(input),
            fetchSourceRecord: (input: FetchTmdbTvInput) => tmdb.fetchTvSourceRecord(input),
            search: (input: TmdbSearchInput) => tmdb.searchTvSourceRecords(input),
            transform: (source: SourceRecord) => transformTmdbTv(source, tmdb.transformOptions())
          })
        : undefined
    }),
    people: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbPersonInput) => tmdb.fetchPerson(input),
            fetchSourceRecord: (input: FetchTmdbPersonInput) => tmdb.fetchPersonSourceRecord(input),
            search: (input: TmdbSearchInput) => tmdb.searchPersonSourceRecords(input),
            transform: (source: SourceRecord) => transformTmdbPerson(source, tmdb.transformOptions())
          })
        : undefined
    })
  });
}
