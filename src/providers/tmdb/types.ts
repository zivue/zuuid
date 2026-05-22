export type TmdbCredential =
  | { apiKey: string; bearerToken?: never }
  | { apiKey?: never; bearerToken: string };

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type TmdbProviderOptions = TmdbCredential & {
  apiBase?: string;
  fetch?: FetchLike;
  posterBaseUrl?: string | null;
  backdropBaseUrl?: string | null;
  language?: string;
};

export type TmdbTransformOptions = {
  posterBaseUrl?: string | null;
  backdropBaseUrl?: string | null;
};

export type TmdbSearchInput = {
  query: string;
  page?: number;
  includeAdult?: boolean;
  language?: string;
  region?: string;
  year?: number;
  primaryReleaseYear?: number;
  firstAirDateYear?: number;
};

export type TmdbSearchResponse<T> = {
  page?: number;
  results?: T[];
  total_pages?: number;
  total_results?: number;
};
