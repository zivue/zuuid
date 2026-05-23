import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, addRelation, addTag, arrayField, baseDataFromSource, finalizeData, stringField } from "../common.js";
import { MUSICBRAINZ_ARTIST_CATEGORY, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_WORK_CATEGORY } from "./constants.js";
import { addMusicBrainzAliases, addMusicBrainzDescription, addMusicBrainzTags, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

export async function transformMusicBrainzWork(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== MUSICBRAINZ_PROVIDER || source.source.category !== MUSICBRAINZ_WORK_CATEGORY) {
    throw new Error(`unsupported MusicBrainz source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = musicBrainzPayload(source.payload);
  const id = musicBrainzId(payload, source.source.externalId);
  const title = requireMusicBrainzTitle(payload);
  if (!id) throw new Error("missing required MusicBrainz work field: id");
  if (!title) throw new Error("missing required MusicBrainz work field: title");

  const data = await baseDataFromSource(source, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_WORK_CATEGORY, "musical_work", id, title);
  addMusicBrainzAliases(data, payload, title);
  addMusicBrainzDescription(data, payload);
  addDetail(data, MUSICBRAINZ_PROVIDER, "type", stringField(payload, "type"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "iswcs", arrayField(payload, "iswcs").filter((value): value is string => typeof value === "string"));
  for (const iswc of arrayField(payload, "iswcs")) if (typeof iswc === "string") data.externalIds.push({ source: "iswc", category: MUSICBRAINZ_WORK_CATEGORY, value: iswc });
  await addArtistRelations(data, payload);
  addMusicBrainzTags(data, payload);
  addTag(data, "composition");
  return finalizeData(data, source);
}

async function addArtistRelations(data: ZuuidData, payload: Record<string, unknown>): Promise<void> {
  let index = 0;
  for (const relation of arrayField(payload as never, "relations")) {
    if (!relation || typeof relation !== "object" || Array.isArray(relation)) continue;
    const targetType = stringField(relation as never, "target-type");
    const artist = (relation as Record<string, unknown>).artist;
    if (targetType !== "artist" || !artist || typeof artist !== "object" || Array.isArray(artist)) continue;
    await addRelation(data, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_ARTIST_CATEGORY, stringField(artist as never, "id"), stringField(relation as never, "type") ?? "artist", stringField(artist as never, "name"), { order: index });
    index += 1;
  }
}
