import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { visibleTableCaptionInline } from "../shared/tableCaptions.mjs";

test("la didascalia inline di una tabella non duplica l’etichetta esterna", () => {
  const inline = [
    { kind: "strong", value: "Tabella C4.1.I" },
    { kind: "em", value: " – Valori di " },
    { kind: "math", value: "K", latex: "K" },
  ];
  assert.deepEqual(
    visibleTableCaptionInline("C4.1.I", "Tabella C4.1.I – Valori di K", inline),
    [
      { kind: "em", value: "Valori di " },
      { kind: "math", value: "K", latex: "K" },
    ],
  );
});

test("la didascalia inline della Tabella 2.4.I conserva l'inizio già privo dell'etichetta", () => {
  const { tables } = JSON.parse(readFileSync(new URL("../../corpus/assets/ntc2018/core-tables.json", import.meta.url), "utf8"));
  const table = tables.find(({ officialNumber }) => officialNumber === "2.4.I");
  assert.ok(table);
  assert.deepEqual(
    visibleTableCaptionInline(table.officialNumber, table.caption, table.captionInline),
    table.captionInline,
  );
  assert.equal(table.captionInline.map(({ value }) => value).join(""),
    "Valori minimi della Vita nominale VN di progetto per i diversi tipi di costruzioni");
});
