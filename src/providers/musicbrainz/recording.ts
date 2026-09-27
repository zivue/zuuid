import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, addRelation, arrayField, baseDataFromSource, finalizeData, objectPayload, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RECORDING_CATEGORY, MUSICBRAINZ_RELEASE_CATEGORY, MUSICBRAINZ_WORK_CATEGORY } from "./constants.js";
import { addArtistCreditDetail, addArtistCreditRelations, addMusicBrainzDescription, addMusicBrainzTags, addMusicBrainzUrlRelations, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

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
  addMusicBrainzUrlRelations(data, payload, MUSICBRAINZ_RECORDING_CATEGORY);
  await addRecordingRelations(data, payload);
  return finalizeData(data, source);
}

async function addRecordingRelations(data: ZuuidData, payload: Record<string, unknown>): Promise<void> {
  let order = 0;
  for (const value of arrayField(payload as never, "releases")) {
    const release = objectPayload(value);
    await addRelation(data, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_RELEASE_CATEGORY, stringField(release, "id"), "appears_in", stringField(release, "title"), {
      date: stringField(release, "date") ?? null,
      order,
    });
    order += 1;
  }
  for (const value of arrayField(payload as never, "relations")) {
    const relation = objectPayload(value);
    if (stringField(relation, "target-type") !== "work") continue;
    const work = objectPayload(relation.work ?? {});
    await addRelation(data, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_WORK_CATEGORY, stringField(work, "id"), "performance_of", stringField(work, "title"), {
      order,
      data: { originalRelationType: stringField(relation, "type") ?? "performance" },
    });
    order += 1;
  }
}
