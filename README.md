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
  category: EntityCategory;
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

## TMDB Movies

The first provider module supports fetching and transforming TMDB movies.

```ts
import { TmdbProvider } from "@zivue/zuuid/providers/tmdb";

const tmdb = new TmdbProvider({
  bearerToken: process.env.TMDB_BEARER_TOKEN!
});

const movie = await tmdb.fetchMovie({ id: 550 });

console.log(movie?.zuuid);
// 1706d641-d381-5618-9425-d8cd8b35f898
```

You can also split fetching from transformation:

```ts
import { TmdbProvider, transformTmdbMovie } from "@zivue/zuuid/providers/tmdb";

const source = await tmdb.fetchMovieSourceRecord({ id: 550 });
const movie = source ? await transformTmdbMovie(source) : undefined;
```

Movie-only imports are also available:

```ts
import { transformTmdbMovie } from "@zivue/zuuid/providers/tmdb/movie";
```

`TmdbProvider` accepts either `{ bearerToken }` or `{ apiKey }`. Fetching uses `/movie/{id}` with `append_to_response=credits,external_ids,images,keywords`.

## API

## Package Structure

The source is split by Zuuid responsibility:

- `identity.ts`: provider namespaces and UUID v5 ZUUID generation
- `entity.ts`: flat Zuuid data types and category helpers
- `providers/<provider>/index.ts`: provider module barrel
- `providers/<provider>/client.ts`: shared provider client/config
- `providers/<provider>/<category>.ts`: category-specific fetch and transform helpers
- `providers/tmdb/movie.ts`: TMDB movie fetch and transform helpers
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

Fetches TMDB movie source records and transforms them into `ZuuidData`.

### `transformTmdbMovie(sourceRecord, options?)`

Transforms an already-fetched TMDB movie source record into `ZuuidData`.

### `categoryFor(value)`

Normalizes a category and derives its entity kind.

### `kindForCategory(category)`

Maps categories such as `movie`, `book`, `game`, `restaurant`, and `person` to broad kinds such as `watch`, `read`, `play`, `visit`, and `people`.

## Development

```sh
npm install
npm test
```
