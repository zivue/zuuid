import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "./entity.js";
import {
  OpenLibraryProvider,
  transformOpenLibraryBook,
  type FetchOpenLibraryBookInput,
  type OpenLibraryProviderOptions,
  type OpenLibrarySearchInput
} from "./providers/openlibrary/index.js";
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
  openlibrary?: OpenLibraryProviderOptions;
  tmdb?: TmdbProviderOptions;
};

export type ZuuidClientConfig = {
  providers?: ProviderConfigs;
};

export type MovieProviderClient<TFetchInput> = {
  fetch(input: TFetchInput): Promise<ZuuidData | undefined>;
  fetchSourceRecord(input: TFetchInput): Promise<SourceRecord | undefined>;
  search(input: TmdbSearchInput): Promise<SearchResponse<ZuuidSearchResult>>;
  searchSourceRecords(input: TmdbSearchInput): Promise<SearchResponse<SourceRecord>>;
  transform(source: SourceRecord): Promise<ZuuidData>;
};

export type ProviderClient<TFetchInput, TSearchInput> = {
  fetch(input: TFetchInput): Promise<ZuuidData | undefined>;
  fetchSourceRecord(input: TFetchInput): Promise<SourceRecord | undefined>;
  search(input: TSearchInput): Promise<SearchResponse<ZuuidSearchResult>>;
  searchSourceRecords(input: TSearchInput): Promise<SearchResponse<SourceRecord>>;
  transform(source: SourceRecord): Promise<ZuuidData>;
};

export type ZuuidClient = {
  movie: {
    tmdb?: ProviderClient<FetchTmdbMovieInput, TmdbSearchInput>;
  };
  tv: {
    tmdb?: ProviderClient<FetchTmdbTvInput, TmdbSearchInput>;
  };
  people: {
    tmdb?: ProviderClient<FetchTmdbPersonInput, TmdbSearchInput>;
  };
  read: {
    openlibrary?: ProviderClient<FetchOpenLibraryBookInput, OpenLibrarySearchInput>;
  };
};

export function createZuuidClient(config: ZuuidClientConfig = {}): ZuuidClient {
  const openlibrary = config.providers?.openlibrary ? new OpenLibraryProvider(config.providers.openlibrary) : undefined;
  const tmdb = config.providers?.tmdb ? new TmdbProvider(config.providers.tmdb) : undefined;

  return Object.freeze({
    movie: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbMovieInput) => tmdb.fetchMovie(input),
            fetchSourceRecord: (input: FetchTmdbMovieInput) => tmdb.fetchMovieSourceRecord(input),
            search: (input: TmdbSearchInput) => tmdb.searchMovies(input),
            searchSourceRecords: (input: TmdbSearchInput) => tmdb.searchMovieSourceRecords(input),
            transform: (source: SourceRecord) => transformTmdbMovie(source, tmdb.transformOptions())
          })
        : undefined
    }),
    tv: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbTvInput) => tmdb.fetchTv(input),
            fetchSourceRecord: (input: FetchTmdbTvInput) => tmdb.fetchTvSourceRecord(input),
            search: (input: TmdbSearchInput) => tmdb.searchTv(input),
            searchSourceRecords: (input: TmdbSearchInput) => tmdb.searchTvSourceRecords(input),
            transform: (source: SourceRecord) => transformTmdbTv(source, tmdb.transformOptions())
          })
        : undefined
    }),
    people: Object.freeze({
      tmdb: tmdb
        ? Object.freeze({
            fetch: (input: FetchTmdbPersonInput) => tmdb.fetchPerson(input),
            fetchSourceRecord: (input: FetchTmdbPersonInput) => tmdb.fetchPersonSourceRecord(input),
            search: (input: TmdbSearchInput) => tmdb.searchPeople(input),
            searchSourceRecords: (input: TmdbSearchInput) => tmdb.searchPersonSourceRecords(input),
            transform: (source: SourceRecord) => transformTmdbPerson(source, tmdb.transformOptions())
          })
        : undefined
    }),
    read: Object.freeze({
      openlibrary: openlibrary
        ? Object.freeze({
            fetch: (input: FetchOpenLibraryBookInput) => openlibrary.fetchBook(input),
            fetchSourceRecord: (input: FetchOpenLibraryBookInput) => openlibrary.fetchBookSourceRecord(input),
            search: (input: OpenLibrarySearchInput) => openlibrary.searchBooks(input),
            searchSourceRecords: (input: OpenLibrarySearchInput) => openlibrary.searchBookSourceRecords(input),
            transform: (source: SourceRecord) => transformOpenLibraryBook(source, openlibrary.transformOptions())
          })
        : undefined
    })
  });
}
