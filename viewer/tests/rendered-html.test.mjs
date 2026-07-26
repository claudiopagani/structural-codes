import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renderizza il visualizzatore normativo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Structural Codes — Corpus normativo verificabile<\/title>/i,
  );
  assert.match(html, /Corpus normativo verificabile/);
  assert.match(html, /Piano di chiusura/);
  assert.match(html, /Estratto · non pubblicabile/);
  assert.doesNotMatch(
    html,
    /Revisione|Accetta il blocco|Richiede correzione/,
  );
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("il payload pubblico coincide con il lotto canonico", async () => {
  const corpus = JSON.parse(
    await readFile(new URL("../public/data/corpus.json", import.meta.url), "utf8"),
  );

  assert.equal(corpus.stats.units, 333);
  assert.equal(corpus.stats.blocks, 1880);
  assert.equal(corpus.stats.proposedRelations, 89);
  assert.equal(corpus.units.length, 333);
  assert.equal(
    corpus.documents.ntc2018.localSourcePath,
    "raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf",
  );
  assert.equal(
    corpus.documents.circ2019.localSourcePath,
    "raw-sources/circ2019/circolare-7-2019.pdf",
  );
  assert.equal(
    corpus.units.every((unit) => unit.workflow.status === "extracted"),
    true,
  );
  assert.equal(Object.keys(corpus.assets.formulas).length, 130);
  assert.equal(Object.keys(corpus.assets.tables).length, 48);
  assert.equal(Object.keys(corpus.assets.figures).length, 60);

  const section = corpus.units.find(
    (unit) =>
      unit.id === "urn:structural-codes:it:unit:ntc2018:4.1.2.1.2.1",
  );
  assert.ok(section);
  assert.equal(
    section.blocks.some((block) => block.kind === "formula-ref"),
    true,
  );
  assert.equal(
    section.blocks.some((block) => block.kind === "figure-ref"),
    true,
  );
  assert.equal(
    section.blocks.filter((block) =>
      block.assetId?.includes("material-parameters-"),
    ).length,
    2,
  );

  for (const figure of Object.values(corpus.assets.figures)) {
    const image = await readFile(
      new URL(`../public/assets/${figure.imagePath}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      figure.sha256,
    );
  }
});
