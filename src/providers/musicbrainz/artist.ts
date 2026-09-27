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
  await addReleaseGroupRelations(data, payload);
  addTag(data, "artist");
  return finalizeData(data, source);
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
