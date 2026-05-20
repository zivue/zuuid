# @zivue/zuuid

TypeScript helpers for the Zuuid core model.

Zuuid is the metadata, search, and indexing substrate for Zivue/Stareto. The core model uses deterministic provider-stable UUIDs, canonical entity records, and sharded entity record keys.

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

## Entity Record

```ts
import { createEntityRecord } from "@zivue/zuuid";

const record = createEntityRecord({
  zuuid: "1706d641-d381-5618-9425-d8cd8b35f898",
  category: "movie",
  primaryTitle: "Fight Club"
});
```

The record shape follows `ZuuidEntityRecord` from `zuuid-core`:

```ts
type ZuuidEntityRecord = {
  zuuid: string;
  public: EntityPublicData;
  internal: EntityInternalData;
  record: RecordMetadata;
};
```

`public` contains searchable/display metadata such as `kind`, `category`, `primaryTitle`, aliases, descriptions, details, media, relations, recommendations, tags, external IDs, and provenance.

`internal` contains matching/review/index/source-payload state.

`record` contains schema/version/timestamp/hash metadata.

## Record Key

Entity records are sharded by the first four hex characters of the UUID without dashes:

```ts
import { entityRecordKey } from "@zivue/zuuid";

entityRecordKey("1706d641-d381-5618-9425-d8cd8b35f898");
// entities/17/06/1706d641-d381-5618-9425-d8cd8b35f898.json
```

## API

### `providerZuuid(input)`

Generates a deterministic ZUUID for a provider/category/external ID.

### `providerNamespace(provider)`

Returns the UUID namespace configured for a known provider.

### `createEntityRecord(input)`

Creates the canonical entity record shell with default public/internal/record fields.

### `categoryFor(value)`

Normalizes a category and derives its entity kind.

### `kindForCategory(category)`

Maps categories such as `movie`, `book`, `game`, `restaurant`, and `person` to broad kinds such as `watch`, `read`, `play`, `visit`, and `people`.

### `entityRecordKey(zuuid, extension?)`

Formats the sharded storage key for an entity record. The default extension is `json`.

## Development

```sh
npm install
npm test
```
