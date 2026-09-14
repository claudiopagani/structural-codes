import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const output = join(
    repoRoot,
    "corpus",
    "assets",
    "circ2019",
    "core-tables.json",
);

type Cell = {
    text: string;
    latex?: string;
    colSpan?: number;
    rowSpan?: number;
    align?: "left" | "center" | "right";
};

type TableAsset = {
    id: string;
    unitId: string;
    officialNumber: string;
    pdfPage: number;
    caption: string;
    columnCount: number;
    headers: Cell[][];
    rows: Cell[][];
    notes?: string[];
};

type ManifestTable = TableAsset & { captionInline?: unknown };

const math = (text: string, latex: string): Cell => ({ text, latex });
const text = (value: string): Cell => ({ text: value });

const tables: TableAsset[] = [
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xviii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.3",
        officialNumber: "C3.3.XVIII",
        pdfPage: 72,
        caption:
            "Tabella C3.3.XVIII – Valori indicativi dei parametri cpm, cpb, αm e αb per k/b ≤ 0,5·10⁻³",
        columnCount: 5,
        headers: [
            [
                math("Re", "\\mathit{Re}"),
                math("cpm", "c_{pm}"),
                math("cpb", "c_{pb}"),
                math("αm [°]", "\\alpha_m\\,[{}^\\circ]"),
                math("αb [°]", "\\alpha_b\\,[{}^\\circ]"),
            ],
        ],
        rows: [
            [
                math("5·10⁵", "5\\cdot10^5"),
                text("-2,2"),
                text("-0,4"),
                text("85"),
                text("135"),
            ],
            [
                math("2·10⁶", "2\\cdot10^6"),
                text("-1,9"),
                text("-0,7"),
                text("80"),
                text("120"),
            ],
            [
                math("10⁷", "10^7"),
                text("-1,5"),
                text("-0,8"),
                text("75"),
                text("105"),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xix",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.8",
        officialNumber: "C3.3.XIX",
        pdfPage: 74,
        caption: "Tabella C3.3.XIX – Valori del coefficiente d’attrito",
        columnCount: 2,
        headers: [
            [
                text("Superficie"),
                math("Coefficiente d’attrito cf", "c_f"),
            ],
        ],
        rows: [
            [text("Liscia (acciaio, cemento a faccia liscia..)"), text("0,01")],
            [text("Scabra (cemento a faccia scabra, catrame..)"), text("0,02")],
            [text("Molto scabra (ondulata, costolata, piegata..)"), text("0,04")],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.4.i",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.4.3.1",
        officialNumber: "C3.4.I",
        pdfPage: 77,
        caption: "Tabella C3.4.I – Coefficienti di forma per il carico neve",
        columnCount: 4,
        headers: [
            [
                math(
                    "Angolo di inclinazione della falda α",
                    "\\text{Angolo di inclinazione della falda }\\alpha",
                ),
                math("0° ≤ α ≤ 30°", "0^\\circ\\le\\alpha\\le30^\\circ"),
                math("30° < α < 60°", "30^\\circ<\\alpha<60^\\circ"),
                math("α ≥ 60°", "\\alpha\\ge60^\\circ"),
            ],
        ],
        rows: [
            [
                math("μ1", "\\mu_1"),
                text("0,8"),
                math("0,8(60-α)/30", "0{,}8(60-\\alpha)/30"),
                text("0,0"),
            ],
            [
                math("μ2", "\\mu_2"),
                math("0,8+0,8α/30", "0{,}8+0{,}8\\alpha/30"),
                text("1,6"),
                text("--"),
            ],
        ],
        notes: [],
    },
];

const manifest = JSON.parse(await readFile(output, "utf8")) as {
    tables: ManifestTable[];
};

function setAlignment(table: TableAsset, align: "left" | "center" | "right") {
    for (const cell of [...table.headers.flat(), ...table.rows.flat()]) cell.align = align;
}

for (const table of tables) {
    if (table.officialNumber === "C3.3.XVIII") setAlignment(table, "center");
    if (table.officialNumber === "C3.3.XIX") {
        for (const row of [...table.headers, ...table.rows]) {
            if (row[0]) row[0].align = "left";
            if (row[1]) row[1].align = "center";
        }
    }
    if (table.officialNumber === "C3.4.I") setAlignment(table, "center");
}

const generated = new Map(tables.map((table) => [table.id, table]));
const existingIds = new Set<string>();
manifest.tables = manifest.tables.map((candidate) => {
    const replacement = generated.get(candidate.id);
    if (!replacement) return candidate;
    existingIds.add(candidate.id);
    return candidate.captionInline === undefined
        ? replacement
        : { ...replacement, captionInline: candidate.captionInline };
});
manifest.tables.push(...tables.filter(({ id }) => !existingIds.has(id)));
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ3-step3-tables: rebuilt ${tables.length} tables`);
