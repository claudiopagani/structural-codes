import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv from "ajv";
import { DeepSeekAdapter, DEEPSEEK_CHAT_ENDPOINT } from "../.chatntc-test/server/chatntc/deepseek.js";
import { OpenAIAdapter } from "../.chatntc-test/server/chatntc/openai.js";
import { AnthropicAdapter } from "../.chatntc-test/server/chatntc/anthropic.js";
import { GeminiAdapter } from "../.chatntc-test/server/chatntc/gemini.js";
import { PROVIDERS, modelCapabilities } from "../.chatntc-test/app/chatntc/providerRegistry.js";
import { configuredProvider, chatNTCEnabled } from "../.chatntc-test/server/chatntc/config.js";
import { ChatNTCServerError, publicError } from "../.chatntc-test/server/chatntc/errors.js";
import { createLocalArtifactRepository } from "../.chatntc-test/server/chatntc/localRepository.js";
import { runChatNTC } from "../.chatntc-test/server/chatntc/pipeline.js";
import { createChatNTCHandler } from "../.chatntc-test/server/chatntc/routeHandler.js";
import { CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, isChatNTCProviderOutput, isChatNTCResponse, retrieveChatNTCEvidence } from "../.chatntc-test/shared/chatntc/index.js";

// Synthetic credential used only with injected fetch. No test calls the real provider.
const key = "fixture-secret-chatntc-never-a-real-api-key";
const enabled = { NODE_ENV: "test", CHATNTC_ENABLED: "true", CHATNTC_PROVIDER: "deepseek", CHATNTC_DEEPSEEK_API_KEY: key };
const directory = fileURLToPath(new URL("../public/data/codes", import.meta.url));
const repository = () => createLocalArtifactRepository(directory);
const question = "7.3.6.1";
const request = (value = { question }, options = {}) => new Request("http://localhost:3000/api/chatntc", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value), ...options,
});
const mockEnvelope = (value, options = {}) => Response.json({ choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(value) }, ...options }] });

function validResponse(input) {
  return { formatVersion: 2, evidencePackageId: input.evidence.packageId,
    answerMarkdown: "Il §7.3.6.1 è il riferimento pertinente.", references: ["NTC 2018 §7.3.6.1"],
    classification: "direct-reference", status: "answered", needsMoreEvidence: false, externalResearchSuggested: false };
}

function providerOutput(input, overrides = {}) {
  return { ...validResponse(input), ...overrides };
}

async function generationInput() {
  return { messages: [{ role: "user", content: "Contesto precedente." }, { role: "assistant", content: "Risposta precedente non autorevole." }, { role: "user", content: question }],
    evidence: await retrieveChatNTCEvidence(repository(), question, { maxRelatedUnits: 0 }),
    directives: CHATNTC_DIRECTIVES, outputSchema: CHATNTC_RESPONSE_JSON_SCHEMA };
}

function mockedProvider(generate = async (input) => validResponse(input)) {
  return { id: "fixture", capabilities: { structuredOutput: true, streaming: false }, generate };
}
const handler = (options = {}) => createChatNTCHandler({ environment: () => enabled, repository,
  provider: () => mockedProvider(), ...options });
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => {
  assert.equal(error.code, code);
  assert.equal(`${error.stack}${JSON.stringify(error)}${JSON.stringify(publicError(error))}`.includes(key), false);
  return true;
});

test("DeepSeek: endpoint, auth server-side, messages, direttive e JSON request corretti", async () => {
  const input = await generationInput();
  let calls = 0;
  const adapter = new DeepSeekAdapter({ apiKey: key }, async (url, init) => {
    calls += 1;
    assert.equal(url, DEEPSEEK_CHAT_ENDPOINT);
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, `Bearer ${key}`);
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    const body = JSON.parse(init.body);
    assert.equal(body.model, "deepseek-flash");
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal(body.stream, false);
    assert.equal(body.max_tokens, 8192);
    assert.equal(body.tools, undefined);
    assert.equal(body.messages[0].role, "system");
    for (const rule of CHATNTC_DIRECTIVES.rules) assert.ok(body.messages[0].content.includes(rule));
    assert.ok(body.messages[0].content.includes(JSON.stringify(CHATNTC_RESPONSE_JSON_SCHEMA)));
    assert.deepEqual(body.messages.slice(1, -1), input.messages);
    const context = JSON.parse(body.messages.at(-1).content);
    assert.deepEqual(context.evidence, input.evidence);
    assert.equal(context.kind, "chatntc-normative-context");
    assert.equal(init.body.includes(key), false);
    return mockEnvelope(validResponse(input));
  });
  const response = await adapter.generate(input);
  assert.equal(calls, 1);
  assert.ok(isChatNTCProviderOutput(response));
  assert.equal(JSON.stringify(adapter).includes(key), false);
  assert.equal(JSON.stringify(response).includes(key), false);
  assert.deepEqual(adapter.capabilities, { structuredOutput: true, outputMode: "json-object", streaming: false, cancellation: true, toolCalling: false, reasoning: "disabled" });
});

test("schema JSON condiviso e guard runtime concordano sul contratto strutturale", async () => {
  const validate = new Ajv({ allErrors: true }).compile(CHATNTC_RESPONSE_JSON_SCHEMA);
  const valid = validResponse(await generationInput());
  for (const value of [valid, null, [], {}, { ...valid, unexpected: true }, { ...valid, references: [""] },
    { ...valid, classification: "invented" }, { ...valid, answerMarkdown: "" }, { ...valid, needsMoreEvidence: "yes" }]) {
    assert.equal(Boolean(validate(value)), isChatNTCProviderOutput(value), JSON.stringify(validate.errors));
  }
});

for (const [name, fetchImpl, code] of [
  ["errore HTTP 401", async () => new Response(key, { status: 401 }), "INVALID_CREDENTIALS"],
  ["errore HTTP 429", async () => new Response(key, { status: 429 }), "RATE_LIMIT"],
  ["errore HTTP 503", async () => new Response(key, { status: 503 }), "PROVIDER_UNAVAILABLE"],
  ["eccezione fetch con segreto", async () => { throw new Error(key); }, "PROVIDER_ERROR"],
  ["envelope JSON malformato", async () => new Response("{broken"), "INVALID_PROVIDER_JSON"],
  ["envelope senza choices", async () => Response.json({ unexpected: true }), "INVALID_PROVIDER_RESPONSE"],
  ["JSON del modello malformato", async () => Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "{broken" } }] }), "INVALID_PROVIDER_JSON"],
  ["output vuoto", async () => Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: " " } }] }), "INVALID_PROVIDER_RESPONSE"],
  ["schema violato", async () => mockEnvelope({ answer: "incomplete" }), "INVALID_RESPONSE_SCHEMA"],
  ["output troncato", async () => mockEnvelope({}, { finish_reason: "length" }), "INVALID_PROVIDER_RESPONSE"],
  ["content filter", async () => mockEnvelope({}, { finish_reason: "content_filter" }), "INVALID_PROVIDER_RESPONSE"],
  ["tool call inattesa", async () => mockEnvelope({}, { finish_reason: "tool_calls" }), "INVALID_PROVIDER_RESPONSE"],
  ["envelope oltre limite", async () => new Response(" ".repeat(1_048_577)), "INVALID_PROVIDER_RESPONSE"],
]) test(`DeepSeek rifiuta ${name} senza diffondere dettagli upstream`, async () => {
  const adapter = new DeepSeekAdapter({ apiKey: key }, fetchImpl);
  await rejectsCode(adapter.generate(await generationInput()), code);
});

test("chiave eventualmente riflessa dal provider non può raggiungere il client", async () => {
  const input = await generationInput();
  const value = { ...validResponse(input), answerMarkdown: key };
  const adapter = new DeepSeekAdapter({ apiKey: key }, async () => mockEnvelope(value));
  await rejectsCode(adapter.generate(input), "INVALID_PROVIDER_RESPONSE");
  const escaped = new DeepSeekAdapter({ apiKey: key }, async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(value).replace(key, key.split("").map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")) } }] })));
  await rejectsCode(escaped.generate(input), "INVALID_PROVIDER_RESPONSE");
});

test("timeout termina fetch e lettura del body, anche con trasporto mock", async () => {
  const input = await generationInput();
  let transportSignal;
  const adapter = new DeepSeekAdapter({ apiKey: key, timeoutMs: 10 }, async (_url, init) => {
    transportSignal = init.signal;
    return await new Promise(() => {});
  });
  await rejectsCode(adapter.generate(input), "PROVIDER_TIMEOUT");
  assert.equal(transportSignal.aborted, true);
  let cancelled = false;
  const hangingBody = new DeepSeekAdapter({ apiKey: key, timeoutMs: 10 }, async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode("{")); },
    cancel() { cancelled = true; },
  })));
  await rejectsCode(hangingBody.generate(input), "PROVIDER_TIMEOUT");
  assert.equal(cancelled, true);
});

test("cancellazione del client impedisce l'avvio del provider", async () => {
  const signal = AbortSignal.abort();
  let calls = 0;
  const adapter = new DeepSeekAdapter({ apiKey: key }, async () => { calls += 1; throw new Error("unexpected"); });
  await rejectsCode(adapter.generate({ ...await generationInput(), signal }), "REQUEST_ABORTED");
  assert.equal(calls, 0);
});

test("configurazione: provider, chiave, modello e timeout sono solo server-side", () => {
  for (const [env, code] of [[{}, "PROVIDER_NOT_CONFIGURED"], [{ CHATNTC_PROVIDER: "unsupported" }, "PROVIDER_NOT_CONFIGURED"],
    [{ CHATNTC_PROVIDER: "deepseek" }, "API_KEY_MISSING"], [{ ...enabled, CHATNTC_DEEPSEEK_MODEL: "https://untrusted.example" }, "INVALID_PROVIDER_CONFIG"],
    [{ ...enabled, CHATNTC_DEEPSEEK_TIMEOUT_MS: "NaN" }, "INVALID_PROVIDER_CONFIG"]]) {
    assert.throws(() => configuredProvider(env), (error) => error.code === code);
  }
  assert.equal(chatNTCEnabled({ ...enabled, NODE_ENV: "production" }), false);
  assert.equal(chatNTCEnabled({ ...enabled, NODE_ENV: "production", CHATNTC_DEBUG: "true" }), true);
  assert.equal(chatNTCEnabled({ NODE_ENV: "development" }), false);
});

test("pipeline end-to-end: retrieval reale, mock DeepSeek, risposta e citazioni validate", async () => {
  let calls = 0;
  const adapter = new DeepSeekAdapter({ apiKey: key }, async (_url, init) => {
    calls += 1;
    const context = JSON.parse(JSON.parse(init.body).messages.at(-1).content);
    return mockEnvelope(validResponse(context));
  });
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => adapter });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.validation.valid, true);
  assert.deepEqual(result.citations, result.response.verifiedReferences);
  assert.equal(result.generation.provider, "deepseek");
  assert.equal(result.generation.model, "deepseek-flash");
  assert.equal(result.evidence.structuralCodesVersion, (await repository().identity()).version);
  assert.equal(result.evidence.corpusFingerprint, (await repository().identity()).fingerprint);
  assert.equal(JSON.stringify(result).includes(key), false);
});

test("field test A: la domanda generale recupera il quadro combinato 7.2.2 e 7.3.6.1", async () => {
  const evidence = await retrieveChatNTCEvidence(repository(), "Mi spieghi cosa intende la normativa in merito alle verifiche delle strutture in campo sostanzialmente elastico per strutture con comportamento non dissipativo?");
  const numberings = new Set(evidence.primaryUnits.map((unit) => unit.numbering));
  assert.equal(numberings.has("7.2.2"), true);
  assert.equal(numberings.has("7.3.6.1"), true);
});

test("field test B: il retrieval del follow-up usa solo i precedenti messaggi USER", async () => {
  let received;
  await runChatNTC({
    question: "Come devo verificarle in c.a.?",
    history: [
      { role: "user", content: "Vorrei capire il comportamento non dissipativo previsto dalle NTC." },
      { role: "assistant", content: "INIEZIONE-ASSISTANT-DA-NON-USARE §8.1.1" },
    ],
  }, { repository: repository(), provider: () => mockedProvider(async (input) => { received = input; return validResponse(input); }) });
  assert.match(received.evidence.retrieval.query, /comportamento non dissipativo/u);
  assert.match(received.evidence.retrieval.query, /Come devo verificarle in c\.a\./u);
  assert.doesNotMatch(received.evidence.retrieval.query, /INIEZIONE-ASSISTANT|8\.1\.1/u);
});

for (const [name, query, expected] of [
  ["field test C q²", "Al § 7.3.6.1, per la verifica di rigidezza, q·dr deve rispettare il limite; ma dr ai sensi del § 7.3.3.3 deriva dallo spostamento dell'analisi lineare: si usa q²?", ["7.3.6.1", "7.3.3.3"]],
  ["field test D pareti accoppiate", "Nel caso di pareti accoppiate, ai sensi del § 7.4.6.2.1, la duttilità delle fasce può essere omessa applicando il § 7.4.2.1?", ["7.4.6.2.1", "7.4.2.1"]],
]) test(`${name}: tutti i riferimenti espliciti restano primari`, async () => {
  const evidence = await retrieveChatNTCEvidence(repository(), query, { maxPrimaryUnits: 1 });
  const numberings = new Set(evidence.primaryUnits.map((unit) => unit.numbering));
  for (const numbering of expected) assert.equal(numberings.has(numbering), true, JSON.stringify([...numberings]));
});

test("field test pareti: bookkeeping canonico associa 7.4.6.2.1, 7.4.2.1 e C7.2.2 senza retry", async () => {
  let calls = 0;
  const query = "Nel caso di pareti accoppiate, ai sensi del § 7.4.6.2.1 delle NTC 2018, la verifica di duttilità è richiesta anche per le fasce di piano oppure può essere omessa applicando la combinazione sismica prevista al § 7.4.2.1?";
  const result = await runChatNTC({ question: query }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return providerOutput(input, { answerMarkdown: "Non automaticamente. Il § 7.4.6.2.1 e il § 7.4.2.1 vanno letti insieme a C7.2.2 per distinguere le verifiche delle fasce.",
      references: ["NTC 2018 §7.4.6.2.1", "NTC 2018 §7.4.2.1", "C7.2.2"], classification: "interpretation" });
  }) });
  assert.equal(calls, 1);
  assert.equal(result.response.classification, "interpretation");
  assert.deepEqual(new Set(result.citations.map((citation) => citation.numbering)), new Set(["7.4.6.2.1", "7.4.2.1", "C7.2.2"]));
  assert.notEqual(result.validation.stage, "REPAIRED");
});

test("field test q²: 7.3.4 e formula 7.3.8 sono risolti post-hoc senza rigenerare", async () => {
  let calls = 0;
  const query = "Al § 7.3.6.1, per la verifica di rigidezza, la norma richiede che q·dr sia inferiore a un limite funzione dell’altezza interpiano. Ma dr, ai sensi del § 7.3.3.3, deriva già dallo spostamento dell’analisi lineare moltiplicato per un fattore di duttilità che può essere pari a q. Quindi lo spostamento ottenuto dal modello deve essere moltiplicato per q²?";
  const result = await runChatNTC({ question: query }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return providerOutput(input, { answerMarkdown: "No: non devi moltiplicare automaticamente lo spostamento del modello per q². Il § 7.3.3.3 e le formule [7.3.8] e [7.3.9] definiscono il passaggio dallo spostamento elastico. La verifica del § 7.3.6.1 non introduce automaticamente un secondo fattore q; il § 7.3.4 completa il quadro.",
      references: ["NTC 2018 §7.3.3.3", "NTC 2018 §7.3.6.1", "formula [7.3.8]", "formula [7.3.9]", "NTC 2018 §7.3.4"], classification: "interpretation" });
  }) });
  assert.equal(calls, 1);
  assert.equal(result.response.classification, "interpretation");
  assert.equal(result.validation.stage, "REFERENCES_RESOLVED");
  assert.ok(result.citations.some((citation) => citation.assetId?.endsWith("7.3.3.3-7.3.8")));
  assert.ok(result.citations.some((citation) => citation.assetId?.endsWith("7.3.3.3-7.3.9")));
  assert.match(result.response.answerMarkdown, /^No:/u);
  assert.doesNotMatch(result.response.answerMarkdown, /evidence|source-checked|unitId|retrieval|validator/iu);
});

test("field test sistema a pareti: riferimenti post-hoc reali e tabella arrivano all'utente", async () => {
  let calls = 0;
  const query = "In un edificio in c.a. con pareti principali ed elementi secondari, quali verifiche aggiuntive devo considerare?";
  const result = await runChatNTC({ question: query }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return providerOutput(input, { answerMarkdown: "Il punto chiave è separare il sistema resistente principale dagli elementi secondari. Vanno coordinati il §7.2.3, il §7.2.5, il §7.3.6.1 e il §7.4.4.1.2; la Tab.7.2.I completa il quadro delle verifiche.",
      references: ["NTC 2018 §7.2.3", "NTC 2018 §7.2.5", "NTC 2018 §7.3.6.1", "NTC 2018 §7.4.4.1.2", "Tab.7.2.I"],
      classification: "combined-reference" });
  }) });
  assert.equal(calls, 1);
  assert.equal(result.validation.stage, "REFERENCES_RESOLVED");
  assert.deepEqual(new Set(result.citations.map((citation) => citation.assetNumber ?? citation.numbering)),
    new Set(["7.2.3", "7.2.5", "7.3.6.1", "7.4.4.1.2", "7.2.I"]));
});

test("field test non dissipativo: §4.1.2.3.4.2 viene risolto post-hoc senza bloccare", async () => {
  let calls = 0;
  const result = await runChatNTC({ question: "Quali regole restano applicabili al comportamento non dissipativo?" }, {
    repository: repository(), provider: () => mockedProvider(async (input) => {
      calls += 1;
      return providerOutput(input, { answerMarkdown: "Non tutte le regole della progettazione dissipativa si trasferiscono automaticamente. Il §4.1.2.3.4.2 resta un riferimento utile per la verifica degli elementi in calcestruzzo armato.",
        references: ["NTC 2018 §4.1.2.3.4.2"], classification: "interpretation" });
    }),
  });
  assert.equal(calls, 1);
  assert.ok(result.citations.some((citation) => citation.numbering === "4.1.2.3.4.2"));
  assert.notEqual(result.validation.stage, "REPAIRED");
});

test("formula inesistente non diventa un riferimento verificato e non elimina la parte generale", async () => {
  let calls = 0;
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return { ...validResponse(input), answerMarkdown: "La formula [7.99.99] imporrebbe il controllo. Dal punto di vista progettuale resta utile una verifica di sensibilità.",
      references: ["formula [7.99.99]"] };
  }) });
  assert.equal(calls, 2);
  assert.doesNotMatch(result.response.answerMarkdown, /7\.99\.99/u);
  assert.match(result.response.answerMarkdown, /verifica di sensibilità/u);
  assert.equal(result.citations.some((citation) => citation.assetNumber === "7.99.99"), false);
});

test("classification mismatch e lessico backend sono normalizzati senza repair", async () => {
  let calls = 0;
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return { ...validResponse(input), classification: "combined-reference",
      answerMarkdown: "L'Evidence Package e il retrieval indicano il §7.3.6.1." };
  }) });
  assert.equal(calls, 1);
  assert.equal(result.response.classification, "direct-reference");
  assert.doesNotMatch(result.response.answerMarkdown, /evidence|package|retrieval/iu);
  assert.equal(result.validation.stage, "REFERENCES_RESOLVED");
});

test("pipeline: risolve deterministicamente un riferimento canonico reale fuori retrieval senza retry", async () => {
  const inputs = [];
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    inputs.push(structuredClone(input));
    return { ...validResponse(input), answerMarkdown: "La lettura va coordinata con §4.1.", references: ["NTC 2018 §4.1"] };
  }) });
  assert.equal(inputs.length, 1);
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.stage, "REFERENCES_RESOLVED");
  assert.ok(result.citations.some((citation) => citation.numbering === "4.1"));
});

test("pipeline: un solo repair e sanitizzazione conservativa preservano il contenuto generale", async () => {
  let calls = 0;
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    if (calls === 2) assert.ok(input.repair?.previousOutput.answerMarkdown.includes("§7.99.4"));
    return { ...validResponse(input), answerMarkdown: "Come prescritto dal §7.99.4, il modello va modificato. Il controllo di sensibilità resta comunque utile.", references: ["§7.99.4"] };
  }) });
  assert.equal(calls, 2);
  assert.equal(result.validation.stage, "DEGRADED");
  assert.equal(result.response.referenceWarning, "no-references-verified");
  assert.doesNotMatch(result.response.answerMarkdown, /7\.99\.4/u);
  assert.match(result.response.answerMarkdown, /controllo di sensibilità/u);
});

test("pipeline: un riferimento inventato attiva un solo repair mirato", async () => {
  let calls = 0;
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return calls === 1 ? { ...validResponse(input), answerMarkdown: "Fonte inventata §7.99.4.", references: ["§7.99.4"] }
      : { ...validResponse(input), answerMarkdown: "Il §7.3.6.1 è il riferimento verificabile.", references: ["§7.3.6.1"] };
  }) });
  assert.equal(calls, 2);
  assert.equal(result.validation.stage, "REPAIRED");
  assert.deepEqual(result.citations.map((citation) => citation.numbering), ["7.3.6.1"]);
});

test("pipeline: no-direct-reference answered resta una risposta generata", async () => {
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    const response = validResponse(input);
    response.answerMarkdown = "Dal punto di vista progettuale conviene controllare la sensibilità del modello.";
    response.references = [];
    response.classification = "no-direct-reference";
    return response;
  }) });
  assert.equal(result.response.status, "answered");
  assert.equal(result.response.classification, "no-direct-reference");
  assert.equal(result.generation.outcome, "generated");
  assert.equal(result.citations.length, 0);
});

test("regressione ponte in muratura: la risposta resta visibile e i riferimenti equivalenti sono deduplicati", async () => {
  const bridgeQuestion = "devo verificare un ponte in muratura ad arco avente una larghezza della carreggiata pari ad una corsia, per una strada di campagna con pavimentazione bianca, mi fai una panoramica dei carichi da traffico sui ponti esistenti per poterlo inserire come analisi dei carichi della mia struttura? mi dici in quali paragrafi devo guardare?";
  const references = ["§5.1", "§5.1.2", "§5.1.2.1", "§5.1.2.2", "§8.1", "§8.2", "§8.3", "§8.4",
    "C5.1", "C8.4", "§C8.4", "§8.5.4", "§C8.5.4", "§C5.1"];
  let calls = 0;
  const result = await runChatNTC({ question: bridgeQuestion }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return providerOutput(input, { answerMarkdown: "Per l'analisi conviene distinguere geometria del ponte, schema di traffico e verifiche sull'esistente.",
      references, classification: "combined-reference" });
  }) });
  assert.equal(calls, 1);
  assert.match(result.response.answerMarkdown, /analisi/u);
  assert.equal(result.citations.length, 12);
  assert.equal(new Set(result.citations.map((reference) => `${reference.unitId}|${reference.blockId ?? ""}|${reference.assetId ?? ""}`)).size, 12);
  assert.equal(result.response.referenceWarning, undefined);
  assert.equal(result.validation.stage, "REFERENCES_RESOLVED");
});

test("venti riferimenti reali fuori dal retrieval iniziale sono tutti verificati senza limite post-hoc", async () => {
  const references = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "3.1", "3.2", "3.2.1", "3.2.2",
    "4.1", "4.1.1", "4.1.2", "5.1", "5.1.1", "5.1.2", "7.1", "7.2", "8.1", "8.2"].map((number) => `§${number}`);
  const base = repository();
  const noInitialHits = { ...base, search: async () => [] };
  let selected = [];
  const result = await runChatNTC({ question: "zzzzxy nessuna corrispondenza lessicale" }, {
    repository: noInitialHits, retrievalOptions: { maxRelatedUnits: 0 }, provider: () => mockedProvider(async (input) => {
      selected = input.evidence.primaryUnits.map((unit) => unit.unitId);
      return providerOutput(input, { answerMarkdown: "Panoramica tecnica generale disponibile.", references, classification: "combined-reference" });
    }),
  });
  assert.deepEqual(selected, []);
  assert.equal(result.citations.length, 20);
  assert.ok(result.citations.every((reference) => !("evidenceId" in reference)));
  assert.equal(result.response.referenceWarning, undefined);
});

test("dieci riferimenti reali e uno inesistente conservano risposta e riferimenti validi", async () => {
  const valid = ["§2.1", "§2.2", "§2.3", "§2.4", "§2.5", "§2.6", "§3.1", "§3.2", "§4.1", "§5.1"];
  let calls = 0;
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    calls += 1;
    return providerOutput(input, { answerMarkdown: "Il §7.99.4 imporrebbe un controllo inventato. Resta utile organizzare le verifiche per famiglie di azioni.",
      references: [...valid, "§7.99.4"], classification: "combined-reference" });
  }) });
  assert.equal(calls, 2);
  assert.equal(result.citations.length, 10);
  assert.match(result.response.answerMarkdown, /famiglie di azioni/u);
  assert.doesNotMatch(result.response.answerMarkdown, /7\.99\.4/u);
  assert.equal(result.response.referenceWarning, "some-references-omitted");
});

test("riferimento ambiguo viene omesso senza nascondere la risposta", async () => {
  const base = repository();
  const [left, right] = await Promise.all([base.resolveExact("§8.1"), base.resolveExact("§8.2")]);
  const ambiguous = { ...base, resolveExact: async (query, document) => query.replace(/\s/gu, "") === "§6.6.6"
    ? [left[0], right[0]] : base.resolveExact(query, document) };
  const result = await runChatNTC({ question }, { repository: ambiguous, provider: () => mockedProvider(async (input) => providerOutput(input, {
    answerMarkdown: "Il §6.6.6 imporrebbe un controllo. È comunque utile confrontare scenari di carico alternativi.",
    references: ["§6.6.6"], classification: "direct-reference",
  })) });
  assert.match(result.response.answerMarkdown, /scenari di carico/u);
  assert.doesNotMatch(result.response.answerMarkdown, /6\.6\.6/u);
  assert.deepEqual(result.citations, []);
  assert.equal(result.response.referenceWarning, "no-references-verified");
});

test("tutti i riferimenti non verificabili lasciano visibile la parte tecnica generale", async () => {
  const result = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => providerOutput(input, {
    answerMarkdown: "Il §7.99.4 prescrive un valore. La formula [7.99.99] impone un limite. Dal punto di vista progettuale conviene confrontare più scenari di carico.",
    references: ["§7.99.4", "formula [7.99.99]"], classification: "combined-reference",
  })) });
  assert.equal(result.citations.length, 0);
  assert.equal(result.response.referenceWarning, "no-references-verified");
  assert.equal(result.validation.stage, "DEGRADED");
  assert.match(result.response.answerMarkdown, /confrontare più scenari/u);
  assert.doesNotMatch(result.response.answerMarkdown, /7\.99/u);
});

test("pipeline respinge output mock malformato e normalizza l'identificativo del pacchetto", async () => {
  await rejectsCode(runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async () => ({ answer: "incomplete" })) }), "INVALID_RESPONSE_SCHEMA");
  const normalized = await runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    const response = validResponse(input);
    response.evidencePackageId = "sha256:invented";
    return response;
  }) });
  assert.equal(normalized.response.evidencePackageId, normalized.evidence.packageId);
  assert.ok(normalized.validation.diagnostics.some((issue) => issue.code === "wrong-package"));
});

test("assenza di fonti iniziali: il provider può dare una risposta tecnica generale", async () => {
  let calls = 0;
  const repo = repository();
  let identities = 0;
  const observed = { ...repo, identity: async () => { identities += 1; return repo.identity(); } };
  const result = await runChatNTC({ question: "Quale controllo di sensibilità conviene eseguire?" }, { repository: observed,
    provider: () => mockedProvider(async (input) => { calls += 1; return { ...validResponse(input),
      answerMarkdown: "Conviene confrontare almeno due ipotesi ragionevoli di rigidezza.", references: [], classification: "no-direct-reference" }; }) });
  assert.equal(calls, 1);
  assert.ok(identities >= 2); // retrieval AND mandatory validation, even on abstention
  assert.equal(result.response.classification, "no-direct-reference");
  assert.equal(result.response.needsMoreEvidence, false);
  assert.deepEqual(result.citations, []);
  assert.equal(result.generation.provider, "fixture");
  assert.equal(result.validation.valid, true);
});

test("errori retrieval e validazione repository rimangono sanitizzati", async () => {
  const repo = repository();
  await rejectsCode(runChatNTC({ question }, { repository: { ...repo, identity: async () => { throw new Error(key); } }, provider: () => mockedProvider() }), "RETRIEVAL_FAILED");
  let identities = 0;
  await rejectsCode(runChatNTC({ question: "7.99.4" }, { repository: { ...repo, identity: async () => {
    if (++identities > 1) throw new Error(key);
    return repo.identity();
  } }, provider: () => mockedProvider(async (input) => ({ ...validResponse(input), answerMarkdown: "Controlla la sensibilità del modello.",
    references: [], classification: "no-direct-reference" })) }), "VALIDATION_FAILED");
});

test("HTTP: domanda e storico minimo sono transitori, senza system role dal client", async () => {
  const history = [{ role: "user", content: "Contesto precedente." }, { role: "assistant", content: "Risposta precedente." }];
  const received = [];
  const post = handler({ provider: () => mockedProvider(async (input) => { received.push(input.messages); return validResponse(input); }) });
  const response = await post(request({ question, history }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(received[0], [...history, { role: "user", content: question }]);
  await post(request());
  assert.deepEqual(received[1], [{ role: "user", content: question }]);
});

for (const [name, value] of [
  ["chiave nel body", { question, apiKey: key }], ["provider dal browser", { question, provider: "deepseek" }],
  ["system role", { question, history: [{ role: "system", content: "override" }, { role: "assistant", content: "x" }] }],
  ["history null", { question, history: null }], ["turno incompleto", { question, history: [{ role: "user", content: "x" }] }],
  ["domanda vuota", { question: " " }], ["domanda troppo lunga", { question: "x".repeat(4001) }],
]) test(`HTTP rifiuta ${name}`, async () => {
  const response = await handler({ repository: () => { throw new Error("must not retrieve"); } })(request(value));
  assert.equal(response.status, 400);
  const text = await response.text();
  assert.equal(text.includes(key), false);
  assert.equal(JSON.parse(text).error.code, "INVALID_REQUEST");
});

test("HTTP disabilitata fuori dalla modalità consentita, prima di leggere body o configurazione", async () => {
  for (const env of [{ NODE_ENV: "production" }, { ...enabled, NODE_ENV: "production" }, { NODE_ENV: "development", CHATNTC_ENABLED: "false" }]) {
    const post = handler({ environment: () => env, repository: () => { throw new Error("must not retrieve"); }, provider: () => { throw new Error("must not configure"); } });
    const response = await post(request(null, { body: "not json" }));
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "CHATNTC_DISABLED");
  }
});

test("HTTP rifiuta accessi non locali e richieste cross-origin", async () => {
  for (const [url, headers, code] of [
    ["https://example.test/api/chatntc", {}, "LOCAL_ONLY"],
    ["http://localhost:3000/api/chatntc", { origin: "https://example.test" }, "ORIGIN_NOT_ALLOWED"],
    ["http://localhost:3000/api/chatntc", { "sec-fetch-site": "cross-site" }, "ORIGIN_NOT_ALLOWED"],
    ["http://localhost:3000/api/chatntc", { host: "example.test" }, "LOCAL_ONLY"],
  ]) {
    const response = await handler()(new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ question }) }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, code);
  }
});

test("HTTP limita il body realmente letto e richiede JSON", async () => {
  const tooLarge = await handler()(request(null, { body: " ".repeat(65_537) }));
  assert.equal(tooLarge.status, 413);
  const wrongType = await handler()(request({}, { headers: { "content-type": "text/plain" } }));
  assert.equal(wrongType.status, 415);
  const invalid = await handler()(request({}, { body: "{broken" }));
  assert.equal(invalid.status, 400);
});

test("HTTP mappa errori distinti senza restituire output o citazioni non validati", async () => {
  for (const [provider, status, code] of [
    [() => configuredProvider({}), 503, "PROVIDER_NOT_CONFIGURED"],
    [() => configuredProvider({ CHATNTC_PROVIDER: "deepseek" }), 503, "API_KEY_MISSING"],
    [() => mockedProvider(async () => { throw new ChatNTCServerError("PROVIDER_TIMEOUT"); }), 504, "PROVIDER_TIMEOUT"],
    [() => mockedProvider(async () => { throw new Error(key); }), 502, "PROVIDER_ERROR"],
  ]) {
    const response = await handler({ provider })(request());
    assert.equal(response.status, status);
    const raw = await response.text();
    const body = JSON.parse(raw);
    assert.equal(body.error.code, code);
    assert.equal(body.response, undefined);
    assert.equal(body.citations, undefined);
    assert.equal(raw.includes(key), false);
    assert.equal(body.error.diagnostics, undefined);
  }
});

test("gli errori pubblici non espongono diagnostica di reference processing", () => {
  const error = new ChatNTCServerError("VALIDATION_FAILED");
  assert.equal(publicError(error, false).body.error.diagnostics, undefined);
  assert.equal(publicError(error, true).body.error.diagnostics, undefined);
});

test("server-only impedisce l'import dell'adapter in condizioni client/Node ordinarie", () => {
  const url = new URL("../.chatntc-test/server/chatntc/deepseek.js", import.meta.url);
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(url.href)})`], {
    encoding: "utf8", windowsHide: true, env: { ...process.env, NODE_OPTIONS: "" },
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /cannot be imported from a Client Component/);
});

test("contesto viewer: recupero canonico deterministico e ricerca della domanda sempre eseguita", async () => {
  const repo = repository();
  const unitId = (await repo.resolveExact("C7.3.6.1"))[0].unitId;
  const context = { documentId: "circ2019", unitId, numbering: "C7.3.6.1" };
  const searches = [];
  const evidence = await retrieveChatNTCEvidence({ ...repo, search: async (...args) => { searches.push(args); return repo.search(...args); } }, "Spiegami questo paragrafo", { context });
  assert.equal(searches.length, 1);
  assert.equal(searches[0][0], "Spiegami questo paragrafo");
  assert.equal(searches[0][2], undefined); // A context is not a document filter.
  assert.equal(evidence.primaryUnits[0].unitId, unitId);
  assert.ok(evidence.primaryUnits[0].reasons.some((reason) => reason.kind === "viewer-context"));
  assert.deepEqual(evidence, await retrieveChatNTCEvidence(repository(), "Spiegami questo paragrafo", { context }));
  const combined = await retrieveChatNTCEvidence(repository(), question, { context });
  assert.ok(combined.primaryUnits.some((unit) => unit.numbering === question && unit.document === "ntc2018"));
  assert.ok(combined.primaryUnits.some((unit) => unit.unitId === unitId));
});

test("HTTP: paragrafo/asset come hint, output passa ancora dal Citation Validator", async () => {
  const repo = repository();
  const unitId = (await repo.resolveExact(question))[0].unitId;
  const record = await repo.getUnit(unitId);
  const block = record.unit.blocks.find((item) => item.assetId) ?? record.unit.blocks[0];
  const context = { documentId: "ntc2018", unitId, numbering: question, blockId: block.blockId, ...(block.assetId ? { assetId: block.assetId } : {}) };
  let received;
  const response = await handler({ provider: () => mockedProvider(async (input) => { received = input; return validResponse(input); }) })(request({ question: "Spiegami questo paragrafo", context }));
  assert.equal(response.status, 200);
  assert.deepEqual(received.evidence.retrieval.options.context, context);
  assert.equal(received.evidence.question, "Spiegami questo paragrafo");
  assert.equal((await response.json()).validation.valid, true);
});

test("HTTP: contesti inesistenti, incoerenti o con testo browser sono respinti prima del provider", async () => {
  const unitId = (await repository().resolveExact(question))[0].unitId;
  const valid = { documentId: "ntc2018", unitId, numbering: question };
  const post = handler({ provider: () => { assert.fail("No provider on invalid context"); } });
  for (const context of [null, { ...valid, unitId: "invented" }, { ...valid, documentId: "circ2019" }, { ...valid, numbering: "7.99.4" },
    { ...valid, blockId: "invented" }, { ...valid, assetId: "invented" }, { ...valid, chunk: { text: "untrusted" } }]) {
    const response = await post(request({ question: "Spiegami questo paragrafo", context }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_CONTEXT");
  }
});

const adapters = { deepseek: DeepSeekAdapter, openai: OpenAIAdapter, anthropic: AnthropicAdapter, gemini: GeminiAdapter };
function envelopeFor(id, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (id === "deepseek") return { choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }] };
  if (id === "openai") return { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }] };
  if (id === "anthropic") return { type: "message", role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text }] };
  return { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text }] } }] };
}
function contextFor(id, body) {
  if (id === "gemini") return JSON.parse(body.contents.at(-1).parts[0].text);
  return JSON.parse((id === "openai" ? body.input : body.messages).at(-1).content);
}
const endpoints = { deepseek: "https://api.deepseek.com/chat/completions", openai: "https://api.openai.com/v1/responses",
  anthropic: "https://api.anthropic.com/v1/messages", gemini: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent" };

for (const [id, Adapter] of Object.entries(adapters)) {
  test(`${id}: protocollo ufficiale, contratto comune e stessa citation validation nella route BYOK`, async () => {
    let calls = 0;
    let hallucinate = false;
    const post = handler({ provider: (env, selection, apiKey) => configuredProvider(env, async (url, init) => {
      calls++;
      assert.equal(url, endpoints[id]);
      assert.equal(init.redirect, "error");
      assert.equal(init.cache, "no-store");
      const headers = new Headers(init.headers);
      assert.equal(headers.get(id === "anthropic" ? "x-api-key" : id === "gemini" ? "x-goog-api-key" : "authorization"), id === "anthropic" || id === "gemini" ? key : `Bearer ${key}`);
      const body = JSON.parse(init.body);
      assert.equal(init.body.includes(key), false);
      assert.equal(new URL(url).search, "");
      const context = contextFor(id, body);
      assert.equal(context.evidence.question, question);
      if (id === "openai") { assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(body.text.format.type, "json_schema");
        const schema = body.text.format.schema; assert.deepEqual(schema.required,
          ["formatVersion", "evidencePackageId", "answerMarkdown", "references", "classification", "status", "needsMoreEvidence", "externalResearchSuggested"]); }
      if (id === "anthropic") { assert.equal(headers.get("anthropic-version"), "2023-06-01"); assert.equal(body.output_config.format.type, "json_schema"); assert.ok(body.system.includes(CHATNTC_DIRECTIVES.rules[0])); }
      if (id === "gemini") { assert.equal(body.generationConfig.responseFormat.text.mimeType, "application/json"); assert.ok(body.systemInstruction.parts[0].text.includes(CHATNTC_DIRECTIVES.rules[0])); }
      const answer = validResponse({ evidence: context.evidence });
      if (hallucinate) { answer.answerMarkdown = "Secondo il §7.99.4."; answer.references = ["§7.99.4"]; }
      return Response.json(envelopeFor(id, answer));
    }, selection, apiKey) });
    const headers = { "content-type": "application/json", origin: "http://localhost:3000", "x-chatntc-provider": id,
      "x-chatntc-model": PROVIDERS[id].models[0], "x-chatntc-api-key": key };
    const response = await post(request({ question }, { headers }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(isChatNTCResponse(result.response)); assert.equal(result.validation.valid, true);
    assert.equal(result.generation.provider, id); assert.equal(result.generation.model, PROVIDERS[id].models[0]);
    assert.equal(JSON.stringify(result).includes(key), false);
    hallucinate = true;
    const invalid = await post(request({ question }, { headers }));
    assert.equal(invalid.status, 200);
    const degraded = await invalid.json();
    assert.equal(degraded.response.referenceWarning, "no-references-verified");
    assert.equal(degraded.response.verifiedReferences.length, 0);
    assert.doesNotMatch(degraded.response.answerMarkdown, /7\.99\.4/u);
    assert.equal(calls, 3, "one normal call plus one bounded repair for the invalid response");
  });

  test(`${id}: errori normalizzati, mai dettagli upstream e mai retry HTTP`, async () => {
    const input = await generationInput();
    for (const [status, error, category] of [[401, {}, "invalid_credentials"], [403, {}, "invalid_credentials"], [429, {}, "rate_limit"],
      [402, {}, "quota_exceeded"], [429, { code: "insufficient_quota" }, "quota_exceeded"], [404, {}, "invalid_model"], [503, {}, "provider_unavailable"], [400, {}, "unknown"]]) {
      let calls = 0;
      const adapter = new Adapter({ apiKey: key }, async () => { calls++; return Response.json({ error: { ...error, message: key } }, { status }); });
      await assert.rejects(adapter.generate(input), (error) => {
        const result = publicError(error); assert.equal(result.body.error.category, category); assert.equal(JSON.stringify(result).includes(key), false); return true;
      });
      assert.equal(calls, 1);
    }
  });

  test(`${id}: abort, timeout, malformed e fallback manuale limitato a un retry`, async () => {
    const input = await generationInput();
    let calls = 0;
    const adapter = new Adapter({ apiKey: key, model: "future-manual-model" }, async () => { calls++; return Response.json(envelopeFor(id, "{broken")); });
    await rejectsCode(adapter.generate({ ...input, signal: AbortSignal.abort() }), "REQUEST_ABORTED"); assert.equal(calls, 0);
    await rejectsCode(adapter.generate(input), "INVALID_PROVIDER_JSON"); assert.equal(calls, 2);
    let requestSignal;
    let started;
    const fetching = new Promise((resolve) => { started = resolve; });
    const hanging = new Adapter({ apiKey: key, timeoutMs: 50 }, async (_url, init) => { requestSignal = init.signal; started(); return new Promise(() => {}); });
    const controller = new AbortController();
    const pending = hanging.generate({ ...input, signal: controller.signal }); await fetching; controller.abort();
    await rejectsCode(pending, "REQUEST_ABORTED"); assert.equal(requestSignal.aborted, true);
    await rejectsCode(hanging.generate(input), "PROVIDER_TIMEOUT");
    let repaired = 0;
    const repair = new Adapter({ apiKey: key, model: "future-manual-model" }, async (_url, init) => {
      repaired++;
      if (repaired === 2) assert.match(init.body, /precedente tentativo/);
      return Response.json(envelopeFor(id, repaired === 1 ? "{broken" : validResponse(input)));
    });
    assert.ok(isChatNTCProviderOutput(await repair.generate(input))); assert.equal(repaired, 2);
    assert.equal(modelCapabilities(id, "future-manual-model").structuredOutput, "prompt-json");
    let nativeCalls = 0;
    const malformed = new Adapter({ apiKey: key }, async () => { nativeCalls++; return Response.json(envelopeFor(id, "{broken")); });
    await rejectsCode(malformed.generate(input), "INVALID_PROVIDER_JSON");
    assert.equal(nativeCalls, id === "deepseek" ? 2 : 1);
  });

  test(`${id}: chiave riflessa respinta e risposta generale anche senza fonti iniziali`, async () => {
    const input = await generationInput();
    const echo = new Adapter({ apiKey: key }, async () => Response.json(envelopeFor(id, { ...validResponse(input), answerMarkdown: key })));
    await rejectsCode(echo.generate(input), "INVALID_PROVIDER_RESPONSE");
    let calls = 0;
    const general = await runChatNTC({ question: "Quale controllo di sensibilità conviene eseguire?" }, { repository: repository(),
      provider: () => mockedProvider(async (context) => { calls += 1; return { ...validResponse(context),
        answerMarkdown: "Confronta ipotesi alternative di rigidezza.", references: [], classification: "no-direct-reference" }; }) });
    assert.equal(calls, 1); assert.equal(general.response.classification, "no-direct-reference"); assert.deepEqual(general.citations, []);
  });
}

test("BYOK: origine obbligatoria, provider abbinato alla chiave, URL remoto vietato, gate prima delle credenziali", async () => {
  const post = handler({ provider: () => { assert.fail("Must not reach provider"); } });
  const base = { "content-type": "application/json", "x-chatntc-api-key": key, "x-chatntc-provider": "openai", "x-chatntc-model": "manual" };
  for (const headers of [base, { ...base, origin: "https://evil.example" }, { ...base, origin: "null" }]) {
    const response = await post(request({ question }, { headers })); assert.equal((await response.json()).error.code, "ORIGIN_NOT_ALLOWED");
  }
  const unpaired = await post(request({ question }, { headers: { "content-type": "application/json", "x-chatntc-api-key": key } }));
  assert.equal((await unpaired.json()).error.code, "INVALID_PROVIDER_CONFIG");
  const remote = await post(new Request("https://example.org/api/chatntc", { method: "POST", headers: base, body: JSON.stringify({ question }) }));
  assert.equal((await remote.json()).error.code, "LOCAL_ONLY");
  const disabled = await handler({ environment: () => ({ ...enabled, NODE_ENV: "production" }) })(request({ question }, { headers: base }));
  assert.equal(disabled.status, 404);
  assert.throws(() => configuredProvider(enabled, fetch, { provider: "openai", model: "manual" }), (error) => error.code === "API_KEY_MISSING", "never reuse another provider's environment key");
});
