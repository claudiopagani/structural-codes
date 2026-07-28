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

type Span = Pick<Cell, "colSpan" | "rowSpan">;

const text = (value: string, span: Span = {}): Cell => ({
    text: value,
    ...span,
});

const math = (value: string, latex: string, span: Span = {}): Cell => ({
    text: value,
    latex,
    ...span,
});

const value = (number: string, span: Span = {}): Cell =>
    math(number, number.replace("−", "-").replace(",", "{,}"), span);

const pressureHeaders = (
    direction: string,
    directionLatex: string,
    zones: string[],
): Cell[][] => [
    [
        math("α", "\\alpha", { rowSpan: 3 }),
        math(direction, directionLatex, { colSpan: zones.length * 2 }),
    ],
    zones.map((zone) => text(zone, { colSpan: 2 })),
    zones.flatMap(() => [
        math("cpe,10", "c_{pe,10}"),
        math("cpe,1", "c_{pe,1}"),
    ]),
];

const tables = [
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.iii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.2",
        officialNumber: "C3.3.III",
        pdfPage: 58,
        caption: "Tabella C3.3.III – Edifici rettangolari: cpe per coperture piane",
        columnCount: 2,
        headers: [],
        rows: [
            [
                math(
                    "Fascia sopravento di profondità pari al minimo tra b/2 e h",
                    "\\text{Fascia sopravento di profondità pari al minimo tra }b/2\\text{ e }h",
                ),
                math("cpe,A = −0,80", "c_{pe,A}=-0{,}80"),
            ],
            [text("Restanti zone"), math("cpe,B = ±0,20", "c_{pe,B}=\\pm0{,}20")],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.iv",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.2",
        officialNumber: "C3.3.IV",
        pdfPage: 59,
        caption: "Tabella C3.3.IV – Coefficienti di pressione per coperture piane",
        columnCount: 10,
        headers: [
            [
                text("Configurazione", { colSpan: 2, rowSpan: 3 }),
                text("Zona", { colSpan: 8 }),
            ],
            ["F", "G", "H", "I"].map((zone) => text(zone, { colSpan: 2 })),
            ["F", "G", "H", "I"].flatMap(() => [
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
            ]),
        ],
        rows: [
            [
                text("Spigoli vivi", { colSpan: 2 }),
                value("−1,8"),
                value("−2,5"),
                value("−1,2"),
                value("−2,0"),
                value("−0,7"),
                value("−1,2"),
                value("±0,2", { colSpan: 2 }),
            ],
            [
                text("Con parapetti", { rowSpan: 3 }),
                math("hp/h = 0,025", "h_p/h=0{,}025"),
                value("−1,6"),
                value("−2,2"),
                value("−1,1"),
                value("−1,8"),
                value("−0,7"),
                value("−1,2"),
                value("±0,2", { colSpan: 2, rowSpan: 3 }),
            ],
            [
                math("hp/h = 0,05", "h_p/h=0{,}05"),
                value("−1,4"),
                value("−2,0"),
                value("−0,9"),
                value("−1,6"),
                value("−0,7"),
                value("−1,2"),
            ],
            [
                math("hp/h = 0,10", "h_p/h=0{,}10"),
                value("−1,2"),
                value("−1,8"),
                value("−0,8"),
                value("−1,4"),
                value("−0,7"),
                value("−1,2"),
            ],
            [
                text("Raccordi curvi", { rowSpan: 3 }),
                math("r/h = 0,05", "r/h=0{,}05"),
                value("−1,0"),
                value("−1,5"),
                value("−1,2"),
                value("−1,8"),
                value("−0,4", { colSpan: 2 }),
                value("±0,2", { colSpan: 2, rowSpan: 3 }),
            ],
            [
                math("r/h = 0,10", "r/h=0{,}10"),
                value("−0,7"),
                value("−1,2"),
                value("−0,8"),
                value("−1,4"),
                value("−0,3", { colSpan: 2 }),
            ],
            [
                math("r/h = 0,20", "r/h=0{,}20"),
                value("−0,5"),
                value("−0,8"),
                value("−0,5"),
                value("−0,8"),
                value("−0,3", { colSpan: 2 }),
            ],
            [
                text("Raccordi piani", { rowSpan: 3 }),
                math("α = 30°", "\\alpha=30^\\circ"),
                value("−1,0"),
                value("−1,5"),
                value("−1,0"),
                value("−1,5"),
                value("−0,3", { colSpan: 2 }),
                value("±0,2", { colSpan: 2, rowSpan: 3 }),
            ],
            [
                math("α = 45°", "\\alpha=45^\\circ"),
                value("−1,2"),
                value("−1,8"),
                value("−1,3"),
                value("−1,9"),
                value("−0,4", { colSpan: 2 }),
            ],
            [
                math("α = 60°", "\\alpha=60^\\circ"),
                value("−1,3"),
                value("−1,9"),
                value("−1,3"),
                value("−1,9"),
                value("−0,5", { colSpan: 2 }),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.v",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.3",
        officialNumber: "C3.3.V",
        pdfPage: 59,
        caption: (
            "Tabella C3.3.V – Coefficienti di pressione per coperture a " +
            "semplice falda (α in °): vento perpendicolare alla direzione del colmo"
        ),
        columnCount: 4,
        headers: [
            [
                text("Valori negativi", { colSpan: 2 }),
                text("Valori positivi", { colSpan: 2 }),
            ],
        ],
        rows: [
            [
                math("α ≤ −60°", "\\alpha\\le-60^\\circ"),
                math("cpe = −0,5", "c_{pe}=-0{,}5"),
                math("0° ≤ α ≤ 45°", "0^\\circ\\le\\alpha\\le45^\\circ"),
                math("cpe = +α/75", "c_{pe}=+\\alpha/75"),
            ],
            [
                math("−60° ≤ α ≤ −15°", "-60^\\circ\\le\\alpha\\le-15^\\circ"),
                math(
                    "cpe = −0,5 − (α+60)/90",
                    "c_{pe}=-0{,}5-\\frac{\\alpha+60}{90}",
                ),
                math("45° ≤ α ≤ 75°", "45^\\circ\\le\\alpha\\le75^\\circ"),
                math(
                    "cpe = +0,6 + (α−45)/150",
                    "c_{pe}=+0{,}6+\\frac{\\alpha-45}{150}",
                ),
            ],
            [
                math("−15° ≤ α ≤ 30°", "-15^\\circ\\le\\alpha\\le30^\\circ"),
                math(
                    "cpe = −1,0 + (α+15)/75",
                    "c_{pe}=-1{,}0+\\frac{\\alpha+15}{75}",
                ),
                text("", { colSpan: 2 }),
            ],
            [
                math("30° ≤ α ≤ 45°", "30^\\circ\\le\\alpha\\le45^\\circ"),
                math(
                    "cpe = −0,4 + (α−30)/37,5",
                    "c_{pe}=-0{,}4+\\frac{\\alpha-30}{37{,}5}",
                ),
                text("", { colSpan: 2 }),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.vi",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.3",
        officialNumber: "C3.3.VI",
        pdfPage: 60,
        caption: (
            "Tabella C3.3.VI – Coefficienti di pressione per coperture a " +
            "semplice falda (α in °): vento parallelo alla direzione del colmo"
        ),
        columnCount: 3,
        headers: [],
        rows: [
            [
                text(
                    "Fascia sopravento di profondità pari al minimo tra b/2 ed h",
                    { rowSpan: 2 },
                ),
                math("0° ≤ α ≤ 15°", "0^\\circ\\le\\alpha\\le15^\\circ"),
                math("cpe,A = −0,8 − α/50", "c_{pe,A}=-0{,}8-\\alpha/50"),
            ],
            [
                math("15° < α", "15^\\circ<\\alpha"),
                math("cpe,A = −1,10", "c_{pe,A}=-1{,}10"),
            ],
            [
                text("Restanti zone", { rowSpan: 3 }),
                math("0° ≤ α ≤ 15°", "0^\\circ\\le\\alpha\\le15^\\circ"),
                math("cpe,B = −0,2 − α/30", "c_{pe,B}=-0{,}2-\\alpha/30"),
            ],
            [
                math("15° ≤ α ≤ 45°", "15^\\circ\\le\\alpha\\le45^\\circ"),
                math(
                    "cpe,B = −0,7 − (α−15)/150",
                    "c_{pe,B}=-0{,}7-\\frac{\\alpha-15}{150}",
                ),
            ],
            [
                math("45° < α", "45^\\circ<\\alpha"),
                math(
                    "cpe,B = −0,9 + (α−45)/75",
                    "c_{pe,B}=-0{,}9+\\frac{\\alpha-45}{75}",
                ),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.vii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.3",
        officialNumber: "C3.3.VII",
        pdfPage: 61,
        caption: (
            "Tabella C3.3.VII – Coefficienti di pressione per coperture a " +
            "semplice falda (α in °): vento ortogonale alla direzione del colmo"
        ),
        columnCount: 13,
        headers: [
            [
                math("α", "\\alpha", { rowSpan: 3 }),
                math("Direzione del vento Θ = 0°", "\\Theta=0^\\circ", {
                    colSpan: 6,
                }),
                math("Direzione del vento Θ = 180°", "\\Theta=180^\\circ", {
                    colSpan: 6,
                }),
            ],
            ...[
                ["F", "G", "H", "F", "G", "H"].map((zone) =>
                    text(zone, { colSpan: 2 }),
                ),
                Array.from({ length: 6 }, () => [
                    math("cpe,10", "c_{pe,10}"),
                    math("cpe,1", "c_{pe,1}"),
                ]).flat(),
            ],
        ],
        rows: [
            [
                text("5°", { rowSpan: 2 }),
                ...["−1,7", "−2,5", "−1,2", "−2,0", "−0,6", "−1,2", "−2,3", "−2,5", "−1,3", "−2,0", "−0,8", "−1,2"].map((v) => value(v)),
            ],
            [value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), text("", { colSpan: 6 })],
            [
                text("15°", { rowSpan: 2 }),
                value("−0,9"),
                value("−2,0"),
                value("−0,8"),
                value("−1,5"),
                value("−0,3", { colSpan: 2 }),
                value("−2,5"),
                value("−2,8"),
                value("−1,3"),
                value("−2,0"),
                value("−0,9"),
                value("−1,2"),
            ],
            [value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 }), text("", { colSpan: 6 })],
            [
                text("30°", { rowSpan: 2 }),
                value("−0,5"),
                value("−1,5"),
                value("−0,5"),
                value("−1,5"),
                value("−0,2", { colSpan: 2 }),
                value("−1,1"),
                value("−2,3"),
                value("−0,8"),
                value("−1,5"),
                value("−0,8", { colSpan: 2 }),
            ],
            [value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,4", { colSpan: 2 }), text("", { colSpan: 6 })],
            [
                text("45°", { rowSpan: 2 }),
                value("0", { colSpan: 2 }),
                value("0", { colSpan: 2 }),
                value("0", { colSpan: 2 }),
                value("−0,6"),
                value("−1,3"),
                value("−0,5", { colSpan: 2 }),
                value("−0,7", { colSpan: 2 }),
            ],
            [value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,6", { colSpan: 2 }), text("", { colSpan: 6 })],
            [
                text("60°"),
                value("+0,7", { colSpan: 2 }),
                value("+0,7", { colSpan: 2 }),
                value("+0,7", { colSpan: 2 }),
                value("−0,5"),
                value("−1,0"),
                value("−0,5", { colSpan: 2 }),
                value("−0,5", { colSpan: 2 }),
            ],
            [
                text("75°"),
                value("+0,8", { colSpan: 2 }),
                value("+0,8", { colSpan: 2 }),
                value("+0,8", { colSpan: 2 }),
                value("−0,5"),
                value("−1,0"),
                value("−0,5", { colSpan: 2 }),
                value("−0,5", { colSpan: 2 }),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.viii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.3",
        officialNumber: "C3.3.VIII",
        pdfPage: 61,
        caption: (
            "Tabella C3.3.VIII – Coefficienti di pressione per coperture a " +
            "semplice falda (α in °): vento parallelo alla direzione del colmo"
        ),
        columnCount: 11,
        headers: pressureHeaders(
            "Direzione del vento Θ = 90°",
            "\\Theta=90^\\circ",
            ["Fa", "Fb", "G", "H", "I"],
        ),
        rows: [
            ["5°", "−2,1", "−2,6", "−2,1", "−2,4", "−1,8", "−2,0", "−0,6", "−1,2"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
            ["15°", "−2,4", "−2,9", "−1,6", "−2,4", "−1,9", "−2,5", "−0,8", "−1,2", "−0,7", "−1,2"].map((v) => text(v)),
            ["30°", "−2,1", "−2,9", "−1,3", "−2,0", "−1,5", "−2,0", "−1,0", "−1,3", "−0,8", "−1,2"].map((v) => text(v)),
            ["45°", "−1,5", "−2,4", "−1,3", "−2,0", "−1,4", "−2,0", "−1,0", "−1,3", "−0,9", "−1,2"].map((v) => text(v)),
            ["60°", "−1,2", "−2,0", "−1,2", "−2,0", "−1,2", "−2,0", "−1,0", "−1,3", "−0,7", "−1,2"].map((v) => text(v)),
            ["75°", "−1,2", "−2,0", "−1,2", "−2,0", "−1,2", "−2,0", "−1,0", "−1,3"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.ix",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.4",
        officialNumber: "C3.3.IX",
        pdfPage: 62,
        caption: (
            "Tabella C3.3.IX – Coefficienti di pressione per coperture a " +
            "doppia falda (α in °): vento in direzione parallela al colmo"
        ),
        columnCount: 2,
        headers: [],
        rows: [
            [
                math("−75° ≤ α ≤ −15°", "-75^\\circ\\le\\alpha\\le-15^\\circ"),
                math(
                    "cpe = −0,85 + (α+60)/180",
                    "c_{pe}=-0{,}85+\\frac{\\alpha+60}{180}",
                ),
            ],
            [
                math("−15° ≤ α ≤ 15°", "-15^\\circ\\le\\alpha\\le15^\\circ"),
                math("cpe = −0,6", "c_{pe}=-0{,}6"),
            ],
            [
                math("15° ≤ α ≤ 45°", "15^\\circ\\le\\alpha\\le45^\\circ"),
                math(
                    "cpe = −0,6 + (α−15)/100",
                    "c_{pe}=-0{,}6+\\frac{\\alpha-15}{100}",
                ),
            ],
            [
                math("45° ≤ α", "45^\\circ\\le\\alpha"),
                math("cpe = −0,3", "c_{pe}=-0{,}3"),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.x",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.4",
        officialNumber: "C3.3.X",
        pdfPage: 62,
        caption: (
            "Tabella C3.3.X – Coefficienti di pressione per coperture a " +
            "doppia falda (α in °): vento in direzione parallela al colmo"
        ),
        columnCount: 3,
        headers: [],
        rows: [
            [
                text(
                    "Fascia sopravento di profondità pari al minimo tra b/2 ed h",
                    { rowSpan: 4 },
                ),
                math("α ≤ −30°", "\\alpha\\le-30^\\circ"),
                math("cpe,A = −1,0", "c_{pe,A}=-1{,}0"),
            ],
            [
                math("−30° ≤ α ≤ 0°", "-30^\\circ\\le\\alpha\\le0^\\circ"),
                math(
                    "cpe,A = −0,8 + α/150",
                    "c_{pe,A}=-0{,}8+\\alpha/150",
                ),
            ],
            [
                math("0° ≤ α ≤ 30°", "0^\\circ\\le\\alpha\\le30^\\circ"),
                math(
                    "cpe,A = −0,8 − α/150",
                    "c_{pe,A}=-0{,}8-\\alpha/150",
                ),
            ],
            [
                math("30° ≤ α", "30^\\circ\\le\\alpha"),
                math("cpe,A = −1,0", "c_{pe,A}=-1{,}0"),
            ],
            [
                text("Restanti zone", { rowSpan: 3 }),
                math("−45° ≤ α ≤ −30°", "-45^\\circ\\le\\alpha\\le-30^\\circ"),
                math("cpe,B = −0,9", "c_{pe,B}=-0{,}9"),
            ],
            [
                math("−30° ≤ α ≤ 10°", "-30^\\circ\\le\\alpha\\le10^\\circ"),
                math(
                    "cpe,B = −0,9 + (α+30)/100",
                    "c_{pe,B}=-0{,}9+\\frac{\\alpha+30}{100}",
                ),
            ],
            [
                math("10° ≤ α", "10^\\circ\\le\\alpha"),
                math("cpe,B = −0,5", "c_{pe,B}=-0{,}5"),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xi",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.4",
        officialNumber: "C3.3.XI",
        pdfPage: 63,
        caption: (
            "Tabella C3.3.XI – Coefficienti di pressione per coperture a " +
            "doppia falda: vento in direzione ortogonale al colmo"
        ),
        columnCount: 11,
        headers: pressureHeaders(
            "Direzione del vento Θ = 0°",
            "\\Theta=0^\\circ",
            ["F", "G", "H", "I", "J"],
        ),
        rows: [
            [text("−45°"), value("−0,6", { colSpan: 2 }), value("−0,6", { colSpan: 2 }), value("−0,8", { colSpan: 2 }), value("−0,7", { colSpan: 2 }), value("−1,0"), value("−1,5")],
            ["−30°", "−1,1", "−2,0", "−0,8", "−1,5"].map((v) => text(v)).concat([value("−0,8", { colSpan: 2 }), value("−0,6", { colSpan: 2 }), value("−0,8"), value("−1,4")]),
            ["−15°", "−2,5", "−2,8", "−1,3", "−2,0", "−0,9", "−1,2"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 }), value("−0,7"), value("−1,2")]),
            [text("−5°", { rowSpan: 2 }), ...["−2,3", "−2,5", "−1,2", "−2,0", "−0,8", "−1,2"].map((v) => value(v, { rowSpan: 2 })), value("−0,6", { colSpan: 2 }), value("−0,6", { colSpan: 2 })],
            [value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 })],
            [text("5°", { rowSpan: 2 }), ...["−1,7", "−2,5", "−1,2", "−2,0", "−0,6", "−1,2"].map((v) => text(v)), value("−0,6", { colSpan: 2, rowSpan: 2 }), value("−0,6", { colSpan: 2 })],
            [value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("+0,2", { colSpan: 2 })],
            [text("15°", { rowSpan: 2 }), value("−0,9"), value("−2,0"), value("−0,8"), value("−1,5"), value("−0,3", { colSpan: 2 }), value("−0,4", { colSpan: 2 }), value("−1,0"), value("−1,5")],
            [value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 })],
            [text("30°", { rowSpan: 2 }), value("−0,5"), value("−1,5"), value("−0,5"), value("−1,5"), value("−0,2", { colSpan: 2 }), value("−0,4", { colSpan: 2 }), value("−0,5", { colSpan: 2 })],
            [value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,4", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 })],
            [text("45°", { rowSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("−0,2", { colSpan: 2 }), value("−0,3", { colSpan: 2 })],
            [value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,6", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 })],
            [text("60°"), value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("−0,2", { colSpan: 2 }), value("−0,3", { colSpan: 2 })],
            [text("75°"), value("+0,8", { colSpan: 2 }), value("+0,8", { colSpan: 2 }), value("+0,8", { colSpan: 2 }), value("−0,2", { colSpan: 2 }), value("−0,3", { colSpan: 2 })],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.4",
        officialNumber: "C3.3.XII",
        pdfPage: 64,
        caption: (
            "Tabella C3.3.XII – Suddivisione delle coperture a doppia falda " +
            "in zone di uguale pressione: vento in direzione parallela al colmo"
        ),
        columnCount: 9,
        headers: pressureHeaders(
            "Direzione del vento Θ = 90°",
            "\\Theta=90^\\circ",
            ["F", "G", "H", "I"],
        ),
        rows: [
            ["−45°", "−1,4", "−2,0", "−1,2", "−2,0", "−1,0", "−1,3", "−0,9", "−1,2"],
            ["−30°", "−1,5", "−2,1", "−1,2", "−2,0", "−1,0", "−1,3", "−0,9", "−1,2"],
            ["−15°", "−1,9", "−2,5", "−1,2", "−2,0", "−0,8", "−1,2", "−0,8", "−1,2"],
            ["−5°", "−1,8", "−2,5", "−1,2", "−2,0", "−0,7", "−1,2", "−0,6", "−1,2"],
        ].map((row) => row.map((v) => text(v))).concat([
            ["5°", "−1,6", "−2,2", "−1,3", "−2,0", "−0,7", "−1,2"].map((v) => text(v)).concat([value("−0,6", { colSpan: 2 })]),
            ["15°", "−1,3", "−2,0", "−1,3", "−2,0", "−0,6", "−1,2"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
            ["30°", "−1,1", "−1,5", "−1,4", "−2,0", "−0,8", "−1,2"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
            ["45°", "−1,1", "−1,5", "−1,4", "−2,0", "−0,9", "−1,2"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
            ["60°", "−1,1", "−1,5", "−1,2", "−2,0", "−0,8", "−1,0"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
            ["75°", "−1,1", "−1,5", "−1,2", "−2,0", "−0,8", "−1,0"].map((v) => text(v)).concat([value("−0,5", { colSpan: 2 })]),
        ]),
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xiii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.5",
        officialNumber: "C3.3.XIII",
        pdfPage: 64,
        caption: (
            "Tabella C3.3.XIII – Suddivisione delle coperture a doppia falda " +
            "in zone di uguale pressione: vento in direzione parallela al colmo"
        ),
        columnCount: 2,
        headers: [],
        rows: [
            [
                math("0° ≤ α ≤ 30°", "0^\\circ\\le\\alpha\\le30^\\circ"),
                math("cpe = −0,6 − α/75", "c_{pe}=-0{,}6-\\alpha/75"),
            ],
            [
                math("30° ≤ α ≤ 45°", "30^\\circ\\le\\alpha\\le45^\\circ"),
                math("cpe = −1,0", "c_{pe}=-1{,}0"),
            ],
            [
                math("45° ≤ α ≤ 60°", "45^\\circ\\le\\alpha\\le60^\\circ"),
                math(
                    "cpe = −1,0 + (α−45)/37,5",
                    "c_{pe}=-1{,}0+\\frac{\\alpha-45}{37{,}5}",
                ),
            ],
            [
                math("60° ≤ α", "60^\\circ\\le\\alpha"),
                math("cpe = −0,6", "c_{pe}=-0{,}6"),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xiv",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.1.5",
        officialNumber: "C3.3.XIV",
        pdfPage: 65,
        caption: (
            "Tabella C3.3.XIV – Suddivisione delle coperture a padiglione " +
            "in zone di uguale pressione: vento in direzione parallela al colmo"
        ),
        columnCount: 19,
        headers: [
            [
                math(
                    "α0 per Θ=0°; α90 per Θ=90°",
                    "\\alpha_0\\text{ per }\\Theta=0^\\circ;\\ \\alpha_{90}\\text{ per }\\Theta=90^\\circ",
                    { rowSpan: 3 },
                ),
                math(
                    "Direzione del vento Θ = 0° e Θ = 90°",
                    "\\Theta=0^\\circ\\ \\text{e}\\ \\Theta=90^\\circ",
                    { colSpan: 18 },
                ),
            ],
            ["F", "G", "H", "I", "J", "K", "L", "M", "N"].map((zone) =>
                text(zone, { colSpan: 2 }),
            ),
            Array.from({ length: 9 }, () => [
                math("cpe,10", "c_{pe,10}"),
                math("cpe,1", "c_{pe,1}"),
            ]).flat(),
        ],
        rows: [
            [text("+5°", { rowSpan: 2 }), ...["−1,7", "−2,5", "−1,2", "−2,0", "−0,6", "−1,2"].map((v) => text(v)), value("−0,3", { colSpan: 2, rowSpan: 2 }), value("−0,6", { colSpan: 2, rowSpan: 2 }), value("−0,6", { colSpan: 2, rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−2,0", { rowSpan: 2 }), value("−0,6", { rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−0,4", { colSpan: 2, rowSpan: 2 })],
            [value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 })],
            [text("+15°", { rowSpan: 2 }), value("−0,9"), value("−2,0"), value("−0,8"), value("−1,5"), value("−0,3", { colSpan: 2 }), value("−0,5", { colSpan: 2, rowSpan: 2 }), value("−1,0", { rowSpan: 2 }), value("−1,5", { rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−2,0", { rowSpan: 2 }), value("−1,4", { rowSpan: 2 }), value("−2,0", { rowSpan: 2 }), value("−0,6", { rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−0,3", { colSpan: 2, rowSpan: 2 })],
            [value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 }), value("+0,2", { colSpan: 2 })],
            [text("+30°", { rowSpan: 2 }), value("−0,5"), value("−1,5"), value("−0,5"), value("−1,5"), value("−0,2", { colSpan: 2 }), value("−0,4", { colSpan: 2, rowSpan: 2 }), value("−0,7", { rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−0,5", { colSpan: 2, rowSpan: 2 }), value("−1,4", { rowSpan: 2 }), value("−2,0", { rowSpan: 2 }), value("−0,8", { rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−0,2", { colSpan: 2, rowSpan: 2 })],
            [value("+0,5", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,4", { colSpan: 2 })],
            [text("+45°", { rowSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("0", { colSpan: 2 }), value("−0,3", { colSpan: 2, rowSpan: 2 }), value("−0,6", { colSpan: 2, rowSpan: 2 }), value("−0,3", { colSpan: 2, rowSpan: 2 }), value("−1,3", { rowSpan: 2 }), value("−2,0", { rowSpan: 2 }), value("−0,8", { rowSpan: 2 }), value("−1,2", { rowSpan: 2 }), value("−0,2", { colSpan: 2, rowSpan: 2 })],
            [value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,6", { colSpan: 2 })],
            [text("+60°"), value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("+0,7", { colSpan: 2 }), value("−0,3", { colSpan: 2 }), value("−0,6", { colSpan: 2 }), value("−0,3", { colSpan: 2 }), value("−1,2"), value("−2,0"), value("−0,4", { colSpan: 2 }), value("−0,2", { colSpan: 2 })],
            [text("+75°"), value("+0,8", { colSpan: 2 }), value("+0,8", { colSpan: 2 }), value("+0,8", { colSpan: 2 }), value("−0,3", { colSpan: 2 }), value("−0,6", { colSpan: 2 }), value("−0,3", { colSpan: 2 }), value("−1,2"), value("−2,0"), value("−0,4", { colSpan: 2 }), value("−0,2", { colSpan: 2 })],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xv",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.2.1",
        officialNumber: "C3.3.XV",
        pdfPage: 68,
        caption: "Tabella C3.3.XV – Coefficienti di forza per tettoie a semplice falda (α in °)",
        columnCount: 3,
        headers: [],
        rows: [
            [
                text("Valori positivi"),
                math("Tutti i valori di φ", "\\text{Tutti i valori di }\\phi"),
                math("cF = +0,2 + α/30", "c_F=+0{,}2+\\alpha/30"),
            ],
            [
                text("Valori negativi", { rowSpan: 2 }),
                math("φ = 0", "\\phi=0"),
                math("cF = −0,5 − 1,3·α/30", "c_F=-0{,}5-1{,}3\\alpha/30"),
            ],
            [
                math("φ = 1", "\\phi=1"),
                math("cF = −1,4", "c_F=-1{,}4"),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xvi",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.2.2",
        officialNumber: "C3.3.XVI",
        pdfPage: 69,
        caption: "Tabella C3.3.XVI – Coefficienti di forza per tettoie a doppia falda (α in °)",
        columnCount: 4,
        headers: [],
        rows: [
            [
                text("Valori positivi"),
                math("Tutti i valori di φ", "\\text{Tutti i valori di }\\phi", {
                    colSpan: 2,
                }),
                math(
                    "cF = +0,2 + 0,7·|α|/30",
                    "c_F=+0{,}2+0{,}7\\frac{|\\alpha|}{30}",
                ),
            ],
            [
                text("Valori negativi", { rowSpan: 3 }),
                math("φ = 0", "\\phi=0", { rowSpan: 2 }),
                math("α ≤ 0°", "\\alpha\\le0^\\circ"),
                math(
                    "cF = −0,5 + 0,1·α/10",
                    "c_F=-0{,}5+0{,}1\\alpha/10",
                ),
            ],
            [
                math("α ≥ 0°", "\\alpha\\ge0^\\circ"),
                math(
                    "cF = −0,5 − 0,2·α/10",
                    "c_F=-0{,}5-0{,}2\\alpha/10",
                ),
            ],
            [
                math("φ = 1", "\\phi=1"),
                math("Tutti i valori di α", "\\text{Tutti i valori di }\\alpha"),
                math("cF = −1,4", "c_F=-1{,}4"),
            ],
        ],
        notes: [],
    },
    {
        id: "urn:structural-codes:it:asset:table:circ2019:c3.3.xvii",
        unitId: "urn:structural-codes:it:unit:circ2019:c3.3.8.2.3",
        officialNumber: "C3.3.XVII",
        pdfPage: 70,
        caption: "Tabella C3.3.XVII – Coefficienti di forza per tettoie a semplice falda (α in °)",
        columnCount: 4,
        headers: [
            [
                text("Elemento n.", { rowSpan: 2 }),
                text("Posizione", { rowSpan: 2 }),
                math(
                    "Fattori riduttivi per tutti i valori di φ",
                    "\\text{Fattori riduttivi per tutti i valori di }\\phi",
                    { colSpan: 2 },
                ),
            ],
            [
                math("per cF > 0", "\\text{per }c_F>0"),
                math("per cF < 0", "\\text{per }c_F<0"),
            ],
        ],
        rows: [
            [text("1"), text("Primo campo"), text("1,0"), text("0,8")],
            [text("2"), text("Secondo campo"), text("0,9"), text("0,7")],
            [text("3"), text("Altri campi"), text("0,7"), text("0,7")],
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
console.log(`circ3-step2-tables: rebuilt ${tables.length} tables`);
