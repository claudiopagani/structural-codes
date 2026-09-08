import assert from "node:assert/strict";
import test from "node:test";
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
