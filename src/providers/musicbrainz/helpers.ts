import type { ZuuidData } from "../../entity.js";
import type { JsonValue } from "../../types.js";
import { addAlias, addDescription, addDetail, addTag, arrayField, nestedString, objectPayload, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_PROVIDER } from "./constants.js";

export function musicBrainzPayload(value: JsonValue): Record<string, JsonValue> {
  return objectPayload(value);
}

export function musicBrainzId(payload: Record<string, JsonValue>, externalId: string): string | undefined {
  return externalId.trim() || stringField(payload, "id");
}

export function requireMusicBrainzTitle(payload: Record<string, JsonValue>, field = "title"): string | undefined {
  return stringField(payload, field) ?? stringField(payload, "name");
}

export function addMusicBrainzAliases(data: ZuuidData, payload: Record<string, JsonValue>, primary: string): void {
  addAlias(data, primary, "title", true, MUSICBRAINZ_PROVIDER);
  for (const alias of arrayField(payload, "aliases")) {
    if (!alias || typeof alias !== "object" || Array.isArray(alias)) continue;
    const object = alias as Record<string, JsonValue>;
    addAlias(data, stringField(object, "name"), stringField(object, "type") ?? "alias", false, MUSICBRAINZ_PROVIDER, stringField(object, "locale"));
  }
}

export function addMusicBrainzDescription(data: ZuuidData, payload: Record<string, JsonValue>): void {
  addDescription(data, MUSICBRAINZ_PROVIDER, stringField(payload, "disambiguation"));
  addDescription(data, MUSICBRAINZ_PROVIDER, stringField(payload, "annotation"));
}

export function addMusicBrainzTags(data: ZuuidData, payload: Record<string, JsonValue>): void {
  for (const key of ["genres", "tags"]) {
    for (const item of arrayField(payload, key)) {
      if (item && typeof item === "object" && !Array.isArray(item)) addTag(data, stringField(item as Record<string, JsonValue>, "name"));
    }
  }
}

export function artistCredit(payload: Record<string, JsonValue>): string | undefined {
  const names = arrayField(payload, "artist-credit").map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const object = item as Record<string, JsonValue>;
    return stringField(object, "name") ?? nestedString(object, ["artist", "name"]);
  }).filter((value): value is string => !!value);
  return names.length ? names.join(", ") : undefined;
}

export function addArtistCreditDetail(data: ZuuidData, payload: Record<string, JsonValue>): void {
  addDetail(data, MUSICBRAINZ_PROVIDER, "artist_credit", artistCredit(payload));
}

export function addLifeSpanDetails(data: ZuuidData, payload: Record<string, JsonValue>): void {
  addDetail(data, MUSICBRAINZ_PROVIDER, "begin_date", nestedString(payload, ["life-span", "begin"]));
  addDetail(data, MUSICBRAINZ_PROVIDER, "end_date", nestedString(payload, ["life-span", "end"]));
  addDetail(data, MUSICBRAINZ_PROVIDER, "ended", valueAsString(nestedRaw(payload, ["life-span", "ended"])));
}

export function nestedRaw(payload: Record<string, JsonValue>, path: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = payload;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, JsonValue>)[key];
  }
  return current;
}

export function addAreaDetails(data: ZuuidData, payload: Record<string, JsonValue>): void {
  addDetail(data, MUSICBRAINZ_PROVIDER, "area", nestedString(payload, ["area", "name"]));
  addDetail(data, MUSICBRAINZ_PROVIDER, "begin_area", nestedString(payload, ["begin-area", "name"]));
  addDetail(data, MUSICBRAINZ_PROVIDER, "end_area", nestedString(payload, ["end-area", "name"]));
}

export function addRelationListDetail(data: ZuuidData, payload: Record<string, JsonValue>, key: string, detailKey: string): void {
  const values = arrayField(payload, key).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    return stringField(item as Record<string, JsonValue>, "title") ?? stringField(item as Record<string, JsonValue>, "name");
  }).filter((value): value is string => !!value);
  addDetail(data, MUSICBRAINZ_PROVIDER, detailKey, values.length ? values.join(", ") : undefined);
}
