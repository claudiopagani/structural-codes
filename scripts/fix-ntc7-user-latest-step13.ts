import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "strong-em" | "math"; value: string; latex?: string };
type Cell = {
    text: string;
    latex?: string;
    inline?: Inline[];
    align?: "left" | "center" | "right";
    colSpan?: number;
    rowSpan?: number;
    shade?: "gray";
    subrowIndent?: boolean;
    subrowLabel?: boolean;
    [key: string]: unknown;
};
type Table = {
    officialNumber: string;
    headers: Cell[][];
    rows: Cell[][];
    columnCount?: number;
    columnWidths?: number[];
};
type Manifest = { tables: Table[] };
type Block = {
    blockId: string;
    kind: string;
    origin: "official";
    listMarker?: "bullet" | "dash" | "none";
    listLevel?: number;
    text?: { raw: string; normalized: string; normalizationVersion: string; inline?: Inline[] };
    [key: string]: unknown;
};
type Unit = { blocks: Block[]; workflow?: { openIssues?: Array<{ issueId?: string; [key: string]: unknown }> } };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc7-user-latest-step13-0.1.0";

function ok(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

async function readJson<T>(relativePath: string): Promise<T> {
    return JSON.parse(await readFile(join(root, relativePath), "utf8")) as T;
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
    await writeFile(join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function table(manifest: Manifest, officialNumber: string): Table {
    const value = manifest.tables.find((candidate) => candidate.officialNumber === officialNumber);
    ok(value, `Tab. ${officialNumber} mancante`);
    return value;
}

function bridgeCell(text: string, value: Cell, align: "left" | "center"): Cell {
    return { ...value, text, align };
}

function bridgeGroup(title: string, labels: string[], values: Array<[Cell, Cell]>): Cell[][] {
    return labels.map((label, index) => {
        const row: Cell[] = [];
        if (index === 0) row.push({ text: title, inline: [{ kind: "strong", value: title }], align: "left", rowSpan: labels.length });
        row.push({ text: label, align: "left", subrowLabel: true });
        row.push(bridgeCell(values[index]![0].text, values[index]![0], "center"));
        row.push(bridgeCell(values[index]![1].text, values[index]![1], "center"));
        return row;
    });
}

const step2 = await readJson<Manifest>("corpus/assets/ntc2018/7-step2.json");
const table73ii = table(step2, "7.3.II");
ok(table73ii.headers.length === 2, "Intestazioni inattese per Tab. 7.3.II");
table73ii.headers[0]![0]!.colSpan = 2;
table73ii.headers[0]![1]!.colSpan = 2;
table73ii.headers[1]![0]!.colSpan = 2;
table73ii.columnCount = 4;
table73ii.columnWidths = [24, 36, 20, 20];

const bridgeIndex = table73ii.rows.findIndex((row) => row[0]?.text === "Ponti (§ 7.9.2.1)");
ok(bridgeIndex >= 0, "Riga Ponti assente in Tab. 7.3.II");
table73ii.rows[bridgeIndex]![0]!.colSpan = 4;
const bridgeSource = table73ii.rows.slice(bridgeIndex + 1);
const bridgeAlreadyStructured = bridgeSource.length === 8
    && bridgeSource[0]?.length === 4
    && bridgeSource[0]?.[0]?.rowSpan === 2
    && bridgeSource[2]?.[0]?.rowSpan === 4
    && bridgeSource[6]?.[0]?.rowSpan === 2;
if (!bridgeAlreadyStructured) ok(bridgeSource.length === 3 && bridgeSource.every((row) => row.length === 3), "Sotto-righe Ponti inattese");

for (const row of table73ii.rows.slice(0, bridgeIndex)) {
    if (row[0]?.colSpan === 3) row[0].colSpan = 4;
    else if (row[0] && row.length >= 2 && row[0].colSpan === undefined) row[0].colSpan = 2;
}

if (!bridgeAlreadyStructured) {
    table73ii.rows = [
        ...table73ii.rows.slice(0, bridgeIndex + 1),
        ...bridgeGroup("Pile in calcestruzzo armato", ["Pile verticali inflesse", "Elementi di sostegno inclinati inflessi"], [
            [{ text: "3,5 λ", latex: "3{,}5\\,\\lambda" }, { text: "1,5" }],
            [{ text: "2,1 λ", latex: "2{,}1\\,\\lambda" }, { text: "1,2" }],
        ]),
        ...bridgeGroup("Pile in acciaio:", ["Pile verticali inflesse", "Elementi di sostegno inclinati inflessi", "Pile con controventi concentrici", "Pile con controventi eccentrici"], [
            [{ text: "3,5" }, { text: "1,5" }],
            [{ text: "2,0" }, { text: "1,2" }],
            [{ text: "2,5" }, { text: "1,5" }],
            [{ text: "3,5" }, { text: "-" }],
        ]),
        ...bridgeGroup("Spalle", ["In genere", "Se si muovono col terreno"], [
            [{ text: "1,5" }, { text: "1,5" }],
            [{ text: "1,0" }, { text: "1,0" }],
        ]),
    ];
}

const step5 = await readJson<Manifest>("corpus/assets/ntc2018/7.5-step1.json");
const table75i = table(step5, "7.5.I");
const header75i = table75i.headers[0]!;
header75i[0]!.text = "Classe di\nduttilità";
header75i[0]!.latex = "\\begin{gathered}\\text{Classe di}\\\\\\text{duttilità}\\end{gathered}";
header75i[1]!.text = "Valore di base q_0 del fattore di\ncomportamento";
header75i[1]!.latex = "\\begin{gathered}\\text{Valore di base }q_0\\text{ del fattore di}\\\\\\text{comportamento}\\end{gathered}";
header75i[2]!.text = "Classe di sezione\ntrasversale richiesta";
header75i[2]!.latex = "\\begin{gathered}\\text{Classe di sezione}\\\\\\text{trasversale richiesta}\\end{gathered}";

const steelTypes = await readJson<Unit>("corpus/units/ntc2018/7.5.2.1.json");
const steelTitles = [
    "Strutture intelaiate",
    "Strutture con controventi concentrici",
    "Strutture con controventi eccentrici",
    "Strutture a mensola o a pendolo inverso",
    "Strutture intelaiate con controventi concentrici",
    "Strutture intelaiate con tamponature",
];
for (const block of steelTypes.blocks) {
    const title = steelTitles.find((candidate) => block.text?.normalized.startsWith(`${candidate}:`));
    if (!title || !block.text) continue;
    const inline = block.text.inline ?? [];
    const titleSegment = inline.find((segment) => segment.value === title);
    if (titleSegment) titleSegment.kind = "strong";
    if (/^b[1-3]\)/u.test(block.text.normalized)) block.listLevel = 1;
    else delete block.listLevel;
}
await writeJson("corpus/units/ntc2018/7.5.2.1.json", steelTypes);

const behavior = await readJson<Unit>("corpus/units/ntc2018/7.5.2.2.json");
for (const block of behavior.blocks) {
    if (block.kind !== "list-item") continue;
    block.listMarker = "dash";
    block.listLevel = 0;
}
await writeJson("corpus/units/ntc2018/7.5.2.2.json", behavior);

const step6 = await readJson<Manifest>("corpus/assets/ntc2018/7.6-step1.json");
const table76ii = table(step6, "7.6.II");
table76ii.headers[0]![1]!.text = "1,5 < q_0 ≤ 4\n(x/d)limite";
table76ii.headers[0]![1]!.latex = "\\begin{gathered}1{,}5<q_0\\le4\\\\(x/d)_{\\mathrm{limite}}\\end{gathered}";
table76ii.headers[0]![2]!.text = "q_0 > 4\n(x/d)limite";
table76ii.headers[0]![2]!.latex = "\\begin{gathered}q_0>4\\\\(x/d)_{\\mathrm{limite}}\\end{gathered}";
const table76iii = table(step6, "7.6.III");
for (const row of [...table76iii.headers, ...table76iii.rows]) {
    if (row[2]) row[2]!.align = "left";
}
await writeJson("corpus/assets/ntc2018/7-step2.json", step2);
await writeJson("corpus/assets/ntc2018/7.5-step1.json", step5);
await writeJson("corpus/assets/ntc2018/7.6-step1.json", step6);

const wood = await readJson<Unit>("corpus/units/ntc2018/7.7.3.json");
wood.blocks = wood.blocks.filter((block) => block.text?.normalized !== ".");
if (wood.workflow?.openIssues) wood.workflow.openIssues = wood.workflow.openIssues.filter((issue) => issue.issueId !== "ntc2018-7-7-3-source-anomaly-standalone-period");
await writeJson("corpus/units/ntc2018/7.7.3.json", wood);

const step78 = await readJson<Manifest>("corpus/assets/ntc2018/7.7-78-step2.json");
const table78ii = table(step78, "7.8.II");
table78ii.headers[0]![0]!.text = "Accelerazione di picco\ndel terreno a_g S (1)";
table78ii.headers[0]![0]!.latex = "\\begin{gathered}\\text{Accelerazione di picco}\\\\\\text{del terreno }a_g S^{(1)}\\end{gathered}";
await writeJson("corpus/assets/ntc2018/7.7-78-step2.json", step78);

console.log(`fix-ntc7-user-latest-step13 (${profile}): righe, elenchi, intestazioni e punteggiatura aggiornati`);
