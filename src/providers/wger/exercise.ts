import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addRelation, addTag, arrayField, baseDataFromSource, finalizeData, nestedString, objectPayload, stringField, stripHtml, valueAsString } from "../common.js";
import { WGER_EXERCISE_CATEGORY, WGER_PROVIDER } from "./constants.js";

export async function transformWgerExercise(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== WGER_PROVIDER || source.source.category !== WGER_EXERCISE_CATEGORY) throw new Error(`unsupported Wger source: ${source.source.provider}:${source.source.category}`);
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "name");
  if (!id) throw new Error("missing required Wger exercise field: id");
  if (!title) throw new Error("missing required Wger exercise field: name");
  const data = await baseDataFromSource(source, WGER_PROVIDER, WGER_EXERCISE_CATEGORY, WGER_EXERCISE_CATEGORY, id, title);
  addAlias(data, title, "title", true, WGER_PROVIDER, "en");
  const description = stringField(payload, "description");
  addDescription(data, WGER_PROVIDER, description ? stripHtml(description) : undefined, "en");
  addDetail(data, WGER_PROVIDER, "exercise_category", nestedString(payload, ["category", "name"]));
  addJoined(data, payload, "muscle_primary", "muscles", "name_en");
  addJoined(data, payload, "muscle_secondary", "muscles_secondary", "name_en");
  addJoined(data, payload, "equipment", "equipment", "name");
  arrayField(payload, "images").forEach((value, index) => {
    if (value && typeof value === "object" && !Array.isArray(value)) addMedia(data, WGER_PROVIDER, stringField(value as never, "image"), "photo", "image", index === 0);
  });
  let index = 0;
  for (const value of arrayField(payload, "variations")) {
    await addRelation(data, WGER_PROVIDER, WGER_EXERCISE_CATEGORY, valueAsString(value), "variation", undefined, { order: index });
    index += 1;
  }
  addTag(data, "exercise"); addTag(data, nestedString(payload, ["category", "name"]));
  for (const [arrayKey, nameKey] of [["muscles", "name_en"], ["muscles_secondary", "name_en"], ["equipment", "name"]] as const) {
    for (const value of arrayField(payload, arrayKey)) if (value && typeof value === "object" && !Array.isArray(value)) addTag(data, stringField(value as never, nameKey));
  }
  return finalizeData(data, source);
}

function addJoined(data: ZuuidData, payload: Record<string, unknown>, detailKey: string, arrayKey: string, nameKey: string): void {
  const names = arrayField(payload as never, arrayKey).map((value) => value && typeof value === "object" && !Array.isArray(value) ? stringField(value as never, nameKey) : undefined).filter((value): value is string => !!value);
  addDetail(data, WGER_PROVIDER, detailKey, names.length ? names.join(", ") : undefined);
}
