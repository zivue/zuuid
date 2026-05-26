import {
  ComicVineProvider,
  transformComicVine,
  type ComicVineProviderOptions,
  type ComicVineSearchInput,
  type FetchComicVineInput
} from "./providers/comicvine/index.js";
import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "./entity.js";
import {
  MusicBrainzProvider,
  transformMusicBrainzArtist,
  transformMusicBrainzLabel,
  transformMusicBrainzRecording,
  transformMusicBrainzRelease,
  transformMusicBrainzReleaseGroup,
  transformMusicBrainzWork,
  type FetchMusicBrainzInput,
  type MusicBrainzProviderOptions,
  type MusicBrainzSearchInput
} from "./providers/musicbrainz/index.js";
import {
  OpenFoodFactsProvider,
  transformOpenFoodFactsProduct,
  type FetchOpenFoodFactsProductInput,
  type OpenFoodFactsProviderOptions,
  type OpenFoodFactsSearchInput
} from "./providers/openfoodfacts/index.js";
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
  OpenStreetMapProvider,
  transformOpenStreetMapPlace,
  type FetchOpenStreetMapInput,
  type OpenStreetMapProviderOptions,
  type OpenStreetMapSearchInput
} from "./providers/openstreetmap/index.js";
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
  comicvine?: ComicVineProviderOptions;
  gamesdb?: GamesDbProviderOptions;
  imdb?: ImdbProviderOptions;
  musicbrainz?: MusicBrainzProviderOptions;
  openfoodfacts?: OpenFoodFactsProviderOptions;
  openlibrary?: OpenLibraryProviderOptions;
  openstreetmap?: OpenStreetMapProviderOptions;
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
    musicbrainz?: {
      artist: ProviderClient<FetchMusicBrainzInput, MusicBrainzSearchInput>;
      label: ProviderClient<FetchMusicBrainzInput, MusicBrainzSearchInput>;
    };
    comicvine?: {
      character: ProviderClient<FetchComicVineInput, ComicVineSearchInput>;
      person: ProviderClient<FetchComicVineInput, ComicVineSearchInput>;
      publisher: ProviderClient<FetchComicVineInput, ComicVineSearchInput>;
    };
  };
  read: {
    openlibrary?: ProviderClient<FetchOpenLibraryBookInput, OpenLibrarySearchInput>;
    comicvine?: {
      volume: ProviderClient<FetchComicVineInput, ComicVineSearchInput>;
      issue: ProviderClient<FetchComicVineInput, ComicVineSearchInput>;
      storyArc: ProviderClient<FetchComicVineInput, ComicVineSearchInput>;
    };
  };
  listen: {
    musicbrainz?: {
      release: ProviderClient<FetchMusicBrainzInput, MusicBrainzSearchInput>;
      releaseGroup: ProviderClient<FetchMusicBrainzInput, MusicBrainzSearchInput>;
      recording: ProviderClient<FetchMusicBrainzInput, MusicBrainzSearchInput>;
      work: ProviderClient<FetchMusicBrainzInput, MusicBrainzSearchInput>;
    };
  };
  play: {
    gamesdb?: {
      game: ProviderClient<FetchGamesDbGameInput, GamesDbSearchInput>;
      platform: FetchOnlyProviderClient<FetchGamesDbPlatformInput>;
    };
  };
  product: {
    openfoodfacts?: ProviderClient<FetchOpenFoodFactsProductInput, OpenFoodFactsSearchInput>;
  };
  visit: {
    openstreetmap?: {
      city: ProviderClient<FetchOpenStreetMapInput, OpenStreetMapSearchInput>;
      country: ProviderClient<FetchOpenStreetMapInput, OpenStreetMapSearchInput>;
      place: ProviderClient<FetchOpenStreetMapInput, OpenStreetMapSearchInput>;
      venue: ProviderClient<FetchOpenStreetMapInput, OpenStreetMapSearchInput>;
    };
  };
};

export function createZuuidClient(config: ZuuidClientConfig = {}): ZuuidClient {
  const comicvine = config.providers?.comicvine ? new ComicVineProvider(config.providers.comicvine) : undefined;
  const gamesdb = config.providers?.gamesdb ? new GamesDbProvider(config.providers.gamesdb) : undefined;
  const imdb = config.providers?.imdb ? new ImdbProvider(config.providers.imdb) : undefined;
  const musicbrainz = config.providers?.musicbrainz ? new MusicBrainzProvider(config.providers.musicbrainz) : undefined;
  const openfoodfacts = config.providers?.openfoodfacts ? new OpenFoodFactsProvider(config.providers.openfoodfacts) : undefined;
  const openlibrary = config.providers?.openlibrary ? new OpenLibraryProvider(config.providers.openlibrary) : undefined;
  const openstreetmap = config.providers?.openstreetmap ? new OpenStreetMapProvider(config.providers.openstreetmap) : undefined;
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
        : undefined,
      musicbrainz: musicbrainz
        ? Object.freeze({
            artist: Object.freeze({
              fetch: (input: FetchMusicBrainzInput) => musicbrainz.fetchArtist(input),
              fetchSourceRecord: (input: FetchMusicBrainzInput) => musicbrainz.fetchArtistSourceRecord(input),
              search: (input: MusicBrainzSearchInput) => musicbrainz.searchArtists(input),
              searchSourceRecords: (input: MusicBrainzSearchInput) => musicbrainz.searchArtistSourceRecords(input),
              transform: (source: SourceRecord) => transformMusicBrainzArtist(source)
            }),
            label: Object.freeze({
              fetch: (input: FetchMusicBrainzInput) => musicbrainz.fetchLabel(input),
              fetchSourceRecord: (input: FetchMusicBrainzInput) => musicbrainz.fetchLabelSourceRecord(input),
              search: (input: MusicBrainzSearchInput) => musicbrainz.searchLabels(input),
              searchSourceRecords: (input: MusicBrainzSearchInput) => musicbrainz.searchLabelSourceRecords(input),
              transform: (source: SourceRecord) => transformMusicBrainzLabel(source)
            })
          })
        : undefined,
      comicvine: comicvine
        ? Object.freeze({
            character: Object.freeze({
              fetch: (input: FetchComicVineInput) => comicvine.fetchCharacter(input),
              fetchSourceRecord: (input: FetchComicVineInput) => comicvine.fetchCharacterSourceRecord(input),
              search: (input: ComicVineSearchInput) => comicvine.searchCharacters(input),
              searchSourceRecords: (input: ComicVineSearchInput) => comicvine.searchCharacterSourceRecords(input),
              transform: (source: SourceRecord) => transformComicVine(source)
            }),
            person: Object.freeze({
              fetch: (input: FetchComicVineInput) => comicvine.fetchPerson(input),
              fetchSourceRecord: (input: FetchComicVineInput) => comicvine.fetchPersonSourceRecord(input),
              search: (input: ComicVineSearchInput) => comicvine.searchPeople(input),
              searchSourceRecords: (input: ComicVineSearchInput) => comicvine.searchPersonSourceRecords(input),
              transform: (source: SourceRecord) => transformComicVine(source)
            }),
            publisher: Object.freeze({
              fetch: (input: FetchComicVineInput) => comicvine.fetchPublisher(input),
              fetchSourceRecord: (input: FetchComicVineInput) => comicvine.fetchPublisherSourceRecord(input),
              search: (input: ComicVineSearchInput) => comicvine.searchPublishers(input),
              searchSourceRecords: (input: ComicVineSearchInput) => comicvine.searchPublisherSourceRecords(input),
              transform: (source: SourceRecord) => transformComicVine(source)
            })
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
        : undefined,
      comicvine: comicvine
        ? Object.freeze({
            volume: Object.freeze({
              fetch: (input: FetchComicVineInput) => comicvine.fetchVolume(input),
              fetchSourceRecord: (input: FetchComicVineInput) => comicvine.fetchVolumeSourceRecord(input),
              search: (input: ComicVineSearchInput) => comicvine.searchVolumes(input),
              searchSourceRecords: (input: ComicVineSearchInput) => comicvine.searchVolumeSourceRecords(input),
              transform: (source: SourceRecord) => transformComicVine(source)
            }),
            issue: Object.freeze({
              fetch: (input: FetchComicVineInput) => comicvine.fetchIssue(input),
              fetchSourceRecord: (input: FetchComicVineInput) => comicvine.fetchIssueSourceRecord(input),
              search: (input: ComicVineSearchInput) => comicvine.searchIssues(input),
              searchSourceRecords: (input: ComicVineSearchInput) => comicvine.searchIssueSourceRecords(input),
              transform: (source: SourceRecord) => transformComicVine(source)
            }),
            storyArc: Object.freeze({
              fetch: (input: FetchComicVineInput) => comicvine.fetchStoryArc(input),
              fetchSourceRecord: (input: FetchComicVineInput) => comicvine.fetchStoryArcSourceRecord(input),
              search: (input: ComicVineSearchInput) => comicvine.searchStoryArcs(input),
              searchSourceRecords: (input: ComicVineSearchInput) => comicvine.searchStoryArcSourceRecords(input),
              transform: (source: SourceRecord) => transformComicVine(source)
            })
          })
        : undefined
    }),
    listen: Object.freeze({
      musicbrainz: musicbrainz
        ? Object.freeze({
            release: Object.freeze({
              fetch: (input: FetchMusicBrainzInput) => musicbrainz.fetchRelease(input),
              fetchSourceRecord: (input: FetchMusicBrainzInput) => musicbrainz.fetchReleaseSourceRecord(input),
              search: (input: MusicBrainzSearchInput) => musicbrainz.searchReleases(input),
              searchSourceRecords: (input: MusicBrainzSearchInput) => musicbrainz.searchReleaseSourceRecords(input),
              transform: (source: SourceRecord) => transformMusicBrainzRelease(source, { coverArtBaseUrl: musicbrainz.coverArtBaseUrl })
            }),
            releaseGroup: Object.freeze({
              fetch: (input: FetchMusicBrainzInput) => musicbrainz.fetchReleaseGroup(input),
              fetchSourceRecord: (input: FetchMusicBrainzInput) => musicbrainz.fetchReleaseGroupSourceRecord(input),
              search: (input: MusicBrainzSearchInput) => musicbrainz.searchReleaseGroups(input),
              searchSourceRecords: (input: MusicBrainzSearchInput) => musicbrainz.searchReleaseGroupSourceRecords(input),
              transform: (source: SourceRecord) => transformMusicBrainzReleaseGroup(source, { coverArtBaseUrl: musicbrainz.releaseGroupCoverArtBaseUrl })
            }),
            recording: Object.freeze({
              fetch: (input: FetchMusicBrainzInput) => musicbrainz.fetchRecording(input),
              fetchSourceRecord: (input: FetchMusicBrainzInput) => musicbrainz.fetchRecordingSourceRecord(input),
              search: (input: MusicBrainzSearchInput) => musicbrainz.searchRecordings(input),
              searchSourceRecords: (input: MusicBrainzSearchInput) => musicbrainz.searchRecordingSourceRecords(input),
              transform: (source: SourceRecord) => transformMusicBrainzRecording(source)
            }),
            work: Object.freeze({
              fetch: (input: FetchMusicBrainzInput) => musicbrainz.fetchWork(input),
              fetchSourceRecord: (input: FetchMusicBrainzInput) => musicbrainz.fetchWorkSourceRecord(input),
              search: (input: MusicBrainzSearchInput) => musicbrainz.searchWorks(input),
              searchSourceRecords: (input: MusicBrainzSearchInput) => musicbrainz.searchWorkSourceRecords(input),
              transform: (source: SourceRecord) => transformMusicBrainzWork(source)
            })
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
    }),
    product: Object.freeze({
      openfoodfacts: openfoodfacts
        ? Object.freeze({
            fetch: (input: FetchOpenFoodFactsProductInput) => openfoodfacts.fetchProduct(input),
            fetchSourceRecord: (input: FetchOpenFoodFactsProductInput) => openfoodfacts.fetchProductSourceRecord(input),
            search: (input: OpenFoodFactsSearchInput) => openfoodfacts.searchProducts(input),
            searchSourceRecords: (input: OpenFoodFactsSearchInput) => openfoodfacts.searchProductSourceRecords(input),
            transform: (source: SourceRecord) => transformOpenFoodFactsProduct(source)
          })
        : undefined
    }),
    visit: Object.freeze({
      openstreetmap: openstreetmap
        ? Object.freeze({
            city: Object.freeze({
              fetch: (input: FetchOpenStreetMapInput) => openstreetmap.fetchCity(input),
              fetchSourceRecord: (input: FetchOpenStreetMapInput) => openstreetmap.fetchCitySourceRecord(input),
              search: (input: OpenStreetMapSearchInput) => openstreetmap.searchCities(input),
              searchSourceRecords: (input: OpenStreetMapSearchInput) => openstreetmap.searchCitySourceRecords(input),
              transform: (source: SourceRecord) => transformOpenStreetMapPlace(source)
            }),
            country: Object.freeze({
              fetch: (input: FetchOpenStreetMapInput) => openstreetmap.fetchCountry(input),
              fetchSourceRecord: (input: FetchOpenStreetMapInput) => openstreetmap.fetchCountrySourceRecord(input),
              search: (input: OpenStreetMapSearchInput) => openstreetmap.searchCountries(input),
              searchSourceRecords: (input: OpenStreetMapSearchInput) => openstreetmap.searchCountrySourceRecords(input),
              transform: (source: SourceRecord) => transformOpenStreetMapPlace(source)
            }),
            place: Object.freeze({
              fetch: (input: FetchOpenStreetMapInput) => openstreetmap.fetchPlace(input),
              fetchSourceRecord: (input: FetchOpenStreetMapInput) => openstreetmap.fetchPlaceSourceRecord(input),
              search: (input: OpenStreetMapSearchInput) => openstreetmap.searchPlaces(input),
              searchSourceRecords: (input: OpenStreetMapSearchInput) => openstreetmap.searchPlaceSourceRecords(input),
              transform: (source: SourceRecord) => transformOpenStreetMapPlace(source)
            }),
            venue: Object.freeze({
              fetch: (input: FetchOpenStreetMapInput) => openstreetmap.fetchVenue(input),
              fetchSourceRecord: (input: FetchOpenStreetMapInput) => openstreetmap.fetchVenueSourceRecord(input),
              search: (input: OpenStreetMapSearchInput) => openstreetmap.searchVenues(input),
              searchSourceRecords: (input: OpenStreetMapSearchInput) => openstreetmap.searchVenueSourceRecords(input),
              transform: (source: SourceRecord) => transformOpenStreetMapPlace(source)
            })
          })
        : undefined
    })
  });
}
