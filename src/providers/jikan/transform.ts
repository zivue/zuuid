import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addRelation, addTag, arrayField, baseDataFromSource, datePrefix, finalizeData, nestedString, objectPayload, stringField, stripHtml, valueAsString } from "../common.js";
import { JIKAN_ANIME_CATEGORY, JIKAN_CHARACTER_CATEGORY, JIKAN_MANGA_CATEGORY, JIKAN_PERSON_CATEGORY, JIKAN_PROVIDER } from "./constants.js";

export async function transformJikan(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== JIKAN_PROVIDER) throw new Error(`unsupported Jikan source: ${source.source.provider}:${source.source.category}`);
  if (source.source.category === JIKAN_ANIME_CATEGORY || source.source.category === JIKAN_MANGA_CATEGORY) return transformJikanTitle(source, source.source.category);
  if (source.source.category === JIKAN_CHARACTER_CATEGORY || source.source.category === JIKAN_PERSON_CATEGORY) return transformJikanPersonish(source, source.source.category);
  throw new Error(`unsupported Jikan source: ${source.source.provider}:${source.source.category}`);
}

export async function transformJikanTitle(source: SourceRecord, publicCategory = source.source.category): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.mal_id);
  const title = stringField(payload, "title") ?? stringField(payload, "name") ?? stringField(payload, "title_english");
  if (!id) throw new Error("missing required Jikan field: mal_id");
  if (!title) throw new Error("missing required Jikan field: title");
  const data = await baseDataFromSource(source, JIKAN_PROVIDER, source.source.category, publicCategory, id, title);
  data.rating = typeof payload.score === "number" ? payload.score : undefined;
  data.primaryDate = datePrefix(nestedString(payload, ["aired", "from"]) ?? nestedString(payload, ["published", "from"]));
  addTitleAliases(data, payload, title);
  addDescription(data, JIKAN_PROVIDER, stringField(payload, "synopsis") ?? stringField(payload, "background"), "en");
  addCover(data, payload, "poster");
  const trailer = nestedString(payload, ["trailer", "url"]) ?? (nestedString(payload, ["trailer", "youtube_id"]) ? `https://www.youtube.com/watch?v=${nestedString(payload, ["trailer", "youtube_id"])}` : undefined);
  addMedia(data, JIKAN_PROVIDER, trailer, "trailer", "video", false);
  for (const key of ["type", "source", "status", "rating", "season", "duration"]) addDetail(data, JIKAN_PROVIDER, key, stringField(payload, key));
  for (const key of ["episodes", "chapters", "volumes", "rank", "popularity", "members", "favorites", "scored_by"]) addDetail(data, JIKAN_PROVIDER, key, valueAsString(payload[key]));
  for (const key of ["genres", "themes", "demographics"]) addNamedTags(data, payload, key);
  await addNamedRelations(data, payload, "studios", "studio", "organization");
  await addNamedRelations(data, payload, "producers", "producer", "organization");
  await addNamedRelations(data, payload, "authors", "author", "person");
  return finalizeData(data, source);
}

export async function transformJikanPersonish(source: SourceRecord, sourceCategory = source.source.category): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.mal_id);
  const title = stringField(payload, "title") ?? stringField(payload, "name") ?? stringField(payload, "title_english");
  if (!id) throw new Error("missing required Jikan field: mal_id");
  if (!title) throw new Error("missing required Jikan field: name");
  const data = await baseDataFromSource(source, JIKAN_PROVIDER, sourceCategory, "person", id, title);
  data.primaryDate = datePrefix(stringField(payload, "birthday"));
  addTitleAliases(data, payload, title);
  addDescription(data, JIKAN_PROVIDER, stringField(payload, "about"), "en");
  addCover(data, payload, "profile");
  for (const key of ["favorites", "given_name", "family_name", "alternate_names"]) addDetail(data, JIKAN_PROVIDER, key, valueAsString(payload[key]));
  return finalizeData(data, source);
}

function addTitleAliases(data: ZuuidData, payload: Record<string, unknown>, title: string): void {
  addAlias(data, title, "title", true, JIKAN_PROVIDER);
  for (const [key, lang] of [["title_english", "en"], ["title_japanese", "ja"], ["name_kanji", "ja"]] as const) {
    const value = stringField(payload as never, key);
    if (value !== title) addAlias(data, value, "title", false, JIKAN_PROVIDER, lang);
  }
  for (const key of ["title_synonyms", "nicknames", "alternate_names"]) {
    for (const value of arrayField(payload as never, key)) if (typeof value === "string" && value !== title) addAlias(data, value, "alternative", false, JIKAN_PROVIDER);
  }
}

function addCover(data: ZuuidData, payload: Record<string, unknown>, category: string): void {
  addMedia(data, JIKAN_PROVIDER, nestedString(payload as never, ["images", "jpg", "large_image_url"]) ?? nestedString(payload as never, ["images", "jpg", "image_url"]) ?? nestedString(payload as never, ["images", "webp", "large_image_url"]) ?? nestedString(payload as never, ["images", "webp", "image_url"]), category);
}

function addNamedTags(data: ZuuidData, payload: Record<string, unknown>, key: string): void {
  for (const value of arrayField(payload as never, key)) if (value && typeof value === "object" && !Array.isArray(value)) addTag(data, stringField(value as never, "name"));
}

async function addNamedRelations(data: ZuuidData, payload: Record<string, unknown>, key: string, relation: string, category: string): Promise<void> {
  let index = 0;
  for (const value of arrayField(payload as never, key)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      await addRelation(data, JIKAN_PROVIDER, category, valueAsString((value as Record<string, never>).mal_id), relation, stringField(value as never, "name"), { order: index });
      index += 1;
    }
  }
}
