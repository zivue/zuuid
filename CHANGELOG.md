# Changelog

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
