import type { ZuuidData } from "./entity.js";
import {
  TmdbProvider,
  transformTmdbMovie,
  transformTmdbPerson,
  transformTmdbTv,
  type FetchTmdbMovieInput,
  type FetchTmdbPersonInput,
  type FetchTmdbTvInput,
  type TmdbProviderOptions
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
            transform: (source: SourceRecord) => transformTmdbMovie(source, tmdb.transformOptions())
          })
        : undefined
    }),
    tv: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbTvInput) => tmdb.fetchTv(input),
            fetchSourceRecord: (input: FetchTmdbTvInput) => tmdb.fetchTvSourceRecord(input),
            transform: (source: SourceRecord) => transformTmdbTv(source, tmdb.transformOptions())
          })
        : undefined
    }),
    people: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbPersonInput) => tmdb.fetchPerson(input),
            fetchSourceRecord: (input: FetchTmdbPersonInput) => tmdb.fetchPersonSourceRecord(input),
            transform: (source: SourceRecord) => transformTmdbPerson(source, tmdb.transformOptions())
          })
        : undefined
    })
  });
}
