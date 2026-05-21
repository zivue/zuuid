import type { ZuuidData } from "./entity.js";
import { TmdbProvider, transformTmdbMovie, type FetchTmdbMovieInput, type TmdbProviderOptions } from "./providers/tmdb/index.js";
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
    })
  });
}
