import type { DocumentId } from "../corpusData.js";
import type { ViewerTarget } from "../permalinks.js";

export const ANNOTATION_SCHEMA_VERSION = 1 as const;
export type AnnotationType = "bookmark" | "note";

export interface UserAnnotation {
  id: string;
  schemaVersion: typeof ANNOTATION_SCHEMA_VERSION;
  type: AnnotationType;
  target: ViewerTarget;
  documentId: DocumentId;
  numbering: string;
  title: string;
  label?: string;
  text?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnotationInput {
  type: AnnotationType;
  target: ViewerTarget;
  documentId: DocumentId;
  numbering: string;
  title: string;
  label?: string;
  text?: string;
}

export interface UpdateAnnotationPatch {
  label?: string;
  text?: string;
}

export interface AnnotationExport {
  schemaVersion: typeof ANNOTATION_SCHEMA_VERSION;
  exportedAt: string;
  annotations: UserAnnotation[];
}

export interface AnnotationImportResult {
  imported: number;
  ignored: number;
}

export interface AnnotationStore {
  listAnnotations(): Promise<UserAnnotation[]>;
  createAnnotation(input: CreateAnnotationInput): Promise<UserAnnotation>;
  updateAnnotation(id: string, patch: UpdateAnnotationPatch): Promise<UserAnnotation>;
  deleteAnnotation(id: string): Promise<void>;
  importAnnotations(value: unknown): Promise<AnnotationImportResult>;
  exportAnnotations(): Promise<AnnotationExport>;
}

export type AnnotationErrorCode = "UNAVAILABLE" | "BLOCKED" | "UPGRADE_FAILED" | "CORRUPT" | "WRITE_FAILED" | "CONFLICT" | "INVALID_DATA";

export class AnnotationStoreError extends Error {
  constructor(readonly code: AnnotationErrorCode) {
    const messages: Record<AnnotationErrorCode, string> = {
      UNAVAILABLE: "Le annotazioni locali non sono disponibili in questo browser.",
      BLOCKED: "Chiudi le altre schede del viewer e riprova per aggiornare le annotazioni.",
      UPGRADE_FAILED: "Aggiornamento dell’archivio annotazioni non riuscito. I dati esistenti non sono stati cancellati.",
      CORRUPT: "L’archivio annotazioni contiene dati non leggibili. I dati sono stati conservati.",
      WRITE_FAILED: "Salvataggio locale non riuscito. Mantieni aperta questa pagina e riprova.",
      CONFLICT: "L’annotazione non esiste più o collide con un segnalibro esistente.",
      INVALID_DATA: "I dati dell’annotazione non rispettano il formato supportato.",
    };
    super(messages[code]);
    this.name = "AnnotationStoreError";
  }
}
