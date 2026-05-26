import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addDetail, addRelation, addTag, arrayField, baseDataFromSource, finalizeData, stringField } from "../common.js";
import type { JsonValue } from "../../types.js";
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
  const workType = stringField(payload, "type");
  addDetail(data, MUSICBRAINZ_PROVIDER, "type", workType);
  addTag(data, workType);
  addDetail(data, MUSICBRAINZ_PROVIDER, "iswcs", arrayField(payload, "iswcs").filter((value): value is string => typeof value === "string"));
  for (const iswc of arrayField(payload, "iswcs")) if (typeof iswc === "string") data.externalIds.push({ source: "iswc", category: MUSICBRAINZ_WORK_CATEGORY, value: iswc });
  await addArtistRelations(data, payload);
  addMusicBrainzTags(data, payload);
  addTag(data, "composition");
  return finalizeData(data, source);
}

async function addArtistRelations(data: ZuuidData, payload: Record<string, JsonValue>): Promise<void> {
  let index = 0;
  for (const relationValue of arrayField(payload, "relations")) {
    if (!relationValue || typeof relationValue !== "object" || Array.isArray(relationValue)) continue;
    const relation = relationValue as Record<string, JsonValue>;
    const targetType = stringField(relation, "target-type");
    const artistValue = relation.artist;
    if (targetType !== "artist" || !artistValue || typeof artistValue !== "object" || Array.isArray(artistValue)) continue;
    const artist = artistValue as Record<string, JsonValue>;
    const displayTitle = preferredArtistTitle(relation, artist);
    const originalTitle = stringField(artist, "name");
    await addRelation(data, MUSICBRAINZ_PROVIDER, MUSICBRAINZ_ARTIST_CATEGORY, stringField(artist, "id"), stringField(relation, "type") ?? "artist", displayTitle, {
      order: index,
      attribute: originalTitle && originalTitle !== displayTitle ? originalTitle : null
    });
    index += 1;
  }
}

function preferredArtistTitle(relation: Record<string, JsonValue>, artist: Record<string, JsonValue>): string | undefined {
  const targetCredit = stringField(relation, "target-credit");
  if (targetCredit && hasLatinLetter(targetCredit)) return targetCredit;
  const name = stringField(artist, "name");
  if (name && hasLatinLetter(name)) return name;
  const sortName = displayNameFromSortName(stringField(artist, "sort-name"));
  if (sortName && hasLatinLetter(sortName)) return sortName;
  if (name && hasCyrillic(name)) return romanizeCyrillic(name);
  return name ?? sortName ?? targetCredit;
}

function displayNameFromSortName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? [...parts.slice(1), parts[0]].join(" ") : value;
}

function hasLatinLetter(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function hasCyrillic(value: string): boolean {
  return /[\u0400-\u04ff]/.test(value);
}

function romanizeCyrillic(value: string): string {
  const map: Record<string, string> = {
    А: "A", а: "a", Б: "B", б: "b", В: "V", в: "v", Г: "G", г: "g", Д: "D", д: "d", Е: "E", е: "e", Ё: "Yo", ё: "yo",
    Ж: "Zh", ж: "zh", З: "Z", з: "z", И: "I", и: "i", Й: "Y", й: "y", К: "K", к: "k", Л: "L", л: "l", М: "M", м: "m",
    Н: "N", н: "n", О: "O", о: "o", П: "P", п: "p", Р: "R", р: "r", С: "S", с: "s", Т: "T", т: "t", У: "U", у: "u",
    Ф: "F", ф: "f", Х: "Kh", х: "kh", Ц: "Ts", ц: "ts", Ч: "Ch", ч: "ch", Ш: "Sh", ш: "sh", Щ: "Shch", щ: "shch",
    Ы: "Y", ы: "y", Э: "E", э: "e", Ю: "Yu", ю: "yu", Я: "Ya", я: "ya", Ь: "", ь: "", Ъ: "", ъ: "", Є: "Ye", є: "ye",
    І: "I", і: "i", Ї: "Yi", ї: "yi", Ґ: "G", ґ: "g"
  };
  return Array.from(value).map((character) => map[character] ?? character).join("");
}
