import { ComicVineProvider, createZuuidClient, MusicBrainzProvider, OpenFoodFactsProvider, OpenLibraryProvider, OpenStreetMapProvider, TmdbProvider } from "../dist/index.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

loadDotEnv();

const target = normalizeTarget(process.argv[2] ?? "movie");
const category = target.category;
const query = process.argv.slice(3).join(" ").trim() || defaultQuery(category);
const credentials = tmdbCredentialsFromEnv();
const comicvineApiKey = cleanEnvValue(process.env.COMICVINE_API_KEY);

if (requiresComicVineCredentials(category) && !comicvineApiKey) {
  console.error("Set COMICVINE_API_KEY before running ComicVine examples.");
  console.error("Usage: COMICVINE_API_KEY=... npm run example:search -- comicvine:volume Saga");
  console.error("Usage: COMICVINE_API_KEY=... npm run example:search -- comicvine:issue Saga");
  process.exit(1);
}

if (requiresTmdbCredentials(category) && !credentials) {
  console.error("Set TMDB_BEARER_TOKEN, TMDB_READ_ACCESS_TOKEN, or TMDB_API_KEY before running this example.");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:search -- movie \"Fight Club\"");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:search -- tv \"Game of Thrones\"");
  console.error("Usage: TMDB_BEARER_TOKEN=... npm run example:search -- people \"Brad Pitt\"");
  console.error("Open Library does not need credentials: npm run example:search -- book \"The Lord of the Rings\"");
  console.error("Open Library does not need credentials: npm run example:search -- author \"J. K. Rowling\"");
  process.exit(1);
}

const zuuid = createZuuidClient({
  providers: {
    ...(comicvineApiKey ? { comicvine: { apiKey: comicvineApiKey } } : {}),
    ...(credentials ? { tmdb: credentials.config } : {}),
    musicbrainz: {},
    openfoodfacts: {},
    openlibrary: {},
    openstreetmap: {}
  }
});
const comicvine = comicvineApiKey ? new ComicVineProvider({ apiKey: comicvineApiKey }) : undefined;
const tmdb = credentials ? new TmdbProvider(credentials.config) : undefined;
const musicbrainz = new MusicBrainzProvider();
const openfoodfacts = new OpenFoodFactsProvider();
const openlibrary = new OpenLibraryProvider();
const openstreetmap = new OpenStreetMapProvider();

if (requiresTmdbCredentials(category) && credentials) {
  console.error(`Using TMDB ${credentials.mode} from environment.`);
}
if (requiresTmdbCredentials(category) && credentials?.apiKeyLooksLikeBearerToken) {
  console.error("TMDB_API_KEY looks like an API Read Access Token, so it is being sent as a bearer token.");
}

try {
  const search = await searchUnified(zuuid, category, query);
  const raw = await searchRaw(comicvine, tmdb, musicbrainz, openfoodfacts, openstreetmap, category, query);

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
    case "author":
      return client.people.openlibrary?.search({ query }) ?? emptySearchResponse();
    case "book":
      return client.read.openlibrary?.search({ query }) ?? emptySearchResponse();
    case "volume":
      return client.read.comicvine?.volume.search({ query }) ?? emptySearchResponse();
    case "issue":
      return client.read.comicvine?.issue.search({ query }) ?? emptySearchResponse();
    case "story_arc":
      return client.read.comicvine?.storyArc.search({ query }) ?? emptySearchResponse();
    case "character":
      return client.people.comicvine?.character.search({ query }) ?? emptySearchResponse();
    case "person":
      return client.people.comicvine?.person.search({ query }) ?? emptySearchResponse();
    case "publisher":
      return client.people.comicvine?.publisher.search({ query }) ?? emptySearchResponse();
    case "city":
      return client.visit.openstreetmap?.city.search({ query }) ?? emptySearchResponse();
    case "country":
      return client.visit.openstreetmap?.country.search({ query }) ?? emptySearchResponse();
    case "place":
      return client.visit.openstreetmap?.place.search({ query }) ?? emptySearchResponse();
    case "venue":
      return client.visit.openstreetmap?.venue.search({ query }) ?? emptySearchResponse();
    case "product":
      return client.product.openfoodfacts?.search({ query }) ?? emptySearchResponse();
    case "release":
      return client.listen.musicbrainz?.release.search({ query }) ?? emptySearchResponse();
    case "release-group":
      return client.listen.musicbrainz?.releaseGroup.search({ query }) ?? emptySearchResponse();
    case "recording":
      return client.listen.musicbrainz?.recording.search({ query }) ?? emptySearchResponse();
    case "artist":
      return client.people.musicbrainz?.artist.search({ query }) ?? emptySearchResponse();
    case "label":
      return client.people.musicbrainz?.label.search({ query }) ?? emptySearchResponse();
    case "work":
      return client.listen.musicbrainz?.work.search({ query }) ?? emptySearchResponse();
    default:
      throw new Error(`Unsupported search category: ${category}`);
  }
}

async function searchRaw(comicvine, tmdb, musicbrainz, openfoodfacts, openstreetmap, category, query) {
  switch (category) {
    case "movie":
      return tmdb?.searchMovieSourceRecords({ query }) ?? emptySearchResponse();
    case "tv":
      return tmdb?.searchTvSourceRecords({ query }) ?? emptySearchResponse();
    case "people":
      return tmdb?.searchPersonSourceRecords({ query }) ?? emptySearchResponse();
    case "author":
      return openlibrary.searchAuthorSourceRecords({ query });
    case "book":
      return openlibrary.searchBookSourceRecords({ query });
    case "volume":
      return comicvine?.searchVolumeSourceRecords({ query }) ?? emptySearchResponse();
    case "issue":
      return comicvine?.searchIssueSourceRecords({ query }) ?? emptySearchResponse();
    case "story_arc":
      return comicvine?.searchStoryArcSourceRecords({ query }) ?? emptySearchResponse();
    case "character":
      return comicvine?.searchCharacterSourceRecords({ query }) ?? emptySearchResponse();
    case "person":
      return comicvine?.searchPersonSourceRecords({ query }) ?? emptySearchResponse();
    case "publisher":
      return comicvine?.searchPublisherSourceRecords({ query }) ?? emptySearchResponse();
    case "city":
      return openstreetmap.searchCitySourceRecords({ query });
    case "country":
      return openstreetmap.searchCountrySourceRecords({ query });
    case "place":
      return openstreetmap.searchPlaceSourceRecords({ query });
    case "venue":
      return openstreetmap.searchVenueSourceRecords({ query });
    case "product":
      return openfoodfacts.searchProductSourceRecords({ query });
    case "release":
      return musicbrainz.searchReleaseSourceRecords({ query });
    case "release-group":
      return musicbrainz.searchReleaseGroupSourceRecords({ query });
    case "recording":
      return musicbrainz.searchRecordingSourceRecords({ query });
    case "artist":
      return musicbrainz.searchArtistSourceRecords({ query });
    case "label":
      return musicbrainz.searchLabelSourceRecords({ query });
    case "work":
      return musicbrainz.searchWorkSourceRecords({ query });
    default:
      throw new Error(`Unsupported search category: ${category}`);
  }
}

function writeDebugJson(category, query, results, raw) {
  const provider = isOpenLibraryCategory(category) ? "openlibrary" : isMusicBrainzCategory(category) ? "musicbrainz" : isComicVineCategory(category) ? "comicvine" : isOpenStreetMapCategory(category) ? "openstreetmap" : category === "product" ? "openfoodfacts" : "tmdb";
  const directory = `data/${provider}/search/${category}`;
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

function normalizeTarget(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "person") {
    return { category: "people" };
  }
  if (normalized === "read") {
    return { category: "book" };
  }
  if (normalized === "release_group") {
    return { category: "release-group" };
  }
  const [provider, rawCategory] = normalized.includes(":") ? normalized.split(":", 2) : [undefined, normalized];
  let category = rawCategory;
  if (category === "story-arc") category = "story_arc";
  return provider ? { provider, category } : { category };
}

function defaultQuery(category) {
  switch (category) {
    case "movie":
      return "Fight Club";
    case "tv":
      return "Game of Thrones";
    case "people":
      return "Brad Pitt";
    case "author":
      return "J. K. Rowling";
    case "book":
      return "The Lord of the Rings";
    case "release":
    case "release-group":
      return "Kind of Blue";
    case "recording":
      return "So What";
    case "artist":
      return "Miles Davis";
    case "label":
      return "Columbia";
    case "work":
      return "So What";
    case "volume":
    case "issue":
      return "Saga";
    case "story_arc":
      return "Battle of the Atom";
    case "character":
      return "Spider-Man";
    case "publisher":
      return "Image";
    case "city":
      return "Oslo";
    case "country":
      return "Norway";
    case "place":
      return "Eiffel Tower";
    case "venue":
      return "Blue Note Oslo";
    case "product":
      return "Nutella";
    default:
      return "Fight Club";
  }
}

function isOpenStreetMapCategory(category) {
  return category === "city" || category === "country" || category === "place" || category === "venue";
}

function isComicVineCategory(category) {
  return category === "volume" || category === "issue" || category === "story_arc" || category === "character" || category === "person" || category === "publisher";
}

function requiresComicVineCredentials(category) {
  return isComicVineCategory(category);
}

function isMusicBrainzCategory(category) {
  return category === "release" || category === "release-group" || category === "recording" || category === "artist" || category === "label" || category === "work";
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

function requiresTmdbCredentials(category) {
  return category === "movie" || category === "tv" || category === "people";
}

function isOpenLibraryCategory(category) {
  return category === "book" || category === "author";
}
