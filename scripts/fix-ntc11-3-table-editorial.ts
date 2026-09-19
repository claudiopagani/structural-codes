import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const assetPath = join(repoRoot, "corpus", "assets", "ntc2018", "11-step2.json");
const unitPath = join(repoRoot, "corpus", "units", "ntc2018", "11.3.3.2.json");

type Cell = {
    text: string;
    latex?: string;
    align?: "left" | "center" | "right";
    colSpan?: number;
    rowSpan?: number;
    noWrap?: boolean;
};
type Inline = { kind: string; value: string; latex?: string };
type Table = {
    officialNumber: string;
    columnCount: number;
    columnWidths?: number[];
    headers: Cell[][];
    rows: Cell[][];
    captionInline?: Inline[];
};
type Manifest = { tables: Table[] };
type Unit = { blocks: Array<{ kind: string; text?: { normalized: string; inline?: Inline[] } }> };

const cell = (text: string, extra: Partial<Cell> = {}): Cell => ({ text, ...extra });
const math = (text: string, latex: string, extra: Partial<Cell> = {}): Cell => ({ text, latex, ...extra });

const manifest = JSON.parse(await readFile(assetPath, "utf8")) as Manifest;
function table(number: string): Table {
    const result = manifest.tables.find((candidate) => candidate.officialNumber === number);
    if (result === undefined) throw new Error(`Tabella non trovata: ${number}`);
    return result;
}
function center(tableAsset: Table): void {
    for (const row of [...tableAsset.headers, ...tableAsset.rows]) for (const currentCell of row) currentCell.align = "center";
}
function centerExceptFirst(tableAsset: Table): void {
    for (const row of [...tableAsset.headers, ...tableAsset.rows]) {
        row.forEach((currentCell, index) => { currentCell.align = index === 0 ? "left" : "center"; });
    }
}

const tableIb = table("11.3.Ib");
tableIb.columnCount = 4;
tableIb.columnWidths = [52, 17, 18, 13];
tableIb.headers = [[
    cell("Caratteristiche", { colSpan: 2, align: "center" }),
    cell("Requisiti", { align: "center" }),
    math("Frattile (%)", "\\mathrm{Frattile}\\;(\\%)", { align: "center" }),
]];
tableIb.rows = [
    [cell("Tensione caratteristica di snervamento", { align: "left" }), math("fyk", "f_{yk}", { align: "right" }), math("≥ fy nom", "\\ge f_{y\\,\\mathrm{nom}}", { align: "center" }), math("5.0", "5.0", { align: "center" })],
    [cell("Tensione caratteristica a carico massimo", { align: "left" }), math("ftk", "f_{tk}", { align: "right" }), math("≥ ft nom", "\\ge f_{t\\,\\mathrm{nom}}", { align: "center" }), math("5.0", "5.0", { align: "center" })],
    [cell("", { align: "left" }), math("(ft/fy)k", "(f_t/f_y)_k", { rowSpan: 2, align: "right" }), math("≥ 1,15", "\\ge1{,}15", { align: "center" }), math("10.0", "10.0", { rowSpan: 2, align: "center" })],
    [cell("", { align: "left" }), math("< 1,35", "<1{,}35", { align: "center" })],
    [cell("", { align: "left" }), math("(fy/fynom)k", "(f_y/f_{y\\,\\mathrm{nom}})_k", { align: "right" }), math("≤ 1,25", "\\le1{,}25", { align: "center" }), math("10.0", "10.0", { align: "center" })],
    [cell("Allungamento", { align: "left" }), math("(Agt)k", "(A_{gt})_k", { align: "right" }), math("≥ 7,5%", "\\ge7{,}5\\%", { align: "center" }), math("10.0", "10.0", { align: "center" })],
    [cell("Diametro del mandrino per prove di piegamento a 90° e successivo raddrizzamento senza cricche:", { align: "left" }), math("Ø < 12 mm", "\\varnothing<12\\;\\mathrm{mm}", { align: "right" }), math("4 Ø", "4\\varnothing", { align: "center" }), cell("", { align: "center" })],
    [cell("", { align: "left" }), math("12 ≤ Ø ≤ 16 mm", "12\\le\\varnothing\\le16\\;\\mathrm{mm}", { align: "right" }), math("5 Ø", "5\\varnothing", { align: "center" }), cell("", { align: "center" })],
    [math("per 16 < Ø ≤ 25 mm", "\\text{per }16<\\varnothing\\le25\\;\\mathrm{mm}", { colSpan: 2, align: "right" }), math("8 Ø", "8\\varnothing", { align: "center" }), cell("", { align: "center" })],
    [math("per 25 < Ø ≤ 40 mm", "\\text{per }25<\\varnothing\\le40\\;\\mathrm{mm}", { colSpan: 2, align: "right" }), math("10 Ø", "10\\varnothing", { align: "center" }), cell("", { align: "center" })],
];

const tableIc = table("11.3.Ic");
tableIc.columnCount = 4;
tableIc.columnWidths = [52, 17, 18, 13];
tableIc.headers = [[
    cell("Caratteristiche", { colSpan: 2, align: "center" }),
    cell("Requisiti", { align: "center" }),
    math("Frattile (%)", "\\mathrm{Frattile}\\;(\\%)", { align: "center" }),
]];
tableIc.rows = [
    [cell("Tensione caratteristica di snervamento", { align: "left" }), math("fyk", "f_{yk}", { align: "right" }), math("≥ fy nom", "\\ge f_{y\\,\\mathrm{nom}}", { align: "center" }), math("5.0", "5.0", { align: "center" })],
    [cell("Tensione caratteristica a carico massimo", { align: "left" }), math("ftk", "f_{tk}", { align: "right" }), math("≥ ft nom", "\\ge f_{t\\,\\mathrm{nom}}", { align: "center" }), math("5.0", "5.0", { align: "center" })],
    [cell("", { align: "left" }), math("(ft/fy)k", "(f_t/f_y)_k", { align: "right" }), math("≥ 1,05", "\\ge1{,}05", { align: "center" }), math("10.0", "10.0", { align: "center" })],
    [cell("", { align: "left" }), math("(fy/fynom)k", "(f_y/f_{y\\,\\mathrm{nom}})_k", { align: "right" }), math("≤ 1,25", "\\le1{,}25", { align: "center" }), math("10.0", "10.0", { align: "center" })],
    [cell("Allungamento", { align: "left" }), math("(Agt)k", "(A_{gt})_k", { align: "right" }), math("≥ 2,5%", "\\ge2{,}5\\%", { align: "center" }), math("10.0", "10.0", { align: "center" })],
    [cell("Diametro del mandrino per prove di piegamento a 90° e successivo raddrizzamento senza cricche: per", { align: "left" }), math("Ø ≤ 10 mm", "\\varnothing\\le10\\;\\mathrm{mm}", { align: "right" }), math("4 Ø", "4\\varnothing", { align: "center" }), cell("", { align: "center" })],
];

centerExceptFirst(table("11.3.II"));
centerExceptFirst(table("11.3.III"));
center(table("11.3.IV"));
center(table("11.3.V"));
for (const number of ["11.3.VII a", "11.3.VII b"]) center(table(number));
const tableVIa = table("11.3.VI a");
tableVIa.rows.at(-1)![1] = math(
    "per 5 mm ≤ Ø ≤ 6 mm ≥ 0.035\\nper 6 mm ≤ Ø ≤ 12 mm ≥ 0.040\\nper Ø ≥ 12 mm ≥ 0.056",
    "\\begin{aligned}\\text{per }5\\;\\mathrm{mm}\\le\\varnothing\\le6\\;\\mathrm{mm}&\\ge0.035\\\\\\text{per }6\\;\\mathrm{mm}\\le\\varnothing\\le12\\;\\mathrm{mm}&\\ge0.040\\\\\\text{per }\\varnothing\\ge12\\;\\mathrm{mm}&\\ge0.056\\end{aligned}",
    { align: "left" },
);
const tableVIb = table("11.3.VI b");
for (const row of [...tableVIb.headers, ...tableVIb.rows]) if (row[1]) row[1].align = "right";

table("11.3.IV").captionInline = [
    { kind: "text", value: "Tab. 11.3.IV - " },
    { kind: "math", value: "fy", latex: "f_y" },
    { kind: "em", value: " – " },
    { kind: "math", value: "ft", latex: "f_t" },
    { kind: "em", value: " – Coefficiente k in funzione del numero n di campioni (per una probabilità di insuccesso attesa del 5% [p = 0,95] con una probabilità del 90%)" },
];
table("11.3.V").captionInline = [
    { kind: "text", value: "Tab. 11.3.V - " },
    { kind: "math", value: "Agt", latex: "A_{gt}" },
    { kind: "em", value: ", " },
    { kind: "math", value: "ft/fy", latex: "f_t/f_y" },
    { kind: "em", value: ", " },
    { kind: "math", value: "fy/fynom", latex: "f_y/f_{y\\,\\mathrm{nom}}" },
    { kind: "em", value: " – Coefficiente k in funzione del numero n di campioni (per una probabilità di insuccesso attesa del 10% [p = 0,90] con una probabilità del 90%)" },
];

const tableVIII = table("11.3.VIII");
tableVIII.columnCount = 6;
tableVIII.columnWidths = [44, 20, 9, 9, 9, 9];
tableVIII.headers = [[
    cell("Tipo di acciaio", { colSpan: 2, align: "center" }),
    cell("Barre", { align: "center" }),
    cell("Fili", { align: "center" }),
    cell("Trefoli e trecce", { align: "center" }),
    cell("Trefoli compattati", { align: "center" }),
]];
tableVIII.rows = [
    [cell("Tensione caratteristica al carico massimo", { align: "left" }), math("fptk N/mm²", "f_{ptk}\\;\\mathrm{N/mm^2}", { align: "right" }), math("≥ 1000", "\\ge1000", { align: "center" }), math("≥ 1570", "\\ge1570", { align: "center" }), math("≥ 1860", "\\ge1860", { align: "center" }), math("≥ 1820", "\\ge1820", { align: "center" })],
    [cell("Tensione caratteristica allo 0,1% di deformazione residua - scostamento dalla proporzionalità", { align: "left" }), math("fp(0,1)k N/mm²", "f_{p(0{,}1)k}\\;\\mathrm{N/mm^2}", { align: "right" }), cell("na", { align: "center" }), math("≥ 1420", "\\ge1420", { align: "center" }), cell("na", { align: "center" }), cell("na", { align: "center" })],
    [cell("Tensione caratteristica all’1% di deformazione totale", { align: "left" }), math("fp(1)k N/mm²", "f_{p(1)k}\\;\\mathrm{N/mm^2}", { align: "right" }), cell("na", { align: "center" }), cell("na", { align: "center" }), math("≥ 1670", "\\ge1670", { align: "center" }), math("≥ 1620", "\\ge1620", { align: "center" })],
    [cell("Tensione caratteristica di snervamento", { align: "left" }), math("fpyk N/mm²", "f_{pyk}\\;\\mathrm{N/mm^2}", { align: "right" }), math("≥ 800", "\\ge800", { align: "center" }), cell("na", { align: "center" }), cell("na", { align: "center" }), cell("na", { align: "center" })],
    [cell("Allungamento totale percentuale a carico massimo", { align: "left" }), math("Agt", "A_{gt}", { align: "right" }), math("≥ 3,5", "\\ge3{,}5", { align: "center" }), math("≥ 3,5", "\\ge3{,}5", { align: "center" }), math("≥ 3,5", "\\ge3{,}5", { align: "center" }), math("≥ 3,5", "\\ge3{,}5", { align: "center" })],
];

const tableIX = table("11.3.IX");
for (const row of [...tableIX.headers, ...tableIX.rows]) if (row[1]) row[1].align = "center";

const tableX = table("11.3.X");
tableX.headers = [[
    math("Diametro nominale\ndel prodotto Ø", "\\begin{gathered}\\text{Diametro nominale}\\\\\\text{del prodotto }\\varnothing\\end{gathered}", { colSpan: 2, align: "center" }),
    math("Limiti della profondità\nmassima delle impronte", "\\begin{gathered}\\text{Limiti della profondità}\\\\\\text{massima delle impronte}\\end{gathered}", { align: "center" }),
    math("Lunghezza delle impronte e\nrelativa tolleranza l", "\\begin{gathered}\\text{Lunghezza delle impronte e}\\\\\\text{relativa tolleranza }l\\end{gathered}", { align: "center" }),
    math("Distanza tra le impronte e\nrelativa tolleranza", "\\begin{gathered}\\text{Distanza tra le impronte e}\\\\\\text{relativa tolleranza}\\end{gathered}", { align: "center" }),
]];

table("11.3.XI").captionInline = [
    { kind: "text", value: "Tab. 11.3.XI - " },
    { kind: "em", value: "Valori inferiori della tensione di prova, " },
    { kind: "math", value: "σ2", latex: "\\sigma_2" },
    { kind: "em", value: " (MPa), nella prova di verifica della resistenza a fatica" },
];

const tableXII = table("11.3.XII");
tableXII.columnWidths = [25, 17, 18, 18, 22];
tableXII.rows = [
    [cell("Materiale Base:\nSpessore minimo delle membrature", { rowSpan: 5, align: "left" }), math("S235, s ≤ 30 mm", "\\mathrm{S235},\\ s\\le30\\;\\mathrm{mm}", { align: "left" }), math("S355, s ≤ 30 mm", "\\mathrm{S355},\\ s\\le30\\;\\mathrm{mm}", { align: "left" }), math("S235", "\\mathrm{S235}", { align: "left" }), cell("S235", { align: "left" })],
    [math("S275, s ≤ 30 mm", "\\mathrm{S275},\\ s\\le30\\;\\mathrm{mm}", { align: "left" }), math("S235", "\\mathrm{S235}", { align: "left" }), math("S275", "\\mathrm{S275}", { align: "left" }), cell("S275", { align: "left" })],
    [cell("", { align: "left" }), math("S275", "\\mathrm{S275}", { align: "left" }), math("S355", "\\mathrm{S355}", { align: "left" }), cell("S355", { align: "left" })],
    [cell("", { align: "left" }), cell("", { align: "left" }), math("S460, s ≤ 30 mm", "\\mathrm{S460},\\ s\\le30\\;\\mathrm{mm}", { align: "left" }), cell("S460 (Nota 1)", { align: "left" })],
    [cell("", { align: "left" }), cell("", { align: "left" }), cell("", { align: "left" }), cell("Acciai inossidabili e altri acciai non esplicitamente menzionati (Nota 1)", { align: "left" })],
    [cell("Livello dei requisiti di qualità secondo la norma UNI EN ISO 3834:2006", { rowSpan: 2, align: "left" }), cell("Elementare", { align: "left" }), cell("Medio", { align: "left" }), cell("Medio", { align: "left" }), cell("Completo", { align: "left" })],
    [cell("UNI EN ISO 3834-4", { align: "left" }), cell("UNI EN ISO 3834-3", { align: "left" }), cell("UNI EN ISO 3834-3", { align: "left" }), cell("UNI EN ISO 3834-2", { align: "left" })],
    [cell("Livello di conoscenza tecnica del personale di coordinamento della saldatura secondo la norma UNI EN ISO 14731", { align: "left" }), cell("Di base", { align: "left" }), cell("Specifico", { align: "left" }), cell("Completo", { align: "left" }), cell("Completo", { align: "left" })],
];
for (const row of tableXII.headers) for (const currentCell of row) currentCell.align = "center";

center(table("11.3.XIII.b"));

await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const unit = JSON.parse(await readFile(unitPath, "utf8")) as Unit;
function groupedLabel(prefix: string, value: string, latex: string, endIndexExclusive: number): void {
    const block = unit.blocks.find((candidate) => candidate.kind === "list-item" && candidate.text?.normalized.startsWith(prefix));
    if (block?.text?.inline === undefined) throw new Error(`Label non trovato: ${prefix}`);
    if (block.text.inline[0]?.kind === "math" && block.text.inline[0].value === value) return;
    block.text.inline = [{ kind: "math", value, latex }, ...block.text.inline.slice(endIndexExclusive)];
}
groupedLabel("Ø, A, M sono", "Ø, A, M", "\\varnothing,\\ A,\\ M", 5);
groupedLabel("fptk, fpyk, fp(1)k, fp(0,1)k ottenuti", "fptk, fpyk, fp(1)k, fp(0,1)k", "f_{ptk},\\ f_{pyk},\\ f_{p(1)k},\\ f_{p(0{,}1)k}", 7);
groupedLabel("fpt/fptk, Agt sono", "fpt/fptk, Agt", "f_{pt}/f_{ptk},\\ A_{gt}", 3);
groupedLabel("N, α (180°) sono", "N, α (180°)", "N,\\ \\alpha\\;(180^\\circ)", 3);
groupedLabel("Ep, D, L, ρ sono", "Ep, D, L, ρ", "E_p,\\ D,\\ L,\\ \\rho", 7);
groupedLabel("Z, p sono", "Z, p", "Z,\\ p", 3);
await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("fix-ntc11-3-table-editorial: Tabelle 11.3.Ib–VII e label dell’elenco aggiornati");
