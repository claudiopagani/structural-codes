import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { viewerDocumentSummary } from "../package-dist/corpusData.js";

const manifest = {
  stats: { units: 5, chunks: 3 },
  documents: { ntc2018: { units: 2 }, circ2019: { units: 3 } },
  chunks: [{ document: "ntc2018" }, { document: "circ2019" }, { document: "circ2019" }],
};

test("la riga informativa usa titolo e totali della modalità selezionata", () => {
  assert.deepEqual(viewerDocumentSummary(manifest, "ntc"), { label: "NTC 2018", units: 2, chunks: 1 });
  assert.deepEqual(viewerDocumentSummary(manifest, "circ"), { label: "Circolare 7/2019", units: 3, chunks: 2 });
  assert.deepEqual(viewerDocumentSummary(manifest, "combined"), { label: "NTC 2018 + Circolare 7/2019", units: 5, chunks: 3 });
});

test("la riga informativa non mostra più Documento continuo", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Documento continuo/);
});
