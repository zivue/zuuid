import type { ZuuidData } from "../../entity.js";
import type { JsonValue } from "../../types.js";
import { addAlias, addDescription, addDetail, addLink, addRelation, addTag, arrayField, nestedString, objectPayload, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_ARTIST_CATEGORY, MUSICBRAINZ_PROVIDER } from "./constants.js";

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

export function addMusicBrainzUrlRelations(data: ZuuidData, payload: Record<string, JsonValue>, category: string): void {
  for (const value of arrayField(payload, "relations")) {
    const relation = objectPayload(value);
    if (relation.ended === true || stringField(relation, "target-type") !== "url") continue;
    const resource = nestedString(relation, ["url", "resource"]);
    if (!resource) continue;
    let url: URL;
    try {
      url = new URL(resource);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const type = stringField(relation, "type") ?? "external link";
    const service = musicBrainzLinkService(type, url);
    const linkRelation = musicBrainzLinkRelation(type, service);
    addLink(data, MUSICBRAINZ_PROVIDER, url.toString(), linkRelation, {
      ...(service ? { service } : {}),
      label: type,
    });
    const detailKey = service ?? normalizeRelationType(type);
    addDetail(data, MUSICBRAINZ_PROVIDER, detailKey, url.toString());
    const externalId = service ? externalIdFromMusicBrainzLink(service, url) : undefined;
    if (service && externalId && !data.externalIds.some((item) => item.source === service && item.value === externalId)) {
      data.externalIds.push({ source: service, category, value: externalId });
    }
  }
}

function musicBrainzLinkService(type: string, url: URL): string | undefined {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (type === "official homepage") return "homepage";
  if (type === "wikidata" || host === "wikidata.org") return "wikidata";
  if (type === "discogs" || host === "discogs.com") return "discogs";
  if (type === "IMDb" || host === "imdb.com") return "imdb";
  if (type === "allmusic" || host === "allmusic.com") return "allmusic";
  if (type === "bandsintown" || host === "bandsintown.com") return "bandsintown";
  if (type === "songkick" || host === "songkick.com") return "songkick";
  if (type === "setlistfm" || host === "setlist.fm") return "setlistfm";
  if (type === "soundcloud" || host === "soundcloud.com") return "soundcloud";
  if (type === "youtube music" || host === "music.youtube.com") return "youtube_music";
  if (type === "youtube" || host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "open.spotify.com") return "spotify";
  if (host === "deezer.com") return "deezer";
  if (host === "music.apple.com" || host === "itunes.apple.com") return "apple_music";
  if (host === "music.amazon.com") return "amazon_music";
  if (host === "tidal.com") return "tidal";
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) return "bandcamp";
  if (host === "instagram.com") return "instagram";
  if (host === "twitter.com" || host === "x.com") return "twitter";
  if (host === "facebook.com") return "facebook";
  if (host === "bsky.app") return "bluesky";
  if (host === "threads.net" || host === "threads.com") return "threads";
  return undefined;
}

function musicBrainzLinkRelation(type: string, service: string | undefined): string {
  const normalizedType = type.toLowerCase();
  if (/purchase|download|mail order/.test(normalizedType)) return "purchase";
  if (/streaming/.test(normalizedType)) return "streaming";
  if (["spotify", "apple_music", "amazon_music", "deezer", "soundcloud", "tidal", "youtube_music", "bandcamp"].includes(service ?? "")) return "streaming";
  if (["bluesky", "facebook", "instagram", "threads", "twitter", "youtube"].includes(service ?? "")) return "social";
  if (["bandsintown", "setlistfm", "songkick"].includes(service ?? "")) return "events";
  if (service === "homepage") return "official";
  return "reference";
}

function externalIdFromMusicBrainzLink(service: string, url: URL): string | undefined {
  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  const patterns: Partial<Record<string, RegExp>> = {
    allmusic: /(?:^|\/)artist\/([^/]+)$/i,
    apple_music: /(?:^|\/)artist\/(?:[^/]+\/)?(?:id)?(\d+)$/i,
    bandsintown: /(?:^|\/)a\/(\d+)$/i,
    deezer: /(?:^|\/)artist\/(\d+)$/i,
    discogs: /(?:^|\/)(?:artist|release|master|label)\/(\d+)$/i,
    imdb: /(?:^|\/)(?:name|title)\/((?:nm|tt)\d+)$/i,
    songkick: /(?:^|\/)artists\/(\d+)$/i,
    spotify: /(?:^|\/)(?:artist|album|track)\/([^/]+)$/i,
    tidal: /(?:^|\/)(?:artist|album|track)\/(\d+)$/i,
    wikidata: /(?:^|\/)wiki\/(Q\d+)$/i,
    youtube_music: /(?:^|\/)(?:channel|browse)\/([^/]+)$/i,
    youtube: /(?:^|\/)(?:channel\/|@)([^/]+)$/i,
  };
  if (service === "setlistfm") return path.match(/-([0-9a-f]+)\.html$/i)?.[1];
  return patterns[service]?.exec(path)?.[1];
}

function normalizeRelationType(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "external_link";
}

export function artistCredit(payload: Record<string, JsonValue>): string | undefined {
  const credits = arrayField(payload, "artist-credit").map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const object = item as Record<string, JsonValue>;
    const name = stringField(object, "name") ?? nestedString(object, ["artist", "name"]);
    return name ? { name, joinphrase: typeof object.joinphrase === "string" ? object.joinphrase : undefined } : undefined;
  }).filter((value): value is { name: string; joinphrase: string | undefined } => !!value);
  if (!credits.length) return undefined;
  return credits.map((credit, index) => credit.name + (credit.joinphrase ?? (index < credits.length - 1 ? ", " : ""))).join("");
}

export function addArtistCreditDetail(data: ZuuidData, payload: Record<string, JsonValue>): void {
  addDetail(data, MUSICBRAINZ_PROVIDER, "artist_credit", artistCredit(payload));
}

export async function addArtistCreditRelations(data: ZuuidData, payload: Record<string, JsonValue>): Promise<void> {
  let index = 0;
  for (const credit of arrayField(payload, "artist-credit")) {
    if (!credit || typeof credit !== "object" || Array.isArray(credit)) continue;
    const creditObject = credit as Record<string, JsonValue>;
    const artist = objectPayload(creditObject.artist ?? {});
    const artistName = stringField(artist, "name");
    const creditedName = stringField(creditObject, "name");
    await addRelation(
      data,
      MUSICBRAINZ_PROVIDER,
      MUSICBRAINZ_ARTIST_CATEGORY,
      stringField(artist, "id"),
      "performed_by",
      artistName ?? creditedName,
      {
        order: index,
        attribute: creditedName && creditedName !== artistName ? creditedName : null,
      },
    );
    index += 1;
  }
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
