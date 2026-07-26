import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/circ2019/core-tables.json`;

type Cell = {
    text: string;
    latex?: string;
    colSpan?: number;
    rowSpan?: number;
};

const text = (
    value: string,
    span: Pick<Cell, "colSpan" | "rowSpan"> = {},
): Cell => ({ text: value, ...span });

const math = (
    value: string,
    latex: string,
    span: Pick<Cell, "colSpan" | "rowSpan"> = {},
): Cell => ({ text: value, latex, ...span });

const tables = [
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.2.i",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.2.1",
        officialNumber: "C3.2.I",
        pdfPage: 48,
        caption: "Tabella C3.2.I – Valori di TR espressi in funzione di VR",
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
                text("SLO"),
                math(
                    "(¹) 30 anni ≤ TR = 0,60·VR",
                    "^{(1)}30\\,\\text{anni}\\le T_R=0{,}60V_R",
                ),
            ],
            [text("SLD"), math("TR = VR", "T_R=V_R")],
            [
                text("Stati Limite Ultimi (SLU)", { rowSpan: 2 }),
                text("SLV"),
                math("TR = 9,50·VR", "T_R=9{,}50V_R"),
            ],
            [
                text("SLC"),
                math(
                    "TR = 19,50·VR ≤ 2475 anni (¹)",
                    "T_R=19{,}50V_R\\le2475\\,\\text{anni}^{(1)}",
                ),
            ],
        ],
        notes: [
            "¹ I limiti inferiore e superiore di TR fissati nell’allegato A al Decreto del Ministro delle Infrastrutture 14 gennaio 2008 pubblicato nel S.O. alla Gazzetta Ufficiale del 4 febbraio 2008 ed eventuali successivi aggiornamenti sono dovuti all’intervallo di riferimento della pericolosità sismica oggi disponibile; per opere speciali possono considerarsi azioni sismiche riferite a TR più elevati.",
        ],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.2.ii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.2.1",
        officialNumber: "C3.2.II",
        pdfPage: 49,
        caption: "Tabella C3.2.II – Valori di P*VR e TR al variare di CU",
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
                text("81,00%"),
                text("68,80%"),
                text("64,60%"),
                math("0,60·VR", "0{,}60V_R"),
                math("0,86·VR", "0{,}86V_R"),
                math("0,96·VR", "0{,}96V_R"),
            ],
            [
                text("SLD"),
                text("63,00%"),
                text("55,83%"),
                text("53,08%"),
                math("VR", "V_R"),
                math("1,22·VR", "1{,}22V_R"),
                math("1,32·VR", "1{,}32V_R"),
            ],
            [
                text("SLU", { rowSpan: 2 }),
                text("SLV"),
                text("10,00%"),
                text("9,83%"),
                text("9,75%"),
                math("9,50·VR", "9{,}50V_R"),
                math("9,66·VR", "9{,}66V_R"),
                math("9,75·VR", "9{,}75V_R"),
            ],
            [
                text("SLC"),
                text("5,00%"),
                text("4,96%"),
                text("4,94%"),
                math("19,50·VR", "19{,}50V_R"),
                math("19,66·VR", "19{,}66V_R"),
                math("19,75·VR", "19{,}75V_R"),
            ],
        ],
        notes: [],
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
                math("h/d ≤ 1: cpe = 0,7 + 0,1·h/d", "\\frac{h}{d}\\le1:\\quad c_{pe}=0{,}7+0{,}1\\frac{h}{d}"),
                math("h/d ≤ 0,5: cpe = −0,5 − 0,8·h/d", "\\frac{h}{d}\\le0{,}5:\\quad c_{pe}=-0{,}5-0{,}8\\frac{h}{d}"),
                math("h/d ≤ 1: cpe = −0,3 − 0,2·h/d", "\\frac{h}{d}\\le1:\\quad c_{pe}=-0{,}3-0{,}2\\frac{h}{d}"),
            ],
            [
                math("h/d > 1: cpe = 0,8", "\\frac{h}{d}>1:\\quad c_{pe}=0{,}8"),
                math("h/d > 0,5: cpe = −0,9", "\\frac{h}{d}>0{,}5:\\quad c_{pe}=-0{,}9"),
                math("1 < h/d ≤ 5: cpe = −0,5 − 0,05·(h/d−1)", "1<\\frac{h}{d}\\le5:\\quad c_{pe}=-0{,}5-0{,}05\\left(\\frac{h}{d}-1\\right)"),
            ],
        ],
        notes: [],
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
                math("h/d", "\\frac{h}{d}"),
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
    },
];

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const reviewed = new Set(tables.map(({ officialNumber }) => officialNumber));
manifest.tables = manifest.tables.filter(
    (candidate: { officialNumber?: string }) =>
        !candidate.officialNumber || !reviewed.has(candidate.officialNumber),
);
manifest.tables.push(...tables);

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ3-step1-tables: rebuilt ${tables.length} tables`);
