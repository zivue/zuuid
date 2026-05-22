# @zivue/zuuid

TypeScript helpers for fetching, searching, and transforming Zuuid datasets.

Zuuid is the metadata, search, and indexing substrate for Zivue/Stareto. This package focuses on the client-side model: provider-stable UUIDs, source records, and normalized Zuuid datasets.

Storage, caching, object keys, and persistence belong in a layer outside this package.

## Install

```sh
npm install @zivue/zuuid
```

## Generate A ZUUID

Zuuid generation is UUID v5:

```txt
uuid_v5(provider_namespace, "<normalized-category>:<external_id>")
```

```ts
import { providerZuuid } from "@zivue/zuuid";

const zuuid = await providerZuuid({
  provider: "tmdb",
  category: "movie",
  externalId: "550"
});

console.log(zuuid);
// 1706d641-d381-5618-9425-d8cd8b35f898
```

`category` is trimmed and lowercased. `externalId` is trimmed but otherwise preserved.

## Zuuid Dataset

```ts
import { createZuuidData } from "@zivue/zuuid";

const dataset = createZuuidData({
  zuuid: "1706d641-d381-5618-9425-d8cd8b35f898",
  category: "movie",
  primaryTitle: "Fight Club"
});
```

The dataset shape is intentionally flat:

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

Relations and recommendations can include provider/display hints such as titles, categories, external IDs, cover URLs, and dates. That lets a transformed dataset carry useful related-entity context before those related entities are fetched as full Zuuid datasets.

Backend-only concerns such as record versions, flags, review state, index state, and object-store metadata are intentionally not part of this package's dataset shape.

## Source Metadata

Source records are provider records before they are transformed into canonical entities. They carry the external provider key, raw JSON payload, content hash, and observation timestamps.

```ts
import { attachSourceMetadata, createSourceRecord } from "@zivue/zuuid";

const source = await createSourceRecord({
  source: { provider: "tmdb", category: "movie", externalId: "550" },
  payload: { title: "Fight Club" },
  observedAt: "2026-05-21T00:00:00.000Z"
});

const withSource = attachSourceMetadata(dataset, source);
```

`attachSourceMetadata` returns a new dataset with `externalIds` and `provenance` updated.

## TMDB Movies, TV, And People

The first provider module supports fetching and transforming TMDB movies, TV shows, and people.

```ts
import { TmdbProvider } from "@zivue/zuuid/providers/tmdb";

const tmdb = new TmdbProvider({
  bearerToken: process.env.TMDB_BEARER_TOKEN!
});

const movie = await tmdb.fetchMovie({ id: 550 });
const tv = await tmdb.fetchTv({ id: 1399 });
const person = await tmdb.fetchPerson({ id: 287 });

console.log(movie?.zuuid);
// 1706d641-d381-5618-9425-d8cd8b35f898
```

You can also split fetching from transformation:

```ts
import { TmdbProvider, transformTmdbMovie, transformTmdbPerson, transformTmdbTv } from "@zivue/zuuid/providers/tmdb";

const source = await tmdb.fetchMovieSourceRecord({ id: 550 });
const movie = source ? await transformTmdbMovie(source) : undefined;

const tvSource = await tmdb.fetchTvSourceRecord({ id: 1399 });
const tv = tvSource ? await transformTmdbTv(tvSource) : undefined;

const personSource = await tmdb.fetchPersonSourceRecord({ id: 287 });
const person = personSource ? await transformTmdbPerson(personSource) : undefined;
```

Search returns lightweight source records from TMDB's search endpoints. Use search to find candidate IDs, then fetch the selected item for the full transformed dataset:

```ts
const movies = await tmdb.searchMovieSourceRecords({ query: "Fight Club" });
const tvShows = await tmdb.searchTvSourceRecords({ query: "Game of Thrones" });
const people = await tmdb.searchPersonSourceRecords({ query: "Brad Pitt" });

const selectedMovie = movies[0];
const fullMovie = selectedMovie ? await tmdb.fetchMovie({ id: selectedMovie.source.externalId }) : undefined;
```

Category-specific imports are also available:

```ts
import { transformTmdbMovie } from "@zivue/zuuid/providers/tmdb/movie";
import { transformTmdbTv } from "@zivue/zuuid/providers/tmdb/tv";
import { transformTmdbPerson } from "@zivue/zuuid/providers/tmdb/person";
```

`TmdbProvider` accepts either `{ bearerToken }` or `{ apiKey }`.

## Client Instantiation

For applications with multiple providers, use `createZuuidClient` to wire provider config once:

```ts
import { createZuuidClient } from "@zivue/zuuid";

const zuuid = createZuuidClient({
  providers: {
    tmdb: {
      bearerToken: process.env.TMDB_BEARER_TOKEN!
    }
    // Future movie providers can sit beside tmdb, e.g. omdb.
  }
});

const movie = await zuuid.movie.tmdb?.fetch({ id: 550 });
const tv = await zuuid.tv.tmdb?.fetch({ id: 1399 });
const person = await zuuid.people.tmdb?.fetch({ id: 287 });
```

The config is provider-keyed because apps usually manage credentials per provider. The client facade is category-first, so multiple movie providers can live under `zuuid.movie`:

```ts
zuuid.movie.tmdb?.fetch({ id: 550 });
zuuid.tv.tmdb?.fetch({ id: 1399 });
zuuid.people.tmdb?.fetch({ id: 287 });

zuuid.movie.tmdb?.search({ query: "Fight Club" });
zuuid.tv.tmdb?.search({ query: "Game of Thrones" });
zuuid.people.tmdb?.search({ query: "Brad Pitt" });
// later: zuuid.movie.omdb?.fetch(...)
```

The client is stateless: it does not cache, persist, schedule, or read environment variables. It only closes over provider configuration and exposes category/provider methods.

## API

## Package Structure

The source is split by Zuuid responsibility:

- `identity.ts`: provider namespaces and UUID v5 ZUUID generation
- `entity.ts`: flat Zuuid data types and category helpers
- `client.ts`: stateless package instantiator for configured providers
- `providers/<provider>/index.ts`: provider module barrel
- `providers/<provider>/client.ts`: shared provider client/config
- `providers/<provider>/<category>.ts`: category-specific fetch and transform helpers
- `providers/tmdb/movie.ts`: TMDB movie fetch and transform helpers
- `providers/tmdb/tv.ts`: TMDB TV fetch and transform helpers
- `providers/tmdb/person.ts`: TMDB person fetch and transform helpers
- `source.ts`: source records, external IDs, and provenance
- `hash.ts`: stable payload hashing
- `uuid.ts`: UUID parsing/normalization and UUID v5 internals
- `types.ts`: shared JSON value types
- `index.ts`: public barrel exports

### `providerZuuid(input)`

Generates a deterministic ZUUID for a provider/category/external ID.

### `providerNamespace(provider)`

Returns the UUID namespace configured for a known provider.

### `createZuuidData(input)`

Creates a normalized Zuuid dataset.

### `createSourceRecord(input)`

Creates a source record and computes the SHA-256 payload hash used for provenance.

### `attachSourceMetadata(dataset, sourceRecord, confidence?)`

Returns a new dataset with external ID and provenance attached.

### `TmdbProvider`

Fetches TMDB source records and transforms them into `ZuuidData`.

### `transformTmdbMovie(sourceRecord, options?)`

Transforms an already-fetched TMDB movie source record into `ZuuidData`.

### `transformTmdbTv(sourceRecord, options?)`

Transforms an already-fetched TMDB TV source record into `ZuuidData`.

### `transformTmdbPerson(sourceRecord, options?)`

Transforms an already-fetched TMDB person source record into `ZuuidData`.

### `categoryFor(value)`

Normalizes a category and derives its entity kind.

### `kindForCategory(category)`

Maps categories such as `movie`, `book`, `game`, `restaurant`, and `person` to broad kinds such as `watch`, `read`, `play`, `visit`, and `people`.

## Development

```sh
npm install
npm test
```

## Try It

Fetch and transform TMDB movie `550`:

```sh
TMDB_BEARER_TOKEN=... npm run example:tmdb -- movie 550
```

or:

```sh
TMDB_API_KEY=... npm run example:tmdb -- movie 550
```

Fetch and transform TMDB TV show `1399`:

```sh
TMDB_BEARER_TOKEN=... npm run example:tmdb -- tv 1399
```

Fetch and transform TMDB person `287`:

```sh
TMDB_BEARER_TOKEN=... npm run example:tmdb -- people 287
```

The example also reads `.env` from the repo root:

```sh
TMDB_BEARER_TOKEN=...
# or
TMDB_READ_ACCESS_TOKEN=...
# or
TMDB_API_KEY=...
```

If both token and API key are present, the example uses the bearer token first. TMDB's API Read Access Token usually starts with `eyJ...`; the v3 API key is a shorter hex-like string.

If `TMDB_API_KEY` accidentally contains a token starting with `eyJ`, the example treats it as a bearer token and sends it as `Authorization: Bearer ...`.

The example writes debug output to:

```txt
data/tmdb/movie/550.raw.json
data/tmdb/movie/550.zuuid.json
data/tmdb/tv/1399.raw.json
data/tmdb/tv/1399.zuuid.json
data/tmdb/people/287.raw.json
data/tmdb/people/287.zuuid.json
```
