import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbChatHistoryStore, titleFromQuestion } from "../package-dist/chatntc-history/index.js";
import { historyMessages, turnsFromHistory } from "../package-dist/chatntc-ui/historyMessages.js";

const timestamp = "2026-09-15T10:00:00.000Z";
const unitId = "urn:structural-codes:it:unit:ntc2018:7.3.6.1";
const citation = { evidenceId: "e-block", unitId, document: "ntc2018", numbering: "7.3.6.1", blockId: "b-1", assetId: "urn:structural-codes:it:asset:formula:ntc2018:f-1", assetNumber: "7.3.1" };
const response = { formatVersion: 1, evidencePackageId: "package", answer: "Risposta di fixture.", classification: "direct-reference",
  claims: [{ id: "claim", text: "Test.", classification: "direct-reference", citations: [citation] }], usedEvidenceIds: [citation.evidenceId], warnings: [], needsMoreEvidence: false, externalResearchSuggested: false };
const result = { ok: true, response, citations: [citation], evidence: { packageId: "package", structuralCodesVersion: "0.1.0-alpha.1", corpusFingerprint: "corpus-before", artifactFingerprint: "artifacts-before", policyVersion: "chatntc-epistemic-v1", reduced: false, warnings: [{ code: "unreviewed-evidence", unitId }] },
  generation: { provider: "mock", model: "mock-model", outcome: "generated" }, validation: { valid: true, scope: "integrity-provenance-claim-coverage" } };
const turns = [{ id: "turn-1", question: "Prima domanda", timestamp, answeredAt: timestamp, status: "complete", result }];
const messages = historyMessages(turns);
function setup(t, options = {}) {
  const factory = options.indexedDB ?? new IDBFactory();
  let id = 0;
  const settings = { indexedDB: factory, name: "test-chatntc", now: () => new Date(timestamp), id: () => `conversation-${++id}`, ...options };
  const store = new IndexedDbChatHistoryStore(settings);
  t.after(() => store.close());
  return { store, factory, settings };
}
function open(factory, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = version ? factory.open("test-chatntc", version) : factory.open("test-chatntc");
    request.onupgradeneeded = () => upgrade?.(request.result, request.transaction);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transaction(db, names, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite"); operation(tx);
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
  });
}

test("create, persistent messages/citations/provenance, simulated reload and active selection", async (t) => {
  const { store, settings } = setup(t);
  const created = await store.createConversation({ title: "Prima domanda", messages });
  assert.equal(created.schemaVersion, 2); assert.equal(created.revision, 1);
  await store.setActiveConversationId(created.id);
  await store.close();
  const reloaded = new IndexedDbChatHistoryStore(settings); t.after(() => reloaded.close());
  assert.equal(await reloaded.getActiveConversationId(), created.id);
  const saved = await reloaded.getConversation(created.id);
  assert.deepEqual(saved.messages, messages);
  assert.equal(saved.messages[1].provenance.model, "mock-model");
  assert.equal(saved.messages[1].provenance.structuralCodesVersion, "0.1.0-alpha.1");
  assert.equal(saved.messages[1].provenance.corpusFingerprint, "corpus-before");
  assert.deepEqual(turnsFromHistory(saved.messages)[0].result.citations, [citation]);
  assert.equal("primaryUnits" in saved.messages[1], false);
  assert.equal("answer" in saved.messages[1].answer, false, "answer text stored once");
  assert.deepEqual(turnsFromHistory(saved.messages)[0].result, result);
});

test("history schema v2 ripristina sia answer wire v1 esistenti sia nuove answer wire v2", async (t) => {
  const { store } = setup(t);
  const responseV2 = { ...response, formatVersion: 2, status: "answered" };
  const turnsV2 = [{ ...turns[0], id: "turn-v2", result: { ...result, response: responseV2 } }];
  const messagesV2 = historyMessages(turnsV2);
  const created = await store.createConversation({ title: "Wire compatibile", messages: [...messages, ...messagesV2] });
  const restored = turnsFromHistory(created.messages);
  assert.equal(restored[0].result.response.formatVersion, 1);
  assert.equal(restored[1].result.response.formatVersion, 2);
  assert.equal(restored[1].result.response.status, "answered");
});

test("two independent conversations, updatedAt ordering and rename without replacing messages", async (t) => {
  const { store } = setup(t);
  const a = await store.createConversation({ title: "A", messages });
  const b = await store.createConversation({ title: "B" });
  const renamed = await store.updateConversation(b.id, { title: "B rinominata" }, b.revision);
  assert.equal(renamed.revision, 2); assert.ok(renamed.updatedAt > b.updatedAt);
  const list = await store.listConversations();
  assert.deepEqual(list.map((c) => c.id), [b.id, a.id]);
  assert.equal(list[0].title, "B rinominata"); assert.equal("messages" in list[0], false);
  assert.deepEqual((await store.getConversation(a.id)).messages, messages);
  assert.deepEqual(renamed.messages, []);
  renamed.messages.push(messages[0]);
  assert.deepEqual((await store.getConversation(b.id)).messages, [], "no shared mutable objects");
});

test("delete one and deleteAll clear active selection atomically", async (t) => {
  const { store } = setup(t);
  const a = await store.createConversation({ title: "A" });
  const b = await store.createConversation({ title: "B" });
  await store.setActiveConversationId(a.id);
  await store.deleteConversation(a.id, a.revision);
  assert.equal(await store.getConversation(a.id), null);
  assert.equal(await store.getActiveConversationId(), null);
  assert.ok(await store.getConversation(b.id));
  await store.setActiveConversationId(b.id);
  await store.deleteAllConversations(await store.listConversations());
  assert.deepEqual(await store.listConversations(), []);
  assert.equal(await store.getActiveConversationId(), null);
});

test("stale writes, delete and deleteAll snapshots never overwrite another tab", async (t) => {
  const { store, settings } = setup(t);
  const second = new IndexedDbChatHistoryStore(settings); t.after(() => second.close());
  const a = await store.createConversation({ title: "Originale" });
  const before = await store.listConversations();
  await second.updateConversation(a.id, { title: "Altra scheda" }, a.revision);
  await assert.rejects(store.updateConversation(a.id, { title: "Obsoleto" }, a.revision), { code: "CONFLICT" });
  await assert.rejects(store.deleteConversation(a.id, a.revision), { code: "CONFLICT" });
  await assert.rejects(store.deleteAllConversations(before), { code: "CONFLICT" });
  assert.equal((await store.getConversation(a.id)).title, "Altra scheda");
});

test("legacy v1 migration adds revision without changing content or active conversation", async (t) => {
  const factory = new IDBFactory();
  const legacy = { id: "legacy", schemaVersion: 1, title: "Vecchia chat", createdAt: timestamp, updatedAt: timestamp, messages };
  const db = await open(factory, 1, (database) => { database.createObjectStore("conversations", { keyPath: "id" }); database.createObjectStore("state"); });
  await transaction(db, ["conversations", "state"], (tx) => { tx.objectStore("conversations").add(legacy); tx.objectStore("state").put("legacy", "activeConversationId"); });
  db.close();
  const { store } = setup(t, { indexedDB: factory });
  assert.deepEqual(await store.getConversation("legacy"), { ...legacy, schemaVersion: 2, revision: 1 });
  assert.equal(await store.getActiveConversationId(), "legacy");
});

test("migration failure rolls back every record and the DB version; no silent deletion", async () => {
  const factory = new IDBFactory();
  const legacy = { id: "a", schemaVersion: 1, title: "Valida", createdAt: timestamp, updatedAt: timestamp, messages };
  const db = await open(factory, 1, (database) => { database.createObjectStore("conversations", { keyPath: "id" }); database.createObjectStore("state"); });
  await transaction(db, ["conversations"], (tx) => { tx.objectStore("conversations").add(legacy); tx.objectStore("conversations").add({ id: "z", schemaVersion: 999, opaque: "conservare" }); });
  db.close();
  const store = new IndexedDbChatHistoryStore({ indexedDB: factory, name: "test-chatntc" });
  await assert.rejects(store.listConversations(), { code: "UPGRADE_FAILED" });
  const unchanged = await open(factory);
  assert.equal(unchanged.version, 1);
  const all = await new Promise((resolve) => { const req = unchanged.transaction("conversations").objectStore("conversations").getAll(); req.onsuccess = () => resolve(req.result); });
  assert.deepEqual(all, [legacy, { id: "z", schemaVersion: 999, opaque: "conservare" }]);
  unchanged.close();
});

test("unavailable and blocked storage report explicit errors without creating fallback localStorage", async () => {
  const unavailable = new IndexedDbChatHistoryStore({ indexedDB: { open() { throw new Error("private browser detail"); } } });
  await assert.rejects(unavailable.listConversations(), (error) => error.code === "UNAVAILABLE" && !error.message.includes("private"));
  const factory = new IDBFactory();
  const db = await open(factory, 1, (database) => { database.createObjectStore("conversations", { keyPath: "id" }); database.createObjectStore("state"); });
  const store = new IndexedDbChatHistoryStore({ indexedDB: factory, name: "test-chatntc" });
  await assert.rejects(store.listConversations(), { code: "BLOCKED" });
  db.close();
});

test("invalid records and credentials are rejected; result projection only saves allowed fields", async (t) => {
  const { store } = setup(t);
  await assert.rejects(store.createConversation({ title: "Test", apiKey: "secret-test-value" }), { code: "INVALID_DATA" });
  const withConfig = structuredClone(turns);
  withConfig[0].result.apiKey = "secret-test-value";
  withConfig[0].result.generation.apiKey = "secret-test-value";
  withConfig[0].result.evidence.primaryUnits = ["huge corpus"];
  const clean = historyMessages(withConfig);
  const saved = await store.createConversation({ title: "Test", messages: clean });
  assert.equal(JSON.stringify(saved).includes("secret-test-value"), false);
  assert.equal(JSON.stringify(saved).includes("huge corpus"), false);
  const invalid = structuredClone(messages); invalid[1].provenance.apiKey = "secret-test-value";
  await assert.rejects(store.updateConversation(saved.id, { messages: invalid }, saved.revision), { code: "INVALID_DATA" });
  assert.deepEqual((await store.getConversation(saved.id)).messages, messages);
});

test("corrupt records report CORRUPT and remain in storage", async (t) => {
  const { store, factory } = setup(t);
  await store.listConversations(); await store.close();
  const db = await open(factory);
  await transaction(db, ["conversations"], (tx) => tx.objectStore("conversations").add({ id: "broken", schemaVersion: 2 }));
  db.close();
  await assert.rejects(store.listConversations(), { code: "CORRUPT" });
  await assert.rejects(store.getConversation("broken"), { code: "CORRUPT" });
});

test("pending turns recover as cancelled without fabricating an answer", () => {
  const pending = [{ ...messages[0], status: "pending" }];
  assert.equal(turnsFromHistory(pending)[0].status, "cancelled");
  assert.equal(turnsFromHistory(pending)[0].result, undefined);
});

test("local titles collapse whitespace, have bounded length and preserve Unicode", () => {
  assert.equal(titleFromQuestion("  Spiegami\n questo  paragrafo "), "Spiegami questo paragrafo");
  assert.equal(Array.from(titleFromQuestion("🔎".repeat(100))).length, 72);
  assert.equal(titleFromQuestion(""), "Nuova chat");
});
