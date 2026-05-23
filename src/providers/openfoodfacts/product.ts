import type { ZuuidData } from "../../entity.js";
import type { SourceRecord } from "../../source.js";
import { addAlias, addDetail, addMedia, addTag, arrayField, baseDataFromSource, finalizeData, objectPayload, stringField, valueAsString } from "../common.js";
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
  const data = await baseDataFromSource(source, OPENFOODFACTS_PROVIDER, OPENFOODFACTS_PRODUCT_CATEGORY, OPENFOODFACTS_PRODUCT_CATEGORY, id, title);
  addAlias(data, title, "title", true, OPENFOODFACTS_PROVIDER, "en");
  addMedia(data, OPENFOODFACTS_PROVIDER, stringField(payload, "image_front_url") ?? stringField(payload, "image_url"), "cover");
  for (const [jsonKey, detailKey] of [["brands", "brands"], ["quantity", "quantity"], ["serving_size", "serving_size"], ["ingredients_text", "ingredients_text"], ["nutriscore_grade", "nutriscore_grade"], ["ecoscore_grade", "ecoscore_grade"], ["allergens", "allergens"]] as const) addDetail(data, OPENFOODFACTS_PROVIDER, detailKey, stringField(payload, jsonKey));
  addDetail(data, OPENFOODFACTS_PROVIDER, "barcode", id);
  const nutriments = payload.nutriments && typeof payload.nutriments === "object" && !Array.isArray(payload.nutriments) ? payload.nutriments as Record<string, never> : {};
  for (const [jsonKey, detailKey] of [["energy-kcal_100g", "calories_100g"], ["fat_100g", "fat_100g"], ["proteins_100g", "protein_100g"], ["carbohydrates_100g", "carbs_100g"], ["sugars_100g", "sugars_100g"], ["fiber_100g", "fiber_100g"], ["salt_100g", "salt_100g"], ["sodium_100g", "sodium_100g"], ["energy-kj_100g", "energy_kj_100g"], ["saturated-fat_100g", "saturated_fat_100g"], ["nutriscore_score", "nutriscore_score"], ["nova-group", "nova_group"]] as const) addDetail(data, OPENFOODFACTS_PROVIDER, detailKey, valueAsString(nutriments[jsonKey]));
  addTag(data, "food");
  for (const key of ["categories_tags", "countries_tags"]) for (const value of arrayField(payload, key)) if (typeof value === "string") addTag(data, value.split(":").at(-1));
  return finalizeData(data, source);
}
