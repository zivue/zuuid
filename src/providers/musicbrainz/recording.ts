import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, addRelation, arrayField, baseDataFromSource, finalizeData, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_ARTIST_CATEGORY, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RECORDING_CATEGORY } from "./constants.js";
import { addArtistCreditDetail, addMusicBrainzDescription, addMusicBrainzTags, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

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

async function addArtistCreditRelations(data: ZuuidData, payload: Record<string, unknown>): Promise<void> {
  let index = 0;
  for (const credit of arrayField(payload as never, "artist-credit")) {
    if (!credit || typeof credit !== "object" || Array.isArray(credit)) continue;
    const artist = (credit as Record<string, unknown>).artist;
    if (!artist || typeof artist !== "object" || Array.isArray(artist)) continue;
    await addRelation(data, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_ARTIST_CATEGORY, stringField(artist as never, "id"), "performed_by", stringField(artist as never, "name"), { order: index });
    index += 1;
  }
}
