import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/circ2019/core-tables.json`;

type TableSeed = {
    number: string;
    unit: string;
    page: number;
    caption: string;
    headers: TableCell[][] | string[];
    rows: TableCell[][] | string[][];
    notes?: string[];
};

type TableCell = {
    text: string;
    latex?: string;
    inline?: Array<{ kind: "text" | "math"; value: string; latex?: string }>;
    colSpan?: number;
    rowSpan?: number;
};

const cell = (text: string, properties: Omit<TableCell, "text"> = {}): TableCell => ({ text, ...properties });

const inline = (
    text: string,
    ...parts: Array<{ value: string; latex: string }>
): TableCell["inline"] => {
    const segments: NonNullable<TableCell["inline"]> = [];
    let cursor = 0;
    for (const part of parts) {
        const index = text.indexOf(part.value, cursor);
        if (index < 0) throw new Error(`Segmento ${part.value} assente da ${text}`);
        if (index > cursor) segments.push({ kind: "text", value: text.slice(cursor, index) });
        segments.push({ kind: "math", value: part.value, latex: part.latex });
        cursor = index + part.value.length;
    }
    if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
    return segments;
};

function materializeHeaders(headers: TableSeed["headers"]): TableCell[][] {
    if (Array.isArray(headers[0])) return headers as TableCell[][];
    return [(headers as string[]).map((value) => cell(value))];
}

function materializeRows(rows: TableSeed["rows"]): TableCell[][] {
    if (typeof rows[0]?.[0] !== "string") return rows as TableCell[][];
    return (rows as string[][]).map((row) => row.map((value) => cell(value)));
}

const seeds: TableSeed[] = [
    {
        number: "C4.1.I",
        unit: "c4.1.2.2.2",
        page: 90,
        caption: "Tabella C4.1.I – Valori di K e snellezze l/h limite per elementi inflessi di c.a. in assenza di compressione assiale",
        headers: [
            [
                cell("Sistema strutturale", { rowSpan: 2 }),
                cell("K", { rowSpan: 2, inline: inline("K", { value: "K", latex: "K" }) }),
                cell("Calcestruzzo", { colSpan: 2 }),
            ],
            [
                cell("molto sollecitato ρ = 1,5%", {
                    inline: inline("molto sollecitato ρ = 1,5%", { value: "ρ = 1,5%", latex: "\\rho=1{,}5\\%" }),
                }),
                cell("poco sollecitato ρ = 0,5%", {
                    inline: inline("poco sollecitato ρ = 0,5%", { value: "ρ = 0,5%", latex: "\\rho=0{,}5\\%" }),
                }),
            ],
        ],
        rows: [
            ["Travi semplicemente appoggiate, piastre incernierate mono o bidirezionali", "1,0", "14", "20"],
            ["Campate terminali di travi continue o piastre continue mono o bidirezionali, continue sul lato maggiore", "1,3", "18", "26"],
            ["Campate intermedie di travi o piastre continue mono o bidirezionali", "1,5", "20", "30"],
            ["Piastre non nervate sostenute da pilastri (snellezza relativa alla luce maggiore)", "1,2", "17", "24"],
            ["Mensole", "0,4", "6", "8"],
        ],
        notes: [
            "Le snellezze limite sono valutate ponendo, nella formula C4.1.4, fck = 30 MPa e [500 As,eff/(fyk As,calc)] = 1.",
            "Per piastre bidirezionali si fa riferimento alla luce minore; per piastre non nervate si considera la luce maggiore.",
        ],
    },
    {
        number: "C4.1.II",
        unit: "c4.1.2.2.4.5",
        page: 93,
        caption: "Tabella C4.1.II – Diametri massimi delle barre per il controllo di fessurazione",
        headers: [
            [
                cell("Tensione nell’acciaio"),
                cell("Diametro massimo φ delle barre (mm)", {
                    colSpan: 3,
                    inline: inline("Diametro massimo φ delle barre (mm)", { value: "φ", latex: "\\phi" }),
                }),
            ],
            [
                cell("σs [MPa]", { inline: inline("σs [MPa]", { value: "σs", latex: "\\sigma_s" }) }),
                cell("w3 = 0,4 mm", { inline: inline("w3 = 0,4 mm", { value: "w3 = 0,4 mm", latex: "w_3=0{,}4\\,\\mathrm{mm}" }) }),
                cell("w2 = 0,3 mm", { inline: inline("w2 = 0,3 mm", { value: "w2 = 0,3 mm", latex: "w_2=0{,}3\\,\\mathrm{mm}" }) }),
                cell("w1 = 0,2 mm", { inline: inline("w1 = 0,2 mm", { value: "w1 = 0,2 mm", latex: "w_1=0{,}2\\,\\mathrm{mm}" }) }),
            ],
        ],
        rows: [
            ["160", "40", "32", "25"],
            ["200", "32", "25", "16"],
            ["240", "20", "16", "12"],
            ["280", "16", "12", "8"],
            ["320", "12", "10", "6"],
            ["360", "10", "8", "–"],
        ],
    },
    {
        number: "C4.1.III",
        unit: "c4.1.2.2.4.5",
        page: 93,
        caption: "Tabella C4.1.III – Spaziatura massima delle barre per il controllo di fessurazione",
        headers: [
            [
                cell("Tensione nell’acciaio"),
                cell("Spaziatura massima delle barre (mm)", { colSpan: 3 }),
            ],
            [
                cell("σs [MPa]", { inline: inline("σs [MPa]", { value: "σs", latex: "\\sigma_s" }) }),
                cell("w3 = 0,4 mm", { inline: inline("w3 = 0,4 mm", { value: "w3 = 0,4 mm", latex: "w_3=0{,}4\\,\\mathrm{mm}" }) }),
                cell("w2 = 0,3 mm", { inline: inline("w2 = 0,3 mm", { value: "w2 = 0,3 mm", latex: "w_2=0{,}3\\,\\mathrm{mm}" }) }),
                cell("w1 = 0,2 mm", { inline: inline("w1 = 0,2 mm", { value: "w1 = 0,2 mm", latex: "w_1=0{,}2\\,\\mathrm{mm}" }) }),
            ],
        ],
        rows: [
            ["160", "300", "300", "200"],
            ["200", "300", "250", "150"],
            ["240", "250", "200", "100"],
            ["280", "200", "150", "50"],
            ["320", "150", "100", "–"],
            ["360", "100", "50", "–"],
        ],
    },
    {
        number: "C4.1.IV",
        unit: "c4.1.6.1.3",
        page: 94,
        caption: "Tabella C4.1.IV – Copriferri minimi in mm",
        headers: [
            [
                cell("", { colSpan: 3 }),
                cell("barre da c.a.\nelementi a piastra", { colSpan: 2 }),
                cell("barre da c.a.\naltri elementi", { colSpan: 2 }),
                cell("cavi da c.a.p.\nelementi a piastra", { colSpan: 2 }),
                cell("cavi da c.a.p.\naltri elementi", { colSpan: 2 }),
            ],
            [
                cell("Cmin", { inline: inline("Cmin", { value: "Cmin", latex: "C_{min}" }) }),
                cell("C0", { inline: inline("C0", { value: "C0", latex: "C_0" }) }),
                cell("ambiente"),
                ...Array.from({ length: 4 }, () => [
                    cell("C≥C0", { inline: inline("C≥C0", { value: "C≥C0", latex: "C\\ge C_0" }) }),
                    cell("Cmin≤C<C0", { inline: inline("Cmin≤C<C0", { value: "Cmin≤C<C0", latex: "C_{min}\\le C<C_0" }) }),
                ]).flat(),
            ],
        ],
        rows: [
            ["C25/30", "C35/45", "ordinario", "15", "20", "20", "25", "25", "30", "30", "35"],
            ["C30/37", "C40/50", "aggressivo", "25", "30", "30", "35", "35", "40", "40", "45"],
            ["C35/45", "C45/55", "molto aggressivo", "35", "40", "40", "45", "45", "50", "50", "50"],
        ],
    },
    {
        number: "C4.1.V",
        unit: "c4.1.12",
        page: 96,
        caption: "Tabella C4.1.V – Classi di resistenza a compressione per il calcestruzzo leggero strutturale",
        headers: [[
            cell("Classe di resistenza a compressione"),
            cell("Resistenza caratteristica cilindrica minima flck [N/mm²]", {
                inline: inline("Resistenza caratteristica cilindrica minima flck [N/mm²]", { value: "flck", latex: "f_{lck}" }, { value: "N/mm²", latex: "\\mathrm{N/mm^2}" }),
            }),
            cell("Resistenza caratteristica cubica minima Rlck [N/mm²]", {
                inline: inline("Resistenza caratteristica cubica minima Rlck [N/mm²]", { value: "Rlck", latex: "R_{lck}" }, { value: "N/mm²", latex: "\\mathrm{N/mm^2}" }),
            }),
        ]],
        rows: [
            ["LC 16/18", "16", "18"],
            ["LC 20/22", "20", "22"],
            ["LC 25/28", "25", "28"],
            ["LC 30/33", "30", "33"],
            ["LC 35/38", "35", "38"],
            ["LC 40/44", "40", "44"],
            ["LC 45/50", "45", "50"],
            ["LC 50/55", "50", "55"],
            ["LC 55/60", "55", "60"],
        ],
    },
    {
        number: "C4.1.VI",
        unit: "c4.1.12",
        page: 96,
        caption: "Tabella C4.1.VI – Classi di massa per unità di volume del calcestruzzo di aggregati leggeri ammesse per l’impiego strutturale",
        headers: [[cell("Classe di massa per unità di volume"), cell("D1,5"), cell("D1,6"), cell("D1,7"), cell("D1,8"), cell("D1,9"), cell("D2,0")]],
        rows: [
            [
                cell("Intervallo di massa per unità di volume [kg/m³]", { inline: inline("Intervallo di massa per unità di volume [kg/m³]", { value: "kg/m³", latex: "\\mathrm{kg/m^3}" }) }),
                ...["1400<ρ≤1500", "1500<ρ≤1600", "1600<ρ≤1700", "1700<ρ≤1800", "1800<ρ≤1900", "1900<ρ≤2000"].map((value) => cell(value, { inline: inline(value, { value, latex: value.replace("ρ", "\\rho").replaceAll("<", "<").replace("≤", "\\le") }) })),
            ],
            ["Massa per unità di volume calcestruzzo non armato [kg/m³]", "1550", "1650", "1750", "1850", "1950", "2050"].map((value) => cell(value)),
            ["Massa per unità di volume calcestruzzo armato [kg/m³]", "1650", "1750", "1850", "1950", "2050", "2150"].map((value) => cell(value)),
        ],
    },
];

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.tables = manifest.tables.filter(
    (table: { officialNumber?: string }) => !table.officialNumber?.startsWith("C4.1."),
);
manifest.tables.splice(
    0,
    0,
    ...seeds.map((seed) => {
        const headers = materializeHeaders(seed.headers);
        return {
            id: `urn:structural-codes:it:asset:table:circ2019:${seed.number.toLowerCase()}`,
            unitId: `urn:structural-codes:it:unit:circ2019:${seed.unit}`,
            officialNumber: seed.number,
            pdfPage: seed.page,
            caption: seed.caption,
            columnCount: Math.max(...headers.map((row) => row.reduce((count, item) => count + (item.colSpan ?? 1), 0))),
            headers,
            rows: materializeRows(seed.rows),
            notes: seed.notes ?? [],
        };
    }),
);

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ41-tables: rebuilt ${seeds.length} tables`);
