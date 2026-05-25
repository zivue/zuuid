export type ComicVineFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ComicVineProviderOptions = {
  apiKey: string;
  apiBase?: string;
  fetch?: ComicVineFetchLike;
  userAgent?: string;
};

export type FetchComicVineInput = {
  id: string | number;
};

export type ComicVineSearchInput = {
  query: string;
  limit?: number;
  offset?: number;
  fieldList?: string[];
};

export type ComicVineApiResponse<T> = {
  error?: string;
  limit?: number;
  offset?: number;
  number_of_page_results?: number;
  number_of_total_results?: number;
  status_code?: number;
  results?: T;
};
