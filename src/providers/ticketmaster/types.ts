export type TicketmasterFetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type TicketmasterProviderOptions = {
  apiKey: string;
  apiBase?: string;
  fetch?: TicketmasterFetchLike;
};

export type FetchTicketmasterEventInput = {
  id: string;
};

export type TicketmasterSearchInput = {
  query: string;
  page?: number;
  pageSize?: number;
  countryCode?: string;
};
