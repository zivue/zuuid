export type OpenStreetMapFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type OpenStreetMapProviderOptions = {
  apiBase?: string;
  fetch?: OpenStreetMapFetchLike;
  userAgent?: string;
  language?: string;
};

export type FetchOpenStreetMapInput = {
  id: string | number;
};

export type OpenStreetMapSearchInput = {
  query: string;
  limit?: number;
  language?: string;
};
