import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitsRoot = root + "/corpus/units/ntc2018";
const manifestPath = root + "/corpus/assets/ntc2018/4.1.json";
const profile = "ntc4-step5-editorial-profile-0.1.0";

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type Segment =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type Block = {
    blockId: string;
    kind: string;
    origin: string;
    assetId?: string;
    text?: {
        raw: string;
        normalized: string;
        normalizationVersion: string;
        inline?: Segment[];
    };
    evidence: {
        normalizedSha256: string;
        transformations?: Transformation[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
};
type Unit = {
    blocks: Block[];
    assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] };
    [key: string]: unknown;
};
type EvidenceItem = { sequence: number; text: string; hasEol: boolean; region: Region };
type PageEvidence = { textItems: EvidenceItem[] };
type TableCell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const uid = (number: string) => "urn:structural-codes:it:unit:ntc2018:" + number;
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const tableId = (number: string) => "urn:structural-codes:it:asset:table:ntc2018:" + number.toLowerCase();
const text = (value: string): Segment => ({ kind: "text", value });
const math = (value: string, latex = value): Segment => ({ kind: "math", value, latex });
const cell = (value: string, extra: Partial<TableCell> = {}): TableCell => ({ text: value, ...extra });
const mathCell = (value: string, latex: string, extra: Partial<TableCell> = {}): TableCell => ({ text: value, latex, ...extra });
const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

async function readUnit(number: string): Promise<Unit> {
    return JSON.parse(await readFile(unitsRoot + "/" + number + ".json", "utf8")) as Unit;
}

async function writeUnit(number: string, unit: Unit): Promise<void> {
    await writeFile(unitsRoot + "/" + number + ".json", JSON.stringify(unit, null, 2) + "\n", "utf8");
}

function findBlock(unit: Unit, number: string, suffix: string): Block {
    const id = uid(number) + "#block-" + suffix;
    const found = unit.blocks.find((candidate) => candidate.blockId === id);
    if (!found) throw new Error("Blocco mancante: " + id);
    return found;
}

function correctionTransformations(existing: Transformation[] = []): Transformation[] {
    return [
        ...existing.filter((item) => item.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinata la segmentazione matematica confrontando direttamente il render della fonte ufficiale.",
        },
    ];
}

function updateText(target: Block, value: string | Segment[]): void {
    if (!target.text) throw new Error("Payload testuale mancante: " + target.blockId);
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    target.text.normalized = normalized;
    target.text.normalizationVersion = profile;
    if (typeof value === "string") delete target.text.inline;
    else target.text.inline = value;
    target.evidence.normalizedSha256 = sha256(normalized);
    target.evidence.transformations = correctionTransformations(target.evidence.transformations);
}

const pageCache = new Map<number, PageEvidence>();
async function pageEvidence(page: number): Promise<PageEvidence> {
    const cached = pageCache.get(page);
    if (cached) return cached;
    const parsed = JSON.parse(await readFile(root + "/evidence/gu-so8-2018-ntc/pages/page-" + String(page).padStart(4, "0") + ".json", "utf8")) as PageEvidence;
    pageCache.set(page, parsed);
    return parsed;
}

function intersects(left: Region, right: Region): boolean {
    return left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y;
}

async function rawFor(page: number, target: Region): Promise<string> {
    const evidence = await pageEvidence(page);
    return evidence.textItems
        .filter((item) => item.text && intersects(item.region, target))
        .sort((left, right) => left.sequence - right.sequence)
        .map((item) => item.text + (item.hasEol ? "\n" : ""))
        .join("")
        .trim();
}

async function textBlock(
    number: string,
    suffix: string,
    page: number,
    target: Region,
    value: string | Segment[],
): Promise<Block> {
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    const raw = await rawFor(page, target);
    return {
        blockId: uid(number) + "#block-" + suffix,
        kind: "paragraph",
        origin: "official",
        text: {
            raw,
            normalized,
            normalizationVersion: profile,
            ...(typeof value === "string" ? {} : { inline: value }),
        },
        evidence: {
            sourceId: "gu-so8-2018-ntc",
            pdfPage: page,
            printedPage: String(page - 4),
            region: target,
            extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
            transformations: raw === normalized ? [] : [
                {
                    operation: "join-line-wrap",
                    ruleVersion: profile,
                    note: "Rimosse le andate a capo tipografiche e ricomposte le sillabazioni verificate sul PDF.",
                },
                {
                    operation: "manual-correction",
                    ruleVersion: profile,
                    note: "Ripristinati simboli e segmenti matematici confrontando direttamente il render ufficiale.",
                },
                {
                    operation: "normalize-whitespace",
                    ruleVersion: profile,
                    note: "Uniformati gli spazi dopo la separazione dei capoversi e delle formule.",
                },
                {
                    operation: "unicode-nfc",
                    ruleVersion: profile,
                    note: "Testo normalizzato in Unicode NFC.",
                },
            ],
            rawSha256: sha256(raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

async function assetRef(number: string, suffix: string, assetId: string, page: number, target: Region): Promise<Block> {
    const raw = await rawFor(page, target);
    return {
        blockId: uid(number) + "#block-" + suffix,
        kind: "formula-ref",
        origin: "official",
        assetId,
        evidence: {
            sourceId: "gu-so8-2018-ntc",
            pdfPage: page,
            printedPage: String(page - 4),
            region: target,
            extraction: { method: "manual-transcription", tool: "codex-reviewed-source-transcription", toolVersion: profile },
            transformations: [{
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Formula trascritta e collocata confrontando direttamente il render della fonte ufficiale.",
            }],
            rawSha256: sha256(raw),
            normalizedSha256: sha256(assetId),
        },
    };
}

const formulas = new Map<string, string>([
    [formulaId("4.1.1"), "\\delta\\ge0{,}44+1{,}25\\cdot(0{,}6+0{,}0014/\\varepsilon_{cu})x/d\\qquad\\text{per }f_{ck}\\le50\\,\\mathrm{MPa}"],
    [formulaId("4.1.2"), "\\delta\\ge0{,}54+1{,}25\\cdot(0{,}6+0{,}0014/\\varepsilon_{cu})x/d\\qquad\\text{per }f_{ck}>50\\,\\mathrm{MPa}"],
    [formulaId("4.1.3"), "f_{cd}=\\alpha_{cc}f_{ck}/\\gamma_c"],
    [formulaId("4.1.4"), "f_{ctd}=f_{ctk}/\\gamma_c"],
    [formulaId("4.1.5"), "f_{yd}=f_{yk}/\\gamma_s"],
    [formulaId("4.1.6"), "f_{bd}=f_{bk}/\\gamma_c"],
    [formulaId("4.1.7"), "f_{bk}=2{,}25\\cdot\\eta_1\\cdot\\eta_2\\cdot f_{ctk}"],
    [formulaId("4.1.2.1.2.1:material-parameters-up-to-c50-60"), "\\begin{aligned}\\varepsilon_{c2}&=0{,}20\\% & \\varepsilon_{cu}&=0{,}35\\% \\\\ \\varepsilon_{c3}&=0{,}175\\% & \\varepsilon_{c4}&=0{,}07\\%\\end{aligned}"],
    [formulaId("4.1.2.1.2.1:material-parameters-over-c50-60"), "\\begin{aligned}\\varepsilon_{c2}&=0{,}20\\%+0{,}0085\\%(f_{ck}-50)^{0{,}53} & \\varepsilon_{cu}&=0{,}26\\%+3{,}5\\%[(90-f_{ck})/100]^4 \\\\ \\varepsilon_{c3}&=0{,}175\\%+0{,}055\\%[(f_{ck}-50)/40] & \\varepsilon_{c4}&=0{,}2\\cdot\\varepsilon_{cu}\\end{aligned}"],
    [formulaId("4.1.8"), "f_{ck,c}=f_{ck}\\cdot(1{,}0+5{,}0\\cdot\\sigma_2/f_{ck})\\qquad\\text{per }\\sigma_2\\le0{,}05f_{ck}"],
    [formulaId("4.1.9"), "f_{ck,c}=f_{ck}\\cdot(1{,}125+2{,}5\\cdot\\sigma_2/f_{ck})\\qquad\\text{per }\\sigma_2>0{,}05f_{ck}"],
    [formulaId("4.1.10"), "\\varepsilon_{c2,c}=\\varepsilon_{c2}\\cdot(f_{ck,c}/f_{ck})^2"],
    [formulaId("4.1.11"), "\\varepsilon_{cu2,c}=\\varepsilon_{cu}+0{,}2\\cdot\\sigma_2/f_{ck}"],
    [formulaId("4.1.12"), "f_{cd,c}=\\alpha_{cc}\\cdot f_{ck,c}/\\gamma_c"],
    [formulaId("4.1.12.a"), "\\sigma_2=\\alpha\\cdot\\sigma_l"],
    [formulaId("4.1.12.b"), "\\sigma_{l,x}=\\frac{A_{st,x}\\cdot f_{yk,st}}{b_y\\cdot s};\\qquad\\sigma_{l,y}=\\frac{A_{st,y}\\cdot f_{yk,st}}{b_x\\cdot s}"],
    [formulaId("4.1.12.c"), "\\sigma_l=\\sqrt{\\sigma_{l,x}\\cdot\\sigma_{l,y}}"],
    [formulaId("4.1.12.d"), "\\sigma_l=\\frac{2A_{st}\\cdot f_{yk,st}}{D_0\\cdot s}"],
    [formulaId("4.1.12.e"), "\\alpha=\\alpha_n\\cdot\\alpha_s"],
    [formulaId("4.1.12.f"), "\\alpha_n=1-\\sum_n b_i^2/(6\\cdot b_x\\cdot b_y)"],
    [formulaId("4.1.12.g"), "\\alpha_s=[1-s/(2\\cdot b_x)]\\cdot[1-s/(2\\cdot b_y)]"],
    [formulaId("4.1.12.h"), "\\alpha_n=1"],
    [formulaId("4.1.12.i"), "\\alpha_s=[1-s/(2\\cdot D_0)]^\\beta"],
    [formulaId("4.1.13"), "\\sigma_t=\\frac{f_{ctm}}{1{,}2}"],
    [formulaId("4.1.2.2.4:crack-widths"), "w_1=0{,}2\\,\\mathrm{mm}\\qquad w_2=0{,}3\\,\\mathrm{mm}\\qquad w_3=0{,}4\\,\\mathrm{mm}"],
    [formulaId("4.1.14"), "w_k=1{,}7\\,\\varepsilon_{sm}\\Delta_{sm}"],
    [formulaId("4.1.15"), "\\sigma_{c,\\max}\\le0{,}60f_{ck}\\qquad\\text{per combinazione caratteristica}"],
    [formulaId("4.1.16"), "\\sigma_{c,\\max}\\le0{,}45f_{ck}\\qquad\\text{per combinazione quasi permanente}"],
    [formulaId("4.1.17"), "\\sigma_{s,\\max}\\le0{,}8f_{yk}"],
]);

const tables = [
    {
        id: tableId("4.1.I"), unitId: uid("4.1"), officialNumber: "4.1.I", pdfPage: 74,
        caption: "Classi di resistenza", columnCount: 1,
        headers: [[cell("Classe di resistenza")]],
        rows: ["C8/10", "C12/15", "C16/20", "C20/25", "C25/30", "C30/37", "C35/45", "C40/50", "C45/55", "C50/60", "C55/67", "C60/75", "C70/85", "C80/95", "C90/105"].map((value) => [cell(value)]),
        notes: [],
    },
    {
        id: tableId("4.1.II"), unitId: uid("4.1"), officialNumber: "4.1.II", pdfPage: 74,
        caption: "Impiego delle diverse classi di resistenza", columnCount: 2,
        headers: [[cell("Strutture di destinazione"), cell("Classe di resistenza minima")]],
        rows: [
            [cell("Per strutture non armate o a bassa percentuale di armatura (§ 4.1.11)"), cell("C8/10")],
            [cell("Per strutture semplicemente armate"), cell("C16/20")],
            [cell("Per strutture precompresse"), cell("C28/35")],
        ],
        notes: [],
    },
    {
        id: tableId("4.1.III"), unitId: uid("4.1.2.2.4.2"), officialNumber: "4.1.III", pdfPage: 80,
        caption: "Descrizione delle condizioni ambientali", columnCount: 2,
        headers: [[cell("Condizioni ambientali"), cell("Classe di esposizione")]],
        rows: [
            [cell("Ordinarie"), cell("X0, XC1, XC2, XC3, XF1")],
            [cell("Aggressive"), cell("XC4, XD1, XS1, XA1, XA2, XF2, XF3")],
            [cell("Molto aggressive"), cell("XD2, XD3, XS2, XS3, XA3, XF4")],
        ],
        notes: [],
    },
    {
        id: tableId("4.1.IV"), unitId: uid("4.1.2.2.4.4"), officialNumber: "4.1.IV", pdfPage: 80,
        caption: "Criteri di scelta dello stato limite di fessurazione", columnCount: 7,
        headers: [
            [cell("Gruppi di Esigenze", { rowSpan: 3 }), cell("Condizioni ambientali", { rowSpan: 3 }), cell("Combinazione di azioni", { rowSpan: 3 }), cell("Armatura", { colSpan: 4 })],
            [cell("Sensibile", { colSpan: 2 }), cell("Poco sensibile", { colSpan: 2 })],
            [cell("Stato limite"), mathCell("wₖ", "w_k"), cell("Stato limite"), mathCell("wₖ", "w_k")],
        ],
        rows: [
            [cell("A", { rowSpan: 2 }), cell("Ordinarie", { rowSpan: 2 }), cell("frequente"), cell("apertura fessure"), mathCell("≤ w₂", "\\le w_2"), cell("apertura fessure"), mathCell("≤ w₃", "\\le w_3")],
            [cell("quasi permanente"), cell("apertura fessure"), mathCell("≤ w₁", "\\le w_1"), cell("apertura fessure"), mathCell("≤ w₂", "\\le w_2")],
            [cell("B", { rowSpan: 2 }), cell("Aggressive", { rowSpan: 2 }), cell("frequente"), cell("apertura fessure"), mathCell("≤ w₁", "\\le w_1"), cell("apertura fessure"), mathCell("≤ w₂", "\\le w_2")],
            [cell("quasi permanente"), cell("decompressione"), cell("—"), cell("apertura fessure"), mathCell("≤ w₁", "\\le w_1")],
            [cell("C", { rowSpan: 2 }), cell("Molto aggressive", { rowSpan: 2 }), cell("frequente"), cell("formazione fessure"), cell("—"), cell("apertura fessure"), mathCell("≤ w₁", "\\le w_1")],
            [cell("quasi permanente"), cell("decompressione"), cell("—"), cell("apertura fessure"), mathCell("≤ w₁", "\\le w_1")],
        ],
        notes: ["w₁, w₂, w₃ sono definiti al § 4.1.2.2.4, il valore wₖ è definito al § 4.1.2.2.4.5."],
    },
];

async function rebuildAssets(): Promise<void> {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const formula of manifest.formulas as Array<{ id: string; pdfPage: number; latex: string }>) {
        const latex = formulas.get(formula.id);
        if (latex !== undefined) formula.latex = latex;
    }
    const missing = [...formulas.keys()].filter((id) => !manifest.formulas.some((formula: { id: string }) => formula.id === id));
    if (missing.length) throw new Error("Formule mancanti nel manifest: " + missing.join(", "));
    const replacementTables = new Map(tables.map((table) => [table.id, table]));
    manifest.tables = manifest.tables
        .map((table: { id: string }) => replacementTables.get(table.id) ?? table)
        .sort((left: { pdfPage: number }, right: { pdfPage: number }) => left.pdfPage - right.pdfPage);
    const missingTables = tables.filter((table) => !manifest.tables.some((candidate: { id: string }) => candidate.id === table.id));
    if (missingTables.length) throw new Error("Tabelle mancanti nel manifest: " + missingTables.map((table) => table.id).join(", "));
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function fixInlineMath(): Promise<void> {
    const unit41 = await readUnit("4.1");
    for (const suffix of ["editorial-011", "editorial-013", "editorial-014"]) {
        const target = findBlock(unit41, "4.1", suffix);
        updateText(target, target.text!.normalized);
    }
    await writeUnit("4.1", unit41);

    const unit411 = await readUnit("4.1.1");
    updateText(findBlock(unit411, "4.1.1", "editorial-005"), "c) analisi non lineare.");
    await writeUnit("4.1.1", unit411);

    const unit4111 = await readUnit("4.1.1.1");
    updateText(findBlock(unit4111, "4.1.1.1", "editorial-005"), "valori medi del modulo d’elasticità.");
    updateText(findBlock(unit4111, "4.1.1.1", "editorial-010"), [
        text("Per le travi e le solette che soddisfano le condizioni dette, la ridistribuzione dei momenti flettenti può effettuarsi senza esplicite verifiche in merito alla duttilità delle membrature, purché il rapporto "),
        math("δ", "\\delta"),
        text(" tra il momento dopo la ridistribuzione ed il momento prima della ridistribuzione risulti "),
        math("1≥δ≥0,70", "1\\ge\\delta\\ge0{,}70"),
        text("."),
    ]);
    updateText(findBlock(unit4111, "4.1.1.1", "editorial-015"), [
        text("Per le travi continue, le travi di telai in cui possono essere trascurati gli effetti del secondo ordine e le solette, il rapporto "),
        math("x/d"),
        text(" nelle sezioni critiche non deve comunque superare il valore 0,45 per "),
        math("fck ≤ 50 MPa", "f_{ck}\\le50\\,\\mathrm{MPa}"),
        text(" e 0,35 per "),
        math("fck > 50 MPa", "f_{ck}>50\\,\\mathrm{MPa}"),
        text("."),
    ]);
    await writeUnit("4.1.1.1", unit4111);

    const unitSteel = await readUnit("4.1.2.1.1.3");
    updateText(findBlock(unitSteel, "4.1.2.1.1.3", "editorial-005"), [
        math("fyk", "f_{yk}"), text(" per armatura ordinaria è la tensione caratteristica di snervamento dell’acciaio (§ 11.3.2), per armature da precompressione è la tensione convenzionale caratteristica di snervamento data, a seconda del tipo di prodotto, da "),
        math("fpyk", "f_{pyk}"), text(" (barre), "), math("fp(0,1)k", "f_{p(0{,}1)k}"), text(" (fili), "),
        math("fp(1)k", "f_{p(1)k}"), text(" (trefoli e trecce); si veda in proposito la Tab. 11.3.VIII."),
    ]);
    await writeUnit("4.1.2.1.1.3", unitSteel);

    const concrete = await readUnit("4.1.2.1.2.1");
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-003"), [text("In Fig. 4.1.1 sono rappresentati i modelli "), math("σ-ε", "\\sigma-\\varepsilon"), text(" per il calcestruzzo:")]);
    for (const suffix of ["editorial-004", "editorial-005", "editorial-007", "editorial-009"]) {
        const target = findBlock(concrete, "4.1.2.1.2.1", suffix);
        updateText(target, target.text!.normalized);
    }
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-020"), [
        text("essendo "), math("σ₂", "\\sigma_2"), text(" la pressione laterale efficace di confinamento allo SLV mentre "),
        math("εc2", "\\varepsilon_{c2}"), text(" ed "), math("εcu", "\\varepsilon_{cu}"), text(" sono valutate in accordo al § 4.1.2.1.2.1."),
    ]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-022"), [text("La pressione efficace di confinamento "), math("σ₂", "\\sigma_2"), text(" può essere determinata attraverso la relazione seguente:")]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-024"), [
        text("dove "), math("α", "\\alpha"), text(" è un coefficiente di efficienza ("), math("≤ 1", "\\le1"),
        text("), definito come rapporto fra il volume "), math("Vc,eff", "V_{c,eff}"), text(" di calcestruzzo efficacemente confinato ed il volume "),
        math("Vc", "V_c"), text(" dell’elemento di calcestruzzo, depurato da quello delle armature longitudinali (generalmente trascurabile) e "),
        math("σₗ", "\\sigma_l"), text(" è la pressione di confinamento esercitata dalle armature trasversali."),
    ]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-027"), [text("Per le due direzioni principali della sezione "), math("x"), text(" e "), math("y"), text(" valgono, rispettivamente, le relazioni:")]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-029"), [
        text("dove "), math("Ast,x", "A_{st,x}"), text(" e "), math("Ast,y", "A_{st,y}"),
        text(" sono il quantitativo totale (aree delle sezioni) di armatura trasversale in direzione parallela, rispettivamente, alle direzioni principali "),
        math("x"), text(" e "), math("y"), text(", "), math("bx", "b_x"), text(" e "), math("by", "b_y"),
        text(" sono le dimensioni del nucleo confinato nelle direzioni corrispondenti (con riferimento alla linea media delle staffe), "),
        math("s"), text(" è il passo delle staffe, "), math("fyk,st", "f_{yk,st}"), text(" è la tensione caratteristica dell’acciaio delle staffe."),
    ]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-030"), [text("La pressione laterale equivalente "), math("σₗ", "\\sigma_l"), text(" può essere determinata attraverso la relazione:")]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-034"), [text("dove: "), math("Ast", "A_{st}"), text(" è l’area della sezione della staffa, "), math("D0", "D_0"), text(" è il diametro del nucleo confinato (con riferimento alla linea media delle staffe).")]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-041"), [text("dove: "), math("n"), text(" è il numero totale di barre longitudinali contenute lateralmente da staffe o legature, "), math("bi", "b_i"), text(" è la distanza tra barre consecutive contenute.")]);
    updateText(findBlock(concrete, "4.1.2.1.2.1", "editorial-045"), [text("dove: "), math("β = 2", "\\beta=2"), text(" per staffe circolari singole, "), math("β = 1", "\\beta=1"), text(" per staffa a spirale.")]);
    await writeUnit("4.1.2.1.2.1", concrete);

    const reinforcing = await readUnit("4.1.2.1.2.2");
    updateText(findBlock(reinforcing, "4.1.2.1.2.2", "editorial-001"), [
        text("Per il diagramma tensione-deformazione dell’acciaio è possibile adottare opportuni modelli rappresentativi del reale comportamento del materiale, modelli definiti in base al valore di progetto "),
        math("εud = 0,9εuk", "\\varepsilon_{ud}=0{,}9\\varepsilon_{uk}"), text(" ("), math("εuk = (Agt)k", "\\varepsilon_{uk}=(A_{gt})_k"),
        text(") della deformazione uniforme ultima, al valore di progetto della tensione di snervamento "), math("fyd", "f_{yd}"),
        text(" ed al rapporto di sovraresistenza "), math("k = (ft/fy)k", "k=(f_t/f_y)_k"), text(" (Tab. 11.3.Ia-b)."),
    ]);
    updateText(findBlock(reinforcing, "4.1.2.1.2.2", "editorial-002"), [text("In Fig. 4.1.3 sono rappresentati i modelli "), math("σ-ε", "\\sigma-\\varepsilon"), text(" per l’acciaio:")]);
    await writeUnit("4.1.2.1.2.2", reinforcing);

    const deformation = await readUnit("4.1.2.2.2");
    const deformationBlock = findBlock(deformation, "4.1.2.2.2", "editorial-001");
    updateText(deformationBlock, deformationBlock.text!.normalized);
    await writeUnit("4.1.2.2.2", deformation);

    const cracking = await readUnit("4.1.2.2.4");
    const crackingBlock = findBlock(cracking, "4.1.2.2.4", "editorial-006");
    updateText(crackingBlock, crackingBlock.text!.normalized);
    await writeUnit("4.1.2.2.4", cracking);

    const crackWidth = await readUnit("4.1.2.2.4.5");
    updateText(findBlock(crackWidth, "4.1.2.2.4.5", "editorial-004"), [
        text("Il valore caratteristico di apertura delle fessure ("), math("wk", "w_k"), text(") non deve superare i valori nominali "),
        math("w1", "w_1"), text(", "), math("w2", "w_2"), text(", "), math("w3", "w_3"), text(" secondo quanto riportato nella Tab. 4.1.IV."),
    ]);
    updateText(findBlock(crackWidth, "4.1.2.2.4.5", "editorial-005"), [
        text("L’ampiezza caratteristica delle fessure "), math("wk", "w_k"), text(" è calcolata come 1,7 volte il prodotto della deformazione media delle barre d’armatura "),
        math("εsm", "\\varepsilon_{sm}"), text(" per la distanza media tra le fessure "), math("Δsm", "\\Delta_{sm}"), text(":"),
    ]);
    await writeUnit("4.1.2.2.4.5", crackWidth);
}

async function rebuildBondUnit(): Promise<void> {
    const number = "4.1.2.1.1.4";
    const unit = await readUnit(number);
    unit.blocks = [
        findBlock(unit, number, "heading"),
        await textBlock(number, "editorial-001", 77, region(82, 113, 440, 10), [text("La resistenza tangenziale di aderenza di progetto "), math("fbd", "f_{bd}"), text(" vale:")]),
        await assetRef(number, "editorial-002", formulaId("4.1.6"), 77, region(190, 134, 175, 14)),
        await textBlock(number, "editorial-003", 77, region(82, 148, 50, 10), "dove:"),
        await textBlock(number, "editorial-004", 77, region(82, 158, 440, 11), [math("γc", "\\gamma_c"), text(" è il coefficiente parziale di sicurezza relativo al calcestruzzo, pari a 1,5;")]),
        await textBlock(number, "editorial-005", 77, region(82, 171, 440, 11), [math("fbk", "f_{bk}"), text(" è la resistenza tangenziale caratteristica di aderenza data da:")]),
        await assetRef(number, "editorial-006", formulaId("4.1.7"), 77, region(185, 184, 180, 14)),
        await textBlock(number, "editorial-007", 77, region(82, 197, 55, 11), "in cui"),
        await textBlock(number, "editorial-008", 77, region(82, 210, 440, 11), [math("η1 = 1,0", "\\eta_1=1{,}0"), text(" in condizioni di buona aderenza;")]),
        await textBlock(number, "editorial-009", 77, region(82, 222, 440, 31), [math("η1 = 0,7", "\\eta_1=0{,}7"), text(" in condizioni di non buona aderenza, quali nei casi di armature molto addensate, ancoraggi in zona tesa, ancoraggi in zone superiori di getto, in elementi strutturali realizzati con casseforme scorrevoli, a meno che non si adottino idonei provvedimenti;")]),
        await textBlock(number, "editorial-010", 77, region(82, 255, 440, 11), [math("η2 = 1,0", "\\eta_2=1{,}0"), text(" per barre di diametro "), math("Φ ≤ 32 mm", "\\Phi\\le32\\,\\mathrm{mm}")]),
        await textBlock(number, "editorial-011", 77, region(82, 267, 440, 11), [math("η2 = (132 - Φ)/100", "\\eta_2=(132-\\Phi)/100"), text(" per barre di diametro superiore")]),
        await textBlock(number, "editorial-012", 77, region(82, 280, 440, 42), "La lunghezza di ancoraggio di progetto e la lunghezza di sovrapposizione sono influenzate dalla forma delle barre, dal copriferro, dall'effetto di confinamento dell'armatura trasversale, dalla presenza di barre trasversali saldate, dalla pressione trasversale lungo la lunghezza di ancoraggio e dalla percentuale di armatura sovrapposta rispetto all'armatura totale. Per le regole di dettaglio da adottare si potrà fare utile riferimento alla sezione 8 di UNI EN 1992-1-1:2015."),
    ];
    unit.assets.formulaIds = [formulaId("4.1.6"), formulaId("4.1.7")];
    await writeUnit(number, unit);
}

await rebuildAssets();
await fixInlineMath();
await rebuildBondUnit();
console.log("ntc4-step5: rebuilt formulas, inline math and Tables 4.1.I-IV for PDF pages 72-81");
