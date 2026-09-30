import assert from "node:assert/strict";
import test from "node:test";
import { mobileIndexExpansion } from "../shared/indexExpansion.js";

test("una nuova apertura mobile mostra il percorso dell'unità selezionata", () => {
  const previous = { session: 3, chapterId: "old-chapter", paragraphId: "old-paragraph" };
  assert.deepEqual(mobileIndexExpansion(["chapter-4", "paragraph-4.1", "subparagraph-4.1.1"], previous, 4), {
    chapterId: "chapter-4",
    paragraphId: "paragraph-4.1",
  });
});

test("nella sessione aperta prevale l'espansione scelta dall'utente", () => {
  const expanded = { session: 4, chapterId: "chapter-5", paragraphId: null };
  assert.deepEqual(mobileIndexExpansion(["chapter-4", "paragraph-4.1", "subparagraph-4.1.1"], expanded, 4), {
    chapterId: "chapter-5",
    paragraphId: null,
  });
});
