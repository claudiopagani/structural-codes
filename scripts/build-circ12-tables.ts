import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/circ2019/core-tables.json`;

const textCell = (text: string, extra: Record<string, number> = {}) => ({
    text,
    ...extra,
});

const mathCell = (
    text: string,
    latex: string,
    extra: Record<string, number> = {},
) => ({
    text,
    latex,
    ...extra,
});

const table = {
    id: "urn:structural-codes:it:asset:table:circ2019:c2.4.i",
    unitId: "urn:structural-codes:it:unit:circ2019:c2.4.3",
    officialNumber: "C2.4.I",
    pdfPage: 43,
    caption: "Tabella C2.4.I – Intervalli di valori attribuiti a VR al variare di VN e CU",
    columnCount: 5,
    headers: [
        [
            mathCell(
                "Vita nominale VN",
                "\\begin{gathered}\\text{Vita nominale}\\\\V_N\\end{gathered}",
                { rowSpan: 2 },
            ),
            mathCell(
                "Valori di VR – Classe d’uso",
                "\\begin{gathered}\\text{Valori di }V_R\\\\\\text{Classe d'uso}\\end{gathered}",
                { colSpan: 4 },
            ),
        ],
        ["I", "II", "III", "IV"].map((value) => textCell(value)),
    ],
    rows: [
        [
            mathCell("≤ 10", "\\le 10"),
            textCell("35"),
            textCell("35"),
            textCell("35"),
            textCell("35"),
        ],
        [
            mathCell("≥ 50", "\\ge 50"),
            mathCell("≥ 35", "\\ge 35"),
            mathCell("≥ 50", "\\ge 50"),
            mathCell("≥ 75", "\\ge 75"),
            mathCell("≥ 100", "\\ge 100"),
        ],
        [
            mathCell("≥ 100", "\\ge 100"),
            mathCell("≥ 70", "\\ge 70"),
            mathCell("≥ 100", "\\ge 100"),
            mathCell("≥ 150", "\\ge 150"),
            mathCell("≥ 200", "\\ge 200"),
        ],
    ],
    notes: [],
};

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.tables = manifest.tables.filter(
    (candidate: { officialNumber?: string }) =>
        candidate.officialNumber !== table.officialNumber,
);
manifest.tables.push(table);

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("circ12-tables: rebuilt C2.4.I");
