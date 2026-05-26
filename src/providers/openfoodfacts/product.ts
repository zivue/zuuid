import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDetail, addMedia, addTag, arrayField, baseDataFromSource, finalizeData, objectPayload, stringField, valueAsString } from "../common.js";
import type { JsonValue } from "../../types.js";
import { OPENFOODFACTS_PRODUCT_CATEGORY, OPENFOODFACTS_PROVIDER } from "./constants.js";

export async function transformOpenFoodFactsProduct(source: SourceRecord): Promise<ZuuidData> {
  if (source.source.provider !== OPENFOODFACTS_PROVIDER || source.source.category !== OPENFOODFACTS_PRODUCT_CATEGORY) {
    throw new Error(`unsupported OpenFoodFacts source: ${source.source.provider}:${source.source.category}`);
  }
  const payload = objectPayload(source.payload);
  const id = source.source.externalId.trim() || stringField(payload, "code") || stringField(payload, "_id");
  const title = stringField(payload, "product_name") ?? stringField(payload, "title") ?? stringField(payload, "name");
  if (!id) throw new Error("missing required OpenFoodFacts product field: code");
  if (!title) throw new Error("missing required OpenFoodFacts product field: product_name");
  const data = await baseDataFromSource(source, OPENFOODFACTS_PROVIDER, OPENFOODFACTS_PRODUCT_CATEGORY, openFoodFactsPublicCategory(payload), id, title);
  addAlias(data, title, "title", true, OPENFOODFACTS_PROVIDER, "en");
  addMedia(data, OPENFOODFACTS_PROVIDER, stringField(payload, "image_front_url") ?? stringField(payload, "image_url"), "cover");
  for (const [jsonKey, detailKey] of [["brands", "brands"], ["quantity", "quantity"], ["serving_size", "serving_size"], ["ingredients_text", "ingredients_text"], ["nutriscore_grade", "nutriscore_grade"], ["ecoscore_grade", "ecoscore_grade"], ["allergens", "allergens"]] as const) addDetail(data, OPENFOODFACTS_PROVIDER, detailKey, stringField(payload, jsonKey));
  addStringListDetail(data, payload, "labels_tags", "labels");
  addStringListDetail(data, payload, "ingredients_analysis_tags", "ingredient_analysis");
  addDetail(data, OPENFOODFACTS_PROVIDER, "barcode", id);
  const nutriments = payload.nutriments && typeof payload.nutriments === "object" && !Array.isArray(payload.nutriments) ? payload.nutriments as Record<string, JsonValue> : {};
  for (const [jsonKey, detailKey] of [["energy-kcal_100g", "calories_100g"], ["fat_100g", "fat_100g"], ["proteins_100g", "protein_100g"], ["carbohydrates_100g", "carbs_100g"], ["sugars_100g", "sugar_100g"], ["fiber_100g", "fiber_100g"], ["salt_100g", "salt_100g"], ["sodium_100g", "sodium_100g"], ["energy-kj_100g", "energy_kj_100g"], ["saturated-fat_100g", "saturated_fat_100g"], ["nutriscore_score", "nutriscore_score"], ["nova-group", "nova_group"]] as const) addDetail(data, OPENFOODFACTS_PROVIDER, detailKey, valueAsString(nutriments[jsonKey]));
  addTag(data, data.category === OPENFOODFACTS_PRODUCT_CATEGORY ? "food" : data.category);
  for (const key of ["categories_tags", "countries_tags", "labels_tags", "ingredients_analysis_tags", "nova_groups_tags"]) for (const value of arrayField(payload, key)) if (typeof value === "string") addTag(data, cleanOpenFoodFactsTag(value));
  return finalizeData(data, source);
}

export function openFoodFactsPublicCategory(payload: Record<string, JsonValue>): string {
  const tags = [
    ...arrayField(payload, "categories_tags"),
    ...arrayField(payload, "labels_tags")
  ].filter((value): value is string => typeof value === "string").map((value) => cleanOpenFoodFactsTag(value));
  if (tags.some((tag) => ["beverages", "beverage", "drinks", "drink", "waters", "juices", "sodas", "soft-drinks"].includes(tag))) return "beverage";
  if (tags.some((tag) => ["dietary-supplements", "supplements", "vitamins"].includes(tag))) return "supplement";
  if (tags.some((tag) => ["meals", "prepared-meals", "ready-meals", "frozen-meals"].includes(tag))) return "meal";
  if (tags.some((tag) => ["foods", "food", "snacks", "dairies", "cheeses", "breads", "cereals", "confectioneries"].includes(tag))) return "food";
  return OPENFOODFACTS_PRODUCT_CATEGORY;
}

function addStringListDetail(data: ZuuidData, payload: Record<string, JsonValue>, payloadKey: string, detailKey: string): void {
  const values = arrayField(payload, payloadKey).filter((value): value is string => typeof value === "string").map(cleanOpenFoodFactsTag);
  if (values.length) addDetail(data, OPENFOODFACTS_PROVIDER, detailKey, values);
}

function cleanOpenFoodFactsTag(value: string): string {
  return value.trim().toLowerCase().split(":").at(-1)?.replace(/_/g, "-") ?? value.trim().toLowerCase();
}
