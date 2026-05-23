import { createZuuidData, type SearchResponse, type ZuuidData, type ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { attachSourceMetadata, createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
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
  publish_date?: string;
  publishers?: string[];
  number_of_pages?: number;
  physical_format?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  languages?: { key?: string }[];
  covers?: number[];
};

export type OpenLibraryEditionsPayload = {
  entries?: OpenLibraryEditionPayload[];
  size?: number;
};

export type OpenLibraryBookPayload = {
  work: OpenLibraryWorkPayload;
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

  const editions = await provider.getJson<OpenLibraryEditionsPayload>(`/works/${id}/editions.json`, {
    limit: String(input.editionLimit ?? 10)
  });
  const ratings = await provider.getJson<OpenLibraryRatingsPayload>(`/works/${id}/ratings.json`, {});
  const authors = await fetchOpenLibraryAuthors(provider, work);
  const payload: OpenLibraryBookPayload = {
    work,
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
  const rating = numberField(payload.ratings?.summary?.average ?? payload.ratings?.summary?.sortable);
  if (rating !== undefined) {
    data.rating = rating;
    data.details.push({ key: "rating_average", value: rating, source: OPEN_LIBRARY_PROVIDER });
  }
  const ratingCount = numberField(payload.ratings?.summary?.count);
  if (ratingCount !== undefined) {
    data.details.push({ key: "rating_count", value: ratingCount, source: OPEN_LIBRARY_PROVIDER });
  }

  const firstPublishDate = stringField(work.first_publish_date);
  if (firstPublishDate) {
    data.primaryDate = firstPublishDate;
    data.details.push({ key: "first_publish_date", value: firstPublishDate, source: OPEN_LIBRARY_PROVIDER });
  }

  const description = descriptionValue(work.description);
  if (description) {
    data.descriptions.push({ value: description, source: OPEN_LIBRARY_PROVIDER });
  }

  const primaryEdition = payload.editions?.entries.find((edition) => edition.covers?.some((cover) => typeof cover === "number"));
  const primaryCover = work.covers?.find((cover) => typeof cover === "number") ?? primaryEdition?.covers?.find((cover) => typeof cover === "number");
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
  addEditionDetails(data, payload.editions?.entries);
  if (typeof payload.editions?.size === "number") {
    data.details.push({ key: "edition_count", value: payload.editions.size, source: OPEN_LIBRARY_PROVIDER });
  }

  for (const subject of work.subjects ?? []) {
    addTag(data, subject);
  }

  await addAuthorRelations(data, payload);

  return attachSourceMetadata(data, source);
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
  const fields = input.fields ?? [
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
    "subject"
  ];
  const payload = await provider.getJson<OpenLibrarySearchResponse<OpenLibrarySearchDoc>>("/search.json", {
    q: query,
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 20),
    fields: fields.join(","),
    ...(input.language ? { language: input.language } : {})
  });

  return payload ?? {};
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

function addEditionDetails(data: ZuuidData, editions: OpenLibraryEditionPayload[] | undefined): void {
  const firstEdition = editions?.[0];
  if (!firstEdition) {
    return;
  }

  addArrayDetail(data, "publishers", firstEdition.publishers);
  addArrayDetail(data, "isbn_10", firstEdition.isbn_10);
  addArrayDetail(data, "isbn_13", firstEdition.isbn_13);

  if (firstEdition.publish_date) {
    data.details.push({ key: "publish_date", value: firstEdition.publish_date, source: OPEN_LIBRARY_PROVIDER });
  }
  if (typeof firstEdition.number_of_pages === "number") {
    data.details.push({ key: "number_of_pages", value: firstEdition.number_of_pages, source: OPEN_LIBRARY_PROVIDER });
  }
  if (firstEdition.physical_format) {
    data.details.push({ key: "physical_format", value: firstEdition.physical_format, source: OPEN_LIBRARY_PROVIDER });
  }
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
