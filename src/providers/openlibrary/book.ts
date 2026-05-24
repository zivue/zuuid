import { createZuuidData, type SearchResponse, type ZuuidData, type ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { attachSourceMetadata, createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { normalizeRating } from "../common.js";
import { OPEN_LIBRARY_COVER_BASE_URL, OPEN_LIBRARY_PROVIDER } from "./constants.js";
import type { OpenLibraryProvider } from "./client.js";
import type { OpenLibrarySearchInput, OpenLibrarySearchResponse, OpenLibraryTransformOptions } from "./types.js";

export const OPEN_LIBRARY_BOOK_CATEGORY = "book";

export type FetchOpenLibraryBookInput = {
  id: string;
  editionLimit?: number;
};

export type OpenLibraryDescription = string | { type?: string; value?: string };

export type OpenLibraryAuthorRef = {
  author?: { key?: string };
  type?: { key?: string };
};

export type OpenLibraryWorkPayload = {
  key?: string;
  title?: string;
  description?: OpenLibraryDescription;
  covers?: number[];
  subjects?: string[];
  subject_places?: string[];
  subject_people?: string[];
  subject_times?: string[];
  first_publish_date?: string;
  authors?: OpenLibraryAuthorRef[];
  links?: { title?: string; url?: string; type?: { key?: string } }[];
  excerpts?: { excerpt?: string; pages?: string; comment?: string }[];
  series?: JsonValue[];
  cover_edition?: { key?: string };
  created?: JsonValue;
  last_modified?: JsonValue;
  latest_revision?: number;
  revision?: number;
};

export type OpenLibraryBookAuthorPayload = {
  key?: string;
  name?: string;
  birth_date?: string;
  death_date?: string;
  bio?: OpenLibraryDescription;
  photos?: number[];
};

export type OpenLibraryEditionPayload = {
  key?: string;
  title?: string;
  subtitle?: string;
  full_title?: string;
  edition_name?: string;
  description?: OpenLibraryDescription;
  notes?: OpenLibraryDescription;
  publish_date?: string;
  publishers?: string[];
  number_of_pages?: number;
  physical_format?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  languages?: { key?: string }[];
  translated_from?: { key?: string }[];
  translation_of?: string;
  covers?: number[];
  contributors?: { role?: string; name?: string }[];
  identifiers?: Record<string, JsonValue>;
  classifications?: Record<string, JsonValue>;
  local_id?: string[];
  source_records?: string[];
};

export type OpenLibraryEditionsPayload = {
  entries?: OpenLibraryEditionPayload[];
  size?: number;
};

export type OpenLibraryBookPayload = {
  work: OpenLibraryWorkPayload;
  search?: OpenLibrarySearchDoc;
  editions?: {
    entries: OpenLibraryEditionPayload[];
    size?: number;
  };
  authors?: OpenLibraryBookAuthorPayload[];
  ratings?: OpenLibraryRatingsPayload;
};

export type OpenLibraryRatingsPayload = {
  summary?: {
    average?: number;
    count?: number;
    sortable?: number;
  };
  counts?: Record<string, number>;
};

export type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  first_publish_date?: string;
  cover_i?: number;
  ratings_average?: number;
  edition_count?: number;
  language?: string[];
  isbn?: string[];
  ia?: string[];
  subject?: string[];
  ddc?: string[];
  lcc?: string[];
  lccn?: string[];
};

export async function fetchOpenLibraryBookSourceRecord(
  provider: OpenLibraryProvider,
  input: FetchOpenLibraryBookInput
): Promise<SourceRecord | undefined> {
  const id = normalizeOpenLibraryBookId(input.id);
  const work = await provider.getJson<OpenLibraryWorkPayload>(`/works/${id}.json`, {});

  if (!work) {
    return undefined;
  }

  const search = await fetchOpenLibraryBookSearchDoc(provider, id, work);
  const editions = await provider.getJson<OpenLibraryEditionsPayload>(`/works/${id}/editions.json`, {
    limit: String(input.editionLimit ?? 50)
  });
  const ratings = await provider.getJson<OpenLibraryRatingsPayload>(`/works/${id}/ratings.json`, {});
  const authors = await fetchOpenLibraryAuthors(provider, work);
  const payload: OpenLibraryBookPayload = {
    work,
    ...(search ? { search } : {}),
    ...(editions ? { editions: { entries: editions.entries ?? [], size: editions.size } } : {}),
    ...(authors.length ? { authors } : {}),
    ...(ratings ? { ratings } : {})
  };

  return createSourceRecord({
    source: { provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_BOOK_CATEGORY, externalId: id },
    payload: payload as JsonValue
  });
}

export async function searchOpenLibraryBookSourceRecords(
  provider: OpenLibraryProvider,
  input: OpenLibrarySearchInput
): Promise<SearchResponse<SourceRecord>> {
  const payload = await fetchOpenLibraryBookSearchResults(provider, input);
  return {
    results: await sourceRecordsFromSearchResults(payload.docs),
    pagination: paginationFromOpenLibrarySearchResponse(payload, input)
  };
}

export async function searchOpenLibraryBooks(
  provider: OpenLibraryProvider,
  input: OpenLibrarySearchInput,
  options: OpenLibraryTransformOptions = {}
): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = await fetchOpenLibraryBookSearchResults(provider, input);
  const results: ZuuidSearchResult[] = [];

  for (const item of payload.docs ?? []) {
    const id = openLibraryWorkIdFromKey(item.key);
    const title = stringField(item.title);
    if (!id || !title) {
      continue;
    }

    const zuuid = await providerZuuid({ provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_BOOK_CATEGORY, externalId: id });
    const rating = typeof item.ratings_average === "number" ? item.ratings_average : null;
    results.push({
      id: zuuid,
      zuuid,
      category: OPEN_LIBRARY_BOOK_CATEGORY,
      title,
      date: item.first_publish_year === undefined ? stringField(item.first_publish_date) ?? null : String(item.first_publish_year),
      cover: coverUrl(item.cover_i, options.coverBaseUrl ?? OPEN_LIBRARY_COVER_BASE_URL),
      rating,
      weight: typeof item.edition_count === "number" ? item.edition_count : rating,
      relationType: null,
      attribute: item.author_name?.filter(Boolean).join(", ") || null,
      order: null,
      source: { source: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_BOOK_CATEGORY, value: id }
    });
  }

  return {
    results,
    pagination: paginationFromOpenLibrarySearchResponse(payload, input)
  };
}

export async function transformOpenLibraryBook(
  source: SourceRecord,
  options: OpenLibraryTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== OPEN_LIBRARY_PROVIDER || source.source.category !== OPEN_LIBRARY_BOOK_CATEGORY) {
    throw new Error(`unsupported Open Library source: ${source.source.provider}:${source.source.category}`);
  }

  const payload = openLibraryBookPayload(source.payload as JsonValue);
  const work = payload.work;
  const id = normalizeOpenLibraryBookId(source.source.externalId || work.key || "");
  const title = stringField(work.title);
  if (!title) {
    throw new Error("missing required Open Library book field: title");
  }

  const zuuid = await providerZuuid({ provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_BOOK_CATEGORY, externalId: id });
  const data = createZuuidData({ zuuid, category: OPEN_LIBRARY_BOOK_CATEGORY, primaryTitle: title });
  const preferredEdition = preferredOpenLibraryEdition(payload);
  const rating = numberField(payload.ratings?.summary?.average ?? payload.ratings?.summary?.sortable ?? payload.search?.ratings_average);
  if (rating !== undefined) {
    data.rating = normalizeRating(rating, 0, 5);
    data.details.push({ key: "rating_average", value: rating, source: OPEN_LIBRARY_PROVIDER });
  }
  const ratingCount = numberField(payload.ratings?.summary?.count);
  if (ratingCount !== undefined) {
    data.details.push({ key: "rating_count", value: ratingCount, source: OPEN_LIBRARY_PROVIDER });
  }

  const firstPublishYear = numberField(payload.search?.first_publish_year);
  const firstPublishDate = stringField(work.first_publish_date) ?? stringField(payload.search?.first_publish_date);
  if (firstPublishYear !== undefined) {
    data.primaryDate = String(firstPublishYear);
    data.details.push({ key: "first_publish_year", value: firstPublishYear, source: OPEN_LIBRARY_PROVIDER });
    if (firstPublishDate && firstPublishDate !== String(firstPublishYear)) {
      data.details.push({ key: "work_first_publish_date", value: firstPublishDate, source: OPEN_LIBRARY_PROVIDER });
    }
  } else if (firstPublishDate) {
    data.primaryDate = firstPublishDate;
    data.details.push({ key: "first_publish_date", value: firstPublishDate, source: OPEN_LIBRARY_PROVIDER });
  }

  const description = descriptionValue(work.description);
  if (description) {
    data.descriptions.push({ value: description, source: OPEN_LIBRARY_PROVIDER });
  }
  for (const edition of payload.editions?.entries ?? []) {
    const editionDescription = descriptionValue(edition.description);
    if (editionDescription && !data.descriptions.some((item) => item.value === editionDescription)) {
      data.descriptions.push({ value: editionDescription, source: OPEN_LIBRARY_PROVIDER });
    }
  }

  const primaryCover =
    work.covers?.find((cover) => typeof cover === "number") ??
    preferredEdition?.covers?.find((cover) => typeof cover === "number") ??
    payload.search?.cover_i;
  const primaryCoverUrl = coverUrl(primaryCover, options.coverBaseUrl ?? OPEN_LIBRARY_COVER_BASE_URL);
  if (primaryCoverUrl) {
    data.cover = primaryCoverUrl;
    data.media.push({
      url: primaryCoverUrl,
      mediaType: "image",
      mediaCategory: "cover",
      isPrimary: true,
      source: OPEN_LIBRARY_PROVIDER
    });
  }

  addArrayDetail(data, "subjects", work.subjects);
  addArrayDetail(data, "subject_places", work.subject_places);
  addArrayDetail(data, "subject_people", work.subject_people);
  addArrayDetail(data, "subject_times", work.subject_times);
  addStructuredDetail(data, "links", work.links as JsonValue | undefined);
  addStructuredDetail(data, "excerpts", work.excerpts as JsonValue | undefined);
  addStructuredDetail(data, "series", work.series as JsonValue | undefined);
  addStructuredDetail(data, "cover_edition", work.cover_edition as JsonValue | undefined);
  addOpenLibraryBookAggregateDetails(data, payload, preferredEdition);
  if (typeof payload.editions?.size === "number") {
    data.details.push({ key: "edition_count", value: payload.editions.size, source: OPEN_LIBRARY_PROVIDER });
  } else if (typeof payload.search?.edition_count === "number") {
    data.details.push({ key: "edition_count", value: payload.search.edition_count, source: OPEN_LIBRARY_PROVIDER });
  }

  for (const subject of work.subjects ?? []) {
    addTag(data, subject);
  }

  await addAuthorRelations(data, payload);

  return attachSourceMetadata(data, source);
}

async function fetchOpenLibraryBookSearchDoc(
  provider: OpenLibraryProvider,
  id: string,
  work: OpenLibraryWorkPayload
): Promise<OpenLibrarySearchDoc | undefined> {
  const byId = await fetchOpenLibraryBookSearchDocByQuery(provider, id, id, 5);
  if (byId) {
    return byId;
  }

  const title = stringField(work.title);
  return title ? fetchOpenLibraryBookSearchDocByQuery(provider, id, title, 20) : undefined;
}

async function fetchOpenLibraryBookSearchDocByQuery(
  provider: OpenLibraryProvider,
  id: string,
  query: string,
  limit: number
): Promise<OpenLibrarySearchDoc | undefined> {
  const payload = await provider.getJson<OpenLibrarySearchResponse<OpenLibrarySearchDoc>>("/search.json", {
    q: query,
    limit: String(limit),
    fields: openLibraryBookSearchFields().join(",")
  });
  return payload?.docs?.find((doc) => openLibraryWorkIdFromKey(doc.key) === id);
}

async function fetchOpenLibraryAuthors(provider: OpenLibraryProvider, work: OpenLibraryWorkPayload): Promise<OpenLibraryBookAuthorPayload[]> {
  const authors: OpenLibraryBookAuthorPayload[] = [];
  for (const ref of work.authors ?? []) {
    const id = openLibraryAuthorIdFromKey(ref.author?.key);
    if (!id) {
      continue;
    }
    const author = await provider.getJson<OpenLibraryBookAuthorPayload>(`/authors/${id}.json`, {});
    if (author) {
      authors.push(author);
    }
  }
  return authors;
}

async function fetchOpenLibraryBookSearchResults(
  provider: OpenLibraryProvider,
  input: OpenLibrarySearchInput
): Promise<OpenLibrarySearchResponse<OpenLibrarySearchDoc>> {
  const query = searchQuery(input.query);
  const fields = input.fields ?? openLibraryBookSearchFields();
  const payload = await provider.getJson<OpenLibrarySearchResponse<OpenLibrarySearchDoc>>("/search.json", {
    q: query,
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 20),
    fields: fields.join(","),
    ...(input.language ? { language: input.language } : {})
  });

  return payload ?? {};
}

function openLibraryBookSearchFields(): string[] {
  return [
    "key",
    "title",
    "author_name",
    "author_key",
    "first_publish_year",
    "first_publish_date",
    "cover_i",
    "ratings_average",
    "edition_count",
    "language",
    "isbn",
    "ia",
    "subject",
    "ddc",
    "lcc",
    "lccn"
  ];
}

async function sourceRecordsFromSearchResults(results: OpenLibrarySearchDoc[] | undefined): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];
  for (const result of results ?? []) {
    const id = openLibraryWorkIdFromKey(result.key);
    if (!id) {
      continue;
    }
    records.push(
      await createSourceRecord({
        source: { provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_BOOK_CATEGORY, externalId: id },
        payload: result as JsonValue
      })
    );
  }
  return records;
}

async function addAuthorRelations(data: ZuuidData, payload: OpenLibraryBookPayload): Promise<void> {
  for (const [index, ref] of (payload.work.authors ?? []).entries()) {
    const id = openLibraryAuthorIdFromKey(ref.author?.key);
    if (!id) {
      continue;
    }
    const author = payload.authors?.find((item) => openLibraryAuthorIdFromKey(item.key) === id);
    const zuuid = await providerZuuid({ provider: OPEN_LIBRARY_PROVIDER, category: "author", externalId: id });
    data.relations.push({
      id: zuuid,
      zuuid,
      category: "author",
      title: stringField(author?.name) ?? id,
      date: stringField(author?.birth_date) ?? null,
      cover: coverUrl(author?.photos?.find((photo) => typeof photo === "number"), OPEN_LIBRARY_COVER_BASE_URL),
      rating: null,
      weight: null,
      relationType: "authored_by",
      direction: "outgoing",
      attribute: null,
      order: index,
      source: OPEN_LIBRARY_PROVIDER,
      externalId: id
    });
  }
}

function addOpenLibraryBookAggregateDetails(
  data: ZuuidData,
  payload: OpenLibraryBookPayload,
  preferredEdition: OpenLibraryEditionPayload | undefined
): void {
  const editions = payload.editions?.entries ?? [];
  if (!editions.length && !payload.search) {
    return;
  }

  addArrayDetail(data, "languages", uniqueStrings([...(payload.search?.language ?? []), ...editions.flatMap((edition) => languageKeys(edition.languages))]));
  addArrayDetail(data, "isbn_10", uniqueStrings(editions.flatMap((edition) => edition.isbn_10 ?? [])));
  addArrayDetail(data, "isbn_13", uniqueStrings(editions.flatMap((edition) => edition.isbn_13 ?? [])));
  addArrayDetail(data, "isbn", uniqueStrings([...(payload.search?.isbn ?? []), ...editions.flatMap((edition) => [...(edition.isbn_10 ?? []), ...(edition.isbn_13 ?? [])])]));
  addArrayDetail(data, "ia", payload.search?.ia);
  addArrayDetail(data, "publishers", uniqueStrings(editions.flatMap((edition) => edition.publishers ?? [])));
  addArrayDetail(data, "source_records", uniqueStrings(editions.flatMap((edition) => edition.source_records ?? [])));
  addArrayDetail(data, "local_id", uniqueStrings(editions.flatMap((edition) => edition.local_id ?? [])));
  addArrayDetail(data, "dewey_decimal_class", uniqueStrings([...(payload.search?.ddc ?? []), ...classificationSubjects(payload.work.subjects, "dewey")]));
  addArrayDetail(data, "lc_classifications", uniqueStrings([...(payload.search?.lcc ?? []), ...classificationSubjects(payload.work.subjects, "lc")]));
  addArrayDetail(data, "lccn", payload.search?.lccn);
  addArrayDetail(data, "translated_from", uniqueStrings(editions.flatMap((edition) => languageKeys(edition.translated_from))));
  addArrayDetail(data, "translation_of", uniqueStrings(editions.map((edition) => stringField(edition.translation_of)).filter((item): item is string => Boolean(item))));

  const contributors = uniqueObjects(
    editions.flatMap((edition) =>
      (edition.contributors ?? [])
        .map((contributor) => ({
          role: stringField(contributor.role),
          name: stringField(contributor.name)
        }))
        .filter((contributor) => contributor.name)
    )
  );
  addStructuredDetail(data, "contributors", contributors as JsonValue);

  const classifications = combineEditionRecords(editions, "classifications");
  addStructuredDetail(data, "classifications", classifications);

  const identifiers = combineEditionRecords(editions, "identifiers");
  addStructuredDetail(data, "identifiers", identifiers);

  if (preferredEdition) {
    const preferred = editionSummary(preferredEdition);
    addStructuredDetail(data, "preferred_edition", preferred as JsonValue);
    addDetail(data, "publish_date", preferredEdition.publish_date);
    addDetail(data, "edition_name", preferredEdition.edition_name);
    addDetail(data, "full_title", preferredEdition.full_title);
    addDetail(data, "subtitle", preferredEdition.subtitle);
    if (typeof preferredEdition.number_of_pages === "number") {
      data.details.push({ key: "number_of_pages", value: preferredEdition.number_of_pages, source: OPEN_LIBRARY_PROVIDER });
    }
    addDetail(data, "physical_format", preferredEdition.physical_format);
  }

  const summaries = editions.map((edition) => editionSummary(edition)).filter((edition) => Object.keys(edition).length > 0);
  addStructuredDetail(data, "editions", summaries as JsonValue);
}

function preferredOpenLibraryEdition(payload: OpenLibraryBookPayload): OpenLibraryEditionPayload | undefined {
  const editions = payload.editions?.entries ?? [];
  if (!editions.length) {
    return undefined;
  }

  const coverEditionId = openLibraryEditionIdFromKey(payload.work.cover_edition?.key);
  const coverEdition = editions.find((edition) => openLibraryEditionIdFromKey(edition.key) === coverEditionId);
  if (coverEdition) {
    return coverEdition;
  }

  return [...editions].sort((a, b) => editionScore(b, payload) - editionScore(a, payload))[0];
}

function editionScore(edition: OpenLibraryEditionPayload, payload: OpenLibraryBookPayload): number {
  let score = 0;
  const title = stringField(edition.title)?.toLowerCase();
  const workTitle = stringField(payload.work.title)?.toLowerCase();
  const languages = languageKeys(edition.languages);

  if (title && workTitle && title === workTitle) {
    score += 20;
  }
  if (languages.includes("eng")) {
    score += 15;
  }
  if (edition.isbn_13?.length) {
    score += 8;
  }
  if (edition.isbn_10?.length) {
    score += 6;
  }
  if (edition.covers?.length) {
    score += 5;
  }
  if (edition.publish_date) {
    score += 4;
  }
  if (edition.publishers?.length) {
    score += 3;
  }
  if (typeof edition.number_of_pages === "number") {
    score += 2;
  }
  return score;
}

function editionSummary(edition: OpenLibraryEditionPayload): Record<string, JsonValue> {
  const summary: Record<string, JsonValue> = {};
  addSummaryString(summary, "id", openLibraryEditionIdFromKey(edition.key));
  addSummaryString(summary, "title", edition.title);
  addSummaryString(summary, "subtitle", edition.subtitle);
  addSummaryString(summary, "fullTitle", edition.full_title);
  addSummaryString(summary, "editionName", edition.edition_name);
  addSummaryString(summary, "publishDate", edition.publish_date);
  addSummaryString(summary, "physicalFormat", edition.physical_format);
  addSummaryNumber(summary, "numberOfPages", edition.number_of_pages);
  addSummaryArray(summary, "publishers", edition.publishers);
  addSummaryArray(summary, "isbn10", edition.isbn_10);
  addSummaryArray(summary, "isbn13", edition.isbn_13);
  addSummaryArray(summary, "languages", languageKeys(edition.languages));
  addSummaryArray(summary, "translatedFrom", languageKeys(edition.translated_from));
  addSummaryString(summary, "translationOf", edition.translation_of);
  addSummaryArray(summary, "covers", edition.covers);
  addSummaryArray(summary, "sourceRecords", edition.source_records);
  addSummaryArray(summary, "localId", edition.local_id);
  if (edition.contributors?.length) {
    summary.contributors = edition.contributors as JsonValue;
  }
  if (edition.identifiers && Object.keys(edition.identifiers).length) {
    summary.identifiers = edition.identifiers as JsonValue;
  }
  if (edition.classifications && Object.keys(edition.classifications).length) {
    summary.classifications = edition.classifications as JsonValue;
  }
  return summary;
}

function addSummaryString(summary: Record<string, JsonValue>, key: string, value: string | undefined): void {
  const clean = stringField(value);
  if (clean) {
    summary[key] = clean;
  }
}

function addSummaryNumber(summary: Record<string, JsonValue>, key: string, value: number | undefined): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    summary[key] = value;
  }
}

function addSummaryArray(summary: Record<string, JsonValue>, key: string, value: unknown[] | undefined): void {
  if (value?.length) {
    summary[key] = value as JsonValue;
  }
}

function languageKeys(value: { key?: string }[] | undefined): string[] {
  return uniqueStrings(
    (value ?? [])
      .map((item) => stringField(item.key)?.replace(/^\/languages\//, ""))
      .filter((item): item is string => Boolean(item))
  );
}

function combineEditionRecords(editions: OpenLibraryEditionPayload[], key: "classifications" | "identifiers"): JsonValue | undefined {
  const combined: Record<string, JsonValue[]> = {};
  for (const edition of editions) {
    const record = edition[key];
    if (!record) {
      continue;
    }
    for (const [recordKey, value] of Object.entries(record)) {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        continue;
      }
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        combined[recordKey] = combined[recordKey] ?? [];
        if (!combined[recordKey].some((existing) => JSON.stringify(existing) === JSON.stringify(item))) {
          combined[recordKey].push(item);
        }
      }
    }
  }
  return Object.keys(combined).length ? combined : undefined;
}

function classificationSubjects(subjects: string[] | undefined, type: "dewey" | "lc"): string[] {
  const values: string[] = [];
  for (const subject of subjects ?? []) {
    const clean = stringField(subject);
    if (!clean) {
      continue;
    }
    if (type === "dewey" && /^\d{3}(?:\/|\.)/.test(clean)) {
      values.push(clean);
    }
    if (type === "lc" && /^[A-Za-z]{1,3}\d{1,5}(?:\.\w+)?(?:\s+\w+)*$/.test(clean) && !/^\d/.test(clean)) {
      values.push(clean);
    }
  }
  return uniqueStrings(values);
}

function uniqueStrings(values: (string | undefined)[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const clean = stringField(value);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

function uniqueObjects<T extends Record<string, unknown>>(values: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function addTag(data: ZuuidData, value: string | undefined): void {
  const tag = stringField(value)?.toLowerCase();
  if (tag && !data.tags.includes(tag)) {
    data.tags.push(tag);
  }
}

function addArrayDetail(data: ZuuidData, key: string, value: string[] | undefined): void {
  const clean = value?.map((item) => stringField(item)).filter((item): item is string => Boolean(item));
  if (clean?.length) {
    data.details.push({ key, value: clean, source: OPEN_LIBRARY_PROVIDER });
  }
}

function addDetail(data: ZuuidData, key: string, value: string | undefined): void {
  const clean = stringField(value);
  if (clean) {
    data.details.push({ key, value: clean, source: OPEN_LIBRARY_PROVIDER });
  }
}

function addStructuredDetail(data: ZuuidData, key: string, value: JsonValue | undefined): void {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return;
  }
  data.details.push({ key, value, source: OPEN_LIBRARY_PROVIDER });
}

function paginationFromOpenLibrarySearchResponse<T>(
  payload: OpenLibrarySearchResponse<T>,
  input: OpenLibrarySearchInput
): SearchResponse<T>["pagination"] {
  const totalResults = payload.numFound ?? payload.num_found ?? 0;
  const limit = input.limit ?? 20;
  return {
    page: input.page ?? 1,
    totalPages: limit > 0 ? Math.ceil(totalResults / limit) : 0,
    totalResults
  };
}

function normalizeOpenLibraryBookId(value: string): string {
  const normalized = stringField(value)?.replace(/^\/works\//, "").replace(/\.json$/, "");
  if (!normalized) {
    throw new Error("Open Library book id must not be empty");
  }
  if (!/^OL\d+W$/i.test(normalized)) {
    throw new Error(`Open Library book id must be a work id like OL82563W: ${value}`);
  }
  return normalized.toUpperCase();
}

function openLibraryWorkIdFromKey(value: string | undefined): string | undefined {
  const normalized = stringField(value)?.replace(/^\/works\//, "");
  return normalized && /^OL\d+W$/i.test(normalized) ? normalized.toUpperCase() : undefined;
}

function openLibraryEditionIdFromKey(value: string | undefined): string | undefined {
  const normalized = stringField(value)?.replace(/^\/books\//, "");
  return normalized && /^OL\d+M$/i.test(normalized) ? normalized.toUpperCase() : undefined;
}

function openLibraryAuthorIdFromKey(value: string | undefined): string | undefined {
  const normalized = stringField(value)?.replace(/^\/authors\//, "");
  return normalized && /^OL\d+A$/i.test(normalized) ? normalized.toUpperCase() : undefined;
}

function coverUrl(coverId: number | undefined, baseUrl: string | null): string | null {
  if (typeof coverId !== "number" || !baseUrl) {
    return null;
  }
  return `${baseUrl.replace(/\/$/, "")}/${coverId}-L.jpg`;
}

function descriptionValue(value: OpenLibraryDescription | undefined): string | undefined {
  return typeof value === "string" ? stringField(value) : stringField(value?.value);
}

function openLibraryBookPayload(payload: JsonValue): OpenLibraryBookPayload {
  const value = payload as OpenLibraryBookPayload | OpenLibraryWorkPayload;
  if ("work" in value && value.work) {
    return value as OpenLibraryBookPayload;
  }
  return { work: value as OpenLibraryWorkPayload };
}

function searchQuery(value: string): string {
  const query = stringField(value);
  if (!query) {
    throw new Error("Open Library search query must not be empty");
  }
  return query;
}

function stringField(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function numberField(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
