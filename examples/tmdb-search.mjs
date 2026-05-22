import { createZuuidClient, TmdbProvider } from "../dist/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

loadDotEnv();

const category = normalizeCategory(process.argv[2] ?? "movie");
const query = process.argv.slice(3).join(" ").trim() || defaultQuery(category);
const credentials = tmdbCredentialsFromEnv();

if (!credentials) {
  console.error("Set TMDB_BEARER_TOKEN, TMDB_READ_ACCESS_TOKEN, or TMDB_API_KEY before running this example.");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:tmdb-search -- movie \"Fight Club\"");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:tmdb-search -- tv \"Game of Thrones\"");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:tmdb-search -- people \"Brad Pitt\"");
  process.exit(1);
}

const zuuid = createZuuidClient({ providers: { tmdb: credentials.config } });
const tmdb = new TmdbProvider(credentials.config);

console.error(`Using TMDB ${credentials.mode} from environment.`);
if (credentials.apiKeyLooksLikeBearerToken) {
  console.error("TMDB_API_KEY looks like an API Read Access Token, so it is being sent as a bearer token.");
}

try {
  const search = await searchUnified(zuuid, category, query);
  const raw = await searchRaw(tmdb, category, query);

  writeDebugJson(category, query, search, raw);
  console.log(JSON.stringify(search, null, 2));
} catch (error) {
  if (error instanceof Error && error.message.includes("TMDB API returned 401")) {
    console.error(error.message);
    console.error("");
    console.error("TMDB has two credential types:");
    console.error("- TMDB_BEARER_TOKEN / TMDB_READ_ACCESS_TOKEN: API Read Access Token, usually starts with eyJ...");
    console.error("- TMDB_API_KEY: v3 API key, usually a short hex string");
    console.error("");
    console.error("If both are set, this example uses the bearer token first.");
    process.exit(1);
  }
  throw error;
}

async function searchUnified(client, category, query) {
  switch (category) {
    case "movie":
      return client.movie.tmdb?.search({ query }) ?? emptySearchResponse();
    case "tv":
      return client.tv.tmdb?.search({ query }) ?? emptySearchResponse();
    case "people":
      return client.people.tmdb?.search({ query }) ?? emptySearchResponse();
    default:
      throw new Error(`Unsupported TMDB search category: ${category}`);
  }
}

async function searchRaw(tmdb, category, query) {
  switch (category) {
    case "movie":
      return tmdb.searchMovieSourceRecords({ query });
    case "tv":
      return tmdb.searchTvSourceRecords({ query });
    case "people":
      return tmdb.searchPersonSourceRecords({ query });
    default:
      throw new Error(`Unsupported TMDB search category: ${category}`);
  }
}

function writeDebugJson(category, query, results, raw) {
  const directory = `data/tmdb/search/${category}`;
  const slug = querySlug(query);
  mkdirSync(directory, { recursive: true });

  writeFileSync(`${directory}/${slug}.zuuid-search.json`, `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(`${directory}/${slug}.raw-search.json`, `${JSON.stringify(raw, null, 2)}\n`);

  console.error(`Wrote ${directory}/${slug}.zuuid-search.json`);
  console.error(`Wrote ${directory}/${slug}.raw-search.json`);
}

function emptySearchResponse() {
  return {
    results: [],
    pagination: {
      page: 1,
      totalPages: 0,
      totalResults: 0
    }
  };
}

function normalizeCategory(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "person") {
    return "people";
  }
  return normalized;
}

function defaultQuery(category) {
  switch (category) {
    case "movie":
      return "Fight Club";
    case "tv":
      return "Game of Thrones";
    case "people":
      return "Brad Pitt";
    default:
      return "Fight Club";
  }
}

function tmdbCredentialsFromEnv() {
  const configuredBearerToken = cleanEnvValue(process.env.TMDB_BEARER_TOKEN ?? process.env.TMDB_READ_ACCESS_TOKEN);
  const configuredApiKey = cleanEnvValue(process.env.TMDB_API_KEY);
  const apiKeyLooksLikeBearerToken = configuredApiKey?.startsWith("eyJ") ?? false;
  const bearerToken = configuredBearerToken ?? (apiKeyLooksLikeBearerToken ? configuredApiKey : undefined);
  const apiKey = apiKeyLooksLikeBearerToken ? undefined : configuredApiKey;

  if (bearerToken) {
    return {
      mode: "bearer token",
      apiKeyLooksLikeBearerToken,
      config: { bearerToken }
    };
  }
  if (apiKey) {
    return {
      mode: "API key",
      apiKeyLooksLikeBearerToken,
      config: { apiKey }
    };
  }
  return undefined;
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

function querySlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "search";
}
