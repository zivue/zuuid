# 0001: First-class entity links

Status: Accepted

Date: 2026-09-27

## Context

Zuuid originally placed navigable provider URLs in `details`. That was convenient because details accept arbitrary JSON, but it required every consumer to recognize provider-specific keys such as `homepage`, `spotify`, `instagram`, and `wikidata`. It also mixed factual metadata with actions a user can open.

`externalIds` cannot replace links: identifiers are stable identity data and are not always URLs. API navigation links such as `self` and `web` also remain outside the entity because they describe the API resource rather than the represented item.

## Decision

Normalized entities have a top-level `links` collection. A link contains a URL, a semantic relation, and optional service, label, locale, and provenance fields.

Relations describe intent rather than UI placement. Initial relations include `official`, `social`, `streaming`, `events`, and `reference`. Service names such as `youtube`, `youtube_music`, `spotify`, or `wikipedia` remain independent from those relations.

Provider transformers validate HTTP(S) URLs and retain the provider as the link source. Provider-specific identifiers continue to be stored in `externalIds`.

Cross-provider enrichment remains explicit. The shared package exposes reusable enrichment functions, while a service such as `zuuid-api` decides when to invoke them and how long to persist the result. Individual provider clients do not silently contact unrelated providers.

## Compatibility

During the initial 0.2 transition, `links` is optional at the type boundary even though constructors always initialize it, and existing provider link details are still emitted. Consumers should prefer `links` and fall back to legacy details while stored snapshots and downstream applications migrate. Older persisted entities without `links` must be read as if they contained an empty collection. A later schema-major release can make the collection required and remove the duplicated details.

## Consequences

- Consumers no longer need to infer link semantics from detail keys.
- YouTube and YouTube Music can be represented separately while sharing a recognizable service family.
- Link presentation can be grouped consistently across providers.
- There is a temporary period of duplicated URLs in `links` and `details`.
