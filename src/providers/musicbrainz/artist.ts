import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { addDetail, addRelation, addTag, arrayField, baseDataFromSource, finalizeData, nestedString, objectPayload, stringField } from "../common.js";
import { MUSICBRAINZ_ARTIST_CATEGORY, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL } from "./constants.js";
import { addAreaDetails, addLifeSpanDetails, addMusicBrainzAliases, addMusicBrainzDescription, addMusicBrainzTags, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

export async function transformMusicBrainzArtist(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== MUSICBRAINZ_PROVIDER || source.source.category !== MUSICBRAINZ_ARTIST_CATEGORY) {
    throw new Error(`unsupported MusicBrainz source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = musicBrainzPayload(source.payload);
  const id = musicBrainzId(payload, source.source.externalId);
  const title = requireMusicBrainzTitle(payload, "name");
  if (!id) throw new Error("missing required MusicBrainz artist field: id");
  if (!title) throw new Error("missing required MusicBrainz artist field: name");

  const data = await baseDataFromSource(source, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_ARTIST_CATEGORY, MUSICBRAINZ_ARTIST_CATEGORY, id, title);
  data.primaryDate = nestedString(payload, ["life-span", "begin"]);
  addMusicBrainzAliases(data, payload, title);
  addMusicBrainzDescription(data, payload);
  addDetail(data, MUSICBRAINZ_PROVIDER, "sort_name", stringField(payload, "sort-name"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "type", stringField(payload, "type"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "country", stringField(payload, "country"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "gender", stringField(payload, "gender"));
  addLifeSpanDetails(data, payload);
  addAreaDetails(data, payload);
  addMusicBrainzTags(data, payload);
  addArtistIdentifiers(data, payload);
  addArtistLinks(data, payload);
  await addArtistRelations(data, payload);
  await addReleaseGroupRelations(data, payload);
  addTag(data, "artist");
  return finalizeData(data, source);
}

function addArtistIdentifiers(data: ZuuidData, payload: Record<string, JsonValue>): void {
  for (const [key, source] of [["isnis", "isni"], ["ipis", "ipi"]] as const) {
    for (const value of arrayField(payload, key)) {
      if (typeof value === "string" && value.trim()) {
        data.externalIds.push({ source, category: MUSICBRAINZ_ARTIST_CATEGORY, value: value.trim() });
      }
    }
  }
}

const artistLinkKeys = new Set([
  "allmusic",
  "amazon_music",
  "apple_music",
  "bandsintown",
  "bluesky",
  "deezer",
  "discogs",
  "facebook",
  "homepage",
  "imdb",
  "instagram",
  "setlistfm",
  "songkick",
  "soundcloud",
  "spotify",
  "threads",
  "tidal",
  "twitter",
  "wikidata",
  "youtube_music",
]);

function artistLinkKey(type: string, url: URL): string | null {
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
  if (host === "open.spotify.com") return "spotify";
  if (host === "deezer.com") return "deezer";
  if (host === "music.apple.com" || host === "itunes.apple.com") return "apple_music";
  if (host === "music.amazon.com") return "amazon_music";
  if (host === "tidal.com") return "tidal";
  if (host === "instagram.com") return "instagram";
  if (host === "twitter.com" || host === "x.com") return "twitter";
  if (host === "facebook.com") return "facebook";
  if (host === "bsky.app") return "bluesky";
  if (host === "threads.net" || host === "threads.com") return "threads";
  return null;
}

function externalIdFromArtistLink(key: string, url: URL): string | null {
  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  const patterns: Partial<Record<string, RegExp>> = {
    allmusic: /(?:^|\/)artist\/([^/]+)$/i,
    apple_music: /(?:^|\/)artist\/(?:[^/]+\/)?(?:id)?(\d+)$/i,
    bandsintown: /(?:^|\/)a\/(\d+)$/i,
    deezer: /(?:^|\/)artist\/(\d+)$/i,
    discogs: /(?:^|\/)artist\/(\d+)$/i,
    imdb: /(?:^|\/)name\/(nm\d+)$/i,
    songkick: /(?:^|\/)artists\/(\d+)$/i,
    spotify: /(?:^|\/)artist\/([^/]+)$/i,
    tidal: /(?:^|\/)artist\/(\d+)$/i,
    wikidata: /(?:^|\/)wiki\/(Q\d+)$/i,
    youtube_music: /(?:^|\/)channel\/([^/]+)$/i,
  };
  if (key === "setlistfm") return path.match(/-([0-9a-f]+)\.html$/i)?.[1] ?? null;
  return patterns[key]?.exec(path)?.[1] ?? null;
}

function addArtistLinks(data: ZuuidData, payload: Record<string, JsonValue>): void {
  const links = new Map<string, URL>();
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
    const key = artistLinkKey(stringField(relation, "type") ?? "", url);
    if (key && artistLinkKeys.has(key) && !links.has(key)) links.set(key, url);
  }

  for (const [key, url] of links) {
    addDetail(data, MUSICBRAINZ_PROVIDER, key, url.toString());
    const externalId = externalIdFromArtistLink(key, url);
    if (externalId) data.externalIds.push({ source: key, category: MUSICBRAINZ_ARTIST_CATEGORY, value: externalId });
  }
}

function relationPeriod(relation: Record<string, JsonValue>): string | null {
  const begin = stringField(relation, "begin");
  const end = stringField(relation, "end");
  if (begin && end) return `${begin}–${end}`;
  if (begin) return `Since ${begin}`;
  if (end) return `Until ${end}`;
  return null;
}

function normalizedArtistRelationType(relation: Record<string, JsonValue>): string | null {
  const type = stringField(relation, "type");
  if (!type || type === "tribute") return null;
  if (type === "member of band") return stringField(relation, "direction") === "backward" ? "member" : "member_of";
  if (type === "collaboration") return "collaborated_with";
  return type.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}

async function addArtistRelations(data: ZuuidData, payload: Record<string, JsonValue>): Promise<void> {
  let index = 0;
  for (const value of arrayField(payload, "relations")) {
    const relation = objectPayload(value);
    if (stringField(relation, "target-type") !== "artist") continue;
    const relationType = normalizedArtistRelationType(relation);
    const artist = objectPayload(relation.artist ?? {});
    if (!relationType) continue;
    const attributes = arrayField(relation, "attributes").filter((attribute): attribute is string => typeof attribute === "string");
    const period = relationPeriod(relation);
    await addRelation(
      data,
      MUSICBRAINZ_PROVIDER,
      MUSICBRAINZ_ARTIST_CATEGORY,
      stringField(artist, "id"),
      relationType,
      stringField(artist, "name"),
      {
        date: stringField(relation, "begin") ?? null,
        attribute: [...attributes, period].filter(Boolean).join(" · ") || (stringField(artist, "disambiguation") ?? null),
        order: index,
        data: { originalRelationType: stringField(relation, "type") ?? relationType },
      },
    );
    index += 1;
  }
}

async function addReleaseGroupRelations(data: ZuuidData, payload: Record<string, JsonValue>): Promise<void> {
  let index = 0;
  for (const value of arrayField(payload, "release-groups")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const releaseGroup = objectPayload(value);
    const externalId = stringField(releaseGroup, "id");
    const primaryType = stringField(releaseGroup, "primary-type");
    const secondaryTypes = arrayField(releaseGroup, "secondary-types")
      .filter((type): type is string => typeof type === "string");
    await addRelation(
      data,
      MUSICBRAINZ_PROVIDER,
      MUSICBRAINZ_RELEASE_GROUP_CATEGORY,
      externalId,
      "released",
      stringField(releaseGroup, "title"),
      {
        date: stringField(releaseGroup, "first-release-date") ?? null,
        cover: externalId ? `${MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL}/${externalId}/front` : null,
        attribute: [primaryType, ...secondaryTypes].filter(Boolean).join(" · ") || null,
        order: index,
      },
    );
    index += 1;
  }
}
