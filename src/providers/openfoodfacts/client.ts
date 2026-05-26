import type { SearchResponse, ZuuidData, ZuuidSearchResult } from "../../entity.js";
import { providerZuuid } from "../../identity.js";
import { createSourceRecord, type SourceRecord } from "../../source.js";
import type { JsonValue } from "../../types.js";
import { nestedString, normalizeRating, objectPayload, stringField, valueAsString } from "../common.js";
import {
  OPENFOODFACTS_API_BASE,
  OPENFOODFACTS_DEFAULT_FIELDS,
  OPENFOODFACTS_SEARCH_API_BASE,
  OPENFOODFACTS_DEFAULT_USER_AGENT,
  OPENFOODFACTS_PRODUCT_CATEGORY,
  OPENFOODFACTS_PROVIDER
} from "./constants.js";
import { transformOpenFoodFactsProduct } from "./product.js";
import type {
  FetchOpenFoodFactsProductInput,
  OpenFoodFactsFetchLike,
  OpenFoodFactsProductResponse,
  OpenFoodFactsProviderOptions,
  OpenFoodFactsSearchInput,
  OpenFoodFactsSearchResponse
} from "./types.js";

export class OpenFoodFactsProvider {
  readonly apiBase: string;
  readonly searchApiBase: string;
  readonly userAgent: string;
  readonly fields: string[];
  private readonly fetchImpl: OpenFoodFactsFetchLike;

  constructor(options: OpenFoodFactsProviderOptions = {}) {
    this.apiBase = options.apiBase ?? OPENFOODFACTS_API_BASE;
    this.searchApiBase = options.searchApiBase ?? searchApiBaseFor(this.apiBase);
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.userAgent = options.userAgent ?? OPENFOODFACTS_DEFAULT_USER_AGENT;
    this.fields = options.fields ?? [...OPENFOODFACTS_DEFAULT_FIELDS];
  }

  async getJson<T>(path: string, params: Record<string, string>, apiBase = this.apiBase): Promise<T | undefined> {
    const url = new URL(`${apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.fetchImpl(url, { headers: { accept: "application/json", "user-agent": this.userAgent } });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenFoodFacts API returned ${response.status}: ${body}`);
    }
    return response.json() as Promise<T>;
  }

  async fetchProductSourceRecord(input: FetchOpenFoodFactsProductInput): Promise<SourceRecord | undefined> {
    return fetchOpenFoodFactsProductSourceRecord(this, input);
  }

  async fetchProduct(input: FetchOpenFoodFactsProductInput): Promise<ZuuidData | undefined> {
    const source = await this.fetchProductSourceRecord(input);
    return source ? transformOpenFoodFactsProduct(source) : undefined;
  }

  async searchProductSourceRecords(input: OpenFoodFactsSearchInput): Promise<SearchResponse<SourceRecord>> {
    return searchOpenFoodFactsProductSourceRecords(this, input);
  }

  async searchProducts(input: OpenFoodFactsSearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
    return searchOpenFoodFactsProducts(this, input);
  }
}

export async function fetchOpenFoodFactsProductSourceRecord(provider: OpenFoodFactsProvider, input: FetchOpenFoodFactsProductInput): Promise<SourceRecord | undefined> {
  const id = productId(input.id);
  const payload = await provider.getJson<OpenFoodFactsProductResponse>(`/product/${id}.json`, {
    fields: provider.fields.join(",")
  });
  if (!payload || payload.status === 0 || !payload.product) return undefined;
  const product = objectPayload(payload.product as JsonValue);
  return createSourceRecord({ source: { provider: OPENFOODFACTS_PROVIDER, category: OPENFOODFACTS_PRODUCT_CATEGORY, externalId: id }, payload: product as JsonValue });
}

export async function searchOpenFoodFactsProductSourceRecords(provider: OpenFoodFactsProvider, input: OpenFoodFactsSearchInput): Promise<SearchResponse<SourceRecord>> {
  const payload = await searchPayload(provider, input);
  const products = productItems(payload);
  return {
    results: await Promise.all(products.map((product) => createSourceRecord({ source: { provider: OPENFOODFACTS_PROVIDER, category: OPENFOODFACTS_PRODUCT_CATEGORY, externalId: productCode(product) ?? "" }, payload: product as JsonValue }))),
    pagination: pagination(payload, products.length)
  };
}

export async function searchOpenFoodFactsProducts(provider: OpenFoodFactsProvider, input: OpenFoodFactsSearchInput): Promise<SearchResponse<ZuuidSearchResult>> {
  const payload = await searchPayload(provider, input);
  const results: ZuuidSearchResult[] = [];
  for (const product of productItems(payload)) {
    const externalId = productCode(product);
    const title = productTitle(product);
    if (!externalId || !title) continue;
    const zuuid = await providerZuuid({ provider: OPENFOODFACTS_PROVIDER, category: OPENFOODFACTS_PRODUCT_CATEGORY, externalId });
    results.push({
      id: zuuid,
      zuuid,
      category: OPENFOODFACTS_PRODUCT_CATEGORY,
      title,
      date: null,
      cover: stringField(product, "image_front_url") ?? stringField(product, "image_url") ?? null,
      rating: productRating(product),
      weight: null,
      relationType: null,
      attribute: stringField(product, "brands") ?? null,
      order: null,
      source: { source: OPENFOODFACTS_PROVIDER, category: OPENFOODFACTS_PRODUCT_CATEGORY, value: externalId }
    });
  }
  return { results, pagination: pagination(payload, productItems(payload).length) };
}

async function searchPayload(provider: OpenFoodFactsProvider, input: OpenFoodFactsSearchInput): Promise<OpenFoodFactsSearchResponse<JsonValue>> {
  const query = input.query.trim();
  if (!query) throw new Error("OpenFoodFacts search query must not be empty");
  return await provider.getJson<OpenFoodFactsSearchResponse<JsonValue>>("/search.pl", {
    search_terms: query,
    json: "1",
    page: String(input.page ?? 1),
    page_size: String(input.pageSize ?? 20),
    fields: (input.fields ?? provider.fields).join(",")
  }, provider.searchApiBase) ?? {};
}

function searchApiBaseFor(apiBase: string): string {
  if (apiBase === OPENFOODFACTS_API_BASE) return OPENFOODFACTS_SEARCH_API_BASE;
  const url = new URL(apiBase);
  url.pathname = "/cgi";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function productItems(payload: OpenFoodFactsSearchResponse<JsonValue>): Record<string, JsonValue>[] {
  return Array.isArray(payload.products) ? payload.products.filter(isObject) : [];
}

function pagination(payload: OpenFoodFactsSearchResponse<JsonValue>, fallbackCount: number) {
  const page = payload.page ?? 1;
  const pageSize = payload.page_size ?? fallbackCount;
  const total = payload.count ?? fallbackCount;
  return { page, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0, totalResults: total };
}

function productId(value: string | number): string {
  const id = String(value).trim();
  if (!/^\d+$/.test(id)) throw new Error(`OpenFoodFacts product id must be a barcode: ${value}`);
  return id;
}

function productCode(product: Record<string, JsonValue>): string | undefined {
  return stringField(product, "code") ?? stringField(product, "_id");
}

function productTitle(product: Record<string, JsonValue>): string | undefined {
  return stringField(product, "product_name") ?? stringField(product, "title") ?? stringField(product, "name");
}

function productRating(product: Record<string, JsonValue>): number | null {
  const grade = stringField(product, "nutriscore_grade")?.toLowerCase();
  if (!grade) return null;
  const scores: Record<string, number> = { a: 5, b: 4, c: 3, d: 2, e: 1 };
  if (scores[grade] !== undefined) return scores[grade];
  const numeric = Number(nestedString(product, ["nutriments", "nutriscore_score"]));
  return Number.isFinite(numeric) ? normalizeRating(numeric, -15, 40) ?? null : null;
}

function isObject(value: JsonValue): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
