import assert from "node:assert/strict";
import { test } from "node:test";

test("package root exports the public API", async () => {
  const root = await import("../dist/index.js");

  assert.equal(typeof root.createZuuidClient, "function");
  assert.equal(typeof root.providerZuuid, "function");
  assert.equal(typeof root.TmdbProvider, "function");
  assert.equal(typeof root.transformTmdbMovie, "function");
  assert.equal(typeof root.transformTmdbTv, "function");
  assert.equal(typeof root.transformTmdbPerson, "function");
});

test("tmdb provider subpath exports category helpers", async () => {
  const tmdb = await import("../dist/providers/tmdb/index.js");

  assert.equal(typeof tmdb.TmdbProvider, "function");
  assert.equal(typeof tmdb.transformTmdbMovie, "function");
  assert.equal(typeof tmdb.transformTmdbTv, "function");
  assert.equal(typeof tmdb.transformTmdbPerson, "function");
  assert.equal(typeof tmdb.searchTmdbMovies, "function");
  assert.equal(typeof tmdb.searchTmdbTv, "function");
  assert.equal(typeof tmdb.searchTmdbPeople, "function");
});

test("category subpaths are importable", async () => {
  const movie = await import("../dist/providers/tmdb/movie.js");
  const tv = await import("../dist/providers/tmdb/tv.js");
  const person = await import("../dist/providers/tmdb/person.js");

  assert.equal(typeof movie.transformTmdbMovie, "function");
  assert.equal(typeof movie.searchTmdbMovies, "function");
  assert.equal(typeof tv.transformTmdbTv, "function");
  assert.equal(typeof tv.searchTmdbTv, "function");
  assert.equal(typeof person.transformTmdbPerson, "function");
  assert.equal(typeof person.searchTmdbPeople, "function");
});

test("package self-reference exports match npm entry points", async () => {
  const root = await import("@zivue/zuuid");
  const tmdb = await import("@zivue/zuuid/providers/tmdb");
  const movie = await import("@zivue/zuuid/providers/tmdb/movie");
  const tv = await import("@zivue/zuuid/providers/tmdb/tv");
  const person = await import("@zivue/zuuid/providers/tmdb/person");

  assert.equal(typeof root.createZuuidClient, "function");
  assert.equal(typeof tmdb.TmdbProvider, "function");
  assert.equal(typeof movie.transformTmdbMovie, "function");
  assert.equal(typeof tv.transformTmdbTv, "function");
  assert.equal(typeof person.transformTmdbPerson, "function");
});
