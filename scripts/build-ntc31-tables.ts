import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${repoRoot}/corpus/assets/ntc2018/core-tables.json`;

type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };

const text = (value: string, span: Pick<Cell, "colSpan" | "rowSpan"> = {}): Cell => ({ text: value, ...span });
const math = (value: string, latex: string, span: Pick<Cell, "colSpan" | "rowSpan"> = {}): Cell => ({ text: value, latex, ...span });
const value = (display: string, latex = display): Cell => math(display, latex);

const table = {
    id: "urn:structural-codes:it:asset:table:ntc2018:3.1.ii",
    unitId: "urn:structural-codes:it:unit:ntc2018:3.1.4",
    officialNumber: "3.1.II",
    pdfPage: 47,
    caption: "Tabella 3.1.II - Valori dei sovraccarichi per le diverse categorie d’uso delle costruzioni",
    columnCount: 5,
    headers: [
        [text("Cat."), text("Ambienti"), math("qk", "q_k"), math("Qk", "Q_k"), math("Hk", "H_k")],
        [text(""), text(""), math("[kN/m²]", "[\\mathrm{kN}/\\mathrm{m}^2]"), math("[kN]", "[\\mathrm{kN}]"), math("[kN/m]", "[\\mathrm{kN}/\\mathrm{m}]")],
    ],
    rows: [
        [text("A", { rowSpan: 3 }), text("Ambienti ad uso residenziale", { colSpan: 4 })],
        [text("Aree per attività domestiche e residenziali; sono compresi in questa categoria i locali di abitazione e relativi servizi, gli alberghi (ad esclusione delle aree soggette ad affollamento), camere di degenza di ospedali"), value("2,00"), value("2,00"), value("1,00")],
        [text("Scale comuni, balconi, ballatoi"), value("4,00"), value("4,00"), value("2,00")],

        [text("B", { rowSpan: 4 }), text("Uffici", { colSpan: 4 })],
        [text("Cat. B1 Uffici non aperti al pubblico"), value("2,00"), value("2,00"), value("1,00")],
        [text("Cat. B2 Uffici aperti al pubblico"), value("3,00"), value("2,00"), value("1,00")],
        [text("Scale comuni, balconi e ballatoi"), value("4,00"), value("4,00"), value("2,00")],

        [text("C", { rowSpan: 7 }), text("Ambienti suscettibili di affollamento", { colSpan: 4 })],
        [text("Cat. C1 Aree con tavoli, quali scuole, caffè, ristoranti, sale per banchetti, lettura e ricevimento"), value("3,00"), value("3,00"), value("1,00")],
        [text("Cat. C2 Aree con posti a sedere fissi, quali chiese, teatri, cinema, sale per conferenze e attesa, aule universitarie e aule magne"), value("4,00"), value("4,00"), value("2,00")],
        [text("Cat. C3 Ambienti privi di ostacoli al movimento delle persone, quali musei, sale per esposizioni, aree d’accesso a uffici, ad alberghi e ospedali, ad atri di stazioni ferroviarie"), value("5,00"), value("5,00"), value("3,00")],
        [text("Cat. C4. Aree con possibile svolgimento di attività fisiche, quali sale da ballo, palestre, palcoscenici."), value("5,00"), value("5,00"), value("3,00")],
        [text("Cat. C5. Aree suscettibili di grandi affollamenti, quali edifici per eventi pubblici, sale da concerto, palazzetti per lo sport e relative tribune, gradinate e piattaforme ferroviarie."), value("5,00"), value("5,00"), value("3,00")],
        [text("Scale comuni, balconi e ballatoi"), value("≥ 4,00", "\\ge4{,}00"), value("≥ 4,00", "\\ge4{,}00"), value("≥ 2,00", "\\ge2{,}00")],

        [text("D", { rowSpan: 4 }), text("Ambienti ad uso commerciale", { colSpan: 4 })],
        [text("Cat. D1 Negozi"), value("4,00"), value("4,00"), value("2,00")],
        [text("Cat. D2 Centri commerciali, mercati, grandi magazzini"), value("5,00"), value("5,00"), value("2,00")],
        [text("Scale comuni, balconi e ballatoi"), text("Secondo categoria d’uso servita", { colSpan: 3 })],

        [text("E", { rowSpan: 3 }), text("Aree per immagazzinamento e uso commerciale ed uso industriale", { colSpan: 4 })],
        [text("Cat. E1 Aree per accumulo di merci e relative aree d’accesso, quali biblioteche, archivi, magazzini, depositi, laboratori manifatturieri"), value("≥ 6,00", "\\ge6{,}00"), value("7,00"), value("1,00*")],
        [text("Cat. E2 Ambienti ad uso industriale"), text("da valutarsi caso per caso", { colSpan: 3 })],

        [text("F-G", { rowSpan: 3 }), text("Rimesse e aree per traffico di veicoli (esclusi i ponti)", { colSpan: 4 })],
        [text("Cat. F Rimesse, aree per traffico, parcheggio e sosta di veicoli leggeri (peso a pieno carico fino a 30 kN)"), value("2,50"), value("2 x 10,00", "2\\times10{,}00"), value("1,00**")],
        [text("Cat. G Aree per traffico e parcheggio di veicoli medi (peso a pieno carico compreso fra 30 kN e 160 kN), quali rampe d’accesso, zone di carico e scarico merci."), value("da valutarsi caso per caso e comunque non minori di 5,00"), value("2 x 50,00", "2\\times50{,}00"), value("1,00**")],

        [text("H-I-K", { rowSpan: 4 }), text("Coperture", { colSpan: 4 })],
        [text("Cat. H Coperture accessibili per sola manutenzione e riparazione"), value("0,50"), value("1,20"), value("1,00")],
        [text("Cat. I Coperture praticabili di ambienti di categoria d’uso compresa fra A e D"), text("secondo categoria d’uso di appartenenza", { colSpan: 3 })],
        [text("Cat. K Coperture per usi speciali, quali impianti, eliporti."), text("da valutarsi caso per caso", { colSpan: 3 })],
    ],
    notes: [
        "La tabella continua alla pagina PDF 48; le categorie D–K e le note sono state verificate sul render ufficiale della continuazione.",
        "* non comprende le azioni orizzontali eventualmente esercitate dai materiali immagazzinati.",
        "** per i soli parapetti o partizioni nelle zone pedonali. Le azioni sulle barriere esercitate dagli automezzi dovranno essere valutate caso per caso.",
    ],
};

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.tables = manifest.tables.filter((candidate: { id: string }) => candidate.id !== table.id);
manifest.tables.push(table);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("ntc31-tables: rebuilt Tabella 3.1.II across PDF pages 47–48");
