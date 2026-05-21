import type { ExternalId, Provenance } from "./source.js";
import { normalizeUuid } from "./uuid.js";

export type EntityKind = "event" | "listen" | "people" | "play" | "read" | "visit" | "watch" | string;

export type EntityCategory = {
  kind: EntityKind;
  value: string;
};

export type Alias = {
  value: string;
  language?: string;
  aliasType: string;
  isPrimary: boolean;
};

export type Description = {
  language?: string;
  value: string;
  source?: string;
};

export type Detail = {
  key: string;
  value: string;
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
  reasons: string[];
};

export type ZuuidData = {
  zuuid: string;
  kind: EntityKind;
  category: EntityCategory;
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
  category: string | EntityCategory;
  primaryTitle: string;
};

export function createZuuidData(input: CreateZuuidDataInput): ZuuidData {
  const zuuid = normalizeUuid(input.zuuid);
  const category = typeof input.category === "string" ? categoryFor(input.category) : input.category;

  return createZuuidDataFromParts(zuuid, category, input.primaryTitle);
}

export function createZuuidDataFromParts(zuuid: string, category: EntityCategory, primaryTitle: string): ZuuidData {
  return {
    zuuid: normalizeUuid(zuuid),
    kind: category.kind,
    category,
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

export function categoryFor(value: string): EntityCategory {
  const normalized = normalizeKeyPart(value);
  return {
    kind: kindForCategory(normalized),
    value: normalized
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
