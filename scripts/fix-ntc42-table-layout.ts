/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc42-table-layout-editorial-profile-0.1.0";
const assetDir = join(root, "corpus", "assets", "ntc2018");
const unitDir = join(root, "corpus", "units", "ntc2018");

type Cell = {
  text: string;
  latex?: string;
  align?: "left" | "center" | "right";
  colSpan?: number;
  rowSpan?: number;
  image?: {
    imagePath: string;
    alt: string;
    sha256: string;
    region: { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
  };
  [key: string]: unknown;
};

type Table = { officialNumber: string; headers: Cell[][]; rows: Cell[][]; notes: string[] };

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as { tables: Table[] };
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function centerRows(rows: Cell[][]) {
  for (const row of rows) for (const cell of row) cell.align = "center";
}

const diagramSpecs = [
  ["table4.2.x-diagram-1.png", "Diagramma di momento flettente per ψ = 1.", "7c15203df19b371f99eea64890467bc9aad392b5b42456a29bfc376df7539df2", 89, 407, 101, 21],
  ["table4.2.x-diagram-2.png", "Diagramma di momento flettente per −1 ≤ ψ ≤ 1.", "422f3c409be5c688817ef27f18c3da29998d24758911a29929fe301706091924", 89, 431, 101, 21],
  ["table4.2.x-diagram-3.png", "Diagramma di momento flettente.", "699cce8552a2126666ee10f551421e511fac159c644153182dba4c7f4a3b85ee", 89, 454, 101, 15],
  ["table4.2.x-diagram-4.png", "Diagramma di momento flettente.", "fe06cbb9396b36ab2f341aedadd8347137454b3f48494b7c6e66d50c8920ff7b", 89, 474, 101, 10],
  ["table4.2.x-diagram-5.png", "Diagramma di momento flettente.", "c3e04e423a5d45414804fb597e04f104e930365f7ba3c4de3a4c08b41a41d9b1", 89, 495, 101, 15],
  ["table4.2.x-diagram-6.png", "Diagramma di momento flettente.", "a9899d94567d2c53a03409ed78802a7ea7dbd33b24bf1481c18c6b7b1c469d1c", 89, 512, 101, 15],
  ["table4.2.x-diagram-7.png", "Diagramma di momento flettente.", "167e068ec9e95c83c6d592c464fe282e30d9bafb69cd1b47f0e78057cb3dc792", 89, 533, 101, 14],
  ["table4.2.x-diagram-8.png", "Diagramma di momento flettente.", "b6d81c28ce4d67e37b6f9e724752e44232621a3e53c59ba7517844a2a767ea7a", 89, 554, 101, 16],
] as const;

function imageCell(index: number): Cell {
  const spec = diagramSpecs[index];
  if (!spec) throw new Error(`Diagramma Tab. 4.2.X mancante: ${index + 1}`);
  const [filename, alt, sha256, x, y, width, height] = spec;
  return {
    text: "",
    align: "center",
    image: {
      imagePath: `figures/ntc2018/${filename}`,
      alt,
      sha256,
      region: { coordinateSystem: "pdf-points-top-left", x, y, width, height },
    },
  };
}

function updateTables(manifest: { tables: Table[] }, requestedNumbers: readonly string[]) {
  const byNumber = new Map(manifest.tables.map((table) => [table.officialNumber, table]));
  for (const number of requestedNumbers.filter((value) => ["4.2.IX (a)", "4.2.IX (b)", "4.2.XVI", "4.2.XVII", "4.2.XVIII", "4.2.XIX"].includes(value))) {
    const table = byNumber.get(number);
    if (!table) throw new Error(`Tabella mancante: ${number}`);
    centerRows(table.headers);
    centerRows(table.rows);
  }

  if (requestedNumbers.includes("4.2.X")) {
    const tableX = byNumber.get("4.2.X");
    if (!tableX) throw new Error("Tabella mancante: 4.2.X");
    centerRows(tableX.headers);
    tableX.rows.forEach((row, index) => {
      row[0] = imageCell(index);
      if (row[1]) row[1].align = "center";
    });
    tableX.notes = [];
  }

  for (const [number, title, first, second] of ([
    ["4.2.XII", "Limiti superiori per gli spostamenti verticali", "δmax/L", "δ2/L"],
    ["4.2.XIII", "Limiti superiori per gli spostamenti orizzontali", "δ/h", "Δ/H"],
  ] as const).filter(([number]) => requestedNumbers.includes(number))) {
    const table = byNumber.get(number);
    if (!table) throw new Error(`Tabella mancante: ${number}`);
    const firstHeader = table.headers[0]?.[0];
    if (!firstHeader) throw new Error(`Intestazione mancante: ${number}`);
    table.headers = [
      [{ ...firstHeader, rowSpan: 2, align: "center" }, { text: title, colSpan: 2, align: "center" }],
      [
        { text: first, latex: number === "4.2.XII" ? "\\dfrac{\\delta_{max}}{L}" : "\\dfrac{\\delta}{h}", align: "center" },
        { text: second, latex: number === "4.2.XII" ? "\\dfrac{\\delta_2}{L}" : "\\dfrac{\\Delta}{H}", align: "center" },
      ],
    ];
    for (const row of table.rows) {
      for (const cell of row.slice(-2)) {
        cell.align = "center";
        if (cell.latex?.startsWith("\\frac{")) cell.latex = cell.latex.replace(/^\\frac\{/, "\\dfrac{");
      }
    }
  }

  const tableXIV = requestedNumbers.includes("4.2.XIV") ? byNumber.get("4.2.XIV") : undefined;
  if (requestedNumbers.includes("4.2.XIV")) {
    if (!tableXIV) throw new Error("Tabella mancante: 4.2.XIV");
    const sleCell = tableXIV.rows[6]?.[0];
    if (!sleCell) throw new Error("Cella SLE mancante: 4.2.XIV");
    sleCell.text = "Resistenza a scorrimento: per SLE";
    for (const row of tableXIV.rows) if (row[1]) row[1].align = "center";
  }
}

async function updateListUnit() {
  const path = join(unitDir, "4.2.8.json");
  const unit = JSON.parse(await readFile(path, "utf8")) as { blocks: Array<Record<string, any>> };
  for (const suffix of ["l1", "l2"]) {
    const block = unit.blocks.find((candidate) => candidate.blockId.endsWith(`#block-${suffix}`));
    if (!block?.text) throw new Error(`Blocco elenco mancante: ${suffix}`);
    const text = block.text as { raw: string; normalized: string; inline?: Array<{ kind: string; value: string }> };
    const normalized = text.normalized.replace(/^\s*[–—-]\s+/u, "");
    text.normalized = normalized;
    if (text.inline?.[0]?.kind === "text") text.inline[0].value = text.inline[0].value.replace(/^\s*[–—-]\s+/u, "");
    block.kind = "list-item";
    block.listMarker = "dash";
    const evidence = block.evidence as { normalizedSha256: string; transformations?: Array<{ operation: string; ruleVersion: string; note: string }> };
    evidence.normalizedSha256 = hash(normalized);
    evidence.transformations ??= [];
    if (!evidence.transformations.some((item) => item.ruleVersion === profile)) {
      evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; la descrizione è resa nella colonna di testo oltre il trattino." });
    }
  }
  await writeJson(path, unit);
}

const manifests = new Map<string, { tables: Table[] }>();
const targets: Record<string, readonly string[]> = {
  "4.2-step4b.json": ["4.2.IX (a)", "4.2.IX (b)"],
  "4.2-step4c.json": ["4.2.X"],
  "4.2-step4d.json": ["4.2.XII", "4.2.XIII"],
  "4.2-step5.json": ["4.2.XIV", "4.2.XVI", "4.2.XVII", "4.2.XVIII"],
  "4.2-step6.json": ["4.2.XIX"],
};
for (const filename of Object.keys(targets)) {
  const path = join(assetDir, filename);
  const manifest = await readJson(path);
  manifests.set(filename, manifest);
  const requestedNumbers = targets[filename];
  if (!requestedNumbers) throw new Error(`Target mancante: ${filename}`);
  updateTables({ tables: manifest.tables }, requestedNumbers);
  await writeJson(path, manifest);
}
await updateListUnit();
console.log(`Layout NTC 4.2 aggiornato: ${manifests.size} manifest e unità 4.2.8.`);
