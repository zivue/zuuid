import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, addMedia, addRelation, arrayField, baseDataFromSource, finalizeData, objectPayload, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_CATEGORY, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL } from "./constants.js";
import { addArtistCreditDetail, addArtistCreditRelations, addMusicBrainzDescription, addMusicBrainzTags, addMusicBrainzUrlRelations, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

export type MusicBrainzReleaseGroupTransformOptions = {
  coverArtBaseUrl?: string | null;
};

export async function transformMusicBrainzReleaseGroup(
  source: SourceRecord,
  options: MusicBrainzReleaseGroupTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== MUSICBRAINZ_PROVIDER || source.source.category !== MUSICBRAINZ_RELEASE_GROUP_CATEGORY) {
    throw new Error(`unsupported MusicBrainz source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = musicBrainzPayload(source.payload);
  const id = musicBrainzId(payload, source.source.externalId);
  const title = requireMusicBrainzTitle(payload);
  if (!id) throw new Error("missing required MusicBrainz release-group field: id");
  if (!title) throw new Error("missing required MusicBrainz release-group field: title");

  const data = await baseDataFromSource(source, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_GROUP_CATEGORY, "release_group", id, title);
  data.primaryDate = stringField(payload, "first-release-date");
  addDetail(data, MUSICBRAINZ_PROVIDER, "first_release_date", stringField(payload, "first-release-date"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "primary_type", stringField(payload, "primary-type"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "secondary_types", arrayField(payload, "secondary-types").filter((value): value is string => typeof value === "string"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "release_count", valueAsString(payload["release-count"]));
  addArtistCreditDetail(data, payload);
  await addArtistCreditRelations(data, payload);
  addMusicBrainzDescription(data, payload);
  addMusicBrainzTags(data, payload);
  addMusicBrainzUrlRelations(data, payload, MUSICBRAINZ_RELEASE_GROUP_CATEGORY);
  await addReleaseRelations(data, payload);
  const baseUrl = options.coverArtBaseUrl === undefined ? MUSICBRAINZ_RELEASE_GROUP_COVER_ART_BASE_URL : options.coverArtBaseUrl;
  if (baseUrl) addMedia(data, MUSICBRAINZ_PROVIDER, `${baseUrl.replace(/\/$/, "")}/${id}/front`, "cover");
  return finalizeData(data, source);
}

async function addReleaseRelations(data: ZuuidData, payload: Record<string, unknown>): Promise<void> {
  let order = 0;
  for (const value of arrayField(payload as never, "releases")) {
    const release = objectPayload(value);
    await addRelation(data, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_CATEGORY, stringField(release, "id"), "edition", stringField(release, "title"), {
      date: stringField(release, "date") ?? null,
      attribute: [stringField(release, "status"), stringField(release, "country")].filter(Boolean).join(" · ") || null,
      order,
    });
    order += 1;
  }
}
