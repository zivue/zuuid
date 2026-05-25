import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { GAMESDB_API_BASE, GAMESDB_IMAGE_BASE_URL } from "./constants.js";
import {
  fetchGamesDbGameSourceRecord,
  searchGamesDbGameSourceRecords,
  searchGamesDbGames,
  transformGamesDbGame
} from "./game.js";
import { fetchGamesDbPlatformSourceRecord, transformGamesDbPlatform } from "./platform.js";
import type { FetchGamesDbGameInput, FetchGamesDbPlatformInput, GamesDbFetchLike, GamesDbProviderOptions, GamesDbSearchInput, GamesDbTransformOptions } from "./types.js";

export class GamesDbProvider {
  readonly apiBase: string;
  readonly imageBaseUrl: string | null;
  private readonly apiKey: string;
  private readonly fetchImpl: GamesDbFetchLike;

  constructor(options: GamesDbProviderOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) {
      throw new Error("GamesDB API key must not be empty");
    }
    this.apiBase = options.apiBase ?? GAMESDB_API_BASE;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.imageBaseUrl = options.imageBaseUrl === undefined ? GAMESDB_IMAGE_BASE_URL : options.imageBaseUrl;
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
    const url = new URL(`${this.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    url.searchParams.set("apikey", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GamesDB API returned ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  transformOptions(): GamesDbTransformOptions {
    return { imageBaseUrl: this.imageBaseUrl };
  }

  async fetchGameSourceRecord(input: FetchGamesDbGameInput): Promise<SourceRecord | undefined> {
    return fetchGamesDbGameSourceRecord(this, input);
  }

  async fetchGame(input: FetchGamesDbGameInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchGameSourceRecord(input);
    return source ? transformGamesDbGame(source, this.transformOptions()) : undefined;
  }

  async searchGameSourceRecords(input: GamesDbSearchInput): Promise<SearchResponse<SourceRecord>> {
    return searchGamesDbGameSourceRecords(this, input);
  }

  async searchGames(input: GamesDbSearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
    return searchGamesDbGames(this, input, this.transformOptions());
  }

  async fetchPlatformSourceRecord(input: FetchGamesDbPlatformInput): Promise<SourceRecord | undefined> {
    return fetchGamesDbPlatformSourceRecord(this, input);
  }

  async fetchPlatform(input: FetchGamesDbPlatformInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchPlatformSourceRecord(input);
    return source ? transformGamesDbPlatform(source, this.transformOptions()) : undefined;
  }
}
