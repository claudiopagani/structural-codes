import { ANNOTATION_SCHEMA_VERSION, AnnotationStoreError, type AnnotationExport, type UserAnnotation } from "./types.js";
import { readAnnotation } from "./schema.js";

export function createAnnotationExport(annotations: UserAnnotation[], now = new Date()): AnnotationExport {
  return { schemaVersion: ANNOTATION_SCHEMA_VERSION, exportedAt: now.toISOString(), annotations: annotations.map((annotation) => structuredClone(annotation)) };
}

export function readAnnotationExport(value: unknown): { annotations: UserAnnotation[]; ignored: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnnotationStoreError("INVALID_DATA");
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== ANNOTATION_SCHEMA_VERSION || !Array.isArray(source.annotations)) throw new AnnotationStoreError("INVALID_DATA");
  if (Object.keys(source).some((key) => key !== "schemaVersion" && key !== "exportedAt" && key !== "annotations")) throw new AnnotationStoreError("INVALID_DATA");
  if (source.exportedAt !== undefined && (typeof source.exportedAt !== "string" || !Number.isFinite(Date.parse(source.exportedAt)))) throw new AnnotationStoreError("INVALID_DATA");
  const annotations: UserAnnotation[] = [];
  let ignored = 0;
  for (const item of source.annotations) {
    try { annotations.push(readAnnotation(item)); }
    catch (error) {
      if (!(error instanceof AnnotationStoreError)) throw error;
      ignored += 1;
    }
  }
  return { annotations, ignored };
}
