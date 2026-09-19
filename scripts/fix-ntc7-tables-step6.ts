import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type Cell = { text: string; latex?: string; inline?: Inline[]; align?: "left" | "center" | "right"; colSpan?: number; rowSpan?: number; header?: boolean; shade?: "gray"; spacer?: boolean };
type Table = { officialNumber: string; columnWidths?: number[]; headers: Cell[][]; rows: Cell[][]; notes: string[]; notesInline?: Inline[][] };
type Manifest = { tables: Table[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const ntc76 = join(root, "corpus", "assets", "ntc2018", "7.6-step1.json");
const ntc78 = join(root, "corpus", "assets", "ntc2018", "7.7-78-step2.json");

function everyCell(table: Table, callback: (cell: Cell) => void): void {
    for (const row of [...table.headers, ...table.rows]) for (const cell of row) callback(cell);
}

function center(table: Table): void { everyCell(table, (cell) => { cell.align = "center"; }); }

const six = JSON.parse(await readFile(ntc76, "utf8")) as Manifest;
const t61 = six.tables.find((table) => table.officialNumber === "7.6.I");
if (!t61) throw new Error("Tab. 7.6.I mancante");
t61.columnWidths = [30, 35, 35];
t61.headers[0]![0]!.text = "Valore di base q_0\ndel fattore di comportamento";
t61.headers[0]![0]!.latex = "\\begin{gathered}\\text{Valore di base }q_0\\\\\\text{del fattore di comportamento}\\end{gathered}";
t61.rows[0]![0]!.text = "Sezione ad H o I parzialmente o totalmente rivestita in calcestruzzo:\nc/t_f: limiti per le sporgenze delle ali";
t61.rows[0]![0]!.latex = "\\begin{gathered}\\text{Sezione ad H o I parzialmente o totalmente rivestita in calcestruzzo:}\\\\c/t_f\\text{ limiti per le sporgenze delle ali}\\end{gathered}";
t61.rows[1]![0]!.text = "Sezione rettangolare cava riempita di calcestruzzo:\nh/t limite";
t61.rows[1]![0]!.latex = "\\begin{gathered}\\text{Sezione rettangolare cava riempita di calcestruzzo:}\\\\h/t\\text{ limite}\\end{gathered}";
t61.rows[2]![0]!.text = "Sezione circolare cava riempita di calcestruzzo:\nd/t limite";
t61.rows[2]![0]!.latex = "\\begin{gathered}\\text{Sezione circolare cava riempita di calcestruzzo:}\\\\d/t\\text{ limite}\\end{gathered}";
t61.notesInline = [
    [{ kind: "text", value: "Essendo:" }],
    [{ kind: "math", value: "ε = (235/f_yk)^0,5", latex: "\\varepsilon=(235/f_{yk})^{0{,}5}" }],
    [{ kind: "math", value: "c/t_f", latex: "c/t_f" }, { kind: "text", value: ": il rapporto tra la larghezza e lo spessore della parte in aggetto dell’ala definita nella Fig. 7.6.1" }],
    [{ kind: "math", value: "d/t", latex: "d/t" }, { kind: "text", value: " ed " }, { kind: "math", value: "h/t", latex: "h/t" }, { kind: "text", value: ": i rapporti tra massima dimensione esterna e spessore." }],
];

const t62 = six.tables.find((table) => table.officialNumber === "7.6.II");
if (!t62) throw new Error("Tab. 7.6.II mancante");
center(t62);

const t63 = six.tables.find((table) => table.officialNumber === "7.6.III");
if (!t63) throw new Error("Tab. 7.6.III mancante");
const third = t63.rows[0]![2]!;
third.text = "Per M^-: 0,05 L\nPer M^+: 0,0375 L";
third.latex = "\\begin{gathered}\\text{Per }M^-:0{,}05L\\\\\\text{Per }M^+:0{,}0375L\\end{gathered}";

const t64 = six.tables.find((table) => table.officialNumber === "7.6.IV");
if (!t64) throw new Error("Tab. 7.6.IV mancante");
t64.columnWidths = [16, 25, 43, 16];
for (const row of [...t64.headers, ...t64.rows]) for (const [index, cell] of row.entries()) if ([0, 1, 3].includes(index)) cell.align = "center";
await writeFile(ntc76, `${JSON.stringify(six, null, 2)}\n`, "utf8");

const sevenEight = JSON.parse(await readFile(ntc78, "utf8")) as Manifest;
const t81 = sevenEight.tables.find((table) => table.officialNumber === "7.8.I");
if (!t81) throw new Error("Tab. 7.8.I mancante");
center(t81);
t81.columnWidths = [40, 20, 20, 20];

const t82 = sevenEight.tables.find((table) => table.officialNumber === "7.8.II");
if (!t82) throw new Error("Tab. 7.8.II mancante");
t82.columnWidths = [13, 8, 8.78, 8.78, 8.78, 8.78, 8.78, 8.78, 8.78, 8.78, 8.78];
const superTitle = t82.headers[0]![0]!;
superTitle.text = "Accelerazione di picco del terreno\na_g S (1)";
superTitle.latex = "\\begin{gathered}\\text{Accelerazione di picco del terreno}\\\\a_g S^{(1)}\\end{gathered}";
const type = t82.headers[1]![0]!;
type.text = "Tipo di\nstruttura";
type.latex = "\\begin{gathered}\\text{Tipo di}\\\\\\text{struttura}\\end{gathered}";
const floors = t82.headers[1]![1]!;
floors.text = "Numero\npiani";
floors.latex = "\\begin{gathered}\\text{Numero}\\\\\\text{piani}\\end{gathered}";
t82.notesInline = [[
    { kind: "text", value: "(1) " },
    { kind: "math", value: "S_T", latex: "S_T" },
    { kind: "text", value: " si applica solo nel caso di strutture di Classe d’uso III e IV (v. § 2.4.2)" },
]];
await writeFile(ntc78, `${JSON.stringify(sevenEight, null, 2)}\n`, "utf8");

console.log("fix-ntc7-tables-step6: tabelle 7.6.I-IV e 7.8.I-II aggiornate");
