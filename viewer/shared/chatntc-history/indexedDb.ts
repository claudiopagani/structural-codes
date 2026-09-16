import { migrateConversationV1, readConversation } from "./schema.js";
import { ChatHistoryError, type ChatConversation, type ChatConversationSummary, type ChatHistoryStore } from "./types.js";

const DATABASE_VERSION = 2;
const STORES = ["conversations", "state"];
function stored(value: unknown): ChatConversation {
  try { return readConversation(value); } catch { throw new ChatHistoryError("CORRUPT"); }
}
const summary = ({ messages, ...conversation }: ChatConversation): ChatConversationSummary => ({ ...conversation, messageCount: messages.length });

/** Opt-in and lazy: importing or constructing this adapter does not open a database. */
export class IndexedDbChatHistoryStore implements ChatHistoryStore {
  private opening?: Promise<IDBDatabase>;
  constructor(private readonly options: {
    name?: string; indexedDB?: IDBFactory; now?: () => Date; id?: () => string;
  } = {}) {}

  private open(): Promise<IDBDatabase> {
    if (this.opening) return this.opening;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let factory: IDBFactory | undefined;
      try { factory = this.options.indexedDB ?? globalThis.indexedDB; } catch { /* Browser storage policy. */ }
      if (!factory) { reject(new ChatHistoryError("UNAVAILABLE")); return; }
      let request: IDBOpenDBRequest;
      try { request = factory.open(this.options.name ?? "structural-codes-chatntc", DATABASE_VERSION); }
      catch { reject(new ChatHistoryError("UNAVAILABLE")); return; }
      let failed = false;
      let upgradeFailed = false;
      request.onblocked = () => { failed = true; reject(new ChatHistoryError("BLOCKED")); };
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction!;
        const abort = () => { upgradeFailed = true; tx.abort(); };
        if (failed) { abort(); return; }
        try {
          if (event.oldVersion === 0) {
            db.createObjectStore("conversations", { keyPath: "id" }).createIndex("updatedAt", "updatedAt");
            db.createObjectStore("state");
          } else if (event.oldVersion === 1) {
            if (!STORES.every((name) => db.objectStoreNames.contains(name))) { abort(); return; }
            const conversations = tx.objectStore("conversations");
            if (!conversations.indexNames.contains("updatedAt")) conversations.createIndex("updatedAt", "updatedAt");
            const cursor = conversations.openCursor();
            cursor.onsuccess = () => {
              try {
                if (!cursor.result) return;
                cursor.result.update(migrateConversationV1(cursor.result.value));
                cursor.result.continue();
              } catch { abort(); }
            };
          } else abort();
        } catch { abort(); }
      };
      request.onerror = () => { failed = true; reject(new ChatHistoryError(upgradeFailed || request.error?.name === "VersionError" ? "UPGRADE_FAILED" : "UNAVAILABLE")); };
      request.onsuccess = () => {
        const db = request.result;
        if (failed) { db.close(); return; }
        if (!STORES.every((name) => db.objectStoreNames.contains(name))) { db.close(); reject(new ChatHistoryError("CORRUPT")); return; }
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

  /** Resolve only after commit. All IDB requests are queued synchronously in request handlers. */
  private async transaction<T>(mode: IDBTransactionMode, work: (
    tx: IDBTransaction, done: (value: T) => void, guard: (callback: () => void) => () => void,
  ) => void): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(STORES, mode); } catch { reject(new ChatHistoryError("UNAVAILABLE")); return; }
      let result: T;
      let failure: ChatHistoryError | undefined;
      const guard = (callback: () => void) => () => {
        try { callback(); } catch (error) {
          failure = error instanceof ChatHistoryError ? error : new ChatHistoryError(mode === "readonly" ? "CORRUPT" : "WRITE_FAILED");
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? new ChatHistoryError(mode === "readonly" ? "CORRUPT" : "WRITE_FAILED"));
      guard(() => work(tx, (value) => { result = value; }, guard))();
    });
  }

  listConversations(): Promise<ChatConversationSummary[]> {
    return this.transaction("readonly", (tx, done, guard) => {
      const request = tx.objectStore("conversations").openCursor();
      const rows: ChatConversationSummary[] = [];
      request.onsuccess = guard(() => {
        if (request.result) { rows.push(summary(stored(request.result.value))); request.result.continue(); }
        else done(rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)));
      });
    });
  }
  getConversation(id: string): Promise<ChatConversation | null> {
    return this.transaction("readonly", (tx, done, guard) => {
      const request = tx.objectStore("conversations").get(id);
      request.onsuccess = guard(() => done(request.result === undefined ? null : stored(request.result)));
    });
  }
  async createConversation(input: Parameters<ChatHistoryStore["createConversation"]>[0]): Promise<ChatConversation> {
    const now = (this.options.now?.() ?? new Date()).toISOString();
    const conversation = readConversation({ ...input, id: this.options.id?.() ?? crypto.randomUUID(), schemaVersion: 2,
      revision: 1, createdAt: now, updatedAt: now, messages: input.messages ?? [] });
    return this.transaction("readwrite", (tx, done) => { tx.objectStore("conversations").add(conversation); done(conversation); });
  }
  updateConversation(id: string, patch: Parameters<ChatHistoryStore["updateConversation"]>[1], expectedRevision: number): Promise<ChatConversation> {
    // Validate/copy the caller's data before an asynchronous transaction can observe mutations.
    if (Object.keys(patch).some((key) => key !== "title" && key !== "messages")) return Promise.reject(new ChatHistoryError("INVALID_DATA"));
    const snapshot = structuredClone(patch);
    return this.transaction("readwrite", (tx, done, guard) => {
      const store = tx.objectStore("conversations");
      const request = store.get(id);
      request.onsuccess = guard(() => {
        if (!request.result) throw new ChatHistoryError("CONFLICT");
        const previous = stored(request.result);
        if (previous.revision !== expectedRevision) throw new ChatHistoryError("CONFLICT");
        const updatedAt = new Date(Math.max((this.options.now?.() ?? new Date()).getTime(), Date.parse(previous.updatedAt) + 1)).toISOString();
        const next = readConversation({ ...previous, ...snapshot, updatedAt, revision: previous.revision + 1 });
        store.put(next); done(next);
      });
    });
  }
  deleteConversation(id: string, expectedRevision: number): Promise<void> {
    return this.transaction("readwrite", (tx, done, guard) => {
      const store = tx.objectStore("conversations");
      const request = store.get(id);
      request.onsuccess = guard(() => {
        if (!request.result || stored(request.result).revision !== expectedRevision) throw new ChatHistoryError("CONFLICT");
        store.delete(id);
        const active = tx.objectStore("state").get("activeConversationId");
        active.onsuccess = guard(() => { if (active.result === id) tx.objectStore("state").put(null, "activeConversationId"); done(); });
      });
    });
  }
  deleteAllConversations(expected: { id: string; revision: number }[]): Promise<void> {
    const snapshot = structuredClone(expected);
    return this.transaction("readwrite", (tx, done, guard) => {
      const store = tx.objectStore("conversations");
      const request = store.getAll();
      request.onsuccess = guard(() => {
        const current = request.result.map(stored);
        if (new Set(snapshot.map((c) => c.id)).size !== snapshot.length || current.length !== snapshot.length
          || current.some((c) => !snapshot.some((s) => s.id === c.id && s.revision === c.revision))) throw new ChatHistoryError("CONFLICT");
        store.clear(); tx.objectStore("state").put(null, "activeConversationId"); done();
      });
    });
  }
  getActiveConversationId(): Promise<string | null> {
    return this.transaction("readonly", (tx, done, guard) => {
      const request = tx.objectStore("state").get("activeConversationId");
      request.onsuccess = guard(() => {
        if (request.result === undefined || request.result === null) { done(null); return; }
        if (typeof request.result !== "string") throw new ChatHistoryError("CORRUPT");
        const id = request.result;
        const conversation = tx.objectStore("conversations").get(id);
        conversation.onsuccess = guard(() => { if (!conversation.result) throw new ChatHistoryError("CORRUPT"); stored(conversation.result); done(id); });
      });
    });
  }
  setActiveConversationId(id: string | null): Promise<void> {
    return this.transaction("readwrite", (tx, done, guard) => {
      const save = () => { tx.objectStore("state").put(id, "activeConversationId"); done(); };
      if (id === null) { save(); return; }
      const request = tx.objectStore("conversations").get(id);
      request.onsuccess = guard(() => { if (!request.result) throw new ChatHistoryError("CONFLICT"); stored(request.result); save(); });
    });
  }
}
