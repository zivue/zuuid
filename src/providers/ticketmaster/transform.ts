import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addLink, addMedia, addRelation, addTag, arrayField, baseDataFromSource, datePrefix, finalizeData, nestedString, numberField, objectField, objectPayload, stringField, valueAsString } from "../common.js";
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
  const embedded = objectField(payload, "_embedded");
  const venue = embedded ? arrayField(embedded, "venues").map(objectPayload).find((value) => stringField(value, "name")) : undefined;
  if (venue) {
    const artists = embedded ? arrayField(embedded, "attractions").map(objectPayload).map((value) => stringField(value, "name")?.trim()).filter((name): name is string => !!name) : [];
    const city = nestedString(venue, ["city", "name"]);
    const title = `${[...new Set(artists)].join(" & ") || data.primaryTitle}@${stringField(venue, "name")?.trim()}${city ? `, ${city.trim()}` : ""}`;
    if (title !== data.primaryTitle) addAlias(data, data.primaryTitle, "title", false, TICKETMASTER_PROVIDER);
    data.primaryTitle = title;
  }
  data.primaryDate = datePrefix(nestedString(payload, ["dates", "start", "localDate"]));
  addDescription(data, TICKETMASTER_PROVIDER, stringField(payload, "info"));
  addDetail(data, TICKETMASTER_PROVIDER, "notice", stringField(payload, "pleaseNote") ?? stringField(payload, "please_note"));
  const start = objectField(objectField(payload, "dates") ?? {}, "start");
  const time = start?.timeTBA === true || start?.noSpecificTime === true ? undefined : eventTime(nestedString(payload, ["dates", "start", "localTime"]));
  for (const [key, value] of [["source_url", stringField(payload, "url")], ["status", nestedString(payload, ["dates", "status", "code"])], ["event_time", time], ["timezone", nestedString(payload, ["dates", "timezone"])]] as const) addDetail(data, TICKETMASTER_PROVIDER, key, value);
  addLink(data, TICKETMASTER_PROVIDER, stringField(payload, "url"), "tickets", { service: "ticketmaster" });
  const location = embeddedItem(payload, "venues");
  for (const [key, value] of [
    ["venue", stringField(location, "name")],
    ["address", nestedString(location, ["address", "line1"])],
    ["postal_code", stringField(location, "postalCode")],
    ["city", nestedString(location, ["city", "name"])],
    ["state", nestedString(location, ["state", "name"])],
    ["country", nestedString(location, ["country", "name"])],
    ["latitude", nestedString(location, ["location", "latitude"])],
    ["longitude", nestedString(location, ["location", "longitude"])],
  ] as const) addDetail(data, TICKETMASTER_PROVIDER, key, value);
  const price = priceSummary(payload);
  addDetail(data, TICKETMASTER_PROVIDER, "price", price);
  addImages(data, payload); addClassifications(data, payload);
  await addEmbeddedRelations(data, payload, "venues", TICKETMASTER_VENUE_CATEGORY);
  await addEmbeddedRelations(data, payload, "attractions", TICKETMASTER_ATTRACTION_CATEGORY);
  return finalizeData(data, source);
}

function embeddedItem(payload: Record<string, unknown>, key: string): Record<string, never> {
  const embedded = payload._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return {};
  const item = arrayField(embedded as never, key)[0];
  return item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, never> : {};
}

function priceSummary(payload: Record<string, unknown>): string | undefined {
  const range = arrayField(payload as never, "priceRanges")[0];
  if (!range || typeof range !== "object" || Array.isArray(range)) return undefined;
  const minimum = valueAsString((range as Record<string, never>).min);
  const maximum = valueAsString((range as Record<string, never>).max);
  const currency = stringField(range as never, "currency");
  if (!minimum && !maximum) return undefined;
  return `${[minimum, maximum].filter((value, index, values) => value && values.indexOf(value) === index).join("–")}${currency ? ` ${currency}` : ""}`;
}

export async function transformTicketmasterAttraction(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const data = await baseTicketmaster(source, "artist");
  addAlias(data, data.primaryTitle, "title", true, TICKETMASTER_PROVIDER);
  for (const alias of arrayField(payload, "aliases")) if (typeof alias === "string") addAlias(data, alias, "alias", false, TICKETMASTER_PROVIDER);
  addDetail(data, TICKETMASTER_PROVIDER, "type", stringField(payload, "type"));
  addDetail(data, TICKETMASTER_PROVIDER, "source_url", stringField(payload, "url"));
  addLink(data, TICKETMASTER_PROVIDER, stringField(payload, "url"), "events", { service: "ticketmaster" });
  addDetail(data, TICKETMASTER_PROVIDER, "upcoming_events", valueAsString((payload.upcomingEvents as Record<string, never> | undefined)?._total));
  addImages(data, payload); addClassifications(data, payload); addTag(data, "attraction");
  return finalizeData(data, source);
}

export async function transformTicketmasterVenue(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const data = await baseTicketmaster(source, TICKETMASTER_VENUE_CATEGORY);
  for (const [key, value] of [["type", stringField(payload, "type")], ["timezone", stringField(payload, "timezone")], ["source_url", stringField(payload, "url")], ["postal_code", stringField(payload, "postalCode")], ["city", nestedString(payload, ["city", "name"])], ["state", nestedString(payload, ["state", "name"])], ["country", nestedString(payload, ["country", "name"])], ["latitude", nestedString(payload, ["location", "latitude"])], ["longitude", nestedString(payload, ["location", "longitude"])], ["parking", nestedString(payload, ["parkingDetail"])], ["accessibility", nestedString(payload, ["accessibleSeatingDetail"])]] as const) addDetail(data, TICKETMASTER_PROVIDER, key, value);
  addLink(data, TICKETMASTER_PROVIDER, stringField(payload, "url"), "events", { service: "ticketmaster" });
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
  const images: { url: string; width?: number; height?: number }[] = [];
  for (const value of arrayField(payload as never, "images")) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const image = objectPayload(value);
      const url = stringField(image, "url")?.trim();
      if (!url || images.some((item) => item.url === url)) continue;
      const width = numberField(image, "width");
      const height = numberField(image, "height");
      images.push({ url, ...(width && width > 0 ? { width } : {}), ...(height && height > 0 ? { height } : {}) });
    }
  }
  // Prefer the largest known image; retain provider order when sizes tie or are unknown.
  const primary = images.reduce<(typeof images)[number] | undefined>((best, image) => !best || (image.width ?? 0) * (image.height ?? 0) > (best.width ?? 0) * (best.height ?? 0) ? image : best, undefined);
  for (const image of images) {
    addMedia(data, TICKETMASTER_PROVIDER, image.url, "image", "image", image === primary);
    Object.assign(data.media[data.media.length - 1], image);
  }
}

function addClassifications(data: ZuuidData, payload: Record<string, unknown>): void {
  for (const classification of arrayField(payload as never, "classifications")) {
    if (!classification || typeof classification !== "object" || Array.isArray(classification)) continue;
    for (const key of ["segment", "genre", "subGenre", "type", "subType"]) {
      const name = nestedString(classification as never, [key, "name"]);
      if (name && !/^(undefined|unknown|n\/a|not applicable)$/i.test(name.trim())) addTag(data, name);
    }
  }
}

function eventTime(value: string | undefined): string | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value?.trim() ?? "");
  return match ? `${match[1]}:${match[2]}` : undefined;
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
