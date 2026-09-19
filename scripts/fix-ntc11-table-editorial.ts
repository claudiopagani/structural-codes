import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const assetDir = join(repoRoot, "corpus", "assets", "ntc2018");

type Inline = { kind: string; value: string; latex?: string };
type Cell = { text: string; align?: "left" | "center" | "right"; inline?: Inline[]; [key: string]: unknown };
type Table = { officialNumber: string; headers: Cell[][]; rows: Cell[][]; notes: string[]; columnCount?: number; columnWidths?: number[]; notesInline?: Inline[][] };
type Manifest = { tables: Table[] };

async function readManifest(name: string): Promise<Manifest> {
    return JSON.parse(await readFile(join(assetDir, name), "utf8")) as Manifest;
}

function table(manifest: Manifest, officialNumber: string): Table {
    const result = manifest.tables.find((candidate) => candidate.officialNumber === officialNumber);
    if (result === undefined) throw new Error(`Tabella non trovata: ${officialNumber}`);
    return result;
}

function center(tableAsset: Table): void {
    for (const row of [...tableAsset.headers, ...tableAsset.rows]) for (const cell of row) cell.align = "center";
}

function centerExceptFirst(tableAsset: Table): void {
    for (const row of [...tableAsset.headers, ...tableAsset.rows]) for (const [index, cell] of row.entries()) if (index > 0) cell.align = "center";
}

function spacer(): Cell { return { text: "", spacer: true, header: false };
}

const step1 = await readManifest("11-step1.json");
for (const number of ["11.2.I", "11.2.II", "11.2.III"]) center(table(step1, number));
table(step1, "11.2.I").notesInline = [[
    { kind: "text", value: "Ove: " },
    { kind: "math", value: "Rcm28", latex: "R_{cm28}" },
    { kind: "text", value: " = resistenza media dei prelievi (N/mm²); " },
    { kind: "math", value: "Rc,min", latex: "R_{c,\\min}" },
    { kind: "text", value: " = minore valore di resistenza dei prelievi (N/mm²); " },
    { kind: "math", value: "s", latex: "s" },
    { kind: "text", value: " = scarto quadratico medio." },
]];
const rckCell = table(step1, "11.2.IV").rows.flat().find((cell) => cell.text.includes("Rck"));
if (rckCell === undefined) throw new Error("Riga Rck non trovata nella Tab. 11.2.IV");
rckCell.inline = [
    { kind: "text", value: "Resistenza alla frammentazione/frantumazione (per calcestruzzo " },
    { kind: "math", value: "Rck", latex: "R_{ck}" },
    { kind: "text", value: " ≥ C50/60 e aggregato proveniente da riciclo)" },
];
await writeFile(join(assetDir, "11-step1.json"), `${JSON.stringify(step1, null, 2)}\n`, "utf8");

const step2 = await readManifest("11-step2.json");
for (const number of ["11.2.Va", "11.2.Vb", "11.2.VI", "11.2.VII"]) center(table(step2, number));

const t117 = table(step2, "11.7.I");
t117.columnCount = 8;
t117.columnWidths = [19, 11, 3, 22, 11, 3, 21, 10];
t117.headers = [t117.headers[0]!.flatMap((cell) => [cell, spacer(),]).slice(0, 5)];
for (const row of t117.rows) {
    const original = [...row];
    row.splice(0, row.length, original[0]!, original[1]!, spacer(), original[2]!, original[3]!, spacer(), original[4]!, original[5]!);
}
t117.notesInline = t117.notes.map((note, index) => index === 1
    ? [
        { kind: "text", value: "** Il pedice " },
        { kind: "math", value: "mean", latex: "\\mathrm{mean}" },
        { kind: "text", value: " può essere abbreviato con " },
        { kind: "math", value: "m", latex: "m" },
        { kind: "text", value: "." },
    ]
    : [{ kind: "text", value: note }]);

for (const number of ["11.9.I", "11.9.II", "11.9.III", "11.9.IV"]) center(table(step2, number));
centerExceptFirst(table(step2, "11.10.I"));
const t1101 = table(step2, "11.10.I");
t1101.columnWidths = [45, 17, 38];
t1101.headers[0]![0]!.text = "Specifica Tecnica Europea\ndi riferimento";
t1101.rows[0]![0]!.text = "Specifica per elementi per muratura - Elementi per muratura di laterizio,\nsilicato di calcio, in calcestruzzo vibrocompresso (aggregati pesanti e leggeri),\ncalcestruzzo aerato autoclavato, pietra agglomerata, pietra naturale\nUNI EN 771-1, 771-2, 771-3, 771-4, 771-5, 771-6";

const t1102 = table(step2, "11.10.II");
centerExceptFirst(t1102);
t1102.notesInline = t1102.notes.map((note, index) => index === 0
    ? [{ kind: "math", value: "d", latex: "d" }, { kind: "text", value: " è una resistenza a compressione maggiore di 25 N/mm² dichiarata dal fabbricante" }]
    : [{ kind: "text", value: note }]);
for (const number of ["11.10.III", "11.10.IV", "11.10.V", "11.10.VI", "11.10.VII"]) center(table(step2, number));

const t1108 = table(step2, "11.10.VIII");
t1108.columnWidths = [24, 36, 16, 24];
for (const row of [...t1108.headers, ...t1108.rows]) for (const cell of row) cell.align = "center";
const thinMortar = t1108.headers[1]![1]!;
thinMortar.text = "Malta per strati sottili\n(giunto orizzontale\n≥ 0,5 mm e ≤ 3 mm";
thinMortar.latex = "\\begin{gathered}\\text{Malta per strati sottili}\\\\\\text{(giunto orizzontale}\\\\\\ge 0{,}5\\,\\mathrm{mm}\\;\\mathrm{e}\\;\\le 3\\,\\mathrm{mm}\\end{gathered}";
t1108.notesInline = t1108.notes.map((note) => {
    const match = note.match(/^(.*?)(fbk)(.*)$/u);
    if (!match) return [{ kind: "text", value: note }];
    return [{ kind: "text", value: match[1]! }, { kind: "math", value: "fbk", latex: "f_{bk}" }, { kind: "text", value: match[3]! }];
});
await writeFile(join(assetDir, "11-step2.json"), `${JSON.stringify(step2, null, 2)}\n`, "utf8");

console.log("fix-ntc11-table-editorial: Tabelle 11.2, 11.7, 11.9 e 11.10 aggiornate");
