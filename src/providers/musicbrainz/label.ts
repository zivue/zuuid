import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, addTag, baseDataFromSource, finalizeData, nestedString, stringField, valueAsString } from "../common.js";
import { MUSICBRAINZ_LABEL_CATEGORY, MUSICBRAINZ_PROVIDER } from "./constants.js";
import { addAreaDetails, addLifeSpanDetails, addMusicBrainzAliases, addMusicBrainzDescription, addMusicBrainzTags, musicBrainzId, musicBrainzPayload, requireMusicBrainzTitle } from "./helpers.js";

export async function transformMusicBrainzLabel(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== MUSICBRAINZ_PROVIDER || source.source.category !== MUSICBRAINZ_LABEL_CATEGORY) {
    throw new Error(`unsupported MusicBrainz source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = musicBrainzPayload(source.payload);
  const id = musicBrainzId(payload, source.source.externalId);
  const title = requireMusicBrainzTitle(payload, "name");
  if (!id) throw new Error("missing required MusicBrainz label field: id");
  if (!title) throw new Error("missing required MusicBrainz label field: name");

  const data = await baseDataFromSource(source, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_LABEL_CATEGORY, MUSICBRAINZ_LABEL_CATEGORY, id, title);
  data.primaryDate = nestedString(payload, ["life-span", "begin"]);
  addMusicBrainzAliases(data, payload, title);
  addMusicBrainzDescription(data, payload);
  addDetail(data, MUSICBRAINZ_PROVIDER, "sort_name", stringField(payload, "sort-name"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "type", stringField(payload, "type"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "country", stringField(payload, "country"));
  addDetail(data, MUSICBRAINZ_PROVIDER, "label_code", valueAsString(payload["label-code"]));
  addLifeSpanDetails(data, payload);
  addAreaDetails(data, payload);
  addMusicBrainzTags(data, payload);
  addTag(data, "label");
  return finalizeData(data, source);
}
