import { TmdbProvider, transformTmdbMovie, transformTmdbTv } from "../dist/providers/tmdb/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

loadDotEnv();

const category = process.argv[2] ?? "movie";
const id = process.argv[3] ?? (category === "tv" ? "1399" : "550");
const configuredBearerToken = cleanEnvValue(process.env.TMDB_BEARER_TOKEN ?? process.env.TMDB_READ_ACCESS_TOKEN);
const configuredApiKey = cleanEnvValue(process.env.TMDB_API_KEY);
const apiKeyLooksLikeBearerToken = configuredApiKey?.startsWith("eyJ") ?? false;
const bearerToken = configuredBearerToken ?? (apiKeyLooksLikeBearerToken ? configuredApiKey : undefined);
const apiKey = apiKeyLooksLikeBearerToken ? undefined : configuredApiKey;

if (!bearerToken && !apiKey) {
  console.error("Set TMDB_BEARER_TOKEN, TMDB_READ_ACCESS_TOKEN, or TMDB_API_KEY before running this example.");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:tmdb -- movie 550");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:tmdb -- tv 1399");
  process.exit(1);
}

const tmdb = new TmdbProvider(bearerToken ? { bearerToken } : { apiKey });
console.error(`Using TMDB ${bearerToken ? "bearer token" : "API key"} from environment.`);
if (apiKeyLooksLikeBearerToken) {
  console.error("TMDB_API_KEY looks like an API Read Access Token, so it is being sent as a bearer token.");
}

let transformed;
let source;
try {
  if (category === "movie") {
    source = await tmdb.fetchMovieSourceRecord({ id });
    transformed = source ? await transformTmdbMovie(source, tmdb.transformOptions()) : undefined;
  } else if (category === "tv") {
    source = await tmdb.fetchTvSourceRecord({ id });
    transformed = source ? await transformTmdbTv(source, tmdb.transformOptions()) : undefined;
  } else {
    throw new Error(`Unsupported TMDB example category: ${category}`);
  }
} catch (error) {
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
  console.error(`TMDB ${category} was not found: ${id}`);
  process.exit(1);
}

writeDebugJson(category, id, source, transformed);
console.log(JSON.stringify(transformed, null, 2));

function writeDebugJson(category, id, sourceRecord, transformed) {
  const directory = `data/tmdb/${category}`;
  mkdirSync(directory, { recursive: true });

  if (sourceRecord) {
    writeFileSync(`${directory}/${id}.raw.json`, `${JSON.stringify(sourceRecord, null, 2)}\n`);
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
