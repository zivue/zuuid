import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSourceRecord,
  transformComicVine,
  GamesDbProvider,
  MusicBrainzProvider,
  transformGamesDbGame,
  transformGamesDbPlatform,
  transformJikan,
  transformMusicBrainzArtist,
  transformMusicBrainzLabel,
  transformMusicBrainzRecording,
  transformMusicBrainzRelease,
  transformMusicBrainzReleaseGroup,
  transformMusicBrainzWork,
  transformOpenFoodFactsProduct,
  transformOpenStreetMapPlace,
  transformPodcast,
  transformSetlistFm,
  transformTicketmaster,
  transformWgerEquipment,
  transformWgerExercise
} from "../dist/index.js";

const observedAt = "2026-05-14T12:00:00.000Z";

test("transformGamesDbGame maps a game payload", async () => {
  const source = await createSourceRecord({
    source: { provider: "gamesdb", category: "game", externalId: "17444" },
    payload: {
      id: 17444,
      game_title: "Chrono Trigger",
      release_date: "08/22/1995",
      overview: "A time travel role-playing game.",
      rating: 9.6,
      genres: [{ name: "Role-Playing" }],
      platforms: [{ name: "Super Nintendo" }],
      developers: [{ name: "Square" }],
      boxart: "https://cdn.example.test/chrono-trigger.jpg"
    },
    observedAt
  });
  const data = await transformGamesDbGame(source);
  assert.equal(data.kind, "play");
  assert.equal(data.primaryDate, "1995-08-22");
  assert.equal(data.cover, "https://cdn.example.test/chrono-trigger.jpg");
  assert.equal(data.tags.includes("role-playing"), true);
});


test("transformGamesDbGame maps TheGamesDB API envelopes", async () => {
  const source = await createSourceRecord({
    source: { provider: "gamesdb", category: "game", externalId: "17444" },
    payload: {
      data: {
        games: [{ id: 17444, game_title: "Chrono Trigger", release_date: "1995-08-22", overview: "A time travel role-playing game.", rating: "9.6", platform: 6, genres: [1], developers: [10], publishers: [20], players: "1", coop: "No", alternates: ["Chrono Trigger DS"] }],
        genres: { "1": { id: 1, name: "Role-Playing" } },
        platforms: { "6": { id: 6, name: "Super Nintendo" } },
        developers: { "10": { id: 10, name: "Square" } },
        publishers: { "20": { id: 20, name: "Square" } },
        boxart: {
          base_url: { original: "https://cdn.thegamesdb.net/images/original" },
          data: { "17444": [{ type: "boxart", side: "front", filename: "boxart/front/17444-1.jpg" }, { type: "boxart", side: "back", filename: "boxart/back/17444-1.jpg" }] }
        }
      }
    },
    observedAt
  });

  const data = await transformGamesDbGame(source);

  assert.equal(data.primaryTitle, "Chrono Trigger");
  assert.equal(data.rating, 4.8);
  assert.equal(data.cover, "https://cdn.thegamesdb.net/images/original/boxart/front/17444-1.jpg");
  assert.equal(data.media.some((media) => media.mediaCategory === "boxart_back"), true);
  assert.equal(data.tags.includes("role-playing"), true);
  assert.equal(data.details.some((detail) => detail.key === "developers" && detail.value === "Square"), true);
  assert.equal(data.details.some((detail) => detail.key === "platform" && detail.value === "Super Nintendo"), true);
  assert.equal(data.aliases.some((alias) => alias.value === "Chrono Trigger DS"), true);
  assert.equal(data.relations.some((relation) => relation.category === "platform" && relation.externalId === "6"), true);
});

test("GamesDbProvider fetches and searches games", async () => {
  const requested = [];
  const provider = new GamesDbProvider({
    apiKey: "test-key",
    apiBase: "https://api.thegamesdb.test/v1",
    fetch: async (url) => {
      const parsed = new URL(url.toString());
      requested.push(parsed);
      const game = { id: 17444, game_title: "Chrono Trigger", release_date: "1995-08-22", rating: 9.6 };
      return new Response(JSON.stringify({ data: { games: [game], boxart: { base_url: { original: "https://cdn.test" }, data: { "17444": [{ filename: "front.jpg", side: "front", type: "boxart" }] } } }, pages: { current: 1, total: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const source = await provider.fetchGameSourceRecord({ id: 17444 });
  const search = await provider.searchGames({ query: "chrono" });

  assert.equal(requested[0].pathname, "/v1/Games/ByGameID");
  assert.equal(requested[0].searchParams.get("apikey"), "test-key");
  assert.equal(requested[1].pathname, "/v1/Games/ByGameName");
  assert.deepEqual(source?.source, { provider: "gamesdb", category: "game", externalId: "17444" });
  assert.equal(search.results[0]?.title, "Chrono Trigger");
  assert.equal(search.results[0]?.cover, "https://cdn.test/front.jpg");
});


test("MusicBrainzProvider fetches and searches release groups", async () => {
  const requested = [];
  const provider = new MusicBrainzProvider({
    apiBase: "https://musicbrainz.test/ws/2",
    userAgent: "zuuid-test/1.0",
    fetch: async (url, init) => {
      const parsed = new URL(url.toString());
      requested.push({ url: parsed, init });
      if (parsed.pathname.endsWith("/release-group/aaa50249-1e6b-3910-b830-7e2fb622a8c4")) {
        return new Response(JSON.stringify({ id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4", title: "Kind of Blue", "first-release-date": "1959-08-17", "primary-type": "Album" }), { status: 200 });
      }
      return new Response(JSON.stringify({ count: 1, offset: 0, "release-groups": [{ id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4", title: "Kind of Blue", "first-release-date": "1959-08-17", "primary-type": "Album", score: 100 }] }), { status: 200 });
    }
  });

  const source = await provider.fetchReleaseGroupSourceRecord({ id: "AAA50249-1E6B-3910-B830-7E2FB622A8C4" });
  const search = await provider.searchReleaseGroups({ query: "Kind of Blue", limit: 10 });

  assert.equal(requested[0].url.pathname, "/ws/2/release-group/aaa50249-1e6b-3910-b830-7e2fb622a8c4");
  assert.equal(requested[0].url.searchParams.get("fmt"), "json");
  assert.equal(requested[0].url.searchParams.get("inc")?.includes("artists"), true);
  assert.equal(requested[0].init.headers["user-agent"], "zuuid-test/1.0");
  assert.deepEqual(source?.source, { provider: "musicbrainz", category: "release-group", externalId: "aaa50249-1e6b-3910-b830-7e2fb622a8c4" });
  assert.equal(search.results[0]?.title, "Kind of Blue");
  assert.equal(search.results[0]?.category, "release_group");
  assert.equal(search.results[0]?.date, "1959-08-17");
  assert.equal(search.results[0]?.weight, 100);
});

test("MusicBrainzProvider fetches works without invalid artist include", async () => {
  let requestedUrl;
  const provider = new MusicBrainzProvider({
    apiBase: "https://musicbrainz.test/ws/2",
    userAgent: "zuuid-test/1.0",
    fetch: async (url) => {
      requestedUrl = new URL(url.toString());
      return new Response(JSON.stringify({ id: "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f", title: "So What" }), { status: 200 });
    }
  });

  await provider.fetchWorkSourceRecord({ id: "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f" });

  const includes = requestedUrl.searchParams.get("inc")?.split("+") ?? [];
  assert.equal(requestedUrl.pathname, "/ws/2/work/0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f");
  assert.equal(includes.includes("artists"), false);
  assert.equal(includes.includes("iswcs"), false);
  assert.equal(includes.includes("artist-rels"), true);
});

test("transformMusicBrainzRelease maps release metadata", async () => {
  const source = await createSourceRecord({
    source: { provider: "musicbrainz", category: "release", externalId: "f5093c06-23e3-404f-aeaa-40f72885ee3a" },
    payload: {
      id: "f5093c06-23e3-404f-aeaa-40f72885ee3a",
      title: "Kind of Blue",
      date: "1959-08-17",
      barcode: "074646493528",
      "artist-credit": [{ name: "Miles Davis" }],
      "label-info": [{ label: { name: "Columbia" } }],
      "release-group": { id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4" },
      genres: [{ name: "Modal Jazz" }],
      tags: [{ name: "Jazz" }],
      "cover-art-archive": { front: true }
    },
    observedAt
  });
  const data = await transformMusicBrainzRelease(source);
  assert.equal(data.kind, "listen");
  assert.equal(data.primaryDate, "1959-08-17");
  assert.equal(data.cover.includes("coverartarchive.org"), true);
  assert.equal(data.externalIds.some((id) => id.category === "release_group"), true);
});

test("transformMusicBrainz additional entity types", async () => {
  const releaseGroup = await createSourceRecord({
    source: { provider: "musicbrainz", category: "release-group", externalId: "aaa50249-1e6b-3910-b830-7e2fb622a8c4" },
    payload: {
      id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4",
      title: "Kind of Blue",
      "first-release-date": "1959-08-17",
      "primary-type": "Album",
      "artist-credit": [{ name: "Miles Davis" }],
      genres: [{ name: "Modal Jazz" }]
    },
    observedAt
  });
  assert.equal((await transformMusicBrainzReleaseGroup(releaseGroup, { coverArtBaseUrl: null })).category, "release_group");

  const recording = await createSourceRecord({
    source: { provider: "musicbrainz", category: "recording", externalId: "0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6" },
    payload: {
      id: "0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6",
      title: "So What",
      length: 562000,
      isrcs: ["USSM15900116"],
      "artist-credit": [{ artist: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis" } }]
    },
    observedAt
  });
  const recordingData = await transformMusicBrainzRecording(recording);
  assert.equal(recordingData.kind, "listen");
  assert.equal(recordingData.externalIds.some((id) => id.source === "isrc"), true);
  assert.equal(recordingData.relations.some((relation) => relation.title === "Miles Davis"), true);

  const artist = await createSourceRecord({
    source: { provider: "musicbrainz", category: "artist", externalId: "561d854a-6a28-4aa7-8c99-323e6ce46c2a" },
    payload: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis", "sort-name": "Davis, Miles", "life-span": { begin: "1926-05-26" } },
    observedAt
  });
  assert.equal((await transformMusicBrainzArtist(artist)).kind, "people");

  const label = await createSourceRecord({
    source: { provider: "musicbrainz", category: "label", externalId: "a24c1f3d-2e21-487b-b15e-3b419b6483bc" },
    payload: { id: "a24c1f3d-2e21-487b-b15e-3b419b6483bc", name: "Columbia", "label-code": 16 },
    observedAt
  });
  assert.equal((await transformMusicBrainzLabel(label)).category, "label");

  const work = await createSourceRecord({
    source: { provider: "musicbrainz", category: "work", externalId: "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f" },
    payload: {
      id: "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f",
      title: "So What",
      type: "Opera",
      iswcs: ["T-070.139.417-0"],
      relations: [
        { "target-type": "artist", type: "composer", artist: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis" } },
        {
          "target-type": "artist",
          type: "instrument arranger",
          artist: {
            id: "9ddd7abc-9e1b-471d-8031-583bc6bc8be9",
            name: "Пётр Ильич Чайковский",
            "sort-name": "Tchaikovsky, Pyotr Ilyich"
          }
        }
      ]
    },
    observedAt
  });
  const workData = await transformMusicBrainzWork(work);
  assert.equal(workData.kind, "listen");
  assert.equal(workData.externalIds.some((id) => id.source === "iswc"), true);
  assert.equal(workData.details.some((detail) => detail.key === "primary_type" && detail.value === "Opera"), true);
  assert.equal(workData.tags.includes("opera"), true);
  assert.equal(workData.relations.some((relation) => relation.title === "Pyotr Ilyich Tchaikovsky" && relation.attribute === "Пётр Ильич Чайковский"), true);
  assert.equal(workData.relations.some((relation) => relation.relationType === "arranger" && relation.data?.originalRelationType === "instrument arranger"), true);
});

test("transformOpenFoodFactsProduct maps product nutrition tags", async () => {
  const source = await createSourceRecord({
    source: { provider: "openfoodfacts", category: "product", externalId: "12345" },
    payload: {
      code: "12345",
      product_name: "Oat Bar",
      image_front_url: "https://img.test/oat.jpg",
      nutriments: { "energy-kcal_100g": 420 },
      categories_tags: ["en:bars", "en:snacks"]
    },
    observedAt
  });
  const data = await transformOpenFoodFactsProduct(source);
  assert.equal(data.kind, "consume");
  assert.equal(data.category, "food");
  assert.equal(data.cover, "https://img.test/oat.jpg");
  assert.equal(data.tags.includes("snacks"), true);
  assert.equal(data.details.some((detail) => detail.key === "calories_100g"), true);
});

test("transformJikan maps anime and character payloads", async () => {
  const anime = await createSourceRecord({
    source: { provider: "jikan", category: "anime", externalId: "1" },
    payload: {
      mal_id: 1,
      title: "Cowboy Bebop",
      synopsis: "Bounty hunters in space.",
      score: 8.75,
      aired: { from: "1998-04-03T00:00:00+00:00" },
      images: { jpg: { large_image_url: "https://img.test/bebop.jpg" } },
      genres: [{ name: "Action" }],
      studios: [{ mal_id: 14, name: "Sunrise" }]
    },
    observedAt
  });
  const data = await transformJikan(anime);
  assert.equal(data.kind, "watch");
  assert.equal(data.primaryDate, "1998-04-03");
  assert.equal(data.relations.some((relation) => relation.title === "Sunrise"), true);

  const character = await createSourceRecord({
    source: { provider: "jikan", category: "character", externalId: "2" },
    payload: { mal_id: 2, name: "Spike Spiegel", nicknames: ["Spike"] },
    observedAt
  });
  assert.equal((await transformJikan(character)).category, "person");
});

test("transformOpenStreetMapPlace maps city details", async () => {
  const source = await createSourceRecord({
    source: { provider: "openstreetmap", category: "city", externalId: "R406091" },
    payload: {
      osm_type: "relation",
      osm_id: 406091,
      name: "Oslo",
      display_name: "Oslo, Norway",
      importance: 0.72,
      address: { city: "Oslo", country: "Norway", country_code: "no" },
      extratags: { wikidata: "Q585" },
      namedetails: { "name:ja": "オスロ" }
    },
    observedAt
  });
  const data = await transformOpenStreetMapPlace(source);
  assert.equal(data.kind, "visit");
  assert.equal(data.rating, 3.6);
  assert.equal(data.details.some((detail) => detail.key === "provider_rating" && detail.value === 0.72), true);
  assert.equal(data.aliases.some((alias) => alias.value === "オスロ"), true);
  assert.equal(data.externalIds.some((id) => id.source === "wikidata"), true);
});

test("transformPodcast and transformWgerExercise map listen and exercise sources", async () => {
  const podcast = await createSourceRecord({
    source: { provider: "podcast", category: "podcast", externalId: "123" },
    payload: {
      collectionId: 123,
      collectionName: "Deep Listening",
      releaseDate: "2025-01-15T00:00:00Z",
      artworkUrl600: "https://img.test/podcast.jpg",
      genres: ["Technology"]
    },
    observedAt
  });
  assert.equal((await transformPodcast(podcast)).kind, "listen");

  const exercise = await createSourceRecord({
    source: { provider: "wger", category: "exercise", externalId: "42" },
    payload: {
      id: 42,
      name: "Push-up",
      description: "<p>Classic bodyweight movement.</p>",
      muscles: [{ name_en: "Chest" }],
      images: [{ image: "https://img.test/pushup.jpg" }],
      variations: [43]
    },
    observedAt
  });
  const data = await transformWgerExercise(exercise);
  assert.equal(data.category, "exercise");
  assert.equal(data.relations.length, 1);
});

test("transformComicVine, transformTicketmaster, and transformSetlistFm map linked sources", async () => {
  const comic = await createSourceRecord({
    source: { provider: "comicvine", category: "volume", externalId: "1" },
    payload: { id: 1, name: "Saga", image: { super_url: "https://img.test/saga.jpg" }, publisher: { id: 10, name: "Image" } },
    observedAt
  });
  assert.equal((await transformComicVine(comic)).category, "comic");

  const event = await createSourceRecord({
    source: { provider: "ticketmaster", category: "event", externalId: "e1" },
    payload: {
      id: "e1",
      name: "Miles Davis Tribute",
      dates: { start: { localDate: "2026-06-01" } },
      _embedded: { venues: [{ id: "v1", name: "Blue Note" }] },
      classifications: [{ genre: { name: "Jazz" } }]
    },
    observedAt
  });
  const ticketmaster = await transformTicketmaster(event);
  assert.equal(ticketmaster.primaryDate, "2026-06-01");
  assert.equal(ticketmaster.relations.some((relation) => relation.category === "venue"), true);

  const setlist = await createSourceRecord({
    source: { provider: "setlistfm", category: "setlist", externalId: "s1" },
    payload: {
      id: "s1",
      eventDate: "14-05-2026",
      artist: { mbid: "a1", name: "Zivue Band" },
      venue: { id: "v1", name: "Forum", city: { name: "Oslo", country: { code: "NO" } } },
      sets: { set: [{ song: [{ name: "Opening" }] }] }
    },
    observedAt
  });
  const setlistData = await transformSetlistFm(setlist);
  assert.equal(setlistData.kind, "event");
  assert.equal(setlistData.primaryDate, "2026-05-14");
  assert.equal(setlistData.details.some((detail) => detail.key === "song_count" && detail.value === "1"), true);
});

test("additional requested provider categories transform", async () => {
  const platform = await createSourceRecord({
    source: { provider: "gamesdb", category: "platform", externalId: "6" },
    payload: { id: 6, name: "Super Nintendo Entertainment System", manufacturer: "Nintendo", release_date: "1990" },
    observedAt
  });
  assert.equal((await transformGamesDbPlatform(platform)).category, "platform");

  const issue = await createSourceRecord({
    source: { provider: "comicvine", category: "issue", externalId: "101" },
    payload: { id: 101, name: "Saga #1", issue_number: "1", cover_date: "2012-03-14", volume: { id: 1, name: "Saga" } },
    observedAt
  });
  assert.equal((await transformComicVine(issue)).primaryDate, "2012-03-14");

  const storyArc = await createSourceRecord({
    source: { provider: "comicvine", category: "story_arc", externalId: "201" },
    payload: { id: 201, name: "The Battle of the Atom", issues: [{ id: 101, name: "Saga #1" }] },
    observedAt
  });
  assert.equal((await transformComicVine(storyArc)).relations.some((relation) => relation.category === "issue"), true);

  const producer = await createSourceRecord({
    source: { provider: "jikan", category: "producer", externalId: "14" },
    payload: { mal_id: 14, name: "Sunrise", established: "1972-09-01", count: 542 },
    observedAt
  });
  assert.equal((await transformJikan(producer)).category, "organization");

  const magazine = await createSourceRecord({
    source: { provider: "jikan", category: "magazine", externalId: "1" },
    payload: { mal_id: 1, name: "Shounen Jump", count: 1200 },
    observedAt
  });
  assert.equal((await transformJikan(magazine)).kind, "read");

  const place = await createSourceRecord({
    source: { provider: "openstreetmap", category: "place", externalId: "N987654" },
    payload: { osm_type: "node", osm_id: 987654, name: "Vigeland Park", display_name: "Vigeland Park, Oslo, Norway", class: "tourism", type: "attraction" },
    observedAt
  });
  assert.equal((await transformOpenStreetMapPlace(place)).kind, "visit");

  const venue = await createSourceRecord({
    source: { provider: "openstreetmap", category: "venue", externalId: "W123456" },
    payload: { osm_type: "way", osm_id: 123456, name: "Oslo Spektrum", display_name: "Oslo Spektrum, Oslo, Norway", class: "amenity", type: "theatre" },
    observedAt
  });
  assert.equal((await transformOpenStreetMapPlace(venue)).category, "venue");

  const equipment = await createSourceRecord({
    source: { provider: "wger", category: "equipment", externalId: "7" },
    payload: { id: 7, name: "Dumbbell", exercise_count: 128 },
    observedAt
  });
  assert.equal((await transformWgerEquipment(equipment)).category, "equipment");
});
