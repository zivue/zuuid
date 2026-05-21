import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachSourceMetadata,
  categoryFor,
  createSourceRecord,
  createZuuidData,
  externalIdFromSource,
  kindForCategory,
  providerNamespace,
  providerZuuid,
  TmdbProvider,
  transformTmdbMovie
} from "../dist/index.js";

test("providerZuuid matches the Rust provider-stable UUID v5 generation", async () => {
  assert.equal(
    await providerZuuid({ provider: "tmdb", category: "movie", externalId: "550" }),
    "1706d641-d381-5618-9425-d8cd8b35f898"
  );
});

test("providerZuuid normalizes category but preserves external id text", async () => {
  assert.equal(
    await providerZuuid({ provider: "tmdb", category: " Movie ", externalId: "550" }),
    await providerZuuid({ provider: "tmdb", category: "movie", externalId: "550" })
  );
});

test("providerNamespace exposes known Zuuid namespaces", () => {
  assert.equal(providerNamespace("tmdb"), "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  assert.equal(providerNamespace("unknown"), undefined);
});

test("createZuuidData returns the canonical flat Zuuid data shape", () => {
  const dataset = createZuuidData({
    zuuid: "1706d641-d381-5618-9425-d8cd8b35f898",
    category: "movie",
    primaryTitle: "Fight Club"
  });

  assert.equal(dataset.zuuid, "1706d641-d381-5618-9425-d8cd8b35f898");
  assert.deepEqual(dataset.category, { kind: "watch", value: "movie" });
  assert.equal(dataset.primaryTitle, "Fight Club");
  assert.deepEqual(dataset.externalIds, []);
  assert.equal("data" in dataset, false);
});

test("categoryFor and kindForCategory match core category grouping", () => {
  assert.deepEqual(categoryFor(" Movie "), { kind: "watch", value: "movie" });
  assert.equal(kindForCategory("book"), "read");
  assert.equal(kindForCategory("restaurant"), "visit");
  assert.equal(kindForCategory("collection"), "collection");
});

test("createSourceRecord hashes payloads and attachSourceMetadata updates the record structure", async () => {
  const source = await createSourceRecord({
    source: { provider: "tmdb", category: "movie", externalId: "550" },
    payload: { title: "Fight Club" },
    observedAt: "2026-05-21T00:00:00.000Z",
    publishedAt: "1999-10-15T00:00:00.000Z"
  });
  const dataset = createZuuidData({
    zuuid: "1706d641-d381-5618-9425-d8cd8b35f898",
    category: "movie",
    primaryTitle: "Fight Club"
  });
  const updated = attachSourceMetadata(dataset, source);
  const updatedAgain = attachSourceMetadata(updated, source);

  assert.equal(source.contentHash, "48721602fa56dcc1587ab952f14a4514cb34de03f006ed4a9002bd339ae46510");
  assert.deepEqual(externalIdFromSource(source.source), { source: "tmdb", category: "movie", value: "550" });
  assert.deepEqual(updated.externalIds, [{ source: "tmdb", category: "movie", value: "550" }]);
  assert.equal(updated.provenance.length, 1);
  assert.deepEqual(updatedAgain.externalIds, updated.externalIds);
  assert.deepEqual(updatedAgain.provenance, updated.provenance);
});

test("transformTmdbMovie maps a TMDB movie source record into Zuuid data", async () => {
  const source = await createSourceRecord({
    source: { provider: "tmdb", category: "movie", externalId: "550" },
    payload: {
      id: 550,
      title: "Fight Club",
      original_title: "Fight Club",
      overview: "A ticking-time-bomb insomniac meets a soap salesman.",
      release_date: "1999-10-15",
      vote_average: 8.4,
      vote_count: 28931,
      poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      backdrop_path: "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",
      original_language: "en",
      genres: [
        { id: 18, name: "Drama" },
        { id: 53, name: "Thriller" }
      ],
      imdb_id: "tt0137523",
      runtime: 139,
      status: "Released"
    },
    observedAt: "2026-05-14T09:00:00.000Z"
  });

  const data = await transformTmdbMovie(source);

  assert.equal(data.zuuid, "1706d641-d381-5618-9425-d8cd8b35f898");
  assert.equal(data.primaryTitle, "Fight Club");
  assert.deepEqual(data.category, { kind: "watch", value: "movie" });
  assert.equal(data.primaryDate, "1999-10-15");
  assert.equal(data.rating, 8.4);
  assert.deepEqual(data.tags, ["drama", "thriller"]);
  assert.equal(data.externalIds.some((id) => id.source === "tmdb" && id.value === "550"), true);
  assert.equal(data.externalIds.some((id) => id.source === "imdb" && id.value === "tt0137523"), true);
  assert.equal(data.provenance.length, 1);
  assert.equal(data.cover?.includes("image.tmdb.org"), true);
});

test("TmdbProvider fetchMovieSourceRecord requests movie details with API key credentials", async () => {
  let requestedUrl;
  const provider = new TmdbProvider({
    apiKey: "test-key",
    fetch: async (url) => {
      requestedUrl = new URL(url.toString());
      return new Response(JSON.stringify({ id: 550, title: "Fight Club" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const source = await provider.fetchMovieSourceRecord({ id: 550 });

  assert.equal(requestedUrl.pathname, "/3/movie/550");
  assert.equal(requestedUrl.searchParams.get("api_key"), "test-key");
  assert.equal(requestedUrl.searchParams.get("language"), "en-US");
  assert.equal(requestedUrl.searchParams.get("append_to_response"), "credits,external_ids,images,keywords");
  assert.deepEqual(source?.source, { provider: "tmdb", category: "movie", externalId: "550" });
});
