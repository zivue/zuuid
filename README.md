# @zivue/zuuid

Unified IDs and a unified data structure for typed content.

`@zivue/zuuid` is the small core for representing things consistently. It creates deterministic IDs from content, parses those IDs, and wraps JSON-compatible data in one predictable record shape.

The package has no runtime dependencies and works in modern Node.js and browser runtimes with Web Crypto support.

## Install

```sh
npm install @zivue/zuuid
```

## Usage

```ts
import { createZuuidRecord } from "@zivue/zuuid";

const record = await createZuuidRecord({
  type: "application/vnd.zivue.reaction+json",
  data: {
    title: "Heat",
    rating: 5,
    tags: ["movie", "favorite"]
  },
  meta: {
    source: "import"
  }
});

console.log(record.id);
// zuuid:v1:application/vnd.zivue.reaction+json:sha256:<digest>

console.log(record.data.title);
// Heat
```

## ID Format

A ZUUID is a deterministic, content-derived identifier:

```txt
zuuid:v1:<normalized-type>:sha256:<hex-digest>
```

The type is normalized to lowercase and may be a media type, vendor type, or other MIME-compatible content type.

## Unified Record

`createZuuidRecord(input)` returns one stable structure:

```ts
type ZuuidRecord<TData> = {
  id: string;
  version: 1;
  type: string;
  mediaType: string;
  algorithm: "sha256";
  digest: string;
  data: TData;
  meta: Record<string, JsonValue>;
  links: Record<string, string | string[]>;
};
```

The ID is derived from canonical JSON, so object key order does not change the ID.

## Lower-Level API

### `createZuuid(input)`

Creates an ID from raw bytes and a type.

```ts
const id = await createZuuid({
  bytes: "hello",
  mediaType: "text/plain"
});
```

### `parseZuuid(id)`

Parses and validates an ID created by this package.

### `createMediaDescriptor(input)`

Creates a file-oriented descriptor with byte length, extension, and a storage key. This is a convenience helper for media/file pipelines built on top of the generic ZUUID format.

### `formatStorageKey(input)`

Formats a deterministic sharded key from a ZUUID:

```txt
<prefix>/sha256/<first-2>/<next-2>/<safe-id>.<extension>
```

## Development

```sh
npm install
npm test
```
