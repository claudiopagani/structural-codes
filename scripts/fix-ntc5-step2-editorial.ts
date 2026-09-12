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
type Manifest = { tables?: Asset[]; figures?: Asset[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc5-step2-editorial-formatting-0.1.0";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function note(block: Block, text: string) {
  if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: text });
  }
}
function setInline(block: Block, inline: Segment[], text: string) {
  if (!block.text || inline.map((segment) => segment.value).join("") !== block.text.normalized) throw new Error("Segmentazione non coincidente con il testo normalizzato.");
  block.text.inline = inline;
  note(block, text);
}
function terms(block: Block, values: Array<[string, string]>, text: string) {
  const normalized = block.text?.normalized;
  if (!normalized) throw new Error("Testo atteso assente.");
  const inline: Segment[] = [];
  let cursor = 0;
  for (const [value, latex] of values) {
    const at = normalized.indexOf(value, cursor);
    if (at < cursor) throw new Error(`Grandezza attesa assente: ${value}`);
    if (at > cursor) inline.push({ kind: "text", value: normalized.slice(cursor, at) });
    inline.push({ kind: "math", value, latex });
    cursor = at + value.length;
  }
  if (cursor < normalized.length) inline.push({ kind: "text", value: normalized.slice(cursor) });
  setInline(block, inline, text);
}
function italics(block: Block, phrase: string, text: string) {
  const normalized = block.text?.normalized;
  if (!normalized) throw new Error("Testo atteso assente.");
  const at = normalized.indexOf(phrase);
  if (at < 0) throw new Error(`Titolo atteso assente: ${phrase}`);
  setInline(block, [
    { kind: "text", value: normalized.slice(0, at) },
    { kind: "em", value: phrase },
    { kind: "text", value: normalized.slice(at + phrase.length) },
  ].filter((segment) => segment.value), text);
}
async function unit(file: string, apply: (value: Unit) => void) {
  const path = join(root, "corpus/units/ntc2018", file);
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
async function captions(file: string) {
  const path = join(root, "corpus/assets/ntc2018", file);
  const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
  for (const asset of [...(manifest.tables ?? []), ...(manifest.figures ?? [])]) {
    if (asset.pdfPage < 162 || asset.pdfPage > 171 || !asset.caption) continue;
    const separator = asset.caption.includes(" - ") ? " - " : " – ";
    const at = asset.caption.indexOf(separator);
    if (at < 0) throw new Error(`Didascalia senza separatore: ${asset.caption}`);
    asset.captionInline = [
      { kind: "text", value: asset.caption.slice(0, at + separator.length) },
      { kind: "em", value: asset.caption.slice(at + separator.length) },
    ];
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await unit("5.1.4.3.json", (value) => {
  for (const [index, title] of [[6, "Modello di carico 1"], [10, "Modello di carico 2"]] as const) {
    italics(value.blocks[index]!, title, "Ripristinato il titolo interno in corsivo verificato nel render ufficiale.");
  }
  terms(value.blocks[5]!, [["Δσmax = (σmax − σmin)", "\\Delta\\sigma_{\\max}=(\\sigma_{\\max}-\\sigma_{\\min})"], ["Δσmax", "\\Delta\\sigma_{max}"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
  terms(value.blocks[15]!, [["D ≤ 1", "D\\le 1"]], "Ripristinata la verifica matematica inline verificata nel render ufficiale.");
  terms(value.blocks[26]!, [["λ", "\\lambda"]], "Ripristinata la lettera greca come matematica inline verificata nel render ufficiale.");
});
await unit("5.1.4.4.json", (value) => {
  italics(value.blocks[2]!, "Strutture in calcestruzzo armato ordinario", "Ripristinato il sottotitolo interno in corsivo verificato nel render ufficiale.");
  italics(value.blocks[4]!, "Strutture in calcestruzzo armato precompresso", "Ripristinato il sottotitolo interno in corsivo verificato nel render ufficiale.");
});
await unit("5.1.6.3.json", (value) => {
  for (const block of value.blocks.filter((block) => block.kind === "list-item")) {
    block.listMarker = "dash";
    note(block, "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
  }
});
await unit("5.2.2.2.1.1.json", (value) => {
  for (const index of [3, 4]) {
    const block = value.blocks[index]!;
    block.listMarker = "dash";
    note(block, "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
  }
  terms(value.blocks[3]!, [["250 kN", "250\\,\\mathrm{kN}"], ["1,60 m", "1{,}60\\,\\mathrm{m}"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
  terms(value.blocks[4]!, [["80 kN/m", "80\\,\\mathrm{kN/m}"], ["0,8 m", "0{,}8\\,\\mathrm{m}"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
  terms(value.blocks[7]!, [["QV1", "Q_{v1}"], ["QV2", "Q_{v2}"], ["s/18 con s = 1435 mm", "s/18\\text{ con }s=1435\\,\\mathrm{mm}"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
  terms(value.blocks[8]!, [["α", "\\alpha"], ["1,1", "1{,}1"]], "Ripristinata la grandezza matematica inline verificata nel render ufficiale.");
});
await unit("5.2.2.2.1.2.json", (value) => {
  terms(value.blocks[7]!, [["α", "\\alpha"], ["1,1", "1{,}1"], ["1,0", "1{,}0"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
});
await unit("5.2.2.2.1.3.json", (value) => {
  terms(value.blocks[1]!, [["10,0 kN/m", "10{,}0\\,\\mathrm{kN/m}"]], "Ripristinata la grandezza matematica inline verificata nel render ufficiale.");
});
await unit("5.2.2.2.1.4.json", (value) => {
  for (const index of [1, 4, 10]) italics(value.blocks[index]!, value.blocks[index]!.text!.normalized, "Ripristinato il sottotitolo interno in corsivo verificato nel render ufficiale.");
  terms(value.blocks[2]!, [["Qvi", "Q_{vi}"], ["25%", "25\\%"], ["50%", "50\\%"], ["25%", "25\\%"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
  terms(value.blocks[9]!, [["45°", "45^\\circ"]], "Ripristinata la grandezza matematica inline verificata nel render ufficiale.");
});
await unit("5.2.2.2.1.5.json", (value) => {
  terms(value.blocks[1]!, [["0,70 m", "0{,}70\\,\\mathrm{m}"], ["3,0 m", "3{,}0\\,\\mathrm{m}"]], "Ripristinate le grandezze matematiche inline verificate nel render ufficiale.");
});
await unit("5.2.2.2.2.json", (value) => {
  terms(value.blocks[2]!, [["10 kN/m²", "10\\,\\mathrm{kN/m^2}"]], "Ripristinata la grandezza matematica inline verificata nel render ufficiale.");
});

await captions("5.1-step2.json");
await captions("5.1-step3.json");
