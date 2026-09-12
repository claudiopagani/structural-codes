import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Segment = { kind: string; value: string };
type Block = { kind: string; listMarker?: "dash" | "none"; text?: { raw: string; normalized: string; inline?: Segment[] }; evidence?: { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> } };
type Unit = { blocks: Block[] };
type Asset = { pdfPage: number; caption?: string; captionInline?: Segment[] };
type Manifest = { tables?: Asset[]; figures?: Asset[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc5-step4-editorial-formatting-0.1.0";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

async function unit(file: string, apply: (value: Unit) => void) {
  const path = join(root, "corpus/units/ntc2018", file);
  const value = JSON.parse(await readFile(path, "utf8")) as Unit;
  apply(value);
  for (const block of value.blocks) if (block.text && block.evidence) { block.evidence.rawSha256 = hash(block.text.raw); block.evidence.normalizedSha256 = hash(block.text.normalized); }
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function marker(value: Unit, indices: number[], listMarker: "dash" | "none", note: string) {
  for (const index of indices) {
    const block = value.blocks[index]!;
    if (block.kind !== "list-item") throw new Error(`Il blocco ${index} non è un elenco.`);
    block.listMarker = listMarker;
    if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
  }
}
async function captions() {
  const path = join(root, "corpus/assets/ntc2018/5.1-step4.json");
  const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
  for (const asset of [...(manifest.tables ?? []), ...(manifest.figures ?? [])]) {
    if (asset.pdfPage < 182 || asset.pdfPage > 185 || !asset.caption) continue;
    const separator = " - "; const at = asset.caption.indexOf(separator);
    if (at < 0) throw new Error(`Didascalia senza separatore: ${asset.caption}`);
    asset.captionInline = [{ kind: "text", value: asset.caption.slice(0, at + separator.length) }, { kind: "em", value: asset.caption.slice(at + separator.length) }];
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await unit("5.2.2.2.3.json", (value) => {
  marker(value, [3, 4, 27, 28], "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
  marker(value, [18, 20], "none", "Ripristinata la voce etichettata con il relativo rientro verificati nel render ufficiale.");
});
await unit("5.2.3.2.2.1.json", (value) => {
  for (const index of [1, 4, 13]) {
    const block = value.blocks[index]!;
    if (!block.text) throw new Error("Sottotitolo atteso assente.");
    block.text.inline = [{ kind: "em", value: block.text.normalized }];
    if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinato il sottotitolo in corsivo verificato nel render ufficiale." });
  }
  marker(value, [8, 9, 10, 15, 16], "dash", "Ripristinato il trattino e il rientro dell’elenco verificati nel render ufficiale.");
});
await captions();
