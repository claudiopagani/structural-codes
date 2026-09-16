import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetDir = join(root, "corpus", "assets", "ntc2018");
const figureDir = join(root, "corpus", "assets", "figures", "ntc2018");
const evidenceRenderDir = join(root, "evidence", "gu-so8-2018-ntc", "renders");
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Opt = { page: number; printedPage: string; wrap?: boolean; discretionaryHyphen?: boolean; manual?: boolean };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type TableCell = { text: string; latex?: string; image?: { imagePath: string; alt: string; sha256: string; region: Region }; colSpan?: number; rowSpan?: number; align?: "left" | "center" | "right"; verticalText?: boolean };
const uid = (n: string) => "urn:structural-codes:it:unit:ntc2018:" + n;
const fid = (n: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + n;
const tid = (n: string) => "urn:structural-codes:it:asset:table:ntc2018:" + n;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const p = (page: number, printedPage: string, options: Omit<Opt, "page" | "printedPage"> = {}): Opt => ({ page, printedPage, ...options });
const t = (value: string): Inline => ({ kind: "text", value });
const m = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const c = (text: string, options: Omit<TableCell, "text"> = {}): TableCell => ({ text, ...options });
const imageCell = (imagePath: string, alt: string, sha256: string, region: Region, options: Omit<TableCell, "text" | "image"> = {}): TableCell => ({ text: "", align: "center", image: { imagePath, alt, sha256, region }, ...options });
function transforms(o: Opt) {
    const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
    if (o.wrap) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." }, { operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione delle righe." });
    if (o.discretionaryHyphen) result.push({ operation: "remove-discretionary-hyphen", ruleVersion: profile, note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga." });
    if (o.manual) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." });
    if (o.wrap || o.manual) result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}
function evidence(o: Opt, region: Region, raw: string, normalized: string) {
    return { sourceId, pdfPage: o.page, printedPage: o.printedPage, region, extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" }, transformations: transforms(o), rawSha256: sha256OfText(raw), normalizedSha256: sha256OfText(normalized) };
}
function block(n: string, suffix: string, kind: "heading" | "paragraph", o: Opt, region: Region, raw: string, normalized: string, inline: Inline[] = [t(normalized)]) {
    return { blockId: uid(n) + "#block-" + suffix, kind, origin: "official", text: { raw, normalized, normalizationVersion: profile, inline }, evidence: evidence(o, region, raw, normalized) };
}
function formula(n: string, number: string, o: Opt, region: Region) {
    return { blockId: uid(n) + "#block-formula-" + number.replaceAll(".", "-"), kind: "formula-ref", origin: "official", assetId: fid(number), evidence: { ...evidence({ ...o, manual: true }, region, "[" + number + "]", "[" + number + "]"), extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: profile } } };
}
function tableBlock(n: string, number: string, o: Opt, region: Region) {
    const note = "Tabella strutturata dal render ufficiale; revisione umana cella per cella e schema per schema ancora obbligatoria.";
    return { blockId: uid(n) + "#block-table-" + number.replaceAll(".", "-"), kind: "table-ref", origin: "official", assetId: tid(number), evidence: { ...evidence({ ...o, manual: true }, region, note, note), extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: profile } } };
}
function parent(n: string) { const a = n.split("."); return a.length === 1 ? null : uid(a.slice(0, -1).join(".")); }
function ancestors(n: string) { const a = n.split("."); return a.slice(1).map((_, i) => uid(a.slice(0, i + 1).join("."))); }
function unit(n: string, title: string, blocks: unknown[], formulas: string[] = [], tables: string[] = []) {
    return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(n), workId, expressionId, kind: "subparagraph", numbering: { official: n, sortKey: n.split(".").map((x) => x.padStart(3, "0")).join(".") }, title, titleBlockId: uid(n) + "#block-heading", hierarchy: { parentId: parent(n), ancestorIds: ancestors(n), position: Number(n.split(".").at(-1)) }, validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: formulas.map(fid), tableIds: tables.map(tid), figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "codex:ntc42-step4b", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "ntc2018-" + n.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." }, ...tables.map(() => ({ issueId: "ntc2018-" + n.replaceAll(".", "-") + "-assets", type: "asset-review", severity: "blocking", note: "La tabella contiene schemi grafici descritti testualmente e richiede revisione visuale puntuale." }))] } };
}

const formulaRows = [
    ["4.2.41", "4.2.4.1.3.1", 105, "\\frac{N_{Ed}}{N_{b,Rd}}\\le1"],
    ["4.2.42", "4.2.4.1.3.1", 105, "N_{b,Rd}=\\frac{\\chi A f_{yk}}{\\gamma_{M1}}\\quad\\text{per le sezioni di classe 1, 2 e 3}"],
    ["4.2.43", "4.2.4.1.3.1", 105, "N_{b,Rd}=\\frac{\\chi A_{eff}f_{yk}}{\\gamma_{M1}}\\quad\\text{per le sezioni di classe 4}"],
    ["4.2.44", "4.2.4.1.3.1", 105, "\\chi=\\frac{1}{\\Phi+\\sqrt{\\Phi^2-\\bar{\\lambda}^2}}\\le1"],
    ["4.2.45", "4.2.4.1.3.1", 105, "\\bar{\\lambda}=\\sqrt{\\frac{A\\cdot f_{yk}}{N_{cr}}}\\quad\\text{per le sezioni di classe 1, 2 e 3}"],
    ["4.2.46", "4.2.4.1.3.1", 105, "\\bar{\\lambda}=\\sqrt{\\frac{A_{eff}\\cdot f_{yk}}{N_{cr}}}\\quad\\text{per le sezioni di classe 4}"],
    ["4.2.47", "4.2.4.1.3.1", 106, "\\lambda=\\frac{l_0}{i}"],
    ["4.2.48", "4.2.4.1.3.2", 107, "\\frac{M_{Ed}}{M_{b,Rd}}\\le1"],
    ["4.2.49", "4.2.4.1.3.2", 107, "M_{b,Rd}=\\frac{\\chi_{LT}\\cdot W_y\\cdot f_{yk}}{\\gamma_{M1}}"],
    ["4.2.50", "4.2.4.1.3.2", 107, "\\chi_{LT}=\\frac{1}{f}\\cdot\\frac{1}{\\Phi_{LT}+\\sqrt{\\Phi_{LT}^2-\\beta\\cdot\\bar{\\lambda}_{LT}^2}}\\le K\\chi"],
    ["4.2.51", "4.2.4.1.3.2", 107, "\\bar{\\lambda}_{LT}=\\sqrt{\\frac{W_y\\cdot f_{yk}}{M_{cr}}}"],
    ["4.2.52", "4.2.4.1.3.2", 107, "f=1-0{,}5(1-k_c)[1-2{,}0(\\bar{\\lambda}_{LT}-0{,}8)^2]"],
    ["4.2.53", "4.2.4.1.3.2", 108, "K\\chi=\\min\\left(1,\\frac{1}{f\\cdot\\bar{\\lambda}_{LT}^2}\\right)"],
] as const;
const f = (n: string) => fid(n);

const tVIII = tid("4.2.viii");
const tIXa = tid("4.2.ix-a");
const tIXb = tid("4.2.ix-b");
const tableVIII = {
    id: tVIII,
    unitId: uid("4.2.4.1.3.1"),
    officialNumber: "4.2.VIII",
    pdfPage: 106,
    caption: "Tab. 4.2.VIII – Curve d’instabilità per varie tipologie di sezioni e classi d’acciaio, per elementi compressi",
    captionInline: [
        { kind: "strong", value: "Tab. 4.2.VIII" },
        { kind: "em", value: " – Curve d’instabilità per varie tipologie di sezioni e classi d’acciaio, per elementi compressi" },
    ],
    columnCount: 7,
    columnWidths: [6, 33, 4, 24, 13, 10, 10],
    headers: [
        [
            c("Sezione trasversale", { colSpan: 2, rowSpan: 2, align: "center" }),
            c("Limiti", { colSpan: 2, rowSpan: 2, align: "center" }),
            c("Inflessione\nintorno\nall’asse", { rowSpan: 2, align: "center" }),
            c("Curva di instabilità", { colSpan: 2, align: "center" }),
        ],
        [
            c("S235,\nS275,\nS355,\nS420", { align: "center" }),
            c("S460", { align: "center" }),
        ],
    ],
    rows: [
        [
            c("Sezioni laminate", { rowSpan: 4, align: "center", verticalText: true }),
            imageCell("figures/ntc2018/table4.2.viii-laminated-i.png", "Sezione laminata ad I con assi y-y e z-z", "549c373528b4cd8087472eb2657dfdadf8d4429193fa894e38a62ae15553aa41", reg(108, 160, 86, 82), { rowSpan: 4 }),
            c("h/b > 1,2", { latex: "h/b>1{,}2", rowSpan: 2, align: "center", verticalText: true }),
            c("t_f ≤ 40 mm", { latex: "t_f\\le40\\,\\mathrm{mm}", align: "center" }),
            c("y-y\nz-z", { latex: "\\begin{gathered}y-y\\\\z-z\\end{gathered}", align: "center" }),
            c("a\nb", { latex: "\\begin{gathered}a\\\\b\\end{gathered}", align: "center" }),
            c("a_0\na_0", { latex: "\\begin{gathered}a_0\\\\a_0\\end{gathered}", align: "center" }),
        ],
        [
            c("40 mm < t_f ≤ 100 mm", { latex: "40\\,\\mathrm{mm}<t_f\\le100\\,\\mathrm{mm}", align: "center" }),
            c("y-y\nz-z", { latex: "\\begin{gathered}y-y\\\\z-z\\end{gathered}", align: "center" }),
            c("b\nc", { latex: "\\begin{gathered}b\\\\c\\end{gathered}", align: "center" }),
            c("a\na", { latex: "\\begin{gathered}a\\\\a\\end{gathered}", align: "center" }),
        ],
        [
            c("h/b ≤ 1,2", { latex: "h/b\\le1{,}2", rowSpan: 2, align: "center", verticalText: true }),
            c("t_f ≤ 100 mm", { latex: "t_f\\le100\\,\\mathrm{mm}", align: "center" }),
            c("y-y\nz-z", { latex: "\\begin{gathered}y-y\\\\z-z\\end{gathered}", align: "center" }),
            c("b\nc", { latex: "\\begin{gathered}b\\\\c\\end{gathered}", align: "center" }),
            c("a\na", { latex: "\\begin{gathered}a\\\\a\\end{gathered}", align: "center" }),
        ],
        [
            c("t_f > 100 mm", { latex: "t_f>100\\,\\mathrm{mm}", align: "center" }),
            c("y-y\nz-z", { latex: "\\begin{gathered}y-y\\\\z-z\\end{gathered}", align: "center" }),
            c("d\nd", { latex: "\\begin{gathered}d\\\\d\\end{gathered}", align: "center" }),
            c("c\nc", { latex: "\\begin{gathered}c\\\\c\\end{gathered}", align: "center" }),
        ],
        [
            c("Sezioni ad I saldate", { rowSpan: 2, align: "center", verticalText: true }),
            imageCell("figures/ntc2018/table4.2.viii-welded-i.png", "Sezioni ad I saldate con assi y-y e z-z", "6f7b63cb7cfa22ad67a5a8cedca50d2651f7ea598158bbf6d06b12591e581b82", reg(108, 246, 86, 42), { rowSpan: 2 }),
            c("t_f ≤ 40 mm", { latex: "t_f\\le40\\,\\mathrm{mm}", colSpan: 2, align: "center" }),
            c("y-y\nz-z", { latex: "\\begin{gathered}y-y\\\\z-z\\end{gathered}", align: "center" }),
            c("b\nc", { latex: "\\begin{gathered}b\\\\c\\end{gathered}", align: "center" }),
            c("b\nc", { latex: "\\begin{gathered}b\\\\c\\end{gathered}", align: "center" }),
        ],
        [
            c("t_f > 40 mm", { latex: "t_f>40\\,\\mathrm{mm}", colSpan: 2, align: "center" }),
            c("y-y\nz-z", { latex: "\\begin{gathered}y-y\\\\z-z\\end{gathered}", align: "center" }),
            c("c\nd", { latex: "\\begin{gathered}c\\\\d\\end{gathered}", align: "center" }),
            c("c\nd", { latex: "\\begin{gathered}c\\\\d\\end{gathered}", align: "center" }),
        ],
        [
            c("Sezioni cave", { rowSpan: 2, align: "center", verticalText: true }),
            imageCell("figures/ntc2018/table4.2.viii-hollow.png", "Sezioni cave circolare, quadrata e rettangolare", "fad65a63fc485bb1c300f63741bedae6b34551cfa8eb771e8c2465c2c0972429", reg(108, 291, 86, 47), { rowSpan: 2 }),
            c("Sezione formata “a caldo”", { colSpan: 2, align: "center" }),
            c("qualunque", { align: "center" }),
            c("a", { latex: "a", align: "center" }),
            c("a_0", { latex: "a_0", align: "center" }),
        ],
        [
            c("Sezione formata “a freddo”", { colSpan: 2, align: "center" }),
            c("qualunque", { align: "center" }),
            c("c", { latex: "c", align: "center" }),
            c("c", { latex: "c", align: "center" }),
        ],
        [
            c("Sezioni scatolari saldate", { rowSpan: 2, align: "center", verticalText: true }),
            imageCell("figures/ntc2018/table4.2.viii-welded-box.png", "Sezione scatolare saldata con assi y-y e z-z", "42972d51230d37b60bcef48c7bda60505eb09ac0dff636864a0151d1db927ce6", reg(108, 342, 86, 64), { rowSpan: 2 }),
            c("In generale", { colSpan: 2, align: "center" }),
            c("qualunque", { align: "center" }),
            c("b", { latex: "b", align: "center" }),
            c("b", { latex: "b", align: "center" }),
        ],
        [
            c("saldature “spesse”: a > 0,5t_f; b/t_f < 30; h/t_w < 30", { latex: "\\begin{gathered}\\text{saldature “spesse”: }a>0{,}5t_f;\\\\b/t_f<30;\\ h/t_w<30\\end{gathered}", colSpan: 2, align: "center" }),
            c("qualunque", { align: "center" }),
            c("c", { latex: "c", align: "center" }),
            c("c", { latex: "c", align: "center" }),
        ],
        [
            c("Sezioni piene, ad U e T", { align: "center", verticalText: true }),
            imageCell("figures/ntc2018/table4.2.viii-solid-u-t.png", "Sezioni ad U o T e sezioni piene rettangolare e circolare", "e896f55c42c872e3b6f1cae360885cb09c00eac3a70eae3e58d0da7bbda33425", reg(108, 410, 160, 43), { colSpan: 3 }),
            c("qualunque", { align: "center" }),
            c("c", { latex: "c", align: "center" }),
            c("c", { latex: "c", align: "center" }),
        ],
        [
            c("Sezioni ad L", { align: "center", verticalText: true }),
            imageCell("figures/ntc2018/table4.2.viii-angle.png", "Sezione ad L con assi principali", "78492b2fe126038dcb6108b572b993bd12fe46228f06ed80ad4beba74c7675a1", reg(108, 457, 160, 31), { colSpan: 3 }),
            c("qualunque", { align: "center" }),
            c("b", { latex: "b", align: "center" }),
            c("b", { latex: "b", align: "center" }),
        ],
        [
            c("Curva di instabilità", { colSpan: 2 }),
            c("a_0", { latex: "a_0", align: "center" }),
            c("a", { latex: "a", align: "center" }),
            c("b", { latex: "b", align: "center" }),
            c("c", { latex: "c", align: "center" }),
            c("d", { latex: "d", align: "center" }),
        ],
        [
            c("Fattore di imperfezione α", { latex: "\\text{Fattore di imperfezione }\\alpha", colSpan: 2 }),
            c("0,13", { align: "center" }),
            c("0,21", { align: "center" }),
            c("0,34", { align: "center" }),
            c("0,49", { align: "center" }),
            c("0,76", { align: "center" }),
        ],
    ],
    notes: [],
};
const tableIXaCaption = "Tab. 4.2.IX (a) – Valori raccomandati di αLT per le differenti curve di stabilità";
const tableIXa = { id: tIXa, unitId: uid("4.2.4.1.3.2"), officialNumber: "4.2.IX (a)", pdfPage: 107, caption: tableIXaCaption, captionInline: [{ kind: "strong", value: "Tab. 4.2.IX (a)" }, { kind: "em", value: " – Valori raccomandati di " }, { kind: "math", value: "αLT", latex: "\\alpha_{LT}" }, { kind: "em", value: " per le differenti curve di stabilità" }], columnCount: 5, headers: [[{ text: "Curva di stabilità", align: "center" }, { text: "a", align: "center" }, { text: "b", align: "center" }, { text: "c", align: "center" }, { text: "d", align: "center" }]], rows: [[{ text: "Fattore di imperfezione αLT", latex: "\\alpha_{LT}", align: "center" }, { text: "0,21", align: "center" }, { text: "0,34", align: "center" }, { text: "0,49", align: "center" }, { text: "0,76", align: "center" }]], notes: [] };
const tableIXbCaption = "Tab. 4.2.IX (b) – Definizione delle curve di stabilità per le varie tipologie di sezione e per gli elementi inflessi";
const tableIXb = { id: tIXb, unitId: uid("4.2.4.1.3.2"), officialNumber: "4.2.IX (b)", pdfPage: 107, caption: tableIXbCaption, captionInline: [{ kind: "strong", value: "Tab. 4.2.IX (b)" }, { kind: "em", value: " – Definizione delle curve di stabilità per le varie tipologie di sezione e per gli elementi inflessi" }], columnCount: 3, headers: [[{ text: "Sezione trasversale", align: "center" }, { text: "Limiti", align: "center" }, { text: "Curva di instabilità da Tab. 4.2.VIII", align: "center" }]], rows: [[{ text: "Sezione laminata ad I", rowSpan: 2, align: "center" }, { text: "h/b ≤ 2", latex: "h/b\\le2", align: "center" }, { text: "b", align: "center" }], [{ text: "h/b > 2", latex: "h/b>2", align: "center" }, { text: "c", align: "center" }], [{ text: "Sezione composta saldata", rowSpan: 2, align: "center" }, { text: "h/b ≤ 2", latex: "h/b\\le2", align: "center" }, { text: "c", align: "center" }], [{ text: "h/b > 2", latex: "h/b>2", align: "center" }, { text: "d", align: "center" }], [{ text: "Altre sezioni trasversali", align: "center" }, { text: "—", align: "center" }, { text: "d", align: "center" }]], notes: [] };

const units = [
    unit("4.2.4.1.3", "Stabilità delle membrature", [block("4.2.4.1.3", "heading", "heading", p(105, "101", { manual: true }), reg(82.954, 650, 180, 7.476), "4.2.4.1.3 Stabilità delle membrature", "4.2.4.1.3 Stabilità delle membrature")]),
    unit("4.2.4.1.3.1", "Aste compresse", [
        block("4.2.4.1.3.1", "heading", "heading", p(105, "101", { manual: true }), reg(82.954, 672, 120, 7.476), "4.2.4.1.3.1 Aste compresse", "4.2.4.1.3.1 Aste compresse"),
        block("4.2.4.1.3.1", "p1", "paragraph", p(105, "101", { wrap: true }), reg(82.954, 684, 428.6, 17.6), "La verifica di stabilità di un’asta si effettua nell’ipotesi che la sezione trasversale sia uniformemente compressa. Deve essere", "La verifica di stabilità di un’asta si effettua nell’ipotesi che la sezione trasversale sia uniformemente compressa. Deve essere"),
        formula("4.2.4.1.3.1", "4.2.41", p(105, "101"), reg(180, 708, 220, 25)),
        block("4.2.4.1.3.1", "p2", "paragraph", p(105, "101"), reg(82.954, 742, 80, 7.482), "dove", "dove"),
        { ...block("4.2.4.1.3.1", "p3", "paragraph", p(105, "101"), reg(82.954, 754, 428.6, 7.482), "NEd è l’azione di compressione di progetto,", "NEd è l’azione di compressione di progetto,", [m("NEd", "N_{Ed}"), t(" è l’azione di compressione di progetto,")]), kind: "list-item", listMarker: "none", indentLevel: 1 },
        { ...block("4.2.4.1.3.1", "p4", "paragraph", p(105, "101"), reg(82.954, 766, 428.6, 7.482), "Nb,Rd è la resistenza di progetto all’instabilità nell’asta compressa, data da", "Nb,Rd è la resistenza di progetto all’instabilità nell’asta compressa, data da", [m("Nb,Rd", "N_{b,Rd}"), t(" è la resistenza di progetto all’instabilità nell’asta compressa, data da")]), kind: "list-item", listMarker: "none", indentLevel: 1 },
        formula("4.2.4.1.3.1", "4.2.42", p(105, "101"), reg(150, 780, 300, 30)),
        block("4.2.4.1.3.1", "p5", "paragraph", p(105, "101"), reg(82.954, 815, 80, 7.482), "e da", "e da"),
        formula("4.2.4.1.3.1", "4.2.43", p(105, "101"), reg(150, 829, 300, 30)),
        block("4.2.4.1.3.1", "p6", "paragraph", p(105, "101", { wrap: true }), reg(82.954, 864, 428.6, 27.6), "I coefficienti χ dipendono dal tipo di sezione e dal tipo di acciaio impiegato; essi si desumono, in funzione di appropriati valori della snellezza normalizzata λ̄, dalla seguente formula", "I coefficienti χ dipendono dal tipo di sezione e dal tipo di acciaio impiegato; essi si desumono, in funzione di appropriati valori della snellezza normalizzata λ̄, dalla seguente formula", [t("I coefficienti "), m("χ", "\\chi"), t(" dipendono dal tipo di sezione e dal tipo di acciaio impiegato; essi si desumono, in funzione di appropriati valori della snellezza normalizzata "), m("λ̄", "\\bar{\\lambda}"), t(", dalla seguente formula")]),
        formula("4.2.4.1.3.1", "4.2.44", p(105, "101"), reg(150, 897, 300, 45)),
        block("4.2.4.1.3.1", "p7", "paragraph", p(105, "101", { wrap: true, manual: true }), reg(82.954, 946, 428.6, 27.6), "dove φ = 0,5[1 + α(λ̄ − 0,2) + λ̄²], α è il fattore di imperfezione ricavato dalla Tab. 4.2.VIII e la snellezza normalizzata λ̄ è pari a", "dove Φ = 0,5[1 + α(λ̄ − 0,2) + λ̄²], α è il fattore di imperfezione ricavato dalla Tab. 4.2.VIII e la snellezza normalizzata λ̄ è pari a", [t("dove "), m("Φ = 0,5[1 + α(λ̄ − 0,2) + λ̄²]", "\\Phi=0{,}5\\left[1+\\alpha(\\bar{\\lambda}-0{,}2)+\\bar{\\lambda}^2\\right]"), t(", "), m("α", "\\alpha"), t(" è il fattore di imperfezione ricavato dalla Tab. 4.2.VIII e la snellezza normalizzata "), m("λ̄", "\\bar{\\lambda}"), t(" è pari a")]),
        formula("4.2.4.1.3.1", "4.2.45", p(105, "101"), reg(150, 978, 300, 25)),
        formula("4.2.4.1.3.1", "4.2.46", p(105, "101"), reg(150, 1010, 300, 25)),
        tableBlock("4.2.4.1.3.1", "4.2.viii", p(106, "102"), reg(82.954, 98.9, 430, 385)),
        block("4.2.4.1.3.1", "p8", "paragraph", p(106, "102", { wrap: true }), reg(82.954, 500, 428.6, 27.6), "Ncr è il carico critico elastico basato sulle proprietà della sezione lorda e sulla lunghezza di libera inflessione l0 dell’asta, calcolato per la modalità di collasso per instabilità appropriata (flessionale, torsionale o flesso-torsionale).", "Ncr è il carico critico elastico basato sulle proprietà della sezione lorda e sulla lunghezza di libera inflessione l0 dell’asta, calcolato per la modalità di collasso per instabilità appropriata (flessionale, torsionale o flesso-torsionale).", [m("Ncr", "N_{cr}"), t(" è il carico critico elastico basato sulle proprietà della sezione lorda e sulla lunghezza di libera inflessione "), m("l0", "l_0"), t(" dell’asta, calcolato per la modalità di collasso per instabilità appropriata (flessionale, torsionale o flesso-torsionale).")]),
        block("4.2.4.1.3.1", "p9", "paragraph", p(106, "102", { wrap: true }), reg(82.954, 535, 428.6, 27.6), "Nel caso in cui λ̄ sia minore di 0,2 oppure nel caso in cui la sollecitazione di progetto NEd sia inferiore a 0,04Ncr, gli effetti legati ai fenomeni di instabilità per le aste compresse possono essere trascurati.", "Nel caso in cui λ̄ sia minore di 0,2 oppure nel caso in cui la sollecitazione di progetto NEd sia inferiore a 0,04Ncr, gli effetti legati ai fenomeni di instabilità per le aste compresse possono essere trascurati.", [t("Nel caso in cui "), m("λ̄", "\\bar{\\lambda}"), t(" sia minore di 0,2 oppure nel caso in cui la sollecitazione di progetto "), m("NEd", "N_{Ed}"), t(" sia inferiore a 0,04"), m("Ncr", "N_{cr}"), t(", gli effetti legati ai fenomeni di instabilità per le aste compresse possono essere trascurati.")]),
        block("4.2.4.1.3.1", "heading-limit", "heading", p(106, "102", { manual: true }), reg(82.954, 575, 150, 7.476), "Limitazioni della snellezza", "Limitazioni della snellezza"),
        block("4.2.4.1.3.1", "p10", "paragraph", p(106, "102", { wrap: true }), reg(82.954, 588, 428.6, 37.6), "Si definisce lunghezza d’inflessione la lunghezza l0 = βl da sostituire nel calcolo del carico critico elastico Ncr alla lunghezza l dell’asta quale risulta dallo schema strutturale. Il coefficiente β deve essere valutato tenendo conto delle effettive condizioni di vincolo dell’asta nel piano di inflessione considerato.", "Si definisce lunghezza d’inflessione la lunghezza l0 = βl da sostituire nel calcolo del carico critico elastico Ncr alla lunghezza l dell’asta quale risulta dallo schema strutturale. Il coefficiente β deve essere valutato tenendo conto delle effettive condizioni di vincolo dell’asta nel piano di inflessione considerato.", [t("Si definisce lunghezza d’inflessione la lunghezza "), m("l0 = βl", "l_0=\\beta l"), t(" da sostituire nel calcolo del carico critico elastico "), m("Ncr", "N_{cr}"), t(" alla lunghezza l dell’asta quale risulta dallo schema strutturale. Il coefficiente "), m("β", "\\beta"), t(" deve essere valutato tenendo conto delle effettive condizioni di vincolo dell’asta nel piano di inflessione considerato.")]),
        block("4.2.4.1.3.1", "p11", "paragraph", p(106, "102"), reg(82.954, 630, 390, 7.482), "Si definisce snellezza di un’asta nel piano di verifica considerato il rapporto", "Si definisce snellezza di un’asta nel piano di verifica considerato il rapporto"),
        formula("4.2.4.1.3.1", "4.2.47", p(106, "102"), reg(180, 644, 220, 25)),
        block("4.2.4.1.3.1", "p12", "paragraph", p(106, "102"), reg(82.954, 678, 80, 7.482), "dove", "dove"),
        { ...block("4.2.4.1.3.1", "p13a", "paragraph", p(106, "102"), reg(82.954, 690, 428.6, 7.6), "l0 è la lunghezza d’inflessione nel piano considerato,", "l0 è la lunghezza d’inflessione nel piano considerato,", [m("l0", "l_0"), t(" è la lunghezza d’inflessione nel piano considerato,")]), kind: "list-item", listMarker: "none", indentLevel: 1 },
        { ...block("4.2.4.1.3.1", "p13b", "paragraph", p(106, "102"), reg(82.954, 700, 428.6, 7.6), "i è il raggio d’inerzia relativo.", "i è il raggio d’inerzia relativo.", [m("i", "i"), t(" è il raggio d’inerzia relativo.")]), kind: "list-item", listMarker: "none", indentLevel: 1 },
        block("4.2.4.1.3.1", "p14", "paragraph", p(106, "102", { wrap: true }), reg(82.954, 722, 428.6, 17.6), "È opportuno limitare la snellezza λ al valore di 200 per le membrature principali ed a 250 per le membrature secondarie.", "È opportuno limitare la snellezza λ al valore di 200 per le membrature principali ed a 250 per le membrature secondarie.", [t("È opportuno limitare la snellezza "), m("λ", "\\lambda"), t(" al valore di 200 per le membrature principali ed a 250 per le membrature secondarie.")]),
    ], ["4.2.41", "4.2.42", "4.2.43", "4.2.44", "4.2.45", "4.2.46", "4.2.47"], ["4.2.viii"]),
    unit("4.2.4.1.3.2", "Travi inflesse", [
        block("4.2.4.1.3.2", "heading", "heading", p(107, "103", { manual: true }), reg(82.954, 98.9, 120, 7.476), "4.2.4.1.3.2 Travi inflesse", "4.2.4.1.3.2 Travi inflesse"),
        block("4.2.4.1.3.2", "p1", "paragraph", p(107, "103", { wrap: true, discretionaryHyphen: true }), reg(82.954, 111, 428.6, 27.6), "Le travi inflesse con la piattabanda compressa non sufficientemente vincolata lateralmente, devono essere verificate nei riguardi dell’instabilità flesso-torsionale secondo la formula", "Le travi inflesse con la piattabanda compressa non sufficientemente vincolata lateralmente, devono essere verificate nei riguardi dell’instabilità flesso-torsionale secondo la formula"),
        formula("4.2.4.1.3.2", "4.2.48", p(107, "103"), reg(180, 145, 220, 25)),
        block("4.2.4.1.3.2", "p2", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 180, 428.6, 17.6), "dove:\nMEd è il massimo momento flettente di progetto\nMb,Rd è il momento resistente di progetto per l’instabilità.", "dove: MEd è il massimo momento flettente di progetto; Mb,Rd è il momento resistente di progetto per l’instabilità.", [t("dove: "), m("MEd", "M_{Ed}"), t(" è il massimo momento flettente di progetto; "), m("Mb,Rd", "M_{b,Rd}"), t(" è il momento resistente di progetto per l’instabilità.")]),
        block("4.2.4.1.3.2", "p3", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 215, 428.6, 27.6), "Nel caso di profilo inflesso secondo l’asse forte (asse y) il momento resistente di progetto per i fenomeni di instabilità di una trave lateralmente non vincolata può essere assunto pari a", "Nel caso di profilo inflesso secondo l’asse forte (asse y) il momento resistente di progetto per i fenomeni di instabilità di una trave lateralmente non vincolata può essere assunto pari a"),
        formula("4.2.4.1.3.2", "4.2.49", p(107, "103"), reg(150, 249, 300, 25)),
        block("4.2.4.1.3.2", "p4", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 284, 428.6, 37.6), "dove Wy è il modulo resistente della sezione, pari al modulo plastico Wpl,y, per le sezioni di classe 1 e 2, al modulo elastico Wel,y per le sezioni di classe 3 e che può essere assunto pari al modulo efficace Weff,y per le sezioni di classe 4.", "dove Wy è il modulo resistente della sezione, pari al modulo plastico Wpl,y, per le sezioni di classe 1 e 2, al modulo elastico Wel,y per le sezioni di classe 3 e che può essere assunto pari al modulo efficace Weff,y per le sezioni di classe 4.", [t("dove "), m("Wy", "W_y"), t(" è il modulo resistente della sezione, pari al modulo plastico "), m("Wpl,y", "W_{pl,y}"), t(", per le sezioni di classe 1 e 2, al modulo elastico "), m("Wel,y", "W_{el,y}"), t(" per le sezioni di classe 3 e che può essere assunto pari al modulo efficace "), m("Weff,y", "W_{eff,y}"), t(" per le sezioni di classe 4.")]),
        block("4.2.4.1.3.2", "p5", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 330, 428.6, 27.6), "Il fattore χLT è il fattore di riduzione per l’instabilità flessotorsionale, dipendente dal tipo di profilo impiegato e può essere determinato dalla formula", "Il fattore χLT è il fattore di riduzione per l’instabilità flessotorsionale, dipendente dal tipo di profilo impiegato e può essere determinato dalla formula", [t("Il fattore "), m("χLT", "\\chi_{LT}"), t(" è il fattore di riduzione per l’instabilità flessotorsionale, dipendente dal tipo di profilo impiegato e può essere determinato dalla formula")]),
        formula("4.2.4.1.3.2", "4.2.50", p(107, "103"), reg(145, 365, 320, 55)),
        block("4.2.4.1.3.2", "p6", "paragraph", p(107, "103"), reg(82.954, 430, 428.6, 17.6), "Il coefficiente di snellezza normalizzata λ̄LT è dato dalla formula", "Il coefficiente di snellezza normalizzata λ̄LT è dato dalla formula", [t("Il coefficiente di snellezza normalizzata "), m("λ̄LT", "\\bar{\\lambda}_{LT}"), t(" è dato dalla formula")]),
        formula("4.2.4.1.3.2", "4.2.51", p(107, "103"), reg(180, 455, 220, 30)),
        block("4.2.4.1.3.2", "p7", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 492, 428.6, 27.6), "in cui Mcr è il momento critico elastico di instabilità flesso-torsionale, calcolato considerando la sezione lorda del profilo e tenendo in conto, le condizioni di carico ed i vincoli torsionali presenti, nell’ipotesi di diagramma di momento flettente uniforme.", "in cui Mcr è il momento critico elastico di instabilità flesso-torsionale, calcolato considerando la sezione lorda del profilo e tenendo in conto, le condizioni di carico ed i vincoli torsionali presenti, nell’ipotesi di diagramma di momento flettente uniforme.", [t("in cui "), m("Mcr", "M_{cr}"), t(" è il momento critico elastico di instabilità flesso-torsionale, calcolato considerando la sezione lorda del profilo e tenendo in conto, le condizioni di carico ed i vincoli torsionali presenti, nell’ipotesi di diagramma di momento flettente uniforme.")]),
        block("4.2.4.1.3.2", "p8", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 535, 428.6, 17.6), "Il fattore di imperfezione αLT è ottenuto dalle indicazioni riportate nella Tab. 4.2.IX (a) in base alle curve di stabilità definite nella tabella Tab. 4.2.IX (b)", "Il fattore di imperfezione αLT è ottenuto dalle indicazioni riportate nella Tab. 4.2.IX (a) in base alle curve di stabilità definite nella tabella Tab. 4.2.IX (b)", [t("Il fattore di imperfezione "), m("αLT", "\\alpha_{LT}"), t(" è ottenuto dalle indicazioni riportate nella Tab. 4.2.IX (a) in base alle curve di stabilità definite nella tabella Tab. 4.2.IX (b)")]),
        block("4.2.4.1.3.2", "p9", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 560, 428.6, 27.6), "Il fattore f considera la reale distribuzione del momento flettente tra i ritegni torsionali dell’elemento inflesso ed è definito dalla formula", "Il fattore f considera la reale distribuzione del momento flettente tra i ritegni torsionali dell’elemento inflesso ed è definito dalla formula"),
        formula("4.2.4.1.3.2", "4.2.52", p(107, "103"), reg(150, 594, 300, 30)),
        block("4.2.4.1.3.2", "p10", "paragraph", p(107, "103", { wrap: true }), reg(82.954, 634, 428.6, 37.6), "in cui il fattore correttivo kc assume i valori riportati in Tab. 4.2.X. In particolare nel caso di variazione lineare del momento flettente ψ (−1 ≤ ψ ≤ 1) rappresenta il rapporto tra il momento in modulo minimo ed il momento in modulo massimo presi entrambi con il loro segno.", "in cui il fattore correttivo kc assume i valori riportati in Tab. 4.2.X. In particolare nel caso di variazione lineare del momento flettente ψ (−1 ≤ ψ ≤ 1) rappresenta il rapporto tra il momento in modulo minimo ed il momento in modulo massimo presi entrambi con il loro segno.", [t("in cui il fattore correttivo "), m("kc", "k_c"), t(" assume i valori riportati in Tab. 4.2.X. In particolare nel caso di variazione lineare del momento flettente "), m("ψ", "\\psi"), t(" ("), m("−1 ≤ ψ ≤ 1", "-1\\le\\psi\\le1"), t(") rappresenta il rapporto tra il momento in modulo minimo ed il momento in modulo massimo presi entrambi con il loro segno.")]),
        block("4.2.4.1.3.2", "p11", "paragraph", p(107, "103"), reg(82.954, 682, 428.6, 7.482), "Nel caso generale, si può assumere f=1, β=1, Kχ=1 e λ̄LT,0=0,2.", "Nel caso generale, si può assumere f=1, β=1, Kχ=1 e λ̄LT,0=0,2.", [t("Nel caso generale, si può assumere "), m("f=1", "f=1"), t(", "), m("β=1", "\\beta=1"), t(", "), m("Kχ=1", "K\\chi=1"), t(" e "), m("λ̄LT,0=0,2", "\\bar{\\lambda}_{LT,0}=0{,}2"), t(".")]),
        tableBlock("4.2.4.1.3.2", "4.2.ix-a", p(107, "103"), reg(82.954, 706, 428.6, 45)),
        tableBlock("4.2.4.1.3.2", "4.2.ix-b", p(107, "103"), reg(82.954, 765, 428.6, 85)),
        formula("4.2.4.1.3.2", "4.2.53", p(108, "104"), reg(180, 98, 220, 25)),
    ], ["4.2.48", "4.2.49", "4.2.50", "4.2.51", "4.2.52", "4.2.53"], ["4.2.ix-a", "4.2.ix-b"]),
    unit("4.2.4.1.3.3", "Membrature inflesse e compresse", [
        block("4.2.4.1.3.3", "heading", "heading", p(108, "104", { manual: true }), reg(82.954, 175, 220, 7.476), "4.2.4.1.3.3 Membrature inflesse e compresse", "4.2.4.1.3.3 Membrature inflesse e compresse"),
        block("4.2.4.1.3.3", "p1", "paragraph", p(108, "104", { wrap: true, discretionaryHyphen: true }), reg(82.954, 187, 428.6, 17.6), "Per elementi strutturali soggetti a compressione e flessione, si debbono studiare i relativi fenomeni di instabilità facendo riferimento a normative di comprovata validità.", "Per elementi strutturali soggetti a compressione e flessione, si debbono studiare i relativi fenomeni di instabilità facendo riferimento a normative di comprovata validità."),
    ]),
    unit("4.2.4.1.3.4", "Stabilità dei pannelli", [
        block("4.2.4.1.3.4", "heading", "heading", p(108, "104", { manual: true }), reg(82.954, 220, 150, 7.476), "4.2.4.1.3.4 Stabilità dei pannelli", "4.2.4.1.3.4 Stabilità dei pannelli"),
        block("4.2.4.1.3.4", "p1", "paragraph", p(108, "104", { wrap: true }), reg(82.954, 232, 428.6, 27.6), "Gli elementi strutturali in parete sottile (di classe 4) presentano problemi complessi d’instabilità locale, per la cui trattazione si deve fare riferimento a normative di comprovata validità.", "Gli elementi strutturali in parete sottile (di classe 4) presentano problemi complessi d’instabilità locale, per la cui trattazione si deve fare riferimento a normative di comprovata validità."),
    ]),
    unit("4.2.4.1.4", "Stato limite di fatica", [
        block("4.2.4.1.4", "heading", "heading", p(108, "104", { manual: true }), reg(82.954, 265, 140, 7.476), "4.2.4.1.4 Stato limite di fatica", "4.2.4.1.4 Stato limite di fatica"),
        block("4.2.4.1.4", "p1", "paragraph", p(108, "104"), reg(82.954, 278, 428.6, 7.482), "Per le strutture soggette a carichi ciclici deve essere verificata la resistenza a fatica imponendo che:", "Per le strutture soggette a carichi ciclici deve essere verificata la resistenza a fatica imponendo che:"),
        formula("4.2.4.1.4", "4.2.53", p(108, "104"), reg(180, 292, 220, 25)),
        block("4.2.4.1.4", "p2", "paragraph", p(108, "104", { wrap: true }), reg(82.954, 326, 428.6, 37.6), "essendo Δd l’escursione di tensione (effettiva o equivalente allo spettro di tensione) prodotta dalle azioni cicliche di progetto che inducono fenomeni di fatica con coefficienti parziali γMf = 1; ΔR la resistenza a fatica per la relativa categoria dei dettagli costruttivi, come desumibile dalle curve S-N di resistenza a fatica, per il numero totale di cicli di sollecitazione N applicati durante la vita di progetto richiesta, γMf il coefficiente parziale definito nella Tab. 4.2.XI.", "essendo Δd l’escursione di tensione (effettiva o equivalente allo spettro di tensione) prodotta dalle azioni cicliche di progetto che inducono fenomeni di fatica con coefficienti parziali γMf = 1; ΔR la resistenza a fatica per la relativa categoria dei dettagli costruttivi, come desumibile dalle curve S-N di resistenza a fatica, per il numero totale di cicli di sollecitazione N applicati durante la vita di progetto richiesta, γMf il coefficiente parziale definito nella Tab. 4.2.XI.", [t("essendo "), m("Δd", "\\Delta_d"), t(" l’escursione di tensione (effettiva o equivalente allo spettro di tensione) prodotta dalle azioni cicliche di progetto che inducono fenomeni di fatica con coefficienti parziali "), m("γMf", "\\gamma_{Mf}"), t(" = 1; "), m("ΔR", "\\Delta_R"), t(" la resistenza a fatica per la relativa categoria dei dettagli costruttivi, come desumibile dalle curve S-N di resistenza a fatica, per il numero totale di cicli di sollecitazione "), m("N", "N"), t(" applicati durante la vita di progetto richiesta, "), m("γMf", "\\gamma_{Mf}"), t(" il coefficiente parziale definito nella Tab. 4.2.XI.")]),
        block("4.2.4.1.4", "p3", "paragraph", p(108, "104", { wrap: true }), reg(82.954, 385, 428.6, 17.6), "Nel caso degli edifici la verifica a fatica delle membrature non è generalmente necessaria, salvo per quelle alle quali sono applicati dispositivi di sollevamento dei carichi o macchine vibranti.", "Nel caso degli edifici la verifica a fatica delle membrature non è generalmente necessaria, salvo per quelle alle quali sono applicati dispositivi di sollevamento dei carichi o macchine vibranti."),
        tableBlock("4.2.4.1.4", "4.2.x", p(108, "104"), reg(82.954, 410, 330, 185)),
    ], ["4.2.53"], ["4.2.x"]),
];
const targetUnits = units.filter((record) => record.numbering.official === "4.2.4.1.3.1");

const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "4.2-step4b", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map(([n, u, page, latex]) => ({ id: f(n), unitId: uid(u), officialNumber: n, pdfPage: page, latex })), tables: [tableVIII, tableIXa, tableIXb], figures: [] };
await mkdir(unitDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
await mkdir(figureDir, { recursive: true });
await Promise.all([
    ...targetUnits.map((u) => writeFile(join(unitDir, u.numbering.official + ".json"), JSON.stringify(u, null, 2) + "\n", "utf8")),
    writeFile(join(assetDir, "4.2-step4b.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8"),
    copyFile(join(evidenceRenderDir, "page-0106-x108-y160-w86-h82@4x.png"), join(figureDir, "table4.2.viii-laminated-i.png")),
    copyFile(join(evidenceRenderDir, "page-0106-x108-y246-w86-h42@4x.png"), join(figureDir, "table4.2.viii-welded-i.png")),
    copyFile(join(evidenceRenderDir, "page-0106-x108-y291-w86-h47@4x.png"), join(figureDir, "table4.2.viii-hollow.png")),
    copyFile(join(evidenceRenderDir, "page-0106-x108-y342-w86-h64@4x.png"), join(figureDir, "table4.2.viii-welded-box.png")),
    copyFile(join(evidenceRenderDir, "page-0106-x108-y410-w160-h43@4x.png"), join(figureDir, "table4.2.viii-solid-u-t.png")),
    copyFile(join(evidenceRenderDir, "page-0106-x108-y457-w160-h31@4x.png"), join(figureDir, "table4.2.viii-angle.png")),
]);
console.log("NTC 4.2 step4b: aggiornata " + targetUnits.length + " unità, " + formulaRows.length + " formule e 3 tabelle.");
