import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const figureDirectory = join(root, "corpus", "assets", "figures", "circ2019");
const evidenceRenderDirectory = join(root, "evidence", "circ-7-2019", "renders");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math" | "em"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type BlockKind = "heading" | "paragraph" | "list-item" | "formula-ref" | "table-ref" | "figure-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };
type Cell = { text: string; latex?: string; image?: { imagePath: string; alt: string; sha256: string; region: Region }; rowSpan?: number; colSpan?: number; align?: "left" | "center" | "right" };
const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:circ2019:${number.toLowerCase()}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const em = (value: string): Inline => ({ kind: "em", value });
const c = (value: string, latex?: string): Cell => ({ text: value, ...(latex ? { latex } : {}) });
const imageCell = (imagePath: string, alt: string, sha256: string, region: Region): Cell => ({ text: "", align: "center", image: { imagePath, alt, sha256, region } });
const hash = (value: string) => sha256OfText(value);
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; formule, tabelle e figure restano blocchi distinti." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(unitNumber: string, suffix: string, kind: Exclude<BlockKind, "formula-ref" | "table-ref" | "figure-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(unitNumber: string, suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }
function tableBlock(unitNumber: string, suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "table-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) }; }
function figureBlock(unitNumber: string, suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) }; }

const unit21212 = "C4.2.12.1.2";
const unit21213 = "C4.2.12.1.3";
const tableXIXId = tableId("C4.2.XIX");
const tableXIXRegion = reg(70, 330, 455, 400);
const figure25 = figureId("C4.2.25");
const figure25Region = reg(170, 225, 270, 75);
const formula102: FormulaRow = { number: "C4.2.102", page: 135, latex: "0{,}2\\le\\frac{c}{b}\\le0{,}6\\qquad0{,}1\\le\\frac{d}{b}\\le0{,}3", raw: "0,2 ≤ c/b ≤ 0,6    0,1 ≤ d/b ≤ 0,3 [C4.2.102]", region: reg(180, 740, 280, 45) };
const formula103: FormulaRow = { number: "C4.2.103", page: 136, latex: "u=2\\cdot\\frac{\\sigma_a^2\\cdot b_s^4}{E^2\\cdot t^2\\cdot z}", raw: "u = 2 · σ_a² · b_s⁴/(E² · t² · z) [C4.2.103]", region: reg(175, 180, 250, 45) };

const tableXIX = {
    id: tableXIXId,
    unitId: uid(unit21212),
    officialNumber: "C4.2.XIX",
    pdfPage: 135,
    caption: "Valori limite dei rapporti larghezza-spessore di profili formati a freddo",
    columnCount: 2,
    columnWidths: [72, 28],
    headers: [[c("Elemento della sezione trasversale"), c("Valore massimo")]],
    rows: [
        [imageCell("figures/circ2019/table-c4.2-xix-1.png", "Piatti piani e ali aperte", "f582d706cfda578c441229ad5681424ebde96bb95195eb734e8853deaab2d248", reg(82, 413, 156, 46)), c("b/t<50", "b/t<50")],
        [imageCell("figures/circ2019/table-c4.2-xix-2.png", "Piatti piani con irrigidimento di bordo", "332ea2afb62152c98444097636f09e697825f8541a13f83ebcd9a1d35c114850", reg(82, 463, 156, 44)), c("b/t≤60\nc/t<50", "\\begin{gathered}b/t\\le60\\\\c/t<50\\end{gathered}")],
        [imageCell("figures/circ2019/table-c4.2-xix-3.png", "Piatti piani con due irrigidimenti di bordo", "863516011044e7435ea47cf9e55bc1d93e82c5dedc91cddcce02e3ea28bfb6a5", reg(82, 511, 156, 42)), c("b/t≤90\nc/t≤60\nd/t<50", "\\begin{gathered}b/t\\le90\\\\c/t\\le60\\\\d/t<50\\end{gathered}")],
        [imageCell("figures/circ2019/table-c4.2-xix-4.png", "Sezioni a U o elementi con due irrigidimenti di bordo", "12dc25221fb69eb12a09c431c7a3d485cd5c696e836f94e985934888e5232913", reg(82, 556, 156, 46)), c("b/t≤500", "b/t\\le500")],
        [imageCell("figures/circ2019/table-c4.2-xix-5.png", "Elementi inclinati", "64830a9d32c4c885ce7aab1e6bc65aef5d1b88d751ee8043125bd18b5cc50265", reg(82, 606, 156, 38)), c("45°≤φ≤90°\nh/t≤500 sin φ", "\\begin{gathered}45^\\circ\\le\\phi\\le90^\\circ\\\\h/t\\le500\\sin\\phi\\end{gathered}")],
    ],
    notes: [],
};
for (const cell of [...tableXIX.headers, ...tableXIX.rows].flat()) cell.align = "center";
Object.assign(tableXIX, { captionInline: [{ kind: "em", value: "Valori limite dei rapporti larghezza-spessore di profili formati a freddo" }] });

const blocks21212: GeneratedBlock[] = [
    block(unit21212, "heading", "heading", 135, "C4.2.12.1.2. Valori limite dei rapporti larghezza - spessore", [text("C4.2.12.1.2. Valori limite dei rapporti larghezza - spessore")], reg(73.9, 55, 450, 25)),
    block(unit21212, "p1", "paragraph", 135, "Nella Tabella C4.2.XIX sono riportati i valori limite dei rapporti larghezza – spessore per i quali è applicabile la presente Circolare.", [text("Nella Tabella C4.2.XIX sono riportati i valori limite dei rapporti larghezza – spessore per i quali è applicabile la presente Circolare.")], reg(73.9, 90, 450, 35)),
    tableBlock(unit21212, "table-xix", tableXIXId, 135, "Tabella C4.2.XIX - Valori limite dei rapporti larghezza-spessore di profili formati a freddo", tableXIXRegion),
    block(unit21212, "p2", "paragraph", 135, "Tali limiti rappresentano il campo dei valori per i quali è disponibile probante esperienza costruttiva e valida sperimentazione.", [text("Tali limiti rappresentano il campo dei valori per i quali è disponibile probante esperienza costruttiva e valida sperimentazione.")], reg(73.9, 700, 450, 25)),
    block(unit21212, "p3", "paragraph", 135, "Inoltre, per garantire sufficiente rigidezza degli irrigidimenti di bordo, devono essere rispettate le seguenti limitazioni:", [text("Inoltre, per garantire sufficiente rigidezza degli irrigidimenti di bordo, devono essere rispettate le seguenti limitazioni:")], reg(73.9, 725, 450, 25)),
    formulaBlock(unit21212, "formula-102", formula102),
];

const blocks21213: GeneratedBlock[] = [
    block(unit21213, "heading", "heading", 136, "C4.2.12.1.3. Inflessione trasversale delle ali", [text("C4.2.12.1.3. Inflessione trasversale delle ali")], reg(73.9, 55, 450, 25)),
    block(unit21213, "p1", "paragraph", 136, "Negli elementi soggetti a flessione le ali molto larghe (sia tese sia compresse) tendono ad incurvarsi in direzione dell’asse neutro (curling). Tale fenomeno può essere considerato, in assenza ed in presenza di irrigidimenti (purché non ravvicinati tra loro), nel modo seguente.", [text("Negli elementi soggetti a flessione le ali molto larghe (sia tese sia compresse) tendono ad incurvarsi in direzione dell’asse neutro ("), em("curling"), text("). Tale fenomeno può essere considerato, in assenza ed in presenza di irrigidimenti (purché non ravvicinati tra loro), nel modo seguente.")], reg(73.9, 85, 450, 45)),
    block(unit21213, "p2", "paragraph", 136, "Per una trave con asse rettilineo ed in riferimento alla Figura C4.2.25, si ha:", [text("Per una trave con asse rettilineo ed in riferimento alla Figura C4.2.25, si ha:")], reg(73.9, 135, 450, 25)),
    formulaBlock(unit21213, "formula-103", formula103),
    block(unit21213, "p3", "paragraph", 136, "dove u è la massima inflessione trasversale verso l’asse neutro dell’ala, z è la distanza nominale dell’ala dall’asse neutro, t è lo spessore della membratura, b_s è la metà della distanza tra le anime (per sezioni a cassone o sezioni ad U) o la lunghezza della parte a sbalzo, σ_a è la tensione normale media nelle ali calcolata con riferimento all’area lorda.", [text("dove "), math("u", "u"), text(" è la massima inflessione trasversale verso l’asse neutro dell’ala, "), math("z", "z"), text(" è la distanza nominale dell’ala dall’asse neutro, "), math("t", "t"), text(" è lo spessore della membratura, "), math("b_s", "b_s"), text(" è la metà della distanza tra le anime (per sezioni a cassone o sezioni ad U) o la lunghezza della parte a sbalzo, "), math("σ_a", "\\sigma_a"), text(" è la tensione normale media nelle ali calcolata con riferimento all’area lorda.")], reg(73.9, 210, 450, 50)),
    figureBlock(unit21213, "figure-25", figure25, 136, "Figura C4.2.25 – Incurvamento delle piattabande", figure25Region),
    block(unit21213, "p4", "paragraph", 136, "Bisogna tener conto di questo fenomeno nel calcolo della resistenza flessionale quando u ≥ 0,05·h, essendo h l’altezza della trave.", [text("Bisogna tener conto di questo fenomeno nel calcolo della resistenza flessionale quando "), math("u ≥ 0,05·h", "u\\ge0{,}05\\cdot h"), text(", essendo "), math("h", "h"), text(" l’altezza della trave.")], reg(73.9, 315, 450, 30)),
];

function makeUnit(number: string, title: string, parent: string, ancestors: string[], position: number, blocks: GeneratedBlock[], formulaIds: string[], tableIds: string[], figureIds: string[], issueSuffix: string) {
    return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(number), workId, expressionId, kind: "subparagraph", numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: `${uid(number)}#block-heading`, hierarchy: { parentId: parent, ancestorIds: ancestors, position }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds, tableIds, figureIds }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2t", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: `circ2019-${issueSuffix}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, { issueId: `circ2019-${issueSuffix}-assets-review`, type: "asset-review", severity: "blocking", note: "Formule, tabella e figura del blocco richiedono revisione umana indipendente." }] } };
}

const unit21212Record = makeUnit(unit21212, "Valori limite dei rapporti larghezza - spessore", uid("C4.2.12.1"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1")], 2, blocks21212, [formulaId(formula102.number)], [tableXIXId], [], "C4-2-12-1-2");
const unit21213Record = makeUnit(unit21213, "Inflessione trasversale delle ali", uid("C4.2.12.1"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1")], 3, blocks21213, [formulaId(formula103.number)], [], [figure25], "C4-2-12-1-3");
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2t", sourceId, status: "transcribed-unreviewed", formulas: [{ id: formulaId(formula102.number), unitId: uid(unit21212), officialNumber: formula102.number, pdfPage: formula102.page, latex: formula102.latex }, { id: formulaId(formula103.number), unitId: uid(unit21213), officialNumber: formula103.number, pdfPage: formula103.page, latex: formula103.latex }], tables: [tableXIX], figures: [{ id: figure25, unitId: uid(unit21213), officialNumber: "C4.2.25", pdfPage: 136, caption: "Figura C4.2.25 – Incurvamento delle piattabande", alt: "Incurvamento delle piattabande", imagePath: "figures/circ2019/figc4.2.25.png", region: figure25Region, sha256: "6b41dac2769a5e671c56bfec375f0110c8ade41d7334a5dfaa96a74543185c83" }] };
(manifest.figures[0] as Record<string, unknown>).captionInline = [{ kind: "strong", value: "Figura C4.2.25" }, { kind: "em", value: " – Incurvamento delle piattabande" }];
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([
    writeFile(join(unitDirectory, `${unit21212.toLowerCase()}.json`), `${JSON.stringify(unit21212Record, null, 2)}\n`, "utf8"),
    writeFile(join(unitDirectory, `${unit21213.toLowerCase()}.json`), `${JSON.stringify(unit21213Record, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2t.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    copyFile(join(evidenceRenderDirectory, "page-0135-x82-y413-w156-h46@4x.png"), join(figureDirectory, "table-c4.2-xix-1.png")),
    copyFile(join(evidenceRenderDirectory, "page-0135-x82-y463-w156-h44@4x.png"), join(figureDirectory, "table-c4.2-xix-2.png")),
    copyFile(join(evidenceRenderDirectory, "page-0135-x82-y511-w156-h42@4x.png"), join(figureDirectory, "table-c4.2-xix-3.png")),
    copyFile(join(evidenceRenderDirectory, "page-0135-x82-y556-w156-h46@4x.png"), join(figureDirectory, "table-c4.2-xix-4.png")),
    copyFile(join(evidenceRenderDirectory, "page-0135-x82-y606-w156-h38@4x.png"), join(figureDirectory, "table-c4.2-xix-5.png")),
    copyFile(join(evidenceRenderDirectory, "page-0136-x170-y225-w270-h75@4x.png"), join(figureDirectory, "figc4.2.25.png")),
]);
console.log("Circolare C4.2 step2t: generate 2 unità, 2 formule, 1 tabella e 1 figura.");
