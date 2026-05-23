import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addTag, baseDataFromSource, finalizeData, objectPayload, stringField, stripHtml, valueAsString } from "../common.js";
import { WGER_EQUIPMENT_CATEGORY, WGER_PROVIDER } from "./constants.js";

export async function transformWgerEquipment(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== WGER_PROVIDER || source.source.category !== WGER_EQUIPMENT_CATEGORY) throw new Error(`unsupported Wger source: ${source.source.provider}:${source.source.category}`);
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.id);
  const title = stringField(payload, "name");
  if (!id) throw new Error("missing required Wger equipment field: id");
  if (!title) throw new Error("missing required Wger equipment field: name");
  const data = await baseDataFromSource(source, WGER_PROVIDER, WGER_EQUIPMENT_CATEGORY, WGER_EQUIPMENT_CATEGORY, id, title);
  addAlias(data, title, "title", true, WGER_PROVIDER, "en");
  const description = stringField(payload, "description");
  addDescription(data, WGER_PROVIDER, description ? stripHtml(description) : undefined, "en");
  addDetail(data, WGER_PROVIDER, "exercise_count", valueAsString(payload.exercise_count));
  addMedia(data, WGER_PROVIDER, stringField(payload, "image"), "photo");
  addTag(data, "equipment");
  addTag(data, "exercise");
  return finalizeData(data, source);
}
