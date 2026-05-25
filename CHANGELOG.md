# Changelog

## 0.2.5 - 2026-05-25

- Added live OpenStreetMap/Nominatim lookup and search support for cities, countries, places, and venues.
- Added `OpenStreetMapProvider`, `visit.openstreetmap` client facades, city/country subpath exports, examples, and README documentation.

## 0.2.4 - 2026-05-25

- Added live ComicVine API support for volumes, issues, story arcs, characters, people, and publishers.
- Added `ComicVineProvider`, ComicVine fetch/search helpers, category-first client facades, examples, and `providers/comicvine/client` export.

## 0.2.3 - 2026-05-25

- Added live MusicBrainz lookup/search support for releases, release groups, recordings, artists, labels, and works.
- Added MusicBrainz category-first client facades under `listen.musicbrainz` and `people.musicbrainz`, plus a `providers/musicbrainz/client` subpath export.
- Added MusicBrainz fetch/search examples and README usage documentation.
- Added an IMDb suggestion-data fallback for challenge pages so known title IDs still resolve core metadata such as title, year, poster, type, rank, and cast summary.

## 0.2.2 - 2026-05-25

- Added IMDb fetch-by-ID scraper support for movie and TV title pages.
- Added GamesDB live game search/fetch, platform fetch, `play.gamesdb` client support, and native API envelope/image handling.
- Removed hardcoded fixture payloads from the fetch example; examples now cover live fetch-capable providers only.
- Removed duplicate transformed TMDB TV `content_ratings` details while keeping normalized `certifications`.
- Added `AGENTS.md` guidance for AI coding agents working in this repository.

## 0.2.1 - 2026-05-24

- Normalized provider ratings to a shared `0-5` scale while preserving native provider scores in `provider_rating` details.
- Trimmed TMDB movie certification details and stopped emitting full `release_dates` detail payloads.
- Added README documentation for raw source records, transformed output, transformer-only providers, and normalized ratings.

## 0.2.0 - 2026-05-24

- Added Open Library provider support for books and authors.
- Added transformer providers for ComicVine, GamesDB, Jikan, MusicBrainz, OpenFoodFacts, OpenStreetMap, podcast, Setlist.fm, Ticketmaster, and Wger.
- Added category subpath exports for new provider transformers.
- Added MusicBrainz transformers for releases, release groups, recordings, artists, labels, and works.
- Added fixture-backed fetch examples for transformer-only providers.
- Expanded category grouping for additional read, listen, play, visit, and people entity categories.

## 0.1.0 - 2026-05-23

- Added provider-stable ZUUID generation using UUID v5.
- Added flat `ZuuidData` model with source metadata and provenance.
- Added shared lightweight list item shape for search results, relations, and recommendations.
- Added TMDB provider support for movies, TV shows, and people.
- Added TMDB fetch, raw source-record fetch, transform, unified search, and raw search APIs.
- Added TMDB fetch and search CLI examples for local testing.
