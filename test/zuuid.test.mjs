import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachSourceMetadata,
  categoryFor,
  createSourceRecord,
  createZuuidClient,
  createZuuidData,
  externalIdFromSource,
  kindForCategory,
  providerNamespace,
  providerZuuid,
  TmdbProvider,
  transformTmdbMovie,
  transformTmdbTv
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
  assert.equal(dataset.kind, "watch");
  assert.equal(dataset.category, "movie");
  assert.equal(dataset.primaryTitle, "Fight Club");
  assert.deepEqual(dataset.externalIds, []);
  assert.equal("data" in dataset, false);
});

test("categoryFor and kindForCategory match core category grouping", () => {
  assert.deepEqual(categoryFor(" Movie "), { kind: "watch", category: "movie" });
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
  assert.equal(data.kind, "watch");
  assert.equal(data.category, "movie");
  assert.equal(data.primaryDate, "1999-10-15");
  assert.equal(data.rating, 8.4);
  assert.deepEqual(data.tags, ["drama", "thriller"]);
  assert.equal(data.externalIds.some((id) => id.source === "tmdb" && id.value === "550"), true);
  assert.equal(data.externalIds.some((id) => id.source === "imdb" && id.value === "tt0137523"), true);
  assert.equal(data.provenance.length, 1);
  assert.equal(data.cover?.includes("image.tmdb.org"), true);
});

test("transformTmdbMovie maps rich TMDB movie append payloads", async () => {
  const source = await createSourceRecord({
    source: { provider: "tmdb", category: "movie", externalId: "550" },
    payload: {
      id: 550,
      title: "Fight Club",
      original_title: "Fight Club",
      release_date: "1999-10-15",
      external_ids: { imdb_id: "tt0137523", wikidata_id: "Q190050", facebook_id: "FightClub" },
      alternative_titles: { titles: [{ iso_3166_1: "ES", title: "El club de la lucha", type: "" }] },
      translations: {
        translations: [
          {
            iso_639_1: "es",
            iso_3166_1: "ES",
            data: { title: "El club de la lucha", overview: "Una descripcion." }
          }
        ]
      },
      keywords: { keywords: [{ id: 818, name: "based on novel or book" }] },
      credits: {
        cast: [{ id: 287, name: "Brad Pitt", character: "Tyler Durden", order: 1, profile_path: "/brad.jpg" }],
        crew: [{ id: 7467, name: "David Fincher", job: "Director", profile_path: "/fincher.jpg" }]
      },
      production_companies: [{ id: 25, name: "20th Century Fox", origin_country: "US" }],
      recommendations: { results: [{ id: 641, title: "Requiem for a Dream", vote_average: 8.0 }] },
      similar: { results: [{ id: 1359, title: "American Psycho", vote_average: 7.4 }] },
      release_dates: {
        results: [
          {
            iso_3166_1: "US",
            release_dates: [{ certification: "R", release_date: "1999-10-15T00:00:00.000Z", type: 3 }]
          }
        ]
      },
      images: {
        posters: [{ file_path: "/poster.jpg", width: 100, height: 150 }],
        backdrops: [{ file_path: "/backdrop.jpg", width: 200, height: 100 }],
        logos: [{ file_path: "/logo.png" }]
      },
      origin_country: ["US"],
      production_countries: [{ iso_3166_1: "US", name: "United States of America" }],
      spoken_languages: [{ iso_639_1: "en", english_name: "English", name: "English" }],
      tagline: "Mischief. Mayhem. Soap.",
      adult: false,
      video: false
    },
    observedAt: "2026-05-14T09:00:00.000Z"
  });

  const data = await transformTmdbMovie(source);

  assert.equal(data.externalIds.some((id) => id.source === "wikidata" && id.value === "Q190050"), true);
  assert.equal(data.aliases.some((alias) => alias.value === "El club de la lucha"), true);
  assert.equal(data.descriptions.some((description) => description.language === "es"), true);
  assert.equal(data.tags.includes("based on novel or book"), true);
  assert.equal(
    data.relations.some(
      (relation) =>
        relation.relatedTitle === "Brad Pitt" &&
        relation.attribute === "Tyler Durden" &&
        relation.relatedImage?.includes("image.tmdb.org")
    ),
    true
  );
  assert.equal(data.relations.some((relation) => relation.relatedTitle === "David Fincher" && relation.relationType === "directed_by"), true);
  assert.equal(data.relations.some((relation) => relation.relatedTitle === "20th Century Fox" && relation.relatedCategory === "company"), true);
  assert.equal(data.recommendations.some((recommendation) => recommendation.targetTitle === "Requiem for a Dream"), true);
  assert.equal(data.recommendations.some((recommendation) => recommendation.targetTitle === "American Psycho"), true);
  assert.equal(data.media.some((media) => media.mediaCategory === "logo"), true);
  assert.equal(data.details.some((detail) => detail.key === "tagline"), true);
  assert.equal(data.details.some((detail) => detail.key === "origin_country" && Array.isArray(detail.data)), true);
  assert.equal(data.details.some((detail) => detail.key === "certifications" && detail.data?.[0]?.certification === "R"), true);
  assert.equal(data.details.some((detail) => detail.key === "release_dates" && detail.data?.[0]?.iso_3166_1 === "US"), true);
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
  assert.equal(
    requestedUrl.searchParams.get("append_to_response"),
    "alternative_titles,credits,external_ids,images,keywords,recommendations,similar,translations,release_dates"
  );
  assert.deepEqual(source?.source, { provider: "tmdb", category: "movie", externalId: "550" });
});

test("transformTmdbTv maps a TMDB tv source record into Zuuid data", async () => {
  const source = await createSourceRecord({
    source: { provider: "tmdb", category: "tv", externalId: "1399" },
    payload: {
      id: 1399,
      name: "Game of Thrones",
      original_name: "Game of Thrones",
      overview: "Seven noble families fight for control.",
      first_air_date: "2011-04-17",
      vote_average: 8.5,
      poster_path: "/tv.jpg",
      original_language: "en",
      adult: false,
      episode_run_time: [60],
      genres: [{ id: 18, name: "Drama" }],
      in_production: false,
      languages: ["en"],
      last_episode_to_air: { id: 1551830, name: "The Iron Throne", episode_number: 6, season_number: 8 },
      number_of_seasons: 8,
      number_of_episodes: 73,
      production_countries: [{ iso_3166_1: "US", name: "United States of America" }],
      softcore: false,
      tagline: "Winter is coming.",
      external_ids: { imdb_id: "tt0944947", tvdb_id: 121361 },
      created_by: [{ id: 9813, name: "David Benioff", profile_path: "/benioff.jpg" }],
      aggregate_credits: {
        cast: [
          {
            id: 22970,
            name: "Kit Harington",
            profile_path: "/kit.jpg",
            roles: [{ character: "Jon Snow", episode_count: 62 }],
            total_episode_count: 62
          }
        ],
        crew: [
          {
            id: 9813,
            name: "David Benioff",
            profile_path: "/benioff.jpg",
            department: "Production",
            jobs: [{ job: "Executive Producer", episode_count: 73 }],
            total_episode_count: 73
          }
        ]
      },
      content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-MA", descriptors: ["violence"] }] },
      images: {
        posters: [{ file_path: "/poster-alt.jpg", width: 1000, height: 1500, vote_average: 5.5 }]
      },
      seasons: [{ season_number: 1, name: "Season 1", poster_path: "/s1.jpg", episode_count: 10 }]
    },
    observedAt: "2026-05-14T09:00:00.000Z"
  });

  const data = await transformTmdbTv(source);

  assert.equal(data.primaryTitle, "Game of Thrones");
  assert.equal(data.kind, "watch");
  assert.equal(data.category, "tvshow");
  assert.equal(data.primaryDate, "2011-04-17");
  assert.equal(data.rating, 8.5);
  assert.equal(data.tags.includes("drama"), true);
  assert.equal(data.externalIds.some((id) => id.source === "imdb" && id.value === "tt0944947"), true);
  assert.equal(data.externalIds.some((id) => id.source === "tvdb" && id.value === "121361"), true);
  assert.equal(
    data.relations.some(
      (relation) =>
        relation.relatedTitle === "David Benioff" &&
        relation.relationType === "creator" &&
        relation.relatedImage?.includes("image.tmdb.org")
    ),
    true
  );
  assert.equal(
    data.relations.some(
      (relation) =>
        relation.relatedTitle === "Kit Harington" &&
        relation.attribute === "Jon Snow" &&
        relation.relatedImage?.includes("image.tmdb.org") &&
        relation.data?.total_episode_count === 62
    ),
    true
  );
  assert.equal(
    data.relations.some(
      (relation) =>
        relation.relatedTitle === "David Benioff" &&
        relation.relationType === "produced_by" &&
        relation.attribute === "Executive Producer" &&
        relation.data?.total_episode_count === 73
    ),
    true
  );
  assert.equal(
    data.relations.some(
      (relation) =>
        relation.relatedTitle === "Season 1" &&
        relation.relatedCategory === "tvseason" &&
        relation.data?.episode_count === 10
    ),
    true
  );
  assert.equal(data.cover?.includes("image.tmdb.org"), true);
  assert.equal(data.media.some((media) => media.mediaCategory === "poster" && media.data?.width === 1000), true);
  assert.equal(data.details.some((detail) => detail.key === "tagline" && detail.value === "Winter is coming."), true);
  assert.equal(data.details.some((detail) => detail.key === "adult" && detail.value === "false"), true);
  assert.equal(data.details.some((detail) => detail.key === "in_production" && detail.value === "false"), true);
  assert.equal(data.details.some((detail) => detail.key === "softcore" && detail.value === "false"), true);
  assert.equal(data.details.some((detail) => detail.key === "episode_run_time" && detail.data?.[0] === 60), true);
  assert.equal(data.details.some((detail) => detail.key === "languages" && detail.data?.[0] === "en"), true);
  assert.equal(data.details.some((detail) => detail.key === "production_countries" && detail.data?.[0]?.iso_3166_1 === "US"), true);
  assert.equal(data.details.some((detail) => detail.key === "certifications" && detail.data?.[0]?.certification === "TV-MA"), true);
  assert.equal(data.details.some((detail) => detail.key === "content_ratings" && detail.data?.[0]?.rating === "TV-MA"), true);
  assert.equal(data.details.some((detail) => detail.key === "last_episode_to_air" && detail.data?.name === "The Iron Throne"), true);
});

test("TmdbProvider fetchTvSourceRecord requests tv details with API key credentials", async () => {
  let requestedUrl;
  const provider = new TmdbProvider({
    apiKey: "test-key",
    fetch: async (url) => {
      requestedUrl = new URL(url.toString());
      return new Response(JSON.stringify({ id: 1399, name: "Game of Thrones" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const source = await provider.fetchTvSourceRecord({ id: 1399 });

  assert.equal(requestedUrl.pathname, "/3/tv/1399");
  assert.equal(requestedUrl.searchParams.get("api_key"), "test-key");
  assert.equal(requestedUrl.searchParams.get("language"), "en-US");
  assert.equal(
    requestedUrl.searchParams.get("append_to_response"),
    "aggregate_credits,external_ids,images,keywords,recommendations,similar,translations,content_ratings"
  );
  assert.deepEqual(source?.source, { provider: "tmdb", category: "tv", externalId: "1399" });
});

test("createZuuidClient exposes a category-first provider facade", async () => {
  let requestedUrl;
  const client = createZuuidClient({
    providers: {
      tmdb: {
        bearerToken: "test-token",
        fetch: async (url, init) => {
          requestedUrl = { url: new URL(url.toString()), init };
          return new Response(JSON.stringify({ id: 550, title: "Fight Club" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }
    }
  });

  const source = await client.movie.tmdb?.fetchSourceRecord({ id: 550 });

  assert.equal(requestedUrl.url.pathname, "/3/movie/550");
  assert.equal(requestedUrl.init.headers.get("authorization"), "Bearer test-token");
  assert.deepEqual(source?.source, { provider: "tmdb", category: "movie", externalId: "550" });
  assert.equal(createZuuidClient().movie.tmdb, undefined);
  assert.equal(createZuuidClient().tv.tmdb, undefined);
});

test("createZuuidClient exposes tmdb tv facade", async () => {
  let requestedUrl;
  const client = createZuuidClient({
    providers: {
      tmdb: {
        bearerToken: "test-token",
        fetch: async (url, init) => {
          requestedUrl = { url: new URL(url.toString()), init };
          return new Response(JSON.stringify({ id: 1399, name: "Game of Thrones" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }
    }
  });

  const source = await client.tv.tmdb?.fetchSourceRecord({ id: 1399 });

  assert.equal(requestedUrl.url.pathname, "/3/tv/1399");
  assert.equal(requestedUrl.init.headers.get("authorization"), "Bearer test-token");
  assert.deepEqual(source?.source, { provider: "tmdb", category: "tv", externalId: "1399" });
});
