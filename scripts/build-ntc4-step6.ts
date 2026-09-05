import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitsRoot = root + "/corpus/units/ntc2018";
const manifestPath = root + "/corpus/assets/ntc2018/4.1.json";
const profile = "ntc4-step6-editorial-profile-0.1.0";

type Segment =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type Block = {
    blockId: string;
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
type Unit = { blocks: Block[]; [key: string]: unknown };

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const uid = (number: string) => "urn:structural-codes:it:unit:ntc2018:" + number;
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const text = (value: string): Segment => ({ kind: "text", value });
const math = (value: string, latex = value): Segment => ({ kind: "math", value, latex });

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

function updateText(target: Block, value: string | Segment[]): void {
    if (!target.text) throw new Error("Payload testuale mancante: " + target.blockId);
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    target.text.normalized = normalized;
    target.text.normalizationVersion = profile;
    if (typeof value === "string") delete target.text.inline;
    else target.text.inline = value;
    target.evidence.normalizedSha256 = sha256(normalized);
    target.evidence.transformations = [
        ...(target.evidence.transformations ?? []).filter((item) => item.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinata la segmentazione matematica confrontando direttamente il render della fonte ufficiale.",
        },
    ];
}

const formulas = new Map<string, string>([
    [formulaId("4.1.18a"), "M_{Rd}=M_{Rd}(N_{Ed})\\ge M_{Ed}"],
    [formulaId("4.1.18b"), "\\mu_\\phi=\\mu_\\phi(N_{Ed})\\ge\\mu_{Ed}"],
    [formulaId("4.1.19"), "\\left(\\frac{M_{Eyd}}{M_{Ryd}}\\right)^\\alpha+\\left(\\frac{M_{Ezd}}{M_{Rzd}}\\right)^\\alpha\\le1"],
    [formulaId("4.1.20"), "\\nu=N_{Ed}/N_{Rcd}"],
    [formulaId("4.1.21"), "\\omega_t=A_t\\cdot f_{yd}/N_{Rcd}"],
    [formulaId("4.1.2.3.4.2:phi-yd"), "\\phi_{yd}=\\frac{M_{Rd}}{M'_{yd}}\\cdot\\phi'_{yd}"],
    [formulaId("4.1.22"), "V_{Rd}\\ge V_{Ed}"],
    [formulaId("4.1.23"), "V_{Rd}=\\max\\{[0{,}18\\cdot k\\cdot(100\\cdot\\rho_l\\cdot f_{ck})^{1/3}/\\gamma_c+0{,}15\\cdot\\sigma_{cp}]b_w\\cdot d\\ ;\\ (\\nu_{\\min}+0{,}15\\cdot\\sigma_{cp})\\cdot b_wd\\}"],
    [formulaId("4.1.24"), "V_{Rd}=0{,}7\\cdot b_w\\cdot d\\,(f_{ctd}^2+\\sigma_{cp}\\cdot f_{ctd})^{1/2}"],
    [formulaId("4.1.25"), "1\\le\\operatorname{ctg}\\theta\\le2{,}5"],
    [formulaId("4.1.26"), "V_{Rd}\\ge V_{Ed}"],
    [formulaId("4.1.27"), "V_{Rsd}=0{,}9\\cdot d\\cdot\\frac{A_{sw}}{s}\\cdot f_{yd}\\cdot(\\operatorname{ctg}\\alpha+\\operatorname{ctg}\\theta)\\cdot\\sin\\alpha"],
    [formulaId("4.1.28"), "V_{Rcd}=0{,}9\\cdot d\\cdot b_w\\cdot\\alpha_c\\cdot\\nu\\cdot f_{cd}(\\operatorname{ctg}\\alpha+\\operatorname{ctg}\\theta)/(1+\\operatorname{ctg}^2\\theta)"],
    [formulaId("4.1.29"), "V_{Rd}=\\min(V_{Rsd},V_{Rcd})"],
    [formulaId("4.1.30"), "a_l=(0{,}9\\cdot d\\cdot\\operatorname{ctg}\\theta)/2"],
    [formulaId("4.1.2.3.5.2:alpha-c"), "\\alpha_c=\\begin{cases}1 & \\text{per membrature non compresse}\\\\1+\\sigma_{cp}/f_{cd} & \\text{per }0\\le\\sigma_{cp}<0{,}25f_{cd}\\\\1{,}25 & \\text{per }0{,}25f_{cd}\\le\\sigma_{cp}\\le0{,}5f_{cd}\\\\2{,}5(1-\\sigma_{cp}/f_{cd}) & \\text{per }0{,}5f_{cd}<\\sigma_{cp}<f_{cd}\\end{cases}"],
    [formulaId("4.1.31"), "V_{Ed}=V_d+V_{md}+V_{pd}"],
    [formulaId("4.1.32"), "V_{Ed}\\le A_s\\cdot f_{yd}\\cdot\\sin\\alpha"],
    [formulaId("4.1.33"), "V_{Ed}\\le 0{,}5\\,b_w\\,d\\,\\nu\\,f_{cd}"],
    [formulaId("4.1.34"), "T_{Rd}\\ge T_{Ed}"],
    [formulaId("4.1.35"), "T_{Rcd}=2\\cdot A\\cdot t\\cdot f'_{cd}\\cdot\\operatorname{ctg}\\theta/(1+\\operatorname{ctg}^2\\theta)"],
    [formulaId("4.1.36"), "T_{Rsd}=2\\cdot A\\cdot\\frac{A_s}{s}\\cdot f_{yd}\\cdot\\operatorname{ctg}\\theta"],
    [formulaId("4.1.37"), "T_{Rld}=2\\cdot A\\cdot\\frac{\\sum A_l}{u_m}\\cdot f_{yd}/\\operatorname{ctg}\\theta"],
    [formulaId("4.1.38"), "1\\le\\operatorname{ctg}\\theta\\le2{,}5"],
    [formulaId("4.1.39"), "T_{Rd}=\\min(T_{Rcd},T_{Rsd},T_{Rld})"],
    [formulaId("4.1.40"), "\\frac{T_{Ed}}{T_{Rcd}}+\\frac{V_{Ed}}{V_{Rcd}}\\le1"],
    [formulaId("4.1.2.3.6:reinforcement-ratios"), "\\operatorname{ctg}\\theta=(a_l/a_s)^{1/2},\\qquad a_l=\\sum A_l/u_m,\\qquad a_s=A_s/s"],
    [formulaId("4.1.41"), "\\lambda_{\\lim}=\\frac{25}{\\sqrt{\\nu}}"],
    [formulaId("4.1.42"), "\\lambda=l_0/i"],
    [formulaId("4.1.43"), "P_{Ed}\\le0{,}31\\frac{n}{n+1{,}6}\\frac{\\sum(E_{cd}I_c)}{L^2}"],
    [formulaId("4.1.44"), "EI=\\frac{0{,}3}{1+0{,}5\\phi}E_{cd}I_c"],
    [formulaId("4.1.45"), "A_{s,\\min}=0{,}26\\frac{f_{ctm}}{f_{yk}}b_t\\cdot d\\quad\\text{e comunque non minore di }0{,}0013\\cdot b_t\\cdot d"],
    [formulaId("4.1.46"), "A_{s,\\min}=(0{,}10N_{Ed}/f_{yd})\\quad\\text{e comunque non minore di }0{,}003A_c"],
    [formulaId("4.1.47"), "\\sigma_c<0{,}60f_{ckj}"],
    [formulaId("4.1.48"), "\\sigma_c<c\\,f_{cd}"],
    [formulaId("4.1.49"), "\\begin{aligned}\\sigma_{spi}&<0{,}85f_{p(0{,}1)k}\\qquad \\sigma_{spi}<0{,}75f_{ptk} &&\\text{per armatura post-tesa}\\\\\\sigma_{spi}&<0{,}90f_{p(0{,}1)k}\\qquad \\sigma_{spi}<0{,}80f_{ptk} &&\\text{per armatura pre-tesa}\\end{aligned}"],
]);

async function rebuildFormulas(): Promise<void> {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const removedFormulaIds = new Set([
        formulaId("4.1.2.3.4.2:n-rcd"),
        formulaId("4.1.2.3.5.1:parameters"),
    ]);
    manifest.formulas = (manifest.formulas as Array<{ id: string; latex: string }>).filter((formula) => !removedFormulaIds.has(formula.id));
    for (const formula of manifest.formulas as Array<{ id: string; latex: string }>) {
        const latex = formulas.get(formula.id);
        if (latex !== undefined) formula.latex = latex;
    }
    const missing = [...formulas.keys()].filter((id) => !manifest.formulas.some((formula: { id: string }) => formula.id === id));
    if (missing.length) throw new Error("Formule mancanti nel manifest: " + missing.join(", "));
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function makeTextBlock(base: Block, suffix: string, kind: string, raw: string, value: string | Segment[], listMarker?: "dash" | "none"): Block {
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    const rawValue = raw || normalized;
    const evidence = JSON.parse(JSON.stringify(base.evidence)) as Block["evidence"];
    evidence.rawSha256 = sha256(rawValue);
    evidence.normalizedSha256 = sha256(normalized);
    evidence.transformations = [
        ...(evidence.transformations ?? []).filter((item) => item.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ricostruita la struttura dell’elenco confrontando direttamente il render della fonte ufficiale.",
        },
    ];
    return {
        blockId: base.blockId.replace(/#block-[a-z0-9-]+$/u, "#block-" + suffix),
        kind,
        origin: "official",
        ...(listMarker ? { listMarker } : {}),
        text: {
            raw: rawValue,
            normalized,
            normalizationVersion: profile,
            ...(typeof value === "string" ? {} : { inline: value }),
        },
        evidence,
    };
}

function replaceBlockWithSequence(unit: Unit, suffix: string, replacement: Block[]): void {
    const index = unit.blocks.findIndex((block) => block.blockId.endsWith("#block-" + suffix));
    if (index < 0) throw new Error("Blocco mancante: " + suffix);
    unit.blocks.splice(index, 1, ...replacement);
}

function insertBlockBefore(unit: Unit, targetSuffix: string, block: Block): void {
    const index = unit.blocks.findIndex((candidate) => candidate.blockId.endsWith("#block-" + targetSuffix));
    if (index < 0) throw new Error("Blocco mancante: " + targetSuffix);
    unit.blocks.splice(index, 0, block);
}

function setListMarkers(unit: Unit, number: string, suffixes: string[]): void {
    for (const suffix of suffixes) findBlock(unit, number, suffix).listMarker = "none";
}

function splitColumnReinforcementDefinitions(unit: Unit): void {
    const base = findBlock(unit, "4.1.6.1.2", "editorial-004");
    unit.blocks = unit.blocks.filter((block) => !/(?:editorial-004-[1-2])$/u.test(block.blockId));
    const raw = base.text?.raw.split("\n") ?? [];
    const sourceRaw = raw.length >= 3 ? raw : [
        raw[0] ?? "",
        "N Ed è la forza di compressione assiale di progetto",
        "A c è l’area di calcestruzzo.",
    ];
    replaceBlockWithSequence(unit, "editorial-004", [
        makeTextBlock(base, "editorial-004", "list-item", sourceRaw[0] ?? "", [
            math("fyd", "f_{yd}"), text(" è la resistenza di progetto dell’armatura (riferita allo snervamento)"),
        ], "none"),
        makeTextBlock(base, "editorial-004-1", "list-item", sourceRaw[1] ?? "", [
            math("NEd", "N_{Ed}"), text(" è la forza di compressione assiale di progetto"),
        ], "none"),
        makeTextBlock(base, "editorial-004-2", "list-item", sourceRaw[2] ?? "", [
            math("Ac", "A_c"), text(" è l’area di calcestruzzo."),
        ], "none"),
    ]);
}

function splitPrestressTensionDefinitions(unit: Unit): void {
    const originalBase = unit.blocks.find((block) => block.blockId.endsWith("#block-editorial-007"));
    const previousOuter = unit.blocks.find((block) => block.blockId.endsWith("#block-editorial-007-1"));
    const base = originalBase ?? previousOuter;
    if (!base) throw new Error("Blocco base mancante per l’elenco di 4.1.8.1.4");
    const raw = originalBase?.text?.raw.split("\n") ?? [];
    const hasCombinedRaw = raw.length >= 6;
    const sourceRaw = [
        "dove",
        "Ηc = ·P P / A 0 è la pressione agente sull’impronta caricata di area A0 ",
        ";",
        "P è la forza iniziale di tesatura nel cavo (·P =1,2);",
        "f cd = fckj / ·c è la resistenza cilindrica del calcestruzzo all’atto della precompressione;",
        "c ǂ 3 è un fattore di sovraresistenza che dipende da:",
    ];
    unit.blocks = unit.blocks.filter((block) =>
        !/(?:editorial-007-[1-4])$/u.test(block.blockId) && (hasCombinedRaw || !block.blockId.endsWith("#block-editorial-007")),
    );
    const firstRaw = hasCombinedRaw ? raw.slice(1, 3).join("\n") : sourceRaw.slice(1, 3).join("\n");
    const secondRaw = hasCombinedRaw ? raw[3] ?? "" : sourceRaw[3] ?? "";
    const thirdRaw = hasCombinedRaw ? raw[4] ?? "" : sourceRaw[4] ?? "";
    const fourthRaw = hasCombinedRaw ? raw[5] ?? "" : sourceRaw[5] ?? "";
    const replacement = [
        makeTextBlock(base, "editorial-007", "paragraph", hasCombinedRaw ? raw[0] ?? "dove" : sourceRaw[0] ?? "dove", "dove"),
        makeTextBlock(base, "editorial-007-1", "list-item", firstRaw, [
            math("σc = γP P/A0", "\\sigma_c=\\gamma_P P/A_0"), text(" è la pressione agente sull’impronta caricata di area "), math("A0", "A_0"), text(";"),
        ], "none"),
        makeTextBlock(base, "editorial-007-2", "list-item", secondRaw, [
            math("P", "P"), text(" è la forza iniziale di tesatura nel cavo ("), math("γP = 1,2", "\\gamma_P=1{,}2"), text(");"),
        ], "none"),
        makeTextBlock(base, "editorial-007-3", "list-item", thirdRaw, [
            math("fcd = fckj/γc", "f_{cd}=f_{ckj}/\\gamma_c"), text(" è la resistenza cilindrica del calcestruzzo all’atto della precompressione;"),
        ], "none"),
        makeTextBlock(base, "editorial-007-4", "list-item", fourthRaw, [
            math("c ≤ 3", "c\\le3"), text(" è un fattore di sovraresistenza che dipende da:"),
        ], "none"),
    ];
    if (originalBase && hasCombinedRaw) replaceBlockWithSequence(unit, "editorial-007", replacement);
    else {
        const insertionIndex = unit.blocks.findIndex((block) => block.blockId.endsWith("#block-editorial-008"));
        if (insertionIndex < 0) throw new Error("Punto di inserimento mancante per l’elenco di 4.1.8.1.4");
        unit.blocks.splice(insertionIndex, 0, ...replacement);
    }
    for (const suffix of ["editorial-008", "editorial-009", "editorial-010"]) {
        const nested = findBlock(unit, "4.1.8.1.4", suffix);
        nested.listMarker = "none";
        nested.indentLevel = 1;
    }
}

function splitDefinitionLists(unit: Unit): void {
    unit.blocks = unit.blocks.filter((block) => !/(?:editorial-006-[1-5]|editorial-010-[1-2])$/u.test(block.blockId));

    const firstBase = findBlock(unit, "4.1.2.3.4.2", "editorial-006");
    const firstRaw = firstBase.text?.raw.split("\n") ?? [];
    replaceBlockWithSequence(unit, "editorial-006", [
        makeTextBlock(firstBase, "editorial-006", "paragraph", firstRaw[0] ?? "dove", "dove"),
        makeTextBlock(firstBase, "editorial-006-1", "list-item", firstRaw[1] ?? "", [
            math("MRd", "M_{Rd}"), text(" è il valore di progetto del momento resistente corrispondente a "), math("NEd", "N_{Ed}"), text(";"),
        ], "none"),
        makeTextBlock(firstBase, "editorial-006-2", "list-item", firstRaw[2] ?? "", [
            math("NEd", "N_{Ed}"), text(" è il valore di progetto dello sforzo normale sollecitante;"),
        ], "none"),
        makeTextBlock(firstBase, "editorial-006-3", "list-item", firstRaw[3] ?? "", [
            math("MEd", "M_{Ed}"), text(" è il valore di progetto del momento di domanda;"),
        ], "none"),
        makeTextBlock(firstBase, "editorial-006-4", "list-item", firstRaw[4] ?? "", [
            math("μφ", "\\mu_\\phi"), text(" è il valore di progetto della duttilità di curvatura corrispondente a "), math("NEd", "N_{Ed}"), text(";"),
        ], "none"),
        makeTextBlock(firstBase, "editorial-006-5", "list-item", firstRaw[5] ?? "", [
            math("μEd", "\\mu_{Ed}"), text(" è la domanda in termini di duttilità di curvatura."),
        ], "none"),
    ]);

    const secondBase = findBlock(unit, "4.1.2.3.4.2", "editorial-010");
    const secondRaw = secondBase.text?.raw.split("\n") ?? [];
    replaceBlockWithSequence(unit, "editorial-010", [
        makeTextBlock(secondBase, "editorial-010", "paragraph", secondRaw[0] ?? "dove", "dove"),
        makeTextBlock(secondBase, "editorial-010-1", "list-item", secondRaw.slice(1, 3).join("\n"), [
            math("MEyd, MEzd", "M_{Eyd},\\,M_{Ezd}"), text(" sono i valori di progetto delle due componenti di flessione retta della sollecitazione attorno agli assi "), math("y"), text(" e "), math("z"), text(";"),
        ], "none"),
        makeTextBlock(secondBase, "editorial-010-2", "list-item", secondRaw.slice(3).join("\n"), [
            math("MRyd, MRzd", "M_{Ryd},\\,M_{Rzd}"), text(" sono i valori di progetto dei momenti resistenti di pressoflessione retta corrispondenti a "), math("NEd", "N_{Ed}"), text(" valutati separatamente attorno agli assi "), math("y"), text(" e "), math("z"), text("."),
        ], "none"),
    ]);

    const intro = findBlock(unit, "4.1.2.3.4.2", "editorial-015");
    unit.blocks = unit.blocks.filter((block) => !block.blockId.endsWith("#block-editorial-015-1"));
    const introIndex = unit.blocks.findIndex((block) => block.blockId.endsWith("#block-editorial-015"));
    const rectangular = makeTextBlock(intro, "editorial-015-1", "list-item", "- per sezioni rettangolari:", "per sezioni rettangolari:", "dash");
    unit.blocks.splice(introIndex + 1, 0, rectangular);

    const table = findBlock(unit, "4.1.2.3.4.2", "editorial-016");
    table.indentLevel = 1;
    findBlock(unit, "4.1.2.3.4.2", "editorial-017").indentLevel = 1;
    const circular = findBlock(unit, "4.1.2.3.4.2", "editorial-018");
    circular.listMarker = "dash";
    delete circular.indentLevel;

    const nrcd = findBlock(unit, "4.1.2.3.4.2", "editorial-014");
    const nrcdValue: Segment[] = [math("NRcd = Ac · fcd", "N_{Rcd}=A_c\\cdot f_{cd}"), text(".")];
    nrcd.kind = "paragraph";
    delete nrcd.assetId;
    nrcd.text = {
        raw: "con NRcd = Ac · fcd.",
        normalized: "con NRcd = Ac · fcd.",
        normalizationVersion: profile,
        inline: [text("con "), ...nrcdValue],
    };
    nrcd.evidence.rawSha256 = sha256(nrcd.text.raw);
    nrcd.evidence.normalizedSha256 = sha256(nrcd.text.normalized);
    nrcd.evidence.transformations = [
        ...(nrcd.evidence.transformations ?? []).filter((item) => item.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ricondotta la relazione a un paragrafo con formula inline, come nella fonte ufficiale.",
        },
    ];
    const assetRefs = unit.assets as { formulaIds?: string[] } | undefined;
    if (assetRefs?.formulaIds) assetRefs.formulaIds = assetRefs.formulaIds.filter((id) => id !== formulaId("4.1.2.3.4.2:n-rcd"));
}

function splitPhiDefinitions(unit: Unit): void {
    unit.blocks = unit.blocks.filter((block) => !/(?:editorial-021-[1-3])$/u.test(block.blockId));
    const base = findBlock(unit, "4.1.2.3.4.2", "editorial-021");
    const raw = base.text?.raw.split("\n") ?? [];
    replaceBlockWithSequence(unit, "editorial-021", [
        makeTextBlock(base, "editorial-021", "paragraph", "dove:", "dove:"),
        makeTextBlock(base, "editorial-021-1", "list-item", [raw[0]?.replace(/^dove:\s*/u, "") ?? "", raw[1] ?? ""].join("\n"), [
            math("φ'yd", "\\phi'_{yd}"), text(" è la minore tra la curvatura calcolata in corrispondenza dello snervamento dell’armatura tesa e la curvatura calcolata in corrispondenza della deformazione di picco ("), math("εc2", "\\varepsilon_{c2}"), text(" se si usa il modello parabola-rettangolo oppure "), math("εc3", "\\varepsilon_{c3}"), text(" se si usa il modello triangolo-rettangolo) del calcestruzzo compresso;"),
        ], "none"),
        makeTextBlock(base, "editorial-021-2", "list-item", raw[2] ?? "", [
            math("MRd", "M_{Rd}"), text(" è il momento resistente della sezione allo SLU;"),
        ], "none"),
        makeTextBlock(base, "editorial-021-3", "list-item", raw[3] ?? "", [
            math("M'yd", "M'_{yd}"), text(" è il momento corrispondente a "), math("φ'yd", "\\phi'_{yd}"), text(" e può essere assunto come momento resistente massimo della sezione in campo sostanzialmente elastico."),
        ], "none"),
    ]);
}

function splitUnreinforcedShearDefinitions(unit: Unit): void {
    unit.blocks = unit.blocks.filter((block) => !/(?:editorial-006-[1-3]|editorial-008-[1-4])$/u.test(block.blockId));
    const con = findBlock(unit, "4.1.2.3.5.1", "editorial-006");
    const parameters = unit.blocks.find((block) => block.blockId.endsWith("#block-editorial-007"));
    const definitions = findBlock(unit, "4.1.2.3.5.1", "editorial-008");
    const parameterBase = parameters ?? con;
    const conRaw = con.text?.raw.split("\n") ?? [];
    const definitionRaw = definitions.text?.raw.split("\n") ?? [];
    replaceBlockWithSequence(unit, "editorial-006", [
        makeTextBlock(con, "editorial-006", "paragraph", conRaw[0] ?? "con", "con"),
        makeTextBlock(con, "editorial-006-1", "list-item", conRaw[1] ?? "", [
            math("fck", "f_{ck}"), text(" espresso in MPa"),
        ], "none"),
        makeTextBlock(parameterBase, "editorial-006-2", "list-item", "k = 1 + (200/d)1/2 ≤ 2", [
            math("k = 1 + (200/d)^{1/2} ≤ 2", "k=1+(200/d)^{1/2}\\le2"),
        ], "none"),
        makeTextBlock(parameterBase, "editorial-006-3", "list-item", "ν_min = 0,035 k3/2 fck1/2", [
            math("ν_min = 0,035 k^{3/2} f_{ck}^{1/2}", "\\nu_{\\min}=0{,}035 k^{3/2} f_{ck}^{1/2}"),
        ], "none"),
    ]);
    if (parameters) unit.blocks = unit.blocks.filter((block) => block !== parameters);
    replaceBlockWithSequence(unit, "editorial-008", [
        makeTextBlock(definitions, "editorial-008", "paragraph", definitionRaw[0] ?? "e dove", "e dove"),
        makeTextBlock(definitions, "editorial-008-1", "list-item", definitionRaw[1] ?? "", [
            math("d", "d"), text(" è l’altezza utile della sezione (in mm);"),
        ], "none"),
        makeTextBlock(definitions, "editorial-008-2", "list-item", definitionRaw.slice(2, 4).join("\n"), [
            math("ρl = Asl/(bw · d)", "\\rho_l=A_{sl}/(b_w\\cdot d)"), text(" è il rapporto geometrico di armatura longitudinale tesa ("), math("≤ 0,02", "\\le0{,}02"), text(") che si estende per non meno di ("), math("lbd + d", "l_{bd}+d"), text(") oltre la sezione considerata, dove "), math("lbd", "l_{bd}"), text(" è la lunghezza di ancoraggio;"),
        ], "none"),
        makeTextBlock(definitions, "editorial-008-3", "list-item", definitionRaw[4] ?? "", [
            math("σcp = NEd/Ac [MPa]", "\\sigma_{cp}=N_{Ed}/A_c\\,[\\mathrm{MPa}]"), text(" è la tensione media di compressione nella sezione ("), math("≤ 0,2fcd", "\\le0{,}2f_{cd}"), text(");"),
        ], "none"),
        makeTextBlock(definitions, "editorial-008-4", "list-item", definitionRaw[5] ?? "", [
            math("bw", "b_w"), text(" è la larghezza minima della sezione (in mm)."),
        ], "none"),
    ]);
    const assetRefs = unit.assets as { formulaIds?: string[] } | undefined;
    if (assetRefs?.formulaIds) assetRefs.formulaIds = assetRefs.formulaIds.filter((id) => id !== formulaId("4.1.2.3.5.1:parameters"));
}

function addAlphaCoefficientIntro(unit: Unit): void {
    unit.blocks = unit.blocks.filter((block) => !block.blockId.endsWith("#block-editorial-015-alpha-c-intro"));
    const formula = findBlock(unit, "4.1.2.3.5.2", "editorial-016");
    insertBlockBefore(unit, "editorial-016", makeTextBlock(formula, "editorial-015-alpha-c-intro", "paragraph", "αc coefficiente maggiorativo pari a:", [
        math("αc", "\\alpha_c"), text(" coefficiente maggiorativo pari a:"),
    ]));
}

function splitTorsionDefinitions(unit: Unit): void {
    unit.blocks = unit.blocks.filter((block) => !/(?:editorial-008-1|editorial-009-1|editorial-011-[1-5])$/u.test(block.blockId));
    const formula36 = findBlock(unit, "4.1.2.3.6", "editorial-009");
    const formula37 = findBlock(unit, "4.1.2.3.6", "editorial-010");
    insertBlockBefore(unit, "editorial-009", makeTextBlock(formula36, "editorial-008-1", "paragraph", "Con riferimento alle staffe trasversali la resistenza di progetto si calcola con", "Con riferimento alle staffe trasversali la resistenza di progetto si calcola con"));
    insertBlockBefore(unit, "editorial-010", makeTextBlock(formula37, "editorial-009-1", "paragraph", "Con riferimento all’armatura longitudinale la resistenza di progetto si calcola con", "Con riferimento all’armatura longitudinale la resistenza di progetto si calcola con"));

    const base = findBlock(unit, "4.1.2.3.6", "editorial-011");
    const raw = base.text?.raw.split("\n") ?? [];
    replaceBlockWithSequence(unit, "editorial-011", [
        makeTextBlock(base, "editorial-011", "paragraph", raw[0] ?? "dove si è posto", "dove si è posto"),
        makeTextBlock(base, "editorial-011-1", "list-item", raw[1] ?? "", [
            math("A", "A"), text(" area racchiusa dalla fibra media del profilo periferico;"),
        ], "none"),
        makeTextBlock(base, "editorial-011-2", "list-item", raw[2] ?? "", [
            math("As", "A_s"), text(" area delle staffe;"),
        ], "none"),
        makeTextBlock(base, "editorial-011-3", "list-item", raw[3] ?? "", [
            math("um", "u_m"), text(" perimetro medio del nucleo resistente;"),
        ], "none"),
        makeTextBlock(base, "editorial-011-4", "list-item", raw[4] ?? "", [
            math("s", "s"), text(" passo delle staffe;"),
        ], "none"),
        makeTextBlock(base, "editorial-011-5", "list-item", raw[5] ?? "", [
            math("ΣAl", "\\sum A_l"), text(" è l’area complessiva delle barre longitudinali."),
        ], "none"),
    ]);
}

function splitNodeList(unit: Unit): void {
    unit.blocks = unit.blocks.filter((block) => !/(?:editorial-006-[1-2])$/u.test(block.blockId));
    const base = findBlock(unit, "4.1.2.3.7", "editorial-006");
    const raw = base.text?.raw.split("\n") ?? [];
    replaceBlockWithSequence(unit, "editorial-006", [
        makeTextBlock(base, "editorial-006", "list-item", raw[0] ?? "", [
            text("resistenza dei nodi ("), math("Rn", "R_n"), text(")"),
        ]),
        makeTextBlock(base, "editorial-006-1", "paragraph", raw[1] ?? "", [
            text("Deve risultare la seguente gerarchia delle resistenze "), math("Rs < (Rn, Rb, Rc)", "R_s<(R_n,R_b,R_c)"),
        ]),
        makeTextBlock(base, "editorial-006-2", "paragraph", raw[2] ?? "", "Per la valutazione della resistenza dei puntoni di calcestruzzo, si terrà conto della presenza di stati di sforzo pluriassiali."),
    ]);
}

async function rebuildAlignedLists(): Promise<void> {
    const targets: Array<[string, string[]]> = [
        ["4.1.2.3.5.2", ["editorial-012", "editorial-013", "editorial-014", "editorial-015"]],
        ["4.1.2.3.5.3", ["editorial-005", "editorial-006", "editorial-007"]],
        ["4.1.2.3.9.2", ["editorial-016", "editorial-017", "editorial-018", "editorial-019", "editorial-020"]],
        ["4.1.2.3.9.3", ["editorial-010", "editorial-011", "editorial-012", "editorial-013", "editorial-014"]],
        ["4.1.6.1.1", ["editorial-004", "editorial-005", "editorial-006", "editorial-007"]],
        ["4.1.6.1.2", ["editorial-004", "editorial-004-1", "editorial-004-2"]],
        ["4.1.8.1.4", ["editorial-007-1", "editorial-007-2", "editorial-007-3", "editorial-007-4", "editorial-008", "editorial-009", "editorial-010"]],
    ];
    for (const [number, suffixes] of targets) {
        const unit = await readUnit(number);
        setListMarkers(unit, number, suffixes);
        await writeUnit(number, unit);
    }
}

async function rebuildAlphaTable(): Promise<void> {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const table = (manifest.tables as Array<{ id: string; hideLabel?: boolean; headers: Array<Array<{ align?: string }>>; rows: Array<Array<{ align?: string }>> }>).find((candidate) => candidate.id === "urn:structural-codes:it:asset:table:ntc2018:4.1.2.3.4.2:alpha");
    if (!table) throw new Error("Tabella alpha mancante nel manifest");
    table.hideLabel = true;
    for (const row of [...table.headers, ...table.rows]) for (const cell of row) cell.align = "center";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function patchUnit(number: string, patches: Record<string, string | Segment[]>): Promise<void> {
    const unit = await readUnit(number);
    for (const [suffix, value] of Object.entries(patches)) updateText(findBlock(unit, number, suffix), value);
    await writeUnit(number, unit);
}

async function fixInlineMath(): Promise<void> {
    await patchUnit("4.1.2.3.10", {
        "editorial-002": "La verifica di ancoraggio deve tenere conto, qualora necessario, dell’effetto d’insieme delle barre e della presenza di eventuali armature trasversali.",
    });

    await patchUnit("4.1.2.3.4.2", {
        "editorial-001": [text("Con riferimento alla sezione pressoinflessa, rappresentata in Fig. 4.1.4, la capacità, in termini di resistenza e duttilità, si determina in base alle ipotesi di calcolo e ai modelli "), math("σ-ε", "\\sigma-\\varepsilon"), text(" di cui al § 4.1.2.1.2.")],
        "editorial-007": [text("Nel caso di pilastri soggetti a compressione assiale, si deve comunque assumere una componente flettente "), math("MEd = e · NEd", "M_{Ed}=e\\cdot N_{Ed}"), text(" con eccentricità "), math("e"), text(" pari almeno ad "), math("1/200"), text(" dell’altezza libera di inflessione del pilastro, e comunque non minore di "), math("20 mm", "20\\,\\mathrm{mm}"), text(".")],
        "editorial-011": [text("L’esponente "), math("α", "\\alpha"), text(" può dedursi in funzione della geometria della sezione e dei parametri:")],
        "editorial-017": [text("con interpolazione lineare per valori diversi di "), math("NEd/NRcd", "N_{Ed}/N_{Rcd}"), text(";")],
        "editorial-018": [text("per sezioni circolari ed ellittiche: "), math("α = 2", "\\alpha=2"), text(".")],
        "editorial-019": [text("La capacità in termini di fattore di duttilità in curvatura "), math("μφ", "\\mu_\\phi"), text(" può essere calcolata, separatamente per le due direzioni principali di verifica, come rapporto tra la curvatura cui corrisponde una riduzione del 15% della massima resistenza a flessione – oppure il raggiungimento della deformazione ultima del calcestruzzo e/o dell’acciaio – e la curvatura convenzionale di prima plasticizzazione "), math("φyd", "\\phi_{yd}"), text(" espressa dalla relazione seguente:")],
    });

    await patchUnit("4.1.2.3.5.1", {
        "editorial-004": [text("dove "), math("VEd", "V_{Ed}"), text(" è il valore di progetto dello sforzo di taglio agente.")],
        "editorial-009": [text("Nel caso di elementi in calcestruzzo armato precompresso disposti in semplice appoggio, nelle zone non fessurate da momento flettente (con tensioni di trazione non superiori a "), math("fctd", "f_{ctd}"), text(") la resistenza di progetto può valutarsi, in via semplificativa, con la formula:")],
    });

    await patchUnit("4.1.2.3.5.2", {
        "editorial-001": [text("La resistenza di progetto a taglio "), math("VRd", "V_{Rd}"), text(" di elementi strutturali dotati di specifica armatura a taglio deve essere valutata sulla base di una adeguata schematizzazione a traliccio. Gli elementi resistenti dell’ideale traliccio sono: le armature trasversali, le armature longitudinali, il corrente compresso di calcestruzzo e i puntoni d’anima inclinati. L’inclinazione "), math("θ", "\\theta"), text(" dei puntoni di calcestruzzo rispetto all’asse della trave deve rispettare i limiti seguenti:")],
        "editorial-005": [text("dove "), math("VEd", "V_{Ed}"), text(" è il valore di progetto dello sforzo di taglio agente.")],
        "editorial-007": "Con riferimento al calcestruzzo d’anima, la resistenza di progetto a “taglio compressione” si calcola con",
        "editorial-011": [text("dove "), math("d"), text(", "), math("bw", "b_w"), text(" e "), math("σcp", "\\sigma_{cp}"), text(" hanno il significato indicato in § 4.1.2.3.5.1 e inoltre si è posto:")],
        "editorial-012": [math("Asw", "A_{sw}"), text(" area dell’armatura trasversale;")],
        "editorial-013": [math("s"), text(" interasse tra due armature trasversali consecutive;")],
        "editorial-014": [math("α", "\\alpha"), text(" angolo di inclinazione dell’armatura trasversale rispetto all’asse della trave;")],
        "editorial-015": [math("νfcd", "\\nu f_{cd}"), text(" resistenza di progetto a compressione ridotta del calcestruzzo d’anima ("), math("ν = 0,5", "\\nu=0{,}5"), text(");")],
    });

    await patchUnit("4.1.2.3.5.3", {
        "editorial-005": [math("Vd", "V_d"), text(" = valore di progetto del taglio dovuto ai carichi esterni;")],
        "editorial-006": [math("Vmd", "V_{md}"), text(" = valore di progetto della componente di taglio dovuta all’inclinazione dei lembi della membratura;")],
        "editorial-007": [math("Vpd", "V_{pd}"), text(" = valore di progetto della componente di taglio dovuta alla precompressione.")],
        "editorial-009": [text("Il taglio all’appoggio determinato da carichi applicati alla distanza "), math("av ≤ 2d", "a_v\\le2d"), text(" dall’appoggio stesso si potrà ridurre del rapporto "), math("av/2d", "a_v/2d"), text(", con l’osservanza delle seguenti prescrizioni:")],
        "editorial-011": [text("nel caso di appoggio intermedio, l’armatura di trazione all’appoggio deve essere prolungata sin dove necessario e comunque fino alla sezione ove è applicato il carico più lontano compreso nella zona con "), math("av ≤ 2d", "a_v\\le2d"), text(".")],
        "editorial-012": [text("Nel caso di elementi con armature trasversali resistenti al taglio, si deve verificare che lo sforzo di taglio "), math("VEd", "V_{Ed}"), text(", calcolato in questo modo, soddisfi la condizione")],
        "editorial-014": [text("dove "), math("As fyd", "A_s f_{yd}"), text(" è la resistenza dell’armatura trasversale contenuta nella zona di lunghezza "), math("0,75 av", "0{,}75a_v"), text(" centrata tra carico ed appoggio e che attraversa la fessura di taglio inclinata ivi compresa.")],
        "editorial-015": [text("Lo sforzo di taglio "), math("VEd", "V_{Ed}"), text(", calcolato senza la riduzione "), math("av/2d", "a_v/2d"), text(", deve comunque sempre rispettare la condizione:")],
        "editorial-017": [text("essendo "), math("ν = 0,5", "\\nu=0{,}5"), text(" un coefficiente di riduzione della resistenza del calcestruzzo fessurato per taglio.")],
    });

    await patchUnit("4.1.2.3.5.4", {
        "editorial-002": [text("In mancanza di un’armatura trasversale appositamente dimensionata, la resistenza al punzonamento deve essere valutata, utilizzando formule di comprovata affidabilità, sulla base della resistenza a trazione del calcestruzzo, intendendo la sollecitazione distribuita su di un perimetro efficace distante "), math("2d"), text(" dall’impronta caricata, con "), math("d"), text(" altezza utile (media) della soletta.")],
    });

    await patchUnit("4.1.2.3.6", {
        "editorial-003": [text("dove "), math("TEd", "T_{Ed}"), text(" è il valore di progetto del momento torcente agente.")],
        "editorial-007": [text("dove "), math("t"), text(" è lo spessore della sezione cava; per sezioni piene "), math("t = Ac/u", "t=A_c/u"), text(" dove "), math("Ac", "A_c"), text(" è l’area della sezione ed "), math("u"), text(" è il suo perimetro; "), math("t"), text(" deve essere assunta comunque "), math("≥ 2", "\\ge2"), text(" volte la distanza fra il bordo e il centro dell’armatura longitudinale.")],
        "editorial-008": [text("Le armature longitudinali e trasversali del traliccio resistente devono essere poste entro lo spessore "), math("t"), text(" del profilo periferico. Le barre longitudinali possono essere distribuite lungo detto profilo, ma comunque una barra deve essere presente su tutti i suoi spigoli.")],
        "editorial-012": [text("L’inclinazione "), math("θ", "\\theta"), text(" delle bielle compresse di calcestruzzo rispetto all’asse della trave deve rispettare i limiti seguenti")],
        "editorial-028": [text("Per l’angolo "), math("θ", "\\theta"), text(" delle bielle compresse di conglomerato cementizio deve essere assunto un unico valore per le due verifiche di taglio e torsione.")],
    });

    await patchUnit("4.1.2.3.7", {
        "editorial-003": [text("resistenza dei tiranti costituiti dalle sole armature ("), math("Rs", "R_s"), text(")")],
        "editorial-004": [text("resistenza dei puntoni di calcestruzzo compresso ("), math("Rc", "R_c"), text(")")],
        "editorial-005": [text("ancoraggio delle armature ("), math("Rb", "R_b"), text(")")],
    });

    await patchUnit("4.1.2.3.9.1", {
        "editorial-001": [text("Per elementi prevalentemente compressi, armati con barre longitudinali disposte lungo una circonferenza e racchiuse da una spirale di passo non maggiore di "), math("1/5"), text(" del diametro inscritto dal nucleo cerchiato, la resistenza allo stato limite ultimo si calcola sommando i contributi della sezione di calcestruzzo confinato del nucleo e dell’armatura longitudinale, dove la resistenza del nucleo di calcestruzzo confinato può esprimersi come somma di quella del nucleo di calcestruzzo non confinato più il contributo di una armatura fittizia longitudinale di peso eguale alla spirale.")],
    });

    await patchUnit("4.1.2.3.9.2", {
        "editorial-005": [text("In via approssimata gli effetti del secondo ordine in pilastri singoli possono essere trascurati se la snellezza "), math("λ", "\\lambda"), text(" non supera il valore")],
        "editorial-007": [text("dove "), math("ν = NEd/(Ac · fcd)", "\\nu=N_{Ed}/(A_c\\cdot f_{cd})"), text(" è l’azione assiale adimensionalizzata.")],
        "editorial-008": [text("La snellezza è calcolata come rapporto tra la lunghezza libera di inflessione, "), math("l0", "l_0"), text(", ed il raggio d’inerzia, "), math("i"), text(", della sezione di calcestruzzo non fessurato:")],
        "editorial-010": [text("dove in particolare "), math("l0", "l_0"), text(" va definita in base ai vincoli d’estremità ed all’interazione con eventuali elementi contigui.")],
        "editorial-011": [text("Per le pareti il calcolo di "), math("l0", "l_0"), text(" deve tenere conto delle condizioni di vincolo sui quattro lati e del rapporto tra le dimensioni principali nel piano.")],
        "editorial-016": [math("PEd", "P_{Ed}"), text(" è il carico verticale totale (su elementi controventati e di controvento);")],
        "editorial-017": [math("n", "n"), text(" è il numero di piani;")],
        "editorial-018": [math("L", "L"), text(" è l’altezza totale dell’edificio sopra il vincolo ad incastro di base;")],
        "editorial-019": [math("Ecd", "E_{cd}"), text(" è il valore di progetto del modulo elastico del calcestruzzo definito in § 4.1.2.3.9.3;")],
        "editorial-020": [math("Ic", "I_c"), text(" è il momento di inerzia della sezione di calcestruzzo degli elementi di controvento, ipotizzata interamente reagente.")],
    });

    await patchUnit("4.1.2.3.9.3", {
        "editorial-002": [text("Per i pilastri compressi di telai a nodi fissi, non altrimenti soggetti ad esplicite azioni flettenti, va comunque inserito nel modello di calcolo un difetto di rettilineità pari a "), math("1/300"), text(" della loro altezza.")],
        "editorial-006": [text("dove "), math("Ic", "I_c"), text(" è il momento d’inerzia della sezione di calcestruzzo interamente reagente e "), math("φ", "\\phi"), text(" è il coefficiente di viscosità del calcestruzzo (§ 11.2.10.7).")],
        "editorial-007": [text("Per i coefficienti elastici corretti si possono utilizzare le espressioni linearizzate nella variabile "), math("NEd", "N_{Ed}"), text(" (sforzo assiale dell’elemento).")],
        "editorial-010": [math("fck", "f_{ck}"), text(" resistenza caratteristica del calcestruzzo;")],
        "editorial-011": [math("Ecd = Ecm/γCE", "E_{cd}=E_{cm}/\\gamma_{CE}"), text(" modulo elastico di progetto del calcestruzzo con "), math("γCE = 1,2", "\\gamma_{CE}=1{,}2"), text(";")],
        "editorial-012": [math("φ", "\\phi"), text(" coefficiente di viscosità del calcestruzzo (§ 11.2.10.7);")],
        "editorial-013": [math("fyk", "f_{yk}"), text(" tensione di snervamento caratteristica dell’armatura;")],
        "editorial-014": [math("Es", "E_s"), text(" modulo elastico dell’armatura.")],
    });

    await patchUnit("4.1.4", {
        "editorial-002": [text("calcestruzzo e aderenza con le armature "), math("γC = 1,0", "\\gamma_C=1{,}0")],
        "editorial-003": [text("acciaio d’armatura "), math("γS = 1,0", "\\gamma_S=1{,}0")],
    });

    await patchUnit("4.1.6.1.1", {
        "editorial-004": [math("bt", "b_t"), text(" rappresenta la larghezza media della zona tesa; per una trave a T con piattabanda compressa, nel calcolare il valore di "), math("bt", "b_t"), text(" si considera solo la larghezza dell’anima;")],
        "editorial-005": [math("d"), text(" è l’altezza utile della sezione;")],
        "editorial-006": [math("fctm", "f_{ctm}"), text(" è il valore medio della resistenza a trazione assiale definita nel § 11.2.10.2;")],
        "editorial-007": [math("fyk", "f_{yk}"), text(" è il valore caratteristico della resistenza a trazione dell’armatura ordinaria.")],
        "editorial-009": [text("Al di fuori delle zone di sovrapposizione, l’area di armatura tesa o compressa non deve superare individualmente "), math("As,max = 0,04 Ac", "A_{s,\\max}=0{,}04A_c"), text(", essendo "), math("Ac", "A_c"), text(" l’area della sezione trasversale di calcestruzzo.")],
        "editorial-010": [text("Le travi devono prevedere armatura trasversale costituita da staffe con sezione complessiva non inferiore ad "), math("Ast = 1,5 b mm²/m", "A_{st}=1{,}5b\\,\\mathrm{mm^2/m}"), text(" essendo "), math("b"), text(" lo spessore minimo dell’anima in millimetri, con un minimo di tre staffe al metro e comunque passo non superiore a 0,8 volte l’altezza utile della sezione.")],
        "editorial-012": [text("Eventuali armature longitudinali compresse di diametro "), math("Φ", "\\Phi"), text(" prese in conto nei calcoli di resistenza devono essere trattenute da armature trasversali con spaziatura non maggiore di "), math("15Φ", "15\\Phi"), text(".")],
    });

    await patchUnit("4.1.6.1.2", {
        "editorial-006": [text("Al di fuori delle zone di sovrapposizione, l’area di armatura non deve superare "), math("As,max = 0,04 Ac", "A_{s,\\max}=0{,}04A_c"), text(", essendo "), math("Ac", "A_c"), text(" l’area della sezione trasversale di calcestruzzo.")],
    });

    await patchUnit("4.1.6.1.4", {
        "editorial-006": [text("Per barre di diametro "), math("Ø > 32 mm", "\\Phi>32\\,\\mathrm{mm}"), text(" occorrerà adottare particolari cautele negli ancoraggi e nelle sovrapposizioni.")],
    });

    await patchUnit("4.1.8.1.1", {
        "editorial-001": [text("Per la valutazione della resistenza degli elementi strutturali vale quanto stabilito al § 4.1.2.3, tenendo presente che per la verifica delle sezioni si assumerà il valore di progetto della forza di precompressione con il coefficiente parziale "), math("γP = 1", "\\gamma_P=1"), text(", secondo quanto previsto al punto § 2.6.1.")],
        "editorial-002": [text("Per le verifiche di resistenza locale degli ancoraggi delle armature di precompressione, si assumerà, invece, un valore di progetto della forza di precompressione con "), math("γP = 1,2", "\\gamma_P=1{,}2"), text(".")],
    });

    await patchUnit("4.1.8.1.4", {
        "editorial-003": [text("essendo "), math("fckj", "f_{ckj}"), text(" la resistenza caratteristica del calcestruzzo all’atto del tiro.")],
        "editorial-004": [text("Per elementi con armatura pre-tesa, la tensione del calcestruzzo al momento del trasferimento della pretensione può essere aumentata sino al valore "), math("0,70 fckj", "0{,}70f_{ckj}"), text(".")],
        "editorial-005": [text("Nella zona di ancoraggio delle armature di precompressione si possono tollerare compressioni locali "), math("σc", "\\sigma_c"), text(" prodotte dagli apparecchi di ancoraggio pari a:")],
        "editorial-008": [text("il rapporto "), math("A0/A1", "A_0/A_1"), text(" tra l’area caricata e quella circostante interessata;")],
        "editorial-011": [text("Per i valori di "), math("c"), text(" si può far utile riferimento al § 6.7 della norma UNI EN 1992-1-1.")],
    });

    await patchUnit("4.1.8.1.5", {
        "editorial-001": [text("Per le tensioni in esercizio a perdite avvenute vale quanto stabilito al § 4.1.2.2.5.2 ove si sostituisca "), math("fp(0,1)k", "f_{p(0{,}1)k}"), text(", "), math("fp(1)k", "f_{p(1)k}"), text(" o "), math("fpyk", "f_{pyk}"), text(" a "), math("fyk", "f_{yk}"), text(".")],
        "editorial-004": [text("ove si sostituisca "), math("fp(1)k", "f_{p(1)k}"), text(" o "), math("fpyk", "f_{pyk}"), text(" a "), math("fp(0,1)k", "f_{p(0{,}1)k}"), text(", se del caso.")],
        "editorial-005": [text("In entrambi i casi è ammessa una sovratensione, in misura non superiore a "), math("0,05 fp(0,1)k", "0{,}05f_{p(0{,}1)k}"), text(".")],
    });

    await patchUnit("4.1.8.2.2", {
        "editorial-001": "Nelle travi dovranno disporsi staffe aventi sezione complessiva non inferiore a quanto prescritto al punto § 4.1.6.1.1. In prossimità di carichi concentrati o delle zone d’appoggio valgono le prescrizioni di cui al § 4.1.2.3.5.",
    });

    await patchUnit("4.1.8.3", {
        "editorial-003": "Nel caso di armature post-tese, gli apparecchi d’ancoraggio della testata devono essere protetti in modo analogo.",
    });
}

await rebuildFormulas();
await rebuildAlphaTable();
const verificationUnit = await readUnit("4.1.2.3.4.2");
splitDefinitionLists(verificationUnit);
splitPhiDefinitions(verificationUnit);
await writeUnit("4.1.2.3.4.2", verificationUnit);
const unreinforcedShearUnit = await readUnit("4.1.2.3.5.1");
splitUnreinforcedShearDefinitions(unreinforcedShearUnit);
await writeUnit("4.1.2.3.5.1", unreinforcedShearUnit);
const shearUnit = await readUnit("4.1.2.3.5.2");
addAlphaCoefficientIntro(shearUnit);
await writeUnit("4.1.2.3.5.2", shearUnit);
const torsionUnit = await readUnit("4.1.2.3.6");
splitTorsionDefinitions(torsionUnit);
await writeUnit("4.1.2.3.6", torsionUnit);
const nodeUnit = await readUnit("4.1.2.3.7");
splitNodeList(nodeUnit);
await writeUnit("4.1.2.3.7", nodeUnit);
const columnReinforcementUnit = await readUnit("4.1.6.1.2");
splitColumnReinforcementDefinitions(columnReinforcementUnit);
await writeUnit("4.1.6.1.2", columnReinforcementUnit);
const prestressTensionUnit = await readUnit("4.1.8.1.4");
splitPrestressTensionDefinitions(prestressTensionUnit);
await writeUnit("4.1.8.1.4", prestressTensionUnit);
await fixInlineMath();
await rebuildAlignedLists();
console.log("ntc4-step6: rebuilt formulas and inline math for PDF pages 82-91");
