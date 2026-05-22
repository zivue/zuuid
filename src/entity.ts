import type { ExternalId, Provenance } from "./source.js";
import type { JsonValue } from "./types.js";
import { normalizeUuid } from "./uuid.js";

export type EntityKind = "event" | "listen" | "people" | "play" | "read" | "visit" | "watch" | string;

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
  value: string;
  data?: JsonValue;
  source?: string;
};

export type MediaAsset = {
  url: string;
  mediaType: string;
  mediaCategory: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
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

export type EntityRelation = {
  relatedZuuid: string;
  relationType: RelationKind;
  direction: "outgoing" | "incoming" | "symmetric";
  relatedTitle?: string;
  relatedCategory?: string;
  source?: string;
  externalId?: string;
  attribute?: string;
  confidence?: number;
  order?: number;
};

export type RecommendationKind = "similar" | "related" | "same_creator" | "same_series" | "same_topic" | string;

export type RecommendationEdge = {
  targetZuuid: string;
  recommendationType: RecommendationKind;
  score: number;
  source?: string;
  targetTitle?: string;
  targetCategory?: string;
  targetCover?: string;
  targetDate?: string;
  externalId?: string;
  reasons: string[];
};

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
    case "master":
    case "track":
    case "recording":
    case "podcast":
    case "podcast_episode":
    case "audiobook":
      return "listen";
    case "book":
    case "work":
    case "article":
    case "web_page":
    case "comic":
    case "manga":
    case "paper":
    case "blog_post":
      return "read";
    case "game":
    case "videogame":
    case "boardgame":
    case "platform":
      return "play";
    case "place":
    case "location":
    case "venue":
    case "restaurant":
    case "route":
    case "city":
    case "country":
      return "visit";
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
