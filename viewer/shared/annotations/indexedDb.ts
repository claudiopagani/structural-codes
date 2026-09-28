import { createAnnotationExport, readAnnotationExport } from "./exportImport.js";
import { annotationTargetKey, readAnnotation, readCreateAnnotation, readUpdatePatch, sameAnnotationContent } from "./schema.js";
import { ANNOTATION_SCHEMA_VERSION, AnnotationStoreError, type AnnotationImportResult, type AnnotationStore, type CreateAnnotationInput, type UpdateAnnotationPatch, type UserAnnotation } from "./types.js";

const DATABASE_VERSION = 1;
const STORE = "annotations";

type StoredAnnotation = UserAnnotation & { bookmarkTargetKey?: string };

function storedValue(annotation: UserAnnotation): StoredAnnotation {
  return { ...annotation, ...(annotation.type === "bookmark" ? { bookmarkTargetKey: annotationTargetKey(annotation.target) } : {}) };
}

function publicValue(value: unknown): UserAnnotation {
  if (!value || typeof value !== "object") throw new AnnotationStoreError("CORRUPT");
  const annotation: Partial<StoredAnnotation> = { ...(value as StoredAnnotation) };
  delete annotation.bookmarkTargetKey;
  try { return readAnnotation(annotation); }
  catch { throw new AnnotationStoreError("CORRUPT"); }
}

/** Browser-local adapter. Components depend only on AnnotationStore, so a remote adapter can replace it later. */
export class IndexedDbAnnotationStore implements AnnotationStore {
  private opening?: Promise<IDBDatabase>;
  constructor(private readonly options: { name?: string; indexedDB?: IDBFactory; now?: () => Date; id?: () => string } = {}) {}

  private open(): Promise<IDBDatabase> {
    if (this.opening) return this.opening;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let factory: IDBFactory | undefined;
      try { factory = this.options.indexedDB ?? globalThis.indexedDB; } catch { /* Browser storage policy. */ }
      if (!factory) { reject(new AnnotationStoreError("UNAVAILABLE")); return; }
      let request: IDBOpenDBRequest;
      try { request = factory.open(this.options.name ?? "structural-codes-annotations", DATABASE_VERSION); }
      catch { reject(new AnnotationStoreError("UNAVAILABLE")); return; }
      let failed = false;
      let upgradeFailed = false;
      request.onblocked = () => { failed = true; reject(new AnnotationStoreError("BLOCKED")); };
      request.onupgradeneeded = (event) => {
        const db = request.result;
        try {
          if (event.oldVersion !== 0) { upgradeFailed = true; request.transaction?.abort(); return; }
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("bookmarkTargetKey", "bookmarkTargetKey", { unique: true });
        } catch { upgradeFailed = true; request.transaction?.abort(); }
      };
      request.onerror = () => { failed = true; reject(new AnnotationStoreError(upgradeFailed || request.error?.name === "VersionError" ? "UPGRADE_FAILED" : "UNAVAILABLE")); };
      request.onsuccess = () => {
        const db = request.result;
        if (failed) { db.close(); return; }
        if (!db.objectStoreNames.contains(STORE)) { db.close(); reject(new AnnotationStoreError("CORRUPT")); return; }
        db.onversionchange = () => { db.close(); this.opening = undefined; };
        db.onclose = () => { this.opening = undefined; };
        resolve(db);
      };
    });
    this.opening = opening;
    void opening.catch(() => { if (this.opening === opening) this.opening = undefined; });
    return opening;
  }

  async close(): Promise<void> { const db = await this.opening; db?.close(); this.opening = undefined; }

  private async transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, done: (value: T) => void, guard: (callback: () => void) => () => void) => void): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(STORE, mode); } catch { reject(new AnnotationStoreError("UNAVAILABLE")); return; }
      let result: T;
      let failure: AnnotationStoreError | undefined;
      const guard = (callback: () => void) => () => {
        try { callback(); }
        catch (error) { failure = error instanceof AnnotationStoreError ? error : new AnnotationStoreError(mode === "readonly" ? "CORRUPT" : "WRITE_FAILED"); tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? new AnnotationStoreError(mode === "readonly" ? "CORRUPT" : "WRITE_FAILED"));
      tx.onerror = () => { if (!failure && tx.error?.name === "ConstraintError") failure = new AnnotationStoreError("CONFLICT"); };
      guard(() => work(tx.objectStore(STORE), (value) => { result = value; }, guard))();
    });
  }

  listAnnotations(): Promise<UserAnnotation[]> {
    return this.transaction("readonly", (store, done, guard) => {
      const request = store.getAll();
      request.onsuccess = guard(() => done(request.result.map(publicValue).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))));
    });
  }

  createAnnotation(input: CreateAnnotationInput): Promise<UserAnnotation> {
    const clean = readCreateAnnotation(structuredClone(input));
    return this.transaction("readwrite", (store, done, guard) => {
      const save = () => {
        const now = (this.options.now?.() ?? new Date()).toISOString();
        const annotation = readAnnotation({ ...clean, id: this.options.id?.() ?? crypto.randomUUID(), schemaVersion: ANNOTATION_SCHEMA_VERSION, createdAt: now, updatedAt: now });
        store.add(storedValue(annotation)); done(annotation);
      };
      if (clean.type !== "bookmark") { save(); return; }
      const duplicate = store.index("bookmarkTargetKey").get(annotationTargetKey(clean.target));
      duplicate.onsuccess = guard(() => duplicate.result ? done(publicValue(duplicate.result)) : save());
    });
  }

  updateAnnotation(id: string, patch: UpdateAnnotationPatch): Promise<UserAnnotation> {
    const clean = readUpdatePatch(structuredClone(patch));
    return this.transaction("readwrite", (store, done, guard) => {
      const request = store.get(id);
      request.onsuccess = guard(() => {
        if (!request.result) throw new AnnotationStoreError("CONFLICT");
        const previous = publicValue(request.result);
        if ((previous.type === "bookmark" && Object.hasOwn(clean, "text")) || (previous.type === "note" && Object.hasOwn(clean, "label"))) throw new AnnotationStoreError("INVALID_DATA");
        const now = this.options.now?.() ?? new Date();
        const updatedAt = new Date(Math.max(now.getTime(), Date.parse(previous.updatedAt) + 1)).toISOString();
        const next = readAnnotation({ ...previous, ...clean, updatedAt });
        store.put(storedValue(next)); done(next);
      });
    });
  }

  deleteAnnotation(id: string): Promise<void> {
    return this.transaction("readwrite", (store, done, guard) => {
      const request = store.get(id);
      request.onsuccess = guard(() => { if (!request.result) throw new AnnotationStoreError("CONFLICT"); store.delete(id); done(); });
    });
  }

  async exportAnnotations() { return createAnnotationExport(await this.listAnnotations(), this.options.now?.() ?? new Date()); }

  async importAnnotations(value: unknown): Promise<AnnotationImportResult> {
    const parsed = readAnnotationExport(value);
    return this.transaction("readwrite", (store, done, guard) => {
      const request = store.getAll();
      request.onsuccess = guard(() => {
        const existing = request.result.map(publicValue);
        const byId = new Map(existing.map((annotation) => [annotation.id, annotation]));
        const bookmarkKeys = new Set(existing.filter((annotation) => annotation.type === "bookmark").map((annotation) => annotationTargetKey(annotation.target)));
        let imported = 0;
        let ignored = parsed.ignored;
        for (const source of parsed.annotations) {
          const sameId = byId.get(source.id);
          if (sameId && sameAnnotationContent(sameId, source)) { ignored += 1; continue; }
          const bookmarkKey = source.type === "bookmark" ? annotationTargetKey(source.target) : null;
          if (bookmarkKey && bookmarkKeys.has(bookmarkKey)) { ignored += 1; continue; }
          let annotation = source;
          if (sameId) annotation = { ...source, id: this.options.id?.() ?? crypto.randomUUID() };
          while (byId.has(annotation.id)) annotation = { ...annotation, id: this.options.id?.() ?? crypto.randomUUID() };
          store.add(storedValue(annotation));
          byId.set(annotation.id, annotation);
          if (bookmarkKey) bookmarkKeys.add(bookmarkKey);
          imported += 1;
        }
        done({ imported, ignored });
      });
    });
  }
}
