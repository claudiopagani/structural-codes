import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  isEditorialTableNote,
  visibleTableNotes,
} from "../app/tableNotes.mjs";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
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

test("espone il viewer di consultazione separato", async () => {
  const response = await render("/consultazione");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Consultazione comparata/);
  assert.match(html, /comparison-shell/);
  assert.match(html, /NTC 2018 \+ Circolare/);
  assert.match(html, /Circolare 7\/2019/);
  assert.match(html, /Testo trascritto continuo/);
  assert.match(html, /PDF ufficiale/);
  assert.match(html, /Apri PDF ufficiale/);
  assert.doesNotMatch(html, /class="topbar"/);
});

test("conserva il viewer analitico precedente", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Corpus normativo verificabile/);
  assert.match(html, /Lettura comparata/);
});

test("rifiuta richieste PDF per documenti non registrati", async () => {
  const response = await render("/api/source-pdf?document=altro");
  assert.equal(response.status, 400);
});

test("non ripete il titolo canonico nei blocchi dell'unità", async () => {
  const source = await readFile(
    new URL("../app/consultazione/ComparisonViewer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /function isRepeatedUnitTitle\(/);
  assert.match(
    source,
    /\.filter\(\(block\) => !isRepeatedUnitTitle\(unit, block\)\)/,
  );
  assert.doesNotMatch(source, /fetch\("\/data\/corpus\.json"\)/);
  assert.match(source, /if \(!manifest \|\| !pdfRequested\) return;/);
});

test("manda il testo a capo dopo il titolo senza aggiungere pallini agli elenchi", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    styles,
    /\.comparison-unit h2\s*\{[^}]*display:\s*block;/s,
  );
  assert.match(
    styles,
    /\.comparison-unit-blocks\s*\{[^}]*display:\s*block;/s,
  );
  assert.doesNotMatch(styles, /\.comparison-block-list-item::before/);
});

test("allinea il numero della formula a destra e rimuove le etichette di verifica", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../app/CorpusViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="formula-row"/);
  assert.match(component, /className="formula-number"/);
  assert.doesNotMatch(component, /trascrizione da verificare/);
  assert.match(styles, /\.formula-row\s*\{[^}]*display:\s*flex;/s);
  assert.match(
    styles,
    /\.formula-number\s*\{[^}]*margin-left:\s*auto;/s,
  );
});

test("nasconde le note editoriali delle tabelle ma conserva le note normative", () => {
  const editorial = [
    "Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria.",
    "Trascritta e strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria.",
    "[TABELLA_DA_VERIFICARE] Struttura e valori richiedono verifica manuale.",
    "Dati acquisiti dai blocchi evidence della pagina ufficiale.",
    "La tabella prosegue a pagina PDF 129 con i dettagli successivi.",
    "Le figure interne sono rappresentate mediante descrizioni strutturate.",
  ];
  const normative = [
    "(*) Ponti pedonali",
    "(1) Classe da adottare per acciai resistenti alla corrosione.",
    "I valori campiti in grigio rappresentano l’azione dominante.",
    "La tabella fa riferimento agli schemi di unione della Fig. 4.2.5.",
  ];

  assert.equal(editorial.every(isEditorialTableNote), true);
  assert.deepEqual(visibleTableNotes([...editorial, ...normative]), normative);
});

test("non mostra commenti editoriali nelle didascalie delle figure", async () => {
  const component = await readFile(
    new URL("../app/CorpusViewer.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(component, /ritaglio della fonte ufficiale/);
});
