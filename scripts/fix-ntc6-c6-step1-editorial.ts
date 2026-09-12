import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Block = { kind: string; listMarker?: "bullet" | "dash" | "none"; text?: { raw: string; normalized: string }; evidence?: { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> } };
type Unit = { blocks: Block[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const rule = "ntc6-c6-step1-editorial-formatting-0.1.0";
const hash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
async function apply(document: "ntc2018" | "circ2019", file: string, entries: Array<[number, "bullet" | "dash" | "none"]>) {
  const path = join(root, "corpus/units", document, file);
  const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
  for (const [index, listMarker] of entries) {
    const block = unit.blocks[index]!;
    if (block.kind !== "list-item") throw new Error(`${file}#${index} non è un list-item`);
    block.listMarker = listMarker;
    if (block.evidence && !block.evidence.transformations.some((x) => x.ruleVersion === rule)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: rule, note: "Ripristinati marcatore e rientro dell’elenco verificati nel render ufficiale." });
  }
  for (const block of unit.blocks) if (block.text && block.evidence) { block.evidence.rawSha256 = hash(block.text.raw); block.evidence.normalizedSha256 = hash(block.text.normalized); }
  await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`);
}
const dash = (count: number, start: number) => Array.from({ length: count }, (_, offset) => [start + offset, "dash"] as [number, "dash"]);
await apply("ntc2018", "6.1.1.json", dash(8, 2));
await apply("ntc2018", "6.2.json", [[2,"none"],[3,"none"],[4,"none"],[5,"none"],[6,"none"],[7,"none"]]);
await apply("ntc2018", "6.2.4.1.2.json", [[2,"none"],[3,"none"],[4,"none"]]);
await apply("ntc2018", "6.2.4.2.json", [[10,"none"],[11,"none"]]);
await apply("ntc2018", "6.2.5.json", dash(4, 3));
await apply("ntc2018", "6.3.3.json", dash(2, 3));
await apply("ntc2018", "6.4.2.1.json", [[5,"bullet"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"bullet"],[10,"dash"]]);
await apply("ntc2018", "6.4.3.1.json", [[5,"bullet"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"dash"],[10,"bullet"],[11,"dash"],[12,"dash"]]);
for (const [file, start, count] of [["c6.2.1.json",3,6],["c6.2.2.1.json",8,6],["c6.2.2.5.json",3,12],["c6.3.1.json",3,11],["c6.3.2.json",5,5],["c6.3.3.json",2,3],["c6.3.6.json",5,6]] as const) await apply("circ2019", file, dash(count, start));
await apply("circ2019", "c6.2.4.1.json", [[11,"none"],[12,"none"]]);
await apply("ntc2018", "6.4.3.2.json", dash(2, 2));
await apply("ntc2018", "6.4.3.3.json", [[4,"bullet"],[5,"dash"],[6,"dash"],[7,"dash"],[8,"bullet"],[9,"dash"],[10,"dash"]]);
await apply("ntc2018", "6.4.3.7.2.json", [[4,"none"],[5,"none"],[6,"none"],[7,"none"],[8,"none"],[9,"none"]]);
await apply("ntc2018", "6.5.json", dash(3, 2));
await apply("ntc2018", "6.5.2.2.json", dash(3, 3));
await apply("ntc2018", "6.5.3.1.1.json", [[2,"bullet"],[3,"dash"],[4,"dash"],[5,"dash"],[6,"dash"],[7,"bullet"],[8,"dash"]]);
await apply("ntc2018", "6.5.3.1.2.json", [[2,"bullet"],[3,"dash"],[4,"dash"],[5,"dash"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"dash"],[10,"bullet"],[11,"dash"],[12,"dash"],[13,"dash"],[16,"none"],[17,"none"]]);
await apply("ntc2018", "6.6.2.json", [[7,"none"],[8,"none"]]);
await apply("ntc2018", "6.6.4.1.json", [[5,"none"],[6,"none"],[7,"none"],[8,"none"],[9,"none"],[10,"none"]]);
await apply("ntc2018", "6.7.1.json", dash(7, 3));
await apply("ntc2018", "6.7.5.json", [[5,"none"],[6,"none"]]);
for (const [file, start, count] of [["c6.6.1.json",2,9],["c6.6.2.json",2,2],["c6.8.1.2.json",2,4],["c6.8.1.2.json",7,3],["c6.12.1.json",2,4]] as const) await apply("circ2019", file, dash(count, start));
await apply("ntc2018", "6.10.3.json", dash(6, 2));
await apply("ntc2018", "6.12.json", [[2,"none"],[3,"none"],[4,"none"],[5,"none"],[6,"none"],[7,"none"],[8,"none"],[9,"none"],[10,"none"]]);
