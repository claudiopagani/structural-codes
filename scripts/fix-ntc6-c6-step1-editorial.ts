import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineSegment = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: "bullet" | "dash" | "none"; listLevel?: number; text?: { raw: string; normalized: string; inline?: InlineSegment[] }; evidence?: { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> } };
type Unit = { blocks: Block[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const rule = "ntc6-c6-step1-editorial-formatting-0.1.0";
const labeledListRule = "circ6-labeled-list-editorial-formatting-0.1.0";
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
async function applyLevels(document: "ntc2018" | "circ2019", file: string, entries: Array<[number, number]>) {
  const path = join(root, "corpus/units", document, file);
  const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
  for (const [index, listLevel] of entries) {
    const block = unit.blocks[index]!;
    if (block.kind !== "list-item") throw new Error(`${file}#${index} non è un list-item`);
    block.listLevel = listLevel;
    if (block.evidence && !block.evidence.transformations.some((x) => x.ruleVersion === rule)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: rule, note: "Ripristinati marcatore e rientro dell’elenco verificati nel render ufficiale." });
  }
  for (const block of unit.blocks) if (block.text && block.evidence) { block.evidence.rawSha256 = hash(block.text.raw); block.evidence.normalizedSha256 = hash(block.text.normalized); }
  await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`);
}
async function applyLabeledList(document: "ntc2018" | "circ2019", file: string, entries: Array<[number, string]>) {
  const path = join(root, "corpus/units", document, file);
  const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
  for (const [index, label] of entries) {
    const block = unit.blocks[index]!;
    if (!block.text || !block.text.normalized.startsWith(`${label} `)) throw new Error(`${file}#${index} non contiene l’etichetta ${label}`);
    block.kind = "list-item";
    block.listMarker = "none";
    block.listLevel = 0;
    block.text.inline = [
      { kind: "strong", value: label },
      { kind: "text", value: block.text.normalized.slice(label.length) },
    ];
    if (block.evidence && !block.evidence.transformations.some((x) => x.ruleVersion === labeledListRule)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: labeledListRule, note: "Ripristinata la lista con etichette in grassetto e descrizioni allineate verificata nel render ufficiale." });
  }
  for (const block of unit.blocks) if (block.text && block.evidence) { block.evidence.rawSha256 = hash(block.text.raw); block.evidence.normalizedSha256 = hash(block.text.normalized); }
  await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`);
}
async function applyTableLayouts(file: string, layouts: Record<string, number[]>, alignOnly: string[] = []) {
  const path = join(root, "corpus/assets/ntc2018", file);
  type AssetCell = { text: string; align?: "left" | "center" | "right"; inline?: Array<Record<string, string>>; [key: string]: unknown };
  type AssetTable = { officialNumber: string; columnWidths?: number[]; headers: AssetCell[][]; rows: AssetCell[][]; notesInline?: Array<Array<Record<string, string>>> };
    const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: AssetTable[] };
    for (const table of manifest.tables) {
      const widths = layouts[table.officialNumber];
    if (!widths && !alignOnly.includes(table.officialNumber)) continue;
    if (widths) table.columnWidths = widths;
    for (const row of [...table.headers, ...table.rows]) for (const cell of row) cell.align = "center";
    if (table.officialNumber.startsWith("6.2.")) {
      const header = table.headers[0];
      if (header?.[0]) header[0].align = "left";
      for (const [rowIndex, row] of table.rows.entries()) if ((table.officialNumber === "6.2.II" || rowIndex % 2 === 0) && row[0]) row[0].align = "left";
    }
    if (table.officialNumber === "6.2.I") {
      const first = table.headers[0];
      const [first0, first1, , first3, first4, first5] = first ?? [];
      if (!first0 || !first1 || !first3 || !first4 || !first5) throw new Error(`Intestazione incompleta per ${table.officialNumber}`);
      table.headers = [[first0, first1, { text: "Coefficiente Parziale\nγF (o γE)", latex: "\\begin{gathered}\\text{Coefficiente Parziale}\\\\\\gamma_F\\;(\\mathrm{o}\\;\\gamma_E)\\end{gathered}", align: "center" }, first3, first4, first5]];
      first0.align = "left";
      table.notesInline = [[{ kind: "text", value: "(1) Per i carichi permanenti G₂ si applica quanto indicato alla Tabella 2.6.I. Per la spinta delle terre si fa riferimento ai coefficienti " }, { kind: "math", value: "γG1", latex: "\\gamma_{G1}" }, { kind: "text", value: "." }]];
    }
    if (table.officialNumber === "6.2.II" && table.headers[0]) table.headers[0][1] = { text: "Grandezza alla quale\napplicare il coefficiente parziale", latex: "\\begin{gathered}\\text{Grandezza alla quale}\\\\\\text{applicare il coefficiente parziale}\\end{gathered}", align: "center" };
    if (table.officialNumber === "6.2.III") {
      if (table.headers[0]) table.headers[0][2] = { text: "Coefficiente Parziale\nγF (o γE)", latex: "\\begin{gathered}\\text{Coefficiente Parziale}\\\\\\gamma_F\\;(\\mathrm{o}\\;\\gamma_E)\\end{gathered}", align: "center" };
      table.notesInline = [[{ kind: "text", value: "(1) Per i carichi permanenti G₂ si applica quanto indicato alla Tabella 2.6.I. Per la spinta delle terre si fa riferimento ai coefficienti " }, { kind: "math", value: "γG1", latex: "\\gamma_{G1}" }, { kind: "text", value: "." }]];
    }
    if (table.officialNumber === "6.2.I" || table.officialNumber === "6.2.III") {
      const firstColumnInline: Record<string, Array<Record<string, string>>> = {
        "Carichi permanenti G₁": [{ kind: "text", value: "Carichi permanenti " }, { kind: "math", value: "G₁", latex: "G_1" }],
        "Carichi permanenti G₂ (1)": [{ kind: "text", value: "Carichi permanenti " }, { kind: "math", value: "G₂", latex: "G_2" }, { kind: "math", value: "(1)", latex: "^{(1)}" }],
        "Azioni variabili Q": [{ kind: "text", value: "Azioni variabili " }, { kind: "math", value: "Q", latex: "Q" }],
      };
      for (const row of table.rows) {
        const cell = row[0];
        if (cell && firstColumnInline[cell.text]) {
          cell.inline = firstColumnInline[cell.text];
          delete cell.latex;
        }
      }
    }
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
const dash = (count: number, start: number) => Array.from({ length: count }, (_, offset) => [start + offset, "dash"] as [number, "dash"]);
await apply("ntc2018", "6.1.1.json", dash(8, 2));
await apply("ntc2018", "6.2.json", [[2,"none"],[3,"none"],[4,"none"],[5,"none"],[6,"none"],[7,"none"]]);
await apply("ntc2018", "6.2.4.1.2.json", [[2,"none"],[3,"none"],[4,"none"]]);
await apply("ntc2018", "6.2.4.2.json", [[10,"none"],[11,"none"]]);
await apply("ntc2018", "6.2.5.json", dash(4, 3));
await apply("ntc2018", "6.3.3.json", dash(2, 3));
await apply("ntc2018", "6.4.2.1.json", [[5,"bullet"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"bullet"],[10,"dash"]]);
await applyLevels("ntc2018", "6.4.2.1.json", [[5,0],[6,1],[7,1],[8,1],[9,0],[10,1]]);
await apply("ntc2018", "6.4.3.1.json", [[5,"bullet"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"dash"],[10,"bullet"],[11,"dash"],[12,"dash"]]);
await applyLevels("ntc2018", "6.4.3.1.json", [[5,0],[6,1],[7,1],[8,1],[9,1],[10,0],[11,1],[12,1]]);
for (const [file, start, count] of [["c6.2.1.json",3,6],["c6.2.2.1.json",8,6],["c6.2.2.5.json",3,12],["c6.3.1.json",3,11],["c6.3.2.json",5,5],["c6.3.3.json",2,3],["c6.3.6.json",5,6]] as const) await apply("circ2019", file, dash(count, start));
await applyLabeledList("circ2019", "c6.2.4.1.json", [[2,"EQU"],[3,"STR"],[4,"GEO"],[5,"UPL"],[6,"HYD"]]);
await apply("circ2019", "c6.2.4.1.json", [[11,"none"],[12,"none"]]);
await apply("circ2019", "c6.4.1.json", [[4,"none"],[5,"dash"],[6,"none"],[7,"none"],[8,"none"],[9,"dash"],[10,"none"],[11,"dash"],[12,"dash"],[13,"dash"],[14,"dash"],[15,"none"],[16,"dash"],[17,"dash"],[18,"dash"]]);
await applyLevels("circ2019", "c6.4.1.json", [[4,0],[5,1],[6,1],[7,1],[8,1],[9,1],[10,0],[11,1],[12,1],[13,1],[14,1],[15,0],[16,1],[17,1],[18,1]]);
await apply("ntc2018", "6.4.3.2.json", dash(2, 2));
await apply("ntc2018", "6.4.3.3.json", [[4,"bullet"],[5,"dash"],[6,"dash"],[7,"dash"],[8,"bullet"],[9,"dash"],[10,"dash"]]);
await applyLevels("ntc2018", "6.4.3.3.json", [[4,0],[5,1],[6,1],[7,1],[8,0],[9,1],[10,1]]);
await apply("ntc2018", "6.4.3.7.2.json", [[4,"dash"],[5,"dash"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"dash"]]);
await applyLevels("ntc2018", "6.4.3.7.2.json", [[4,0],[5,0],[6,0],[7,0],[8,0],[9,0]]);
await apply("ntc2018", "6.5.json", dash(3, 2));
await apply("ntc2018", "6.5.2.2.json", dash(3, 3));
await apply("ntc2018", "6.5.3.1.1.json", [[2,"bullet"],[3,"dash"],[4,"dash"],[5,"dash"],[6,"dash"],[7,"bullet"],[8,"dash"]]);
await applyLevels("ntc2018", "6.5.3.1.1.json", [[2,0],[3,1],[4,1],[5,1],[6,1],[7,0],[8,1]]);
await apply("ntc2018", "6.5.3.1.2.json", [[2,"bullet"],[3,"dash"],[4,"dash"],[5,"dash"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"dash"],[10,"bullet"],[11,"dash"],[12,"dash"],[13,"dash"],[16,"dash"],[17,"dash"]]);
await applyLevels("ntc2018", "6.5.3.1.2.json", [[2,0],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,0],[11,1],[12,1],[13,1],[16,0],[17,0]]);
await apply("ntc2018", "6.6.2.json", [[7,"none"],[8,"none"]]);
await apply("ntc2018", "6.6.4.1.json", [[5,"dash"],[6,"dash"],[7,"dash"],[8,"dash"],[9,"dash"],[10,"dash"]]);
await applyLevels("ntc2018", "6.6.4.1.json", [[5,0],[6,0],[7,0],[8,0],[9,0],[10,0]]);
await apply("ntc2018", "6.7.1.json", dash(7, 3));
await apply("ntc2018", "6.7.5.json", [[5,"dash"],[6,"dash"]]);
await applyLevels("ntc2018", "6.7.5.json", [[5,0],[6,0]]);
for (const [file, start, count] of [["c6.6.1.json",2,9],["c6.6.2.json",2,2],["c6.8.1.2.json",2,4],["c6.8.1.2.json",7,3],["c6.12.1.json",2,4]] as const) await apply("circ2019", file, dash(count, start));
await apply("ntc2018", "6.10.3.json", dash(6, 2));
await apply("ntc2018", "6.12.json", [[2,"none"],[3,"none"],[4,"none"],[5,"none"],[6,"none"],[7,"none"],[8,"none"],[9,"none"],[10,"none"]]);
await applyTableLayouts("6-step1.json", {
  "6.2.I": [27, 15, 20, 13, 13, 12],
  "6.2.II": [30, 30, 18, 11, 11],
  "6.2.III": [27, 16, 33, 24],
  "6.4.I": [50, 50],
  "6.4.II": [30, 13, 19, 19, 19],
  "6.4.III": [38, 12, 12, 12, 12, 14],
  "6.4.IV": [34, 9, 9, 9, 9, 9, 9, 12],
  "6.4.V": [38, 12, 12, 12, 12, 14],
});
await applyTableLayouts("6-step2.json", {
  "6.4.VI": [100],
  "6.5.I": [58, 42],
  "6.6.I": [33, 27, 40],
  "6.6.II": [43, 19, 19, 19],
  "6.6.III": [38, 12, 12, 12, 12, 14],
}, ["6.8.I"]);
