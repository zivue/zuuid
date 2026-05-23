import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addRelation, addTag, arrayField, baseDataFromSource, finalizeData, nestedString, objectPayload, stringField, stripHtml, valueAsString } from "../common.js";
import { COMICVINE_CHARACTER_CATEGORY, COMICVINE_PERSON_CATEGORY, COMICVINE_PROVIDER, COMICVINE_PUBLISHER_CATEGORY, COMICVINE_VOLUME_CATEGORY } from "./constants.js";

export async function transformComicVine(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== COMICVINE_PROVIDER) throw new Error(`unsupported ComicVine source: ${source.source.provider}:${source.source.category}`);
  const publicCategory = source.source.category === COMICVINE_VOLUME_CATEGORY ? "comic" : source.source.category === COMICVINE_PUBLISHER_CATEGORY ? "organization" : source.source.category === COMICVINE_CHARACTER_CATEGORY || source.source.category === COMICVINE_PERSON_CATEGORY ? "person" : undefined;
  if (!publicCategory) throw new Error(`unsupported ComicVine source: ${source.source.provider}:${source.source.category}`);
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "name") ?? stringField(payload, "title");
  if (!id) throw new Error("missing required ComicVine field: id");
  if (!title) throw new Error("missing required ComicVine field: name");
  const data = await baseDataFromSource(source, COMICVINE_PROVIDER, source.source.category, publicCategory, id, title);
  addAlias(data, title, "title", true, COMICVINE_PROVIDER, "en");
  addAlias(data, stringField(payload, "real_name"), "alias", false, COMICVINE_PROVIDER, "en");
  for (const value of (stringField(payload, "aliases") ?? "").split(/\r?\n/)) addAlias(data, value, "alternative", false, COMICVINE_PROVIDER, "en");
  const description = stringField(payload, "description") ?? stringField(payload, "deck");
  addDescription(data, COMICVINE_PROVIDER, description ? stripHtml(description) : undefined, "en");
  addMedia(data, COMICVINE_PROVIDER, nestedString(payload, ["image", "super_url"]) ?? nestedString(payload, ["image", "original_url"]) ?? nestedString(payload, ["image", "medium_url"]) ?? nestedString(payload, ["image", "icon_url"]), "cover");
  for (const key of ["start_year", "count_of_issues", "birth", "death", "hometown", "real_name", "aliases", "deck"]) addDetail(data, COMICVINE_PROVIDER, key, valueAsString(payload[key]));
  for (const value of arrayField(payload, "concepts")) if (value && typeof value === "object" && !Array.isArray(value)) addTag(data, stringField(value as never, "name"));
  addTag(data, publicCategory === "organization" ? "publisher" : publicCategory === "person" ? "character" : publicCategory);
  await addRelationObject(data, payload, "publisher", "publisher", "publisher");
  await addRelationArray(data, payload, "characters", "character", "character");
  await addRelationArray(data, payload, "people", "creator", "person");
  await addRelationArray(data, payload, "volumes", "volume", "volume");
  return finalizeData(data, source);
}

async function addRelationObject(data: ZuuidData, payload: Record<string, unknown>, key: string, relation: string, category: string): Promise<void> {
  const value = payload[key];
  if (value && typeof value === "object" && !Array.isArray(value)) await addComicRelation(data, value as Record<string, never>, relation, category);
}

async function addRelationArray(data: ZuuidData, payload: Record<string, unknown>, key: string, relation: string, category: string): Promise<void> {
  let index = 0;
  for (const value of arrayField(payload as never, key)) {
    if (value && typeof value === "object" && !Array.isArray(value)) await addComicRelation(data, value as Record<string, never>, relation, category, index);
    index += 1;
  }
}

async function addComicRelation(data: ZuuidData, value: Record<string, unknown>, relation: string, category: string, order: number | null = null): Promise<void> {
  const name = stringField(value as never, "name");
  const role = stringField(value as never, "role");
  await addRelation(data, COMICVINE_PROVIDER, category, valueAsString(value.id as never), relation, name, { attribute: name && role ? `${name} - ${role}` : role ?? null, order });
}
