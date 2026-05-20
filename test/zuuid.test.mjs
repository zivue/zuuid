import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMediaDescriptor,
  createZuuid,
  createZuuidRecord,
  extensionFromMediaType,
  formatStorageKey,
  normalizeMediaType,
  parseZuuid
} from "../dist/index.js";

test("createZuuid returns a deterministic content-derived ID", async () => {
  const first = await createZuuid({ bytes: "hello", mediaType: "text/plain; charset=utf-8" });
  const second = await createZuuid({ bytes: new TextEncoder().encode("hello"), mediaType: "text/plain" });

  assert.equal(first, second);
  assert.equal(
    first,
    "zuuid:v1:text/plain:sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
  );
});

test("parseZuuid validates and parses package IDs", () => {
  assert.deepEqual(
    parseZuuid("zuuid:v1:image/jpeg:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    {
      version: 1,
      mediaType: "image/jpeg",
      algorithm: "sha256",
      digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  );

  assert.throws(() => parseZuuid("zuuid:v2:image/jpeg:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
});

test("formatStorageKey creates stable sharded keys", () => {
  const key = formatStorageKey({
    id: "zuuid:v1:image/jpeg:sha256:abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    extension: "jpg",
    prefix: "/media/uploads/",
    shardDepth: 3,
    shardSize: 2
  });

  assert.equal(
    key,
    "media/uploads/sha256/ab/cd/ef/zuuid-v1-image-jpeg-sha256-abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"
  );
});

test("createMediaDescriptor combines ID metadata and storage key", async () => {
  const descriptor = await createMediaDescriptor({
    bytes: "image-bytes",
    mediaType: "image/png",
    prefix: "media"
  });

  assert.equal(descriptor.mediaType, "image/png");
  assert.equal(descriptor.extension, "png");
  assert.equal(descriptor.byteLength, 11);
  assert.match(descriptor.storageKey, /^media\/sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/zuuid-v1-image-png-sha256-[a-f0-9]{64}\.png$/);
});

test("filename extension overrides media type extension", async () => {
  const descriptor = await createMediaDescriptor({
    bytes: "doc",
    mediaType: "application/octet-stream",
    filename: "archive.tar.gz"
  });

  assert.equal(descriptor.extension, "gz");
});

test("normalizes media types and maps common extensions", () => {
  assert.equal(normalizeMediaType("IMAGE/JPEG; charset=binary"), "image/jpeg");
  assert.equal(extensionFromMediaType("video/quicktime"), "mov");
});

test("createZuuidRecord returns a unified typed data structure", async () => {
  const first = await createZuuidRecord({
    type: "application/vnd.zivue.reaction+json",
    data: { rating: 5, title: "Heat", tags: ["movie", "favorite"] },
    meta: { source: "import" },
    links: { subject: "zuuid:v1:text/plain:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
  });
  const second = await createZuuidRecord({
    type: "application/vnd.zivue.reaction+json",
    data: { tags: ["movie", "favorite"], title: "Heat", rating: 5 }
  });

  assert.equal(first.id, second.id);
  assert.equal(first.type, "application/vnd.zivue.reaction+json");
  assert.equal(first.mediaType, "application/vnd.zivue.reaction+json");
  assert.deepEqual(first.data, { rating: 5, title: "Heat", tags: ["movie", "favorite"] });
  assert.deepEqual(first.meta, { source: "import" });
  assert.deepEqual(first.links, {
    subject: "zuuid:v1:text/plain:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  });
});
