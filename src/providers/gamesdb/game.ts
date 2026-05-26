import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { GAMESDB_GAME_CATEGORY, GAMESDB_PROVIDER } from "./constants.js";
import type { GamesDbProvider } from "./client.js";
import type { FetchGamesDbGameInput, GamesDbSearchInput, GamesDbTransformOptions } from "./types.js";
import {
  addAlias,
  addDescription,
  addDetail,
  addMedia,
  addRelation,
  addTag,
  arrayField,
  baseDataFromSource,
  finalizeData,
  normalizeRating,
  numberField,
  objectField,
  objectPayload,
  stringField,
  valueAsString
} from "../common.js";

export async function fetchGamesDbGameSourceRecord(
  provider: GamesDbProvider,
  input: FetchGamesDbGameInput
): Promise<SourceRecord | undefined> {
  const id = gamesDbNumericId(input.id, "GamesDB game id");
  const payload = await provider.getJson<JsonValue>("/Games/ByGameID", {
    id,
    fields: "players,publishers,genres,overview,last_updated,rating,platform,coop,youtube,os,processor,ram,hdd,video,sound,developers,alternates",
    include: "boxart,platform"
  });
  if (!payload) return undefined;
  return createSourceRecord({ source: { provider: GAMESDB_PROVIDER, category: GAMESDB_GAME_CATEGORY, externalId: id }, payload });
}

export async function searchGamesDbGameSourceRecords(
  provider: GamesDbProvider,
  input: GamesDbSearchInput
): Promise<SearchResponse<SourceRecord>> {
  const payload = await fetchGamesDbGameSearchPayload(provider, input);
  const results = gamesFromPayload(objectPayload(payload)).filter((game) => valueAsString(game.id));
  return {
    results: await Promise.all(results.map((game) => createSourceRecord({ source: { provider: GAMESDB_PROVIDER, category: GAMESDB_GAME_CATEGORY, externalId: valueAsString(game.id) ?? "" }, payload: game as JsonValue }))),
    pagination: gamesDbPagination(objectPayload(payload), results.length)
  };
}

export async function searchGamesDbGames(
  provider: GamesDbProvider,
  input: GamesDbSearchInput,
  options: GamesDbTransformOptions = {}
): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = objectPayload(await fetchGamesDbGameSearchPayload(provider, input));
  const results: ZuuidSearchResult[] = [];
  for (const game of gamesFromPayload(payload)) {
    const id = valueAsString(game.id);
    const title = stringField(game, "game_title") ?? stringField(game, "name") ?? stringField(game, "title");
    if (!id || !title) continue;
    const zuuid = await providerZuuid({ provider: GAMESDB_PROVIDER, category: GAMESDB_GAME_CATEGORY, externalId: id });
    const rawRating = numberField(game, "rating");
    results.push({
      id: zuuid,
      zuuid,
      category: GAMESDB_GAME_CATEGORY,
      kind: "play",
      title,
      date: releaseDate(stringField(game, "release_date")) ?? null,
      cover: mediaUrl(primaryImage(game, payload, id), imageBaseUrl(payload, options.imageBaseUrl)) ?? null,
      rating: normalizeRating(rawRating, 0, 10) ?? null,
      weight: null,
      relationType: null,
      attribute: null,
      order: null,
      source: { source: GAMESDB_PROVIDER, category: GAMESDB_GAME_CATEGORY, value: id }
    });
  }
  return { results, pagination: gamesDbPagination(payload, results.length) };
}

export async function transformGamesDbGame(
  source: SourceRecord,
  options: GamesDbTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== GAMESDB_PROVIDER || source.source.category !== GAMESDB_GAME_CATEGORY) {
    throw new Error(`unsupported GamesDB source: ${source.source.provider}:${source.source.category}`);
  }
  const envelope = objectPayload(source.payload);
  const payload = gameFromPayload(envelope, source.source.externalId);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "game_title") ?? stringField(payload, "name") ?? stringField(payload, "title");
  if (!id) throw new Error("missing required GamesDB game field: id");
  if (!title) throw new Error("missing required GamesDB game field: game_title");

  const data = await baseDataFromSource(source, GAMESDB_PROVIDER, GAMESDB_GAME_CATEGORY, GAMESDB_GAME_CATEGORY, id, title);
  addAlias(data, title, "title", true, GAMESDB_PROVIDER);
  for (const alternate of alternates(payload)) addAlias(data, alternate, "alternate", false, GAMESDB_PROVIDER);

  const rawRating = numericRating(payload.rating);
  data.rating = normalizeRating(rawRating, 0, 10);
  addDetail(data, GAMESDB_PROVIDER, "provider_rating", rawRating);
  if (rawRating === undefined) addDetail(data, GAMESDB_PROVIDER, "content_rating", valueAsString(payload.rating));
  data.primaryDate = releaseDate(stringField(payload, "release_date"));
  addDescription(data, GAMESDB_PROVIDER, stringField(payload, "overview"));
  addTagsFromNamedArray(data, payload, envelope, "genres");
  addTagsFromNamedArray(data, payload, envelope, "platforms");
  addDetail(data, GAMESDB_PROVIDER, "platform", lookupName(envelope, "platforms", payload.platform));
  addDetail(data, GAMESDB_PROVIDER, "developers", joinedNames(payload, envelope, "developers"));
  addDetail(data, GAMESDB_PROVIDER, "publishers", joinedNames(payload, envelope, "publishers"));
  for (const key of ["players", "coop", "youtube", "os", "processor", "ram", "hdd", "video", "sound", "last_updated", "release_date"]) {
    addDetail(data, GAMESDB_PROVIDER, key, valueAsString(payload[key]));
  }
  for (const media of mediaCandidates(payload, envelope, id, options.imageBaseUrl)) {
    addMedia(data, GAMESDB_PROVIDER, media.url, media.category, "image", media.primary);
  }

  const platformId = valueAsString(payload.platform);
  if (platformId) await addRelation(data, GAMESDB_PROVIDER, "platform", platformId, "released_on", lookupName(envelope, "platforms", payload.platform));
  return finalizeData(data, source);
}

async function fetchGamesDbGameSearchPayload(provider: GamesDbProvider, input: GamesDbSearchInput): Promise<JsonValue> {
  const query = input.query.trim();
  if (!query) throw new Error("GamesDB game search query must not be empty");
  return (await provider.getJson<JsonValue>("/Games/ByGameName", {
    name: query,
    fields: "players,publishers,genres,overview,rating,platform,developers",
    include: "boxart,platform",
    ...(input.page ? { page: String(input.page) } : {})
  })) ?? { data: { games: [] } };
}

function gamesDbNumericId(value: string | number, label: string): string {
  const id = String(value).trim();
  if (!/^\d+$/.test(id)) throw new Error(`${label} must be numeric: ${id}`);
  return id;
}

function gamesDbPagination(payload: Record<string, JsonValue>, resultCount: number) {
  const pages = objectPayload(payload.pages ?? {});
  const page = numberField(pages, "current") ?? numberField(pages, "previous") ?? 1;
  const totalPages = numberField(pages, "total") ?? (resultCount ? 1 : 0);
  return { page, totalPages, totalResults: resultCount };
}

function gameFromPayload(envelope: Record<string, JsonValue>, externalId: string): Record<string, JsonValue> {
  const games = gamesFromPayload(envelope);
  if (!games.length) return envelope;
  return games.find((game) => valueAsString(game.id) === externalId.trim()) ?? games[0] ?? envelope;
}

function gamesFromPayload(payload: Record<string, JsonValue>): Record<string, JsonValue>[] {
  const data = objectPayload(payload.data ?? {});
  const games = data.games ?? payload.games;
  if (Array.isArray(games)) return games.filter(isObject);
  if (isObject(games)) return Object.values(games).filter(isObject);
  return [];
}

function releaseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  return /^\d{4}$/.test(value) ? `${value}-01-01` : undefined;
}

function mediaUrl(path: string | undefined, baseUrl: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path) || !baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function imageBaseUrl(envelope: Record<string, JsonValue>, fallback: string | null | undefined): string | null | undefined {
  const boxart = objectPayload(objectPayload(envelope.include ?? {}).boxart ?? objectPayload(envelope.data ?? {}).boxart ?? envelope.boxart ?? {});
  const baseUrl = objectPayload(boxart.base_url ?? {});
  return stringField(baseUrl, "original") ?? stringField(baseUrl, "large") ?? fallback;
}

function primaryImage(payload: Record<string, JsonValue>, envelope: Record<string, JsonValue>, id: string): string | undefined {
  return mediaCandidates(payload, envelope, id, undefined)[0]?.url;
}

function mediaCandidates(payload: Record<string, JsonValue>, envelope: Record<string, JsonValue>, id: string, fallbackBaseUrl: string | null | undefined): { url: string; category: string; primary: boolean }[] {
  const baseUrl = imageBaseUrl(envelope, fallbackBaseUrl);
  const output: { url: string; category: string; primary: boolean }[] = [];
  const direct = stringField(payload, "boxart") ?? stringField(payload, "box_art") ?? stringField(payload, "cover");
  const directUrl = mediaUrl(direct, baseUrl);
  if (directUrl) output.push({ url: directUrl, category: "cover", primary: true });

  for (const image of boxartImages(envelope, id)) {
    const filename = stringField(image, "filename") ?? stringField(image, "value") ?? stringField(image, "url");
    const url = mediaUrl(filename, baseUrl);
    if (!url || output.some((item) => item.url === url)) continue;
    const type = stringField(image, "type") ?? "boxart";
    const side = stringField(image, "side");
    output.push({ url, category: side ? `${type}_${side}` : type, primary: output.length === 0 || side === "front" });
  }
  return output;
}

function boxartImages(envelope: Record<string, JsonValue>, id: string): Record<string, JsonValue>[] {
  const boxart = objectPayload(objectPayload(envelope.include ?? {}).boxart ?? objectPayload(envelope.data ?? {}).boxart ?? envelope.boxart ?? {});
  const data = boxart.data;
  if (Array.isArray(data)) return data.filter(isObject);
  if (isObject(data)) {
    const byId = data[id];
    if (Array.isArray(byId)) return byId.filter(isObject);
    if (isObject(byId)) return [byId];
    return Object.values(data).flatMap((value) => Array.isArray(value) ? value.filter(isObject) : isObject(value) ? [value] : []);
  }
  return [];
}

function joinedNames(payload: Record<string, JsonValue>, envelope: Record<string, JsonValue>, key: string): string | undefined {
  const names = arrayField(payload, key).map((value) => valueName(value, envelope, key)).filter((value): value is string => !!value);
  return names.length ? names.join(", ") : undefined;
}

function addTagsFromNamedArray(data: ZuuidData, payload: Record<string, JsonValue>, envelope: Record<string, JsonValue>, key: string): void {
  for (const item of arrayField(payload, key)) addTag(data, valueName(item, envelope, key));
}

function valueName(value: JsonValue, envelope: Record<string, JsonValue>, key: string): string | undefined {
  if (typeof value === "string") return lookupName(envelope, key, value) ?? value;
  if (typeof value === "number") return lookupName(envelope, key, value) ?? String(value);
  if (!isObject(value)) return undefined;
  return stringField(value, "name") ?? stringField(value, "genre") ?? stringField(value, "platform");
}

function lookupName(envelope: Record<string, JsonValue>, key: string, id: JsonValue | undefined): string | undefined {
  const normalizedId = valueAsString(id);
  if (!normalizedId) return undefined;
  const data = objectPayload(envelope.data ?? {});
  const include = objectPayload(envelope.include ?? {});
  const includeKey = key === "platforms" ? "platform" : key;
  const includeEntry = objectPayload(include[includeKey] ?? {});
  const values = includeEntry.data ?? data[key] ?? envelope[key];
  if (Array.isArray(values)) return values.filter(isObject).find((item) => valueAsString(item.id) === normalizedId)?.name as string | undefined;
  if (isObject(values)) {
    const item = values[normalizedId];
    if (isObject(item)) return stringField(item, "name");
    if (typeof item === "string") return item;
  }
  return undefined;
}

function alternates(payload: Record<string, JsonValue>): string[] {
  const value = payload.alternates;
  if (typeof value === "string") return value.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.map((item) => valueAsString(item)).filter((item): item is string => !!item);
  return [];
}

function numericRating(value: JsonValue | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
