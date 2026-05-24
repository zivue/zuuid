import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addTag, arrayField, baseDataFromSource, finalizeData, nestedString, normalizeRating, objectPayload, stringField, valueAsString } from "../common.js";
import { OPENSTREETMAP_CITY_CATEGORY, OPENSTREETMAP_COUNTRY_CATEGORY, OPENSTREETMAP_PLACE_CATEGORY, OPENSTREETMAP_PROVIDER, OPENSTREETMAP_VENUE_CATEGORY } from "./constants.js";

export async function transformOpenStreetMapPlace(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== OPENSTREETMAP_PROVIDER || ![OPENSTREETMAP_CITY_CATEGORY, OPENSTREETMAP_COUNTRY_CATEGORY, OPENSTREETMAP_PLACE_CATEGORY, OPENSTREETMAP_VENUE_CATEGORY].includes(source.source.category)) {
    throw new Error(`unsupported OpenStreetMap source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || osmId(payload) || valueAsString(payload.place_id);
  const title = stringField(payload, "name") ?? stringField(payload, "display_name");
  if (!id) throw new Error("missing required OpenStreetMap field: place_id");
  if (!title) throw new Error("missing required OpenStreetMap field: name");
  const data = await baseDataFromSource(source, OPENSTREETMAP_PROVIDER, source.source.category, source.source.category, id, title);
  const rawImportance = typeof payload.importance === "number" ? payload.importance : undefined;
  data.rating = normalizeRating(rawImportance, 0, 1);
  addDetail(data, OPENSTREETMAP_PROVIDER, "provider_rating", rawImportance);
  addAlias(data, title, "title", true, OPENSTREETMAP_PROVIDER);
  addNamedetailAliases(data, payload, title);
  addDescription(data, OPENSTREETMAP_PROVIDER, stringField(payload, "display_name"), "en");
  addMedia(data, OPENSTREETMAP_PROVIDER, stringField(payload, "icon"), "icon");
  addDetail(data, OPENSTREETMAP_PROVIDER, "osm_type", stringField(payload, "osm_type"));
  addDetail(data, OPENSTREETMAP_PROVIDER, "osm_id", valueAsString(payload.osm_id));
  addDetail(data, OPENSTREETMAP_PROVIDER, "latitude", stringField(payload, "lat"));
  addDetail(data, OPENSTREETMAP_PROVIDER, "longitude", stringField(payload, "lon"));
  for (const [key, path] of [["country", ["address", "country"]], ["country_code", ["address", "country_code"]], ["state", ["address", "state"]], ["postal_code", ["address", "postcode"]]] as const) addDetail(data, OPENSTREETMAP_PROVIDER, key, nestedString(payload, [...path]));
  addDetail(data, OPENSTREETMAP_PROVIDER, "city", nestedString(payload, ["address", "city"]) ?? nestedString(payload, ["address", "town"]) ?? nestedString(payload, ["address", "village"]));
  addDetail(data, OPENSTREETMAP_PROVIDER, "road", nestedString(payload, ["address", "road"]));
  addDetail(data, OPENSTREETMAP_PROVIDER, "house_number", nestedString(payload, ["address", "house_number"]));
  addDetail(data, OPENSTREETMAP_PROVIDER, "class", stringField(payload, "class"));
  addDetail(data, OPENSTREETMAP_PROVIDER, "type", stringField(payload, "type"));
  const bbox = arrayField(payload, "boundingbox").filter((value): value is string => typeof value === "string").join(",");
  addDetail(data, OPENSTREETMAP_PROVIDER, "bounding_box", bbox || undefined);
  for (const key of ["population", "wikidata", "wikipedia"]) addDetail(data, OPENSTREETMAP_PROVIDER, key, nestedString(payload, ["extratags", key]));
  const wikidata = nestedString(payload, ["extratags", "wikidata"]);
  if (wikidata) data.externalIds.push({ source: "wikidata", category: source.source.category, value: wikidata });
  addTag(data, "location"); addTag(data, "place"); addTag(data, source.source.category); addTag(data, nestedString(payload, ["address", "country_code"]));
  return finalizeData(data, source);
}

function osmId(payload: Record<string, unknown>): string | undefined {
  const osmType = stringField(payload as never, "osm_type");
  const id = valueAsString((payload as Record<string, never>).osm_id);
  if (!osmType || !id) return undefined;
  const prefix = osmType === "relation" ? "R" : osmType === "way" ? "W" : osmType === "node" ? "N" : osmType.slice(0, 1) || "O";
  return `${prefix}${id}`;
}

function addNamedetailAliases(data: ZuuidData, payload: Record<string, unknown>, title: string): void {
  const details = payload.namedetails;
  if (!details || typeof details !== "object" || Array.isArray(details)) return;
  let count = 0;
  for (const [key, value] of Object.entries(details)) {
    if (count >= 10) break;
    if (key.startsWith("name:") && typeof value === "string" && value.trim() && value !== title) {
      addAlias(data, value, "title", false, OPENSTREETMAP_PROVIDER, key.slice(5));
      count += 1;
    }
  }
}
