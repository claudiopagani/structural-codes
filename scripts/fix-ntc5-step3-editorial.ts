import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Segment = { kind: string; value: string };
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
const profile = "ntc5-step3-editorial-formatting-0.1.0";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function note(block: Block, noteText: string) {
  if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: noteText });
  }
}
async function unit(file: string, apply: (value: Unit) => void) {
  const path = join(root, "corpus/units/ntc2018", file);
  const value = JSON.parse(await readFile(path, "utf8")) as Unit;
  apply(value);
  for (const block of value.blocks) if (block.text && block.evidence) {
    block.evidence.rawSha256 = hash(block.text.raw);
    block.evidence.normalizedSha256 = hash(block.text.normalized);
  }
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function markers(value: Unit, indices: number[], listMarker: "dash" | "none", noteText: string) {
  for (const index of indices) {
    const block = value.blocks[index]!;
    if (block.kind !== "list-item") throw new Error(`Il blocco ${index} non è un elenco.`);
    block.listMarker = listMarker;
    note(block, noteText);
  }
}
async function captions() {
  const path = join(root, "corpus/assets/ntc2018/5.1-step3.json");
  const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
  for (const asset of [...(manifest.tables ?? []), ...(manifest.figures ?? [])]) {
    if (asset.pdfPage < 172 || asset.pdfPage > 181 || !asset.caption) continue;
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

await unit("5.2.2.3.1.json", (value) => markers(value, [14, 15], "none", "Ripristinata la voce etichettata con il relativo rientro verificati nel render ufficiale."));
await unit("5.2.2.3.3.json", (value) => markers(value, [10, 11, 12, 13], "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale."));
await unit("5.2.2.4.2.json", (value) => {
  const block = value.blocks[3]!;
  if (!block.text) throw new Error("Sottotitolo atteso assente.");
  block.text.inline = [{ kind: "em", value: block.text.normalized }];
  note(block, "Ripristinato il sottotitolo in corsivo verificato nel render ufficiale.");
  markers(value, [9, 10, 14, 15], "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
await unit("5.2.2.5.json", (value) => markers(value, [4, 5, 6], "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale."));
await unit("5.2.2.6.5.json", (value) => markers(value, [2, 3], "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale."));
await unit("5.2.2.9.1.json", (value) => markers(value, [3, 4, 5], "none", "Ripristinata la voce numerata con il relativo allineamento verificati nel render ufficiale."));
await captions();
