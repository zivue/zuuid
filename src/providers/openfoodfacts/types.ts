export type OpenFoodFactsFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type OpenFoodFactsProviderOptions = {
  apiBase?: string;
  fetch?: OpenFoodFactsFetchLike;
  userAgent?: string;
  fields?: string[];
};

export type FetchOpenFoodFactsProductInput = {
  id: string | number;
};

export type OpenFoodFactsSearchInput = {
  query: string;
  page?: number;
  pageSize?: number;
  fields?: string[];
};

export type OpenFoodFactsProductResponse = {
  code?: string;
  status?: number;
  status_verbose?: string;
  product?: unknown;
};

export type OpenFoodFactsSearchResponse<T> = {
  count?: number;
  page?: number;
  page_count?: number;
  page_size?: number;
  products?: T[];
};
