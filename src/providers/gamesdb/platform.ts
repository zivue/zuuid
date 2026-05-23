import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addTag, baseDataFromSource, finalizeData, objectPayload, stringField, valueAsString } from "../common.js";
import { GAMESDB_PLATFORM_CATEGORY, GAMESDB_PROVIDER } from "./constants.js";

export async function transformGamesDbPlatform(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== GAMESDB_PROVIDER || source.source.category !== GAMESDB_PLATFORM_CATEGORY) {
    throw new Error(`unsupported GamesDB source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "name") ?? stringField(payload, "platform");
  if (!id) throw new Error("missing required GamesDB platform field: id");
  if (!title) throw new Error("missing required GamesDB platform field: name");
  const data = await baseDataFromSource(source, GAMESDB_PROVIDER, GAMESDB_PLATFORM_CATEGORY, GAMESDB_PLATFORM_CATEGORY, id, title);
  addAlias(data, title, "title", true, GAMESDB_PROVIDER);
  addDescription(data, GAMESDB_PROVIDER, stringField(payload, "overview") ?? stringField(payload, "description"));
  for (const key of ["manufacturer", "developer", "release_date", "cpu", "memory", "graphics", "sound", "display"]) addDetail(data, GAMESDB_PROVIDER, key, valueAsString(payload[key]));
  addMedia(data, GAMESDB_PROVIDER, stringField(payload, "icon") ?? stringField(payload, "image") ?? stringField(payload, "console"), "image");
  addTag(data, "platform");
  addTag(data, "game");
  return finalizeData(data, source);
}
