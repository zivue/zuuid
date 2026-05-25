import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "./entity.js";
import {
  OpenLibraryProvider,
  transformOpenLibraryAuthor,
  transformOpenLibraryBook,
  type FetchOpenLibraryAuthorInput,
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
import {
  GamesDbProvider,
  transformGamesDbGame,
  transformGamesDbPlatform,
  type FetchGamesDbGameInput,
  type FetchGamesDbPlatformInput,
  type GamesDbProviderOptions,
  type GamesDbSearchInput
} from "./providers/gamesdb/index.js";
import {
  ImdbProvider,
  transformImdbMovie,
  transformImdbTv,
  type FetchImdbTitleInput,
  type ImdbProviderOptions
} from "./providers/imdb/index.js";
import type { SourceRecord } from "./source.js";

export type ProviderConfigs = {
  gamesdb?: GamesDbProviderOptions;
  imdb?: ImdbProviderOptions;
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

export type FetchOnlyProviderClient<TFetchInput> = {
  fetch(input: TFetchInput): Promise<ZuuidData | undefined>;
  fetchSourceRecord(input: TFetchInput): Promise<SourceRecord | undefined>;
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
    imdb?: FetchOnlyProviderClient<FetchImdbTitleInput>;
    tmdb?: ProviderClient<FetchTmdbMovieInput, TmdbSearchInput>;
  };
  tv: {
    imdb?: FetchOnlyProviderClient<FetchImdbTitleInput>;
    tmdb?: ProviderClient<FetchTmdbTvInput, TmdbSearchInput>;
  };
  people: {
    tmdb?: ProviderClient<FetchTmdbPersonInput, TmdbSearchInput>;
    openlibrary?: ProviderClient<FetchOpenLibraryAuthorInput, OpenLibrarySearchInput>;
  };
  read: {
    openlibrary?: ProviderClient<FetchOpenLibraryBookInput, OpenLibrarySearchInput>;
  };
  play: {
    gamesdb?: {
      game: ProviderClient<FetchGamesDbGameInput, GamesDbSearchInput>;
      platform: FetchOnlyProviderClient<FetchGamesDbPlatformInput>;
    };
  };
};

export function createZuuidClient(config: ZuuidClientConfig = {}): ZuuidClient {
  const gamesdb = config.providers?.gamesdb ? new GamesDbProvider(config.providers.gamesdb) : undefined;
  const imdb = config.providers?.imdb ? new ImdbProvider(config.providers.imdb) : undefined;
  const openlibrary = config.providers?.openlibrary ? new OpenLibraryProvider(config.providers.openlibrary) : undefined;
  const tmdb = config.providers?.tmdb ? new TmdbProvider(config.providers.tmdb) : undefined;

  return Object.freeze({
    movie: Object.freeze({
      imdb: imdb
        ? Object.freeze({
            fetch: (input: FetchImdbTitleInput) => imdb.fetchMovie(input),
            fetchSourceRecord: (input: FetchImdbTitleInput) => imdb.fetchMovieSourceRecord(input),
            transform: (source: SourceRecord) => transformImdbMovie(source, imdb.transformOptions())
          })
        : undefined,
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
      imdb: imdb
        ? Object.freeze({
            fetch: (input: FetchImdbTitleInput) => imdb.fetchTv(input),
            fetchSourceRecord: (input: FetchImdbTitleInput) => imdb.fetchTvSourceRecord(input),
            transform: (source: SourceRecord) => transformImdbTv(source, imdb.transformOptions())
          })
        : undefined,
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
        : undefined,
      openlibrary: openlibrary
        ? Object.freeze({
            fetch: (input: FetchOpenLibraryAuthorInput) => openlibrary.fetchAuthor(input),
            fetchSourceRecord: (input: FetchOpenLibraryAuthorInput) => openlibrary.fetchAuthorSourceRecord(input),
            search: (input: OpenLibrarySearchInput) => openlibrary.searchAuthors(input),
            searchSourceRecords: (input: OpenLibrarySearchInput) => openlibrary.searchAuthorSourceRecords(input),
            transform: (source: SourceRecord) => transformOpenLibraryAuthor(source, openlibrary.transformOptions())
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
    }),
    play: Object.freeze({
      gamesdb: gamesdb
        ? Object.freeze({
            game: Object.freeze({
              fetch: (input: FetchGamesDbGameInput) => gamesdb.fetchGame(input),
              fetchSourceRecord: (input: FetchGamesDbGameInput) => gamesdb.fetchGameSourceRecord(input),
              search: (input: GamesDbSearchInput) => gamesdb.searchGames(input),
              searchSourceRecords: (input: GamesDbSearchInput) => gamesdb.searchGameSourceRecords(input),
              transform: (source: SourceRecord) => transformGamesDbGame(source, gamesdb.transformOptions())
            }),
            platform: Object.freeze({
              fetch: (input: FetchGamesDbPlatformInput) => gamesdb.fetchPlatform(input),
              fetchSourceRecord: (input: FetchGamesDbPlatformInput) => gamesdb.fetchPlatformSourceRecord(input),
              transform: (source: SourceRecord) => transformGamesDbPlatform(source, gamesdb.transformOptions())
            })
          })
        : undefined
    })
  });
}
