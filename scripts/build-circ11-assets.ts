/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ11-editorial-profile-0.2.0";
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const assetDir = join(repoRoot, "corpus", "assets", "circ2019");
const figureDir = join(repoRoot, "corpus", "assets", "figures", "circ2019");
const evidenceFigureDir = join(repoRoot, "evidence", sourceId, "renders");

function sha256(value: string | Uint8Array): string {
    return createHash("sha256").update(value).digest("hex");
}

function unitId(number: string): string {
    return `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
}

function assetId(kind: "formula" | "table" | "figure", suffix: string): string {
    return `urn:structural-codes:it:asset:${kind}:circ2019:${suffix.toLowerCase()}`;
}

function loadUnit(number: string): any {
    return JSON.parse(readFileSync(join(unitDir, `${number.toLowerCase()}.json`), "utf8"));
}

function manualTransformations(original: any, note: string): any[] {
    return [
        ...(original.evidence?.transformations ?? []),
        { operation: "manual-correction", ruleVersion: profile, note },
    ];
}

function evidenceFor(original: any, note: string, region: any = null): any {
    return {
        ...original.evidence,
        region,
        transformations: manualTransformations(original, note),
    };
}

function assetReferenceBlock(original: any, kind: string, id: string, note: string, region: any = null): any {
    return {
        blockId: original.blockId,
        kind,
        origin: "official",
        assetId: id,
        evidence: evidenceFor(original, note, region),
    };
}

function inlineText(value: string, terms: Array<[string, string]>): any[] | undefined {
    const matches = terms
        .map(([text, latex]) => ({ text, latex, index: value.indexOf(text) }))
        .filter((entry) => entry.index >= 0)
        .sort((a, b) => a.index - b.index || b.text.length - a.text.length);
    if (!matches.length) return undefined;
    const result: any[] = [];
    let cursor = 0;
    for (const match of matches) {
        if (match.index < cursor) continue;
        if (match.index > cursor) result.push({ kind: "text", value: value.slice(cursor, match.index) });
        result.push({ kind: "math", value: match.text, latex: match.latex });
        cursor = match.index + match.text.length;
    }
    if (cursor < value.length) result.push({ kind: "text", value: value.slice(cursor) });
    return result;
}

function correctedTextBlock(original: any, normalized: string, terms: Array<[string, string]> = []): any {
    const text: any = {
        raw: original.text?.raw ?? normalized,
        normalized,
        normalizationVersion: profile,
    };
    const inline = inlineText(normalized, terms);
    if (inline) text.inline = inline;
    return {
        ...original,
        text,
        evidence: {
            ...original.evidence,
            transformations: manualTransformations(original, "Ripristinati dal render ufficiale simboli, spaziatura e notazione matematica inline."),
            normalizedSha256: sha256(normalized),
        },
    };
}

function appendIssue(unit: any, issueId: string, note: string): void {
    if (!unit.workflow.openIssues.some((issue: any) => issue.issueId === issueId)) {
        unit.workflow.openIssues.push({ issueId, type: "asset-review", severity: "blocking", note });
    }
}

function replaceBlock(unit: any, index: number, id: string, kind: string, note: string, region: any = null, tail?: { normalized: string; terms?: Array<[string, string]> }): void {
    const original = unit.blocks[index];
    if (!original) throw new Error(`Blocco mancante ${unit.numbering.official}#${index}`);
    const replacement = assetReferenceBlock(original, kind, id, note, region);
    unit.blocks.splice(index, 1, replacement);
    if (tail) unit.blocks.splice(index + 1, 0, correctedTextBlock(original, tail.normalized, tail.terms ?? []));
}

function replaceTable(unit: any, index: number, id: string, removeCount: number, note: string): void {
    const original = unit.blocks[index];
    if (!original) throw new Error(`Blocco tabella mancante ${unit.numbering.official}#${index}`);
    unit.blocks.splice(index, removeCount, assetReferenceBlock(original, "table-ref", id, note));
}

function figureReference(unit: any, index: number, id: string, page: number, printedPage: string, region: any, cropSha: string, label: string): any {
    const original = unit.blocks[Math.min(index, unit.blocks.length - 1)];
    return {
        blockId: `${unit.id}#block-editorial-${label}`,
        kind: "figure-ref",
        origin: "official",
        assetId: id,
        evidence: {
            sourceId,
            pdfPage: page,
            printedPage,
            region,
            extraction: { method: "manual-transcription", tool: "poppler-pdf-crop", toolVersion: "core-editorial-profile-0.1.0" },
            transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Ritaglio raster ufficiale verificato sul render completo della pagina." }],
            rawSha256: cropSha,
            normalizedSha256: cropSha,
        },
        ...(original ? {} : {}),
    };
}

function reindexBlocks(unit: any): void {
    unit.blocks.forEach((block: any, index: number) => {
        block.blockId = `${unit.id}#block-${index === 0 ? "heading" : String(index).padStart(3, "0")}`;
    });
    unit.titleBlockId = unit.blocks[0].blockId;
}

const formulas: any[] = [
    { suffix: "c11.9.4.a", unit: "C11.9.4", block: 5, page: 338, latex: "\\xi_e=\\frac{E_d}{2\\pi Fd}=\\frac{E_d}{2\\pi K_e d^2}" },
    { suffix: "c11.9.7.a", unit: "C11.9.7", block: 3, page: 339, latex: "\\sigma_s=1{,}3\\,\\frac{V(t_1+t_2)}{A_r t_s}" },
    { suffix: "c11.9.7.b", unit: "C11.9.7", block: 4, page: 339, latex: "\\gamma_t\\le5" },
    { suffix: "c11.9.7.c", unit: "C11.9.7", block: 5, page: 339, latex: "\\gamma_s\\le\\frac{\\gamma^*}{1{,}5}\\le2" },
    { suffix: "c11.9.7.d", unit: "C11.9.7", block: 13, page: 339, latex: "A_r=(\\varphi-\\sin\\varphi)\\frac{D^2}{4}\\quad\\text{con }\\varphi=2\\arccos\\left(\\frac{d_2}{D}\\right)", tail: "per isolatori circolari di diametro D" },
    { suffix: "c11.9.7.e", unit: "C11.9.7", block: 14, page: 339, latex: "A_r=\\min\\left\\{(b_x-d_{rftx}-d_{Ex})(b_y-d_{rfty}-0{,}3d_{Ey}),\\,(b_x-d_{rftx}-0{,}3d_{Ex})(b_y-d_{rfty}-d_{Ey})\\right\\}", tail: "per isolatori rettangolari di lati b_x e b_y e per" },
    { suffix: "c11.9.7.f", unit: "C11.9.7", block: 17, page: 339, latex: "V_{cr}=G_{din}A_rS_1\\frac{b_{\\min}}{t_e}" },
    { suffix: "c11.9.7.g", unit: "C11.9.7", block: 21, page: 339, latex: "\\gamma_c=1{,}5\\frac{V}{S_1G_{din}A_r}", tail: "è la deformazione di taglio dell’elastomero prodotta dalla compressione;" },
    { suffix: "c11.9.7.h", unit: "C11.9.7", block: 22, page: 339, latex: "\\gamma_s=\\frac{d_2}{t_e}", tail: "è la deformazione di taglio dell’elastomero per lo spostamento sismico totale, inclusi gli effetti torsionali;" },
    { suffix: "c11.9.7.i", unit: "C11.9.7", block: 23, page: 339, latex: "\\gamma_\\alpha=\\frac{a^2}{2t_i t_e}", tail: "è la deformazione di taglio dovuta alla rotazione angolare" },
    { suffix: "c11.9.7.j", unit: "C11.9.7", block: 25, page: 340, latex: "a^2=\\alpha_x b_x^2+\\alpha_y b_y^2", tail: "con α_x ed α_y che rappresentano le rotazioni rispettivamente attorno alle direzioni x ed y nel caso di un isolatore rettangolare;" },
    { suffix: "c11.9.7.k", unit: "C11.9.7", block: 26, page: 340, latex: "a^2=\\frac{3\\alpha D^2}{4}\\quad\\text{con }\\alpha=(\\alpha_x^2+\\alpha_y^2)^{1/2}" },
    { suffix: "c11.9.7.l", unit: "C11.9.7", block: 28, page: 340, latex: "\\gamma_t=\\gamma_c+\\gamma_s+\\gamma_\\alpha", tail: "deformazione di taglio totale di progetto;" },
    { suffix: "c11.9.7.m", unit: "C11.9.7", block: 30, page: 340, latex: "E_c=\\left(\\frac{1}{6G_{din}S_1^2}+\\frac{4}{3E_b}\\right)^{-1}" },
    { suffix: "c11.9.7.n", unit: "C11.9.7", block: 36, page: 340, latex: "d_E=\\max\\left\\{\\left[(d_{Ex}+d_{rftx})^2+(0{,}3d_{Ey}+d_{rfty})^2\\right]^{1/2},\\,\\left[(0{,}3d_{Ex}+d_{rftx})^2+(d_{Ey}+d_{rfty})^2\\right]^{1/2}\\right\\}" },
    { suffix: "c11.10.1.1.1.1.a", unit: "C11.10.1.1.1.1", block: 2, page: 340, latex: "f_{bi}=N/A" },
    { suffix: "c11.10.1.1.1.1.b", unit: "C11.10.1.1.1.1", block: 7, page: 340, latex: "f_{bk}=f_{bm}(1-1{,}64\\delta)" },
    { suffix: "c11.10.1.1.1.1.c", unit: "C11.10.1.1.1.1", block: 10, page: 341, latex: "\\delta=\\frac{s}{f_{bm}}", tail: "= coefficiente di variazione;" },
    { suffix: "c11.10.1.1.1.1.d", unit: "C11.10.1.1.1.1", block: 12, page: 341, latex: "s=\\sqrt{\\frac{\\sum_n(f_{bm}-f_{bi})^2}{n-1}}\\quad(n=\\text{numero degli elementi provati})" },
    { suffix: "c11.10.1.1.1.2.a", unit: "C11.10.1.1.1.2", block: 3, page: 341, latex: "\\overline{f}_{bk}=0{,}7\\,\\overline{f}_{bm}" },
];

const tableC1126 = {
    id: assetId("table", "c11.2.6.i"), unitId: unitId("C11.2.6"), officialNumber: "C11.2.6.I", pdfPage: 323,
    caption: "Fattore di disturbo in funzione della resistenza a compressione delle carote (H/D=1; d=100 mm)", columnCount: 7,
    headers: [[
        { text: "fcarota [N/mm²]", latex: "f_{\\mathrm{carota}}\\ [\\mathrm{N/mm^2}]" },
        { text: "10 ÷ 20", latex: "10\\div20" }, { text: "20 ÷ 25", latex: "20\\div25" }, { text: "25 ÷ 30", latex: "25\\div30" },
        { text: "30 ÷ 35", latex: "30\\div35" }, { text: "35 ÷ 40", latex: "35\\div40" }, { text: "> 40", latex: ">40" },
    ]],
    rows: [[{ text: "Fd", latex: "F_d" }, { text: "1.10" }, { text: "1.09" }, { text: "1.08" }, { text: "1.06" }, { text: "1.04" }, { text: "1.00" }]],
    notes: ["Trascritta e strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
};

const tableC1134112 = {
    id: assetId("table", "c11.3.4.11.2.i"), unitId: unitId("C11.3.4.11.2.1"), officialNumber: "C11.3.4.11.2.I", pdfPage: 331,
    caption: "Tabella C11.3.4.11.2.I", columnCount: 5,
    headers: [[
        { text: "Tipo di acciaio" }, { text: "Norma di riferimento" }, { text: "Qualità degli acciai" },
        { text: "fyk [N/mm²]", latex: "f_{yk}\\ [\\mathrm{N/mm^2}]" }, { text: "ftk [N/mm²]", latex: "f_{tk}\\ [\\mathrm{N/mm^2}]" },
    ]],
    rows: [
        [
            { text: "Nastri e lamiere di acciaio per impieghi strutturali, zincati per immersione a caldo in continuo. Condizioni tecniche di fornitura.", rowSpan: 4 },
            { text: "UNI EN 10326", rowSpan: 4 }, { text: "S 250GD+Z" }, { text: "250" }, { text: "330" },
        ],
        [{ text: "S 280GD+Z" }, { text: "280" }, { text: "360" }],
        [{ text: "S 320GD+Z" }, { text: "320" }, { text: "390" }],
        [{ text: "S 350GD+Z" }, { text: "350" }, { text: "420" }],
        [
            { text: "Prodotti piani laminati a caldo di acciai ad alto limite di snervamento per formatura a freddo. Condizioni di fornitura degli acciai ottenuti mediante laminazione termomeccanica.", rowSpan: 4 },
            { text: "UNI EN 10149-2", rowSpan: 4 }, { text: "S 315 MC" }, { text: "315" }, { text: "390" },
        ],
        [{ text: "S 355 MC" }, { text: "355" }, { text: "430" }],
        [{ text: "S 420 MC" }, { text: "420" }, { text: "480" }],
        [{ text: "S 460 MC" }, { text: "460" }, { text: "520" }],
        [
            { text: "Prodotti piani laminati a caldo di acciai ad alto limite di snervamento per formatura a freddo. Condizioni di fornitura degli acciai normalizzati o laminati normalizzati.", rowSpan: 4 },
            { text: "UNI EN 10149-3", rowSpan: 4 }, { text: "S 260 NC" }, { text: "260" }, { text: "370" },
        ],
        [{ text: "S 315 NC" }, { text: "315" }, { text: "430" }],
        [{ text: "S 355 NC" }, { text: "355" }, { text: "470" }],
        [{ text: "S 420 NC" }, { text: "420" }, { text: "530" }],
    ],
    notes: ["Trascritta e strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
};

const figureSpecs = [
    {
        suffix: "c11.3.2.10.4.a", unit: "C11.3.2.10.4", officialNumber: "C11.3.2.10.4-a", page: 329, printedPage: "325",
        source: "page-0329-x190-y270-w240-h95@3x.png", target: "c11.3.2.10.4-a.png", cropSha: "9ed52eec5dc26756d579711dfa6ae9710e15500da56320e3f721c3a844bf6d05",
        region: { coordinateSystem: "pdf-points-top-left", x: 190, y: 270, width: 240, height: 95 }, label: "figure-a",
        caption: "Schema non numerato della barra di acciaio nervato e della sezione effettiva circolare.",
        alt: "Schema ufficiale della barra di acciaio nervato con sezione effettiva circolare e dettaglio A-B.",
    },
    {
        suffix: "c11.3.2.10.4.b", unit: "C11.3.2.10.4", officialNumber: "C11.3.2.10.4-b", page: 329, printedPage: "325",
        source: "page-0329-x190-y410-w220-h90@3x.png", target: "c11.3.2.10.4-b.png", cropSha: "8452e2de1bab95be5a5aa3497247460d3799c415b633276c20c8b767195e8a5a",
        region: { coordinateSystem: "pdf-points-top-left", x: 190, y: 410, width: 220, height: 90 }, label: "figure-b",
        caption: "Schema non numerato della barra di acciaio dentellato e della sezione effettiva approssimativamente triangolare.",
        alt: "Schema ufficiale della barra di acciaio dentellato con sezione effettiva approssimativamente triangolare.",
    },
];

const affectedUnits = new Map<string, any>();
for (const number of new Set([...formulas.map((formula) => formula.unit), "C11.2.6", "C11.3.4.11.2.1", "C11.3.2.10.4"])) affectedUnits.set(number, loadUnit(number));

const inlineCorrections: Array<[string, number, string, Array<[string, string]>]> = [
    ["C11.9.4", 2, "La linearità della risposta si riscontra accertando che il coefficiente di smorzamento viscoso equivalente sia minore del 15% e che lo scarto tra la rigidezza iniziale K_in, valutata come la rigidezza secante tra i valori corrispondenti al 10% ed il 20% della forza di progetto, e la rigidezza equivalente K_e, valutata come pendenza della secante tra i punti di massimo spostamento positivo e", [["K_in", "K_{in}"], ["K_e", "K_e"]]],
    ["C11.9.4", 3, "negativo in un ciclo completo, sia minore del 20% della rigidezza K_in (per i dispositivi a comportamento lineare la rigidezza del primo tratto K_1 può essere assunta pari a K_in).", [["K_in", "K_{in}"], ["K_1", "K_1"]]],
    ["C11.9.4", 7, "- d è lo spostamento massimo raggiunto dal dispositivo in un ciclo di carico;", [["d", "d"]]],
    ["C11.9.4", 8, "- F è la forza massima raggiunta dal dispositivo in un ciclo di carico;", [["F", "F"]]],
    ["C11.9.4", 9, "- E_d è l’energia dissipata da un dispositivo in un ciclo completo di carico, ossia l’area racchiusa dal ciclo di carico in un diagramma forza-spostamento.", [["E_d", "E_d"]]],
    ["C11.9.7", 2, "la tensione massima σ_s agente nella generica piastra in acciaio sia non maggiore di", [["σ_s", "\\sigma_s"]]],
    ["C11.9.7", 6, "Il carico massimo verticale agente sul singolo isolatore dovrà essere inferiore al carico critico V_cr diviso per un coefficiente di", [["V_cr", "V_{cr}"]]],
    ["C11.9.7", 9, "t_1 e t_2 sono gli spessori dei due strati di elastomero direttamente a contatto con la piastra; t_s è il suo spessore (t_s ≥", [["t_1", "t_1"], ["t_2", "t_2"], ["t_s", "t_s"], ["≥", "\\ge"]]],
    ["C11.9.7", 10, "2 mm), deve risultare inferiore alla tensione di snervamento dell’acciaio f_yk.", [["f_yk", "f_{yk}"]]],
    ["C11.9.7", 11, "γ^* è il valore massimo della deformazione di taglio raggiunto nelle prove di qualificazione relative all’efficacia dell’aderenza elastomero-acciaio, senza segni di rottura.", [["γ^*", "\\gamma^*"]]],
    ["C11.9.7", 12, "A_r è l’area ridotta efficace dell’isolatore calcolata come:", [["A_r", "A_r"]]],
    ["C11.9.7", 15, "uno spostamento relativo tra le due facce (superiore e inferiore) degli isolatori, prodotti dall’azione sismica agente nelle direzioni x ed y (d_{Ex}, d_{Ey})", [["d_{Ex}", "d_{Ex}"], ["d_{Ey}", "d_{Ey}"]]],
    ["C11.9.7", 16, "V_cr è il carico critico calcolato come:", [["V_cr", "V_{cr}"]]],
    ["C11.9.7", 18, "dove:", []],
    ["C11.9.7", 19, "b_min = min(b_x, b_y) per isolatori rettangolari", [["b_min", "b_{\\min}"], ["b_x", "b_x"], ["b_y", "b_y"]]],
    ["C11.9.7", 20, "b_min = D per isolatori circolari.", [["b_min", "b_{\\min}"]]],
    ["C11.9.7", 27, "nel caso di un isolatore circolare", []],
    ["C11.9.7", 32, "G_{din} modulo di taglio dinamico dell’elastomero;", [["G_{din}", "G_{din}"]]],
    ["C11.9.7", 33, "E_b modulo di compressibilità volumetrica della gomma, da assumere pari a 2000 MPa in assenza di determinazione diretta;", [["E_b", "E_b"]]],
    ["C11.9.7", 34, "d_{rftx}, d_{rfty} spostamenti relativi tra le due facce (superiore e inferiore) degli isolatori, prodotti dalle azioni di ritiro, fluage e", [["d_{rftx}", "d_{rftx}"], ["d_{rfty}", "d_{rfty}"]]],
    ["C11.10.1.1.1", 1, "La procedura di controllo di accettazione in cantiere prevede il confronto (tramite disuguaglianze) delle resistenze a compressione valutate sui campioni pervenuti in cantiere con la resistenza media a compressione, f_bm, fornita dal produttore oppure, nel caso che il fabbricante non abbia dichiarato la resistenza media ma la sola resistenza caratteristica, f_bk, con quest’ultima. La valutazione di quest’ultima è funzionale, inoltre, anche all’impiego delle tabelle 11.10.VI, 11.10.VII e 11.10.VIII delle NTC, utili alla stima rispettivamente della resistenza caratteristica a compressione e taglio della muratura.", [["f_bm", "f_{bm}"], ["f_bk", "f_{bk}"]]],
    ["C11.10.1.1.1", 2, "È opportuno riportare, dunque, alcune indicazioni utili per la valutazione di f_bk.", [["f_bk", "f_{bk}"]]],
    ["C11.10.1.1.1.1", 4, "N = carico di rottura applicato in direzione ortogonale al piano di posa;", [["N", "N"]]],
    ["C11.10.1.1.1.1", 5, "A = area lorda della sezione normale alla direzione di carico.", [["A", "A"]]],
    ["C11.10.1.1.1.1", 6, "Il valore della resistenza caratteristica f_bk si ricava dalla formula seguente, applicata ad un numero minimo di 30 elementi:", [["f_bk", "f_{bk}"]]],
    ["C11.10.1.1.1.1", 9, "f_bm = media aritmetica della resistenza dei singoli elementi f_bi;", [["f_bm", "f_{bm}"], ["f_bi", "f_{bi}"]]],
    ["C11.10.1.1.1.1", 10, "coefficiente di variazione;", []],
    ["C11.10.1.1.1.1", 11, "s = stima dello scarto quadratico medio;", [["s", "s"]]],
    ["C11.10.1.1.1.1", 13, "Il valore della f_bk non è accettabile se δ > 0.2", [["f_bk", "f_{bk}"], ["δ", "\\delta"], [">", ">"]]],
    ["C11.10.1.1.1.2", 2, "La resistenza caratteristica a compressione in direzione ortogonale ai carichi verticali e nel piano della muratura (richiamata nel § 7.8.1.2. delle NTC ed ivi contraddistinta dal simbolo f_bk) sarà dedotta da quella media f_bm mediante la relazione:", [["f_bk", "f_{bk}"], ["f_bm", "f_{bm}"]]],
    ["C11.10.1.1.1.2", 4, "in cui la resistenza media f_bm sarà ricavata da prove su almeno sei campioni.", [["f_bm", "f_{bm}"]]],
];

for (const [number, index, normalized, terms] of inlineCorrections) {
    const unit = affectedUnits.get(number) ?? loadUnit(number);
    affectedUnits.set(number, unit);
    unit.blocks[index] = correctedTextBlock(unit.blocks[index], normalized, terms);
}

for (const formula of [...formulas].sort((a, b) => a.unit.localeCompare(b.unit) || b.block - a.block)) {
    const unit = affectedUnits.get(formula.unit)!;
    const id = assetId("formula", formula.suffix);
    replaceBlock(unit, formula.block, id, "formula-ref", "Formula in display trascritta dal render ufficiale; revisione umana indipendente ancora obbligatoria.", null, formula.tail ? { normalized: formula.tail } : undefined);
    unit.assets.formulaIds.push(id);
    appendIssue(unit, `${formula.unit.toLowerCase().replaceAll(".", "-")}-${formula.suffix.split(".").at(-1)}-asset-review`, "Formula collegata a un asset canonico; verificare nuovamente ogni glifo nel PDF prima della pubblicazione.");
}

const c1126Unit = affectedUnits.get("C11.2.6")!;
replaceTable(c1126Unit, 15, tableC1126.id, 3, "Tabella strutturata dal render ufficiale; le righe estratte sono state sostituite dal riferimento asset per evitare duplicazioni.");
c1126Unit.assets.tableIds.push(tableC1126.id);
appendIssue(c1126Unit, "c11-2-6-table-asset-review", "Verificare cella per cella la tabella C11.2.6.I nel PDF ufficiale.");

const c1134112Unit = affectedUnits.get("C11.3.4.11.2.1")!;
replaceTable(c1134112Unit, 7, tableC1134112.id, 14, "Tabella strutturata dal render ufficiale; le righe estratte sono state sostituite dal riferimento asset per evitare duplicazioni.");
c1134112Unit.assets.tableIds.push(tableC1134112.id);
appendIssue(c1134112Unit, "c11-3-4-11-2-1-table-asset-review", "Verificare cella per cella la tabella C11.3.4.11.2.I nel PDF ufficiale.");

const figureAssets: any[] = [];
const c1132104Unit = affectedUnits.get("C11.3.2.10.4")!;
for (const spec of figureSpecs) {
    await mkdir(figureDir, { recursive: true });
    await copyFile(join(evidenceFigureDir, spec.source), join(figureDir, spec.target));
    const id = assetId("figure", spec.suffix);
    figureAssets.push({ id, unitId: unitId(spec.unit), officialNumber: spec.officialNumber, pdfPage: spec.page, caption: spec.caption, alt: spec.alt, imagePath: `figures/circ2019/${spec.target}`, region: spec.region, sha256: spec.cropSha });
    const ref = figureReference(c1132104Unit, spec.label === "figure-a" ? 5 : 6, id, spec.page, spec.printedPage, spec.region, spec.cropSha, spec.label);
    const insertionIndex = spec.label === "figure-a" ? 5 : 6;
    c1132104Unit.blocks.splice(insertionIndex, 0, ref);
    c1132104Unit.assets.figureIds.push(id);
}
appendIssue(c1132104Unit, "c11-3-2-10-4-figure-asset-review", "Schemi non numerati ritagliati dal PDF ufficiale; verificare completezza del crop e posizione nel flusso editoriale.");

for (const unit of affectedUnits.values()) {
    unit.assets.formulaIds = [...new Set(unit.assets.formulaIds)];
    unit.assets.tableIds = [...new Set(unit.assets.tableIds)];
    unit.assets.figureIds = [...new Set(unit.assets.figureIds)];
    reindexBlocks(unit);
    await writeFile(join(unitDir, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C11-step2", sourceId,
    status: "transcribed-unreviewed", formulas: formulas.map((formula) => ({ id: assetId("formula", formula.suffix), unitId: unitId(formula.unit), officialNumber: null, pdfPage: formula.page, latex: formula.latex })),
    tables: [tableC1126, tableC1134112], figures: figureAssets,
};
await mkdir(assetDir, { recursive: true });
await writeFile(join(assetDir, "C11-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ11-step2: updated ${affectedUnits.size} units, ${formulas.length} formulas, 2 tables, ${figureAssets.length} figures`);
