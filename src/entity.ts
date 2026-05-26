import type { ExternalId, Provenance } from "./source.js";
import type { JsonValue } from "./types.js";
import { normalizeUuid } from "./uuid.js";

export type EntityKind = "consume" | "event" | "listen" | "people" | "play" | "read" | "visit" | "watch" | string;

export type CategoryInfo = {
  category: string;
  kind: EntityKind;
};

export type Alias = {
  value: string;
  language?: string;
  region?: string;
  aliasType: string;
  isPrimary: boolean;
  source?: string;
};

export type Description = {
  language?: string;
  region?: string;
  value: string;
  source?: string;
};

export type Detail = {
  key: string;
  value: JsonValue;
  source?: string;
};

export type MediaAsset = {
  url: string;
  mediaType: string;
  mediaCategory: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
  data?: JsonValue;
  source?: string;
};

export type RelationKind =
  | "appears_in"
  | "authored_by"
  | "based_on"
  | "contains"
  | "duplicate_of"
  | "mentions"
  | "part_of"
  | "performed_by"
  | "published_by"
  | "related_to"
  | "same_as"
  | "source_of"
  | string;

export type RecommendationKind = "similar" | "related" | "same_creator" | "same_series" | "same_topic" | string;

export type ZuuidData = {
  zuuid: string;
  kind: EntityKind;
  category: string;
  primaryTitle: string;
  primaryDate?: string;
  rating?: number;
  cover?: string;
  aliases: Alias[];
  descriptions: Description[];
  details: Detail[];
  media: MediaAsset[];
  relations: EntityRelation[];
  recommendations: RecommendationEdge[];
  tags: string[];
  externalIds: ExternalId[];
  provenance: Provenance[];
};

export type ZuuidListItem = {
  id: string;
  zuuid: string;
  category: string;
  title: string;
  date: string | null;
  cover: string | null;
  rating: number | null;
  weight: number | null;
  relationType: string | null;
  attribute: string | null;
  order: number | null;
};

export type EntityRelation = ZuuidListItem & {
  relationType: RelationKind;
  direction: "outgoing" | "incoming" | "symmetric";
  source?: string;
  externalId?: string;
  confidence?: number;
  data?: JsonValue;
};

export type RecommendationEdge = ZuuidListItem & {
  recommendationType: RecommendationKind;
  relationType: RecommendationKind;
  source?: string;
  externalId?: string;
  reasons: string[];
};

export type ZuuidSearchResult = ZuuidListItem & {
  kind: EntityKind;
  source: ExternalId;
};

export type SearchPagination = {
  page: number;
  totalPages: number;
  totalResults: number;
};

export type SearchResponse<T> = {
  results: T[];
  pagination: SearchPagination;
};

export type CreateZuuidDataInput = {
  zuuid: string;
  category: string;
  primaryTitle: string;
};

export function createZuuidData(input: CreateZuuidDataInput): ZuuidData {
  const zuuid = normalizeUuid(input.zuuid);
  const category = categoryFor(input.category);

  return createZuuidDataFromParts(zuuid, category, input.primaryTitle);
}

export function createZuuidDataFromParts(zuuid: string, category: CategoryInfo, primaryTitle: string): ZuuidData {
  return {
    zuuid: normalizeUuid(zuuid),
    kind: category.kind,
    category: category.category,
    primaryTitle,
    aliases: [],
    descriptions: [],
    details: [],
    media: [],
    relations: [],
    recommendations: [],
    tags: [],
    externalIds: [],
    provenance: []
  };
}

export function categoryFor(value: string): CategoryInfo {
  const normalized = normalizeKeyPart(value);
  return {
    category: normalized,
    kind: kindForCategory(normalized),
  };
}

export function kindForCategory(category: string): EntityKind {
  switch (normalizeKeyPart(category)) {
    case "movie":
    case "film":
    case "tv":
    case "tvshow":
    case "tv_show":
    case "tvseason":
    case "tv_season":
    case "series":
    case "anime":
    case "documentary":
    case "video":
      return "watch";
    case "album":
    case "music":
    case "musicalbum":
    case "release":
    case "release-group":
    case "release_group":
    case "master":
    case "track":
    case "recording":
    case "musical_work":
    case "podcast":
    case "podcast_episode":
    case "audiobook":
      return "listen";
    case "book":
    case "work":
    case "article":
    case "web_page":
    case "comic":
    case "issue":
    case "story_arc":
    case "manga":
    case "magazine":
    case "paper":
    case "blog_post":
      return "read";
    case "game":
    case "videogame":
    case "boardgame":
    case "platform":
    case "equipment":
      return "play";
    case "place":
    case "location":
    case "venue":
    case "place":
    case "restaurant":
    case "route":
    case "city":
    case "country":
      return "visit";
    case "product":
    case "food":
    case "drink":
    case "beverage":
    case "meal":
    case "recipe":
    case "supplement":
      return "consume";
    case "event":
    case "concert":
    case "screening":
    case "exhibition":
    case "match":
    case "festival":
      return "event";
    case "person":
    case "people":
    case "artist":
    case "label":
    case "author":
    case "actor":
    case "creator":
    case "organization":
    case "company":
    case "team":
      return "people";
    default:
      return normalizeKeyPart(category);
  }
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}
