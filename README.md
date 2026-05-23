# @zivue/zuuid

Search, fetch, and normalize media metadata from external providers into a shared Zivue/Zuuid data shape.

This package is meant to be used by apps that need provider-backed lookup and transformation, but do not want provider-specific response shapes leaking through the app. It currently supports TMDB movies, TV shows, and people, plus Open Library books.

Storage, caching, indexing, review state, object-store keys, and persistence belong in a layer outside this package.

## Install

```sh
npm install @zivue/zuuid
```

## Quick Start

```ts
import { createZuuidClient } from "@zivue/zuuid";

const zuuid = createZuuidClient({
  providers: {
    tmdb: {
      bearerToken: process.env.TMDB_BEARER_TOKEN!
    },
    openlibrary: {
      // Open Library does not require credentials.
    }
  }
});

const search = await zuuid.movie.tmdb?.search({ query: "Fight Club" });
const selected = search?.results[0];
const movie = selected ? await zuuid.movie.tmdb?.fetch({ id: selected.source.value }) : undefined;

console.log(movie?.primaryTitle);
// Fight Club
```

## What You Get

The package has two main output shapes:

- `SearchResponse<ZuuidSearchResult>` for search/list screens.
- `ZuuidData` for full fetched and transformed datasets.

Search is lightweight and paginated. Fetch returns the full normalized dataset for a selected provider ID.

```ts
const movies = await zuuid.movie.tmdb?.search({ query: "Fight Club" });

console.log(movies?.pagination);
// { page: 1, totalPages: 10, totalResults: 190 }

console.log(movies?.results[0]);
// {
//   id: "1706d641-d381-5618-9425-d8cd8b35f898",
//   zuuid: "1706d641-d381-5618-9425-d8cd8b35f898",
//   category: "movie",
//   title: "Fight Club",
//   date: "1999-10-15",
//   cover: "https://image.tmdb.org/t/p/w500/...",
//   rating: 8.4,
//   weight: 20.0,
//   relationType: null,
//   attribute: null,
//   order: null,
//   source: { source: "tmdb", category: "movie", value: "550" }
// }
```

The full fetched dataset is flat and provider-normalized:

```ts
const movie = await zuuid.movie.tmdb?.fetch({ id: "550" });

console.log(movie);
// {
//   zuuid,
//   kind: "watch",
//   category: "movie",
//   primaryTitle: "Fight Club",
//   primaryDate: "1999-10-15",
//   rating,
//   cover,
//   aliases,
//   descriptions,
//   details,
//   media,
//   relations,
//   recommendations,
//   tags,
//   externalIds,
//   provenance
// }
```

Search results, relations, and recommendations share the same lightweight list item fields: `id`, `zuuid`, `category`, `title`, `date`, `cover`, `rating`, `weight`, `relationType`, `attribute`, and `order`.

## Supported Providers

| Provider | Category | Search | Fetch | Transform |
| --- | --- | --- | --- | --- |
| TMDB | movie | yes | yes | yes |
| TMDB | tv | yes | yes | yes |
| TMDB | person | yes | yes | yes |
| Open Library | book | yes | yes | yes |

## TMDB Credentials

`TmdbProvider` accepts either a TMDB API Read Access Token or a v3 API key:

```ts
import { TmdbProvider } from "@zivue/zuuid/providers/tmdb";

const tmdb = new TmdbProvider({
  bearerToken: process.env.TMDB_BEARER_TOKEN!
});

// or
const tmdbWithApiKey = new TmdbProvider({
  apiKey: process.env.TMDB_API_KEY!
});
```

TMDB bearer tokens usually start with `eyJ...`; v3 API keys are shorter hex-like strings.

## Search

Use the category-first client facade when your app may have several providers:

```ts
const movies = await zuuid.movie.tmdb?.search({ query: "Fight Club" });
const tvShows = await zuuid.tv.tmdb?.search({ query: "Game of Thrones" });
const people = await zuuid.people.tmdb?.search({ query: "Brad Pitt" });
const books = await zuuid.read.openlibrary?.search({ query: "The Lord of the Rings" });
```

Provider methods are also available directly:

```ts
const movies = await tmdb.searchMovies({ query: "Fight Club" });
const tvShows = await tmdb.searchTv({ query: "Game of Thrones" });
const people = await tmdb.searchPeople({ query: "Brad Pitt" });
```

```ts
import { OpenLibraryProvider } from "@zivue/zuuid/providers/openlibrary";

const openlibrary = new OpenLibraryProvider();
const books = await openlibrary.searchBooks({ query: "The Lord of the Rings" });
```

Search options include pagination and common TMDB filters:

```ts
const movies = await tmdb.searchMovies({
  query: "Fight Club",
  page: 2,
  includeAdult: false,
  primaryReleaseYear: 1999
});
```

If you need the raw TMDB search payload wrapped as source records:

```ts
const rawMovies = await tmdb.searchMovieSourceRecords({ query: "Fight Club" });
```

## Fetch

Fetch returns transformed `ZuuidData`:

```ts
const movie = await zuuid.movie.tmdb?.fetch({ id: 550 });
const tv = await zuuid.tv.tmdb?.fetch({ id: 1399 });
const person = await zuuid.people.tmdb?.fetch({ id: 287 });
const book = await zuuid.read.openlibrary?.fetch({ id: "OL82563W" });
```

Direct provider methods are equivalent:

```ts
const movie = await tmdb.fetchMovie({ id: 550 });
const tv = await tmdb.fetchTv({ id: 1399 });
const person = await tmdb.fetchPerson({ id: 287 });

const book = await openlibrary.fetchBook({ id: "OL82563W" });
```

## Raw Source Records And Transform

For debugging, caching in your own layer, or custom transform timing, split fetch from transform:

```ts
import { transformTmdbMovie } from "@zivue/zuuid/providers/tmdb";

const source = await tmdb.fetchMovieSourceRecord({ id: 550 });
const movie = source ? await transformTmdbMovie(source, tmdb.transformOptions()) : undefined;
```

Category-specific imports are available:

```ts
import { transformTmdbMovie } from "@zivue/zuuid/providers/tmdb/movie";
import { transformTmdbTv } from "@zivue/zuuid/providers/tmdb/tv";
import { transformTmdbPerson } from "@zivue/zuuid/providers/tmdb/person";
import { transformOpenLibraryBook } from "@zivue/zuuid/providers/openlibrary/book";
```

## Data Model

`ZuuidData` is the full normalized dataset:

```ts
type ZuuidData = {
  zuuid: string;
  kind: EntityKind;
  category: string;
  primaryTitle: string;
  primaryDate?: string;
  rating?: number;
  cover?: string;
  aliases: Alias[];
  descriptions: Description[];
  details: Detail[];
  media: MediaAsset[];
  relations: EntityRelation[];
  recommendations: RecommendationEdge[];
  tags: string[];
  externalIds: ExternalId[];
  provenance: Provenance[];
};
```

`Detail.value` can be any JSON value, so details can hold strings, numbers, booleans, arrays, or structured objects without duplicating `value` and `data` fields.

## ZUUIDs

Every fetched dataset and unified search result includes a `zuuid`. This is a deterministic UUID v5 generated from the provider namespace, category, and external ID. It gives your app a stable cross-provider identifier while the provider's own ID remains available in `source` or `externalIds`.

```ts
import { providerZuuid } from "@zivue/zuuid";

const zuuid = await providerZuuid({
  provider: "tmdb",
  category: "movie",
  externalId: "550"
});
```

Most applications do not need to call `providerZuuid` directly; search and fetch do it internally.

## Client Design

The client is stateless. It does not cache, persist, schedule, read environment variables, or write files. It only closes over provider configuration and exposes category/provider methods:

```ts
zuuid.movie.tmdb?.search({ query: "Fight Club" });
zuuid.movie.tmdb?.fetch({ id: 550 });

zuuid.tv.tmdb?.search({ query: "Game of Thrones" });
zuuid.tv.tmdb?.fetch({ id: 1399 });

zuuid.people.tmdb?.search({ query: "Brad Pitt" });
zuuid.people.tmdb?.fetch({ id: 287 });

zuuid.read.openlibrary?.search({ query: "The Lord of the Rings" });
zuuid.read.openlibrary?.fetch({ id: "OL82563W" });
```

## CLI Examples

The examples read `.env` from the repo root:

```sh
TMDB_BEARER_TOKEN=...
# or
TMDB_READ_ACCESS_TOKEN=...
# or
TMDB_API_KEY=...
```

Search a provider and print unified search results:

```sh
npm run example:search -- movie "Fight Club"
npm run example:search -- tv "Game of Thrones"
npm run example:search -- people "Brad Pitt"
npm run example:search -- book "The Lord of the Rings"
```

Fetch and transform a selected provider ID:

```sh
npm run example:fetch -- movie 550
npm run example:fetch -- tv 1399
npm run example:fetch -- people 287
npm run example:fetch -- book OL82563W
```

The examples write debug output to `data/tmdb/...` or `data/openlibrary/...`.

## API Reference

Core exports:

- `createZuuidClient(config)`
- `providerZuuid(input)`
- `providerNamespace(provider)`
- `categoryFor(value)`
- `kindForCategory(category)`
- `createSourceRecord(input)`
- `attachSourceMetadata(dataset, sourceRecord, confidence?)`

TMDB exports:

- `TmdbProvider`
- `OpenLibraryProvider`
- `transformTmdbMovie(sourceRecord, options?)`
- `transformTmdbTv(sourceRecord, options?)`
- `transformTmdbPerson(sourceRecord, options?)`
- `transformOpenLibraryBook(sourceRecord, options?)`
- `searchTmdbMovies(provider, input, options?)`
- `searchTmdbTv(provider, input, options?)`
- `searchTmdbPeople(provider, input, options?)`
- `searchOpenLibraryBooks(provider, input, options?)`

## Development

```sh
npm install
npm test
npm pack --dry-run
```

## Package Boundary

This package intentionally does not include storage, caching, object-store metadata, record versions, review state, index state, or backend flags. Those concerns should live in the consuming application or service.
