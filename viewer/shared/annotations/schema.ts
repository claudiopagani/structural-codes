import type { DocumentId } from "../corpusData.js";
import type { ViewerTarget } from "../permalinks.js";
import { ANNOTATION_SCHEMA_VERSION, AnnotationStoreError, type CreateAnnotationInput, type UpdateAnnotationPatch, type UserAnnotation } from "./types.js";

const MAX_LABEL_LENGTH = 500;
const MAX_TEXT_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 1_000;
const MAX_ID_LENGTH = 256;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnnotationStoreError("INVALID_DATA");
  return value as Record<string, unknown>;
}

function string(value: unknown, maximum: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new AnnotationStoreError("INVALID_DATA");
  const normalized = value.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").trim();
  if ((!allowEmpty && !normalized) || normalized.length > maximum) throw new AnnotationStoreError("INVALID_DATA");
  return normalized;
}

function optionalString(value: unknown, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = string(value, maximum, true);
  return normalized || undefined;
}

function isoDate(value: unknown): string {
  const candidate = string(value, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(candidate) || !Number.isFinite(Date.parse(candidate))) throw new AnnotationStoreError("INVALID_DATA");
  return new Date(candidate).toISOString();
}

export function readViewerTarget(value: unknown): ViewerTarget {
  const source = object(value);
  const unitId = string(source.unitId, MAX_ID_LENGTH);
  if (source.kind === "unit") return { kind: "unit", unitId };
  if (source.kind === "block") return { kind: "block", unitId, blockId: string(source.blockId, MAX_ID_LENGTH) };
  if (source.kind === "asset") {
    const assetKind = source.assetKind;
    if (assetKind !== undefined && assetKind !== "formula" && assetKind !== "table" && assetKind !== "figure") throw new AnnotationStoreError("INVALID_DATA");
    return { kind: "asset", unitId, assetId: string(source.assetId, MAX_ID_LENGTH), ...(assetKind ? { assetKind } : {}) };
  }
  throw new AnnotationStoreError("INVALID_DATA");
}

function documentId(value: unknown): DocumentId {
  if (value !== "ntc2018" && value !== "circ2019") throw new AnnotationStoreError("INVALID_DATA");
  return value;
}

function assertFields(source: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(source).some((key) => !allowed.includes(key))) throw new AnnotationStoreError("INVALID_DATA");
}

export function readCreateAnnotation(value: unknown): CreateAnnotationInput {
  const source = object(value);
  assertFields(source, ["type", "target", "documentId", "numbering", "title", "label", "text"]);
  if (source.type !== "bookmark" && source.type !== "note") throw new AnnotationStoreError("INVALID_DATA");
  const result: CreateAnnotationInput = {
    type: source.type,
    target: readViewerTarget(source.target),
    documentId: documentId(source.documentId),
    numbering: string(source.numbering, 128),
    title: string(source.title, MAX_TITLE_LENGTH),
    label: optionalString(source.label, MAX_LABEL_LENGTH),
    text: optionalString(source.text, MAX_TEXT_LENGTH),
  };
  if (result.type === "bookmark" && result.text !== undefined) throw new AnnotationStoreError("INVALID_DATA");
  if (result.type === "note" && result.label !== undefined) throw new AnnotationStoreError("INVALID_DATA");
  return result;
}

export function readUpdatePatch(value: unknown): UpdateAnnotationPatch {
  const source = object(value);
  assertFields(source, ["label", "text"]);
  return {
    ...(Object.hasOwn(source, "label") ? { label: optionalString(source.label, MAX_LABEL_LENGTH) } : {}),
    ...(Object.hasOwn(source, "text") ? { text: optionalString(source.text, MAX_TEXT_LENGTH) } : {}),
  };
}

export function readAnnotation(value: unknown): UserAnnotation {
  const source = object(value);
  assertFields(source, ["id", "schemaVersion", "type", "target", "documentId", "numbering", "title", "label", "text", "createdAt", "updatedAt"]);
  if (source.schemaVersion !== ANNOTATION_SCHEMA_VERSION) throw new AnnotationStoreError("INVALID_DATA");
  const input = readCreateAnnotation({ type: source.type, target: source.target, documentId: source.documentId, numbering: source.numbering, title: source.title, label: source.label, text: source.text });
  const createdAt = isoDate(source.createdAt);
  const updatedAt = isoDate(source.updatedAt);
  if (updatedAt < createdAt) throw new AnnotationStoreError("INVALID_DATA");
  return { ...input, id: string(source.id, MAX_ID_LENGTH), schemaVersion: ANNOTATION_SCHEMA_VERSION, createdAt, updatedAt };
}

export function annotationTargetKey(target: ViewerTarget): string {
  if (target.kind === "unit") return `unit:${target.unitId}`;
  if (target.kind === "block") return `block:${target.unitId}:${target.blockId}`;
  return `asset:${target.unitId}:${target.assetId}`;
}

export function sameAnnotationContent(left: UserAnnotation, right: UserAnnotation): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
