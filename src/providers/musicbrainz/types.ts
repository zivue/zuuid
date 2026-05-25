export type MusicBrainzFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type MusicBrainzProviderOptions = {
  apiBase?: string;
  fetch?: MusicBrainzFetchLike;
  userAgent?: string;
  coverArtBaseUrl?: string | null;
  releaseGroupCoverArtBaseUrl?: string | null;
};

export type MusicBrainzProviderTransformOptions = {
  coverArtBaseUrl?: string | null;
  releaseGroupCoverArtBaseUrl?: string | null;
};

export type FetchMusicBrainzInput = {
  id: string;
};

export type MusicBrainzSearchInput = {
  query: string;
  limit?: number;
  offset?: number;
};
