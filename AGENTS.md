# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Shape

This is a TypeScript ESM package for normalizing provider metadata into a shared `ZuuidData` shape.

- Source lives in `src/`.
- Tests live in `test/` and run against built `dist/` output.
- Examples live in `examples/` and also run against built `dist/` output.
- `dist/`, `data/`, and `.env` are local/generated artifacts and should not be treated as source.

## Commands

Use these before handing off changes:

```sh
npm test
```

Useful narrower checks:

```sh
npm run typecheck
npm run build
npm run example:fetch -- gamesdb:game 17444
npm run example:search -- movie "Fight Club"
```

TMDB examples require `TMDB_BEARER_TOKEN`, `TMDB_READ_ACCESS_TOKEN`, or `TMDB_API_KEY`. GamesDB examples require `GAMESDB_API_KEY`. Open Library and IMDb fetch-by-ID examples do not require credentials.

## Provider Layout

Providers should follow the existing folder pattern:

```text
src/providers/<provider>/constants.ts
src/providers/<provider>/index.ts
src/providers/<provider>/<category>.ts
```

Use `index.ts` as a barrel export only. Put provider/category constants in `constants.ts`. Put category transform logic in category files. If a provider has shared category logic, keep it in a local `transform.ts` or `helpers.ts` and expose category-specific wrapper modules when useful.

Examples:

- `src/providers/tmdb/movie.ts`
- `src/providers/openlibrary/book.ts`
- `src/providers/musicbrainz/release-group.ts`
- `src/providers/ticketmaster/event.ts`

When adding public category modules, update `package.json` `exports` so package subpath imports work.

## Live Clients vs Transformers

TMDB, Open Library, GamesDB, and IMDb have live fetch paths. Most other providers are transformer-only: they accept a `SourceRecord` containing a real raw provider payload and return `ZuuidData`.

For transformer-only providers:

```ts
const source = await createSourceRecord({
  source: { provider: "gamesdb", category: "game", externalId: "17444" },
  payload: rawPayload
});
const data = await transformGamesDbGame(source);
```

Do not add network fetch behavior unless explicitly requested. Do not add hardcoded fixture payloads to examples. Keep storage, caching, indexing, and persistence outside this package.

## Data Conventions

- `rating` must be normalized to a `0-5` scale.
- Preserve native provider ratings as a detail with key `provider_rating` when the source scale differs.
- Avoid dumping large provider blobs into `details`. Prefer compact normalized details with useful keys.
- `release_dates` should not be emitted as a transformed TMDB movie detail; keep compact `certifications` instead.
- Use `createSourceRecord` and `attachSourceMetadata` so `externalIds`, `provenance`, and content hashes stay consistent.
- Use deterministic provider UUIDs through `providerZuuid`; do not invent UUID logic.

## Entity Categories

When adding a category, update `kindForCategory` in `src/entity.ts` if the default kind would be wrong.

Common mappings:

- `watch`: movie, tv, anime, video
- `listen`: release, release-group, recording, musical_work, podcast
- `read`: book, comic, issue, story_arc, manga, magazine
- `play`: game, platform, equipment
- `visit`: city, country, place, venue
- `people`: person, artist, author, organization, label

## Tests

Add focused tests in `test/provider-transforms.test.mjs` for new transformer providers/categories. Existing broad API behavior is covered in `test/zuuid.test.mjs`.

Tests import from `../dist/index.js`, so run `npm test` rather than raw `node --test` unless you have already built.

## Examples

`examples/fetch.mjs` supports live fetch-capable providers only. Do not add inline fixture payloads to examples for transformer-only providers.

Example output should write both:

```text
data/<provider>/<category>/<id>.raw.json
data/<provider>/<category>/<id>.zuuid.json
```

## Release Metadata

When changing published behavior:

- Update `package.json` and `package-lock.json` versions together.
- Update `CHANGELOG.md` with a new section for the release.
- Keep older changelog sections stable. If changes happen after a committed release, put them in the next patch/minor section.

## Style

- TypeScript ESM imports must include `.js` extensions.
- Keep provider code dependency-free unless there is a strong reason.
- Prefer small normalized details over raw nested provider objects.
- Keep public exports explicit through provider barrels and package subpaths.
