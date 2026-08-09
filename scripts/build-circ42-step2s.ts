import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type BlockKind = "heading" | "paragraph" | "list-item" | "formula-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };

const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso o voce di elenco; la formula resta un blocco distinto." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(unitNumber: string, suffix: string, kind: BlockKind, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(unitNumber: string, suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }

const formula101: FormulaRow = { number: "C4.2.101", page: 135, latex: "f_{myk}=f_{yk}+\\frac{(f_{tk}-f_{yk})\\,k\\,n\\,t^2}{A_g}\\le0{,}5\\,(f_{tk}+f_{yk})", raw: "f_myk = f_yk + ((f_tk − f_yk)·k·n·t²)/A_g ≤ 0,5·(f_tk + f_yk) [C4.2.101]", region: reg(145, 85, 330, 45) };

const unit29 = "C4.2.9";
const unit296 = "C4.2.9.6";
const unit212 = "C4.2.12";
const unit2121 = "C4.2.12.1";
const unit21211 = "C4.2.12.1.1";

const units = [
    {
        number: unit29,
        title: "Requisiti per la progettazione e l’esecuzione",
        parent: uid("C4.2"),
        ancestors: [uid("C4.2")],
        position: 9,
        blocks: [block(unit29, "heading", "heading", 134, "C4.2.9. Requisiti per la progettazione e l’esecuzione", [text("C4.2.9. Requisiti per la progettazione e l’esecuzione")], reg(73.9, 410, 450, 25))],
    },
    {
        number: unit296,
        title: "Verniciatura e zincatura",
        parent: uid(unit29),
        ancestors: [uid("C4.2"), uid(unit29)],
        position: 6,
        blocks: [
            block(unit296, "heading", "heading", 134, "C4.2.9.6. Verniciatura e zincatura", [text("C4.2.9.6. Verniciatura e zincatura")], reg(73.9, 450, 450, 25)),
            block(unit296, "p1", "paragraph", 134, "Gli acciai in strutture metalliche devono mantenere nel tempo le loro proprietà meccaniche, preservando la durabilità. Per questo scopo, occorre prevedere una protezione dalla corrosione affidabile negli ambienti di corrosione in cui il manufatto è destinato ad essere installato e a svolgere la sua funzione nel tempo. Secondo la norma UNI EN 1090-1, norma armonizzata per i componenti e kit di componenti strutturali in acciaio, è obbligatorio dichiarare la durabilità nella Dichiarazione delle Prestazioni (DoP) ai fini della marcatura CE. La durabilità, ovvero la conservazione nel tempo delle caratteristiche essenziali e della geometria dei componenti strutturali, è uno dei requisiti richiesti dalle Norme Tecniche per le Costruzioni – NTC. In particolare, le NTC prevedono che gli elementi delle strutture in acciaio devono essere adeguatamente protetti con rivestimenti superficiali, quali la verniciatura e la zincatura.", [text("Gli acciai in strutture metalliche devono mantenere nel tempo le loro proprietà meccaniche, preservando la durabilità. Per questo scopo, occorre prevedere una protezione dalla corrosione affidabile negli ambienti di corrosione in cui il manufatto è destinato ad essere installato e a svolgere la sua funzione nel tempo. Secondo la norma UNI EN 1090-1, norma armonizzata per i componenti e kit di componenti strutturali in acciaio, è obbligatorio dichiarare la durabilità nella Dichiarazione delle Prestazioni (DoP) ai fini della marcatura CE. La durabilità, ovvero la conservazione nel tempo delle caratteristiche essenziali e della geometria dei componenti strutturali, è uno dei requisiti richiesti dalle Norme Tecniche per le Costruzioni – NTC. In particolare, le NTC prevedono che gli elementi delle strutture in acciaio devono essere adeguatamente protetti con rivestimenti superficiali, quali la verniciatura e la zincatura.")], reg(73.9, 480, 450, 85)),
            block(unit296, "p2", "paragraph", 134, "La protezione dalla corrosione deve garantire la massima durata possibile limitando il più possibile gli interventi di manutenzione, essere sufficientemente resistente alle azioni meccaniche durante le fasi di cantiere, garantire la protezione anche delle superfici interne o comunque non raggiungibili quando la struttura è in opera come ad esempio nel caso di strutture tubolari.", [text("La protezione dalla corrosione deve garantire la massima durata possibile limitando il più possibile gli interventi di manutenzione, essere sufficientemente resistente alle azioni meccaniche durante le fasi di cantiere, garantire la protezione anche delle superfici interne o comunque non raggiungibili quando la struttura è in opera come ad esempio nel caso di strutture tubolari.")], reg(73.9, 570, 450, 45)),
            block(unit296, "p3", "paragraph", 134, "A tal fine può utilmente considerarsi l’effettuazione della zincatura a caldo, conformemente alla norma UNI EN ISO 1461.", [text("A tal fine può utilmente considerarsi l’effettuazione della zincatura a caldo, conformemente alla norma UNI EN ISO 1461.")], reg(73.9, 620, 450, 25)),
        ],
    },
    {
        number: unit212,
        title: "Profilati formati a freddo e lamiere grecate",
        parent: uid("C4.2"),
        ancestors: [uid("C4.2")],
        position: 12,
        blocks: [block(unit212, "heading", "heading", 134, "C4.2.12. Profilati formati a freddo e lamiere grecate", [text("C4.2.12. Profilati formati a freddo e lamiere grecate")], reg(73.9, 650, 450, 25))],
    },
    {
        number: unit2121,
        title: "Materiali",
        parent: uid(unit212),
        ancestors: [uid("C4.2"), uid(unit212)],
        position: 1,
        blocks: [
            block(unit2121, "heading", "heading", 134, "C4.2.12.1. Materiali", [text("C4.2.12.1. Materiali")], reg(73.9, 680, 450, 25)),
            block(unit2121, "p1", "paragraph", 134, "Per i profilati di acciaio profilati a freddo e le lamiere grecate, l’acciaio deve essere conforme a quanto previsto al § C11.3.4.11.2.1.", [text("Per i profilati di acciaio profilati a freddo e le lamiere grecate, l’acciaio deve essere conforme a quanto previsto al § C11.3.4.11.2.1.")], reg(73.9, 710, 450, 25)),
        ],
    },
    {
        number: unit21211,
        title: "Effetto della formatura a freddo sulla resistenza dell’acciaio",
        parent: uid(unit2121),
        ancestors: [uid("C4.2"), uid(unit212), uid(unit2121)],
        position: 1,
        blocks: [
            block(unit21211, "heading", "heading", 134, "C4.2.12.1.1. Effetto della formatura a freddo sulla resistenza dell’acciaio", [text("C4.2.12.1.1. Effetto della formatura a freddo sulla resistenza dell’acciaio")], reg(73.9, 740, 450, 25)),
            block(unit21211, "p1", "paragraph", 134, "Per effetto del processo di formatura a freddo si verifica un innalzamento della tensione di snervamento dell’acciaio che può essere considerato nei calcoli.", [text("Per effetto del processo di formatura a freddo si verifica un innalzamento della tensione di snervamento dell’acciaio che può essere considerato nei calcoli.")], reg(73.9, 765, 450, 25)),
            block(unit21211, "p2", "paragraph", 134, "Ove il fenomeno non sia valutato sperimentalmente sulla membratura nel suo complesso, il valore della tensione di snervamento media dopo formatura f_myk può essere valutata nel modo seguente:", [text("Ove il fenomeno non sia valutato sperimentalmente sulla membratura nel suo complesso, il valore della tensione di snervamento media dopo formatura "), math("f_myk", "f_{myk}"), text(" può essere valutata nel modo seguente:")], reg(73.9, 790, 450, 25)),
            formulaBlock(unit21211, "formula-101", formula101),
            block(unit21211, "p3", "paragraph", 135, "in cui", [text("in cui")], reg(73.9, 125, 80, 15)),
            block(unit21211, "item-1", "list-item", 135, "k=7 per formatura continua con rulli,", [math("k=7", "k=7"), text(" per formatura continua con rulli,")], reg(73.9, 145, 450, 20)),
            block(unit21211, "item-2", "list-item", 135, "k=5 per gli altri metodi di formatura,", [math("k=5", "k=5"), text(" per gli altri metodi di formatura,")], reg(73.9, 165, 450, 20)),
            block(unit21211, "item-3", "list-item", 135, "A_g è l’area lorda della sezione trasversale della membratura,", [math("A_g", "A_g"), text(" è l’area lorda della sezione trasversale della membratura,")], reg(73.9, 185, 450, 20)),
            block(unit21211, "item-4", "list-item", 135, "n è il numero di pieghe a 90° con raggio interno r≤5·t (pieghe con angolo diverso da 90° sono tenute in conto con frazioni di n),", [math("n", "n"), text(" è il numero di pieghe a 90° con raggio interno "), math("r≤5·t", "r\\le5\\,t"), text(" (pieghe con angolo diverso da 90° sono tenute in conto con frazioni di n),")], reg(73.9, 205, 450, 30)),
            block(unit21211, "item-5", "list-item", 135, "t è lo spessore (al netto dei rivestimenti) del piatto o nastro prima della formatura.", [math("t", "t"), text(" è lo spessore (al netto dei rivestimenti) del piatto o nastro prima della formatura.")], reg(73.9, 240, 450, 25)),
            block(unit21211, "p4", "paragraph", 135, "Il valore medio della tensione di snervamento f_myk può essere tenuto in conto nei calcoli nei casi seguenti:", [text("Il valore medio della tensione di snervamento "), math("f_myk", "f_{myk}"), text(" può essere tenuto in conto nei calcoli nei casi seguenti:")], reg(73.9, 270, 450, 25)),
            block(unit21211, "item-6", "list-item", 135, "verifiche di resistenza di aste tese,", [text("verifiche di resistenza di aste tese,")], reg(73.9, 300, 450, 20)),
            block(unit21211, "item-7", "list-item", 135, "verifiche di resistenza e verifiche di stabilità di aste compresse aventi sezione di classe 1, 2 e 3 (cioè sezioni completamente reagenti),", [text("verifiche di resistenza e verifiche di stabilità di aste compresse aventi sezione di classe 1, 2 e 3 (cioè sezioni completamente reagenti),")], reg(73.9, 320, 450, 30)),
            block(unit21211, "item-8", "list-item", 135, "verifiche di resistenza e verifiche di stabilità di travi inflesse le parti compresse delle quali siano di classe 1, 2 e 3 (cioè parti compresse completamente reagenti).", [text("verifiche di resistenza e verifiche di stabilità di travi inflesse le parti compresse delle quali siano di classe 1, 2 e 3 (cioè parti compresse completamente reagenti).")], reg(73.9, 355, 450, 35)),
            block(unit21211, "p5", "paragraph", 135, "Il valore medio della tensione di snervamento f_myk non deve essere tenuto in conto nei calcoli nei casi seguenti:", [text("Il valore medio della tensione di snervamento "), math("f_myk", "f_{myk}"), text(" non deve essere tenuto in conto nei calcoli nei casi seguenti:")], reg(73.9, 395, 450, 25)),
            block(unit21211, "item-9", "list-item", 135, "determinazione dell’area efficace,", [text("determinazione dell’area efficace,")], reg(73.9, 425, 450, 20)),
            block(unit21211, "item-10", "list-item", 135, "calcolo di membrature che, dopo il processo di formatura a freddo, siano sottoposte ad un trattamento termico di distensione.", [text("calcolo di membrature che, dopo il processo di formatura a freddo, siano sottoposte ad un trattamento termico di distensione.")], reg(73.9, 445, 450, 30)),
        ],
    },
];

function makeUnit(item: typeof units[number]) {
    const formulaIds = item.number === unit21211 ? [formulaId(formula101.number)] : [];
    return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(item.number), workId, expressionId, kind: "subparagraph", numbering: { official: item.number, sortKey: item.number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title: item.title, titleBlockId: `${uid(item.number)}#block-heading`, hierarchy: { parentId: item.parent, ancestorIds: item.ancestors, position: item.position }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks: item.blocks, citations: [], relations: [], assets: { formulaIds, tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2s", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: `circ2019-${item.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...(formulaIds.length ? [{ issueId: `circ2019-${item.number.replaceAll(".", "-")}-assets-review`, type: "asset-review", severity: "blocking", note: "La formula C4.2.101 richiede revisione umana indipendente." }] : [])] } };
}

const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2s", sourceId, status: "transcribed-unreviewed", formulas: [{ id: formulaId(formula101.number), unitId: uid(unit21211), officialNumber: formula101.number, pdfPage: formula101.page, latex: formula101.latex }], tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([...units.map((item) => writeFile(join(unitDirectory, `${item.number.toLowerCase()}.json`), `${JSON.stringify(makeUnit(item), null, 2)}\n`, "utf8")), writeFile(join(assetDirectory, "C4.2-step2s.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")]);
console.log("Circolare C4.2 step2s: generate 5 unità e 1 formula.");
