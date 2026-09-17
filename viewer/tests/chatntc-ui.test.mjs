import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";

const dom = new JSDOM('<!doctype html><html><body><div id="test"></div></body></html>', { url: "http://localhost:3000/", pretendToBeVisual: true });
for (const name of ["window", "document", "navigator", "Element", "HTMLElement", "HTMLTextAreaElement", "Event", "MouseEvent", "KeyboardEvent", "localStorage"]) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.CSS = { escape: (value) => value.replaceAll(":", "\\:") };
class Observer { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = Observer;
globalThis.IntersectionObserver = Observer;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
dom.window.HTMLElement.prototype.scrollTo = function (options) { this.scrollTop = options.top ?? 0; };
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act, createElement: h } = React;
const { ChatNTCPanel, ChatNTCHistoryPanel, IndexedDbChatHistoryStore, ChatHistoryError, CHATNTC_CLASSIFICATION_LABELS, ChatTransportError, LocalChatTransport, LocalAIConfiguration, AISettings, ViewerToolsDock, ComparisonViewer, NormativeViewer, urlForViewerTarget, targetFromUrl } = await import("../.chatntc-ui-test/index.js");

const unitId = "urn:structural-codes:it:unit:ntc2018:7.3.6.1";
const context = { documentId: "ntc2018", unitId, numbering: "7.3.6.1" };
const citation = { evidenceId: unitId, unitId, document: "ntc2018", numbering: "7.3.6.1" };
const verifiedReference = { unitId, document: "ntc2018", numbering: "7.3.6.1", kind: "unit" };
function result(classification = "direct-reference") {
  const citations = classification === "no-direct-reference" ? [] : [citation];
  return { ok: true, response: { formatVersion: 1, evidencePackageId: "fixture-package", answer: "Risposta simulata per il test di interazione.", classification,
    claims: citations.length ? [{ id: "claim", text: "Test.", classification, citations }] : [], usedEvidenceIds: citations.map((item) => item.evidenceId),
    warnings: [], needsMoreEvidence: !citations.length, externalResearchSuggested: false }, citations,
    evidence: { packageId: "fixture-package", structuralCodesVersion: "0.1.0-alpha.1", corpusFingerprint: "fixture-corpus", artifactFingerprint: "fixture-artifacts", policyVersion: "chatntc-epistemic-v1", reduced: false, warnings: [] },
    generation: { provider: "mock", model: "mock-model", outcome: citations.length ? "generated" : "abstained" }, validation: { valid: true, scope: "integrity-provenance-claim-coverage" } };
}
function resultV3(references = [verifiedReference], answerMarkdown = "No: il punto chiave è distinguere gli spostamenti.") {
  return { ok: true, response: { formatVersion: 3, evidencePackageId: "fixture-package",
    answerMarkdown, classification: references.length > 1 ? "combined-reference" : references.length ? "direct-reference" : "no-direct-reference",
    status: "answered", verifiedReferences: references, warnings: [], needsMoreEvidence: false, externalResearchSuggested: false },
    citations: references, evidence: { packageId: "fixture-package", structuralCodesVersion: "0.1.0-alpha.1",
      corpusFingerprint: "fixture-corpus", artifactFingerprint: "fixture-artifacts", policyVersion: "chatntc-epistemic-v2", reduced: false, warnings: [] },
    generation: { provider: "mock", model: "mock-model", outcome: "generated" },
    validation: { valid: true, scope: "integrity-provenance-reference-resolution", stage: "NORMALIZED" } };
}
const rootElement = document.querySelector("#test");
let root;
const calls = [];
const navigate = [];
const transport = (send = async () => result()) => ({ capabilities: { cancellation: true, streaming: false }, async send(request, options) { calls.push({ request, options }); return send(request, options); } });
const props = (custom = {}) => ({ transport: transport(), context, onNavigate: (target) => navigate.push(target), hrefForTarget: (target) => urlForViewerTarget(window.location.href, "combined", "combined", target).href, ...custom });
async function mount(element) { root = createRoot(rootElement); await act(async () => { root.render(element); }); }
async function click(element) { assert.ok(element, "missing click target"); await act(async () => { element.click(); }); }
function button(text) { return [...rootElement.querySelectorAll("button")].find((item) => item.textContent === text); }
async function input(value) { await act(async () => {
  const element = rootElement.querySelector("textarea");
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(element, value);
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
}); }
async function submit(question = "Domanda di test") { await input(question); await click(button("Invia")); }
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined; calls.length = 0; navigate.length = 0;
  window.history.replaceState(null, "", "/");
});

test("pannello: import, mount, composizione e suggerimento non chiamano AI", async () => {
  await mount(h(ChatNTCPanel, props()));
  assert.match(rootElement.textContent, /Da quale riferimento/);
  await input("Testo senza invio");
  await click(button("Spiegami questo paragrafo"));
  assert.equal(rootElement.querySelector("textarea").value, "Spiegami questo paragrafo");
  assert.equal(document.activeElement, rootElement.querySelector("textarea"));
  assert.equal(calls.length, 0);
});

test("invio generico, risposta, classificazione e click citazione usano target/permalink condiviso", async () => {
  await mount(h(ChatNTCPanel, props()));
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.context, undefined);
  assert.match(rootElement.textContent, /Risposta simulata/);
  assert.equal(rootElement.querySelector("[data-classification]").textContent, "Riferimento diretto");
  const link = rootElement.querySelector('.scv-chat-citations a');
  assert.equal(link.textContent, "NTC 2018 §7.3.6.1");
  assert.deepEqual(targetFromUrl(new URL(link.href)), { kind: "unit", unitId });
  await click(link);
  assert.deepEqual(navigate, [{ kind: "unit", unitId }]);
});

test("risposta canonica v3 mostra answerMarkdown e riferimenti verificati", async () => {
  const assetId = "urn:structural-codes:it:asset:formula:ntc2018:7.3.3.3-7.3.8";
  const formula = { ...verifiedReference, kind: "formula", blockId: "formula-block", assetId, assetNumber: "7.3.8" };
  const reply = resultV3([verifiedReference, formula]);
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => reply) })));
  await submit();
  assert.match(rootElement.querySelector(".scv-chat-markdown").textContent, /^No:/u);
  assert.equal(rootElement.querySelector(".scv-chat-citations strong").textContent, "Riferimenti verificati");
  assert.deepEqual([...rootElement.querySelectorAll(".scv-chat-citations a")].map((link) => link.textContent),
    ["NTC 2018 §7.3.6.1", "Formula [7.3.8]"]);
  assert.deepEqual(await new LocalChatTransport(async () => Response.json(reply)).send({ question: "Test" }), reply);
});

test("i riferimenti verificati nel corpo aprono paragrafi, formule e figure canonici", async () => {
  const formula = { ...verifiedReference, kind: "formula", blockId: "formula-block",
    assetId: "urn:structural-codes:it:asset:formula:ntc2018:7.3.8", assetNumber: "7.3.8" };
  const figure = { ...verifiedReference, kind: "figure", blockId: "figure-block",
    assetId: "urn:structural-codes:it:asset:figure:ntc2018:7.3.1", assetNumber: "7.3.1" };
  const markdown = "Vedi NTC 2018 §7.3.6.1, formula [7.3.8] e Fig. 7.3.1.";
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => resultV3([verifiedReference, formula, figure], markdown)) })));
  await submit();
  const links = [...rootElement.querySelectorAll(".scv-chat-markdown .scv-chat-reference-link")];
  assert.deepEqual(links.map((link) => link.textContent), ["§7.3.6.1", "formula [7.3.8]", "Fig. 7.3.1"]);
  assert.deepEqual(links.map((link) => targetFromUrl(new URL(link.href))), [
    { kind: "unit", unitId },
    { kind: "asset", unitId, assetId: formula.assetId, assetKind: "formula" },
    { kind: "asset", unitId, assetId: figure.assetId, assetKind: "figure" },
  ]);
  for (const link of links) await click(link);
  assert.deepEqual(navigate, links.map((link) => targetFromUrl(new URL(link.href))));
});

test("answerMarkdown rende Markdown ricco e KaTeX senza eseguire HTML", async () => {
  const markdown = `## Risposta breve

**No:** distingui *spostamento elastico* e \`spostamento di verifica\`.

### Conseguenza progettuale

- usa $d_{Ee}$ dal modello;
- applica $\\mu_d$ una volta.

1. controlla gli spostamenti;
2. verifica il limite.

#### Nota operativa

> La formula resta leggibile.

\`\`\`text
controllo = domanda + modello
\`\`\`

$$
\\mu_d = \\begin{cases}
q & T_1 \\geq T_C \\\\
1 + (q-1)\\dfrac{T_C}{T_1} & T_1 < T_C
\\end{cases}
$$

---

[Approfondimento](https://example.org/) [link non sicuro](javascript:alert(1)) <script>window.injected = true</script>`;
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => resultV3([verifiedReference], markdown)) })));
  await submit();
  const content = rootElement.querySelector(".scv-chat-markdown");
  assert.equal(content.querySelector("h2").textContent, "Risposta breve");
  assert.equal(content.querySelector("h3").textContent, "Conseguenza progettuale");
  assert.equal(content.querySelector("h4").textContent, "Nota operativa");
  assert.equal(content.querySelector("strong").textContent, "No:");
  assert.equal(content.querySelector("em").textContent, "spostamento elastico");
  assert.equal(content.querySelectorAll("ul li").length, 2);
  assert.equal(content.querySelectorAll("ol li").length, 2);
  assert.ok(content.querySelector("blockquote"));
  assert.ok(content.querySelector("code"));
  assert.ok(content.querySelector("pre code"));
  assert.ok(content.querySelector("hr"));
  assert.equal(content.querySelector("a").getAttribute("href"), "https://example.org/");
  assert.equal([...content.querySelectorAll("a")].some((link) => link.getAttribute("href")?.startsWith("javascript:")), false);
  assert.ok(content.querySelectorAll(".katex").length >= 2);
  assert.ok(content.querySelector(".katex-display"));
  assert.ok(content.querySelector(".katex-mathml math"), "KaTeX keeps accessible MathML");
  assert.equal(content.querySelector("script"), null);
  assert.equal(globalThis.window.injected, undefined);
  assert.equal(rootElement.querySelector(".scv-chat-markdown").compareDocumentPosition(rootElement.querySelector(".scv-chat-citations"))
    & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test("skeleton stabile diventa una risposta animata conservando la posizione di lettura", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  await mount(h(ChatNTCPanel, props({ transport: transport(() => pending) })));
  await submit();
  const loading = rootElement.querySelector(".scv-chat-loading");
  assert.ok(loading);
  assert.match(loading.textContent, /Sto consultando la normativa/u);
  assert.equal(loading.querySelectorAll(".scv-chat-loading-lines i").length, 4);
  assert.ok(button("Interrompi"));
  const log = rootElement.querySelector(".scv-chat-messages");
  log.scrollTop = 43;
  await act(async () => finish(resultV3()));
  assert.equal(rootElement.querySelector(".scv-chat-loading"), null);
  assert.equal(rootElement.querySelector(".scv-chat-answer").dataset.entrance, "new");
  assert.ok(rootElement.querySelector(".scv-chat-answer-enter"));
  assert.equal(log.scrollTop, 43, "completion must not jump to the bottom");
});

test("CSS confina formule larghe e supporta mobile, skeleton e reduced motion", async () => {
  const styles = await readFile(new URL("../shared/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.scv-chat-markdown\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%/su);
  assert.doesNotMatch(styles, /\.scv-chat-markdown\s*\{[^}]*68ch/su);
  assert.match(styles, /\.scv-chat-markdown p, \.scv-chat-markdown li\s*\{[^}]*text-align:\s*justify[^}]*text-justify:\s*inter-word/su);
  assert.match(styles, /\.scv-chat-markdown blockquote p, \.scv-chat-markdown blockquote li\s*\{[^}]*text-align:\s*start[^}]*text-justify:\s*auto/su);
  assert.match(styles, /\.scv-chat-markdown p > strong:first-child[^}]*display:\s*block/su);
  assert.match(styles, /\.scv-chat-markdown h2,[^}]*display:\s*block[^}]*width:\s*100%/su);
  assert.match(styles, /\.scv-chat-markdown \.katex-display[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/su);
  assert.match(styles, /\.scv-chat-markdown \.katex-display[^}]*font-size:\s*1\.18em/su);
  assert.match(styles, /\.scv-chat-markdown \.katex-display > \.katex[^}]*width:\s*max-content/su);
  assert.match(styles, /\.scv-chat-markdown pre[^}]*overflow-x:\s*auto/su);
  assert.match(styles, /\.scv-chat-citations ul[^}]*flex-wrap:\s*wrap/su);
  assert.match(styles, /\.scv-chat-loading[^}]*min-height:/su);
  assert.match(styles, /@media \(max-width:\s*700px\)[\s\S]*\.scv-chat-markdown[^}]*width:\s*100%/u);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.scv-chat-answer-enter\s*\{\s*animation:\s*none/su);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.scv-chat-loading-lines i\s*\{\s*animation:\s*none/su);
});

for (const [classification, label] of Object.entries(CHATNTC_CLASSIFICATION_LABELS)) test(`classificazione ${classification} visibile e discreta`, async () => {
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => result(classification)) })));
  await submit();
  assert.equal(rootElement.querySelector("[data-classification]").textContent, label);
  if (classification === "no-direct-reference") assert.equal(rootElement.querySelectorAll(".scv-chat-citations a").length, 0);
});

test("paragrafo corrente: invia solo ID/numbering, inclusa selezione, senza chunk", async () => {
  await mount(h(ChatNTCPanel, props({ context: { ...context, blockId: "fixture-block" } })));
  await click(button("Spiegami questo paragrafo"));
  await click(button("Invia"));
  assert.deepEqual(calls[0].request.context, { ...context, blockId: "fixture-block" });
  assert.equal(calls[0].request.question, "Spiegami questo paragrafo");
  assert.equal(JSON.stringify(calls[0].request).includes("chunk"), false);
});

test("errore infrastrutturale leggibile e domanda recuperabile", async () => {
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => { throw new ChatTransportError("PROVIDER_UNAVAILABLE", "Provider non disponibile."); }) })));
  await submit("Domanda da riprovare");
  assert.equal(rootElement.querySelector(".scv-chat-loading"), null);
  assert.equal(rootElement.querySelector('[role="alert"]').textContent, "Provider non disponibile.");
  assert.equal(rootElement.querySelector("textarea").value, "Domanda da riprovare");
  assert.equal(rootElement.querySelector(".scv-chat-answer"), null);
});

test("stop e nuova chat annullano richieste e ignorano risposte tardive", async () => {
  let resolve;
  await mount(h(ChatNTCPanel, props({ transport: transport(() => new Promise((done) => { resolve = done; })) })));
  await submit();
  assert.ok(rootElement.querySelector(".scv-chat-loading"));
  await click(button("Interrompi"));
  assert.equal(rootElement.querySelector(".scv-chat-loading"), null);
  assert.equal(calls[0].options.signal.aborted, true);
  await act(async () => resolve(result()));
  assert.equal(rootElement.querySelector(".scv-chat-answer"), null);
  await submit("Seconda domanda");
  await click(button("Nuova chat"));
  assert.equal(calls[1].options.signal.aborted, true);
  await act(async () => resolve(result()));
  assert.equal(rootElement.querySelectorAll(".scv-chat-turn").length, 0);
});

test("tastiera multilinea e storico minimo in memoria; nuova chat azzera il contesto conversazionale", async () => {
  await mount(h(ChatNTCPanel, props()));
  await input("Prima domanda\ncon seconda riga");
  await act(async () => rootElement.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
  await submit("Seconda domanda");
  assert.equal(calls[1].request.history.length, 2);
  await click(button("Nuova chat"));
  await submit("Ripartenza");
  assert.deepEqual(calls[2].request.history, []);
});

test("LocalChatTransport: nessuna chiamata nel costruttore, request e cancellazione corrette", async () => {
  let init;
  const local = new LocalChatTransport(async function (url, options) { assert.equal(this, undefined); assert.equal(url, "/api/chatntc"); init = options; return Response.json(result()); });
  assert.equal(init, undefined);
  const controller = new AbortController();
  const output = await local.send({ question: "Test", context }, { signal: controller.signal });
  assert.deepEqual(output, result());
  assert.deepEqual(JSON.parse(init.body), { question: "Test", context });
  assert.equal(init.signal, controller.signal);
  assert.equal(init.headers.authorization, undefined);
});

test("LocalChatTransport rifiuta output non validato e sanitizza gli errori", async () => {
  for (const invalid of [{}, { ...result(), validation: { valid: false } }, { ...result(), citations: [{ ...citation, unitId: "invented" }] }]) {
    await assert.rejects(new LocalChatTransport(async () => Response.json(invalid)).send({ question: "Test" }), { code: "INVALID_RESULT" });
  }
  await assert.rejects(new LocalChatTransport(async () => Response.json({ error: { code: "PROVIDER_UNAVAILABLE", message: "private detail" } }, { status: 503 })).send({ question: "Test" }),
    (error) => error.code === "PROVIDER_UNAVAILABLE" && !error.message.includes("private detail"));
});

test("warning neutro di degradazione è visibile e dismissibile", async () => {
  const reply = resultV3([], "La risposta tecnica generale resta disponibile.");
  reply.response.referenceWarning = "no-references-verified";
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => reply) })));
  await submit();
  assert.match(rootElement.querySelector(".scv-chat-reference-warning").textContent, /Non sono stati verificati riferimenti normativi specifici/u);
  assert.equal(rootElement.querySelector(".scv-chat-error"), null);
  await click(rootElement.querySelector(".scv-chat-reference-warning button"));
  assert.equal(rootElement.querySelector(".scv-chat-reference-warning"), null);
  assert.match(rootElement.querySelector(".scv-chat-markdown").textContent, /resta disponibile/u);
});

test("warning editoriali restano nei metadata UI e non vengono aggiunti alla prosa", async () => {
  const reply = result();
  reply.evidence.warnings = [{ code: "unreviewed-evidence", unitId }];
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => reply) })));
  await submit();
  assert.equal(rootElement.querySelector(".scv-chat-markdown").textContent, reply.response.answer);
  assert.match(rootElement.querySelector(".scv-chat-warnings").textContent, /Fonti non ancora revisionate integralmente/u);
});

const manifest = JSON.parse(await readFile(new URL("../public/data/codes/manifest.json", import.meta.url), "utf8"));
const dockContext = { mode: "combined", documentId: "ntc2018", manifest, chunk: null, pageBounds: { from: 1, to: 1 }, currentUnit: context,
  navigateTo: async (target) => navigate.push(target), hrefForTarget: props().hrefForTarget };

test("dock: ChatNTC/PDF convivono, tab tastiera e cambio scheda conservano la chat", async () => {
  await mount(h(ViewerToolsDock, { context: dockContext, chatTransport: transport(), pdfEnabled: true }));
  await submit();
  const tabs = rootElement.querySelectorAll('[role="tab"]');
  await act(async () => tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  assert.equal(tabs[1].getAttribute("aria-selected"), "true");
  assert.equal(document.activeElement, tabs[1]);
  assert.ok(button("Apri PDF ufficiale"));
  await click(tabs[0]);
  assert.match(rootElement.querySelector('.scv-chat-answer').textContent, /Risposta simulata/);
  assert.equal(calls.length, 1);
});

test("dock senza configurazione chat: solo PDF, senza UI ChatNTC", async () => {
  await mount(h(ViewerToolsDock, { context: dockContext, pdfEnabled: true }));
  assert.equal(rootElement.querySelector('[aria-label="ChatNTC"]'), null);
  assert.equal(rootElement.querySelectorAll('[role="tab"]').length, 1);
  assert.equal(calls.length, 0);
});

async function mockCorpusFetch(url) {
  const path = new URL(String(url), window.location.href).pathname;
  assert.ok(path.startsWith("/data/codes/"), `Unexpected network ${path}`);
  return Response.json(JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8")));
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  assert.fail("Timed out waiting for viewer");
}

test("viewer: apertura/chiusura, contesto reale, slash nell'input e citation click → navigazione esistente", async (t) => {
  t.mock.method(globalThis, "fetch", mockCorpusFetch);
  window.history.replaceState(null, "", `/?unit=${encodeURIComponent(unitId)}`);
  const destination = "urn:structural-codes:it:unit:ntc2018:4.1.2";
  const mock = transport(async () => {
    const reply = result();
    const other = { ...citation, unitId: destination, evidenceId: destination, numbering: "4.1.2" };
    reply.citations = [other]; reply.response.claims[0].citations = [other]; reply.response.usedEvidenceIds = [destination];
    return reply;
  });
  await mount(h(NormativeViewer, { defaultMode: "combined", auxiliaryPanelLabel: "Strumenti", auxiliaryPanelKeepMounted: true, auxiliaryPanelModes: ["ntc", "circ", "combined"],
    auxiliaryPanel: (ctx) => h(ViewerToolsDock, { context: ctx, chatTransport: mock, pdfEnabled: true }) }));
  await waitFor(() => rootElement.querySelector(".scv-chat-context")?.textContent.includes("7.3.6.1"));
  assert.equal(rootElement.querySelector(".scv-auxiliary-pane").hidden, true);
  await click(button("Apri Strumenti"));
  assert.equal(rootElement.querySelector(".scv-auxiliary-pane").hidden, false);
  await click(button("Spiegami questo paragrafo"));
  const textarea = rootElement.querySelector("textarea");
  const slash = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
  await act(async () => textarea.dispatchEvent(slash));
  assert.equal(slash.defaultPrevented, false);
  await click(button("Invia"));
  assert.deepEqual(calls[0].request.context, context);
  await click(rootElement.querySelector('.scv-chat-citations a'));
  await waitFor(() => rootElement.querySelector(`[data-scv-text-unit="${destination}"]`));
  assert.equal(targetFromUrl(new URL(window.location.href)).unitId, destination);
  await click(rootElement.querySelector('[aria-label="Chiudi strumenti"]'));
  assert.equal(rootElement.querySelector(".scv-auxiliary-pane").hidden, true);
  assert.equal(document.activeElement, button("Apri Strumenti"));
  await click(button("Apri Strumenti"));
  assert.match(rootElement.querySelector('.scv-chat-answer').textContent, /Risposta simulata/);
  assert.equal(calls.length, 1);
});

test("preview: un risultato asincrono tardivo non riapre il tooltip dopo pointerout", async (t) => {
  let releaseCrossReference;
  t.mock.method(globalThis, "fetch", (url) => {
    const path = new URL(String(url), window.location.href).pathname;
    if (!path.endsWith("/cross-reference-index.json")) return mockCorpusFetch(url);
    return new Promise((resolve, reject) => {
      releaseCrossReference = async () => {
        try { resolve(await mockCorpusFetch(url)); } catch (error) { reject(error); }
      };
    });
  });
  window.history.replaceState(null, "", `/?unit=${encodeURIComponent(unitId)}`);
  await mount(h(NormativeViewer, { defaultMode: "combined" }));
  await waitFor(() => rootElement.querySelector(".scv-cross-reference"));
  const link = rootElement.querySelector(".scv-cross-reference");
  await act(async () => { link.dispatchEvent(new window.Event("pointerover", { bubbles: true })); });
  await waitFor(() => releaseCrossReference);
  assert.ok(rootElement.querySelector("[data-scv-reference-preview]"));
  await act(async () => { link.dispatchEvent(new window.Event("pointerout", { bubbles: true })); });
  assert.equal(rootElement.querySelector("[data-scv-reference-preview]"), null);
  await act(async () => { await releaseCrossReference(); });
  assert.equal(rootElement.querySelector("[data-scv-reference-preview]"), null);
});

test("citazioni granulari Circolare mantengono block/asset nei target senza URL generati dal modello", async () => {
  const circ = "urn:structural-codes:it:unit:circ2019:c7.3.6.1";
  const assetId = "urn:structural-codes:it:asset:formula:circ2019:fixture";
  const reply = result();
  reply.citations = [{ ...citation, evidenceId: "block", unitId: circ, document: "circ2019", numbering: "C7.3.6.1", blockId: "canonical-block" },
    { ...citation, evidenceId: "asset", unitId: circ, document: "circ2019", numbering: "C7.3.6.1", blockId: "asset-block", assetId, assetNumber: "C7.3.6" }];
  await mount(h(ChatNTCPanel, props({ transport: transport(async () => reply) })));
  await submit();
  const links = rootElement.querySelectorAll('.scv-chat-citations a');
  await click(links[0]); await click(links[1]);
  assert.deepEqual(navigate, [{ kind: "block", unitId: circ, blockId: "canonical-block" }, { kind: "asset", unitId: circ, assetId, assetKind: "formula" }]);
  assert.deepEqual(targetFromUrl(new URL(links[1].href)), navigate[1]);
});

test("standalone senza flag: nessuna ChatNTC e nessuna chiamata AI", async (t) => {
  t.mock.method(globalThis, "fetch", mockCorpusFetch);
  await mount(h(ComparisonViewer));
  await waitFor(() => rootElement.querySelector(".scv-unit"));
  assert.equal(rootElement.querySelector('[aria-label="ChatNTC"]'), null);
  assert.equal(rootElement.querySelector(".scv-tools-toggle"), null);
  assert.equal(calls.length, 0);
});

function historyStore(t) {
  const options = { indexedDB: new IDBFactory(), name: "test-ui-history" };
  const store = new IndexedDbChatHistoryStore(options);
  t.after(() => store.close());
  return { store, options };
}
async function readyHistory() { await waitFor(() => button("Nuova chat") && !button("Nuova chat").disabled); }
async function settledHistory() { await waitFor(() => rootElement.querySelector(".scv-chat-history-toolbar [role=status]")?.textContent === "Solo in questo browser"); }
async function toggleHistory() { await click([...rootElement.querySelectorAll("button")].find((b) => b.textContent.startsWith("Conversazioni ("))); }

test("history UI: first question creates local title, reload restores active response/citations without AI", async (t) => {
  const { store, options } = historyStore(t);
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: store, currentCorpusFingerprint: "fixture-corpus" }));
  await readyHistory();
  assert.equal(calls.length, 0);
  await toggleHistory(); assert.match(rootElement.textContent, /Nessuna conversazione salvata/);
  await toggleHistory();
  await submit("  Prima domanda locale  "); await settledHistory();
  assert.equal(rootElement.querySelector(".scv-chat-answer").dataset.entrance, "new");
  assert.match(rootElement.querySelector(".scv-chat-history-title").textContent, /Prima domanda locale/);
  assert.match(rootElement.textContent, /mock-model/);
  assert.equal(rootElement.querySelector(".scv-chat-corpus-warning"), null);
  const list = await store.listConversations(); assert.equal(list.length, 1);
  assert.equal((await store.getConversation(list[0].id)).messages.length, 2);
  await act(async () => root.unmount()); root = undefined; await store.close();
  const reloaded = new IndexedDbChatHistoryStore(options); t.after(() => reloaded.close());
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: reloaded, currentCorpusFingerprint: "changed-corpus" }));
  await readyHistory();
  assert.match(rootElement.textContent, /Risposta simulata/);
  assert.equal(rootElement.querySelector(".scv-chat-answer").dataset.entrance, "history");
  assert.equal(rootElement.querySelector(".scv-chat-answer-enter"), null);
  assert.match(rootElement.textContent, /Questa risposta è stata generata con una versione diversa del corpus\./);
  assert.equal(rootElement.querySelector("[data-classification]").textContent, "Riferimento diretto");
  await click(rootElement.querySelector(".scv-chat-citations a"));
  assert.deepEqual(navigate, [{ kind: "unit", unitId }]);
  assert.equal(calls.length, 1, "reload and citation navigation never regenerate");
});

test("history UI: two independent chats, selection, rename, deletion and confirmed deleteAll", async (t) => {
  const { store } = historyStore(t);
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: store })); await readyHistory();
  await submit("Prima conversazione"); await settledHistory();
  await click(button("Nuova chat")); await readyHistory();
  await submit("Seconda conversazione"); await settledHistory();
  assert.deepEqual(calls[1].request.history, []);
  await toggleHistory();
  await click([...rootElement.querySelectorAll(".scv-chat-history-list li button")].find((b) => b.textContent.startsWith("Prima conversazione")));
  await readyHistory();
  assert.equal(rootElement.querySelectorAll(".scv-chat-turn").length, 1);
  assert.match(rootElement.querySelector(".scv-chat-question").textContent, /Prima conversazione/);
  await click(button("Rinomina"));
  await act(async () => {
    const element = rootElement.querySelector('[aria-label="Titolo conversazione"]');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, "Titolo manuale");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Salva titolo")); await readyHistory();
  assert.equal((await store.listConversations())[0].title, "Titolo manuale");
  await submit("Seguito"); await settledHistory();
  assert.equal(calls[2].request.history[0].content, "Prima conversazione");
  assert.equal((await store.listConversations())[0].title, "Titolo manuale");
  await toggleHistory();
  await click(rootElement.querySelector('[aria-label="Elimina Seconda conversazione"]')); await settledHistory();
  assert.equal((await store.listConversations()).length, 1);
  await click(button("Elimina tutte"));
  assert.equal((await store.listConversations()).length, 1, "confirmation is required");
  await click(button("Annulla"));
  assert.equal((await store.listConversations()).length, 1);
  await click(button("Elimina tutte")); await click(button("Conferma eliminazione")); await settledHistory();
  assert.deepEqual(await store.listConversations(), []);
  assert.equal(await store.getActiveConversationId(), null);
  assert.equal(rootElement.querySelectorAll(".scv-chat-turn").length, 0);
});

test("history UI: failed writes retain visible answer and retry saves it", async (t) => {
  const { store } = historyStore(t);
  const update = store.updateConversation.bind(store);
  let fail = true;
  store.updateConversation = async (...args) => { if (fail) throw new ChatHistoryError("WRITE_FAILED"); return update(...args); };
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: store })); await readyHistory();
  await submit();
  await waitFor(() => button("Riprova salvataggio"));
  assert.match(rootElement.textContent, /Risposta simulata/);
  assert.match(rootElement.textContent, /Salvataggio locale non riuscito/);
  assert.equal(button("Nuova chat").disabled, true);
  fail = false;
  await click(button("Riprova salvataggio")); await settledHistory();
  const conversation = await store.getConversation(await store.getActiveConversationId());
  assert.equal(conversation.messages.length, 2);
  assert.equal(calls.length, 1);
});

test("history UI: interrupted request survives reload as cancelled and no automatic request occurs", async (t) => {
  const { store } = historyStore(t);
  await mount(h(ChatNTCHistoryPanel, { ...props({ transport: transport(() => new Promise(() => {})) }), historyStore: store })); await readyHistory();
  await submit("Domanda interrotta"); await settledHistory();
  await act(async () => root.unmount()); root = undefined;
  assert.equal(calls[0].options.signal.aborted, true);
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: store })); await readyHistory();
  assert.match(rootElement.textContent, /Domanda interrotta/);
  assert.match(rootElement.textContent, /Richiesta interrotta/);
  assert.equal(rootElement.querySelector(".scv-chat-answer"), null);
  assert.equal(calls.length, 1);
});

test("history UI: conflicting edit can be saved as new conversation without overwriting the other tab", async (t) => {
  const { store, options } = historyStore(t);
  const second = new IndexedDbChatHistoryStore(options); t.after(() => second.close());
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: store })); await readyHistory();
  await submit("Originale"); await settledHistory();
  const id = await store.getActiveConversationId();
  const original = await second.getConversation(id);
  await second.updateConversation(id, { title: "Modifica altra scheda" }, original.revision);
  await submit("Nuova domanda nella prima scheda");
  await waitFor(() => button("Salva come nuova conversazione"));
  await click(button("Salva come nuova conversazione")); await settledHistory();
  assert.equal((await store.listConversations()).length, 2);
  assert.equal((await store.getConversation(id)).title, "Modifica altra scheda");
  assert.notEqual(await store.getActiveConversationId(), id);
  assert.equal((await store.getConversation(await store.getActiveConversationId())).messages.length, 4);
});

test("history unavailable: explicit message and no silent volatile fallback or AI call", async () => {
  await mount(h(ChatNTCHistoryPanel, { ...props(), historyStore: { async listConversations() { throw new ChatHistoryError("UNAVAILABLE"); } } }));
  await waitFor(() => rootElement.querySelector('[role="alert"]'));
  assert.match(rootElement.textContent, /cronologia locale non è disponibile/);
  assert.equal(rootElement.querySelector("textarea"), null);
  assert.equal(calls.length, 0);
});

async function settingsInput(label, value) {
  const labelElement = [...rootElement.querySelectorAll("label")].find((item) => item.textContent === label);
  const element = document.getElementById(labelElement.htmlFor);
  await act(async () => {
    const prototype = element.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}

test("BYOK UI: unified settings, manual model, no AI at configuration, key only in memory", async () => {
  localStorage.clear();
  const configuration = new LocalAIConfiguration();
  await mount(h(AISettings, { configuration }));
  assert.equal(rootElement.querySelector('input[type=password]').autocomplete, "off");
  await settingsInput("API key", "fixture-ui-secret-not-real");
  await settingsInput("Modello / model ID", "future-model");
  await click(button("Applica impostazioni"));
  assert.equal(configuration.hasKey, true);
  assert.equal(rootElement.querySelector('input[type=password]').value, "");
  assert.equal(JSON.stringify(configuration).includes("fixture-ui-secret"), false);
  assert.equal(localStorage.length, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem(localStorage.key(0))), { provider: "deepseek", model: "future-model" });
  const reloaded = new LocalAIConfiguration(); reloaded.restore(localStorage);
  assert.equal(reloaded.hasKey, false); assert.deepEqual(reloaded.selection, configuration.selection);
  await settingsInput("Provider", "openai");
  assert.equal(configuration.hasKey, false);
  assert.equal(rootElement.querySelector('input[list]').value, "gpt-5.6-luna");
  await click(button("Applica impostazioni"));
  assert.equal(configuration.selection.provider, "openai");
  assert.equal(calls.length, 0);
  await settingsInput("API key", "fixture-second-key"); await click(button("Applica impostazioni"));
  await click(button("Rimuovi chiave")); assert.equal(configuration.hasKey, false);
  localStorage.clear();
});

test("BYOK UI OpenRouter: exact manual underscore ID survives restore, key does not", async (t) => {
  localStorage.clear();
  t.after(() => localStorage.clear());
  let networkCalls = 0;
  t.mock.method(globalThis, "fetch", async () => { networkCalls++; assert.fail("Settings and restore never call AI"); });
  const configuration = new LocalAIConfiguration();
  await mount(h(AISettings, { configuration }));
  await settingsInput("Provider", "openrouter");
  assert.equal(rootElement.querySelector("select").value, "openrouter");
  assert.equal(rootElement.querySelector("input[list]").value, "openrouter/auto");
  await settingsInput("Modello / model ID", "stealth/union_alpha");
  await settingsInput("API key", "fixture-openrouter-ui-memory-key");
  await click(button("Applica impostazioni"));
  const selection = { provider: "openrouter", model: "stealth/union_alpha" };
  assert.deepEqual(configuration.selection, selection);
  assert.equal(configuration.hasKey, true);
  assert.equal(rootElement.querySelector("input[list]").value, selection.model);
  assert.equal(rootElement.querySelector("input[type=password]").value, "");
  assert.equal(rootElement.querySelector('[role="alert"]'), null);
  assert.deepEqual(configuration.requestHeaders(), { "x-chatntc-provider": "openrouter", "x-chatntc-model": selection.model,
    "x-chatntc-api-key": "fixture-openrouter-ui-memory-key" });
  assert.equal(localStorage.length, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem(localStorage.key(0))), selection);
  await act(async () => root.unmount()); root = undefined;
  const reloaded = new LocalAIConfiguration(); reloaded.restore(localStorage);
  assert.deepEqual(reloaded.selection, selection);
  assert.equal(reloaded.hasKey, false);
  assert.deepEqual(reloaded.requestHeaders(), { "x-chatntc-provider": "openrouter", "x-chatntc-model": selection.model });
  await mount(h(AISettings, { configuration: reloaded }));
  assert.equal(rootElement.querySelector("select").value, "openrouter");
  assert.equal(rootElement.querySelector("input[list]").value, "stealth/union_alpha");
  assert.equal(rootElement.querySelector("input[type=password]").value, "");
  assert.equal(networkCalls, 0);
});

test("BYOK transport + IndexedDB: provider switch preserves conversation, key absent from history and body", async (t) => {
  const { store, options } = historyStore(t);
  const configuration = new LocalAIConfiguration();
  const key = "fixture-ui-memory-key";
  const requests = [];
  configuration.configure({ provider: "deepseek", model: "deepseek-flash" }, key);
  const local = new LocalChatTransport(async (url, init) => {
    assert.equal(url, "/api/chatntc"); assert.equal(init.redirect, "error"); assert.equal(init.body.includes(key), false);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("x-chatntc-api-key"), key);
    requests.push({ request: JSON.parse(init.body), provider: headers.get("x-chatntc-provider") });
    const reply = result(); reply.generation.provider = headers.get("x-chatntc-provider"); reply.generation.model = headers.get("x-chatntc-model");
    return Response.json(reply);
  }, configuration);
  await mount(h(ChatNTCHistoryPanel, { ...props({ transport: local }), historyStore: store })); await readyHistory();
  assert.equal(requests.length, 0);
  await submit("Primo turno DeepSeek"); await settledHistory();
  const id = await store.getActiveConversationId();
  configuration.configure({ provider: "openai", model: "manual-openai-model" }, key);
  await submit("Secondo turno OpenAI"); await settledHistory();
  assert.equal(await store.getActiveConversationId(), id);
  assert.equal(requests[1].request.history[0].content, "Primo turno DeepSeek");
  const saved = await store.getConversation(id);
  assert.equal(saved.messages.length, 4);
  const serialized = JSON.stringify(saved);
  assert.equal(serialized.includes(key), false); assert.equal(serialized.includes("apiKey"), false);
  assert.match(serialized, /deepseek-flash/); assert.match(serialized, /manual-openai-model/);
  await act(async () => root.unmount()); root = undefined; await store.close();
  const reloaded = new IndexedDbChatHistoryStore(options); t.after(() => reloaded.close());
  await mount(h(ChatNTCHistoryPanel, { ...props({ transport: local }), historyStore: reloaded })); await readyHistory();
  assert.equal(rootElement.querySelectorAll(".scv-chat-turn").length, 2);
  assert.equal(requests.length, 2);
});

test("BYOK transport snapshots settings for in-flight turn and normalizes sensitive errors", async () => {
  const config = new LocalAIConfiguration();
  config.configure({ provider: "deepseek", model: "deepseek-flash" }, "fixture-key-a");
  let finish;
  const local = new LocalChatTransport(async (_url, init) => {
    assert.equal(new Headers(init.headers).get("x-chatntc-provider"), "deepseek");
    return new Promise((resolve) => { finish = resolve; });
  }, config);
  const pending = local.send({ question: "Test" });
  config.configure({ provider: "gemini", model: "gemini-3.8-flash" }, "fixture-key-b");
  const reply = result(); reply.generation.provider = "deepseek"; reply.generation.model = "deepseek-flash";
  finish(Response.json(reply)); assert.equal((await pending).generation.provider, "deepseek");
  for (const code of ["INVALID_CREDENTIALS", "RATE_LIMIT", "QUOTA_EXCEEDED", "INVALID_MODEL", "PROVIDER_UNAVAILABLE"]) {
    const failing = new LocalChatTransport(async () => Response.json({ error: { code, message: "fixture-secret-upstream" } }, { status: 401 }), config);
    await assert.rejects(failing.send({ question: "Test" }), (error) => error.code === code && !error.message.includes("fixture-secret-upstream"));
  }
});

test("BYOK outside loopback: settings hidden and credentials never leave transport", async (t) => {
  dom.reconfigure({ url: "https://example.org/" });
  t.after(() => dom.reconfigure({ url: "http://localhost:3000/" }));
  const config = new LocalAIConfiguration(); config.configure({ provider: "openai", model: "manual" }, "fixture-key");
  const transport = new LocalChatTransport(async () => assert.fail("No network on remote origin"), config);
  await assert.rejects(transport.send({ question: "Test" }), (error) => error.code === "LOCAL_ONLY");
  t.mock.method(globalThis, "fetch", mockCorpusFetch);
  await mount(h(ComparisonViewer, { chatEnabled: true }));
  await waitFor(() => rootElement.querySelector(".scv-unit"));
  assert.equal(rootElement.querySelector(".scv-ai-settings"), null);
  assert.equal(rootElement.querySelector(".scv-chat"), null);
});

test("standalone local BYOK: settings and PDF coexist without automatic AI calls", async (t) => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  t.after(() => { if (previous === undefined) delete globalThis.indexedDB; else globalThis.indexedDB = previous; });
  t.mock.method(globalThis, "fetch", mockCorpusFetch);
  await mount(h(ComparisonViewer, { chatEnabled: true }));
  await waitFor(() => rootElement.querySelector(".scv-ai-settings"));
  await readyHistory();
  assert.equal(rootElement.querySelector('input[type=password]').value, "");
  const toggle = rootElement.querySelector(".scv-tools-toggle");
  if (toggle.getAttribute("aria-expanded") === "false") await click(toggle);
  await click(rootElement.querySelector(".scv-ai-settings summary"));
  assert.equal(rootElement.querySelector(".scv-ai-settings").open, true);
  await act(async () => rootElement.querySelector('input[type=password]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(rootElement.querySelector(".scv-ai-settings").open, false);
  assert.equal(calls.length, 0);
});
