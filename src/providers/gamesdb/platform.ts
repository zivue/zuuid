import type { ZuuidData } from "../../entity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { addAlias, addDescription, addDetail, addMedia, addTag, baseDataFromSource, finalizeData, objectPayload, stringField, valueAsString } from "../common.js";
import { GAMESDB_PLATFORM_CATEGORY, GAMESDB_PROVIDER } from "./constants.js";
import type { GamesDbProvider } from "./client.js";
import type { FetchGamesDbPlatformInput, GamesDbTransformOptions } from "./types.js";

export async function fetchGamesDbPlatformSourceRecord(
  provider: GamesDbProvider,
  input: FetchGamesDbPlatformInput
): Promise<SourceRecord | undefined> {
  const id = gamesDbNumericId(input.id, "GamesDB platform id");
  const payload = await provider.getJson<JsonValue>("/Platforms/ByPlatformID", {
    id,
    fields: "icon,console,controller,developer,manufacturer,media,cpu,memory,graphics,sound,maxcontrollers,display,overview,youtube",
    include: "boxart"
  });
  if (!payload) return undefined;
  return createSourceRecord({ source: { provider: GAMESDB_PROVIDER, category: GAMESDB_PLATFORM_CATEGORY, externalId: id }, payload });
}

export async function transformGamesDbPlatform(source: SourceRecord, options: GamesDbTransformOptions = {}): Promise<ZuuidData> {
  if (source.source.provider !== GAMESDB_PROVIDER || source.source.category !== GAMESDB_PLATFORM_CATEGORY) {
    throw new Error(`unsupported GamesDB source: ${source.source.provider}:${source.source.category}`);
  }
  const envelope = objectPayload(source.payload);
  const payload = platformFromPayload(envelope, source.source.externalId);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "name") ?? stringField(payload, "platform");
  if (!id) throw new Error("missing required GamesDB platform field: id");
  if (!title) throw new Error("missing required GamesDB platform field: name");
  const data = await baseDataFromSource(source, GAMESDB_PROVIDER, GAMESDB_PLATFORM_CATEGORY, GAMESDB_PLATFORM_CATEGORY, id, title);
  addAlias(data, title, "title", true, GAMESDB_PROVIDER);
  addAlias(data, stringField(payload, "alias"), "slug", false, GAMESDB_PROVIDER);
  addDescription(data, GAMESDB_PROVIDER, stringField(payload, "overview") ?? stringField(payload, "description"));
  for (const key of ["manufacturer", "developer", "media", "release_date", "cpu", "memory", "graphics", "sound", "display", "maxcontrollers", "youtube"]) addDetail(data, GAMESDB_PROVIDER, key, valueAsString(payload[key]));
  for (const media of mediaCandidates(payload, envelope, id, options.imageBaseUrl)) addMedia(data, GAMESDB_PROVIDER, media.url, media.category, "image", media.primary);
  addTag(data, "platform");
  addTag(data, "game");
  return finalizeData(data, source);
}

function gamesDbNumericId(value: string | number, label: string): string {
  const id = String(value).trim();
  if (!/^\d+$/.test(id)) throw new Error(`${label} must be numeric: ${id}`);
  return id;
}

function platformFromPayload(envelope: Record<string, JsonValue>, externalId: string): Record<string, JsonValue> {
  const platforms = platformsFromPayload(envelope);
  if (!platforms.length) return envelope;
  return platforms.find((platform) => valueAsString(platform.id) === externalId.trim()) ?? platforms[0] ?? envelope;
}

function platformsFromPayload(payload: Record<string, JsonValue>): Record<string, JsonValue>[] {
  const data = objectPayload(payload.data ?? {});
  const platforms = data.platforms ?? payload.platforms;
  if (Array.isArray(platforms)) return platforms.filter(isObject);
  if (isObject(platforms)) return Object.values(platforms).filter(isObject);
  return [];
}

function mediaCandidates(payload: Record<string, JsonValue>, envelope: Record<string, JsonValue>, id: string, fallbackBaseUrl: string | null | undefined): { url: string; category: string; primary: boolean }[] {
  const baseUrl = imageBaseUrl(envelope, fallbackBaseUrl);
  const output: { url: string; category: string; primary: boolean }[] = [];
  for (const [key, category] of [["icon", "icon"], ["console", "console"], ["controller", "controller"], ["image", "image"]] as const) {
    const url = mediaUrl(stringField(payload, key), baseUrl);
    if (url) output.push({ url, category, primary: output.length === 0 });
  }
  for (const image of boxartImages(envelope, id)) {
    const filename = stringField(image, "filename") ?? stringField(image, "value") ?? stringField(image, "url");
    const url = mediaUrl(filename, baseUrl);
    if (!url || output.some((item) => item.url === url)) continue;
    output.push({ url, category: stringField(image, "type") ?? "boxart", primary: output.length === 0 });
  }
  return output;
}

function imageBaseUrl(envelope: Record<string, JsonValue>, fallback: string | null | undefined): string | null | undefined {
  const boxart = objectPayload(objectPayload(envelope.include ?? {}).boxart ?? objectPayload(envelope.data ?? {}).boxart ?? envelope.boxart ?? {});
  const baseUrl = objectPayload(boxart.base_url ?? {});
  return stringField(baseUrl, "original") ?? stringField(baseUrl, "large") ?? fallback;
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

function mediaUrl(path: string | undefined, baseUrl: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path) || !baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
