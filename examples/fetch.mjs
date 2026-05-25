import {
  ComicVineProvider,
  GamesDbProvider,
  ImdbProvider,
  MusicBrainzProvider,
  OpenLibraryProvider,
  OpenStreetMapProvider,
  TmdbProvider,
  transformComicVine,
  transformGamesDbGame,
  transformGamesDbPlatform,
  transformImdbMovie,
  transformImdbTv,
  transformMusicBrainzArtist,
  transformMusicBrainzLabel,
  transformMusicBrainzRecording,
  transformMusicBrainzRelease,
  transformMusicBrainzReleaseGroup,
  transformMusicBrainzWork,
  transformOpenLibraryAuthor,
  transformOpenLibraryBook,
  transformOpenStreetMapPlace,
  transformTmdbMovie,
  transformTmdbPerson,
  transformTmdbTv
} from "../dist/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

loadDotEnv();

const target = normalizeTarget(process.argv[2] ?? "movie");
const category = target.category;
const id = process.argv[3] ?? defaultId(target);
const configuredComicVineApiKey = cleanEnvValue(process.env.COMICVINE_API_KEY);
const configuredGamesDbApiKey = cleanEnvValue(process.env.GAMESDB_API_KEY);
const configuredBearerToken = cleanEnvValue(process.env.TMDB_BEARER_TOKEN ?? process.env.TMDB_READ_ACCESS_TOKEN);
const configuredApiKey = cleanEnvValue(process.env.TMDB_API_KEY);
const apiKeyLooksLikeBearerToken = configuredApiKey?.startsWith("eyJ") ?? false;
const bearerToken = configuredBearerToken ?? (apiKeyLooksLikeBearerToken ? configuredApiKey : undefined);
const apiKey = apiKeyLooksLikeBearerToken ? undefined : configuredApiKey;

if (requiresComicVineCredentials(target) && !configuredComicVineApiKey) {
  console.error("Set COMICVINE_API_KEY before running ComicVine examples.");
  console.error("Usage: COMICVINE_API_KEY=... npm run example:fetch -- comicvine:volume 1");
  console.error("Usage: COMICVINE_API_KEY=... npm run example:fetch -- comicvine:issue 101");
  process.exit(1);
}

if (requiresGamesDbCredentials(target) && !configuredGamesDbApiKey) {
  console.error("Set GAMESDB_API_KEY before running GamesDB examples.");
  console.error("Usage: GAMESDB_API_KEY=... npm run example:fetch -- gamesdb:game 17444");
  console.error("Usage: GAMESDB_API_KEY=... npm run example:fetch -- gamesdb:platform 6");
  process.exit(1);
}

if (requiresTmdbCredentials(target) && !bearerToken && !apiKey) {
  console.error("Set TMDB_BEARER_TOKEN, TMDB_READ_ACCESS_TOKEN, or TMDB_API_KEY before running this example.");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:fetch -- movie 550");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:fetch -- tv 1399");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:fetch -- people 287");
  console.error("Open Library does not need credentials: npm run example:fetch -- book OL82563W");
  console.error("Open Library does not need credentials: npm run example:fetch -- author OL23919A");
  process.exit(1);
}

const comicvine = configuredComicVineApiKey ? new ComicVineProvider({ apiKey: configuredComicVineApiKey }) : undefined;
const gamesdb = configuredGamesDbApiKey ? new GamesDbProvider({ apiKey: configuredGamesDbApiKey }) : undefined;
const imdb = new ImdbProvider();
const musicbrainz = new MusicBrainzProvider();
const tmdb = bearerToken || apiKey ? new TmdbProvider(bearerToken ? { bearerToken } : { apiKey }) : undefined;
const openlibrary = new OpenLibraryProvider();
const openstreetmap = new OpenStreetMapProvider();
if (requiresTmdbCredentials(target) && tmdb) {
  console.error(`Using TMDB ${bearerToken ? "bearer token" : "API key"} from environment.`);
}
if (requiresTmdbCredentials(target) && tmdb && apiKeyLooksLikeBearerToken) {
  console.error("TMDB_API_KEY looks like an API Read Access Token, so it is being sent as a bearer token.");
}

let transformed;
let source;
try {
  if (target.provider === "comicvine") {
    source = await fetchComicVineSourceRecord(comicvine, category, id);
    transformed = source ? await transformComicVine(source) : undefined;
  } else if (target.provider === "gamesdb" && gamesdb && category === "game") {
    source = await gamesdb?.fetchGameSourceRecord({ id });
    transformed = source ? await transformGamesDbGame(source, gamesdb?.transformOptions()) : undefined;
  } else if (target.provider === "gamesdb" && gamesdb && category === "platform") {
    source = await gamesdb?.fetchPlatformSourceRecord({ id });
    transformed = source ? await transformGamesDbPlatform(source, gamesdb?.transformOptions()) : undefined;
  } else if (target.provider === "musicbrainz" && category === "release") {
    source = await musicbrainz.fetchReleaseSourceRecord({ id });
    transformed = source ? await transformMusicBrainzRelease(source, musicbrainz.transformOptions()) : undefined;
  } else if (target.provider === "musicbrainz" && category === "release-group") {
    source = await musicbrainz.fetchReleaseGroupSourceRecord({ id });
    transformed = source ? await transformMusicBrainzReleaseGroup(source, { coverArtBaseUrl: musicbrainz.releaseGroupCoverArtBaseUrl }) : undefined;
  } else if (target.provider === "musicbrainz" && category === "recording") {
    source = await musicbrainz.fetchRecordingSourceRecord({ id });
    transformed = source ? await transformMusicBrainzRecording(source) : undefined;
  } else if (target.provider === "musicbrainz" && category === "artist") {
    source = await musicbrainz.fetchArtistSourceRecord({ id });
    transformed = source ? await transformMusicBrainzArtist(source) : undefined;
  } else if (target.provider === "musicbrainz" && category === "label") {
    source = await musicbrainz.fetchLabelSourceRecord({ id });
    transformed = source ? await transformMusicBrainzLabel(source) : undefined;
  } else if (target.provider === "musicbrainz" && category === "work") {
    source = await musicbrainz.fetchWorkSourceRecord({ id });
    transformed = source ? await transformMusicBrainzWork(source) : undefined;
  } else if (target.provider === "imdb" && category === "movie") {
    source = await imdb.fetchMovieSourceRecord({ id });
    transformed = source ? await transformImdbMovie(source, imdb.transformOptions()) : undefined;
  } else if (target.provider === "imdb" && category === "tv") {
    source = await imdb.fetchTvSourceRecord({ id });
    transformed = source ? await transformImdbTv(source, imdb.transformOptions()) : undefined;
  } else if (category === "movie") {
    source = await tmdb?.fetchMovieSourceRecord({ id });
    transformed = source ? await transformTmdbMovie(source, tmdb?.transformOptions()) : undefined;
  } else if (category === "tv") {
    source = await tmdb?.fetchTvSourceRecord({ id });
    transformed = source ? await transformTmdbTv(source, tmdb?.transformOptions()) : undefined;
  } else if (category === "people" || category === "person") {
    source = await tmdb?.fetchPersonSourceRecord({ id });
    transformed = source ? await transformTmdbPerson(source, tmdb?.transformOptions()) : undefined;
  } else if (target.provider === "openstreetmap") {
    source = await fetchOpenStreetMapSourceRecord(openstreetmap, category, id);
    transformed = source ? await transformOpenStreetMapPlace(source) : undefined;
  } else if (category === "book") {
    source = await openlibrary.fetchBookSourceRecord({ id });
    transformed = source ? await transformOpenLibraryBook(source, openlibrary.transformOptions()) : undefined;
  } else if (category === "author") {
    source = await openlibrary.fetchAuthorSourceRecord({ id });
    transformed = source ? await transformOpenLibraryAuthor(source, openlibrary.transformOptions()) : undefined;
  } else {
    throw new Error(`Unsupported live fetch target: ${targetName(target)}`);
  }
} catch (error) {
  if (error instanceof Error && error.message.includes("Unsupported live fetch target")) {
    console.error(error.message);
    console.error("");
    console.error("Supported examples:");
    for (const example of liveExamples()) {
      console.error(`- npm run example:fetch -- ${example.target} ${example.id}`);
    }
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

function liveExamples() {
  return [
    { target: "movie", id: "550" },
    { target: "tv", id: "1399" },
    { target: "people", id: "287" },
    { target: "book", id: "OL82563W" },
    { target: "author", id: "OL23919A" },
    { target: "imdb:movie", id: "tt0137523" },
    { target: "imdb:tv", id: "tt0944947" },
    { target: "comicvine:volume", id: "1" },
    { target: "comicvine:issue", id: "101" },
    { target: "comicvine:story_arc", id: "201" },
    { target: "comicvine:character", id: "4005" },
    { target: "comicvine:person", id: "4040" },
    { target: "comicvine:publisher", id: "10" },
    { target: "gamesdb:game", id: "17444" },
    { target: "gamesdb:platform", id: "6" },
    { target: "musicbrainz:release", id: "f5093c06-23e3-404f-aeaa-40f72885ee3a" },
    { target: "musicbrainz:release-group", id: "aaa50249-1e6b-3910-b830-7e2fb622a8c4" },
    { target: "musicbrainz:recording", id: "0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6" },
    { target: "musicbrainz:artist", id: "561d854a-6a28-4aa7-8c99-323e6ce46c2a" },
    { target: "musicbrainz:label", id: "a24c1f3d-2e21-487b-b15e-3b419b6483bc" },
    { target: "musicbrainz:work", id: "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f" },
    { target: "openstreetmap:city", id: "R406091" },
    { target: "openstreetmap:country", id: "R2978650" },
    { target: "openstreetmap:place", id: "N987654" },
    { target: "openstreetmap:venue", id: "W123456" }
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
    case "imdb:movie":
      return "tt0137523";
    case "imdb:tv":
      return "tt0944947";
    case "comicvine:volume":
      return "1";
    case "comicvine:issue":
      return "101";
    case "comicvine:story_arc":
      return "201";
    case "comicvine:character":
      return "4005";
    case "comicvine:person":
      return "4040";
    case "comicvine:publisher":
      return "10";
    case "gamesdb:game":
      return "17444";
    case "gamesdb:platform":
      return "6";
    case "musicbrainz:release":
      return "f5093c06-23e3-404f-aeaa-40f72885ee3a";
    case "musicbrainz:release-group":
      return "aaa50249-1e6b-3910-b830-7e2fb622a8c4";
    case "musicbrainz:recording":
      return "0b5d8c0f-4975-4e44-9e67-0a5f1b5939f6";
    case "musicbrainz:artist":
      return "561d854a-6a28-4aa7-8c99-323e6ce46c2a";
    case "musicbrainz:label":
      return "a24c1f3d-2e21-487b-b15e-3b419b6483bc";
    case "musicbrainz:work":
      return "0e3d8d4d-7b6b-3f9b-8a45-9f477f86f30f";
    case "openstreetmap:city":
      return "R406091";
    case "openstreetmap:country":
      return "R2978650";
    case "openstreetmap:place":
      return "N987654";
    case "openstreetmap:venue":
      return "W123456";
    default:
      return "550";
  }
}

async function fetchComicVineSourceRecord(provider, category, id) {
  switch (category) {
    case "volume":
      return provider?.fetchVolumeSourceRecord({ id });
    case "issue":
      return provider?.fetchIssueSourceRecord({ id });
    case "story_arc":
    case "story-arc":
      return provider?.fetchStoryArcSourceRecord({ id });
    case "character":
      return provider?.fetchCharacterSourceRecord({ id });
    case "person":
      return provider?.fetchPersonSourceRecord({ id });
    case "publisher":
      return provider?.fetchPublisherSourceRecord({ id });
    default:
      throw new Error(`Unsupported live fetch target: comicvine:${category}`);
  }
}

async function fetchOpenStreetMapSourceRecord(provider, category, id) {
  switch (category) {
    case "city":
      return provider.fetchCitySourceRecord({ id });
    case "country":
      return provider.fetchCountrySourceRecord({ id });
    case "place":
      return provider.fetchPlaceSourceRecord({ id });
    case "venue":
      return provider.fetchVenueSourceRecord({ id });
    default:
      throw new Error(`Unsupported live fetch target: openstreetmap:${category}`);
  }
}

function requiresComicVineCredentials(target) {
  return target.provider === "comicvine";
}

function requiresGamesDbCredentials(target) {
  return target.provider === "gamesdb" && (target.category === "game" || target.category === "platform");
}

function requiresTmdbCredentials(target) {
  return (!target.provider || target.provider === "tmdb") && (target.category === "movie" || target.category === "tv" || target.category === "people");
}

function isOpenLibraryCategory(category) {
  return category === "book" || category === "author";
}
