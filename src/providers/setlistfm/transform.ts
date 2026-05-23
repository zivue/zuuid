import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addRelation, addTag, arrayField, baseDataFromSource, datePrefix, finalizeData, formatNumber, nestedString, objectPayload, stringField, valueAsString } from "../common.js";
import { SETLISTFM_ARTIST_CATEGORY, SETLISTFM_PROVIDER, SETLISTFM_SETLIST_CATEGORY, SETLISTFM_VENUE_CATEGORY } from "./constants.js";

export async function transformSetlistFm(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== SETLISTFM_PROVIDER) throw new Error(`unsupported Setlist.fm source: ${source.source.provider}:${source.source.category}`);
  if (source.source.category === SETLISTFM_SETLIST_CATEGORY) return transformSetlistFmSetlist(source);
  if (source.source.category === SETLISTFM_ARTIST_CATEGORY) return transformSetlistFmArtist(source);
  if (source.source.category === SETLISTFM_VENUE_CATEGORY) return transformSetlistFmVenue(source);
  throw new Error(`unsupported Setlist.fm source: ${source.source.provider}:${source.source.category}`);
}

export async function transformSetlistFmSetlist(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || stringField(payload, "id");
  if (!id) throw new Error("missing required Setlist.fm field: id");
  const artist = nestedString(payload, ["artist", "name"]) ?? "Unknown Artist";
  const venue = nestedString(payload, ["venue", "name"]) ?? "Unknown Venue";
  const city = nestedString(payload, ["venue", "city", "name"]) ?? "Unknown City";
  const country = nestedString(payload, ["venue", "city", "country", "code"]) ?? "XX";
  const primaryDate = parseSetlistDate(stringField(payload, "eventDate"));
  const title = `${artist} @ ${venue}, ${city} (${country}) - ${primaryDate ?? stringField(payload, "eventDate") ?? ""}`;
  const data = await baseDataFromSource(source, SETLISTFM_PROVIDER, SETLISTFM_SETLIST_CATEGORY, "event", id, title);
  data.primaryDate = primaryDate;
  addAlias(data, title, "title", true, SETLISTFM_PROVIDER, "en");
  const { lines, songs, songCount, encoreCount } = songsFromPayload(payload);
  addDescription(data, SETLISTFM_PROVIDER, lines.join("\n") || undefined, "en");
  addDetail(data, SETLISTFM_PROVIDER, "tour", nestedString(payload, ["tour", "name"]));
  addDetail(data, SETLISTFM_PROVIDER, "song_count", String(songCount));
  addDetail(data, SETLISTFM_PROVIDER, "encore_count", String(encoreCount));
  addDetail(data, SETLISTFM_PROVIDER, "event_date", primaryDate);
  addDetail(data, SETLISTFM_PROVIDER, "source_url", stringField(payload, "url"));
  addDetail(data, SETLISTFM_PROVIDER, "songs", songs.length ? songs.join(", ") : undefined);
  addDetail(data, SETLISTFM_PROVIDER, "info", stringField(payload, "info"));
  await addRelation(data, SETLISTFM_PROVIDER, SETLISTFM_ARTIST_CATEGORY, nestedString(payload, ["artist", "mbid"]), "artist", artist);
  await addRelation(data, SETLISTFM_PROVIDER, SETLISTFM_VENUE_CATEGORY, nestedString(payload, ["venue", "id"]), "venue", venue);
  addTag(data, "concert"); addTag(data, "live"); addTag(data, "setlist"); addTag(data, nestedString(payload, ["tour", "name"]));
  const mbid = nestedString(payload, ["artist", "mbid"]);
  if (mbid) data.externalIds.push({ source: "musicbrainz", category: "artist", value: mbid });
  return finalizeData(data, source);
}

export async function transformSetlistFmArtist(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || stringField(payload, "mbid") || stringField(payload, "id");
  const name = stringField(payload, "name");
  if (!id) throw new Error("missing required Setlist.fm artist field: mbid");
  if (!name) throw new Error("missing required Setlist.fm artist field: name");
  const title = stringField(payload, "disambiguation") ? `${name} (${stringField(payload, "disambiguation")})` : name;
  const data = await baseDataFromSource(source, SETLISTFM_PROVIDER, SETLISTFM_ARTIST_CATEGORY, "artist", id, title);
  addAlias(data, title, "title", true, SETLISTFM_PROVIDER, "en");
  addAlias(data, stringField(payload, "sortName") === name ? undefined : stringField(payload, "sortName"), "alias", false, SETLISTFM_PROVIDER);
  addDescription(data, SETLISTFM_PROVIDER, stringField(payload, "disambiguation"), "en");
  addDetail(data, SETLISTFM_PROVIDER, "source_url", stringField(payload, "url"));
  addDetail(data, SETLISTFM_PROVIDER, "total_setlists", valueAsString((payload.setlists as Record<string, never> | undefined)?.total));
  addTag(data, "artist"); addTag(data, "musician");
  data.externalIds.push({ source: "musicbrainz", category: "artist", value: id });
  const tmid = stringField(payload, "tmid");
  if (tmid) data.externalIds.push({ source: "ticketmaster", category: "artist", value: tmid });
  return finalizeData(data, source);
}

export async function transformSetlistFmVenue(source: SourceRecord): Promise<ZuuidData> {
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || stringField(payload, "id");
  const name = stringField(payload, "name");
  if (!id) throw new Error("missing required Setlist.fm venue field: id");
  if (!name) throw new Error("missing required Setlist.fm venue field: name");
  const title = `${name}, ${nestedString(payload, ["city", "name"]) ?? "Unknown"}, ${nestedString(payload, ["city", "country", "name"]) ?? "Unknown"}`;
  const data = await baseDataFromSource(source, SETLISTFM_PROVIDER, SETLISTFM_VENUE_CATEGORY, "venue", id, title);
  addAlias(data, title, "title", true, SETLISTFM_PROVIDER, "en");
  for (const [key, value] of [["city", nestedString(payload, ["city", "name"])], ["state", nestedString(payload, ["city", "state"])], ["state_code", nestedString(payload, ["city", "stateCode"])], ["country", nestedString(payload, ["city", "country", "name"])], ["country_code", nestedString(payload, ["city", "country", "code"])], ["latitude", nestedNumber(payload, ["city", "coords", "lat"])], ["longitude", nestedNumber(payload, ["city", "coords", "long"])], ["source_url", stringField(payload, "url")]] as const) addDetail(data, SETLISTFM_PROVIDER, key, value);
  addTag(data, "venue"); addTag(data, "concert hall"); addTag(data, "live music");
  return finalizeData(data, source);
}

function parseSetlistDate(value: string | undefined): string | undefined {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : datePrefix(value);
}

function songsFromPayload(payload: Record<string, unknown>): { lines: string[]; songs: string[]; songCount: number; encoreCount: number } {
  const lines: string[] = []; const songs: string[] = []; let songCount = 0; let encoreCount = 0;
  const sets = payload.sets && typeof payload.sets === "object" && !Array.isArray(payload.sets) ? arrayField(payload.sets as never, "set") : [];
  for (const set of sets) {
    if (set && typeof set === "object" && !Array.isArray(set) && typeof (set as Record<string, never>).encore === "number" && (set as Record<string, number>).encore > 0) encoreCount += 1;
    if (!set || typeof set !== "object" || Array.isArray(set)) continue;
    for (const song of arrayField(set as never, "song")) {
      if (!song || typeof song !== "object" || Array.isArray(song)) continue;
      const name = stringField(song as never, "name"); if (!name) continue;
      songCount += 1; songs.push(name);
      lines.push(`${songCount}. ${name}${(song as Record<string, boolean>).tape ? " [tape]" : ""}${stringField(song as never, "info") ? ` (${stringField(song as never, "info")})` : ""}`);
    }
  }
  return { lines, songs, songCount, encoreCount };
}

function nestedNumber(payload: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = payload;
  for (const key of path) current = current && typeof current === "object" && !Array.isArray(current) ? (current as Record<string, unknown>)[key] : undefined;
  return typeof current === "number" ? formatNumber(current) : undefined;
}
