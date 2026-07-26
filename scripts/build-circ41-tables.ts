import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/circ2019/core-tables.json`;

type TableSeed = {
    number: string;
    unit: string;
    page: number;
    caption: string;
    headers: string[];
    rows: string[][];
    notes?: string[];
};

const seeds: TableSeed[] = [
    {
        number: "C4.1.I",
        unit: "c4.1.2.2.2",
        page: 90,
        caption: "Tabella C4.1.I – Valori di K e snellezze l/h limite per elementi inflessi di c.a. in assenza di compressione assiale",
        headers: [
            "Sistema strutturale",
            "K",
            "Calcestruzzo molto sollecitato ρ = 1,5%",
            "Calcestruzzo poco sollecitato ρ = 0,5%",
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
            "Tensione nell’acciaio σs [MPa]",
            "Diametro massimo φ delle barre per w3 = 0,4 mm",
            "Diametro massimo φ delle barre per w2 = 0,3 mm",
            "Diametro massimo φ delle barre per w1 = 0,2 mm",
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
            "Tensione nell’acciaio σs [MPa]",
            "Spaziatura massima s delle barre per w3 = 0,4 mm",
            "Spaziatura massima s delle barre per w2 = 0,3 mm",
            "Spaziatura massima s delle barre per w1 = 0,2 mm",
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
            "Cmin",
            "C0",
            "Ambiente",
            "Barre da c.a., elementi a piastra, C ≥ C0",
            "Barre da c.a., elementi a piastra, Cmin ≤ C < C0",
            "Barre da c.a., altri elementi, C ≥ C0",
            "Barre da c.a., altri elementi, Cmin ≤ C < C0",
            "Cavi da c.a.p., elementi a piastra, C ≥ C0",
            "Cavi da c.a.p., elementi a piastra, Cmin ≤ C < C0",
            "Cavi da c.a.p., altri elementi, C ≥ C0",
            "Cavi da c.a.p., altri elementi, Cmin ≤ C < C0",
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
        headers: [
            "Classe di resistenza a compressione",
            "Resistenza caratteristica cilindrica minima flck [N/mm²]",
            "Resistenza caratteristica cubica minima Rlck [N/mm²]",
        ],
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
        headers: ["Classe di massa per unità di volume", "D1,5", "D1,6", "D1,7", "D1,8", "D1,9", "D2,0"],
        rows: [
            ["Intervallo di massa per unità di volume [kg/m³]", "1400 < ρ ≤ 1500", "1500 < ρ ≤ 1600", "1600 < ρ ≤ 1700", "1700 < ρ ≤ 1800", "1800 < ρ ≤ 1900", "1900 < ρ ≤ 2000"],
            ["Massa per unità di volume calcestruzzo non armato [kg/m³]", "1550", "1650", "1750", "1850", "1950", "2050"],
            ["Massa per unità di volume calcestruzzo armato [kg/m³]", "1650", "1750", "1850", "1950", "2050", "2150"],
        ],
    },
];

const cell = (text: string) => ({ text });

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.tables = manifest.tables.filter(
    (table: { officialNumber?: string }) => !table.officialNumber?.startsWith("C4.1."),
);
manifest.tables.push(
    ...seeds.map((seed) => ({
        id: `urn:structural-codes:it:asset:table:circ2019:${seed.number.toLowerCase()}`,
        unitId: `urn:structural-codes:it:unit:circ2019:${seed.unit}`,
        officialNumber: seed.number,
        pdfPage: seed.page,
        caption: seed.caption,
        columnCount: seed.headers.length,
        headers: [seed.headers.map(cell)],
        rows: seed.rows.map((row) => row.map(cell)),
        notes: seed.notes ?? [],
    })),
);

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ41-tables: rebuilt ${seeds.length} tables`);
