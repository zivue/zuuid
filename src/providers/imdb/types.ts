export type ImdbFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ImdbProviderOptions = {
  fetch?: ImdbFetchLike;
  titleBaseUrl?: string | null;
  userAgent?: string;
};

export type ImdbTransformOptions = {
  titleBaseUrl?: string | null;
};
