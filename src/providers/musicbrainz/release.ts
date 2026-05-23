import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { MUSICBRAINZ_COVER_ART_BASE_URL, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_CATEGORY } from "./constants.js";
import {
  addDescription,
  addDetail,
  addMedia,
  addTag,
  arrayField,
  baseDataFromSource,
  finalizeData,
  nestedString,
  stringField,
  valueAsString
} from "../common.js";
import { addArtistCreditDetail, addMusicBrainzDescription, addMusicBrainzTags, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

export type MusicBrainzTransformOptions = {
  coverArtBaseUrl?: string | null;
};

export async function transformMusicBrainzRelease(
  source: SourceRecord,
  options: MusicBrainzTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== MUSICBRAINZ_PROVIDER || source.source.category !== MUSICBRAINZ_RELEASE_CATEGORY) {
    throw new Error(`unsupported MusicBrainz source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = musicBrainzPayload(source.payload);
  const id = musicBrainzId(payload, source.source.externalId);
  const title = requireMusicBrainzTitle(payload);
  if (!id) throw new Error("missing required MusicBrainz release field: id");
  if (!title) throw new Error("missing required MusicBrainz release field: title");

  const data = await baseDataFromSource(source, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_CATEGORY, MUSICBRAINZ_RELEASE_CATEGORY, id, title);
  const releaseDate = stringField(payload, "date");
  if (releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) data.primaryDate = releaseDate;
  addDetail(data, MUSICBRAINZ_PROVIDER, "release_date", releaseDate);
  addArtistCreditDetail(data, payload);
  addDetail(data, MUSICBRAINZ_PROVIDER, "labels", joinedLabels(payload));
  for (const key of ["status", "country", "barcode"]) addDetail(data, MUSICBRAINZ_PROVIDER, key, stringField(payload, key));
  addDetail(data, MUSICBRAINZ_PROVIDER, "track_count", valueAsString(payload["track-count"]));
  addDetail(data, MUSICBRAINZ_PROVIDER, "media_count", valueAsString(payload["media-count"]));
  addMusicBrainzDescription(data, payload);
  addMusicBrainzTags(data, payload);
  const barcode = stringField(payload, "barcode");
  if (barcode) data.externalIds.push({ source: "barcode", category: MUSICBRAINZ_RELEASE_CATEGORY, value: barcode });
  const releaseGroupId = nestedString(payload, ["release-group", "id"]);
  if (releaseGroupId) {
    data.externalIds.push({ source: MUSICBRAINZ_PROVIDER, category: "release_group", value: releaseGroupId });
    addDetail(data, MUSICBRAINZ_PROVIDER, "release_group_id", releaseGroupId);
  }
  const archive = payload["cover-art-archive"];
  const hasFront = !!(archive && typeof archive === "object" && !Array.isArray(archive) && (archive as Record<string, unknown>).front === true);
  const baseUrl = options.coverArtBaseUrl === undefined ? MUSICBRAINZ_COVER_ART_BASE_URL : options.coverArtBaseUrl;
  if (hasFront && baseUrl) addMedia(data, MUSICBRAINZ_PROVIDER, `${baseUrl.replace(/\/$/, "")}/${id}/front`, "cover");
  return finalizeData(data, source);
}

function joinedLabels(payload: Record<string, unknown>): string | undefined {
  const names = arrayField(payload as never, "label-info").map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    return nestedString(item as Record<string, never>, ["label", "name"]);
  }).filter((value): value is string => !!value);
  return names.length ? names.join(", ") : undefined;
}
