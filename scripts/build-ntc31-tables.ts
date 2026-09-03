import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/ntc2018/core-tables.json`;

type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number; strong?: boolean; align?: "left" | "center" | "right"; noWrap?: boolean };

type CellOptions = Pick<Cell, "colSpan" | "rowSpan" | "strong" | "align" | "noWrap">;
const text = (value: string, span: CellOptions = {}): Cell => ({ text: value, ...span });
const math = (value: string, latex: string, span: CellOptions = {}): Cell => ({ text: value, latex, ...span });
const value = (display: string, latex = display, span: CellOptions = {}): Cell => math(display, latex, span);

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
        id: "urn:structural-codes:it:asset:table:ntc2018:3.1.i",
        unitId: "urn:structural-codes:it:unit:ntc2018:3.1.2",
        officialNumber: "3.1.I",
        pdfPage: 46,
        caption: "Tabella 3.1.I - Pesi dell’unità di volume dei principali materiali",
        columnCount: 2,
        headers: [
            [
                text("MATERIALI"),
                math("PESO UNITÀ DI VOLUME\n[kN/m³]", "\\text{PESO UNITÀ DI VOLUME}\\\\\\left[\\mathrm{kN}/\\mathrm{m}^3\\right]"),
            ],
        ],
        rows: [
            [text("Calcestruzzi cementizi e malte", { colSpan: 2, strong: true })],
            [text("Calcestruzzo ordinario"), text("24,0")],
            [text("Calcestruzzo armato (e/o precompresso)"), text("25,0")],
            [text("Calcestruzzi “leggeri”: da determinarsi caso per caso"), text("14,0 ÷ 20,0")],
            [text("Calcestruzzi “pesanti”: da determinarsi caso per caso"), text("28,0 ÷ 50,0")],
            [text("Malta di calce"), text("18,0")],
            [text("Malta di cemento"), text("21,0")],
            [text("Calce in polvere"), text("10,0")],
            [text("Cemento in polvere"), text("14,0")],
            [text("Sabbia"), text("17,0")],
            [text("Metalli e leghe", { colSpan: 2, strong: true })],
            [text("Acciaio"), text("78,5")],
            [text("Ghisa"), text("72,5")],
            [text("Alluminio"), text("27,0")],
            [text("Materiale lapideo", { colSpan: 2, strong: true })],
            [text("Tufo vulcanico"), text("17,0")],
            [text("Calcare compatto"), text("26,0")],
            [text("Calcare tenero"), text("22,0")],
            [text("Gesso"), text("13,0")],
            [text("Granito"), text("27,0")],
            [text("Laterizio (pieno)"), text("18,0")],
            [text("Legnami", { colSpan: 2, strong: true })],
            [text("Conifere e pioppo"), text("4,0 ÷ 6,0")],
            [text("Latifoglie (escluso pioppo)"), text("6,0 ÷ 8,0")],
            [text("Sostanze varie", { colSpan: 2, strong: true })],
            [text("Acqua dolce (chiara)"), text("9,81")],
            [text("Acqua di mare (chiara)"), text("10,1")],
            [text("Carta"), text("10,0")],
            [text("Vetro"), text("25,0")],
        ],
        notes: ["Struttura e valori verificati sul render della pagina PDF 46."],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:3.1.ii",
        unitId: "urn:structural-codes:it:unit:ntc2018:3.1.4",
        officialNumber: "3.1.II",
        pdfPage: 47,
        caption: "Tabella 3.1.II - Valori dei sovraccarichi per le diverse categorie d’uso delle costruzioni",
        columnCount: 5,
        headers: [
            [
                text("Cat."),
                text("Ambienti"),
                math("qk\n[kN/m²]", "q_k\\\\\\left[\\mathrm{kN}/\\mathrm{m}^2\\right]"),
                math("Qk\n[kN]", "Q_k\\\\\\left[\\mathrm{kN}\\right]"),
                math("Hk\n[kN/m]", "H_k\\\\\\left[\\mathrm{kN}/\\mathrm{m}\\right]"),
            ],
        ],
        rows: [
            [text("A", { rowSpan: 3 }), text("Ambienti ad uso residenziale", { colSpan: 4, strong: true })],
            [text("Aree per attività domestiche e residenziali; sono compresi in questa categoria i locali di abitazione e relativi servizi, gli alberghi (ad esclusione delle aree soggette ad affollamento), camere di degenza di ospedali"), value("2,00"), value("2,00"), value("1,00")],
            [text("Scale comuni, balconi, ballatoi"), value("4,00"), value("4,00"), value("2,00")],

            [text("B", { rowSpan: 4 }), text("Uffici", { colSpan: 4, strong: true })],
            [text("Cat. B1 Uffici non aperti al pubblico"), value("2,00"), value("2,00"), value("1,00")],
            [text("Cat. B2 Uffici aperti al pubblico"), value("3,00"), value("2,00"), value("1,00")],
            [text("Scale comuni, balconi e ballatoi"), value("4,00"), value("4,00"), value("2,00")],

            [text("C", { rowSpan: 8 }), text("Ambienti suscettibili di affollamento", { colSpan: 4, strong: true })],
            [text("Cat. C1 Aree con tavoli, quali scuole, caffè, ristoranti, sale per banchetti, lettura e ricevimento"), value("3,00"), value("3,00"), value("1,00")],
            [text("Cat. C2 Aree con posti a sedere fissi, quali chiese, teatri, cinema, sale per conferenze e attesa, aule universitarie e aule magne"), value("4,00"), value("4,00"), value("2,00")],
            [text("Cat. C3 Ambienti privi di ostacoli al movimento delle persone, quali musei, sale per esposizioni, aree d’accesso a uffici, ad alberghi e ospedali, ad atri di stazioni ferroviarie"), value("5,00"), value("5,00"), value("3,00")],
            [text("Cat. C4. Aree con possibile svolgimento di attività fisiche, quali sale da ballo, palestre, palcoscenici."), value("5,00"), value("5,00"), value("3,00")],
            [text("Cat. C5. Aree suscettibili di grandi affollamenti, quali edifici per eventi pubblici, sale da concerto, palazzetti per lo sport e relative tribune, gradinate e piattaforme ferroviarie."), value("5,00"), value("5,00"), value("3,00")],
            [text("Scale comuni, balconi e ballatoi", { rowSpan: 2 }), text("Secondo categoria d’uso servita, con le seguenti limitazioni", { colSpan: 3 })],
            [value("≥ 4,00", "\\ge4{,}00"), value("≥ 4,00", "\\ge4{,}00"), value("≥ 2,00", "\\ge2{,}00")],

            [text("D", { rowSpan: 4 }), text("Ambienti ad uso commerciale", { colSpan: 4, strong: true })],
            [text("Cat. D1 Negozi"), value("4,00"), value("4,00"), value("2,00")],
            [text("Cat. D2 Centri commerciali, mercati, grandi magazzini"), value("5,00"), value("5,00"), value("2,00")],
            [text("Scale comuni, balconi e ballatoi"), text("Secondo categoria d’uso servita", { colSpan: 3 })],

            [text("E", { rowSpan: 3 }), text("Aree per immagazzinamento e uso commerciale ed uso industriale", { colSpan: 4, strong: true })],
            [text("Cat. E1 Aree per accumulo di merci e relative aree d’accesso, quali biblioteche, archivi, magazzini, depositi, laboratori manifatturieri"), value("≥ 6,00", "\\ge6{,}00"), value("7,00"), value("1,00*", "1{,}00^{*}")],
            [text("Cat. E2 Ambienti ad uso industriale"), text("da valutarsi caso per caso", { colSpan: 3 })],

            [text("F-G", { rowSpan: 4 }), text("Rimesse e aree per traffico di veicoli (esclusi i ponti)", { colSpan: 4, strong: true })],
            [text("Cat. F Rimesse, aree per traffico, parcheggio e sosta di veicoli leggeri (peso a pieno carico fino a 30 kN)"), value("2,50"), value("2 x 10,00", "2\\times10{,}00"), value("1,00**", "1{,}00^{**}")],
            [text("Cat. G Aree per traffico e parcheggio di veicoli medi (peso a pieno carico compreso fra 30 kN e 160 kN), quali rampe d’accesso, zone di carico e scarico merci.", { rowSpan: 2 }), text("da valutarsi caso per caso e comunque non minori di", { colSpan: 3 })],
            [value("5,00"), value("2 x 50,00", "2\\times50{,}00"), value("1,00**", "1{,}00^{**}")],

            [text("H-I-K", { rowSpan: 4 }), text("Coperture", { colSpan: 4, strong: true })],
            [text("Cat. H Coperture accessibili per sola manutenzione e riparazione"), value("0,50"), value("1,20"), value("1,00")],
            [text("Cat. I Coperture praticabili di ambienti di categoria d’uso compresa fra A e D"), text("secondo categorie di appartenenza", { colSpan: 3 })],
            [text("Cat. K Coperture per usi speciali, quali impianti, eliporti."), text("da valutarsi caso per caso", { colSpan: 3 })],
        ],
        notes: [
            "La tabella inizia alla pagina PDF 47 e prosegue alla pagina PDF 48 (categorie D–K e note); struttura e valori verificati sul render ufficiale.",
            "* non comprende le azioni orizzontali eventualmente esercitate dai materiali immagazzinati.",
            "** per i soli parapetti o partizioni nelle zone pedonali. Le azioni sulle barriere esercitate dagli automezzi dovranno essere valutate caso per caso.",
        ],
    },
];

function applyPresentation(table: (typeof tables)[number]) {
    const occupied: number[] = [];
    for (const row of [...table.headers, ...table.rows]) {
        for (let column = 0; column < occupied.length; column += 1) {
            if ((occupied[column] ?? 0) > 0) occupied[column] = (occupied[column] ?? 0) - 1;
        }

        let column = 0;
        for (const cell of row) {
            while ((occupied[column] ?? 0) > 0) column += 1;
            const span = cell.colSpan ?? 1;

            if (table.officialNumber === "3.1.I" && column === 1) {
                cell.align = "center";
            }
            if (table.officialNumber === "3.1.II") {
                if (column === 0) {
                    cell.align = "center";
                    cell.noWrap = true;
                } else if (column >= 2) {
                    cell.align = "center";
                }
            }

            const rowSpan = cell.rowSpan ?? 1;
            for (let offset = 0; offset < span; offset += 1) {
                occupied[column + offset] = Math.max(occupied[column + offset] ?? 0, rowSpan);
            }
            column += span;
        }
    }
}

tables.forEach(applyPresentation);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generatedIds = new Set(tables.map((table) => table.id));
const mergedTables: typeof manifest.tables = [];
let inserted = false;
for (const candidate of manifest.tables) {
    if (generatedIds.has(candidate.id)) {
        if (!inserted) {
            mergedTables.push(...tables);
            inserted = true;
        }
        continue;
    }
    mergedTables.push(candidate);
}
if (!inserted) mergedTables.push(...tables);
manifest.tables = mergedTables;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("ntc31-tables: rebuilt Tabella 3.1.I (PDF 46) e Tabella 3.1.II (PDF 47–48)");
