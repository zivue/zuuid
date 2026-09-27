import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { addDetail, addRelation, addTag, arrayField, baseDataFromSource, finalizeData, nestedString, objectPayload, stringField } from "../common.js";
import { MUSICBRAINZ_ARTIST_CATEGORY, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL } from "./constants.js";
import { addAreaDetails, addLifeSpanDetails, addMusicBrainzAliases, addMusicBrainzDescription, addMusicBrainzTags, addMusicBrainzUrlRelations, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

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
  addMusicBrainzUrlRelations(data, payload, MUSICBRAINZ_ARTIST_CATEGORY);
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
