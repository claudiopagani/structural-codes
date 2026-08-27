import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/ntc2018/core-tables.json`;

type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };

const text = (value: string, span: Pick<Cell, "colSpan" | "rowSpan"> = {}): Cell => ({ text: value, ...span });
const math = (value: string, latex: string, span: Pick<Cell, "colSpan" | "rowSpan"> = {}): Cell => ({ text: value, latex, ...span });

const tables: Array<{
    id: string;
    unitId: string;
    officialNumber: string;
    pdfPage: number;
    caption: string;
    columnCount: number;
    headers: Cell[][];
    rows: Cell[][];
    notes: string[];
}> = [
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:2.4.i",
        unitId: "urn:structural-codes:it:unit:ntc2018:2.4.1",
        officialNumber: "2.4.I",
        pdfPage: 40,
        caption: "Tabella 2.4.I - Valori minimi della Vita nominale VN di progetto per i diversi tipi di costruzioni",
        columnCount: 3,
        headers: [
            [
                text("TIPI DI COSTRUZIONI", { colSpan: 2 }),
                math("Valori minimi di VN (anni)", "\\text{Valori minimi di }V_N\\text{ (anni)}"),
            ],
        ],
        rows: [
            [text("1"), text("Costruzioni temporanee e provvisorie"), text("10")],
            [text("2"), text("Costruzioni con livelli di prestazioni ordinari"), text("50")],
            [text("3"), text("Costruzioni con livelli di prestazioni elevati"), text("100")],
        ],
        notes: ["Struttura e valori verificati sul render della pagina PDF 40."],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:2.4.ii",
        unitId: "urn:structural-codes:it:unit:ntc2018:2.4.3",
        officialNumber: "2.4.II",
        pdfPage: 41,
        caption: "Tabella 2.4.II - Valori del coefficiente d’uso CU",
        columnCount: 5,
        headers: [
            [text("CLASSE D’USO"), text("I"), text("II"), text("III"), text("IV")],
        ],
        rows: [
            [
                math("COEFFICIENTE CU", "\\text{COEFFICIENTE }C_U"),
                text("0,7"),
                text("1,0"),
                text("1,5"),
                text("2,0"),
            ],
        ],
        notes: ["Struttura e valori verificati sul render della pagina PDF 41."],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:2.5.i",
        unitId: "urn:structural-codes:it:unit:ntc2018:2.5.2",
        officialNumber: "2.5.I",
        pdfPage: 42,
        caption: "Tabella 2.5.I - Valori dei coefficienti di combinazione",
        columnCount: 4,
        headers: [
            [
                text("Categoria/Azione variabile"),
                math("ψ0j", "\\psi_{0j}"),
                math("ψ1j", "\\psi_{1j}"),
                math("ψ2j", "\\psi_{2j}"),
            ],
        ],
        rows: [
            [text("Categoria A - Ambienti ad uso residenziale"), text("0,7"), text("0,5"), text("0,3")],
            [text("Categoria B - Uffici"), text("0,7"), text("0,5"), text("0,3")],
            [text("Categoria C - Ambienti suscettibili di affollamento"), text("0,7"), text("0,7"), text("0,6")],
            [text("Categoria D - Ambienti ad uso commerciale"), text("0,7"), text("0,7"), text("0,6")],
            [text("Categoria E – Aree per immagazzinamento, uso commerciale e uso industriale Biblioteche, archivi, magazzini e ambienti ad uso industriale"), text("1,0"), text("0,9"), text("0,8")],
            [text("Categoria F - Rimesse, parcheggi ed aree per il traffico di veicoli (per autoveicoli di peso ≤ 30 kN)"), text("0,7"), text("0,7"), text("0,6")],
            [text("Categoria G – Rimesse, parcheggi ed aree per il traffico di veicoli (per autoveicoli di peso > 30 kN)"), text("0,7"), text("0,5"), text("0,3")],
            [text("Categoria H - Coperture accessibili per sola manutenzione"), text("0,0"), text("0,0"), text("0,0")],
            [text("Categoria I – Coperture praticabili"), text("da valutarsi caso per caso", { colSpan: 3, rowSpan: 2 })],
            [text("Categoria K – Coperture per usi speciali (impianti, eliporti, ...)")],
            [text("Vento"), text("0,6"), text("0,2"), text("0,0")],
            [text("Neve (a quota ≤ 1000 m s.l.m.)"), text("0,5"), text("0,2"), text("0,0")],
            [text("Neve (a quota > 1000 m s.l.m.)"), text("0,7"), text("0,5"), text("0,2")],
            [text("Variazioni termiche"), text("0,6"), text("0,5"), text("0,0")],
        ],
        notes: [
            "La tabella inizia alla pagina PDF 42 e prosegue alla pagina PDF 43 (categorie G–K, Vento, Neve e Variazioni termiche); struttura e valori verificati sul render ufficiale.",
        ],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:2.6.i",
        unitId: "urn:structural-codes:it:unit:ntc2018:2.6.1",
        officialNumber: "2.6.I",
        pdfPage: 44,
        caption: "Tabella 2.6.I - Coefficienti parziali per le azioni o per l’effetto delle azioni nelle verifiche SLU",
        columnCount: 6,
        headers: [
            [
                text(""),
                text(""),
                math("Coefficiente γF", "\\text{Coefficiente }\\gamma_F"),
                text("EQU"),
                text("A1"),
                text("A2"),
            ],
        ],
        rows: [
            [math("Carichi permanenti G1", "\\text{Carichi permanenti }G_1", { rowSpan: 2 }), text("Favorevoli"), math("γG1", "\\gamma_{G1}", { rowSpan: 2 }), text("0,9"), text("1,0"), text("1,0")],
            [text("Sfavorevoli"), text("1,1"), text("1,3"), text("1,0")],
            [math("Carichi permanenti non strutturali G2(1)", "\\text{Carichi permanenti non strutturali }G_2(1)", { rowSpan: 2 }), text("Favorevoli"), math("γG2", "\\gamma_{G2}", { rowSpan: 2 }), text("0,8"), text("0,8"), text("0,8")],
            [text("Sfavorevoli"), text("1,5"), text("1,5"), text("1,3")],
            [math("Azioni variabili Q", "\\text{Azioni variabili }Q", { rowSpan: 2 }), text("Favorevoli"), math("γQi", "\\gamma_{Qi}", { rowSpan: 2 }), text("0,0"), text("0,0"), text("0,0")],
            [text("Sfavorevoli"), text("1,5"), text("1,5"), text("1,3")],
        ],
        notes: [
            "(1) Nel caso in cui l’intensità dei carichi permanenti non strutturali o di una parte di essi (ad es. carichi permanenti portati) sia ben definita in fase di progetto, per detti carichi o per la parte di essi nota si potranno adottare gli stessi coefficienti parziali validi per le azioni permanenti.",
        ],
    },
];

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const table of tables) {
    manifest.tables = manifest.tables.filter((candidate: { id: string }) => candidate.id !== table.id);
    manifest.tables.push(table);
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("ntc2-tables: rebuilt 2.4.I (PDF 40), 2.4.II (PDF 41), 2.5.I (PDF 42–43) e 2.6.I (PDF 44)");
