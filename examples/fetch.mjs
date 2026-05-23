import {
  createSourceRecord,
  OpenLibraryProvider,
  TmdbProvider,
  transformComicVine,
  transformGamesDbGame,
  transformJikan,
  transformMusicBrainzArtist,
  transformMusicBrainzLabel,
  transformMusicBrainzRecording,
  transformMusicBrainzRelease,
  transformMusicBrainzReleaseGroup,
  transformMusicBrainzWork,
  transformOpenLibraryAuthor,
  transformOpenLibraryBook,
  transformOpenFoodFactsProduct,
  transformOpenStreetMapPlace,
  transformPodcast,
  transformSetlistFm,
  transformTicketmaster,
  transformTmdbMovie,
  transformTmdbPerson,
  transformTmdbTv,
  transformWgerExercise
} from "../dist/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

loadDotEnv();

const target = normalizeTarget(process.argv[2] ?? "movie");
const category = target.category;
const id = process.argv[3] ?? defaultId(target);
const configuredBearerToken = cleanEnvValue(process.env.TMDB_BEARER_TOKEN ?? process.env.TMDB_READ_ACCESS_TOKEN);
const configuredApiKey = cleanEnvValue(process.env.TMDB_API_KEY);
const apiKeyLooksLikeBearerToken = configuredApiKey?.startsWith("eyJ") ?? false;
const bearerToken = configuredBearerToken ?? (apiKeyLooksLikeBearerToken ? configuredApiKey : undefined);
const apiKey = apiKeyLooksLikeBearerToken ? undefined : configuredApiKey;

if (requiresTmdbCredentials(category) && !bearerToken && !apiKey) {
  console.error("Set TMDB_BEARER_TOKEN, TMDB_READ_ACCESS_TOKEN, or TMDB_API_KEY before running this example.");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:fetch -- movie 550");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:fetch -- tv 1399");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:fetch -- people 287");
  console.error("Open Library does not need credentials: npm run example:fetch -- book OL82563W");
  console.error("Open Library does not need credentials: npm run example:fetch -- author OL23919A");
  console.error("Transformer fixtures do not need credentials: npm run example:fetch -- gamesdb:game 17444");
  process.exit(1);
}

const tmdb = bearerToken || apiKey ? new TmdbProvider(bearerToken ? { bearerToken } : { apiKey }) : undefined;
const openlibrary = new OpenLibraryProvider();
if (requiresTmdbCredentials(category) && tmdb) {
  console.error(`Using TMDB ${bearerToken ? "bearer token" : "API key"} from environment.`);
}
if (requiresTmdbCredentials(category) && tmdb && apiKeyLooksLikeBearerToken) {
  console.error("TMDB_API_KEY looks like an API Read Access Token, so it is being sent as a bearer token.");
}

let transformed;
let source;
try {
  if (category === "movie") {
    source = await tmdb?.fetchMovieSourceRecord({ id });
    transformed = source ? await transformTmdbMovie(source, tmdb?.transformOptions()) : undefined;
  } else if (category === "tv") {
    source = await tmdb?.fetchTvSourceRecord({ id });
    transformed = source ? await transformTmdbTv(source, tmdb?.transformOptions()) : undefined;
  } else if (category === "people" || category === "person") {
    source = await tmdb?.fetchPersonSourceRecord({ id });
    transformed = source ? await transformTmdbPerson(source, tmdb?.transformOptions()) : undefined;
  } else if (category === "book") {
    source = await openlibrary.fetchBookSourceRecord({ id });
    transformed = source ? await transformOpenLibraryBook(source, openlibrary.transformOptions()) : undefined;
  } else if (category === "author") {
    source = await openlibrary.fetchAuthorSourceRecord({ id });
    transformed = source ? await transformOpenLibraryAuthor(source, openlibrary.transformOptions()) : undefined;
  } else {
    source = await fixtureSourceRecord(target, id);
    transformed = source ? await transformFixtureSource(source) : undefined;
  }
} catch (error) {
  if (error instanceof Error && error.message.includes("Unsupported example category")) {
    console.error(error.message);
    console.error("");
    console.error("Examples:");
    for (const example of fixtureExamples()) {
      console.error(`- npm run example:fetch -- ${example.target} ${example.id}`);
    }
    process.exit(1);
  }
  if (error instanceof Error && error.message.includes("No fixture payload")) {
    console.error(error.message);
    process.exit(1);
  }
  if (error instanceof Error && error.message.includes("TMDB API returned 401")) {
    console.error(error.message);
    console.error("");
    console.error("TMDB has two credential types:");
    console.error("- TMDB_BEARER_TOKEN / TMDB_READ_ACCESS_TOKEN: API Read Access Token, usually starts with eyJ...");
    console.error("- TMDB_API_KEY: v3 API key, usually a short hex string");
    console.error("");
    console.error("If both are set, the example uses the bearer token first.");
    process.exit(1);
  }
  throw error;
}

if (!transformed) {
  console.error(`${targetName(target)} was not found: ${id}`);
  process.exit(1);
}

writeDebugJson(target, id, source, transformed);
console.log(JSON.stringify(transformed, null, 2));

async function transformFixtureSource(sourceRecord) {
  switch (`${sourceRecord.source.provider}:${sourceRecord.source.category}`) {
    case "gamesdb:game":
      return transformGamesDbGame(sourceRecord);
    case "musicbrainz:release":
      return transformMusicBrainzRelease(sourceRecord);
    case "musicbrainz:release-group":
      return transformMusicBrainzReleaseGroup(sourceRecord);
    case "musicbrainz:recording":
      return transformMusicBrainzRecording(sourceRecord);
    case "musicbrainz:artist":
      return transformMusicBrainzArtist(sourceRecord);
    case "musicbrainz:label":
      return transformMusicBrainzLabel(sourceRecord);
    case "musicbrainz:work":
      return transformMusicBrainzWork(sourceRecord);
    case "comicvine:volume":
    case "comicvine:character":
    case "comicvine:person":
    case "comicvine:publisher":
      return transformComicVine(sourceRecord);
    case "jikan:anime":
    case "jikan:manga":
    case "jikan:character":
    case "jikan:person":
      return transformJikan(sourceRecord);
    case "openfoodfacts:product":
      return transformOpenFoodFactsProduct(sourceRecord);
    case "openstreetmap:city":
    case "openstreetmap:country":
      return transformOpenStreetMapPlace(sourceRecord);
    case "podcast:podcast":
      return transformPodcast(sourceRecord);
    case "wger:exercise":
      return transformWgerExercise(sourceRecord);
    case "ticketmaster:event":
    case "ticketmaster:venue":
    case "ticketmaster:attraction":
      return transformTicketmaster(sourceRecord);
    case "setlistfm:setlist":
    case "setlistfm:artist":
    case "setlistfm:venue":
      return transformSetlistFm(sourceRecord);
    default:
      throw new Error(`Unsupported example category: ${sourceRecord.source.provider}:${sourceRecord.source.category}`);
  }
}

async function fixtureSourceRecord(target, id) {
  const provider = fixtureProviderForTarget(target);
  if (!provider) {
    throw new Error(`Unsupported example category: ${targetName(target)}`);
  }

  const payload = fixturePayload(provider, target.category, id);
  if (!payload) {
    throw new Error(`No fixture payload for ${provider}:${target.category} ${id}`);
  }

  return createSourceRecord({
    source: { provider, category: target.category, externalId: id },
    payload,
    observedAt: "2026-05-14T12:00:00.000Z"
  });
}

function fixtureProviderForTarget(target) {
  if (target.provider) {
    return target.provider;
  }
  switch (target.category) {
    case "game":
      return "gamesdb";
    case "release":
    case "release-group":
    case "recording":
    case "artist":
    case "label":
    case "work":
      return "musicbrainz";
    case "volume":
    case "publisher":
      return "comicvine";
    case "anime":
    case "manga":
    case "character":
      return "jikan";
    case "product":
      return "openfoodfacts";
    case "city":
    case "country":
      return "openstreetmap";
    case "podcast":
      return "podcast";
    case "exercise":
      return "wger";
    case "setlist":
      return "setlistfm";
    default:
      return undefined;
  }
}

function fixturePayload(provider, category, id) {
  switch (`${provider}:${category}:${id}`) {
    case "gamesdb:game:17444":
      return {
        id: 17444,
        game_title: "Chrono Trigger",
        release_date: "08/22/1995",
        overview: "A time travel role-playing game.",
        rating: 9.6,
        genres: [{ name: "Role-Playing" }],
        platforms: [{ name: "Super Nintendo" }],
        developers: [{ name: "Square" }],
        publishers: [{ name: "Square" }],
        players: "1",
        boxart: "https://cdn.example.test/chrono-trigger.jpg"
      };
    case "musicbrainz:release:f5093c06-23e3-404f-aeaa-40f72885ee3a":
      return {
        id,
        title: "Kind of Blue",
        date: "1959-08-17",
        status: "Official",
        country: "US",
        barcode: "074646493528",
        "track-count": 5,
        "media-count": 1,
        disambiguation: "legacy Columbia release",
        "artist-credit": [{ name: "Miles Davis", artist: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis" } }],
        "label-info": [{ label: { id: "a24c1f3d-2e21-487b-b15e-3b419b6483bc", name: "Columbia" } }],
        "release-group": { id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4" },
        genres: [{ name: "Modal Jazz" }, { name: "Hard Bop" }],
        tags: [{ name: "Jazz" }],
        "cover-art-archive": { front: true }
      };
    case "musicbrainz:release-group:aaa50249-1e6b-3910-b830-7e2fb622a8c4":
      return {
        id,
        title: "Kind of Blue",
        "first-release-date": "1959-08-17",
        "primary-type": "Album",
        "secondary-types": [],
        "release-count": 248,
        disambiguation: "Miles Davis album",
        "artist-credit": [{ name: "Miles Davis", artist: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis" } }],
        genres: [{ name: "Modal Jazz" }, { name: "Hard Bop" }],
        tags: [{ name: "Jazz" }]
      };
    case "musicbrainz:recording:0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6":
      return {
        id,
        title: "So What",
        length: 562000,
        "first-release-date": "1959-08-17",
        isrcs: ["USSM15900116"],
        "artist-credit": [{ name: "Miles Davis", artist: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis" } }],
        genres: [{ name: "Modal Jazz" }]
      };
    case "musicbrainz:artist:561d854a-6a28-4aa7-8c99-323e6ce46c2a":
      return {
        id,
        name: "Miles Davis",
        "sort-name": "Davis, Miles",
        type: "Person",
        country: "US",
        gender: "Male",
        disambiguation: "American jazz trumpeter, bandleader, and composer",
        "life-span": { begin: "1926-05-26", end: "1991-09-28", ended: true },
        area: { name: "United States" },
        "begin-area": { name: "Alton" },
        genres: [{ name: "Jazz" }]
      };
    case "musicbrainz:label:a24c1f3d-2e21-487b-b15e-3b419b6483bc":
      return {
        id,
        name: "Columbia",
        "sort-name": "Columbia",
        type: "Original Production",
        country: "US",
        "label-code": 16,
        "life-span": { begin: "1888", ended: false },
        area: { name: "United States" },
        tags: [{ name: "major label" }]
      };
    case "musicbrainz:work:0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f":
      return {
        id,
        title: "So What",
        type: "Song",
        iswcs: ["T-070.139.417-0"],
        relations: [{ "target-type": "artist", type: "composer", artist: { id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a", name: "Miles Davis" } }],
        tags: [{ name: "Jazz" }]
      };
    case "comicvine:volume:1":
      return { id: 1, name: "Saga", description: "<p>Space opera.</p>", image: { super_url: "https://img.test/saga.jpg" }, publisher: { id: 10, name: "Image" }, characters: [{ id: 20, name: "Alana" }] };
    case "comicvine:publisher:10":
      return { id: 10, name: "Image Comics", deck: "Comics publisher." };
    case "jikan:anime:1":
      return { mal_id: 1, title: "Cowboy Bebop", title_english: "Cowboy Bebop", synopsis: "Bounty hunters in space.", score: 8.75, aired: { from: "1998-04-03T00:00:00+00:00" }, images: { jpg: { large_image_url: "https://img.test/bebop.jpg" } }, genres: [{ mal_id: 1, name: "Action" }], studios: [{ mal_id: 14, name: "Sunrise" }] };
    case "jikan:character:2":
      return { mal_id: 2, name: "Spike Spiegel", nicknames: ["Spike"], about: "A bounty hunter.", images: { jpg: { image_url: "https://img.test/spike.jpg" } } };
    case "openfoodfacts:product:3017620422003":
      return { code: "3017620422003", product_name: "Nutella", brands: "Ferrero", quantity: "400 g", ingredients_text: "Sugar, palm oil, hazelnuts, skimmed milk powder, cocoa", image_front_url: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.433.400.jpg", nutriments: { "energy-kcal_100g": 539, "fat_100g": 30.9, "proteins_100g": 6.3, "carbohydrates_100g": 57.5, "sugars_100g": 56.3, "salt_100g": 0.107 }, categories_tags: ["en:spreads", "en:hazelnut-spreads", "en:chocolate-spreads"], countries_tags: ["en:france"] };
    case "openstreetmap:city:R406091":
      return { place_id: 123, osm_type: "relation", osm_id: 406091, name: "Oslo", display_name: "Oslo, Norway", lat: "59.9138688", lon: "10.7522454", importance: 0.72, icon: "https://nominatim.openstreetmap.org/ui/mapicons/poi_place_city.p.20.png", boundingbox: ["59.809", "60.135", "10.490", "10.951"], address: { city: "Oslo", country: "Norway", country_code: "no", postcode: "0150" }, namedetails: { "name:en": "Oslo", "name:ja": "オスロ" }, extratags: { population: "717710", wikidata: "Q585", wikipedia: "en:Oslo" } };
    case "openstreetmap:country:R2978650":
      return { place_id: 456, osm_type: "relation", osm_id: 2978650, name: "Norway", display_name: "Norway", lat: "64.5731537", lon: "11.5280364", address: { country: "Norway", country_code: "no" } };
    case "podcast:podcast:123":
      return { collectionId: 123, collectionName: "Deep Listening", artistName: "Zivue", country: "USA", trackCount: 42, releaseDate: "2025-01-15T00:00:00Z", longDescription: "<p>Stories about sound.</p>", artworkUrl600: "https://img.test/podcast.jpg", primaryGenreName: "Society & Culture", genres: ["Technology"], feedUrl: "https://feed.test/rss" };
    case "wger:exercise:42":
      return { id: 42, name: "Push-up", description: "<p>Classic bodyweight movement.</p>", category: { name: "Strength" }, muscles: [{ name_en: "Chest" }], muscles_secondary: [{ name_en: "Triceps" }], equipment: [{ name: "Bodyweight" }], images: [{ image: "https://img.test/pushup.jpg" }], variations: [43] };
    case "ticketmaster:event:e1":
      return { id: "e1", name: "Miles Davis Tribute", type: "event", dates: { start: { localDate: "2026-06-01", localTime: "20:00:00" }, status: { code: "onsale" }, timezone: "Europe/Oslo" }, _embedded: { venues: [{ id: "v1", name: "Blue Note" }], attractions: [{ id: "a1", name: "Miles Davis Tribute Band" }] }, classifications: [{ genre: { name: "Jazz" } }], images: [{ url: "https://img.test/event.jpg" }] };
    case "ticketmaster:venue:v1":
      return { id: "v1", name: "Blue Note", type: "venue", timezone: "Europe/Oslo", city: { name: "Oslo" }, country: { name: "Norway" }, location: { latitude: "59.91", longitude: "10.75" }, images: [{ url: "https://img.test/venue.jpg" }] };
    case "ticketmaster:attraction:a1":
      return { id: "a1", name: "Miles Davis Tribute Band", type: "attraction", aliases: ["MD Tribute"], upcomingEvents: { _total: 3 }, classifications: [{ genre: { name: "Jazz" } }], images: [{ url: "https://img.test/attraction.jpg" }] };
    case "setlistfm:setlist:s1":
      return { id: "s1", eventDate: "14-05-2026", artist: { mbid: "a1", name: "Zivue Band" }, venue: { id: "v1", name: "Forum", city: { name: "Oslo", country: { code: "NO" } } }, sets: { set: [{ song: [{ name: "Opening" }] }] } };
    case "setlistfm:artist:a1":
      return { mbid: "a1", name: "Zivue Band", sortName: "Zivue Band", disambiguation: "Norwegian test artist", url: "https://www.setlist.fm/setlists/zivue-band-a1.html", setlists: { total: 12 }, tmid: "a1" };
    case "setlistfm:venue:v1":
      return { id: "v1", name: "Forum", city: { name: "Oslo", state: "Oslo", stateCode: "03", country: { name: "Norway", code: "NO" }, coords: { lat: 59.91, long: 10.75 } }, url: "https://www.setlist.fm/venue/forum-oslo-norway-v1.html" };
    default:
      return undefined;
  }
}

function fixtureExamples() {
  return [
    { target: "gamesdb:game", id: "17444" },
    { target: "musicbrainz:release", id: "f5093c06-23e3-404f-aeaa-40f72885ee3a" },
    { target: "musicbrainz:release-group", id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4" },
    { target: "musicbrainz:recording", id: "0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6" },
    { target: "musicbrainz:artist", id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a" },
    { target: "musicbrainz:label", id: "a24c1f3d-2e21-487b-b15e-3b419b6483bc" },
    { target: "musicbrainz:work", id: "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f" },
    { target: "comicvine:volume", id: "1" },
    { target: "comicvine:publisher", id: "10" },
    { target: "jikan:anime", id: "1" },
    { target: "jikan:character", id: "2" },
    { target: "openfoodfacts:product", id: "3017620422003" },
    { target: "openstreetmap:city", id: "R406091" },
    { target: "openstreetmap:country", id: "R2978650" },
    { target: "podcast:podcast", id: "123" },
    { target: "wger:exercise", id: "42" },
    { target: "ticketmaster:event", id: "e1" },
    { target: "ticketmaster:venue", id: "v1" },
    { target: "ticketmaster:attraction", id: "a1" },
    { target: "setlistfm:setlist", id: "s1" },
    { target: "setlistfm:artist", id: "a1" },
    { target: "setlistfm:venue", id: "v1" }
  ];
}

function writeDebugJson(target, id, sourceRecord, transformed) {
  const provider = sourceRecord?.source.provider ?? (isOpenLibraryCategory(target.category) ? "openlibrary" : "tmdb");
  const directory = `data/${provider}/${target.category}`;
  mkdirSync(directory, { recursive: true });

  if (sourceRecord) {
    writeFileSync(`${directory}/${id}.raw.json`, `${JSON.stringify(sourceRecord.payload, null, 2)}\n`);
  }
  writeFileSync(`${directory}/${id}.zuuid.json`, `${JSON.stringify(transformed, null, 2)}\n`);

  console.error(`Wrote ${directory}/${id}.raw.json`);
  console.error(`Wrote ${directory}/${id}.zuuid.json`);
}

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim().replace(/^export\s+/, "");
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value) {
  const withoutInlineComment = stripInlineComment(value);

  if (
    (withoutInlineComment.startsWith('"') && withoutInlineComment.endsWith('"')) ||
    (withoutInlineComment.startsWith("'") && withoutInlineComment.endsWith("'"))
  ) {
    return withoutInlineComment.slice(1, -1);
  }

  return withoutInlineComment;
}

function stripInlineComment(value) {
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && (index === 0 || value[index - 1] !== "\\")) {
      quote = quote === char ? null : quote ?? char;
    }
    if (!quote && char === "#" && /\s/.test(value[index - 1] ?? "")) {
      return value.slice(0, index).trim();
    }
  }

  return value.trim();
}

function cleanEnvValue(value) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function normalizeTarget(value) {
  const normalized = value.trim().toLowerCase();
  const [provider, rawCategory] = normalized.includes(":") ? normalized.split(":", 2) : [undefined, normalized];
  let category = rawCategory;
  if (!provider && category === "person") {
    category = "people";
  }
  if (!provider && category === "read") {
    category = "book";
  }
  if (!provider && category === "writer") {
    category = "author";
  }
  return provider ? { provider, category } : { category };
}

function targetName(target) {
  return target.provider ? `${target.provider}:${target.category}` : target.category;
}

function defaultId(target) {
  switch (targetName(target)) {
    case "tv":
      return "1399";
    case "people":
      return "287";
    case "book":
      return "OL82563W";
    case "author":
      return "OL23919A";
    case "gamesdb:game":
    case "game":
      return "17444";
    case "musicbrainz:release":
    case "release":
      return "f5093c06-23e3-404f-aeaa-40f72885ee3a";
    case "musicbrainz:release-group":
    case "release-group":
      return "aaa50249-1e6b-3910-b830-7e2fb622a8c4";
    case "musicbrainz:recording":
    case "recording":
      return "0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6";
    case "musicbrainz:artist":
    case "artist":
      return "561d854a-6a28-4aa7-8c99-323e6ce46c2a";
    case "musicbrainz:label":
    case "label":
      return "a24c1f3d-2e21-487b-b15e-3b419b6483bc";
    case "musicbrainz:work":
    case "work":
      return "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f";
    case "comicvine:volume":
    case "volume":
      return "1";
    case "comicvine:publisher":
    case "publisher":
      return "10";
    case "jikan:anime":
    case "anime":
      return "1";
    case "jikan:character":
    case "character":
      return "2";
    case "openfoodfacts:product":
    case "product":
      return "3017620422003";
    case "openstreetmap:city":
    case "city":
      return "R406091";
    case "openstreetmap:country":
    case "country":
      return "R2978650";
    case "podcast:podcast":
    case "podcast":
      return "123";
    case "wger:exercise":
    case "exercise":
      return "42";
    case "ticketmaster:event":
      return "e1";
    case "ticketmaster:venue":
    case "setlistfm:venue":
      return "v1";
    case "ticketmaster:attraction":
    case "setlistfm:artist":
      return "a1";
    case "setlistfm:setlist":
    case "setlist":
      return "s1";
    default:
      return "550";
  }
}

function requiresTmdbCredentials(category) {
  return category === "movie" || category === "tv" || category === "people";
}

function isOpenLibraryCategory(category) {
  return category === "book" || category === "author";
}
