import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, arrayField, baseDataFromSource, finalizeData, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RECORDING_CATEGORY } from "./constants.js";
import { addArtistCreditDetail, addArtistCreditRelations, addMusicBrainzDescription, addMusicBrainzTags, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

export async function transformMusicBrainzRecording(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== MUSICBRAINZ_PROVIDER || source.source.category !== MUSICBRAINZ_RECORDING_CATEGORY) {
    throw new Error(`unsupported MusicBrainz source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = musicBrainzPayload(source.payload);
  const id = musicBrainzId(payload, source.source.externalId);
  const title = requireMusicBrainzTitle(payload);
  if (!id) throw new Error("missing required MusicBrainz recording field: id");
  if (!title) throw new Error("missing required MusicBrainz recording field: title");

  const data = await baseDataFromSource(source, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RECORDING_CATEGORY, MUSICBRAINZ_RECORDING_CATEGORY, id, title);
  data.primaryDate = stringField(payload, "first-release-date");
  addDetail(data, MUSICBRAINZ_PROVIDER, "first_release_date", stringField(payload, "first-release-date"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "length_ms", valueAsString(payload.length));
  addDetail(data, MUSICBRAINZ_PROVIDER, "video", valueAsString(payload.video));
  addDetail(data, MUSICBRAINZ_PROVIDER, "isrcs", arrayField(payload, "isrcs").filter((value): value is string => typeof value === "string"));
  for (const isrc of arrayField(payload, "isrcs")) if (typeof isrc === "string") data.externalIds.push({ source: "isrc", category: MUSICBRAINZ_RECORDING_CATEGORY, value: isrc });
  addArtistCreditDetail(data, payload);
  await addArtistCreditRelations(data, payload);
  addMusicBrainzDescription(data, payload);
  addMusicBrainzTags(data, payload);
  return finalizeData(data, source);
}
