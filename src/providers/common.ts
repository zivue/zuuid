import { createZuuidData, type EntityRelation, type ZuuidData } from "../entity.js";
import { providerZuuid } from "../identity.js";
import { attachSourceMetadata, type SourceRecord } from "../source.js";
import type { JsonValue } from "../types.js";

export function objectPayload(value: JsonValue): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, JsonValue>) : {};
}

export function stringField(payload: Record<string, JsonValue>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function numberField(payload: Record<string, JsonValue>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function valueAsString(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    const joined = value.filter((item): item is string => typeof item === "string" && item.trim() !== "").join(", ");
    return joined || undefined;
  }
  return undefined;
}

export function nestedValue(payload: Record<string, JsonValue>, path: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = payload;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, JsonValue>)[key];
  }
  return current;
}

export function nestedString(payload: Record<string, JsonValue>, path: string[]): string | undefined {
  return valueAsString(nestedValue(payload, path));
}

export function arrayField(payload: Record<string, JsonValue>, key: string): JsonValue[] {
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

export function objectField(payload: Record<string, JsonValue>, key: string): Record<string, JsonValue> | undefined {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, JsonValue>) : undefined;
}

export function addDetail(data: ZuuidData, provider: string, key: string, value: JsonValue | undefined): void {
  const normalized = typeof value === "string" ? (value.trim() ? value : undefined) : value;
  if (normalized !== undefined) {
    data.details.push({ key, value: normalized, source: provider });
  }
}

export function addTag(data: ZuuidData, value: string | undefined): void {
  const tag = value?.trim().toLowerCase();
  if (tag && !data.tags.includes(tag)) {
    data.tags.push(tag);
  }
}

export function addAlias(
  data: ZuuidData,
  value: string | undefined,
  aliasType: string,
  isPrimary: boolean,
  source: string,
  language?: string
): void {
  const normalized = value?.trim();
  if (!normalized || data.aliases.some((alias) => alias.value === normalized && alias.aliasType === aliasType)) {
    return;
  }
  data.aliases.push({ value: normalized, aliasType, isPrimary, source, ...(language ? { language } : {}) });
}

export function addDescription(data: ZuuidData, provider: string, value: string | undefined, language?: string): void {
  const normalized = value?.trim();
  if (normalized) {
    data.descriptions.push({ value: normalized, source: provider, ...(language ? { language } : {}) });
  }
}

export function addMedia(
  data: ZuuidData,
  provider: string,
  url: string | undefined,
  mediaCategory: string,
  mediaType = "image",
  isPrimary = true
): void {
  const normalized = url?.trim();
  if (!normalized) {
    return;
  }
  if (isPrimary && !data.cover) {
    data.cover = normalized;
  }
  data.media.push({ url: normalized, mediaType, mediaCategory, isPrimary, source: provider });
}

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function datePrefix(value: string | undefined): string | undefined {
  const prefix = value?.trim().slice(0, 10);
  return prefix && /^\d{4}-\d{2}-\d{2}$/.test(prefix) ? prefix : undefined;
}

export function formatNumber(value: number): string {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export async function baseDataFromSource(
  source: SourceRecord,
  provider: string,
  category: string,
  publicCategory: string,
  externalId: string,
  primaryTitle: string
): Promise<ZuuidData> {
  const zuuid = await providerZuuid({ provider, category, externalId });
  return createZuuidData({ zuuid, category: publicCategory, primaryTitle });
}

export function finalizeData(data: ZuuidData, source: SourceRecord, confidence = 1.0): ZuuidData {
  return attachSourceMetadata(data, source, confidence);
}

export async function addRelation(
  data: ZuuidData,
  provider: string,
  category: string,
  externalId: string | undefined,
  relationType: string,
  title?: string,
  options: Partial<Omit<EntityRelation, "id" | "zuuid" | "relationType" | "direction" | "category" | "title">> = {}
): Promise<void> {
  const normalizedId = externalId?.trim();
  if (!normalizedId) {
    return;
  }
  const zuuid = await providerZuuid({ provider, category, externalId: normalizedId });
  data.relations.push({
    id: zuuid,
    zuuid,
    relationType,
    direction: "outgoing",
    title: title ?? "",
    category,
    date: null,
    cover: null,
    rating: null,
    weight: null,
    attribute: null,
    order: null,
    source: provider,
    externalId: normalizedId,
    ...options
  });
}
