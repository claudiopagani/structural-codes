/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const sourceId = "gu-so8-2018-ntc";
export const profile = "ntc74-editorial-profile-0.1.0";
const pages = new Map<number, string[]>();
for (let page = 232; page <= 243; page += 1) {
    const path = join(
        root,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
    pages.set(page, (await readFile(path, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}
export const raw = (page: number, from: number, to = from): string =>
    pages.get(page)!.slice(from - 1, to).join("\n");
const hash = (text: string): string =>
    createHash("sha256").update(text, "utf8").digest("hex");
const clean = (text: string): string =>
    text
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .replace(/^77\.4/gu, "7.4")
        .replace(/^ȭ /gu, "")
        .replace(/CD”/gu, "CD “")
        .replace(/”B”/gu, "B”")
        .replace(/”A”/gu, "A”")
        .replace(/§7\./gu, "§ 7.")
        .trim();

const mathTerms: Array<[string, string]> = [
    ["M_Ed/M_Rd", "M_{Ed}/M_{Rd}"],
    ["M_Ed", "M_{Ed}"],
    ["M_Rd", "M_{Rd}"],
    ["V_Ed", "V_{Ed}"],
    ["V_Rd,S", "V_{Rd,S}"],
    ["V_id", "V_{id}"],
    ["μ_φ", "\\mu_\\phi"],
    ["φ_u", "\\phi_u"],
    ["φ_yd", "\\phi_{yd}"],
    ["ε_cu2,c", "\\varepsilon_{cu2,c}"],
    ["ε_cu2", "\\varepsilon_{cu2}"],
    ["α_s", "\\alpha_s"],
    ["γ_Rd", "\\gamma_{Rd}"],
    ["h_cr", "h_{cr}"],
    ["h_w", "h_w"],
    ["l_w", "l_w"],
    ["b_w", "b_w"],
    ["l_C", "l_C"],
    ["b_0", "b_0"],
    ["x_u", "x_u"],
    ["q", "q"],
];

export function normalized(source: string): string {
    return clean(source)
        .replace(/΅s/gu, "α_s")
        .replace(/ǃ/gu, "≥")
        .replace(/ǂ/gu, "≤")
        .replace(/·Rd/gu, "γ_Rd")
        .replace(/μI,?/gu, "μ_φ")
        .replace(/ȝ\)\s*/gu, "μ_φ")
        .replace(/\bIu\b/gu, "φ_u")
        .replace(/\bIyd\b/gu, "φ_yd")
        .replace(/Hcu2,c/gu, "ε_cu2,c")
        .replace(/Hcu2/gu, "ε_cu2")
        .replace(/\bl w\b/gu, "l_w")
        .replace(/\bhw\b/gu, "h_w")
        .replace(/\bhcr\b/gu, "h_cr")
        .replace(/\bbw\b/gu, "b_w")
        .replace(/\bb 0\b/gu, "b_0")
        .replace(/\bl C\b/gu, "l_C")
        .replace(/\bxu\b/gu, "x_u")
        .replace(/\bMEd\b/gu, "M_Ed")
        .replace(/\bMRd\b/gu, "M_Rd")
        .replace(/\bVEd\b/gu, "V_Ed")
        .replace(/\bVRd,S\b/gu, "V_Rd,S")
        .replace(/\bVid\b/gu, "V_id");
}

export function inline(text: string): any[] | undefined {
    const hits = mathTerms
        .filter(([value]) => text.includes(value))
        .sort((a, b) => b[0].length - a[0].length);
    if (!hits.length) return undefined;
    const result: any[] = [];
    let at = 0;
    while (at < text.length) {
        let best: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of hits) {
            const index = text.indexOf(value, at);
            if (index >= 0 && (!best || index < best.index)) best = { index, value, latex };
        }
        if (!best) {
            result.push({ kind: "text", value: text.slice(at) });
            break;
        }
        if (best.index > at) result.push({ kind: "text", value: text.slice(at, best.index) });
        result.push({ kind: "math", value: best.value, latex: best.latex });
        at = best.index + best.value.length;
    }
    return result.filter(({ value }) => value);
}

export function ev(page: number, source: string, norm: string, region: any = null): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: {
            method: region ? "manual-transcription" : "pdf-text",
            tool: region ? "codex-manual-asset-transcription" : "pdfjs-dist",
            toolVersion: region ? profile : "4.10.38",
        },
        transformations:
            source === norm
                ? []
                : [
                      {
                          operation: "join-line-wrap",
                          ruleVersion: profile,
                          note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
                      },
                      {
                          operation: "manual-correction",
                          ruleVersion: profile,
                          note: "Ripristinati glifi, indici e simboli matematici verificati sul render ufficiale.",
                      },
                      {
                          operation: "normalize-whitespace",
                          ruleVersion: profile,
                          note: "Uniformati gli spazi dopo la ricomposizione.",
                      },
                      {
                          operation: "unicode-nfc",
                          ruleVersion: profile,
                          note: "Testo normalizzato in Unicode NFC.",
                      },
                  ],
        rawSha256: hash(source),
        normalizedSha256: hash(norm),
    };
}

type B = {
    kind: "heading" | "paragraph" | "list-item" | "formula-ref" | "figure-ref";
    page: number;
    from: number;
    to?: number;
    norm?: string;
    asset?: string;
    region?: any;
    inline?: any[];
};
type U = { number: string; title: string; heading: B; blocks: B[]; crossPage?: boolean };
export const aid = (kind: "formula" | "figure", suffix: string): string =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;

const units: U[] = [
    {
        number: "7.4.4.5",
        title: "PARETI",
        heading: { kind: "heading", page: 232, from: 76, norm: "7.4.4.5 PARETI" },
        crossPage: true,
        blocks: [
            {
                kind: "paragraph",
                page: 232,
                from: 77,
                to: 82,
                norm:
                    "Si definisce parete un elemento strutturale di supporto per altri elementi che abbia una sezione trasversale rettangolare o ad essa assimilabile, anche per tratti, caratterizzata in ciascun tratto da un rapporto tra dimensione massima l_w e dimensione minima b_w in pianta l_w/b_w > 4 (v. fig. 7.4.3). Le pareti possono avere sezione orizzontale composta da uno (parete semplice) o più (parete composta) segmenti rettangolari. Pareti semplici possono avere appendici con l_w/b_w ≤ 4. Si raccomanda che pareti composte da più segmenti rettangolari collegati o che si intersecano (sezioni a L, T, U o simili) siano considerate unità intere, che consistono di una o più anime parallele, o approssimativamente parallele, alla direzione della forza di taglio sismica agente e di una o più flange normali o approssimativamente normali ad essa. Le pareti si definiscono snelle se il rapporto h_w/l_w > 2, tozze in caso contrario, essendo h_w l’altezza totale della parete (v. fig. 7.4.3) misurata a partire dalla sua base.",
            },
        ],
    },
    {
        number: "7.4.4.5.1",
        title: "Verifiche di resistenza (RES)",
        heading: { kind: "heading", page: 233, from: 8, norm: "7.4.4.5.1 Verifiche di resistenza (RES)" },
        blocks: [
            { kind: "paragraph", page: 233, from: 9 },
            { kind: "paragraph", page: 233, from: 10, to: 14 },
            { kind: "figure-ref", page: 233, from: 15, asset: aid("figure", "7.4.3"), region: { coordinateSystem: "pdf-points-top-left", x: 85, y: 215, width: 430, height: 255 } },
            { kind: "paragraph", page: 233, from: 16, to: 18 },
            { kind: "list-item", page: 233, from: 19, to: 20 },
            { kind: "list-item", page: 233, from: 21, to: 22 },
            { kind: "list-item", page: 233, from: 23 },
            { kind: "paragraph", page: 233, from: 24, to: 29 },
            { kind: "paragraph", page: 233, from: 30, to: 31 },
            { kind: "paragraph", page: 233, from: 32, to: 33 },
            { kind: "heading", page: 233, from: 34 },
            { kind: "paragraph", page: 233, from: 35, to: 38 },
            { kind: "paragraph", page: 233, from: 39, to: 40 },
            { kind: "figure-ref", page: 234, from: 3, asset: aid("figure", "7.4.4"), region: { coordinateSystem: "pdf-points-top-left", x: 120, y: 95, width: 360, height: 205 } },
            { kind: "paragraph", page: 234, from: 4, to: 5 },
            { kind: "formula-ref", page: 234, from: 6, to: 21, asset: aid("formula", "7.4.13") },
            { kind: "paragraph", page: 234, from: 22 },
            { kind: "paragraph", page: 234, from: 23, to: 24 },
            { kind: "paragraph", page: 234, from: 25, to: 26 },
            { kind: "paragraph", page: 234, from: 27, to: 31 },
            { kind: "heading", page: 234, from: 32 },
            { kind: "paragraph", page: 234, from: 33, to: 34 },
            { kind: "formula-ref", page: 234, from: 35, to: 64, asset: aid("formula", "7.4.14") },
            { kind: "formula-ref", page: 234, from: 65, to: 71, asset: aid("formula", "7.4.15") },
            { kind: "paragraph", page: 234, from: 72, to: 74 },
            { kind: "paragraph", page: 234, from: 75, to: 80 },
            { kind: "figure-ref", page: 235, from: 3, asset: aid("figure", "7.4.5"), region: { coordinateSystem: "pdf-points-top-left", x: 165, y: 85, width: 275, height: 197 } },
            { kind: "paragraph", page: 235, from: 4, to: 5 },
            { kind: "paragraph", page: 235, from: 6, to: 8 },
            { kind: "heading", page: 235, from: 9 },
            { kind: "paragraph", page: 235, from: 10, to: 12 },
            { kind: "heading", page: 235, from: 13 },
            { kind: "paragraph", page: 235, from: 14, to: 17 },
            { kind: "formula-ref", page: 235, from: 18, to: 19, asset: aid("formula", "7.4.16") },
            { kind: "formula-ref", page: 235, from: 20, to: 21, asset: aid("formula", "7.4.17") },
            { kind: "paragraph", page: 235, from: 22, to: 26 },
            { kind: "heading", page: 235, from: 27 },
            { kind: "paragraph", page: 235, from: 28, to: 29 },
            { kind: "formula-ref", page: 235, from: 30, to: 31, asset: aid("formula", "7.4.18") },
            { kind: "paragraph", page: 235, from: 32 },
            { kind: "formula-ref", page: 235, from: 33, to: 34, asset: aid("formula", "7.4.19") },
            { kind: "paragraph", page: 235, from: 35, to: 36 },
            { kind: "formula-ref", page: 235, from: 37, to: 47, asset: aid("formula", "7.4.20") },
            { kind: "formula-ref", page: 235, from: 48, asset: aid("formula", "7.4.21") },
            { kind: "formula-ref", page: 236, from: 3, to: 11, asset: aid("formula", "7.4.22") },
            { kind: "paragraph", page: 236, from: 12, to: 15 },
            { kind: "paragraph", page: 236, from: 16 },
            { kind: "paragraph", page: 236, from: 17, to: 18 },
        ],
    },
    {
        number: "7.4.4.5.2",
        title: "Verifiche di duttilità (DUT)",
        heading: { kind: "heading", page: 236, from: 19, norm: "7.4.4.5.2 Verifiche di duttilità (DUT)" },
        blocks: [
            { kind: "paragraph", page: 236, from: 20, to: 24 },
            { kind: "paragraph", page: 236, from: 25, to: 28 },
            { kind: "paragraph", page: 236, from: 29, to: 35 },
            { kind: "figure-ref", page: 236, from: 36, to: 37, asset: aid("figure", "7.4.6"), region: { coordinateSystem: "pdf-points-top-left", x: 160, y: 400, width: 275, height: 190 } },
            { kind: "paragraph", page: 236, from: 38, to: 41 },
            {
                kind: "paragraph", page: 236, from: 42, to: 43,
                norm: "Nel caso si utilizzi la formulazione semplificata indicata al § 7.4.6.2.4 per eseguire la verifica di duttilità, si può porre l_C ≥ max(0,20·l_w, 1,5·b_w).",
            },
        ],
    },
    {
        number: "7.4.4.6",
        title: "TRAVI DI ACCOPPIAMENTO DEI SISTEMI A PARETI",
        heading: { kind: "heading", page: 236, from: 44, norm: "7.4.4.6 TRAVI DI ACCOPPIAMENTO DEI SISTEMI A PARETI" },
        blocks: [
            { kind: "paragraph", page: 236, from: 45, to: 46 },
            { kind: "list-item", page: 236, from: 47 },
            { kind: "list-item", page: 237, from: 3 },
            { kind: "formula-ref", page: 237, from: 4, asset: aid("formula", "7.4.23") },
            { kind: "paragraph", page: 237, from: 5 },
            { kind: "paragraph", page: 237, from: 6, to: 8 },
            { kind: "formula-ref", page: 237, from: 9, asset: aid("formula", "7.4.24") },
            { kind: "paragraph", page: 237, from: 10 },
            { kind: "paragraph", page: 237, from: 11 },
        ],
    },
    {
        number: "7.4.5",
        title: "COSTRUZIONI CON STRUTTURA PREFABBRICATA",
        heading: { kind: "heading", page: 237, from: 12, norm: "7.4.5 COSTRUZIONI CON STRUTTURA PREFABBRICATA" },
        blocks: [
            { kind: "paragraph", page: 237, from: 13, to: 15 },
            { kind: "paragraph", page: 237, from: 16, to: 17 },
            { kind: "paragraph", page: 237, from: 18, to: 19 },
        ],
    },
    {
        number: "7.4.5.1",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        heading: { kind: "heading", page: 237, from: 20, norm: "7.4.5.1 TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO" },
        blocks: [
            { kind: "paragraph", page: 237, from: 21 },
            { kind: "list-item", page: 237, from: 22 },
            { kind: "list-item", page: 237, from: 23 },
            { kind: "list-item", page: 237, from: 24 },
            { kind: "paragraph", page: 237, from: 25 },
            { kind: "paragraph", page: 237, from: 26, to: 27 },
            { kind: "paragraph", page: 237, from: 28, to: 32 },
            { kind: "paragraph", page: 237, from: 33, to: 36 },
        ],
    },
    {
        number: "7.4.5.2",
        title: "COLLEGAMENTI",
        heading: { kind: "heading", page: 237, from: 37, norm: "7.4.5.2 COLLEGAMENTI" },
        blocks: [
            { kind: "paragraph", page: 237, from: 38, to: 39 },
            { kind: "paragraph", page: 237, from: 40, to: 42 },
            { kind: "paragraph", page: 237, from: 43 },
            { kind: "paragraph", page: 237, from: 44, to: 45 },
            { kind: "paragraph", page: 237, from: 46, to: 49 },
            { kind: "paragraph", page: 237, from: 50, to: 54 },
            { kind: "paragraph", page: 238, from: 3, to: 4 },
            { kind: "paragraph", page: 238, from: 5, to: 6 },
            { kind: "paragraph", page: 238, from: 7, to: 8 },
            { kind: "paragraph", page: 238, from: 9, to: 11 },
            { kind: "paragraph", page: 238, from: 12, to: 14 },
            { kind: "list-item", page: 238, from: 15, to: 16 },
            { kind: "list-item", page: 238, from: 17, to: 18 },
            { kind: "list-item", page: 238, from: 19, to: 20 },
        ],
    },
];

const formulae: Record<string, [string, string | null, number, string]> = {
    "7.4.13": ["7.4.4.5.1", "7.4.13", 234, "h_{cr}=\\max\\left(l_w,\\frac{h_w}{6}\\right)\\quad\\text{purché}\\quad h_{cr}\\le\\begin{cases}2l_w\\\\h_s&\\text{per }n\\le6\\text{ piani}\\\\2h_s&\\text{per }n\\ge7\\text{ piani}\\end{cases}"],
    "7.4.14": ["7.4.4.5.1", "7.4.14", 234, "1{,}5\\le q\\sqrt{\\left(\\frac{\\gamma_{Rd}}{q}\\frac{M_{Rd}}{M_{Ed}}\\right)^2+0{,}1\\left(\\frac{S_e(T_C)}{S_e(T_1)}\\right)^2}\\le q\\quad\\text{per pareti snelle}"],
    "7.4.15": ["7.4.4.5.1", "7.4.15", 234, "\\gamma_{Rd}\\frac{M_{Rd}}{M_{Ed}}\\le q\\quad\\text{per pareti tozze}"],
    "7.4.16": ["7.4.4.5.1", "7.4.16", 235, "V_{Ed}\\le V_{Rd,c}+0{,}75\\rho_h f_{yd,h}b_w\\alpha_s l_w"],
    "7.4.17": ["7.4.4.5.1", "7.4.17", 235, "\\rho_h f_{yd,h}b_w z\\le\\rho_v f_{yd,v}b_w z+\\min N_{Ed}"],
    "7.4.18": ["7.4.4.5.1", "7.4.18", 235, "V_{Ed}\\le V_{Rd,S}"],
    "7.4.19": ["7.4.4.5.1", "7.4.19", 235, "V_{Rd,S}=V_{dd}+V_{id}+V_{fd}"],
    "7.4.20": ["7.4.4.5.1", "7.4.20", 235, "V_{dd}=\\min\\begin{cases}1{,}3\\sum A_{sj}\\sqrt{f_{cd}f_{yd}}\\\\0{,}25f_{yd}\\sum A_{sj}\\end{cases}"],
    "7.4.21": ["7.4.4.5.1", "7.4.21", 235, "V_{id}=f_{yd}\\sum A_{si}\\cos\\varphi_i"],
    "7.4.22": ["7.4.4.5.1", "7.4.22", 236, "V_{fd}=\\min\\begin{cases}\\mu_f\\left[\\left(\\sum A_{sj}f_{yd}+N_{Ed}\\right)\\xi+M_{Ed}/z\\right]\\\\0{,}5\\eta f_{cd}\\xi l_w b_{wo}\\end{cases}"],
    "7.4.23": ["7.4.4.6", "7.4.23", 237, "V_{Ed}\\le f_{ctd}bd"],
    "7.4.24": ["7.4.4.6", "7.4.24", 237, "V_{Ed}\\le2A_s f_{yd}\\sin\\varphi"],
};

export const unitId = (n: string): string => `urn:structural-codes:it:unit:ntc2018:${n}`;
const out = join(root, "corpus", "units", "ntc2018");
await mkdir(out, { recursive: true });
for (const unit of units) {
    const id = unitId(unit.number);
    const all = [unit.heading, ...unit.blocks].map((block, index) => {
        let source = raw(block.page, block.from, block.to);
        if (unit.number === "7.4.4.5" && index === 1) source += `\n${raw(233, 3, 7)}`;
        const norm = block.norm ?? normalized(source);
        const blockId = index === 0 ? "block-heading" : `block-editorial-${String(index).padStart(3, "0")}`;
        if (block.asset) {
            return { blockId: `${id}#${blockId}`, kind: block.kind, origin: "official", assetId: block.asset, evidence: ev(block.page, source, source, block.region ?? null) };
        }
        const segments = block.inline ?? inline(norm);
        return { blockId: `${id}#${blockId}`, kind: block.kind, origin: "official", text: { raw: source, normalized: norm, normalizationVersion: profile, ...(segments ? { inline: segments } : {}) }, evidence: ev(block.page, source, norm) };
    });
    const parts = unit.number.split(".");
    const ancestors = parts.slice(1).map((_, i) => unitId(parts.slice(0, i + 1).join(".")));
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit",
        id, workId: "it-mit:dm:2018-01-17:ntc2018", expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: parts.length === 2 ? "section" : parts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: parts.map((x) => x.padStart(3, "0")).join(".") },
        title: unit.title, titleBlockId: `${id}#block-heading`,
        hierarchy: { parentId: unitId(parts.slice(0, -1).join(".")), ancestorIds: ancestors, position: Number(parts.at(-1)) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-07-28" },
        blocks: all, citations: [], relations: [],
        assets: {
            formulaIds: all.filter((b) => b.kind === "formula-ref").map((b: any) => b.assetId),
            tableIds: [],
            figureIds: all.filter((b) => b.kind === "figure-ref").map((b: any) => b.assetId),
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:ntc74:step2", kind: "script", toolVersion: profile },
            createdAt: "2026-07-28T13:00:00Z", reviews: [],
            openIssues: [
                { issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata dal modello con il render ufficiale; resta obbligatoria la revisione umana indipendente." },
                ...(unit.crossPage ? [{ issueId: "ntc2018-7-4-4-5-multipage-evidence", type: "missing-region", severity: "blocking", note: "Il primo capoverso continua dalla pagina PDF 232 alla 233; il testo è unito correttamente, ma lo schema evidence corrente registra una sola pagina per blocco." }] : []),
            ],
        },
    };
    await writeFile(join(out, `${unit.number}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const figures = [
    ["7.4.3", "7.4.4.5.1", 233, "Fig. 7.4.3 – Sezioni resistenti delle pareti semplici e composte (la freccia indica la direzione del sisma)", [85, 215, 515, 470]],
    ["7.4.4", "7.4.4.5.1", 234, "Fig. 7.4.4 – Traslazione del diagramma dei momenti flettenti per strutture a pareti e strutture miste", [120, 95, 480, 300]],
    ["7.4.5", "7.4.4.5.1", 235, "Fig. 7.4.5 – Diagramma di inviluppo delle forze di taglio nelle pareti di strutture miste", [165, 85, 440, 282]],
    ["7.4.6", "7.4.4.5.2", 236, "Fig. 7.4.6 – Elementi di bordo di una parete, diagramma delle corrispondenti curvature, schema esemplificativo delle armature di confinamento", [160, 400, 435, 590]],
] as const;
const figureHashes: Record<string, string> = {
    "7.4.3": "22f65adc9060b7489aaee49e2d567373dec1dcf3f64b4926dadc3369fa617ffa",
    "7.4.4": "7956a110be1bd5a40d5d8ee0411f254845cd1ca7915b5f261c1b50f9a894165f",
    "7.4.5": "2f2a9a9470e73026727c73d62de6da6539780fb815b4a7b802f9da3f4b69bf4e",
    "7.4.6": "104e3fe2d1088e57c0646f794151f9c00e1c01434cb4b7395e82a86188f3a67a",
};
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest",
    document: "ntc2018", section: "7.4-step2", sourceId, status: "transcribed-unreviewed",
    formulas: Object.entries(formulae).map(([key, [unit, number, page, latex]]) => ({ id: aid("formula", key), unitId: unitId(unit), officialNumber: number, pdfPage: page, latex })),
    tables: [],
    figures: figures.map(([number, unit, page, caption, box]) => ({
        id: aid("figure", number), unitId: unitId(unit), officialNumber: number, pdfPage: page, caption, alt: caption,
        imagePath: `figures/ntc2018/fig${number}.png`,
        region: { coordinateSystem: "pdf-points-top-left", x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] },
        sha256: figureHashes[number],
    })),
};
await writeFile(join(root, "corpus", "assets", "ntc2018", "7.4-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc74-step2: generated ${units.length} units`);
