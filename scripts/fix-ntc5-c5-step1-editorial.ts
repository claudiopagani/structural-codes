import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Segment = { kind: string; value: string; latex?: string };
type Block = {
  kind: string;
  listMarker?: "bullet" | "dash" | "none";
  text?: { raw: string; normalized: string; inline?: Segment[] };
  evidence?: { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
};
type Unit = { blocks: Block[] };
type Asset = { pdfPage: number; caption?: string; captionInline?: Segment[] };
type Manifest = { tables: Asset[]; figures: Asset[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc5-c5-step1-editorial-formatting-0.1.0";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function note(block: Block, text: string) {
  if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: text });
  }
}
function marker(block: Block, listMarker: "bullet" | "dash" | "none", text: string) {
  if (block.kind !== "list-item") throw new Error("Atteso un elemento di elenco.");
  block.listMarker = listMarker;
  note(block, text);
}
function inline(block: Block, segments: Segment[], text: string) {
  if (!block.text) throw new Error("Testo atteso assente.");
  if (segments.map((segment) => segment.value).join("") !== block.text.normalized) throw new Error("Segmenti non coincidenti con il testo normalizzato.");
  block.text.inline = segments;
  note(block, text);
}
function emphasis(block: Block, phrase: string, text: string) {
  const normalized = block.text?.normalized;
  if (!normalized) throw new Error("Testo atteso assente.");
  const start = normalized.indexOf(phrase);
  if (start < 0) throw new Error(`Frase attesa assente: ${phrase}`);
  const original = block.text!.inline ?? [{ kind: "text", value: normalized }];
  if (original.map((segment) => segment.value).join("") !== normalized) throw new Error("Segmenti originali non coincidenti con il testo normalizzato.");
  const slice = (from: number, to: number): Segment[] => {
    const result: Segment[] = [];
    let cursor = 0;
    for (const segment of original) {
      const end = cursor + segment.value.length;
      const overlapStart = Math.max(cursor, from);
      const overlapEnd = Math.min(end, to);
      if (overlapStart < overlapEnd) {
        if (segment.kind !== "text" && (overlapStart !== cursor || overlapEnd !== end)) throw new Error("Il corsivo non può spezzare un segmento non testuale.");
        result.push(segment.kind === "text" ? { kind: "text", value: segment.value.slice(overlapStart - cursor, overlapEnd - cursor) } : segment);
      }
      cursor = end;
    }
    return result;
  };
  inline(block, [
    ...slice(0, start),
    { kind: "em", value: phrase },
    ...slice(start + phrase.length, normalized.length),
  ], text);
}
function labelledMath(block: Block, label: string, values: Array<[string, string]>) {
  const normalized = block.text!.normalized;
  const segments: Segment[] = [{ kind: "em", value: label }];
  let cursor = label.length;
  for (const [value, latex] of values) {
    const at = normalized.indexOf(value, cursor);
    if (at < cursor) throw new Error(`Grandezza attesa assente: ${value}`);
    if (at > cursor) segments.push({ kind: "text", value: normalized.slice(cursor, at) });
    segments.push({ kind: "math", value, latex });
    cursor = at + value.length;
  }
  if (cursor < normalized.length) segments.push({ kind: "text", value: normalized.slice(cursor) });
  inline(block, segments, "Ripristinata l’etichetta in corsivo, l’allineamento della descrizione e la matematica inline verificati nel render ufficiale.");
}
async function unit(path: string, apply: (value: Unit) => void) {
  const value = JSON.parse(await readFile(path, "utf8")) as Unit;
  apply(value);
  for (const block of value.blocks) {
    if (block.text && block.evidence) {
      block.evidence.rawSha256 = sha256(block.text.raw);
      block.evidence.normalizedSha256 = sha256(block.text.normalized);
    }
  }
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
async function captions(path: string, maxPage: number) {
  const value = JSON.parse(await readFile(path, "utf8")) as Manifest;
  for (const asset of [...value.tables, ...value.figures]) {
    if (asset.pdfPage > maxPage || !asset.caption || !asset.caption.includes(" - ")) continue;
    const [label, title] = asset.caption.split(" - ", 2) as [string, string];
    asset.captionInline = [{ kind: "text", value: `${label} - ` }, { kind: "em", value: title }];
  }
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await unit(join(root, "corpus/units/ntc2018/5.1.2.3.json"), (value) => {
  for (const index of [4, 5, 6, 7, 8]) marker(value.blocks[index]!, "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
await unit(join(root, "corpus/units/ntc2018/5.1.3.json"), (value) => {
  for (const index of [2, 3, 4, 5, 6, 7, 8, 9]) marker(value.blocks[index]!, "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
for (const file of ["5.1.3.1.json", "5.1.3.2.json", "5.1.3.3.2.json", "5.1.3.3.4.json"]) {
  await unit(join(root, "corpus/units/ntc2018", file), (value) => {
    for (const block of value.blocks.filter((block) => block.kind === "list-item")) marker(block, "none", "Ripristinata la voce etichettata e il relativo rientro verificati nel render ufficiale.");
  });
}
await unit(join(root, "corpus/units/ntc2018/5.1.3.10.json"), (value) => {
  for (const index of [5, 6]) marker(value.blocks[index]!, "bullet", "Ripristinato il punto elenco e il relativo rientro verificati nel render ufficiale.");
});
await unit(join(root, "corpus/units/ntc2018/5.1.3.3.3.json"), (value) => {
  const definitions: Array<[number, Array<[string, string]>]> = [
    [2, [["0,40 m", "0{,}40\\,\\mathrm{m}"]]],
    [3, [["0,60 m", "0{,}60\\,\\mathrm{m}"], ["0,35 m", "0{,}35\\,\\mathrm{m}"], ["200 kN", "200\\,\\mathrm{kN}"]]],
    [4, [["150 kN", "150\\,\\mathrm{kN}"], ["0,40 m", "0{,}40\\,\\mathrm{m}"]]],
    [5, [["10 kN", "10\\,\\mathrm{kN}"], ["0,10 m", "0{,}10\\,\\mathrm{m}"]]],
    [6, [["5,0 kN/m²", "5{,}0\\,\\mathrm{kN/m^2}"], ["2,5 kN/m²", "2{,}5\\,\\mathrm{kN/m^2}"]]],
    [7, [["300 m", "300\\,\\mathrm{m}"], ["qL,a", "q_{L,a}"], ["qL,b", "q_{L,b}"], ["qL,c", "q_{L,c}"]]],
  ];
  for (const [index, values] of definitions) {
    const block = value.blocks[index]!;
    labelledMath(block, block.text!.normalized.slice(0, block.text!.normalized.indexOf(":") + 1), values);
  }
});
await unit(join(root, "corpus/units/ntc2018/5.1.3.3.6.json"), (value) => {
  emphasis(value.blocks[1]!, "Diffusione dei carichi locali", "Ripristinato il sottotitolo in corsivo verificato nel render ufficiale.");
  emphasis(value.blocks[5]!, "Calcolo delle strutture secondarie di impalcato", "Ripristinato il sottotitolo in corsivo verificato nel render ufficiale.");
});

await unit(join(root, "corpus/units/circ2019/c5.1.2.3.json"), (value) => {
  for (const block of value.blocks.filter((block) => block.kind === "list-item")) marker(block, "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
await unit(join(root, "corpus/units/circ2019/c5.1.3.10.json"), (value) => {
  for (const block of value.blocks.filter((block) => block.kind === "list-item")) marker(block, "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
await unit(join(root, "corpus/units/circ2019/c5.1.4.5.json"), (value) => {
  for (const index of [8, 9, 10]) marker(value.blocks[index]!, "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
for (const file of ["c5.1.3.3.5.1.json", "c5.1.3.3.5.2.json"]) {
  await unit(join(root, "corpus/units/circ2019", file), (value) => {
    const heading = value.blocks[0]!;
    emphasis(heading, heading.text!.normalized.replace(/^C5\.1\.3\.3\.5\.[12]\s+/, ""), "Ripristinato il titolo in corsivo verificato nel render ufficiale.");
  });
}
await unit(join(root, "corpus/units/circ2019/c5.1.3.3.5.2.json"), (value) => {
  const block = value.blocks[2]!;
  inline(block, [
    { kind: "text", value: "Per il calcolo dei muri paraghiaia si deve, invece, considerare un’azione orizzontale longitudinale di frenamento, applicata alla testa del muro paraghiaia (vedi Figura C5.1.1), di valore caratteristico pari al 60% del carico asse " },
    { kind: "math", value: "Q_{1k}", latex: "Q_{1k}" },
    { kind: "text", value: ". Pertanto si considererà un carico orizzontale di 180 kN, concomitante con un carico verticale di 300 kN." },
  ], "Ripristinata la grandezza matematica inline verificata nel render ufficiale.");
});
await unit(join(root, "corpus/units/circ2019/c5.1.8.json"), (value) => {
  inline(value.blocks[5]!, [
    { kind: "text", value: "Qualora, per operazioni di manutenzione o di soccorso, sia necessario considerare la presenza di un veicolo sul ponte si può considerare lo schema di carico di Figura C5.1.2, costituito da due assi di peso " },
    { kind: "math", value: "Q_sv1", latex: "Q_{sv1}" },
    { kind: "text", value: "=" },
    { kind: "math", value: "40 kN", latex: String.raw`40\,\mathrm{kN}` },
    { kind: "text", value: " e " },
    { kind: "math", value: "Q_sv2", latex: "Q_{sv2}" },
    { kind: "text", value: "=" },
    { kind: "math", value: "80 kN", latex: String.raw`80\,\mathrm{kN}` },
    { kind: "text", value: ", comprensivi degli effetti dinamici, con carreggiata di " },
    { kind: "math", value: "1,3 m", latex: String.raw`1{,}3\,\mathrm{m}` },
    { kind: "text", value: " ed interasse " },
    { kind: "math", value: "3,0 m", latex: String.raw`3{,}0\,\mathrm{m}` },
    { kind: "text", value: ". L’impronta di ciascuna ruota può essere considerata quadrata di lato " },
    { kind: "math", value: "20 cm", latex: String.raw`20\,\mathrm{cm}` },
    { kind: "text", value: "." },
  ], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
});
await unit(join(root, "corpus/units/circ2019/c5.2.2.5.json"), (value) => {
  for (const index of [2, 3, 4, 5, 6]) {
    const block = value.blocks[index]!;
    const text = block.text!.normalized;
    const pieces: Segment[] = [];
    const patterns: Array<[string, string]> = index === 2
      ? [["q", "q"], ["12,5 kN/m", "12{,}5\\,\\mathrm{kN/m}"], ["20 kN/m", "20\\,\\mathrm{kN/m}"], ["80 kN/m", "80\\,\\mathrm{kN/m}"], ["60 kN/m", "60\\,\\mathrm{kN/m}"], ["2 mm", "2\\,\\mathrm{mm}"]]
      : index === 3 ? [["q", "q"]]
      : index === 4 ? [["q", "q"], ["0,6 m", "0{,}6\\,\\mathrm{m}"], ["50 kN/m", "50\\,\\mathrm{kN/m}"], ["80 kN/m", "80\\,\\mathrm{kN/m}"]]
      : index === 5 ? [["q", "q"], ["13 kN/m", "13\\,\\mathrm{kN/m}"], ["35 kN/m", "35\\,\\mathrm{kN/m}"], ["80 kN/m", "80\\,\\mathrm{kN/m}"]]
      : [["0,5 mm", "0{,}5\\,\\mathrm{mm}"]];
    let cursor = 0;
    for (const [valueText, latex] of patterns) {
      const at = text.indexOf(valueText, cursor);
      if (at < cursor) throw new Error(`Grandezza attesa assente: ${valueText}`);
      if (at > cursor) pieces.push({ kind: "text", value: text.slice(cursor, at) });
      pieces.push({ kind: "math", value: valueText, latex });
      cursor = at + valueText.length;
    }
    if (cursor < text.length) pieces.push({ kind: "text", value: text.slice(cursor) });
    inline(block, pieces, "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
  }
});
for (const file of ["c5.1.4.3.json", "c5.2.3.2.3.json"]) {
  await unit(join(root, "corpus/units/circ2019", file), (value) => {
    for (const block of value.blocks.filter((block) => block.text?.normalized.includes("metodo λ"))) {
      const text = block.text!.normalized;
      const at = text.indexOf("λ");
      inline(block, [
        { kind: "text", value: text.slice(0, at) },
        { kind: "math", value: "λ", latex: "\\lambda" },
        { kind: "text", value: text.slice(at + 1) },
      ], "Ripristinata la lettera greca come matematica inline verificata nel render ufficiale.");
    }
  });
}

await captions(join(root, "corpus/assets/ntc2018/5.1-step1.json"), 161);
await captions(join(root, "corpus/assets/ntc2018/5.1-step2.json"), 161);
await captions(join(root, "corpus/assets/circ2019/C5-step2.json"), 176);
await captions(join(root, "corpus/assets/circ2019/C5-step3.json"), 176);
