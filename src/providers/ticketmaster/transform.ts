import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addRelation, addTag, arrayField, baseDataFromSource, datePrefix, finalizeData, nestedString, objectPayload, stringField, valueAsString } from "../common.js";
import { TICKETMASTER_ATTRACTION_CATEGORY, TICKETMASTER_EVENT_CATEGORY, TICKETMASTER_PROVIDER, TICKETMASTER_VENUE_CATEGORY } from "./constants.js";

export async function transformTicketmaster(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== TICKETMASTER_PROVIDER) throw new Error(`unsupported Ticketmaster source: ${source.source.provider}:${source.source.category}`);
  if (source.source.category === TICKETMASTER_EVENT_CATEGORY) return transformTicketmasterEvent(source);
  if (source.source.category === TICKETMASTER_ATTRACTION_CATEGORY) return transformTicketmasterAttraction(source);
  if (source.source.category === TICKETMASTER_VENUE_CATEGORY) return transformTicketmasterVenue(source);
  throw new Error(`unsupported Ticketmaster source: ${source.source.provider}:${source.source.category}`);
}

export async function transformTicketmasterEvent(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const data = await baseTicketmaster(source, "event");
  data.primaryDate = datePrefix(nestedString(payload, ["dates", "start", "localDate"]));
  addDescription(data, TICKETMASTER_PROVIDER, stringField(payload, "info") ?? stringField(payload, "pleaseNote") ?? stringField(payload, "please_note"));
  for (const [key, value] of [["type", stringField(payload, "type")], ["locale", stringField(payload, "locale")], ["source_url", stringField(payload, "url")], ["status", nestedString(payload, ["dates", "status", "code"])], ["event_date", nestedString(payload, ["dates", "start", "localDate"])], ["event_time", nestedString(payload, ["dates", "start", "localTime"])], ["timezone", nestedString(payload, ["dates", "timezone"])]] as const) addDetail(data, TICKETMASTER_PROVIDER, key, value);
  addImages(data, payload); addClassifications(data, payload);
  await addEmbeddedRelations(data, payload, "venues", TICKETMASTER_VENUE_CATEGORY);
  await addEmbeddedRelations(data, payload, "attractions", TICKETMASTER_ATTRACTION_CATEGORY);
  return finalizeData(data, source);
}

export async function transformTicketmasterAttraction(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const data = await baseTicketmaster(source, "artist");
  addAlias(data, data.primaryTitle, "title", true, TICKETMASTER_PROVIDER);
  for (const alias of arrayField(payload, "aliases")) if (typeof alias === "string") addAlias(data, alias, "alias", false, TICKETMASTER_PROVIDER);
  addDetail(data, TICKETMASTER_PROVIDER, "type", stringField(payload, "type"));
  addDetail(data, TICKETMASTER_PROVIDER, "source_url", stringField(payload, "url"));
  addDetail(data, TICKETMASTER_PROVIDER, "upcoming_events", valueAsString((payload.upcomingEvents as Record<string, never> | undefined)?._total));
  addImages(data, payload); addClassifications(data, payload); addTag(data, "attraction");
  return finalizeData(data, source);
}

export async function transformTicketmasterVenue(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const data = await baseTicketmaster(source, TICKETMASTER_VENUE_CATEGORY);
  for (const [key, value] of [["type", stringField(payload, "type")], ["timezone", stringField(payload, "timezone")], ["source_url", stringField(payload, "url")], ["postal_code", stringField(payload, "postalCode")], ["city", nestedString(payload, ["city", "name"])], ["state", nestedString(payload, ["state", "name"])], ["country", nestedString(payload, ["country", "name"])], ["latitude", nestedString(payload, ["location", "latitude"])], ["longitude", nestedString(payload, ["location", "longitude"])], ["parking", nestedString(payload, ["parkingDetail"])], ["accessibility", nestedString(payload, ["accessibleSeatingDetail"])]] as const) addDetail(data, TICKETMASTER_PROVIDER, key, value);
  addImages(data, payload); addTag(data, "venue");
  return finalizeData(data, source);
}

async function baseTicketmaster(source: SourceRecord, publicCategory: string): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || stringField(payload, "id");
  const title = stringField(payload, "name") ?? stringField(payload, "title");
  if (!id) throw new Error("missing required Ticketmaster field: id");
  if (!title) throw new Error("missing required Ticketmaster field: name");
  return baseDataFromSource(source, TICKETMASTER_PROVIDER, source.source.category, publicCategory, id, title);
}

function addImages(data: ZuuidData, payload: Record<string, unknown>): void {
  let index = 0;
  for (const value of arrayField(payload as never, "images")) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      addMedia(data, TICKETMASTER_PROVIDER, stringField(value as never, "url"), "image", "image", index === 0);
      index += 1;
    }
  }
}

function addClassifications(data: ZuuidData, payload: Record<string, unknown>): void {
  for (const classification of arrayField(payload as never, "classifications")) {
    if (!classification || typeof classification !== "object" || Array.isArray(classification)) continue;
    for (const key of ["segment", "genre", "subGenre", "type", "subType"]) addTag(data, nestedString(classification as never, [key, "name"]));
  }
}

async function addEmbeddedRelations(data: ZuuidData, payload: Record<string, unknown>, key: string, category: string): Promise<void> {
  const embedded = payload._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return;
  let index = 0;
  for (const value of arrayField(embedded as never, key)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      await addRelation(data, TICKETMASTER_PROVIDER, category, stringField(value as never, "id"), category, stringField(value as never, "name"), { order: index });
      index += 1;
    }
  }
}
