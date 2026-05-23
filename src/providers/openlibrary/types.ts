export type OpenLibraryFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type OpenLibraryProviderOptions = {
  apiBase?: string;
  coverBaseUrl?: string | null;
  fetch?: OpenLibraryFetchLike;
};

export type OpenLibraryTransformOptions = {
  coverBaseUrl?: string | null;
};

export type OpenLibrarySearchInput = {
  query: string;
  page?: number;
  limit?: number;
  language?: string;
  fields?: string[];
};

export type OpenLibrarySearchResponse<T> = {
  start?: number;
  numFound?: number;
  num_found?: number;
  docs?: T[];
};
