import assert from "node:assert/strict";
import { test } from "node:test";

test("package root exports the public API", async () => {
  const root = await import("../dist/index.js");

  assert.equal(typeof root.createZuuidClient, "function");
  assert.equal(typeof root.providerZuuid, "function");
  assert.equal(typeof root.TmdbProvider, "function");
  assert.equal(typeof root.GamesDbProvider, "function");
  assert.equal(typeof root.MusicBrainzProvider, "function");
  assert.equal(typeof root.ImdbProvider, "function");
  assert.equal(typeof root.OpenLibraryProvider, "function");
  assert.equal(typeof root.transformOpenLibraryAuthor, "function");
  assert.equal(typeof root.transformOpenLibraryBook, "function");
  assert.equal(typeof root.transformTmdbMovie, "function");
  assert.equal(typeof root.transformTmdbTv, "function");
  assert.equal(typeof root.transformTmdbPerson, "function");
  assert.equal(typeof root.transformImdbMovie, "function");
  assert.equal(typeof root.transformImdbTv, "function");
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

test("musicbrainz provider subpath exports client and transformers", async () => {
  const musicbrainz = await import("../dist/providers/musicbrainz/index.js");

  assert.equal(typeof musicbrainz.MusicBrainzProvider, "function");
  assert.equal(typeof musicbrainz.transformMusicBrainzRelease, "function");
  assert.equal(typeof musicbrainz.transformMusicBrainzArtist, "function");
});

test("gamesdb provider subpath exports client and transformers", async () => {
  const gamesdb = await import("../dist/providers/gamesdb/index.js");

  assert.equal(typeof gamesdb.GamesDbProvider, "function");
  assert.equal(typeof gamesdb.transformGamesDbGame, "function");
  assert.equal(typeof gamesdb.transformGamesDbPlatform, "function");
});

test("imdb provider subpath exports title helpers", async () => {
  const imdb = await import("../dist/providers/imdb/index.js");

  assert.equal(typeof imdb.ImdbProvider, "function");
  assert.equal(typeof imdb.transformImdbMovie, "function");
  assert.equal(typeof imdb.transformImdbTv, "function");
});

test("openlibrary provider subpath exports book helpers", async () => {
  const openlibrary = await import("../dist/providers/openlibrary/index.js");

  assert.equal(typeof openlibrary.OpenLibraryProvider, "function");
  assert.equal(typeof openlibrary.transformOpenLibraryAuthor, "function");
  assert.equal(typeof openlibrary.searchOpenLibraryAuthors, "function");
  assert.equal(typeof openlibrary.transformOpenLibraryBook, "function");
  assert.equal(typeof openlibrary.searchOpenLibraryBooks, "function");
});

test("category subpaths are importable", async () => {
  const movie = await import("../dist/providers/tmdb/movie.js");
  const tv = await import("../dist/providers/tmdb/tv.js");
  const person = await import("../dist/providers/tmdb/person.js");
  const author = await import("../dist/providers/openlibrary/author.js");
  const book = await import("../dist/providers/openlibrary/book.js");
  const imdbMovie = await import("../dist/providers/imdb/movie.js");
  const gamesdbPlatform = await import("../dist/providers/gamesdb/platform.js");
  const musicbrainzClient = await import("../dist/providers/musicbrainz/client.js");

  assert.equal(typeof movie.transformTmdbMovie, "function");
  assert.equal(typeof movie.searchTmdbMovies, "function");
  assert.equal(typeof tv.transformTmdbTv, "function");
  assert.equal(typeof tv.searchTmdbTv, "function");
  assert.equal(typeof person.transformTmdbPerson, "function");
  assert.equal(typeof person.searchTmdbPeople, "function");
  assert.equal(typeof author.transformOpenLibraryAuthor, "function");
  assert.equal(typeof author.searchOpenLibraryAuthors, "function");
  assert.equal(typeof book.transformOpenLibraryBook, "function");
  assert.equal(typeof book.searchOpenLibraryBooks, "function");
  assert.equal(typeof imdbMovie.transformImdbMovie, "function");
  assert.equal(typeof gamesdbPlatform.transformGamesDbPlatform, "function");
  assert.equal(typeof musicbrainzClient.MusicBrainzProvider, "function");
});

test("package self-reference exports match npm entry points", async () => {
  const root = await import("@zivue/zuuid");
  const tmdb = await import("@zivue/zuuid/providers/tmdb");
  const movie = await import("@zivue/zuuid/providers/tmdb/movie");
  const tv = await import("@zivue/zuuid/providers/tmdb/tv");
  const person = await import("@zivue/zuuid/providers/tmdb/person");
  const gamesdb = await import("@zivue/zuuid/providers/gamesdb");
  const musicbrainz = await import("@zivue/zuuid/providers/musicbrainz");
  const imdb = await import("@zivue/zuuid/providers/imdb");
  const imdbMovie = await import("@zivue/zuuid/providers/imdb/movie");
  const openlibrary = await import("@zivue/zuuid/providers/openlibrary");
  const author = await import("@zivue/zuuid/providers/openlibrary/author");
  const book = await import("@zivue/zuuid/providers/openlibrary/book");

  assert.equal(typeof root.createZuuidClient, "function");
  assert.equal(typeof tmdb.TmdbProvider, "function");
  assert.equal(typeof gamesdb.GamesDbProvider, "function");
  assert.equal(typeof musicbrainz.MusicBrainzProvider, "function");
  assert.equal(typeof movie.transformTmdbMovie, "function");
  assert.equal(typeof tv.transformTmdbTv, "function");
  assert.equal(typeof person.transformTmdbPerson, "function");
  assert.equal(typeof openlibrary.OpenLibraryProvider, "function");
  assert.equal(typeof author.transformOpenLibraryAuthor, "function");
  assert.equal(typeof book.transformOpenLibraryBook, "function");
});
