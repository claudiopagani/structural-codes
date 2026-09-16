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
import { CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, citationForEvidence, isChatNTCResponse, retrieveChatNTCEvidence } from "../.chatntc-test/shared/chatntc/index.js";

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
  const unit = input.evidence.primaryUnits[0];
  const citation = citationForEvidence(input.evidence, unit.evidenceId);
  return { formatVersion: 1, evidencePackageId: input.evidence.packageId,
    answer: "Riferimento individuato nel corpus fornito.", classification: "direct-reference",
    claims: [{ id: "claim-1", text: "Riferimento individuato nel corpus fornito.", classification: "direct-reference", citations: [citation] }],
    usedEvidenceIds: [citation.evidenceId], warnings: [], needsMoreEvidence: false, externalResearchSuggested: false };
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
    assert.ok(context.allowedCitations.length > 1);
    assert.equal(init.body.includes(key), false);
    return mockEnvelope(validResponse(input));
  });
  const response = await adapter.generate(input);
  assert.equal(calls, 1);
  assert.ok(isChatNTCResponse(response));
  assert.equal(JSON.stringify(adapter).includes(key), false);
  assert.equal(JSON.stringify(response).includes(key), false);
  assert.deepEqual(adapter.capabilities, { structuredOutput: true, outputMode: "json-object", streaming: false, cancellation: true, toolCalling: false, reasoning: "disabled" });
});

test("schema JSON condiviso e guard runtime concordano sul contratto strutturale", async () => {
  const validate = new Ajv({ allErrors: true }).compile(CHATNTC_RESPONSE_JSON_SCHEMA);
  const valid = validResponse(await generationInput());
  for (const value of [valid, null, [], {}, { ...valid, unexpected: true }, { ...valid, warnings: [""] },
    { ...valid, classification: "invented" }, { ...valid, claims: [null] }, { ...valid, needsMoreEvidence: "yes" }]) {
    assert.equal(Boolean(validate(value)), isChatNTCResponse(value), JSON.stringify(validate.errors));
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
  const value = { ...validResponse(input), answer: key };
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
  assert.deepEqual(result.citations, result.response.claims.flatMap((claim) => claim.citations));
  assert.equal(result.generation.provider, "deepseek");
  assert.equal(result.generation.model, "deepseek-flash");
  assert.equal(result.evidence.structuralCodesVersion, (await repository().identity()).version);
  assert.equal(result.evidence.corpusFingerprint, (await repository().identity()).fingerprint);
  assert.equal(JSON.stringify(result).includes(key), false);
});

test("pipeline respinge hallucination, output mock malformato e alterazioni del pacchetto", async () => {
  await rejectsCode(runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    const response = validResponse(input);
    response.claims[0].citations[0].numbering = "7.99.4";
    return response;
  }) }), "CITATION_VALIDATION_FAILED");
  await rejectsCode(runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async () => ({ answer: "incomplete" })) }), "INVALID_RESPONSE_SCHEMA");
  await rejectsCode(runChatNTC({ question }, { repository: repository(), provider: () => mockedProvider(async (input) => {
    input.evidence.primaryUnits[0].numbering = "7.99.4";
    return validResponse(input);
  }) }), "CITATION_VALIDATION_FAILED");
});

test("no evidence: astensione deterministica validata, provider e chiave non necessari", async () => {
  let configured = false;
  const repo = repository();
  let identities = 0;
  const observed = { ...repo, identity: async () => { identities += 1; return repo.identity(); } };
  const result = await runChatNTC({ question: "7.99.4" }, { repository: observed, provider: () => { configured = true; throw new Error("not configured"); } });
  assert.equal(configured, false);
  assert.ok(identities >= 2); // retrieval AND mandatory validation, even on abstention
  assert.equal(result.response.classification, "no-direct-reference");
  assert.equal(result.response.needsMoreEvidence, true);
  assert.deepEqual(result.citations, []);
  assert.equal(result.generation.provider, null);
  assert.equal(result.validation.valid, true);
});

test("errori retrieval e validazione repository rimangono sanitizzati", async () => {
  const repo = repository();
  await rejectsCode(runChatNTC({ question }, { repository: { ...repo, identity: async () => { throw new Error(key); } }, provider: () => mockedProvider() }), "RETRIEVAL_FAILED");
  let identities = 0;
  await rejectsCode(runChatNTC({ question: "7.99.4" }, { repository: { ...repo, identity: async () => {
    if (++identities > 1) throw new Error(key);
    return repo.identity();
  } }, provider: () => mockedProvider() }), "VALIDATION_FAILED");
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
    [() => mockedProvider(async (input) => ({ ...validResponse(input), answer: "NTC 2018 §7.99.4" })), 502, "CITATION_VALIDATION_FAILED"],
  ]) {
    const response = await handler({ provider })(request());
    assert.equal(response.status, status);
    const raw = await response.text();
    const body = JSON.parse(raw);
    assert.equal(body.error.code, code);
    assert.equal(body.response, undefined);
    assert.equal(body.citations, undefined);
    assert.equal(raw.includes(key), false);
    assert.equal(raw.includes("7.99.4"), false);
  }
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
      assert.ok(context.allowedCitations.length);
      if (id === "openai") { assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(body.text.format.type, "json_schema");
        const schema = body.text.format.schema; assert.deepEqual(schema.properties.claims.items.properties.citations.items.required,
          ["evidenceId", "unitId", "document", "numbering", "blockId", "assetId", "assetNumber"]); }
      if (id === "anthropic") { assert.equal(headers.get("anthropic-version"), "2023-06-01"); assert.equal(body.output_config.format.type, "json_schema"); assert.ok(body.system.includes(CHATNTC_DIRECTIVES.rules[0])); }
      if (id === "gemini") { assert.equal(body.generationConfig.responseFormat.text.mimeType, "application/json"); assert.ok(body.systemInstruction.parts[0].text.includes(CHATNTC_DIRECTIVES.rules[0])); }
      const answer = validResponse({ evidence: context.evidence });
      if (hallucinate) answer.claims[0].citations[0].numbering = "7.99.4";
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
    assert.equal(invalid.status, 502);
    const rejected = await invalid.json();
    assert.equal(rejected.error.category, "citation_validation_failed"); assert.equal(rejected.response, undefined);
    assert.equal(calls, 2, "no retry after citation validation failure");
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
    assert.ok(isChatNTCResponse(await repair.generate(input))); assert.equal(repaired, 2);
    assert.equal(modelCapabilities(id, "future-manual-model").structuredOutput, "prompt-json");
    let nativeCalls = 0;
    const malformed = new Adapter({ apiKey: key }, async () => { nativeCalls++; return Response.json(envelopeFor(id, "{broken")); });
    await rejectsCode(malformed.generate(input), "INVALID_PROVIDER_JSON");
    assert.equal(nativeCalls, id === "deepseek" ? 2 : 1);
  });

  test(`${id}: chiave riflessa respinta e assenza evidence senza chiamata AI`, async () => {
    const input = await generationInput();
    const echo = new Adapter({ apiKey: key }, async () => Response.json(envelopeFor(id, { ...validResponse(input), answer: key })));
    await rejectsCode(echo.generate(input), "INVALID_PROVIDER_RESPONSE");
    const abstention = await runChatNTC({ question: "7.99.4" }, { repository: repository(), provider: () => { assert.fail("No provider without evidence"); } });
    assert.equal(abstention.response.classification, "no-direct-reference"); assert.deepEqual(abstention.citations, []);
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
