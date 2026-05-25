import {
  GamesDbProvider,
  ImdbProvider,
  OpenLibraryProvider,
  TmdbProvider,
  transformGamesDbGame,
  transformGamesDbPlatform,
  transformImdbMovie,
  transformImdbTv,
  transformOpenLibraryAuthor,
  transformOpenLibraryBook,
  transformTmdbMovie,
  transformTmdbPerson,
  transformTmdbTv
} from "../dist/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

loadDotEnv();

const target = normalizeTarget(process.argv[2] ?? "movie");
const category = target.category;
const id = process.argv[3] ?? defaultId(target);
const configuredGamesDbApiKey = cleanEnvValue(process.env.GAMESDB_API_KEY);
const configuredBearerToken = cleanEnvValue(process.env.TMDB_BEARER_TOKEN ?? process.env.TMDB_READ_ACCESS_TOKEN);
const configuredApiKey = cleanEnvValue(process.env.TMDB_API_KEY);
const apiKeyLooksLikeBearerToken = configuredApiKey?.startsWith("eyJ") ?? false;
const bearerToken = configuredBearerToken ?? (apiKeyLooksLikeBearerToken ? configuredApiKey : undefined);
const apiKey = apiKeyLooksLikeBearerToken ? undefined : configuredApiKey;

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

const gamesdb = configuredGamesDbApiKey ? new GamesDbProvider({ apiKey: configuredGamesDbApiKey }) : undefined;
const imdb = new ImdbProvider();
const tmdb = bearerToken || apiKey ? new TmdbProvider(bearerToken ? { bearerToken } : { apiKey }) : undefined;
const openlibrary = new OpenLibraryProvider();
if (requiresTmdbCredentials(target) && tmdb) {
  console.error(`Using TMDB ${bearerToken ? "bearer token" : "API key"} from environment.`);
}
if (requiresTmdbCredentials(target) && tmdb && apiKeyLooksLikeBearerToken) {
  console.error("TMDB_API_KEY looks like an API Read Access Token, so it is being sent as a bearer token.");
}

let transformed;
let source;
try {
  if (target.provider === "gamesdb" && gamesdb && category === "game") {
    source = await gamesdb?.fetchGameSourceRecord({ id });
    transformed = source ? await transformGamesDbGame(source, gamesdb?.transformOptions()) : undefined;
  } else if (target.provider === "gamesdb" && gamesdb && category === "platform") {
    source = await gamesdb?.fetchPlatformSourceRecord({ id });
    transformed = source ? await transformGamesDbPlatform(source, gamesdb?.transformOptions()) : undefined;
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
    { target: "gamesdb:game", id: "17444" },
    { target: "gamesdb:platform", id: "6" }
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
    case "gamesdb:game":
      return "17444";
    case "gamesdb:platform":
      return "6";
    default:
      return "550";
  }
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
