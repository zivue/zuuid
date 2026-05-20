import assert from "node:assert/strict";
import { test } from "node:test";
import {
  categoryFor,
  createEntityRecord,
  entityRecordKey,
  kindForCategory,
  providerNamespace,
  providerZuuid
} from "../dist/index.js";

test("providerZuuid matches the Rust provider-stable UUID v5 generation", async () => {
  assert.equal(
    await providerZuuid({ provider: "tmdb", category: "movie", externalId: "550" }),
    "1706d641-d381-5618-9425-d8cd8b35f898"
  );
});

test("providerZuuid normalizes category but preserves external id text", async () => {
  assert.equal(
    await providerZuuid({ provider: "tmdb", category: " Movie ", externalId: "550" }),
    await providerZuuid({ provider: "tmdb", category: "movie", externalId: "550" })
  );
});

test("providerNamespace exposes known Zuuid namespaces", () => {
  assert.equal(providerNamespace("tmdb"), "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  assert.equal(providerNamespace("unknown"), undefined);
});

test("createEntityRecord returns the canonical Zuuid entity record shell", () => {
  const record = createEntityRecord({
    zuuid: "1706d641-d381-5618-9425-d8cd8b35f898",
    category: "movie",
    primaryTitle: "Fight Club"
  });

  assert.equal(record.zuuid, "1706d641-d381-5618-9425-d8cd8b35f898");
  assert.deepEqual(record.public.category, { kind: "watch", value: "movie" });
  assert.equal(record.public.primaryTitle, "Fight Club");
  assert.deepEqual(record.public.externalIds, []);
  assert.deepEqual(record.internal.sourcePayloads, []);
  assert.deepEqual(record.record, { schemaVersion: 1, version: 1 });
});

test("entityRecordKey matches the sharded object key used by zuuid-store", () => {
  assert.equal(
    entityRecordKey("1706d641-d381-5618-9425-d8cd8b35f898"),
    "entities/17/06/1706d641-d381-5618-9425-d8cd8b35f898.json"
  );
});

test("categoryFor and kindForCategory match core category grouping", () => {
  assert.deepEqual(categoryFor(" Movie "), { kind: "watch", value: "movie" });
  assert.equal(kindForCategory("book"), "read");
  assert.equal(kindForCategory("restaurant"), "visit");
  assert.equal(kindForCategory("collection"), "collection");
});
