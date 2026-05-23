import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDescription, addDetail, addMedia, addTag, arrayField, baseDataFromSource, datePrefix, finalizeData, formatNumber, objectPayload, stringField, stripHtml, valueAsString } from "../common.js";
import { PODCAST_CATEGORY, PODCAST_PROVIDER } from "./constants.js";

export async function transformPodcast(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== PODCAST_PROVIDER || source.source.category !== PODCAST_CATEGORY) {
    throw new Error(`unsupported podcast source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || valueAsString(payload.collectionId) || valueAsString(payload.trackId);
  const title = stringField(payload, "collectionName") ?? stringField(payload, "trackName") ?? stringField(payload, "title") ?? stringField(payload, "name");
  if (!id) throw new Error("missing required podcast field: collectionId");
  if (!title) throw new Error("missing required podcast field: collectionName");
  const data = await baseDataFromSource(source, PODCAST_PROVIDER, PODCAST_CATEGORY, PODCAST_CATEGORY, id, title);
  data.primaryDate = datePrefix(stringField(payload, "releaseDate"));
  addAlias(data, title, "title", true, PODCAST_PROVIDER, "en");
  const description = stringField(payload, "longDescription") ?? stringField(payload, "description") ?? stringField(payload, "shortDescription");
  addDescription(data, "itunes", description ? stripHtml(description) : undefined, "en");
  addMedia(data, "itunes", stringField(payload, "artworkUrl600") ?? stringField(payload, "artworkUrl100") ?? stringField(payload, "artworkUrl60") ?? stringField(payload, "artworkUrl30"), "cover");
  for (const [key, field] of [["artist", "artistName"], ["country", "country"], ["release_date", "releaseDate"], ["content_rating", "contentAdvisoryRating"], ["feed_url", "feedUrl"], ["explicit", "collectionExplicitness"], ["source_url", "collectionViewUrl"]] as const) addDetail(data, PODCAST_PROVIDER, key, stringField(payload, field));
  addDetail(data, PODCAST_PROVIDER, "episode_count", valueAsString(payload.trackCount));
  const price = typeof payload.collectionPrice === "number" && payload.collectionPrice > 0 ? formatNumber(payload.collectionPrice) : undefined;
  addDetail(data, PODCAST_PROVIDER, "price", price);
  addTag(data, stringField(payload, "primaryGenreName"));
  for (const genre of arrayField(payload, "genres")) if (typeof genre === "string") addTag(data, genre);
  return finalizeData(data, source);
}
