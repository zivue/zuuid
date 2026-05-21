import { stablePayloadHash } from "./hash.js";
import type { JsonValue } from "./types.js";
import type { ZuuidData } from "./entity.js";

export type SourceRecordRef = {
  provider: string;
  category: string;
  externalId: string;
};

export type ExternalId = {
  source: string;
  category: string;
  value: string;
};

export type Provenance = {
  source: SourceRecordRef;
  observedAt: string;
  confidence?: number;
  contentHash?: string;
};

export type SourceRecord = {
  source: SourceRecordRef;
  payload: JsonValue;
  contentHash: string;
  observedAt: string;
  publishedAt?: string;
};

export type CreateSourceRecordInput = {
  source: SourceRecordRef;
  payload: JsonValue;
  observedAt?: string | Date;
  publishedAt?: string | Date;
};

export async function createSourceRecord(input: CreateSourceRecordInput): Promise<SourceRecord> {
  return {
    source: {
      provider: input.source.provider,
      category: input.source.category,
      externalId: input.source.externalId
    },
    payload: input.payload,
    contentHash: await stablePayloadHash(input.payload),
    observedAt: normalizeTimestamp(input.observedAt ?? new Date()),
    publishedAt: input.publishedAt ? normalizeTimestamp(input.publishedAt) : undefined
  };
}

export function attachSourceMetadata(
  dataset: ZuuidData,
  sourceRecord: SourceRecord,
  confidence = 1.0
): ZuuidData {
  const next = structuredClone(dataset);
  const externalId = externalIdFromSource(sourceRecord.source);

  if (!next.externalIds.some((item) => sameExternalId(item, externalId))) {
    next.externalIds.push(externalId);
  }

  const provenance: Provenance = {
    source: sourceRecord.source,
    observedAt: sourceRecord.observedAt,
    confidence,
    contentHash: sourceRecord.contentHash
  };

  if (!next.provenance.some((item) => sameProvenance(item, provenance))) {
    next.provenance.push(provenance);
  }

  return next;
}

export function externalIdFromSource(source: SourceRecordRef): ExternalId {
  return {
    source: source.provider,
    category: source.category,
    value: source.externalId
  };
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function sameSourceRef(a: SourceRecordRef, b: SourceRecordRef): boolean {
  return a.provider === b.provider && a.category === b.category && a.externalId === b.externalId;
}

function sameExternalId(a: ExternalId, b: ExternalId): boolean {
  return a.source === b.source && a.category === b.category && a.value === b.value;
}

function sameProvenance(a: Provenance, b: Provenance): boolean {
  return (
    sameSourceRef(a.source, b.source) &&
    a.observedAt === b.observedAt &&
    a.confidence === b.confidence &&
    a.contentHash === b.contentHash
  );
}
