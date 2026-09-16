import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const key = "fixture-route-key-never-a-real-api-key";
const envDefaults = { NODE_ENV: "production", CHATNTC_ENABLED: "false", CHATNTC_DEBUG: "false",
  CHATNTC_PROVIDER: "deepseek", CHATNTC_DEEPSEEK_API_KEY: key,
  CHATNTC_DEEPSEEK_MODEL: "deepseek-flash", CHATNTC_DEEPSEEK_TIMEOUT_MS: "1000" };

async function withEnvironment(values, callback) {
  const next = { ...envDefaults, ...values };
  const previous = Object.fromEntries(Object.keys(next).map((name) => [name, process.env[name]]));
  try { Object.assign(process.env, next); return await callback(); }
  finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function post(body) {
  const { default: handler } = await import(new URL("../dist/server/index.js", import.meta.url));
  return handler(new Request("http://localhost/api/chatntc", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify(body) }));
}

test("route Vinext di produzione è disabilitata senza opt-in debug", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { assert.fail("No provider/network allowed"); });
  await withEnvironment({ CHATNTC_ENABLED: "true" }, async () => {
    const response = await post({ question: "7.3.6.1" });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "CHATNTC_DISABLED");
  });
});

test("route Vinext local/debug esegue l'intera pipeline con fetch DeepSeek simulato", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    calls += 1;
    assert.equal(init.headers.authorization, `Bearer ${key}`);
    assert.equal(init.body.includes(key), false);
    const context = JSON.parse(JSON.parse(init.body).messages.at(-1).content);
    return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({
      formatVersion: 2, evidencePackageId: context.evidence.packageId,
      answerMarkdown: "Il §7.3.6.1 è il riferimento pertinente.", references: ["NTC 2018 §7.3.6.1"],
      classification: "direct-reference", status: "answered", needsMoreEvidence: false, externalResearchSuggested: false,
    }) } }] });
  });
  await withEnvironment({ CHATNTC_ENABLED: "true", CHATNTC_DEBUG: "true" }, async () => {
    const response = await post({ question: "7.3.6.1" });
    const raw = await response.text();
    assert.equal(response.status, 200, raw);
    assert.equal(calls, 1);
    assert.equal(raw.includes(key), false);
    const result = JSON.parse(raw);
    assert.equal(result.validation.valid, true);
    assert.equal(result.citations[0].numbering, "7.3.6.1");
    assert.equal(result.generation.provider, "deepseek");
    assert.equal(result.generation.model, "deepseek-flash");
    assert.equal(result.evidence.structuralCodesVersion, "0.1.0-alpha.1");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("route compilata degrada un output non separabile e consente una risposta generale", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls += 1;
    const context = JSON.parse(JSON.parse(init.body).messages.at(-1).content);
    const general = context.evidence.question === "7.99.4";
    return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({
      formatVersion: 2, evidencePackageId: context.evidence.packageId,
      answerMarkdown: general ? "Non posso attribuire una prescrizione a quel numero, ma posso aiutarti a chiarire il tema tecnico." : "NTC 2018 §7.99.4",
      references: general ? [] : ["§7.99.4"], classification: general ? "no-direct-reference" : "direct-reference",
      status: "answered", needsMoreEvidence: false, externalResearchSuggested: false,
    }) } }] });
  });
  await withEnvironment({ CHATNTC_ENABLED: "true", CHATNTC_DEBUG: "true" }, async () => {
    const invalid = await post({ question: "7.3.6.1" });
    assert.equal(invalid.status, 200);
    const body = await invalid.json();
    assert.equal(body.response.referenceWarning, "no-references-verified");
    assert.equal(body.response.verifiedReferences.length, 0);
    assert.doesNotMatch(body.response.answerMarkdown, /7\.99\.4/u);
    assert.equal(body.error, undefined);
    const response = await post({ question: "7.99.4" });
    assert.equal(response.status, 200);
    const abstention = await response.json();
    assert.equal(abstention.response.classification, "no-direct-reference");
    assert.equal(abstention.validation.valid, true);
    assert.equal(abstention.generation.provider, "deepseek");
    assert.equal(calls, 3);
  });
});

test("bundle browser e libreria shared non contengono adapter o configurazione segreta", async () => {
  for (const directory of ["dist/client", "package-dist"]) {
    const root = new URL(`../${directory}/`, import.meta.url);
    const files = await readdir(root, { recursive: true });
    for (const file of files.filter((name) => /\.(js|mjs|map|html)$/u.test(name))) {
      const source = await readFile(new URL(file.replaceAll("\\", "/"), root), "utf8");
      assert.doesNotMatch(source, /api\.deepseek\.com|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|CHATNTC_(?:DEEPSEEK|OPENAI|ANTHROPIC|GEMINI)_API_KEY|class (?:DeepSeek|OpenAI|Anthropic|Gemini)Adapter/u, file);
      assert.equal(source.includes(key), false, file);
    }
  }
});

test("pagina standalone: visibilità dal flag server, nessun provider chiamato al render", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { assert.fail("Rendering must not call AI"); });
  const { default: handle } = await import(new URL("../dist/server/index.js", import.meta.url));
  for (const [env, visible] of [[{}, false], [{ CHATNTC_ENABLED: "true" }, false], [{ CHATNTC_ENABLED: "true", CHATNTC_DEBUG: "true" }, true]]) {
    await withEnvironment(env, async () => {
      const response = await handle(new Request("http://localhost/", { headers: { accept: "text/html" } }));
      const html = await response.text();
      assert.equal(response.status, 200);
      // Loopback is checked on mount before showing settings; SSR passes only the flag.
      assert.equal(html.includes("Impostazioni AI"), false);
      assert.equal(/chatEnabled[^a-z]{1,8}true/u.test(html), visible);
      assert.equal(html.includes(key), false);
      assert.equal(html.includes("CHATNTC_DEEPSEEK_API_KEY"), false);
    });
  }
});
