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
  transformTmdbPerson,
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
  assert.equal(data.details.some((detail) => detail.key === "origin_country" && Array.isArray(detail.value)), true);
  assert.equal(data.details.some((detail) => detail.key === "certifications" && detail.value?.[0]?.certification === "R"), true);
  assert.equal(data.details.some((detail) => detail.key === "release_dates" && detail.value?.[0]?.iso_3166_1 === "US"), true);
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
  assert.equal(data.details.some((detail) => detail.key === "adult" && detail.value === false), true);
  assert.equal(data.details.some((detail) => detail.key === "in_production" && detail.value === false), true);
  assert.equal(data.details.some((detail) => detail.key === "softcore" && detail.value === false), true);
  assert.equal(data.details.some((detail) => detail.key === "episode_run_time" && detail.value?.[0] === 60), true);
  assert.equal(data.details.some((detail) => detail.key === "languages" && detail.value?.[0] === "en"), true);
  assert.equal(data.details.some((detail) => detail.key === "production_countries" && detail.value?.[0]?.iso_3166_1 === "US"), true);
  assert.equal(data.details.some((detail) => detail.key === "certifications" && detail.value?.[0]?.certification === "TV-MA"), true);
  assert.equal(data.details.some((detail) => detail.key === "content_ratings" && detail.value?.[0]?.rating === "TV-MA"), true);
  assert.equal(data.details.some((detail) => detail.key === "last_episode_to_air" && detail.value?.name === "The Iron Throne"), true);
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

test("transformTmdbPerson maps a TMDB person source record into Zuuid data", async () => {
  const source = await createSourceRecord({
    source: { provider: "tmdb", category: "person", externalId: "287" },
    payload: {
      id: 287,
      name: "Brad Pitt",
      also_known_as: ["William Bradley Pitt"],
      biography: "William Bradley Pitt is an American actor.",
      birthday: "1963-12-18",
      gender: 2,
      homepage: "https://example.com/brad",
      known_for_department: "Acting",
      place_of_birth: "Shawnee, Oklahoma, USA",
      popularity: 12.5,
      profile_path: "/brad.jpg",
      external_ids: { imdb_id: "nm0000093", wikidata_id: "Q35332" },
      combined_credits: {
        cast: [
          {
            id: 550,
            title: "Fight Club",
            media_type: "movie",
            character: "Tyler Durden",
            poster_path: "/fight.jpg",
            release_date: "1999-10-15",
            vote_average: 8.4,
            credit_id: "abc"
          }
        ],
        crew: [
          {
            id: 641,
            title: "Requiem for a Dream",
            media_type: "movie",
            job: "Producer",
            poster_path: "/requiem.jpg",
            release_date: "2000-10-06"
          }
        ]
      },
      images: {
        profiles: [{ file_path: "/brad-alt.jpg", width: 1000, height: 1500, vote_average: 5.5, vote_count: 3 }]
      }
    },
    observedAt: "2026-05-22T09:00:00.000Z"
  });

  const data = await transformTmdbPerson(source);

  assert.equal(data.primaryTitle, "Brad Pitt");
  assert.equal(data.kind, "people");
  assert.equal(data.category, "person");
  assert.equal(data.primaryDate, "1963-12-18");
  assert.equal(data.cover?.includes("image.tmdb.org"), true);
  assert.equal(data.aliases.some((alias) => alias.value === "William Bradley Pitt"), true);
  assert.equal(data.descriptions.some((description) => description.value.includes("American actor")), true);
  assert.equal(data.externalIds.some((id) => id.source === "imdb" && id.value === "nm0000093"), true);
  assert.equal(data.details.some((detail) => detail.key === "gender" && detail.value === 2), true);
  assert.equal(data.details.some((detail) => detail.key === "known_for_department" && detail.value === "Acting"), true);
  assert.equal(
    data.relations.some(
      (relation) =>
        relation.relatedTitle === "Fight Club" &&
        relation.relationType === "appears_in" &&
        relation.relatedCategory === "movie" &&
        relation.relatedImage?.includes("image.tmdb.org") &&
        relation.data?.voteAverage === 8.4
    ),
    true
  );
  assert.equal(data.relations.some((relation) => relation.relatedTitle === "Requiem for a Dream" && relation.relationType === "produced"), true);
  assert.equal(data.media.some((media) => media.mediaCategory === "profile" && media.data?.voteAverage === 5.5), true);
});

test("TmdbProvider fetchPersonSourceRecord requests person details with API key credentials", async () => {
  let requestedUrl;
  const provider = new TmdbProvider({
    apiKey: "test-key",
    fetch: async (url) => {
      requestedUrl = new URL(url.toString());
      return new Response(JSON.stringify({ id: 287, name: "Brad Pitt" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const source = await provider.fetchPersonSourceRecord({ id: 287 });

  assert.equal(requestedUrl.pathname, "/3/person/287");
  assert.equal(requestedUrl.searchParams.get("api_key"), "test-key");
  assert.equal(requestedUrl.searchParams.get("language"), "en-US");
  assert.equal(requestedUrl.searchParams.get("append_to_response"), "combined_credits,external_ids,images");
  assert.deepEqual(source?.source, { provider: "tmdb", category: "person", externalId: "287" });
});

test("TmdbProvider searches movie, tv, and person source records", async () => {
  const requestedUrls = [];
  const provider = new TmdbProvider({
    apiKey: "test-key",
    fetch: async (url) => {
      const requestedUrl = new URL(url.toString());
      requestedUrls.push(requestedUrl);
      const result =
        requestedUrl.pathname === "/3/search/movie"
          ? { id: 550, title: "Fight Club" }
          : requestedUrl.pathname === "/3/search/tv"
            ? { id: 1399, name: "Game of Thrones" }
            : { id: 287, name: "Brad Pitt" };
      return new Response(JSON.stringify({ page: 1, results: [result], total_pages: 1, total_results: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const movies = await provider.searchMovieSourceRecords({ query: "fight", page: 2, includeAdult: true, primaryReleaseYear: 1999 });
  const tv = await provider.searchTvSourceRecords({ query: "game", firstAirDateYear: 2011 });
  const people = await provider.searchPersonSourceRecords({ query: "brad" });

  assert.equal(requestedUrls[0].pathname, "/3/search/movie");
  assert.equal(requestedUrls[0].searchParams.get("query"), "fight");
  assert.equal(requestedUrls[0].searchParams.get("page"), "2");
  assert.equal(requestedUrls[0].searchParams.get("include_adult"), "true");
  assert.equal(requestedUrls[0].searchParams.get("primary_release_year"), "1999");
  assert.equal(requestedUrls[0].searchParams.get("api_key"), "test-key");
  assert.deepEqual(movies.results[0]?.source, { provider: "tmdb", category: "movie", externalId: "550" });
  assert.deepEqual(movies.pagination, { page: 1, totalPages: 1, totalResults: 1 });

  assert.equal(requestedUrls[1].pathname, "/3/search/tv");
  assert.equal(requestedUrls[1].searchParams.get("query"), "game");
  assert.equal(requestedUrls[1].searchParams.get("first_air_date_year"), "2011");
  assert.deepEqual(tv.results[0]?.source, { provider: "tmdb", category: "tv", externalId: "1399" });
  assert.deepEqual(tv.pagination, { page: 1, totalPages: 1, totalResults: 1 });

  assert.equal(requestedUrls[2].pathname, "/3/search/person");
  assert.equal(requestedUrls[2].searchParams.get("query"), "brad");
  assert.deepEqual(people.results[0]?.source, { provider: "tmdb", category: "person", externalId: "287" });
  assert.deepEqual(people.pagination, { page: 1, totalPages: 1, totalResults: 1 });
});

test("TmdbProvider searches unified movie, tv, and people results", async () => {
  const provider = new TmdbProvider({
    apiKey: "test-key",
    fetch: async (url) => {
      const requestedUrl = new URL(url.toString());
      const result =
        requestedUrl.pathname === "/3/search/movie"
          ? {
              id: 550,
              title: "Fight Club",
              release_date: "1999-10-15",
              poster_path: "/fight.jpg",
              overview: "A soap salesman.",
              vote_average: 8.4,
              popularity: 20
            }
          : requestedUrl.pathname === "/3/search/tv"
            ? {
                id: 1399,
                name: "Game of Thrones",
                first_air_date: "2011-04-17",
                poster_path: "/got.jpg",
                overview: "Seven noble families.",
                vote_average: 8.5,
                popularity: 30
              }
            : {
                id: 287,
                name: "Brad Pitt",
                profile_path: "/brad.jpg",
                known_for_department: "Acting",
                popularity: 40
              };
      return new Response(JSON.stringify({ page: 1, results: [result], total_pages: 1, total_results: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const movies = await provider.searchMovies({ query: "fight" });
  const tv = await provider.searchTv({ query: "game" });
  const people = await provider.searchPeople({ query: "brad" });

  assert.equal(movies.results[0]?.primaryTitle, "Fight Club");
  assert.equal(movies.results[0]?.category, "movie");
  assert.equal(movies.results[0]?.kind, "watch");
  assert.equal(movies.results[0]?.primaryDate, "1999-10-15");
  assert.equal(movies.results[0]?.rating, 8.4);
  assert.equal(movies.results[0]?.cover?.includes("image.tmdb.org"), true);
  assert.deepEqual(movies.results[0]?.source, { source: "tmdb", category: "movie", value: "550" });
  assert.deepEqual(movies.pagination, { page: 1, totalPages: 1, totalResults: 1 });

  assert.equal(tv.results[0]?.primaryTitle, "Game of Thrones");
  assert.equal(tv.results[0]?.category, "tvshow");
  assert.equal(tv.results[0]?.kind, "watch");
  assert.deepEqual(tv.results[0]?.source, { source: "tmdb", category: "tv", value: "1399" });
  assert.deepEqual(tv.pagination, { page: 1, totalPages: 1, totalResults: 1 });

  assert.equal(people.results[0]?.primaryTitle, "Brad Pitt");
  assert.equal(people.results[0]?.category, "person");
  assert.equal(people.results[0]?.kind, "people");
  assert.equal(people.results[0]?.description, "Acting");
  assert.deepEqual(people.results[0]?.source, { source: "tmdb", category: "person", value: "287" });
  assert.deepEqual(people.pagination, { page: 1, totalPages: 1, totalResults: 1 });
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
  assert.equal(createZuuidClient().people.tmdb, undefined);
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

test("createZuuidClient exposes tmdb people facade", async () => {
  let requestedUrl;
  const client = createZuuidClient({
    providers: {
      tmdb: {
        bearerToken: "test-token",
        fetch: async (url, init) => {
          requestedUrl = { url: new URL(url.toString()), init };
          return new Response(JSON.stringify({ id: 287, name: "Brad Pitt" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }
    }
  });

  const source = await client.people.tmdb?.fetchSourceRecord({ id: 287 });

  assert.equal(requestedUrl.url.pathname, "/3/person/287");
  assert.equal(requestedUrl.init.headers.get("authorization"), "Bearer test-token");
  assert.deepEqual(source?.source, { provider: "tmdb", category: "person", externalId: "287" });
});

test("createZuuidClient exposes category search facades", async () => {
  const requestedPaths = [];
  const client = createZuuidClient({
    providers: {
      tmdb: {
        apiKey: "test-key",
        fetch: async (url) => {
          const requestedUrl = new URL(url.toString());
          requestedPaths.push(requestedUrl.pathname);
          return new Response(JSON.stringify({ results: [{ id: 1, title: "Result", name: "Result" }] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }
    }
  });

  await client.movie.tmdb?.search({ query: "movie" });
  await client.tv.tmdb?.search({ query: "tv" });
  await client.people.tmdb?.search({ query: "person" });

  assert.deepEqual(requestedPaths, ["/3/search/movie", "/3/search/tv", "/3/search/person"]);
});

test("createZuuidClient exposes raw category search source record facades", async () => {
  const requestedPaths = [];
  const client = createZuuidClient({
    providers: {
      tmdb: {
        apiKey: "test-key",
        fetch: async (url) => {
          const requestedUrl = new URL(url.toString());
          requestedPaths.push(requestedUrl.pathname);
          return new Response(JSON.stringify({ results: [{ id: 1, title: "Result", name: "Result" }] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }
    }
  });

  const movies = await client.movie.tmdb?.searchSourceRecords({ query: "movie" });
  const tv = await client.tv.tmdb?.searchSourceRecords({ query: "tv" });
  const people = await client.people.tmdb?.searchSourceRecords({ query: "person" });

  assert.deepEqual(requestedPaths, ["/3/search/movie", "/3/search/tv", "/3/search/person"]);
  assert.deepEqual(movies?.results[0]?.source, { provider: "tmdb", category: "movie", externalId: "1" });
  assert.deepEqual(tv?.results[0]?.source, { provider: "tmdb", category: "tv", externalId: "1" });
  assert.deepEqual(people?.results[0]?.source, { provider: "tmdb", category: "person", externalId: "1" });
  assert.deepEqual(movies?.pagination, { page: 1, totalPages: 0, totalResults: 0 });
});
