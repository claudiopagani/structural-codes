import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/circ2019/core-tables.json`;

type Cell = {
    text: string;
    latex?: string;
    colSpan?: number;
    rowSpan?: number;
    align?: "left" | "center" | "right";
};

const text = (
    value: string,
    span: Pick<Cell, "colSpan" | "rowSpan" | "align"> = {},
): Cell => ({ text: value, ...span });

const math = (
    value: string,
    latex: string,
    span: Pick<Cell, "colSpan" | "rowSpan" | "align"> = {},
): Cell => ({ text: value, latex, ...span });

const tables = [
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.2.i",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.2.1",
        officialNumber: "C.3.2.I",
        pdfPage: 48,
        caption: "Tabella C.3.2.I – Valori di TR espressi in funzione di VR",
        columnCount: 3,
        headers: [
            [
                text("Stati limite", { colSpan: 2 }),
                math(
                    "Valori in anni del periodo di ritorno TR al variare del periodo di riferimento VR",
                    "\\begin{gathered}\\text{Valori in anni del periodo di ritorno }T_R\\\\\\text{al variare del periodo di riferimento }V_R\\end{gathered}",
                ),
            ],
        ],
        rows: [
            [
                text("Stati Limite di Esercizio (SLE)", { rowSpan: 2 }),
                text("SLO", { align: "center" }),
                math(
                    "(¹) 30 anni ≤ TR = 0,60·VR",
                    "^{(1)}30\\,\\text{anni}\\le T_R=0{,}60V_R",
                    { align: "center" },
                ),
            ],
            [
                text("SLD", { align: "center" }),
                math("TR = VR", "T_R=V_R", { align: "center" }),
            ],
            [
                text("Stati Limite Ultimi (SLU)", { rowSpan: 2 }),
                text("SLV", { align: "center" }),
                math("TR = 9,50·VR", "T_R=9{,}50V_R", { align: "center" }),
            ],
            [
                text("SLC", { align: "center" }),
                math(
                    "TR = 19,50·VR ≤ 2475 anni (¹)",
                    "T_R=19{,}50V_R\\le2475\\,\\text{anni}^{(1)}",
                    { align: "center" },
                ),
            ],
        ],
        notes: [
            "¹ I limiti inferiore e superiore di TR fissati nell’allegato A al Decreto del Ministro delle Infrastrutture 14 gennaio 2008 pubblicato nel S.O. alla Gazzetta Ufficiale del 4 febbraio 2008 ed eventuali successivi aggiornamenti sono dovuti all’intervallo di riferimento della pericolosità sismica oggi disponibile; per opere speciali possono considerarsi azioni sismiche riferite a TR più elevati.",
        ],
        captionInline: [
            { kind: "strong", value: "Tabella C.3.2.I" },
            { kind: "text", value: " – " },
            { kind: "em", value: "Valori di " },
            { kind: "math", value: "TR", latex: "T_R" },
            { kind: "em", value: " espressi in funzione di " },
            { kind: "math", value: "VR", latex: "V_R" },
        ],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.2.ii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.2.1",
        officialNumber: "C.3.2.II",
        pdfPage: 49,
        caption: "Tabella C.3.2.II – Valori di P*VR e TR al variare di CU",
        columnCount: 8,
        headers: [
            [
                text("Stati limite", { colSpan: 2, rowSpan: 2 }),
                math("Valori di P*VR", "\\text{Valori di }P^*_{VR}", {
                    colSpan: 3,
                }),
                math(
                    "Valori di TR corrispondenti",
                    "\\text{Valori di }T_R\\text{ corrispondenti}",
                    { colSpan: 3 },
                ),
            ],
            [
                math("CU = 1,0", "C_U=1{,}0"),
                math("CU = 1,5", "C_U=1{,}5"),
                math("CU = 2,0", "C_U=2{,}0"),
                math("CU = 1,0", "C_U=1{,}0"),
                math("CU = 1,5", "C_U=1{,}5"),
                math("CU = 2,0", "C_U=2{,}0"),
            ],
        ],
        rows: [
            [
                text("SLE", { rowSpan: 2 }),
                text("SLO"),
                text("81,00 %"),
                text("68,80 %"),
                text("64,60 %"),
                math("0,60·VR", "0{,}60\\cdot V_R"),
                math("0,86·VR", "0{,}86\\cdot V_R"),
                math("0,96·VR", "0{,}96\\cdot V_R"),
            ],
            [
                text("SLD"),
                text("63,00 %"),
                text("55,83 %"),
                text("53,08 %"),
                math("VR", "V_R"),
                math("1,22·VR", "1{,}22\\cdot V_R"),
                math("1,32·VR", "1{,}32\\cdot V_R"),
            ],
            [
                text("SLU", { rowSpan: 2 }),
                text("SLV"),
                text("10,00 %"),
                text("9,83 %"),
                text("9,75 %"),
                math("9,50·VR", "9{,}50\\cdot V_R"),
                math("9,66·VR", "9{,}66\\cdot V_R"),
                math("9,75·VR", "9{,}75\\cdot V_R"),
            ],
            [
                text("SLC"),
                text("5,00 %"),
                text("4,96 %"),
                text("4,94 %"),
                math("19,50·VR", "19{,}50\\cdot V_R"),
                math("19,66·VR", "19{,}66\\cdot V_R"),
                math("19,75·VR", "19{,}75\\cdot V_R"),
            ],
        ],
        notes: [],
        captionInline: [
            { kind: "strong", value: "Tabella C.3.2.II" },
            { kind: "text", value: " – " },
            { kind: "em", value: "Valori di " },
            { kind: "math", value: "P*VR", latex: "P^*_{VR}" },
            { kind: "em", value: " e " },
            { kind: "math", value: "TR", latex: "T_R" },
            { kind: "em", value: " al variare di " },
            { kind: "math", value: "CU", latex: "C_U" },
        ],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.i",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.1",
        officialNumber: "C3.3.I",
        pdfPage: 56,
        caption:
            "Tabella C3.3.I – Edifici a pianta rettangolare: cpe per facce sopravento, sottovento e laterali",
        columnCount: 3,
        headers: [
            [
                text("Faccia sopravento"),
                math("CU = 2,0", "C_U=2{,}0"),
                math("CU = 1,5", "C_U=1{,}5"),
            ],
        ],
        rows: [
            [
                math("h/d ≤ 1:\ncpe = 0,7 + 0,1·h/d", "\\begin{gathered}h/d\\le1:\\\\c_{pe}=0{,}7+0{,}1h/d\\end{gathered}"),
                math("h/d ≤ 0,5:\ncpe = −0,5 − 0,8·h/d", "\\begin{gathered}h/d\\le0{,}5:\\\\c_{pe}=-0{,}5-0{,}8h/d\\end{gathered}"),
                math("h/d ≤ 1:\ncpe = −0,3 − 0,2·h/d", "\\begin{gathered}h/d\\le1:\\\\c_{pe}=-0{,}3-0{,}2h/d\\end{gathered}"),
            ],
            [
                math("h/d > 1:\ncpe = 0,8", "\\begin{gathered}h/d>1:\\\\c_{pe}=0{,}8\\end{gathered}"),
                math("h/d > 0,5:\ncpe = −0,9", "\\begin{gathered}h/d>0{,}5:\\\\c_{pe}=-0{,}9\\end{gathered}"),
                math("1 < h/d ≤ 5:\ncpe = −0,5 − 0,05·(h/d−1)", "\\begin{gathered}1<h/d\\le5:\\\\c_{pe}=-0{,}5-0{,}05\\left(h/d-1\\right)\\end{gathered}"),
            ],
        ],
        notes: [],
        captionInline: [
            { kind: "strong", value: "Tabella C3.3.I" },
            { kind: "em", value: " – Edifici a pianta rettangolare: " },
            { kind: "math", value: "cpe", latex: "c_{pe}" },
            { kind: "em", value: " per facce sopravento, sottovento e laterali" },
        ],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.ii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.1",
        officialNumber: "C3.3.II",
        pdfPage: 57,
        caption:
            "Tabella C3.3.II – Edifici a pianta rettangolare: cpe per facce sopravento, sottovento e laterali",
        columnCount: 11,
        headers: [
            [
                text("Zona"),
                text("A", { colSpan: 2 }),
                text("B", { colSpan: 2 }),
                text("C", { colSpan: 2 }),
                text("D", { colSpan: 2 }),
                text("E", { colSpan: 2 }),
            ],
            [
                math("h/d", "h/d"),
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
            ],
        ],
        rows: [
            [
                text("5"),
                text("−1,2"),
                text("−1,4"),
                text("−0,8"),
                text("−1,1"),
                text("−0,5", { colSpan: 2 }),
                text("+0,8"),
                text("+1,0"),
                text("−0,7", { colSpan: 2 }),
            ],
            [
                text("1"),
                text("−1,2"),
                text("−1,4"),
                text("−0,8"),
                text("−1,1"),
                text("−0,5", { colSpan: 2 }),
                text("+0,8"),
                text("+1,0"),
                text("−0,5", { colSpan: 2 }),
            ],
            [
                math("≤ 0,25", "\\le0{,}25"),
                text("−1,2"),
                text("−1,4"),
                text("−0,8"),
                text("−1,1"),
                text("−0,5", { colSpan: 2 }),
                text("+0,7"),
                text("+1,0"),
                text("−0,3", { colSpan: 2 }),
            ],
        ],
        notes: [],
        captionInline: [
            { kind: "strong", value: "Tabella C3.3.II" },
            { kind: "em", value: " – Edifici a pianta rettangolare: " },
            { kind: "math", value: "cpe", latex: "c_{pe}" },
            { kind: "em", value: " per facce sopravento, sottovento e laterali" },
        ],
    },
];

type TableLike = { headers: Cell[][]; rows: Cell[][] };

function setAlignment(table: TableLike, align: "left" | "center" | "right") {
    for (const cell of [...table.headers.flat(), ...table.rows.flat()]) cell.align = align;
}

for (const table of tables) {
    if (table.officialNumber === "C.3.2.II" || table.officialNumber === "C3.3.II") {
        setAlignment(table, "center");
    }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generated = new Map(tables.map((table) => [table.id, table]));
const existingIds = new Set<string>();
manifest.tables = manifest.tables.map((candidate: { id: string; captionInline?: unknown }) => {
    const replacement = generated.get(candidate.id);
    if (!replacement) return candidate;
    existingIds.add(candidate.id);
    return candidate.captionInline === undefined
        ? replacement
        : { ...replacement, captionInline: candidate.captionInline };
});
manifest.tables.push(...tables.filter(({ id }) => !existingIds.has(id)));

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ3-step1-tables: rebuilt ${tables.length} tables`);
