import {
  ComicVineProvider,
  GamesDbProvider,
  MusicBrainzProvider,
  OpenFoodFactsProvider,
  OpenLibraryProvider,
  OpenStreetMapProvider,
  TmdbProvider
} from "../dist/index.js";

const checks = [
  ["openlibrary search book", async () => {
    const provider = new OpenLibraryProvider();
    const result = await provider.searchBooks({ query: "The Lord of the Rings", limit: 1 });
    assertAny(result.results);
  }],
  ["openlibrary fetch book", async () => {
    const provider = new OpenLibraryProvider();
    assertPresent(await provider.fetchBook({ id: "OL82563W" }));
  }],
  ["musicbrainz search work", async () => {
    const provider = new MusicBrainzProvider();
    const result = await provider.searchWorks({ query: "Don Giovanni", limit: 1 });
    assertAny(result.results);
  }],
  ["musicbrainz fetch work", async () => {
    const provider = new MusicBrainzProvider();
    assertPresent(await provider.fetchWork({ id: "183b4b94-c13f-4fa8-87e8-64925d29754e" }));
  }],
  ["openfoodfacts search product", async () => {
    const provider = new OpenFoodFactsProvider();
    const result = await provider.searchProducts({ query: "Nutella", pageSize: 1 });
    assertAny(result.results);
  }],
  ["openfoodfacts fetch product", async () => {
    const provider = new OpenFoodFactsProvider();
    assertPresent(await provider.fetchProduct({ id: "3017620422003" }));
  }],
  ["openstreetmap search place", async () => {
    const provider = new OpenStreetMapProvider();
    const result = await provider.searchPlaces({ query: "Oslo", limit: 1 });
    assertAny(result.results);
  }],
  ["openstreetmap fetch city", async () => {
    const provider = new OpenStreetMapProvider();
    assertPresent(await provider.fetchCity({ id: "R406091" }));
  }],
  ["gamesdb search game", async () => {
    if (!process.env.GAMESDB_API_KEY) return skip("GAMESDB_API_KEY not set");
    const provider = new GamesDbProvider({ apiKey: process.env.GAMESDB_API_KEY });
    const result = await provider.searchGames({ query: "Chrono Trigger" });
    assertAny(result.results);
  }],
  ["tmdb search movie", async () => {
    const token = process.env.TMDB_BEARER_TOKEN ?? process.env.TMDB_READ_ACCESS_TOKEN;
    const apiKey = process.env.TMDB_API_KEY;
    if (!token && !apiKey) return skip("TMDB credentials not set");
    const provider = new TmdbProvider(token ? { bearerToken: token } : { apiKey });
    const result = await provider.searchMovies({ query: "Fight Club" });
    assertAny(result.results);
  }],
  ["comicvine search volume", async () => {
    if (!process.env.COMICVINE_API_KEY) return skip("COMICVINE_API_KEY not set");
    const provider = new ComicVineProvider({ apiKey: process.env.COMICVINE_API_KEY });
    const result = await provider.searchVolumes({ query: "Saga" });
    assertAny(result.results);
  }]
];

let failures = 0;
for (const [name, fn] of checks) {
  try {
    const skipped = await withTimeout(fn(), 15000);
    if (skipped) {
      console.log(`SKIP ${name}: ${skipped}`);
    } else {
      console.log(`PASS ${name}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures) process.exit(1);

function assertAny(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("expected at least one result");
}

function assertPresent(value) {
  if (!value) throw new Error("expected a result");
}

function skip(reason) {
  return reason;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms))
  ]);
}
