import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { GAMESDB_GAME_CATEGORY, GAMESDB_PROVIDER } from "./constants.js";
import {
  addDescription,
  addDetail,
  addMedia,
  addTag,
  arrayField,
  baseDataFromSource,
  finalizeData,
  numberField,
  objectPayload,
  stringField,
  valueAsString
} from "../common.js";

export type GamesDbTransformOptions = {
  imageBaseUrl?: string | null;
};

export async function transformGamesDbGame(
  source: SourceRecord,
  options: GamesDbTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== GAMESDB_PROVIDER || source.source.category !== GAMESDB_GAME_CATEGORY) {
    throw new Error(`unsupported GamesDB source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "game_title") ?? stringField(payload, "name") ?? stringField(payload, "title");
  if (!id) throw new Error("missing required GamesDB game field: id");
  if (!title) throw new Error("missing required GamesDB game field: game_title");

  const data = await baseDataFromSource(source, GAMESDB_PROVIDER, GAMESDB_GAME_CATEGORY, GAMESDB_GAME_CATEGORY, id, title);
  data.rating = numberField(payload, "rating");
  data.primaryDate = releaseDate(stringField(payload, "release_date"));
  addDescription(data, GAMESDB_PROVIDER, stringField(payload, "overview"));
  addTagsFromNamedArray(data, payload, "genres");
  addTagsFromNamedArray(data, payload, "platforms");
  addDetail(data, GAMESDB_PROVIDER, "developers", joinedNames(payload, "developers"));
  addDetail(data, GAMESDB_PROVIDER, "publishers", joinedNames(payload, "publishers"));
  addDetail(data, GAMESDB_PROVIDER, "players", stringField(payload, "players"));
  addDetail(data, GAMESDB_PROVIDER, "release_date", stringField(payload, "release_date"));
  addMedia(data, GAMESDB_PROVIDER, mediaUrl(stringField(payload, "boxart") ?? stringField(payload, "box_art") ?? stringField(payload, "cover"), options.imageBaseUrl), "cover");
  return finalizeData(data, source);
}

function releaseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return /^\d{4}$/.test(value) ? `${value}-01-01` : undefined;
}

function mediaUrl(path: string | undefined, baseUrl: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path) || !baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function joinedNames(payload: Record<string, JsonValue>, key: string): string | undefined {
  const names = arrayField(payload, key).map(valueName).filter((value): value is string => !!value);
  return names.length ? names.join(", ") : undefined;
}

function addTagsFromNamedArray(data: ZuuidData, payload: Record<string, JsonValue>, key: string): void {
  for (const item of arrayField(payload, key)) addTag(data, valueName(item));
}

function valueName(value: JsonValue): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const object = value as Record<string, JsonValue>;
  return stringField(object, "name") ?? stringField(object, "genre") ?? stringField(object, "platform");
}
