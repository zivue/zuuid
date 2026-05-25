export type GamesDbFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type GamesDbProviderOptions = {
  apiKey: string;
  apiBase?: string;
  fetch?: GamesDbFetchLike;
  imageBaseUrl?: string | null;
};

export type GamesDbTransformOptions = {
  imageBaseUrl?: string | null;
};

export type FetchGamesDbGameInput = {
  id: string | number;
};

export type FetchGamesDbPlatformInput = {
  id: string | number;
};

export type GamesDbSearchInput = {
  query: string;
  page?: number;
};
