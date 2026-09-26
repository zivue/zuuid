import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { arrayField, nestedString, objectPayload, stringField } from "../common.js";
import { TICKETMASTER_API_BASE, TICKETMASTER_EVENT_CATEGORY, TICKETMASTER_PROVIDER } from "./constants.js";
import { transformTicketmasterEvent } from "./transform.js";
import type { FetchTicketmasterEventInput, TicketmasterFetchLike, TicketmasterProviderOptions, TicketmasterSearchInput } from "./types.js";

export class TicketmasterProvider {
  readonly apiBase: string;
  private readonly apiKey: string;
  private readonly fetchImpl: TicketmasterFetchLike;

  constructor(options: TicketmasterProviderOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) throw new Error("Ticketmaster API key must not be empty");
    this.apiBase = options.apiBase ?? TICKETMASTER_API_BASE;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async getJson<T>(path: string, params: Record<string, string> = {}): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    url.searchParams.set("apikey", this.apiKey);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    if (response.status === 404) return undefined;
    const body = await response.text().catch(() => "");
    if (!response.ok) throw new Error(`Ticketmaster API returned ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`);
    return body ? JSON.parse(body) as T : undefined;
  }

  async fetchEventSourceRecord(input: FetchTicketmasterEventInput): Promise<SourceRecord | undefined> {
    const id = eventId(input.id);
    const payload = await this.getJson<JsonValue>(`events/${encodeURIComponent(id)}.json`);
    return payload ? createSourceRecord({ source: { provider: TICKETMASTER_PROVIDER, category: TICKETMASTER_EVENT_CATEGORY, externalId: id }, payload }) : undefined;
  }

  async fetchEvent(input: FetchTicketmasterEventInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchEventSourceRecord(input);
    return source ? transformTicketmasterEvent(source) : undefined;
  }

  async searchEventSourceRecords(input: TicketmasterSearchInput): Promise<SearchResponse<SourceRecord>> {
    const payload = await searchPayload(this, input);
    const events = eventItems(payload);
    return {
      results: await Promise.all(events.map((event) => createSourceRecord({
        source: { provider: TICKETMASTER_PROVIDER, category: TICKETMASTER_EVENT_CATEGORY, externalId: stringField(event, "id") ?? "" },
        payload: event as JsonValue,
      }))),
      pagination: pagination(payload, events.length),
    };
  }

  async searchEvents(input: TicketmasterSearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
    const payload = await searchPayload(this, input);
    const results: ZuuidSearchResult[] = [];
    for (const event of eventItems(payload)) {
      const externalId = stringField(event, "id");
      const title = stringField(event, "name");
      if (!externalId || !title) continue;
      const zuuid = await providerZuuid({ provider: TICKETMASTER_PROVIDER, category: TICKETMASTER_EVENT_CATEGORY, externalId });
      results.push({
        id: zuuid,
        zuuid,
        category: TICKETMASTER_EVENT_CATEGORY,
        kind: "event",
        title,
        date: nestedString(event, ["dates", "start", "localDate"]) ?? null,
        cover: eventCover(event) ?? null,
        rating: null,
        weight: null,
        relationType: null,
        attribute: eventLocation(event) ?? null,
        order: null,
        source: { source: TICKETMASTER_PROVIDER, category: TICKETMASTER_EVENT_CATEGORY, value: externalId },
      });
    }
    return { results, pagination: pagination(payload, results.length) };
  }
}

async function searchPayload(provider: TicketmasterProvider, input: TicketmasterSearchInput): Promise<Record<string, JsonValue>> {
  const query = input.query.trim();
  if (!query) throw new Error("Ticketmaster event search query must not be empty");
  const page = Math.max(1, input.page ?? 1);
  return objectPayload((await provider.getJson<JsonValue>("events.json", {
    keyword: query,
    page: String(page - 1),
    size: String(input.pageSize ?? 20),
    sort: "date,asc",
    ...(input.countryCode ? { countryCode: input.countryCode.toUpperCase() } : {}),
  })) ?? {});
}

function eventItems(payload: Record<string, JsonValue>): Record<string, JsonValue>[] {
  const embedded = objectPayload(payload._embedded ?? {});
  return arrayField(embedded, "events").filter(isObject);
}

function eventCover(event: Record<string, JsonValue>): string | undefined {
  const images = arrayField(event, "images").filter(isObject);
  const preferred = [...images].sort((left, right) => numberField(right, "width") - numberField(left, "width"))[0];
  return preferred ? stringField(preferred, "url") : undefined;
}

function eventLocation(event: Record<string, JsonValue>): string | undefined {
  const venues = arrayField(objectPayload(event._embedded ?? {}), "venues").filter(isObject);
  const venue = venues[0];
  if (!venue) return undefined;
  return [stringField(venue, "name"), nestedString(venue, ["city", "name"])].filter(Boolean).join(" · ") || undefined;
}

function pagination(payload: Record<string, JsonValue>, fallbackCount: number) {
  const page = objectPayload(payload.page ?? {});
  const current = numberField(page, "number");
  return {
    page: current + 1,
    totalPages: numberField(page, "totalPages"),
    totalResults: numberField(page, "totalElements") || fallbackCount,
  };
}

function eventId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("Ticketmaster event id must not be empty");
  return id;
}

function numberField(value: Record<string, JsonValue>, key: string): number {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0;
}

function isObject(value: JsonValue): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
