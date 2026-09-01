import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
type Segment = { kind: "text" | "math"; value: string; latex?: string };
type Block = {
    blockId: string;
    evidence: { pdfPage: number };
    text?: { normalized: string; inline?: Segment[] };
};
type Unit = { blocks: Block[] };
function segmentsFor(text: string, terms: Array<[string, string]>): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let next: { index: number; value: string; latex: string } | undefined;
    for (const [value, latex] of terms) {
      const index = text.indexOf(value, cursor);
      if (index >= 0 && (!next || index < next.index || (index === next.index && value.length > next.value.length))) {
        next = { index, value, latex };
      }
    }
    if (!next) {
      segments.push({ kind: "text", value: text.slice(cursor) });
      break;
    }
    if (next.index > cursor) segments.push({ kind: "text", value: text.slice(cursor, next.index) });
    segments.push({ kind: "math", value: next.value, latex: next.latex });
    cursor = next.index + next.value.length;
  }
  return segments.filter(({ value }) => value);
}

async function updateUnit(file: string, updates: Array<{ suffix: string; page: number; terms: Array<[string, string]> }>) {
  const unitPath = join(root, "corpus", "units", "circ2019", file);
  const unit = JSON.parse(await readFile(unitPath, "utf8")) as Unit;
  for (const update of updates) {
    const block = unit.blocks.find((candidate) =>
      candidate.blockId.endsWith(update.suffix) && candidate.evidence.pdfPage === update.page,
    );
    if (!block?.text) throw new Error(`Blocco ${file} ${update.suffix} pagina ${update.page} non trovato`);
    block.text.inline = segmentsFor(block.text.normalized, update.terms);
  }
  await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

await updateUnit("c8.4.2.json", [
  { suffix: "#block-editorial-005", page: 256, terms: [["ζ_E", "\\zeta_E"], ["0,6", "0{,}6"], ["0,1", "0{,}1"]] },
  { suffix: "#block-editorial-006", page: 257, terms: [["ζ_E", "\\zeta_E"], ["1,0", "1{,}0"]] },
]);
await updateUnit("c8.4.3.json", [
  { suffix: "#block-editorial-003", page: 257, terms: [["ζ_E", "\\zeta_E"], ["10%", "10\\%"], ["0,8", "0{,}8"]] },
]);
console.log("circ8-formula-audit: updated C8.4.2 pages 256-257 and C8.4.3 page 257");
