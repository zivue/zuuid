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
