import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import {
  fetchOpenLibraryAuthorSourceRecord,
  searchOpenLibraryAuthors,
  searchOpenLibraryAuthorSourceRecords,
  transformOpenLibraryAuthor,
  type FetchOpenLibraryAuthorInput
} from "./author.js";
import {
  fetchOpenLibraryBookSourceRecord,
  searchOpenLibraryBooks,
  searchOpenLibraryBookSourceRecords,
  transformOpenLibraryBook,
  type FetchOpenLibraryBookInput
} from "./book.js";
import { OPEN_LIBRARY_API_BASE, OPEN_LIBRARY_COVER_BASE_URL, OPEN_LIBRARY_DEFAULT_USER_AGENT } from "./constants.js";
import type { OpenLibraryFetchLike, OpenLibraryProviderOptions, OpenLibrarySearchInput, OpenLibraryTransformOptions } from "./types.js";

export class OpenLibraryProvider {
  readonly apiBase: string;
  readonly coverBaseUrl: string | null;
  readonly userAgent: string;

  private readonly fetchImpl: OpenLibraryFetchLike;

  constructor(options: OpenLibraryProviderOptions = {}) {
    this.apiBase = options.apiBase ?? OPEN_LIBRARY_API_BASE;
    this.coverBaseUrl = options.coverBaseUrl === undefined ? OPEN_LIBRARY_COVER_BASE_URL : options.coverBaseUrl;
    this.userAgent = options.userAgent ?? OPEN_LIBRARY_DEFAULT_USER_AGENT;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers();
    headers.set("accept", "application/json");
    headers.set("user-agent", this.userAgent);

    const response = await this.fetchImpl(url, { headers });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Open Library API returned ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async fetchBookSourceRecord(input: FetchOpenLibraryBookInput): Promise<SourceRecord | undefined> {
    return fetchOpenLibraryBookSourceRecord(this, input);
  }

  async fetchBook(input: FetchOpenLibraryBookInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchBookSourceRecord(input);
    return source ? transformOpenLibraryBook(source, this.transformOptions()) : undefined;
  }

  async fetchAuthorSourceRecord(input: FetchOpenLibraryAuthorInput): Promise<SourceRecord | undefined> {
    return fetchOpenLibraryAuthorSourceRecord(this, input);
  }

  async fetchAuthor(input: FetchOpenLibraryAuthorInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchAuthorSourceRecord(input);
    return source ? transformOpenLibraryAuthor(source, this.transformOptions()) : undefined;
  }

  async searchBookSourceRecords(input: OpenLibrarySearchInput): Promise<SearchResponse<SourceRecord>> {
    return searchOpenLibraryBookSourceRecords(this, input);
  }

  async searchBooks(input: OpenLibrarySearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
    return searchOpenLibraryBooks(this, input, this.transformOptions());
  }

  async searchAuthorSourceRecords(input: OpenLibrarySearchInput): Promise<SearchResponse<SourceRecord>> {
    return searchOpenLibraryAuthorSourceRecords(this, input);
  }

  async searchAuthors(input: OpenLibrarySearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
    return searchOpenLibraryAuthors(this, input);
  }

  transformOptions(): OpenLibraryTransformOptions {
    return {
      coverBaseUrl: this.coverBaseUrl
    };
  }
}
