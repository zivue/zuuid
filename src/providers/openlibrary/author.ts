import { createZuuidData, type SearchResponse, type ZuuidData, type ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { attachSourceMetadata, createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { OPEN_LIBRARY_COVER_BASE_URL, OPEN_LIBRARY_PROVIDER } from "./constants.js";
import type { OpenLibraryProvider } from "./client.js";
import type { OpenLibrarySearchInput, OpenLibrarySearchResponse, OpenLibraryTransformOptions } from "./types.js";

export const OPEN_LIBRARY_AUTHOR_CATEGORY = "author";

export type FetchOpenLibraryAuthorInput = {
  id: string;
  workLimit?: number;
};

export type OpenLibraryAuthorDescription = string | { type?: string; value?: string };

export type OpenLibraryAuthorPayload = {
  key?: string;
  name?: string;
  alternate_names?: string[];
  birth_date?: string;
  death_date?: string;
  date?: string;
  bio?: OpenLibraryAuthorDescription;
  wikipedia?: string;
  links?: { title?: string; url?: string; type?: { key?: string } }[];
  photos?: number[];
  personal_name?: string;
  remote_ids?: Record<string, string>;
};

export type OpenLibraryAuthorWorkPayload = {
  key?: string;
  title?: string;
  first_publish_date?: string;
  covers?: number[];
};

export type OpenLibraryAuthorWorksPayload = {
  entries?: OpenLibraryAuthorWorkPayload[];
  size?: number;
};

export type OpenLibraryAuthorSourcePayload = {
  author: OpenLibraryAuthorPayload;
  works?: {
    entries: OpenLibraryAuthorWorkPayload[];
    size?: number;
  };
};

export type OpenLibraryAuthorSearchDoc = {
  key?: string;
  name?: string;
  alternate_names?: string[];
  birth_date?: string;
  top_work?: string;
  work_count?: number;
  top_subjects?: string[];
  _version_?: number;
};

export async function fetchOpenLibraryAuthorSourceRecord(
  provider: OpenLibraryProvider,
  input: FetchOpenLibraryAuthorInput
): Promise<SourceRecord | undefined> {
  const id = normalizeOpenLibraryAuthorId(input.id);
  const author = await provider.getJson<OpenLibraryAuthorPayload>(`/authors/${id}.json`, {});

  if (!author) {
    return undefined;
  }

  const works = await provider.getJson<OpenLibraryAuthorWorksPayload>(`/authors/${id}/works.json`, {
    limit: String(input.workLimit ?? 20)
  });
  const payload: OpenLibraryAuthorSourcePayload = {
    author,
    ...(works ? { works: { entries: works.entries ?? [], size: works.size } } : {})
  };

  return createSourceRecord({
    source: { provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_AUTHOR_CATEGORY, externalId: id },
    payload: payload as JsonValue
  });
}

export async function searchOpenLibraryAuthorSourceRecords(
  provider: OpenLibraryProvider,
  input: OpenLibrarySearchInput
): Promise<SearchResponse<SourceRecord>> {
  const payload = await fetchOpenLibraryAuthorSearchResults(provider, input);
  return {
    results: await sourceRecordsFromSearchResults(payload.docs),
    pagination: paginationFromOpenLibrarySearchResponse(payload, input)
  };
}

export async function searchOpenLibraryAuthors(
  provider: OpenLibraryProvider,
  input: OpenLibrarySearchInput
): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = await fetchOpenLibraryAuthorSearchResults(provider, input);
  const results: ZuuidSearchResult[] = [];

  for (const item of payload.docs ?? []) {
    const id = normalizeOpenLibraryAuthorIdOrUndefined(item.key);
    const title = stringField(item.name);
    if (!id || !title) {
      continue;
    }

    const zuuid = await providerZuuid({ provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_AUTHOR_CATEGORY, externalId: id });
    results.push({
      id: zuuid,
      zuuid,
      category: OPEN_LIBRARY_AUTHOR_CATEGORY,
      title,
      date: stringField(item.birth_date) ?? null,
      cover: null,
      rating: null,
      weight: typeof item.work_count === "number" ? item.work_count : null,
      relationType: null,
      attribute: stringField(item.top_work) ?? null,
      order: null,
      source: { source: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_AUTHOR_CATEGORY, value: id }
    });
  }

  return {
    results,
    pagination: paginationFromOpenLibrarySearchResponse(payload, input)
  };
}

export async function transformOpenLibraryAuthor(
  source: SourceRecord,
  options: OpenLibraryTransformOptions = {}
): Promise<ZuuidData> {
  if (source.source.provider !== OPEN_LIBRARY_PROVIDER || source.source.category !== OPEN_LIBRARY_AUTHOR_CATEGORY) {
    throw new Error(`unsupported Open Library source: ${source.source.provider}:${source.source.category}`);
  }

  const payload = openLibraryAuthorSourcePayload(source.payload as JsonValue);
  const author = payload.author;
  const id = normalizeOpenLibraryAuthorId(source.source.externalId || author.key || "");
  const name = stringField(author.name);
  if (!name) {
    throw new Error("missing required Open Library author field: name");
  }

  const zuuid = await providerZuuid({ provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_AUTHOR_CATEGORY, externalId: id });
  const data = createZuuidData({ zuuid, category: OPEN_LIBRARY_AUTHOR_CATEGORY, primaryTitle: name });

  const birthDate = stringField(author.birth_date ?? author.date);
  if (birthDate) {
    data.primaryDate = birthDate;
    data.details.push({ key: "birth_date", value: birthDate, source: OPEN_LIBRARY_PROVIDER });
  }
  addDetail(data, "death_date", author.death_date);
  addDetail(data, "personal_name", author.personal_name);
  addDetail(data, "wikipedia", author.wikipedia);
  addStructuredDetail(data, "links", author.links as JsonValue | undefined);
  addStructuredDetail(data, "remote_ids", author.remote_ids as JsonValue | undefined);
  if (typeof payload.works?.size === "number") {
    data.details.push({ key: "work_count", value: payload.works.size, source: OPEN_LIBRARY_PROVIDER });
  }

  const bio = descriptionValue(author.bio);
  if (bio) {
    data.descriptions.push({ value: bio, source: OPEN_LIBRARY_PROVIDER });
  }

  for (const alias of author.alternate_names ?? []) {
    const value = stringField(alias);
    if (value && value !== name && !data.aliases.some((item) => item.value === value)) {
      data.aliases.push({ value, aliasType: "alternate_name", isPrimary: false, source: OPEN_LIBRARY_PROVIDER });
    }
  }

  addPhoto(data, author.photos?.find((photo) => typeof photo === "number"), options.coverBaseUrl ?? OPEN_LIBRARY_COVER_BASE_URL, true);

  for (const [index, work] of (payload.works?.entries ?? []).entries()) {
    await addWorkRelation(data, work, index, options);
  }

  return attachSourceMetadata(data, source);
}

async function fetchOpenLibraryAuthorSearchResults(
  provider: OpenLibraryProvider,
  input: OpenLibrarySearchInput
): Promise<OpenLibrarySearchResponse<OpenLibraryAuthorSearchDoc>> {
  const payload = await provider.getJson<OpenLibrarySearchResponse<OpenLibraryAuthorSearchDoc>>("/search/authors.json", {
    q: searchQuery(input.query),
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 20)
  });

  return payload ?? {};
}

async function sourceRecordsFromSearchResults(results: OpenLibraryAuthorSearchDoc[] | undefined): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];
  for (const result of results ?? []) {
    const id = normalizeOpenLibraryAuthorIdOrUndefined(result.key);
    if (!id) {
      continue;
    }
    records.push(
      await createSourceRecord({
        source: { provider: OPEN_LIBRARY_PROVIDER, category: OPEN_LIBRARY_AUTHOR_CATEGORY, externalId: id },
        payload: result as JsonValue
      })
    );
  }
  return records;
}

async function addWorkRelation(
  data: ZuuidData,
  work: OpenLibraryAuthorWorkPayload,
  index: number,
  options: OpenLibraryTransformOptions
): Promise<void> {
  const id = normalizeOpenLibraryWorkIdOrUndefined(work.key);
  const title = stringField(work.title);
  if (!id || !title) {
    return;
  }

  const zuuid = await providerZuuid({ provider: OPEN_LIBRARY_PROVIDER, category: "book", externalId: id });
  data.relations.push({
    id: zuuid,
    zuuid,
    category: "book",
    title,
    date: stringField(work.first_publish_date) ?? null,
    cover: coverUrl(work.covers?.find((cover) => typeof cover === "number"), options.coverBaseUrl ?? OPEN_LIBRARY_COVER_BASE_URL),
    rating: null,
    weight: null,
    relationType: "author_of",
    direction: "outgoing",
    attribute: null,
    order: index,
    source: OPEN_LIBRARY_PROVIDER,
    externalId: id
  });
}

function addPhoto(data: ZuuidData, photoId: number | undefined, baseUrl: string | null, isPrimary: boolean): void {
  const url = coverUrl(photoId, baseUrl);
  if (!url) {
    return;
  }

  data.cover = data.cover ?? url;
  data.media.push({
    url,
    mediaType: "image",
    mediaCategory: "profile",
    isPrimary,
    source: OPEN_LIBRARY_PROVIDER
  });
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

function openLibraryAuthorSourcePayload(payload: JsonValue): OpenLibraryAuthorSourcePayload {
  const value = payload as OpenLibraryAuthorSourcePayload | OpenLibraryAuthorPayload;
  if ("author" in value && value.author) {
    return value as OpenLibraryAuthorSourcePayload;
  }
  return { author: value as OpenLibraryAuthorPayload };
}

function normalizeOpenLibraryAuthorId(value: string): string {
  const normalized = stringField(value)?.replace(/^\/authors\//, "").replace(/\.json$/, "");
  if (!normalized) {
    throw new Error("Open Library author id must not be empty");
  }
  if (!/^OL\d+A$/i.test(normalized)) {
    throw new Error(`Open Library author id must look like OL23919A: ${value}`);
  }
  return normalized.toUpperCase();
}

function normalizeOpenLibraryAuthorIdOrUndefined(value: string | undefined): string | undefined {
  const normalized = stringField(value)?.replace(/^\/authors\//, "");
  return normalized && /^OL\d+A$/i.test(normalized) ? normalized.toUpperCase() : undefined;
}

function normalizeOpenLibraryWorkIdOrUndefined(value: string | undefined): string | undefined {
  const normalized = stringField(value)?.replace(/^\/works\//, "");
  return normalized && /^OL\d+W$/i.test(normalized) ? normalized.toUpperCase() : undefined;
}

function coverUrl(coverId: number | undefined, baseUrl: string | null): string | null {
  if (typeof coverId !== "number" || !baseUrl) {
    return null;
  }
  return `${baseUrl.replace(/\/$/, "")}/${coverId}-L.jpg`;
}

function descriptionValue(value: OpenLibraryAuthorDescription | undefined): string | undefined {
  return typeof value === "string" ? stringField(value) : stringField(value?.value);
}

function searchQuery(value: string): string {
  const query = stringField(value);
  if (!query) {
    throw new Error("Open Library author search query must not be empty");
  }
  return query;
}

function stringField(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
