/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc11-editorial-profile-0.1.0";
const unitDir = join(repoRoot, "corpus", "units", "ntc2018");
const manifestDir = join(repoRoot, "corpus", "assets", "ntc2018");
const figureDir = join(repoRoot, "corpus", "assets", "figures", "ntc2018");
const evidenceRenderDir = join(repoRoot, "evidence", sourceId, "renders");

function assetId(kind: "formula" | "table" | "figure", number: string): string {
    const slug = number.toLowerCase().replaceAll(/[^a-z0-9:._-]+/gu, "-");
    return `urn:structural-codes:it:asset:${kind}:ntc2018:${slug}`;
}

function sha256(value: Buffer | string): string {
    return createHash("sha256").update(value).digest("hex");
}

type VerifiedInlineToken = { value: string; latex: string };

function verifiedInline(text: string, tokens: VerifiedInlineToken[]): any[] {
    const segments: any[] = [];
    let cursor = 0;
    for (const token of tokens) {
        const index = text.indexOf(token.value, cursor);
        if (index < 0) throw new Error(`Token inline non trovato: ${token.value} in ${text}`);
        if (index > cursor) segments.push({ kind: "text", value: text.slice(cursor, index) });
        segments.push({ kind: "math", value: token.value, latex: token.latex });
        cursor = index + token.value.length;
    }
    if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
    return segments;
}

function escapeRegExp(value: string): string {
    return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function clean(value: string): string {
    return value
        .replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
        .replaceAll(/\s+/gu, " ")
        .trim();
}

function tableNumberPattern(officialNumber: string): RegExp {
    const parts = officialNumber.split(/\s+/u).map(escapeRegExp);
    return new RegExp(`^Tab\\.\\s*${parts.join("\\s*")}`, "u");
}

function formulaMarkerPattern(marker: string): RegExp {
    return new RegExp(`\\[${escapeRegExp(marker)}\\]`, "u");
}

function refEvidence(block: any): any {
    return {
        ...block.evidence,
        transformations: [
            ...(block.evidence.transformations ?? []),
            {
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Asset collocato nella posizione del blocco evidence dopo confronto visivo con il render ufficiale.",
            },
        ],
    };
}

type FormulaDef = { number: string; unit: string; page: number; marker: string; latex: string };
type TableDef = { number: string; unit: string; page: number };

const formulas: FormulaDef[] = [
    { number: "11.2.7", unit: "11.2.10.6", page: 318, marker: "2.7", latex: "\\varepsilon_{cd,\\infty}=k_h\\varepsilon_{c0}" },
    { number: "11.2.8", unit: "11.2.10.6", page: 318, marker: "2.8", latex: "\\varepsilon_{cd}(t)=\\beta_{ds}(t-t_s)\\cdot\\varepsilon_{cd,\\infty}" },
    { number: "11.2.9", unit: "11.2.10.6", page: 318, marker: "2.9", latex: "\\beta_{ds}(t-t_s)=\\frac{t-t_s}{(t-t_s)+0{,}04h_0^{3/2}}" },
    { number: "11.2.10", unit: "11.2.10.6", page: 318, marker: "2.10", latex: "\\varepsilon_{ca,\\infty}=-2{,}5\\cdot(f_{ck}-10)\\cdot10^{-6}" },
    { number: "11.3.1", unit: "11.3.2.5", page: 325, marker: "3.1", latex: "\\frac{\\varnothing_{\\min}}{\\varnothing_{\\max}}\\ge0{,}6" },
    { number: "11.3.2", unit: "11.3.2.6", page: 325, marker: "3.2", latex: "C_{eq}=C+\\frac{Mn}{6}+\\frac{Cr+Mo+V}{5}+\\frac{Ni+Cu}{15}" },
    { number: "11.3.3", unit: "11.3.2.10.1.3", page: 327, marker: "3.3", latex: "\\bar{x}-ks\\ge C_v" },
    { number: "11.3.4", unit: "11.3.2.10.1.3", page: 327, marker: "3.4", latex: "\\bar{x}+ks\\le C_v" },
    { number: "11.3.5", unit: "11.3.2.10.4", page: 329, marker: "3.5", latex: "\\tau_m\\ge0{,}098(80-1{,}2\\varnothing)" },
    { number: "11.3.6", unit: "11.3.2.10.4", page: 329, marker: "3.6", latex: "\\tau_r\\ge0{,}098(130-1{,}9\\varnothing)" },
    { number: "11.7.1", unit: "11.7.1.1", page: 350, marker: "7.1", latex: "k_h=\\min\\left\\{\\left[\\left(\\frac{150}{h}\\right)^{0{,}2};1{,}3\\right]\\right\\}" },
    { number: "11.7.2", unit: "11.7.1.1", page: 350, marker: "7.2", latex: "k_h=\\min\\left\\{\\left[\\left(\\frac{600}{h}\\right)^{0{,}1};1{,}1\\right]\\right\\}" },
    { number: "11.9.1", unit: "11.9.4", page: 360, marker: "9.1", latex: "\\xi_e<15\\%" },
    { number: "11.9.2", unit: "11.9.4", page: 360, marker: "9.2", latex: "\\left|K_e-K_{in}\\right|/K_{in}<20\\%" },
    { number: "11.9.3", unit: "11.9.4", page: 360, marker: "9.3", latex: "\\left|K_{e,(i)}-K_{e,(3)}\\right|/K_{e,(3)}\\le10\\%" },
    { number: "11.9.4", unit: "11.9.4", page: 360, marker: "9.4", latex: "\\left|\\xi_{e,(i)}-\\xi_{e,(3)}\\right|/\\xi_{e,(3)}\\le10\\%" },
    { number: "11.9.5", unit: "11.9.5", page: 361, marker: "9.5", latex: "\\left|K_{2,(i)}-K_{2,(3)}\\right|/K_{2,(3)}\\le10\\%" },
    { number: "11.9.6", unit: "11.9.5", page: 361, marker: "9.6", latex: "\\left|\\xi_{e,(i)}-\\xi_{e,(3)}\\right|/\\xi_{e,(3)}\\le10\\%" },
    { number: "11.9.7", unit: "11.9.6", page: 362, marker: "9.7", latex: "\\left|E_{d,(i)}-E_{d,(3)}\\right|/E_{d,(3)}\\le10\\%" },
    { number: "11.9.8", unit: "11.9.6", page: 362, marker: "9.8", latex: "\\gamma_v=(1+t_d)\\cdot(1{,}5)^\\alpha" },
    { number: "11.9.9", unit: "11.9.8", page: 363, marker: "9.9", latex: "\\left|f_{(i)}-f_{(3)}\\right|/f_{(3)}\\le0{,}25" },
    { number: "11.10.1", unit: "11.10.1.1.1", page: 365, marker: "10.1", latex: "\\frac{f_1+f_2+\\cdots+f_n}{n}\\ge f_{bm}" },
    { number: "11.10.2", unit: "11.10.1.1.1", page: 365, marker: "10.2", latex: "f_1\\ge0{,}80f_{bm}" },
    { number: "11.10.3", unit: "11.10.3.1.2", page: 368, marker: "10.3", latex: "f_{bk}=0{,}75f_{bm}" },
    { number: "11.10.4", unit: "11.10.3.3", page: 369, marker: "10.4", latex: "f_{vk}=f_{vk0}+0{,}4\\sigma_n" },
    { number: "11.10.5", unit: "11.10.3.3", page: 369, marker: "10.5", latex: "f_{vk}\\le f_{vk,\\lim}" },
    { number: "11.10.6", unit: "11.10.3.3", page: 369, marker: "10.6", latex: "f_{vk,\\lim}=0{,}065f_b" },
    { number: "11.10.7", unit: "11.10.3.3", page: 369, marker: "10.7", latex: "f_{vk,\\lim}=0{,}10f_b" },
    { number: "11.10.8", unit: "11.10.3.4", page: 369, marker: "10.8", latex: "E=1000f_k" },
    { number: "11.10.9", unit: "11.10.3.4", page: 369, marker: "10.9", latex: "G=0.4E" },
];

const tables: TableDef[] = [
    { number: "11.2.Va", unit: "11.2.10.6", page: 318 },
    { number: "11.2.Vb", unit: "11.2.10.6", page: 318 },
    { number: "11.2.VI", unit: "11.2.10.7", page: 318 },
    { number: "11.2.VII", unit: "11.2.10.7", page: 318 },
    { number: "11.3.Ia", unit: "11.3.2.1", page: 323 },
    { number: "11.3.Ib", unit: "11.3.2.1", page: 324 },
    { number: "11.3.Ic", unit: "11.3.2.2", page: 324 },
    { number: "11.3.II", unit: "11.3.2.6", page: 325 },
    { number: "11.3.III", unit: "11.3.2.7", page: 326 },
    { number: "11.3.IV", unit: "11.3.2.10.1.3", page: 327 },
    { number: "11.3.V", unit: "11.3.2.10.1.3", page: 327 },
    { number: "11.3.VI a", unit: "11.3.2.10.3", page: 328 },
    { number: "11.3.VI b", unit: "11.3.2.10.4", page: 330 },
    { number: "11.3.VII a", unit: "11.3.2.12", page: 331 },
    { number: "11.3.VII b", unit: "11.3.2.12", page: 331 },
    { number: "11.3.VIII", unit: "11.3.3.2", page: 333 },
    { number: "11.3.IX", unit: "11.3.3.3", page: 334 },
    { number: "11.3.X", unit: "11.3.3.5.2.3", page: 337 },
    { number: "11.3.XI", unit: "11.3.3.5.2.3", page: 338 },
    { number: "11.3.XII", unit: "11.3.4.5", page: 342 },
    { number: "11.3.XIII.a", unit: "11.3.4.6.1", page: 342 },
    { number: "11.3.XIII.b", unit: "11.3.4.6.1", page: 342 },
    { number: "11.3.XIV", unit: "11.3.4.6.2", page: 342 },
    { number: "11.7.I", unit: "11.7.1.1", page: 349 },
    { number: "11.9.I", unit: "11.9.4", page: 360 },
    { number: "11.9.II", unit: "11.9.5", page: 361 },
    { number: "11.9.III", unit: "11.9.6", page: 362 },
    { number: "11.9.IV", unit: "11.9.7", page: 363 },
    { number: "11.10.I", unit: "11.10.1", page: 365 },
    { number: "11.10.II", unit: "11.10.2.1", page: 366 },
    { number: "11.10.III", unit: "11.10.2.1", page: 366 },
    { number: "11.10.IV", unit: "11.10.2.2", page: 366 },
    { number: "11.10.V", unit: "11.10.2.2", page: 366 },
    { number: "11.10.VI", unit: "11.10.3.1.2", page: 367 },
    { number: "11.10.VII", unit: "11.10.3.1.2", page: 368 },
    { number: "11.10.VIII", unit: "11.10.3.2.2", page: 368 },
];

const verifiedTables: Record<string, any> = {
    "11.2.Va": {
        caption: "Tab. 11.2.Va – Valori di εc0",
        columnCount: 7,
        headers: [
            [{ text: "fck", latex: "f_{ck}", rowSpan: 3 }, { text: "Deformazione da ritiro per essiccamento (in ‰)", colSpan: 6 }],
            [{ text: "Umidità Relativa (in %)", colSpan: 6 }],
            ["20", "40", "60", "80", "90", "100"].map((text) => ({ text, latex: text })),
        ],
        rows: [
            ["20", "-0,62", "-0,58", "-0,49", "-0,30", "-0,17", "+0,00"],
            ["40", "-0,48", "-0,46", "-0,38", "-0,24", "-0,13", "+0,00"],
            ["60", "-0,38", "-0,36", "-0,30", "-0,19", "-0,10", "+0,00"],
            ["80", "-0,30", "-0,28", "-0,24", "-0,15", "-0,07", "+0,00"],
        ].map((row) => row.map((text) => ({ text, latex: text.replace("-", "-").replace(",", "{,}") }))),
    },
    "11.2.Vb": {
        caption: "Tab. 11.2.Vb – Valori di kh",
        columnCount: 2,
        headers: [[{ text: "h0 (mm)", latex: "h_0\\;[\\mathrm{mm}]" }, { text: "kh", latex: "k_h" }]],
        rows: [
            [{ text: "100", latex: "100" }, { text: "1,00", latex: "1{,}00" }],
            [{ text: "200", latex: "200" }, { text: "0,85", latex: "0{,}85" }],
            [{ text: "300", latex: "300" }, { text: "0,75", latex: "0{,}75" }],
            [{ text: "≥ 500", latex: "\\ge500" }, { text: "0,70", latex: "0{,}70" }],
        ],
    },
    "11.2.VI": {
        caption: "Tab. 11.2.VI – Valori di φ(∞, t0). Atmosfera con umidità relativa di circa il 75%",
        columnCount: 5,
        headers: [[
            { text: "t0", latex: "t_0" },
            { text: "h0 ≤ 75 mm", latex: "h_0\\le75\\;\\mathrm{mm}" },
            { text: "h0 = 150 mm", latex: "h_0=150\\;\\mathrm{mm}" },
            { text: "h0 = 300 mm", latex: "h_0=300\\;\\mathrm{mm}" },
            { text: "h0 ≥ 600 mm", latex: "h_0\\ge600\\;\\mathrm{mm}" },
        ]],
        rows: [
            ["3 giorni", "3,5", "3,2", "3,0", "2,8"],
            ["7 giorni", "2,9", "2,7", "2,5", "2,3"],
            ["15 giorni", "2,6", "2,4", "2,2", "2,1"],
            ["30 giorni", "2,3", "2,1", "1,9", "1,8"],
            ["≥ 60 giorni", "2,0", "1,8", "1,7", "1,6"],
        ].map((row) => row.map((text, index) => index === 0 ? { text } : { text, latex: text.replace(",", "{,}") })),
    },
    "11.2.VII": {
        caption: "Tab. 11.2.VII – Valori di φ(∞, t0). Atmosfera con umidità relativa di circa il 55%",
        columnCount: 5,
        headers: [[
            { text: "t0", latex: "t_0" },
            { text: "h0 ≤ 75 mm", latex: "h_0\\le75\\;\\mathrm{mm}" },
            { text: "h0 = 150 mm", latex: "h_0=150\\;\\mathrm{mm}" },
            { text: "h0 = 300 mm", latex: "h_0=300\\;\\mathrm{mm}" },
            { text: "h0 ≥ 600 mm", latex: "h_0\\ge600\\;\\mathrm{mm}" },
        ]],
        rows: [
            ["3 giorni", "4,5", "4,0", "3,6", "3,3"],
            ["7 giorni", "3,7", "3,3", "3,0", "2,8"],
            ["15 giorni", "3,3", "3,0", "2,7", "2,5"],
            ["30 giorni", "2,9", "2,6", "2,3", "2,2"],
            ["≥ 60 giorni", "2,5", "2,3", "2,1", "1,9"],
        ].map((row) => row.map((text, index) => index === 0 ? { text } : { text, latex: text.replace(",", "{,}") })),
    },
    "11.3.Ia": {
        caption: "Tab. 11.3.Ia",
        columnCount: 2,
        headers: [],
        rows: [
            [{ text: "fy nom", latex: "f_{y\\,\\mathrm{nom}}" }, { text: "450 N/mm²", latex: "450\\;\\mathrm{N/mm^2}" }],
            [{ text: "ft nom", latex: "f_{t\\,\\mathrm{nom}}" }, { text: "540 N/mm²", latex: "540\\;\\mathrm{N/mm^2}" }],
        ],
    },
    "11.3.Ib": {
        caption: "Tab. 11.3.Ib",
        columnCount: 3,
        headers: [[{ text: "Caratteristiche" }, { text: "Requisiti" }, { text: "Frattile (%)", latex: "\\mathrm{Frattile}\\;(\\%)" }]],
        rows: [
            [{ text: "Tensione caratteristica di snervamento fyk", latex: "\\text{Tensione caratteristica di snervamento } f_{yk}" }, { text: "≥ fy nom", latex: "\\ge f_{y\\,\\mathrm{nom}}" }, { text: "5.0", latex: "5.0" }],
            [{ text: "Tensione caratteristica a carico massimo ftk", latex: "\\text{Tensione caratteristica a carico massimo } f_{tk}" }, { text: "≥ ft nom", latex: "\\ge f_{t\\,\\mathrm{nom}}" }, { text: "5.0", latex: "5.0" }],
            [{ text: "(ft/fy)k", latex: "(f_t/f_y)_k", rowSpan: 2 }, { text: "≥ 1,15", latex: "\\ge1{,}15" }, { text: "10.0", latex: "10.0", rowSpan: 2 }],
            [{ text: "< 1,35", latex: "<1{,}35" }],
            [{ text: "(fy/fynom)k", latex: "(f_y/f_{y\\,\\mathrm{nom}})_k" }, { text: "≤ 1,25", latex: "\\le1{,}25" }, { text: "10.0", latex: "10.0" }],
            [{ text: "Allungamento (Agt)k", latex: "\\text{Allungamento }(A_{gt})_k" }, { text: "≥ 7,5%", latex: "\\ge7{,}5\\%" }, { text: "10.0", latex: "10.0" }],
            [{ text: "Diametro del mandrino per prove di piegamento a 90° e successivo raddrizzamento senza cricche: Ø < 12 mm", latex: "\\text{Diametro del mandrino per prove di piegamento a }90^\\circ\\text{ e successivo raddrizzamento senza cricche: }\\varnothing<12\\;\\mathrm{mm}" }, { text: "4 Ø", latex: "4\\varnothing" }, { text: "" }],
            [{ text: "12 ≤ Ø ≤ 16 mm", latex: "12\\le\\varnothing\\le16\\;\\mathrm{mm}" }, { text: "5 Ø", latex: "5\\varnothing" }, { text: "" }],
            [{ text: "per 16 < Ø ≤ 25 mm", latex: "\\text{per }16<\\varnothing\\le25\\;\\mathrm{mm}" }, { text: "8 Ø", latex: "8\\varnothing" }, { text: "" }],
            [{ text: "per 25 < Ø ≤ 40 mm", latex: "\\text{per }25<\\varnothing\\le40\\;\\mathrm{mm}" }, { text: "10 Ø", latex: "10\\varnothing" }, { text: "" }],
        ],
    },
    "11.3.Ic": {
        caption: "Tab. 11.3.Ic",
        columnCount: 3,
        headers: [[{ text: "Caratteristiche" }, { text: "Requisiti" }, { text: "Frattile (%)", latex: "\\mathrm{Frattile}\\;(\\%)" }]],
        rows: [
            [{ text: "Tensione caratteristica di snervamento fyk", latex: "\\text{Tensione caratteristica di snervamento } f_{yk}" }, { text: "≥ fy nom", latex: "\\ge f_{y\\,\\mathrm{nom}}" }, { text: "5.0", latex: "5.0" }],
            [{ text: "Tensione caratteristica a carico massimo ftk", latex: "\\text{Tensione caratteristica a carico massimo } f_{tk}" }, { text: "≥ ft nom", latex: "\\ge f_{t\\,\\mathrm{nom}}" }, { text: "5.0", latex: "5.0" }],
            [{ text: "(ft/fy)k", latex: "(f_t/f_y)_k" }, { text: "≥ 1,05", latex: "\\ge1{,}05" }, { text: "10.0", latex: "10.0" }],
            [{ text: "(fy/fynom)k", latex: "(f_y/f_{y\\,\\mathrm{nom}})_k" }, { text: "≤ 1,25", latex: "\\le1{,}25" }, { text: "10.0", latex: "10.0" }],
            [{ text: "Allungamento (Agt)k", latex: "\\text{Allungamento }(A_{gt})_k" }, { text: "≥ 2,5%", latex: "\\ge2{,}5\\%" }, { text: "10.0", latex: "10.0" }],
            [{ text: "Diametro del mandrino per prove di piegamento a 90° e successivo raddrizzamento senza cricche: per Ø ≤ 10 mm", latex: "\\text{Diametro del mandrino per prove di piegamento a }90^\\circ\\text{ e successivo raddrizzamento senza cricche: per }\\varnothing\\le10\\;\\mathrm{mm}" }, { text: "4 Ø", latex: "4\\varnothing" }, { text: "" }],
        ],
    },
    "11.3.II": {
        caption: "Tab. 11.3.II – Massimo contenuto di elementi chimici in %",
        columnCount: 4,
        headers: [[{ text: "" }, { text: "" }, { text: "Analisi di prodotto" }, { text: "Analisi di colata" }]],
        rows: [
            ["Carbonio", "C", "0,24", "0,22"],
            ["Fosforo", "P", "0,055", "0,050"],
            ["Zolfo", "S", "0,055", "0,050"],
            ["Rame", "Cu", "0,85", "0,80"],
            ["Azoto", "N", "0,014", "0,012"],
            ["Carbonio equivalente", "Ceq", "0,52", "0,50"],
        ].map((row) => row.map((text, index) => index === 1 ? { text, latex: text === "Ceq" ? "C_{eq}" : `\\mathrm{${text}}` } : index > 1 ? { text, latex: text.replace(",", "{,}") } : { text })),
    },
    "11.3.III": {
        caption: "Tab. 11.3.III",
        columnCount: 3,
        headers: [[
            { text: "Diametro nominale, (mm)", latex: "\\text{Diametro nominale }(\\mathrm{mm})" },
            { text: "5 ≤ Ø ≤ 8", latex: "5\\le\\varnothing\\le8" },
            { text: "8 < Ø ≤ 40", latex: "8<\\varnothing\\le40" },
        ]],
        rows: [[
            { text: "Tolleranza in % sulla massa nominale per metro", latex: "\\text{Tolleranza in }\\%\\text{ sulla massa nominale per metro}" },
            { text: "± 6", latex: "\\pm6" },
            { text: "± 4,5", latex: "\\pm4{,}5" },
        ]],
    },
    "11.3.IV": {
        caption: "Tab. 11.3.IV - fy – ft – Coefficiente k in funzione del numero n di campioni (per una probabilità di insuccesso attesa del 5% [p = 0,95] con una probabilità del 90%)",
        columnCount: 4,
        headers: [[{ text: "n", latex: "n" }, { text: "k", latex: "k" }, { text: "n", latex: "n" }, { text: "K", latex: "K" }]],
        rows: [
            ["5", "3,40", "30", "2,08"], ["6", "3,09", "40", "2,01"], ["7", "2,89", "50", "1,97"], ["8", "2,75", "60", "1,93"],
            ["9", "2,65", "70", "1,90"], ["10", "2,57", "80", "1,89"], ["11", "2,50", "90", "1,87"], ["12", "2,45", "100", "1,86"],
            ["13", "2,40", "150", "1,82"], ["14", "2,36", "200", "1,79"], ["15", "2,33", "250", "1,78"], ["16", "2,30", "300", "1,77"],
            ["17", "2,27", "400", "1,75"], ["18", "2,25", "500", "1,74"], ["19", "2,23", "1000", "1,71"], ["20", "2,21", "--", "1,64"],
        ].map((row) => row.map((text) => ({ text, latex: text === "--" ? "--" : text.replace(",", "{,}") }))),
    },
    "11.3.V": {
        caption: "Tab. 11.3.V - Agt, ft/fy, fy/fynom – Coefficiente k in funzione del numero n di campioni (per una probabilità di insuccesso attesa del 10% [p = 0,90] con una probabilità del 90%)",
        columnCount: 4,
        headers: [[{ text: "n", latex: "n" }, { text: "k", latex: "k" }, { text: "n", latex: "n" }, { text: "K", latex: "K" }]],
        rows: [
            ["5", "2,74", "30", "1,66"], ["6", "2,49", "40", "1,60"], ["7", "2,33", "50", "1,56"], ["8", "2,22", "60", "1,53"],
            ["9", "2,13", "70", "1,51"], ["10", "2,07", "80", "1,49"], ["11", "2,01", "90", "1,48"], ["12", "1,97", "100", "1,47"],
            ["13", "1,93", "150", "1,43"], ["14", "1,90", "200", "1,41"], ["15", "1,87", "250", "1,40"], ["16", "1,84", "300", "1,39"],
            ["17", "1,82", "400", "1,37"], ["18", "1,80", "500", "1,36"], ["19", "1,78", "1000", "1,34"], ["20", "1,77", "–", "1,282"],
        ].map((row) => row.map((text) => ({ text, latex: text === "–" ? "-" : text.replace(",", "{,}") }))),
    },
    "11.3.VI a": {
        caption: "Tab. 11.3.VI a) – Valori di accettazione nei centri di trasformazione – barre e rotoli dopo la raddrizzatura",
        columnCount: 3,
        headers: [[{ text: "Caratteristica" }, { text: "Valore limite" }, { text: "Note" }]],
        rows: [
            [{ text: "fy minimo", latex: "f_y\\;\\mathrm{minimo}" }, { text: "425 N/mm²", latex: "425\\;\\mathrm{N/mm^2}" }, { text: "per acciai B450A e B450C" }],
            [{ text: "fy massimo", latex: "f_y\\;\\mathrm{massimo}" }, { text: "572 N/mm²", latex: "572\\;\\mathrm{N/mm^2}" }, { text: "per acciai B450A e B450C" }],
            [{ text: "Agt minimo", latex: "A_{gt}\\;\\mathrm{minimo}" }, { text: "≥ 6,0%", latex: "\\ge6{,}0\\%" }, { text: "per acciai B450C" }],
            [{ text: "Agt minimo", latex: "A_{gt}\\;\\mathrm{minimo}" }, { text: "≥ 2,0%", latex: "\\ge2{,}0\\%" }, { text: "per acciai B450A" }],
            [{ text: "ft / fy", latex: "f_t/f_y" }, { text: "1,13 ≤ ft / fy ≤ 1,37", latex: "1{,}13\\le f_t/f_y\\le1{,}37" }, { text: "per acciai B450C" }],
            [{ text: "ft / fy", latex: "f_t/f_y" }, { text: "ft / fy ≥ 1,03", latex: "f_t/f_y\\ge1{,}03" }, { text: "per acciai B450A" }],
            [{ text: "Piegamento / Raddrizzamento" }, { text: "Assenza di cricche" }, { text: "per acciai B450A e B450C" }],
            [{ text: "fr / fp", latex: "f_r/f_p" }, { text: "per 5 mm ≤ Ø ≤ 6 mm ≥ 0.035; per 6 mm ≤ Ø ≤ 12 mm ≥ 0.040; per Ø ≥ 12 mm ≥ 0.056", latex: "\\begin{gathered}\\text{per }5\\;\\mathrm{mm}\\le\\varnothing\\le6\\;\\mathrm{mm}\\quad\\ge0.035\\\\\\text{per }6\\;\\mathrm{mm}\\le\\varnothing\\le12\\;\\mathrm{mm}\\quad\\ge0.040\\\\\\text{per }\\varnothing\\ge12\\;\\mathrm{mm}\\quad\\ge0.056\\end{gathered}" }, { text: "per acciai B450A e B450C provenienti da rotolo" }],
        ],
    },
    "11.3.VI b": {
        caption: "Tab. 11.3.VI b)",
        columnCount: 4,
        headers: [[{ text: "" }, { text: "" }, { text: "Barre" }, { text: "Rotoli" }]],
        rows: [
            [{ text: "per 5 ≤ Ø ≤ 6 mm", latex: "\\text{per }5\\le\\varnothing\\le6\\;\\mathrm{mm}" }, { text: "fr oppure fp ≥", latex: "f_r\\text{ oppure }f_p\\ge" }, { text: "0.035", latex: "0.035" }, { text: "0.037", latex: "0.037" }],
            [{ text: "per 6 < Ø ≤ 12 mm", latex: "\\text{per }6<\\varnothing\\le12\\;\\mathrm{mm}" }, { text: "fr oppure fp ≥", latex: "f_r\\text{ oppure }f_p\\ge" }, { text: "0.040", latex: "0.040" }, { text: "0.042", latex: "0.042" }],
            [{ text: "per Ø > 12 mm", latex: "\\text{per }\\varnothing>12\\;\\mathrm{mm}" }, { text: "fr oppure fp ≥", latex: "f_r\\text{ oppure }f_p\\ge" }, { text: "0.056", latex: "0.056" }, { text: "0.059", latex: "0.059" }],
        ],
    },
    "11.3.VII a": {
        caption: "Tab. 11.3.VII a) – Valori di accettazione in cantiere – barre",
        columnCount: 3,
        headers: [[{ text: "Caratteristica" }, { text: "Valore limite" }, { text: "Note" }]],
        rows: [
            [{ text: "fy minimo", latex: "f_y\\;\\mathrm{minimo}" }, { text: "425 N/mm²", latex: "425\\;\\mathrm{N/mm^2}" }, { text: "per acciai B450A e B450C" }],
            [{ text: "fy massimo", latex: "f_y\\;\\mathrm{massimo}" }, { text: "572 N/mm²", latex: "572\\;\\mathrm{N/mm^2}" }, { text: "per acciai B450A e B450C" }],
            [{ text: "Agt minimo", latex: "A_{gt}\\;\\mathrm{minimo}" }, { text: "≥ 6,0%", latex: "\\ge6{,}0\\%" }, { text: "per acciai B450C" }],
            [{ text: "Agt minimo", latex: "A_{gt}\\;\\mathrm{minimo}" }, { text: "≥ 2,0%", latex: "\\ge2{,}0\\%" }, { text: "per acciai B450A" }],
            [{ text: "ft / fy", latex: "f_t/f_y" }, { text: "1,13 ≤ ft / fy ≤ 1,37", latex: "1{,}13\\le f_t/f_y\\le1{,}37" }, { text: "per acciai B450C" }],
            [{ text: "ft / fy", latex: "f_t/f_y" }, { text: "ft / fy ≥ 1,03", latex: "f_t/f_y\\ge1{,}03" }, { text: "per acciai B450A" }],
            [{ text: "Piegamento/raddrizzamento" }, { text: "assenza di cricche" }, { text: "per acciai B450A e B450C" }],
        ],
    },
    "11.3.VII b": {
        caption: "Tab. 11.3.VII b) – Valori di accettazione in cantiere – reti e tralicci",
        columnCount: 3,
        headers: [[{ text: "Caratteristica" }, { text: "Valore limite" }, { text: "Note" }]],
        rows: [
            [{ text: "fy minimo", latex: "f_y\\;\\mathrm{minimo}" }, { text: "425 N/mm²", latex: "425\\;\\mathrm{N/mm^2}" }, { text: "per acciai B450A e B450C" }],
            [{ text: "fy massimo", latex: "f_y\\;\\mathrm{massimo}" }, { text: "572 N/mm²", latex: "572\\;\\mathrm{N/mm^2}" }, { text: "per acciai B450A e B450C" }],
            [{ text: "Agt minimo", latex: "A_{gt}\\;\\mathrm{minimo}" }, { text: "≥ 6,0%", latex: "\\ge6{,}0\\%" }, { text: "per acciai B450C" }],
            [{ text: "Agt minimo", latex: "A_{gt}\\;\\mathrm{minimo}" }, { text: "≥ 2,0%", latex: "\\ge2{,}0\\%" }, { text: "per acciai B450A" }],
            [{ text: "ft / fy", latex: "f_t/f_y" }, { text: "1,13 ≤ ft / fy ≤ 1,37", latex: "1{,}13\\le f_t/f_y\\le1{,}37" }, { text: "per acciai B450C" }],
            [{ text: "ft / fy", latex: "f_t/f_y" }, { text: "ft / fy ≥ 1,03", latex: "f_t/f_y\\ge1{,}03" }, { text: "per acciai B450A" }],
            [{ text: "Distacco del nodo" }, { text: "≥ Sez. nom. Ø maggiore × 450 × 25%", latex: "\\ge\\text{Sez. nom. }\\varnothing\\text{ maggiore}\\times450\\times25\\%" }, { text: "per acciai B450A e B450C" }],
        ],
    },
    "11.3.VIII": {
        caption: "Tab. 11.3.VIII",
        columnCount: 5,
        headers: [[{ text: "Tipo di acciaio" }, { text: "Barre" }, { text: "Fili" }, { text: "Trefoli e trecce" }, { text: "Trefoli compattati" }]],
        rows: [
            [{ text: "Tensione caratteristica al carico massimo fptk N/mm²", latex: "\\text{Tensione caratteristica al carico massimo }f_{ptk}\\;\\mathrm{N/mm^2}" }, { text: "≥ 1000", latex: "\\ge1000" }, { text: "≥ 1570", latex: "\\ge1570" }, { text: "≥ 1860", latex: "\\ge1860" }, { text: "≥ 1820", latex: "\\ge1820" }],
            [{ text: "Tensione caratteristica allo 0,1% di deformazione residua - scostamento dalla proporzionalità fp(0,1)k N/mm²", latex: "\\text{Tensione caratteristica allo }0{,}1\\%\\text{ di deformazione residua - scostamento dalla proporzionalità }f_{p(0{,}1)k}\\;\\mathrm{N/mm^2}" }, { text: "na" }, { text: "≥ 1420", latex: "\\ge1420" }, { text: "na" }, { text: "na" }],
            [{ text: "Tensione caratteristica all’1% di deformazione totale fp(1)k N/mm²", latex: "\\text{Tensione caratteristica all’}1\\%\\text{ di deformazione totale }f_{p(1)k}\\;\\mathrm{N/mm^2}" }, { text: "na" }, { text: "na" }, { text: "≥ 1670", latex: "\\ge1670" }, { text: "≥ 1620", latex: "\\ge1620" }],
            [{ text: "Tensione caratteristica di snervamento fpyk N/mm²", latex: "\\text{Tensione caratteristica di snervamento }f_{pyk}\\;\\mathrm{N/mm^2}" }, { text: "≥ 800", latex: "\\ge800" }, { text: "na" }, { text: "na" }, { text: "na" }],
            [{ text: "Allungamento totale percentuale a carico massimo Agt", latex: "\\text{Allungamento totale percentuale a carico massimo }A_{gt}" }, { text: "≥ 3,5", latex: "\\ge3{,}5" }, { text: "≥ 3,5", latex: "\\ge3{,}5" }, { text: "≥ 3,5", latex: "\\ge3{,}5" }, { text: "≥ 3,5", latex: "\\ge3{,}5" }],
        ],
        notes: ["na=non applicabile"],
    },
    "11.3.IX": {
        caption: "Tab. 11.3.IX",
        columnCount: 2,
        headers: [[{ text: "armatura Prodotto" }, { text: "ρ1000", latex: "\\rho_{1000}" }]],
        rows: [
            [{ text: "Trecce, filo o trefolo stabilizzato" }, { text: "2,5", latex: "2{,}5" }],
            [{ text: "Barre laminate a caldo" }, { text: "4,0", latex: "4{,}0" }],
        ],
    },
    "11.3.X": {
        caption: "Tab. 11.3.X - Dimensioni e tolleranze per le impronte dei fili, delle trecce e dei trefoli improntati (mm).",
        columnCount: 5,
        headers: [[
            { text: "Diametro nominale del prodotto Ø", latex: "\\text{Diametro nominale del prodotto }\\varnothing", colSpan: 2 },
            { text: "Limiti della profondità massima delle impronte" },
            { text: "Lunghezza delle impronte e relativa tolleranza “l”", latex: "\\text{Lunghezza delle impronte e relativa tolleranza }l" },
            { text: "Distanza tra le impronte e relativa tolleranza" },
        ]],
        rows: [
            [{ text: "Fili", rowSpan: 3 }, { text: "Ø ≤ 5 mm", latex: "\\varnothing\\le5\\;\\mathrm{mm}" }, { text: "Minimo = 0,03; Massimo = 0,16", latex: "\\begin{gathered}\\mathrm{Minimo}=0{,}03\\\\\\mathrm{Massimo}=0{,}16\\end{gathered}" }, { text: "3,5 ± 0,5", latex: "3{,}5\\pm0{,}5" }, { text: "5,5 ± 0,5", latex: "5{,}5\\pm0{,}5" }],
            [{ text: "5 mm < Ø ≤ 8 mm", latex: "5\\;\\mathrm{mm}<\\varnothing\\le8\\;\\mathrm{mm}" }, { text: "Minimo = 0,05; Massimo = 0,20", latex: "\\begin{gathered}\\mathrm{Minimo}=0{,}05\\\\\\mathrm{Massimo}=0{,}20\\end{gathered}" }, { text: "5,0 ± 0,5", latex: "5{,}0\\pm0{,}5", rowSpan: 2 }, { text: "8,0 ± 0,5", latex: "8{,}0\\pm0{,}5", rowSpan: 2 }],
            [{ text: "8 mm < Ø ≤ 11 mm", latex: "8\\;\\mathrm{mm}<\\varnothing\\le11\\;\\mathrm{mm}" }, { text: "Minimo = 0,05; Massimo = 0,25", latex: "\\begin{gathered}\\mathrm{Minimo}=0{,}05\\\\\\mathrm{Massimo}=0{,}25\\end{gathered}" }],
            [{ text: "Trecce e trefoli", rowSpan: 2 }, { text: "Ø ≤ 12 mm", latex: "\\varnothing\\le12\\;\\mathrm{mm}" }, { text: "Minimo = 0,03; Massimo = 0,09", latex: "\\begin{gathered}\\mathrm{Minimo}=0{,}03\\\\\\mathrm{Massimo}=0{,}09\\end{gathered}" }, { text: "3,5 ± 0,5", latex: "3{,}5\\pm0{,}5", rowSpan: 2 }, { text: "5,5 ± 0,5", latex: "5{,}5\\pm0{,}5", rowSpan: 2 }],
            [{ text: "Ø > 12 mm", latex: "\\varnothing>12\\;\\mathrm{mm}" }, { text: "Minimo = 0,04; Massimo = 0,10", latex: "\\begin{gathered}\\mathrm{Minimo}=0{,}04\\\\\\mathrm{Massimo}=0{,}10\\end{gathered}" }],
        ],
    },
    "11.3.XI": {
        caption: "Tab. 11.3.XI - Valori inferiori della tensione di prova, σ2 (MPa), nella prova di verifica della resistenza a fatica",
        columnCount: 3,
        headers: [],
        rows: [
            [{ text: "Fili lisci, trecce e trefoli con fili lisci" }, { text: "σ1 − 200 MPa", latex: "\\sigma_1-200\\;\\mathrm{MPa}", colSpan: 2 }],
            [{ text: "Fili improntati, trecce e trefoli con fili improntati" }, { text: "σ1 − 180 MPa", latex: "\\sigma_1-180\\;\\mathrm{MPa}", colSpan: 2 }],
            [{ text: "Barre lisce" }, { text: "σ1 − 200 MPa (Ø ≤ 40 mm)", latex: "\\sigma_1-200\\;\\mathrm{MPa}\\;(\\varnothing\\le40\\;\\mathrm{mm})" }, { text: "σ1 − 150 MPa (Ø > 40 mm)", latex: "\\sigma_1-150\\;\\mathrm{MPa}\\;(\\varnothing>40\\;\\mathrm{mm})" }],
            [{ text: "Barre filettate o improntate" }, { text: "σ1 − 180 MPa (Ø ≤ 40 mm)", latex: "\\sigma_1-180\\;\\mathrm{MPa}\\;(\\varnothing\\le40\\;\\mathrm{mm})" }, { text: "σ1 − 120 MPa (Ø > 40 mm)", latex: "\\sigma_1-120\\;\\mathrm{MPa}\\;(\\varnothing>40\\;\\mathrm{mm})" }],
        ],
    },
    "11.3.XII": {
        caption: "Tab. 11.3.XII – Requisiti di qualità per la saldatura",
        columnCount: 5,
        headers: [
            [
                { text: "Tipo di azione sulle strutture", rowSpan: 2 },
                { text: "Strutture soggette a fatica in modo non significativo", colSpan: 3 },
                { text: "Strutture soggette a fatica in modo significativo", rowSpan: 2 },
            ],
            ["A", "B", "C"].map((text) => ({ text })),
        ],
        rows: [
            [
                { text: "Materiale base: spessore minimo delle membrature" },
                { text: "S235, s ≤ 30 mm\nS275, s ≤ 30 mm", latex: "\\begin{gathered}\\mathrm{S235},\\ s\\le30\\;\\mathrm{mm}\\\\\\mathrm{S275},\\ s\\le30\\;\\mathrm{mm}\\end{gathered}" },
                { text: "S355, s ≤ 30 mm\nS235\nS275", latex: "\\begin{gathered}\\mathrm{S355},\\ s\\le30\\;\\mathrm{mm}\\\\\\mathrm{S235}\\\\\\mathrm{S275}\\end{gathered}" },
                { text: "S235\nS275\nS355\nS460, s ≤ 30 mm", latex: "\\begin{gathered}\\mathrm{S235}\\\\\\mathrm{S275}\\\\\\mathrm{S355}\\\\\\mathrm{S460},\\ s\\le30\\;\\mathrm{mm}\\end{gathered}" },
                { text: "S235\nS275\nS355\nS460 (Nota 1)\nAcciai inossidabili e altri acciai non esplicitamente menzionati (Nota 1)" },
            ],
            [
                { text: "Livello dei requisiti di qualità secondo la norma UNI EN ISO 3834:2006" },
                { text: "Elementare\nUNI EN ISO 3834-4" },
                { text: "Medio\nUNI EN ISO 3834-3" },
                { text: "Medio\nUNI EN ISO 3834-3" },
                { text: "Completo\nUNI EN ISO 3834-2" },
            ],
            [
                { text: "Livello di conoscenza tecnica del personale di coordinamento della saldatura secondo la norma UNI EN ISO 14731" },
                { text: "Di base" },
                { text: "Specifico" },
                { text: "Completo" },
                { text: "Completo" },
            ],
        ],
        notes: ["Nota 1) Vale anche per strutture non soggette a fatica in modo significativo."],
    },
    "11.3.XIII.a": {
        caption: "Tab. 11.3.XIII.a – Assiemi di viti, dadi e rondelle per giunzioni non precaricate",
        columnCount: 4,
        headers: [
            [{ text: "Viti" }, { text: "Dadi" }, { text: "Rondelle" }, { text: "Riferimento", rowSpan: 2 }],
            [{ text: "Classe di resistenza\nUNI EN ISO 898-1:2013" }, { text: "Classe di resistenza\nUNI EN ISO 898-2:2012" }, { text: "Durezza" }],
        ],
        rows: [
            [{ text: "4.6", latex: "4.6" }, { text: "4; 5; 6 oppure 8", rowSpan: 2 }, { text: "100 HV min.", latex: "100\\;\\mathrm{HV\\ min.}", rowSpan: 5 }, { text: "UNI EN 15048-1", rowSpan: 7 }],
            [{ text: "4.8", latex: "4.8" }],
            [{ text: "5.6", latex: "5.6" }, { text: "5; 6 oppure 8", rowSpan: 2 }],
            [{ text: "5.8", latex: "5.8" }],
            [{ text: "6.8", latex: "6.8" }, { text: "6 oppure 8" }],
            [{ text: "8.8", latex: "8.8" }, { text: "8 oppure 10" }, { text: "100 HV min. oppure 300 HV min.", latex: "100\\;\\mathrm{HV\\ min.}\\ \\text{oppure}\\ 300\\;\\mathrm{HV\\ min.}", rowSpan: 2 }],
            [{ text: "10.9", latex: "10.9" }, { text: "10 oppure 12" }],
        ],
    },
    "11.3.XIII.b": {
        caption: "Tab. 11.3.XIII.b – Tensioni di snervamento e di rottura delle viti",
        columnCount: 8,
        headers: [["Classe", "4.6", "4.8", "5.6", "5.8", "6.8", "8.8", "10.9"].map((text) => ({ text, latex: /^\\d/u.test(text) ? text : undefined }))],
        rows: [
            [{ text: "fyb (N/mm²)", latex: "f_{yb}\\;(\\mathrm{N/mm^2})" }, ...["240", "320", "300", "400", "480", "640", "900"].map((text) => ({ text, latex: text }))],
            [{ text: "ftb (N/mm²)", latex: "f_{tb}\\;(\\mathrm{N/mm^2})" }, ...["400", "400", "500", "500", "600", "800", "1000"].map((text) => ({ text, latex: text }))],
        ],
    },
    "11.3.XIV": {
        caption: "Tab. 11.3.XIV – Assiemi di viti, dadi e rondelle per giunzioni precaricate",
        columnCount: 7,
        headers: [
            [{ text: "Sistema", rowSpan: 2 }, { text: "Viti", colSpan: 2 }, { text: "Dadi", colSpan: 2 }, { text: "Rondelle", colSpan: 2 }],
            [
                { text: "Classe di resistenza" }, { text: "Riferimento" },
                { text: "Classe di resistenza" }, { text: "Riferimento" },
                { text: "Durezza" }, { text: "Riferimento" },
            ],
        ],
        rows: [
            [{ text: "HR", rowSpan: 2 }, { text: "8.8", latex: "8.8" }, { text: "UNI EN 14399-1" }, { text: "8", latex: "8" }, { text: "UNI EN 14399-3" }, { text: "300-370 HV", latex: "300\\text{-}370\\;\\mathrm{HV}", rowSpan: 3 }, { text: "UNI EN 14399 parti 5 e 6", rowSpan: 3 }],
            [{ text: "10.9", latex: "10.9" }, { text: "UNI EN 14399-3" }, { text: "10", latex: "10" }, { text: "UNI EN 14399-3" }],
            [{ text: "HV" }, { text: "10.9", latex: "10.9" }, { text: "UNI EN 14399-4" }, { text: "10", latex: "10" }, { text: "UNI EN 14399-4" }],
        ],
    },
    "11.7.I": {
        caption: "Tab. 11.7.I – Profilo resistente per materiali e prodotti a base di legno",
        columnCount: 6,
        headers: [[
            { text: "Resistenze caratteristiche", colSpan: 2 },
            { text: "Moduli elastici", colSpan: 2 },
            { text: "Massa volumica", colSpan: 2 },
        ]],
        rows: [
            [
                { text: "Flessione" }, { text: "fm,k", latex: "f_{m,k}" },
                { text: "Modulo elastico parallelo medio **" }, { text: "E0,mean", latex: "E_{0,\\mathrm{mean}}" },
                { text: "Massa volumica caratteristica" }, { text: "ρk", latex: "\\rho_k" },
            ],
            [
                { text: "Trazione parallela" }, { text: "ft,0,k", latex: "f_{t,0,k}" },
                { text: "Modulo elastico parallelo caratteristico" }, { text: "E0,05", latex: "E_{0,05}" },
                { text: "Massa volumica media *,**" }, { text: "ρmean", latex: "\\rho_{\\mathrm{mean}}" },
            ],
            [
                { text: "Trazione perpendicolare" }, { text: "ft,90,k", latex: "f_{t,90,k}" },
                { text: "Modulo elastico perpendicolare medio **" }, { text: "E90,mean", latex: "E_{90,\\mathrm{mean}}" },
                { text: "" }, { text: "" },
            ],
            [
                { text: "Compressione parallela" }, { text: "fc,0,k", latex: "f_{c,0,k}" },
                { text: "Modulo elastico tangenziale medio **" }, { text: "Gmean", latex: "G_{\\mathrm{mean}}" },
                { text: "" }, { text: "" },
            ],
            [
                { text: "Compressione perpendicolare" }, { text: "fc,90,k", latex: "f_{c,90,k}" },
                { text: "" }, { text: "" }, { text: "" }, { text: "" },
            ],
            [
                { text: "Taglio" }, { text: "fv,k", latex: "f_{v,k}" },
                { text: "" }, { text: "" }, { text: "" }, { text: "" },
            ],
        ],
        notes: [
            "* La massa volumica media può non essere dichiarata.",
            "** Il pedice mean può essere abbreviato con m.",
        ],
    },
    "11.9.I": {
        caption: "Tab. 11.9.I",
        columnCount: 5,
        headers: [["", "Fornitura", "Invecchiamento", "Temperatura", "Frequenza di prova"].map((text) => ({ text }))],
        rows: [
            ["K_e", "\\pm15\\%", "\\pm20\\%", "\\pm40\\%", "\\pm10\\%"],
            ["\\xi_e", "\\pm15\\%", "\\pm15\\%", "\\pm15\\%", "\\pm10\\%"],
        ].map((row) => row.map((latex) => ({ text: latex.replaceAll("\\pm", "±").replaceAll("\\%", "%"), latex }))),
    },
    "11.9.II": {
        caption: "Tab. 11.9.II",
        columnCount: 5,
        headers: [[
            { text: "" }, { text: "Fornitura" }, { text: "Invecchiamento" }, { text: "Temperatura" },
            { text: "Frequenza di prova (1)", latex: "\\mathrm{Frequenza\\ di\\ prova}^{(1)}" },
        ]],
        rows: [
            ["K_2", "\\pm15\\%", "\\pm20\\%", "\\pm20\\%", "\\pm10\\%"],
            ["K_{sec}", "\\pm15\\%", "\\pm20\\%", "\\pm40\\%", "\\pm10\\%"],
            ["\\xi_e", "\\pm10\\%", "\\pm15\\%", "\\pm15\\%", "\\pm10\\%"],
        ].map((row) => row.map((latex) => ({ text: latex.replaceAll("\\pm", "±").replaceAll("\\%", "%"), latex }))),
        notes: ["(1) Valori ottenuti o dichiarati con riferimento alle stesse frequenze delle prove di qualificazione."],
    },
    "11.9.III": {
        caption: "Tab. 11.9.III",
        columnCount: 5,
        headers: [["", "Fornitura", "Invecchiamento", "Temperatura", "Frequenza di prova"].map((text) => ({ text }))],
        rows: [
            ["F_{max}", "\\pm15\\%", "\\pm5\\%", "\\pm5\\%", "\\pm10\\%"],
            ["E_d", "-15\\%", "-5\\%", "-5\\%", "\\pm10\\%"],
        ].map((row) => row.map((latex) => ({ text: latex.replaceAll("\\pm", "±").replaceAll("\\%", "%"), latex }))),
    },
    "11.9.IV": {
        caption: "Tab. 11.9.IV",
        columnCount: 5,
        headers: [["", "Fornitura", "Invecchiamento", "Temperatura", "Frequenza di prova"].map((text) => ({ text }))],
        rows: [
            ["K_e", "\\pm20\\%", "\\pm20\\%", "\\pm20\\%", "\\pm20\\%"],
            ["K_v", "-30\\%", "-", "-", "-"],
            ["\\xi_e", "\\pm20\\%", "\\pm20\\%", "\\pm20\\%", "\\pm20\\%"],
        ].map((row) => row.map((latex) => ({ text: latex.replaceAll("\\pm", "±").replaceAll("\\%", "%"), latex }))),
    },
    "11.10.I": {
        caption: "Tab. 11.10.I",
        columnCount: 3,
        headers: [[
            { text: "Specifica Tecnica Europea di riferimento" }, { text: "Categoria" },
            { text: "Sistema di Valutazione e Verifica della Costanza della Prestazione" },
        ]],
        rows: [
            [
                { text: "Specifica per elementi per muratura - Elementi per muratura di laterizio, silicato di calcio, in calcestruzzo vibrocompresso (aggregati pesanti e leggeri), calcestruzzo aerato autoclavato, pietra agglomerata, pietra naturale UNI EN 771-1, 771-2, 771-3, 771-4, 771-5, 771-6", rowSpan: 2 },
                { text: "Categoria I" }, { text: "2+", latex: "2+" },
            ],
            [{ text: "Categoria II" }, { text: "4", latex: "4" }],
        ],
    },
    "11.10.II": {
        caption: "Tab. 11.10.II - Classi di malte a prestazione garantita",
        columnCount: 7,
        headers: [["Classe", "M 2,5", "M 5", "M 10", "M 15", "M 20", "M d"].map((text) => ({ text }))],
        rows: [[
            { text: "Resistenza a compressione N/mm²", latex: "\\mathrm{Resistenza\\ a\\ compressione}\\;[\\mathrm{N/mm^2}]" },
            ...["2{,}5", "5", "10", "15", "20", "d"].map((latex) => ({ text: latex.replace("{,}", ","), latex })),
        ]],
        notes: ["d è una resistenza a compressione maggiore di 25 N/mm² dichiarata dal fabbricante"],
    },
    "11.10.III": {
        caption: "Tab. 11.10.III",
        columnCount: 3,
        headers: [[
            { text: "Specifica Tecnica Europea di Riferimento" }, { text: "Uso Previsto" },
            { text: "Sistema di Valutazione e Verifica della Costanza della Prestazione" },
        ]],
        rows: [[{ text: "Malta per murature UNI EN 998-2" }, { text: "Usi strutturali" }, { text: "2+", latex: "2+" }]],
    },
    "11.10.IV": {
        caption: "Tab. 11.10.IV",
        columnCount: 3,
        headers: [[
            { text: "Specifica Tecnica Europea di Riferimento" }, { text: "Uso Previsto" },
            { text: "Sistema di Valutazione e Verifica della Costanza della Prestazione" },
        ]],
        rows: [[{ text: "Malta per murature UNI EN 998-2" }, { text: "Usi strutturali e non" }, { text: "4", latex: "4" }]],
    },
    "11.10.V": {
        caption: "Tab. 11.10.V - Corrispondenza tra classi di resistenza e composizione in volume delle malte",
        columnCount: 7,
        headers: [
            [{ text: "Classe", rowSpan: 2 }, { text: "Tipo di malta", rowSpan: 2 }, { text: "Composizione", colSpan: 5 }],
            ["Cemento", "Calce aerea", "Calce idraulica", "Sabbia", "Pozzolana"].map((text) => ({ text })),
        ],
        rows: [
            ["M 2,5", "Idraulica", "-", "-", "1", "3", "-"],
            ["M 2,5", "Pozzolanica", "-", "1", "-", "-", "3"],
            ["M 2,5", "Bastarda", "1", "-", "2", "9", "-"],
            ["M 5", "Bastarda", "1", "-", "1", "5", "-"],
            ["M 8", "Cementizia", "2", "-", "1", "8", "-"],
            ["M 12", "Cementizia", "1", "-", "-", "3", "-"],
        ].map((row) => row.map((text, index) => ({ text, ...(index > 1 ? { latex: text } : {}) }))),
    },
    "11.10.VI": {
        caption: "Tab. 11.10.VI - Valori di fk per murature in elementi artificiali pieni e semipieni (valori in N/mm²)",
        columnCount: 5,
        headers: [
            [{ text: "Resistenza caratteristica a compressione fbk dell’elemento N/mm²", latex: "\\mathrm{Resistenza\\ caratteristica\\ a\\ compressione}\\;f_{bk}\\;[\\mathrm{N/mm^2}]", rowSpan: 2 }, { text: "Tipo di malta", colSpan: 4 }],
            ["M15", "M10", "M5", "M2,5"].map((text) => ({ text })),
        ],
        rows: [
            ["2,0", "1,2", "1,2", "1,2", "1,2"], ["3,0", "2,2", "2,2", "2,2", "2,0"],
            ["5,0", "3,5", "3,4", "3,3", "3,0"], ["7,5", "5,0", "4,5", "4,1", "3,5"],
            ["10,0", "6,2", "5,3", "4,7", "4,1"], ["15,0", "8,2", "6,7", "6,0", "5,1"],
            ["20,0", "9,7", "8,0", "7,0", "6,1"], ["30,0", "12,0", "10,0", "8,6", "7,2"],
            ["40,0", "14,3", "12,0", "10,4", "-"],
        ].map((row) => row.map((text) => ({ text, latex: text.replace(",", "{,}") }))),
    },
    "11.10.VII": {
        caption: "Tab. 11.10.VII - Valori di fk per murature in elementi naturali di pietra squadrata (valori in N/mm²)",
        columnCount: 5,
        headers: [
            [{ text: "Resistenza caratteristica a compressione fbk dell’elemento", latex: "\\mathrm{Resistenza\\ caratteristica\\ a\\ compressione}\\;f_{bk}\\;\\mathrm{dell'elemento}", rowSpan: 2 }, { text: "Tipo di malta", colSpan: 4 }],
            ["M15", "M10", "M5", "M2,5"].map((text) => ({ text })),
        ],
        rows: [
            ["2,0", "1,0", "1,0", "1,0", "1,0"], ["3,0", "2,2", "2,2", "2,2", "2,0"],
            ["5,0", "3,5", "3,4", "3,3", "3,0"], ["7,5", "5,0", "4,5", "4,1", "3,5"],
            ["10,0", "6,2", "5,3", "4,7", "4,1"], ["15,0", "8,2", "6,7", "6,0", "5,1"],
            ["20,0", "9,7", "8,0", "7,0", "6,1"], ["30,0", "12,0", "10,0", "8,6", "7,2"],
            ["≥ 40,0", "14,3", "12,0", "10,4", "-"],
        ].map((row) => row.map((text) => ({ text, latex: text.replace("≥ ", "\\ge").replace(",", "{,}") }))),
    },
    "11.10.VIII": {
        caption: "Tab. 11.10.VIII - Resistenza caratteristica a taglio in assenza di tensioni normali fvk0 (valori in N/mm²)",
        columnCount: 4,
        headers: [
            [{ text: "Elementi per muratura", rowSpan: 2 }, { text: "fvk0 (N/mm²)", latex: "f_{vk0}\\;[\\mathrm{N/mm^2}]", colSpan: 3 }],
            [
                { text: "Malta ordinaria di classe di resistenza data" },
                { text: "Malta per strati sottili (giunto orizzontale ≥ 0,5 mm e ≤ 3 mm)", latex: "\\mathrm{Malta\\ per\\ strati\\ sottili}\\;(\\mathrm{giunto\\ orizzontale}\\ge0{,}5\\;\\mathrm{mm}\\;\\mathrm{e}\\le3\\;\\mathrm{mm})" },
                { text: "Malta alleggerita" },
            ],
        ],
        rows: [
            [
                { text: "Laterizio" },
                { text: "M10 - M20  0,30\nM2,5 - M9  0,20\nM1 - M2  0,10", latex: "\\begin{gathered}\\mathrm{M10-M20}\\quad0{,}30\\\\\\mathrm{M2{,}5-M9}\\quad0{,}20\\\\\\mathrm{M1-M2}\\quad0{,}10\\end{gathered}" },
                { text: "0,30*", latex: "0{,}30^{*}" }, { text: "0,15", latex: "0{,}15" },
            ],
            [
                { text: "Silicato di calcio" },
                { text: "M10 - M20  0,20\nM2,5 - M9  0,15\nM1 - M2  0,10", latex: "\\begin{gathered}\\mathrm{M10-M20}\\quad0{,}20\\\\\\mathrm{M2{,}5-M9}\\quad0{,}15\\\\\\mathrm{M1-M2}\\quad0{,}10\\end{gathered}" },
                { text: "0,20**", latex: "0{,}20^{**}" }, { text: "0,15", latex: "0{,}15" },
            ],
            [
                { text: "Calcestruzzo vibrocompresso\nCalcestruzzo aerato autoclavato\nPietra artificiale e pietra naturale a massello" },
                { text: "M10 - M20  0,20\nM2,5 - M9  0,15\nM1 - M2  0,10", latex: "\\begin{gathered}\\mathrm{M10-M20}\\quad0{,}20\\\\\\mathrm{M2{,}5-M9}\\quad0{,}15\\\\\\mathrm{M1-M2}\\quad0{,}10\\end{gathered}" },
                { text: "0,20**", latex: "0{,}20^{**}" }, { text: "0,15", latex: "0{,}15" },
            ],
        ],
        notes: [
            "* valore valido per malte di classe M10 o superiore e resistenza dei blocchi fbk ≥ 5.0 N/mm²",
            "** valore valido per malte di classe M5 o superiore e resistenza dei blocchi fbk ≥ 3.0 N/mm²",
        ],
    },
};

const figures = [
    {
        number: "11.9.1",
        unit: "11.9.5",
        page: 361,
        caption: "Fig. 11.9.1 – Diagrammi forza – spostamento per dispositivi non lineari",
        alt: "Diagrammi forza-spostamento per dispositivi non lineari.",
        sourceName: "page-0361-x75-y225-w300-h100@3x.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 75, y: 225, width: 300, height: 100 },
    },
    {
        number: "11.9.2",
        unit: "11.9.6",
        page: 362,
        caption: "Fig. 11.9.2 – Dispositivi a comportamento viscoso",
        alt: "Dispositivo a comportamento viscoso con diagramma forza-spostamento.",
        sourceName: "page-0362-x90-y305-w330-h105@3x.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 90, y: 305, width: 330, height: 105 },
    },
];

function blockText(block: any): string {
    return typeof block.text?.normalized === "string" ? block.text.normalized : "";
}

function isNarrative(text: string): boolean {
    return /^(?:Per |Nel |Nella |Nelle |Il |La |Le |I |È |E |Dove |Come |In |Deve |Anche |Ai |Al |Alla |L’|L')/u.test(text)
        && !/[0-9%±≤≥=]/u.test(text.slice(0, 40));
}

function tableRows(unit: any, index: number): any[] {
    const first = unit.blocks[index];
    const chunks: string[] = [];
    for (let offset = 0; offset < 8 && index + offset < unit.blocks.length; offset += 1) {
        const block = unit.blocks[index + offset];
        if (offset > 0 && block.kind !== "paragraph") break;
        if (offset > 0 && block.evidence.pdfPage !== first.evidence.pdfPage) break;
        const text = clean(block.text?.raw ?? blockText(block));
        if (text.length === 0) continue;
        if (offset > 0 && blockText(block).startsWith("Tab.")) break;
        if (offset > 0 && isNarrative(blockText(block))) break;
        chunks.push(...text.split(/\r?\n/u).map(clean).filter(Boolean));
    }
    return (chunks.length > 0 ? chunks : [clean(blockText(first))]).map((text) => [{ text }]);
}

function reindex(unit: any): void {
    unit.blocks = unit.blocks.map((block: any, index: number) => ({
        ...block,
        blockId: index === 0
            ? `${unit.id}#block-heading`
            : `${unit.id}#block-${String(index).padStart(3, "0")}`,
    }));
    unit.titleBlockId = unit.blocks[0].blockId;
}

function appendIssue(unit: any, suffix: string, note: string): void {
    const issueId = `${unit.numbering.official.replaceAll(".", "-")}-${suffix}`;
    if (!unit.workflow.openIssues.some((issue: any) => issue.issueId === issueId)) {
        unit.workflow.openIssues.push({ issueId, type: "asset-review", severity: "blocking", note });
    }
}

const fileNames = (await readdir(unitDir)).filter((name) => name.startsWith("11") && name.endsWith(".json"));
const units = new Map<string, any>();
for (const name of fileNames) {
    const unit = JSON.parse(await readFile(join(unitDir, name), "utf8"));
    units.set(unit.numbering.official, unit);
}

const formulaManifest: any[] = [];
const preservedFormulaLeads = new Map([
    ["11.10.8", "– modulo di elasticità normale secante"],
    ["11.10.9", "– modulo di elasticità tangenziale secante"],
]);
for (const definition of formulas) {
    const unit = units.get(definition.unit);
    if (unit === undefined) throw new Error(`Unità mancante per formula ${definition.number}`);
    const marker = formulaMarkerPattern(definition.marker);
    const index = unit.blocks.findIndex((block: any) => block.kind !== "heading" && block.evidence.pdfPage === definition.page && marker.test(blockText(block)));
    if (index < 0) throw new Error(`Formula ${definition.number} non trovata nella unità ${definition.unit}`);
    const sourceBlock = unit.blocks[index];
    const id = assetId("formula", definition.number);
    if (!unit.assets.formulaIds.includes(id)) unit.assets.formulaIds.push(id);
    const preservedLead = preservedFormulaLeads.get(definition.number);
    const ref = { blockId: preservedLead === undefined ? sourceBlock.blockId : `${sourceBlock.blockId}-formula`, kind: "formula-ref", origin: "official", assetId: id, evidence: refEvidence(sourceBlock) };
    if (preservedLead !== undefined) {
        sourceBlock.text.normalized = preservedLead;
        sourceBlock.text.inline = [{ kind: "text", value: preservedLead }];
        sourceBlock.evidence.normalizedSha256 = sha256(preservedLead);
        sourceBlock.evidence.transformations = [
            ...(sourceBlock.evidence.transformations ?? []),
            {
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Separata la descrizione della voce dalla formula display dopo confronto con il render ufficiale.",
            },
        ];
        unit.blocks.splice(index + 1, 0, ref);
    } else if (blockText(sourceBlock).length <= 120 || /^h \[|^,lim /u.test(blockText(sourceBlock))) {
        unit.blocks[index] = ref;
    } else if (!unit.blocks.some((block: any) => block.assetId === id)) {
        unit.blocks.splice(index + 1, 0, ref);
    }
    formulaManifest.push({ id, unitId: unit.id, officialNumber: definition.number, pdfPage: definition.page, latex: definition.latex });
}

const tableManifest: any[] = [];
for (const definition of tables) {
    const unit = units.get(definition.unit);
    if (unit === undefined) throw new Error(`Unità mancante per tabella ${definition.number}`);
    const pattern = tableNumberPattern(definition.number);
    const index = unit.blocks.findIndex((block: any) => block.kind === "paragraph" && block.evidence.pdfPage === definition.page && pattern.test(blockText(block)));
    if (index < 0) throw new Error(`Tabella ${definition.number} non trovata nella unità ${definition.unit}`);
    const sourceBlock = unit.blocks[index];
    const id = assetId("table", definition.number);
    if (!unit.assets.tableIds.includes(id)) unit.assets.tableIds.push(id);
    unit.blocks[index] = { blockId: sourceBlock.blockId, kind: "table-ref", origin: "official", assetId: id, evidence: refEvidence(sourceBlock) };
    const verified = verifiedTables[definition.number];
    tableManifest.push({
        id,
        unitId: unit.id,
        officialNumber: definition.number,
        pdfPage: definition.page,
        caption: verified?.caption ?? clean(blockText(sourceBlock)),
        columnCount: verified?.columnCount ?? 1,
        headers: verified?.headers ?? [],
        rows: verified?.rows ?? tableRows(unit, index),
        notes: verified === undefined
            ? [
                "Dati acquisiti dai blocchi evidence della pagina ufficiale.",
                "[TABELLA_DA_VERIFICARE] Struttura delle colonne, celle unite, simboli e valori richiede verifica manuale cella per cella prima della pubblicazione.",
            ]
            : [
                ...(verified.notes ?? []),
                "Trascritta cella per cella dal render ufficiale; revisione umana indipendente ancora obbligatoria.",
            ],
    });
    appendIssue(unit, `table-${definition.number.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-review`, "Tabella acquisita dall’evidence; la trascrizione strutturata deve ancora essere verificata cella per cella sul render ufficiale.");
}

const dirtyUnits = new Set<string>();

function patchVerifiedText(
    unitNumber: string,
    page: number,
    prefix: string,
    normalized: string,
    tokens: VerifiedInlineToken[],
    occurrence = 0,
): void {
    const unit = units.get(unitNumber);
    const block = unit?.blocks.filter(
        (candidate: any) => candidate.evidence.pdfPage === page && blockText(candidate).startsWith(prefix),
    )[occurrence];
    if (block === undefined) throw new Error(`Blocco verificato non trovato: ${unitNumber} p.${page} / ${prefix}`);
    block.text.normalized = normalized;
    block.text.inline = verifiedInline(normalized, tokens);
    block.evidence.normalizedSha256 = sha256(normalized);
    block.evidence.transformations = [
        ...(block.evidence.transformations ?? []),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Glifi, indici e formula inline ricostruiti dal render ufficiale ad alta scala.",
        },
    ];
    dirtyUnits.add(unitNumber);
}

function removeVerifiedTableResidues(unitNumber: string, page: number, prefixes: string[]): void {
    const unit = units.get(unitNumber);
    if (unit === undefined) throw new Error(`Unità mancante per pulizia tabella: ${unitNumber}`);
    unit.blocks = unit.blocks.filter((block: any) => {
        if (block.kind !== "paragraph" || block.evidence.pdfPage !== page) return true;
        return !prefixes.some((prefix) => blockText(block).startsWith(prefix));
    });
    dirtyUnits.add(unitNumber);
}

function removeVerifiedOcrResidues(unitNumber: string, page: number, prefixes: string[]): void {
    const unit = units.get(unitNumber);
    if (unit === undefined) throw new Error("Unità mancante per pulizia OCR: " + unitNumber);
    unit.blocks = unit.blocks.filter((block: any) => {
        if (!["paragraph", "list-item"].includes(block.kind) || block.evidence.pdfPage !== page) return true;
        return !prefixes.some((prefix) => blockText(block).startsWith(prefix));
    });
    dirtyUnits.add(unitNumber);
}

const shrinkage = units.get("11.2.10.6");
if (shrinkage === undefined) throw new Error("Unità 11.2.10.6 mancante");
shrinkage.blocks = shrinkage.blocks.filter((block: any) => {
    if (block.evidence.pdfPage !== 318 || block.kind !== "paragraph") return true;
    const text = blockText(block);
    return !text.startsWith("fck Deformazione da ritiro") && !text.startsWith("Umidità Relativa (in %)");
});
patchVerifiedText("11.2.10.6", 318, "può essere valutato mediante", blockText(
    shrinkage.blocks.find((block: any) => block.evidence.pdfPage === 318 && blockText(block).startsWith("può essere valutato mediante")),
), [{ value: "h0", latex: "h_0" }]);
patchVerifiedText("11.2.10.6", 318, "Per valori intermedi", blockText(
    shrinkage.blocks.find((block: any) => block.evidence.pdfPage === 318 && blockText(block).startsWith("Per valori intermedi")),
), [{ value: "εcd", latex: "\\varepsilon_{cd}" }]);
patchVerifiedText("11.2.10.6", 318, "t è l’età", "t è l’età del calcestruzzo nel momento considerato (in giorni)", [
    { value: "t", latex: "t" },
]);
patchVerifiedText("11.2.10.6", 318, "t s è l’età", "ts è l’età del calcestruzzo a partire dalla quale si considera l’effetto del ritiro da essiccamento (normalmente il termine della maturazione, espresso in giorni).", [
    { value: "ts", latex: "t_s" },
]);
patchVerifiedText("11.2.10.6", 318, "h0 è la dimensione", "h0 è la dimensione fittizia (in mm) pari al rapporto 2Ac/u", [
    { value: "h0", latex: "h_0" },
    { value: "2Ac/u", latex: "2A_c/u" },
]);
patchVerifiedText("11.2.10.6", 318, "A c è l’area", "Ac è l’area della sezione in calcestruzzo", [
    { value: "Ac", latex: "A_c" },
]);
patchVerifiedText("11.2.10.6", 318, "u è il perimetro", "u è il perimetro della sezione in calcestruzzo esposto all’aria.", [
    { value: "u", latex: "u" },
]);
patchVerifiedText("11.2.10.6", 318, "Il valore medio a tempo infinito della deformazione per ritiro autogeno", "Il valore medio a tempo infinito della deformazione per ritiro autogeno εca,∞ può essere valutato mediante l’espressione:", [
    { value: "εca,∞", latex: "\\varepsilon_{ca,\\infty}" },
]);
patchVerifiedText("11.2.10.6", 318, "con fck", "con fck in N/mm².", [
    { value: "fck", latex: "f_{ck}" },
    { value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
]);

const creep = units.get("11.2.10.7");
if (creep === undefined) throw new Error("Unità 11.2.10.7 mancante");
creep.blocks = creep.blocks.filter((block: any) => {
    if (block.evidence.pdfPage !== 318 || block.kind !== "paragraph") return true;
    return !blockText(block).startsWith("t 0 h0");
});
patchVerifiedText("11.2.10.7", 318, "In sede di progettazione", "In sede di progettazione, se la tensione di compressione del calcestruzzo, al tempo t0 = j di messa in carico, non è superiore a 0,45 fckj, il coefficiente di viscosità φ(∞, t0), a tempo infinito, a meno di valutazioni più precise (per es. § 3.1.4 di UNI EN 1992-1-1:2005), può essere dedotto dalle seguenti Tabelle 11.2.VI e 11.2.VII dove h0 è la dimensione fittizia definita in § 11.2.10.6:", [
    { value: "t0 = j", latex: "t_0=j" },
    { value: "0,45 fckj", latex: "0{,}45f_{ckj}" },
    { value: "φ(∞, t0)", latex: "\\phi(\\infty,t_0)" },
    { value: "h0", latex: "h_0" },
]);
patchVerifiedText("11.2.10.7", 319, "Nel caso in cui sia richiesta", "Nel caso in cui sia richiesta una valutazione in tempi diversi da t = ∞ del coefficiente di viscosità questo potrà essere valutato secondo modelli tratti da documenti di comprovata validità di cui al Capitolo 12.", [
    { value: "t = ∞", latex: "t=\\infty" },
]);

patchVerifiedText("11.2.12", 319, "La miscela del calcestruzzo", "La miscela del calcestruzzo fibrorinforzato deve essere sottoposta a valutazione preliminare secondo le indicazioni riportate nel precedente § 11.2.3 con determinazione dei valori di resistenza a trazione residua fR1k per lo Stato limite di esercizio e fR3k per lo Stato limite Ultimo determinati secondo UNI EN 14651:2007.", [
    { value: "fR1k", latex: "f_{R1k}" },
    { value: "fR3k", latex: "f_{R3k}" },
]);

removeVerifiedTableResidues("11.3.2.1", 324, ["(ft /fy"]);
removeVerifiedTableResidues("11.3.2.2", 324, ["(fy /fynom"]);
removeVerifiedTableResidues("11.3.2.6", 325, ["15 CuNi", "5 VMoCr", "Analisi di prodotto"]);
removeVerifiedTableResidues("11.3.2.7", 326, ["Diametro nominale", "Tolleranza in %"]);
removeVerifiedTableResidues("11.3.2.10.1.3", 327, ["n k n K"]);
removeVerifiedTableResidues("11.3.2.10.3", 328, ["Caratteristica Valore limite", "fy minimo", "fy massimo", "Agt minimo", "ft / f y", "Piegamento / Raddrizzamento", "fr / f p"]);

patchVerifiedText("11.3.2.3", 324, "Le proprietà meccaniche", "Le proprietà meccaniche dei campioni ottenuti da rotolo raddrizzato, reti e tralicci sono determinate su provette mantenute per 60 (+15, –0) minuti a 100 ± 10 °C e successivamente raffreddate in aria calma a temperatura ambiente.", [
    { value: "60 (+15, –0) minuti", latex: "60^{+15}_{-0}\\;\\mathrm{min}" },
    { value: "100 ± 10 °C", latex: "100\\pm10\\;{}^\\circ\\mathrm{C}" },
]);
patchVerifiedText("11.3.2.3", 324, "In ogni caso", "In ogni caso, qualora lo snervamento non sia chiaramente individuabile, si sostituisce fy con f(0,2).", [
    { value: "fy", latex: "f_y" },
    { value: "f(0,2)", latex: "f_{(0{,}2)}" },
]);
patchVerifiedText("11.3.2.3", 324, "La prova di piegamento", "La prova di piegamento e raddrizzamento si esegue alla temperatura di 20 ± 5 °C piegando la provetta a 90°, mantenendola poi per 60 minuti a 100 ± 10 °C e procedendo, dopo raffreddamento in aria, al parziale raddrizzamento per almeno 20°. Dopo la prova il campione non deve presentare cricche.", [
    { value: "20 ± 5 °C", latex: "20\\pm5\\;{}^\\circ\\mathrm{C}" },
    { value: "90°", latex: "90^\\circ" },
    { value: "60 minuti", latex: "60\\;\\mathrm{min}" },
    { value: "100 ± 10 °C", latex: "100\\pm10\\;{}^\\circ\\mathrm{C}" },
    { value: "20°", latex: "20^\\circ" },
]);

patchVerifiedText("11.3.2.4", 324, "Tutti i prodotti sono", "Tutti i prodotti sono caratterizzati dal diametro Ø della barra tonda liscia equipesante, calcolato nell’ipotesi che la densità dell’acciaio sia pari a 7,85 kg/dm³.", [
    { value: "Ø", latex: "\\varnothing" },
    { value: "7,85 kg/dm³", latex: "7{,}85\\;\\mathrm{kg/dm^3}" },
]);
patchVerifiedText("11.3.2.4", 324, "Gli acciai B450C", "Gli acciai B450C, di cui al § 11.3.2.1, possono essere impiegati in barre di diametro Ø compreso tra 6 e 40 mm.", [
    { value: "Ø compreso tra 6 e 40 mm", latex: "6\\;\\mathrm{mm}\\le\\varnothing\\le40\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.4", 325, "Per gli acciai B450A", "Per gli acciai B450A, di cui al § 11.3.2.2 il diametro Ø delle barre deve essere compreso tra 5 e 10 mm.", [
    { value: "Ø delle barre deve essere compreso tra 5 e 10 mm", latex: "5\\;\\mathrm{mm}\\le\\varnothing\\le10\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.4", 325, "L’uso di acciai forniti", "L’uso di acciai forniti in rotolo è ammesso, esclusivamente per impieghi strutturali, per diametri Ø non superiori a 16 mm per gli acciai B450C e diametri Ø non superiori a 10 mm per gli acciai B450A.", [
    { value: "Ø non superiori a 16 mm", latex: "\\varnothing\\le16\\;\\mathrm{mm}" },
    { value: "Ø non superiori a 10 mm", latex: "\\varnothing\\le10\\;\\mathrm{mm}" },
]);

patchVerifiedText("11.3.2.5", 325, "Gli acciai delle reti", "Gli acciai delle reti e tralicci elettrosaldati devono essere saldabili. L’interasse delle barre non deve superare, nelle due direzioni, 330 mm.", [
    { value: "330 mm", latex: "330\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.5", 325, "Per le reti ed i tralicci costituiti con acciaio B450C", "Per le reti ed i tralicci costituiti con acciaio B450C, gli elementi base devono avere diametro Ø che rispetta la limitazione: 6 mm ≤ Ø ≤ 16 mm.", [
    { value: "6 mm ≤ Ø ≤ 16 mm", latex: "6\\;\\mathrm{mm}\\le\\varnothing\\le16\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.5", 325, "Per le reti ed i tralicci costituiti con acciaio B450A", "Per le reti ed i tralicci costituiti con acciaio B450A, gli elementi base devono avere diametro Ø che rispetta la limitazione: 5 mm ≤ Ø ≤ 10 mm.", [
    { value: "5 mm ≤ Ø ≤ 10 mm", latex: "5\\;\\mathrm{mm}\\le\\varnothing\\le10\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.5", 325, "I nodi delle reti", "I nodi delle reti devono resistere ad una forza di distacco determinata in accordo con la norma UNI EN ISO 15630-2:2010 pari al 25% della forza di snervamento della barra, da computarsi per quella di diametro maggiore sulla tensione di snervamento pari a 450 N/mm².", [
    { value: "25%", latex: "25\\%" },
    { value: "450 N/mm²", latex: "450\\;\\mathrm{N/mm^2}" },
]);

patchVerifiedText("11.3.2.6", 325, "L’analisi chimica", "L’analisi chimica effettuata su colata e l’eventuale analisi chimica di controllo effettuata sul prodotto finito devono soddisfare le limitazioni riportate nella Tab. 11.3.II dove il calcolo del carbonio equivalente Ceq è effettuato con la seguente formula:", [
    { value: "Ceq", latex: "C_{eq}" },
]);
patchVerifiedText("11.3.2.6", 326, "È possibile eccedere", "È possibile eccedere il valore massimo di C dello 0,03% in massa, a patto che il valore del Ceq sia ridotto dello 0,02% in massa.", [
    { value: "C", latex: "\\mathrm{C}" },
    { value: "0,03%", latex: "0{,}03\\%" },
    { value: "Ceq", latex: "C_{eq}" },
    { value: "0,02%", latex: "0{,}02\\%" },
]);

patchVerifiedText("11.3.2.8.1", 326, "È ammesso l’impiego", "È ammesso l’impiego di acciai inossidabili di natura austenitica o austeno-ferritica, purché le caratteristiche meccaniche siano conformi alle prescrizioni relative agli acciai di cui al § 11.3.2.1, con l’avvertenza di sostituire al termine ft della Tab. 11.3.Ib, solo nel calcolo del rapporto ft/fy, il termine ft7%, tensione corrispondente ad un allungamento totale pari al 7%. La saldabilità di tali acciai va documentata attraverso prove di saldabilità certificate da un laboratorio di cui all’art. 59 del DPR n. 380/2001 ed effettuate su campioni realizzati con gli specifici procedimenti di saldatura previsti dal fabbricante per l’utilizzo in cantiere o nei Centri di trasformazione.", [
    { value: "ft", latex: "f_t" },
    { value: "ft/fy", latex: "f_t/f_y" },
    { value: "ft7%", latex: "f_{t7\\%}" },
    { value: "7%", latex: "7\\%" },
]);

patchVerifiedText("11.3.2.10.1.2", 326, "Sui campioni", "Sui campioni devono essere determinati, a cura del laboratorio incaricato, i valori delle tensioni di snervamento e carico massimo fy e ft e l’allungamento Agt e devono essere effettuate le prove di piegamento e la verifica della saldabilità.", [
    { value: "fy", latex: "f_y" },
    { value: "ft", latex: "f_t" },
    { value: "Agt", latex: "A_{gt}" },
]);

patchVerifiedText("11.3.2.10.1.3", 327, "Valutazione dei risultati", "Valutazione dei risultati Le grandezze caratteristiche fy, ft, Agt ed il valore caratteristico inferiore di ft/fy devono soddisfare la seguente relazione:", [
    { value: "fy", latex: "f_y" },
    { value: "ft", latex: "f_t" },
    { value: "Agt", latex: "A_{gt}" },
    { value: "ft/fy", latex: "f_t/f_y" },
]);
patchVerifiedText("11.3.2.10.1.3", 327, "La grandezza caratteristica", "La grandezza caratteristica (fy/fynom)k ed il valore caratteristico superiore di ft/fy devono soddisfare la seguente relazione:", [
    { value: "(fy/fynom)k", latex: "(f_y/f_{y\\,\\mathrm{nom}})_k" },
    { value: "ft/fy", latex: "f_t/f_y" },
]);
patchVerifiedText("11.3.2.10.1.3", 327, "Cv =", "dove: Cv = valore prescritto per le singole grandezze nelle tabelle di cui ai §§ 11.3.2.1 e 11.3.2.2; x̄ = valore medio", [
    { value: "Cv", latex: "C_v" },
    { value: "x̄", latex: "\\bar{x}" },
]);
patchVerifiedText("11.3.2.10.1.3", 327, "s =", "s = deviazione standard della popolazione", [
    { value: "s", latex: "s" },
]);
patchVerifiedText("11.3.2.10.1.3", 327, "k =", "k = coefficiente riportato in Tab. 11.3.IV per ft ed fy e in Tab. 11.3.V per Agt, ft/fy ed (fy/fynom) e che deve essere stabilito in base al numero dei campioni.", [
    { value: "k", latex: "k" },
    { value: "ft", latex: "f_t" },
    { value: "fy", latex: "f_y" },
    { value: "Agt", latex: "A_{gt}" },
    { value: "ft/fy", latex: "f_t/f_y" },
    { value: "(fy/fynom)", latex: "(f_y/f_{y\\,\\mathrm{nom}})" },
]);
patchVerifiedText("11.3.2.10.1.3", 327, "In ogni caso il coefficiente", "In ogni caso il coefficiente k assume, in funzione di n, i valori riportati nelle Tab. 11.3.IV e 11.3.V.", [
    { value: "k", latex: "k" },
    { value: "n", latex: "n" },
]);

patchVerifiedText("11.3.2.10.1.4", 328, "Il prelievo deve essere", blockText(units.get("11.3.2.10.1.4").blocks.find((block: any) => block.evidence.pdfPage === 328 && blockText(block).startsWith("Il prelievo deve essere"))), [
    { value: "n = 75", latex: "n=75" },
]);
patchVerifiedText("11.3.2.10.2", 328, "Oltre a quanto già prescritto", blockText(units.get("11.3.2.10.2").blocks.find((block: any) => block.evidence.pdfPage === 328 && blockText(block).startsWith("Oltre a quanto già prescritto"))), [
    { value: "n", latex: "n" },
    { value: "n", latex: "n" },
]);
patchVerifiedText("11.3.2.10.3", 328, "a) in caso di utilizzo", blockText(units.get("11.3.2.10.3").blocks.find((block: any) => block.evidence.pdfPage === 328 && blockText(block).startsWith("a) in caso di utilizzo"))), [
    { value: "90 t", latex: "90\\;\\mathrm{t}" },
]);
patchVerifiedText("11.3.2.10.3", 328, "b) in caso di utilizzo", blockText(units.get("11.3.2.10.3").blocks.find((block: any) => block.evidence.pdfPage === 328 && blockText(block).startsWith("b) in caso di utilizzo"))), [
    { value: "30 t", latex: "30\\;\\mathrm{t}" },
    { value: "3 mesi", latex: "3\\;\\mathrm{mesi}" },
]);

removeVerifiedTableResidues("11.3.2.10.4", 330, ["per 5", "per 6", "per >"]);
removeVerifiedTableResidues("11.3.2.12", 331, ["Caratteristica", "fy minimo", "fy massimo", "Agt minimo", "ft / f y", "Piegamento/raddrizzamento", "Distacco del nodo"]);
removeVerifiedTableResidues("11.3.3.2", 333, ["Tipo di acciaio", "Tensione caratteristica", "Tensione caratteristiche", "Allungamento totale"]);
removeVerifiedTableResidues("11.3.3.3", 334, ["armatura Prodotto"]);
removeVerifiedTableResidues("11.3.3.5.2.3", 337, ["Diametro nominale", "Fili Ø", "5 mm <", "Massimo =", "Trecce e trefoli", "Ø >"]);
removeVerifiedTableResidues("11.3.3.5.2.3", 338, ["Barre lisce", "Barre filettate o improntate"]);

patchVerifiedText("11.3.2.10.4", 329, "il diametro nominale", "Ø il diametro nominale del campione in mm;", [
    { value: "Ø", latex: "\\varnothing" },
]);
patchVerifiedText("11.3.2.10.4", 329, "Θm", "τm il valor medio della tensione di aderenza in MPa calcolata in corrispondenza di uno scorrimento pari a 0,01, 0,1 ed 1 mm;", [
    { value: "τm", latex: "\\tau_m" },
    { value: "0,01, 0,1 ed 1 mm", latex: "0{,}01,\\;0{,}1\\text{ ed }1\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.10.4", 329, "Θr", "τr la tensione di aderenza massima al collasso.", [
    { value: "τr", latex: "\\tau_r" },
]);
patchVerifiedText("11.3.2.10.4", 329, "– uno nell’intervallo 5", "– uno nell’intervallo 5 ≤ Ø ≤ 10 mm (barre) e 5 ≤ Ø ≤ 8 mm (rotoli);", [
    { value: "5 ≤ Ø ≤ 10 mm", latex: "5\\le\\varnothing\\le10\\;\\mathrm{mm}" },
    { value: "5 ≤ Ø ≤ 8 mm", latex: "5\\le\\varnothing\\le8\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.10.4", 329, "– uno nell’intervallo 12", "– uno nell’intervallo 12 ≤ Ø ≤ 18 mm (barre) e 10 ≤ Ø ≤ 14 mm (rotoli);", [
    { value: "12 ≤ Ø ≤ 18 mm", latex: "12\\le\\varnothing\\le18\\;\\mathrm{mm}" },
    { value: "10 ≤ Ø ≤ 14 mm", latex: "10\\le\\varnothing\\le14\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.3.2.10.4", 330, "Con riferimento sia", blockText(units.get("11.3.2.10.4").blocks.find((block: any) => block.evidence.pdfPage === 330 && blockText(block).startsWith("Con riferimento sia"))), [
    { value: "3 campioni", latex: "3\\;\\mathrm{campioni}" },
]);
patchVerifiedText("11.3.2.10.4", 330, "– il valore dell’area relativa di nervatura", "– il valore dell’area relativa di nervatura fr, per l’acciaio nervato;", [
    { value: "fr", latex: "f_r" },
]);
patchVerifiedText("11.3.2.10.4", 330, "– il valore dell’area relativa di dentellatura", "– il valore dell’area relativa di dentellatura fp, per l’acciaio dentellato.", [
    { value: "fp", latex: "f_p" },
]);

patchVerifiedText("11.3.2.11.1.1", 330, "Il laboratorio di cui", blockText(units.get("11.3.2.11.1.1").blocks.find((block: any) => block.evidence.pdfPage === 330 && blockText(block).startsWith("Il laboratorio di cui"))), [
    { value: "80 campioni", latex: "80\\;\\mathrm{campioni}" },
    { value: "40 diversi pannelli", latex: "40\\;\\mathrm{pannelli}" },
    { value: "2 per ogni elemento", latex: "2\\;\\mathrm{per\\ ogni\\ elemento}" },
]);
patchVerifiedText("11.3.2.11.1.1", 330, "Per la determinazione delle tensioni", blockText(units.get("11.3.2.11.1.1").blocks.find((block: any) => block.evidence.pdfPage === 330 && blockText(block).startsWith("Per la determinazione delle tensioni"))), [
    { value: "n", latex: "n" },
    { value: "80", latex: "80" },
    { value: "k", latex: "k" },
    { value: "n", latex: "n" },
]);
patchVerifiedText("11.3.2.11.1.2", 330, "Si determinano così", "Si determinano così le nuove tensioni caratteristiche sostitutive delle precedenti sempre ponendo n = 80.", [
    { value: "n = 80", latex: "n=80" },
]);
patchVerifiedText("11.3.2.11.1.2", 330, "Qualora uno dei campioni", "Qualora uno dei campioni sottoposti a prove di verifica non soddisfi i valori previsti al § 11.3.2, il prelievo relativo all’elemento di cui trattasi va ripetuto su un altro elemento della stessa partita. Il nuovo prelievo sostituisce quello precedente a tutti gli effetti. In caso di ulteriore risultato negativo, il laboratorio incaricato sospende le prove di verifica della qualità dandone comunicazione al Servizio Tecnico Centrale e ripete la qualificazione dopo che il fabbricante ha ovviato alle cause che hanno dato luogo al risultato insoddisfacente.", []);
patchVerifiedText("11.3.2.11.2", 331, "I controlli consistono", blockText(units.get("11.3.2.11.2").blocks.find((block: any) => block.evidence.pdfPage === 331 && blockText(block).startsWith("I controlli consistono"))), [
    { value: "n", latex: "n" },
    { value: "20", latex: "20" },
    { value: "10", latex: "10" },
]);
patchVerifiedText("11.3.2.11.2", 331, "Le tensioni caratteristiche", blockText(units.get("11.3.2.11.2").blocks.find((block: any) => block.evidence.pdfPage === 331 && blockText(block).startsWith("Le tensioni caratteristiche"))), [
    { value: "n", latex: "n" },
]);
patchVerifiedText("11.3.2.12", 331, "Essi devono essere", blockText(units.get("11.3.2.12").blocks.find((block: any) => block.evidence.pdfPage === 331 && blockText(block).startsWith("Essi devono essere"))), [
    { value: "3 campioni ogni 30 t", latex: "3\\;\\mathrm{campioni\\ ogni}\\;30\\;\\mathrm{t}" },
]);

patchVerifiedText("11.3.3.1", 333, "Le barre possono essere", blockText(units.get("11.3.3.1").blocks.find((block: any) => block.evidence.pdfPage === 333 && blockText(block).startsWith("Le barre possono essere"))), [
    { value: "0,8 volte il diametro nominale", latex: "0{,}8\\varnothing" },
]);

patchVerifiedText("11.3.3.2", 334, "Le grandezze qui", "Le grandezze qui di seguito elencate: Ø, A, M, Z, fptk, fp(0,1)k, fpyk, fp(1)k, fp(0,1)/fpt, fpy/fpt, fp(1)/fpt, fpt/fptk, Agt, Ep, l, N, α (180°), N, L, ρ, p, t devono formare oggetto di garanzia da parte del fabbricante ed i corrispondenti valori garantiti figurare nel relativo catalogo.", [
    { value: "Ø", latex: "\\varnothing" }, { value: "A", latex: "A" }, { value: "M", latex: "M" }, { value: "Z", latex: "Z" },
    { value: "fptk", latex: "f_{ptk}" }, { value: "fp(0,1)k", latex: "f_{p(0{,}1)k}" }, { value: "fpyk", latex: "f_{pyk}" }, { value: "fp(1)k", latex: "f_{p(1)k}" },
    { value: "fp(0,1)/fpt", latex: "f_{p(0{,}1)}/f_{pt}" }, { value: "fpy/fpt", latex: "f_{py}/f_{pt}" }, { value: "fp(1)/fpt", latex: "f_{p(1)}/f_{pt}" }, { value: "fpt/fptk", latex: "f_{pt}/f_{ptk}" },
    { value: "Agt", latex: "A_{gt}" }, { value: "Ep", latex: "E_p" }, { value: "l", latex: "l" }, { value: "N", latex: "N" }, { value: "α (180°)", latex: "\\alpha\\;(180^\\circ)" }, { value: "N", latex: "N" }, { value: "L", latex: "L" }, { value: "ρ", latex: "\\rho" }, { value: "p", latex: "p" }, { value: "t", latex: "t" },
]);
patchVerifiedText("11.3.3.2", 334, ", A, M sono", "Ø, A, M sono confrontati con quelli che derivano dall’applicazione ai valori nominali, delle tolleranze prescritte al § 11.3.3.5.2.3;", [
    { value: "Ø", latex: "\\varnothing" }, { value: "A", latex: "A" }, { value: "M", latex: "M" },
]);
patchVerifiedText("11.3.3.2", 334, "f ptk", "fptk, fpyk, fp(1)k, fp(0,1)k ottenuti applicando ai valori singoli fpt, fpy, fp(1), fp(0,1) la formula xk = x̄ − ks, sono confrontati con i corrispondenti valori caratteristici garantiti che figurano nel catalogo del fabbricante e con quelli della Tab. 11.3.VIII; nella formula precedente è inteso che sia:", [
    { value: "fptk", latex: "f_{ptk}" }, { value: "fpyk", latex: "f_{pyk}" }, { value: "fp(1)k", latex: "f_{p(1)k}" }, { value: "fp(0,1)k", latex: "f_{p(0{,}1)k}" },
    { value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "xk = x̄ − ks", latex: "x_k=\\bar{x}-ks" },
]);
patchVerifiedText("11.3.3.2", 334, "xk =", "xk = valore caratteristico della grandezza;", [{ value: "xk", latex: "x_k" }]);
patchVerifiedText("11.3.3.2", 334, "x =", "x̄ = valore medio dei singoli valori in considerazione;", [{ value: "x̄", latex: "\\bar{x}" }]);
patchVerifiedText("11.3.3.2", 334, "k =", blockText(units.get("11.3.3.2").blocks.find((block: any) => block.evidence.pdfPage === 334 && blockText(block).startsWith("k ="))), [{ value: "k", latex: "k" }, { value: "n", latex: "n" }]);
patchVerifiedText("11.3.3.2", 334, "s =", "s = scarto quadratico medio della distribuzione dei valori singoli; fp(0,1)/fpt, fpy/fpt, e fp(1)/fpt ottenuti come rapporto tra i valori singoli fp(0,1), fpy, fp(1) e il corrispondente valore al carico massimo fpt, devono risultare compresi tra il valore minimo e il valore massimo riportati al successivo § 11.3.3.5.2.3;", [
    { value: "s", latex: "s" }, { value: "fp(0,1)/fpt", latex: "f_{p(0{,}1)}/f_{pt}" }, { value: "fpy/fpt", latex: "f_{py}/f_{pt}" }, { value: "fp(1)/fpt", latex: "f_{p(1)}/f_{pt}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "fpt", latex: "f_{pt}" },
]);
patchVerifiedText("11.3.3.2", 334, "f pt /f ptk", "fpt/fptk, Agt sono confrontati, rispettivamente, con il corrispondente valore massimo indicato al § 11.3.3.5.2.3 e con il valore minimo che figura nella Tab. 11.3.VIII;", [{ value: "fpt/fptk", latex: "f_{pt}/f_{ptk}" }, { value: "Agt", latex: "A_{gt}" }]);
patchVerifiedText("11.3.3.2", 334, "l è", blockText(units.get("11.3.3.2").blocks.find((block: any) => block.evidence.pdfPage === 334 && blockText(block).startsWith("l è"))), [{ value: "l", latex: "l" }]);
patchVerifiedText("11.3.3.2", 334, "N,", "N, α (180°) sono confrontati con quelli prescritti al § 11.3.3.5.2.3;", [{ value: "N", latex: "N" }, { value: "α (180°)", latex: "\\alpha\\;(180^\\circ)" }]);
patchVerifiedText("11.3.3.2", 334, "E p", "Ep, D, L, ρ sono conformi con quelli prescritto al § 11.3.3.5.2.3;", [{ value: "Ep", latex: "E_p" }, { value: "D", latex: "D" }, { value: "L", latex: "L" }, { value: "ρ", latex: "\\rho" }]);
patchVerifiedText("11.3.3.2", 334, "Z, p", blockText(units.get("11.3.3.2").blocks.find((block: any) => block.evidence.pdfPage === 334 && blockText(block).startsWith("Z, p"))), [{ value: "Z", latex: "Z" }, { value: "p", latex: "p" }]);
patchVerifiedText("11.3.3.2", 334, "t è", blockText(units.get("11.3.3.2").blocks.find((block: any) => block.evidence.pdfPage === 334 && blockText(block).startsWith("t è"))), [{ value: "t", latex: "t" }]);

patchVerifiedText("11.3.3.3", 334, "Le cadute di tensione", "Le cadute di tensione per rilassamento devono essere riferite al valore percentuale ottenuto sperimentalmente dopo 1000 ore dalla messa in tensione (ρ1000). La tensione iniziale (σspi) di prova deve essere pari al 70% del valore fpt ottenuto come valore medio della tensione al carico massimo ottenuta su due saggi prelevati in adiacenza a quello sottoposto a prova.", [
    { value: "1000 ore", latex: "1000\\;\\mathrm{h}" }, { value: "(ρ1000)", latex: "(\\rho_{1000})" }, { value: "(σspi)", latex: "(\\sigma_{spi})" }, { value: "70%", latex: "70\\%" }, { value: "fpt", latex: "f_{pt}" },
]);
patchVerifiedText("11.3.3.3", 334, "Il valore della caduta", "Il valore della caduta di rilassamento dopo 1000 ore (ρ1000), non può essere assunto superiore a quello indicato nella tabella 11.3.IX. In mancanza di specifica sperimentazione, i valori di ρ1000 possono essere tratti dalla Tab. 11.3.IX.", [
    { value: "1000 ore", latex: "1000\\;\\mathrm{h}" }, { value: "(ρ1000)", latex: "(\\rho_{1000})" }, { value: "ρ1000", latex: "\\rho_{1000}" },
]);

patchVerifiedText("11.3.3.5.2.1", 335, "Sulla serie di 50", "Sulla serie di 50 saggi vengono determinate le grandezze Ø, A, M, Z, fpt, fpy, fp(0,1), fp(1), l, Ep, Agt, N, α (180°) sotto il controllo di un laboratorio di cui all’art. 59 del DPR n. 380/2001. Le relative prove possono essere eseguite alla presenza dei tecnici del laboratorio incaricato presso il laboratorio dello stabilimento di produzione purché venga rispettato quanto prescritto dalle norme in merito alla verifica della taratura delle attrezzature.", [
    { value: "50 saggi", latex: "50\\;\\mathrm{saggi}" }, { value: "Ø", latex: "\\varnothing" }, { value: "A", latex: "A" }, { value: "M", latex: "M" }, { value: "Z", latex: "Z" }, { value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "l", latex: "l" }, { value: "Ep", latex: "E_p" }, { value: "Agt", latex: "A_{gt}" }, { value: "N", latex: "N" }, { value: "α (180°)", latex: "\\alpha\\;(180^\\circ)" },
]);
patchVerifiedText("11.3.3.5.2.1", 335, "I valori caratteristici", "I valori caratteristici fptk, fpyk, fp(0,1)k, fp(1)k ottenuti dall’elaborazione statistica dei risultati con la relazione del punto 11.3.3.2, devono rispettare i valori minimi di cui alla Tab. 11.3.VIII, oppure quelli dichiarati e garantiti dal fabbricante.", [
    { value: "fptk", latex: "f_{ptk}" }, { value: "fpyk", latex: "f_{pyk}" }, { value: "fp(0,1)k", latex: "f_{p(0{,}1)k}" }, { value: "fp(1)k", latex: "f_{p(1)k}" },
]);
patchVerifiedText("11.3.3.5.2.1", 335, "Gli scarti quadratici", "Gli scarti quadratici medi delle rispettive distribuzioni devono risultare non superiori al 3% del valore medio per fpt, e al 4% per fpy, fp(0,1), fp(1).", [
    { value: "3%", latex: "3\\%" }, { value: "fpt", latex: "f_{pt}" }, { value: "4%", latex: "4\\%" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(1)", latex: "f_{p(1)}" },
]);
patchVerifiedText("11.3.3.5.2.1", 335, "Il valore dei rapporti", "Il valore dei rapporti fp(0,1)/fpt, fpy/fpt, e fp(1)/fpt ed il valore massimo della tensione al carico massimo fpt non possono eccedere i limiti indicati al § 11.3.3.5.2.3.", [
    { value: "fp(0,1)/fpt", latex: "f_{p(0{,}1)}/f_{pt}" }, { value: "fpy/fpt", latex: "f_{py}/f_{pt}" }, { value: "fp(1)/fpt", latex: "f_{p(1)}/f_{pt}" }, { value: "fpt", latex: "f_{pt}" },
]);
patchVerifiedText("11.3.3.5.2.1", 335, "Tutti i valori", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("Tutti i valori"))), [{ value: "Agt", latex: "A_{gt}" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "- la caduta", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("- la caduta"))), [{ value: "r", latex: "\\rho" }, { value: "4 lotti", latex: "4\\;\\mathrm{lotti}" }, { value: "3 saggi", latex: "3\\;\\mathrm{saggi}" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "- il limite", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("- il limite"))), [{ value: "L", latex: "L" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "- la grandezza D", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("- la grandezza D"))), [{ value: "D", latex: "D" }, { value: "12,5 mm", latex: "12{,}5\\;\\mathrm{mm}" }, { value: "5 lotti", latex: "5\\;\\mathrm{lotti}" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "- la durata di vita a rottura t con", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("- la durata di vita a rottura t con"))), [{ value: "t", latex: "t" }, { value: "3 lotti", latex: "3\\;\\mathrm{lotti}" }, { value: "6 per lotto", latex: "6\\;\\mathrm{per\\ lotto}" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "- la durata di vita a rottura t2", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("- la durata di vita a rottura t2"))), [{ value: "t2", latex: "t_2" }, { value: "2 lotti", latex: "2\\;\\mathrm{lotti}" }, { value: "1 per lotto", latex: "1\\;\\mathrm{per\\ lotto}" }, { value: "2 lotti", latex: "2\\;\\mathrm{lotti}" }, { value: "2000 ore", latex: "2000\\;\\mathrm{h}" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "Le prove per la determinazione di", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("Le prove per la determinazione di"))), [{ value: "r", latex: "\\rho" }, { value: "L", latex: "L" }, { value: "D", latex: "D" }, { value: "t", latex: "t" }]);
patchVerifiedText("11.3.3.5.2.1", 335, "- del coefficiente", blockText(units.get("11.3.3.5.2.1").blocks.find((block: any) => block.evidence.pdfPage === 335 && blockText(block).startsWith("- del coefficiente"))), [{ value: "Z", latex: "Z" }]);

patchVerifiedText("11.3.3.5.2.2", 335, "Ai fini della verifica", "Ai fini della verifica della qualità il laboratorio incaricato deve effettuare controlli saltuari su un campione costituito da 5 saggi provenienti da un lotto per ogni categoria di armatura. Il controllo verte su un minimo di sei lotti ogni trimestre da sottoporre a prelievo in non meno di tre sopralluoghi. Su tali saggi il laboratorio viene determinato il valore delle grandezze Ø, A, M, L, fpt, l, fpy, ρ, fp(1), fp(0,1), fp(0,1)/fpt, fpy/fpt, e fp(1)/fpt, Ep, N, Agt, α (180°).", [
    { value: "5 saggi", latex: "5\\;\\mathrm{saggi}" }, { value: "Ø", latex: "\\varnothing" }, { value: "A", latex: "A" }, { value: "M", latex: "M" }, { value: "L", latex: "L" }, { value: "fpt", latex: "f_{pt}" }, { value: "l", latex: "l" }, { value: "fpy", latex: "f_{py}" }, { value: "ρ", latex: "\\rho" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(0,1)/fpt", latex: "f_{p(0{,}1)}/f_{pt}" }, { value: "fpy/fpt", latex: "f_{py}/f_{pt}" }, { value: "fp(1)/fpt", latex: "f_{p(1)}/f_{pt}" }, { value: "Ep", latex: "E_p" }, { value: "N", latex: "N" }, { value: "Agt", latex: "A_{gt}" }, { value: "α (180°)", latex: "\\alpha\\;(180^\\circ)" },
]);
patchVerifiedText("11.3.3.5.2.2", 335, "I valori caratteristici", "I valori caratteristici fptk, fpyk, fp(0,1)k, fp(1)k calcolati con la formula del precedente § 11.3.3.5.2.1 devono rispettare i valori minimi di cui alla Tab. 11.3.VIII oppure i valori dichiarati dal fabbricante.", [{ value: "fptk", latex: "f_{ptk}" }, { value: "fpyk", latex: "f_{pyk}" }, { value: "fp(0,1)k", latex: "f_{p(0{,}1)k}" }, { value: "fp(1)k", latex: "f_{p(1)k}" }]);
patchVerifiedText("11.3.3.5.2.2", 335, "Se gli scarti", "Se gli scarti quadratici medi risultano superiori al 3% del valore medio per fpt, e al 4% per fpy, fp(0,1), fp(1), il controllo si intende sospeso e la procedura di qualificazione deve essere ripresa dall’inizio.", [{ value: "3%", latex: "3\\%" }, { value: "fpt", latex: "f_{pt}" }, { value: "4%", latex: "4\\%" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(1)", latex: "f_{p(1)}" }]);

patchVerifiedText("11.3.3.5.2.2", 336, "Ove i valori caratteristici", "Ove i valori caratteristici fptk, fpyk, fp(0,1)k, fp(1)k riscontrati risultino inferiori ai valori minimi di cui alla Tab. 11.3.VIII, oppure i valori dei rapporti fp(0,1)/fpt, fpy/fpt, e fp(1)/fpt non siano compresi tra i limiti specificati nel § 11.3.3.5.2.3, il laboratorio incaricato sospende le verifiche della qualità dandone comunicazione al Servizio Tecnico Centrale che autorizzerà il laboratorio di cui all’art. 59 del DPR n. 380/2001 a ripetere le prove di qualificazione solo dopo che il fabbricante abbia ovviato alle cause che hanno dato luogo al risultato insoddisfacente e previa eventuale nuova visita ispettiva.", [{ value: "fptk", latex: "f_{ptk}" }, { value: "fpyk", latex: "f_{pyk}" }, { value: "fp(0,1)k", latex: "f_{p(0{,}1)k}" }, { value: "fp(1)k", latex: "f_{p(1)k}" }, { value: "fp(0,1)/fpt", latex: "f_{p(0{,}1)}/f_{pt}" }, { value: "fpy/fpt", latex: "f_{py}/f_{pt}" }, { value: "fp(1)/fpt", latex: "f_{p(1)}/f_{pt}" }]);
patchVerifiedText("11.3.3.5.2.2", 336, "Per il calcolo", "Per il calcolo del valore caratteristico delle grandezze fpt, fpy, fp(0,1), fp(1) devono essere prese in considerazione sempre 10 serie di 5 saggi, facenti parte dei prodotti oggetto della qualificazione, da aggiornarsi ad ogni prelievo, aggiungendo la nuova serie ed eliminando la prima in ordine di tempo. I nuovi valori delle medie e degli scarti quadratici medi così ottenuti vengono utilizzati per la determinazione delle nuove tensioni caratteristiche, sostitutive di quelle precedenti, ponendo sempre n = 50.", [{ value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "10 serie di 5 saggi", latex: "10\\times5\\;\\mathrm{saggi}" }, { value: "n = 50", latex: "n=50" }]);
patchVerifiedText("11.3.3.5.2.2", 336, "Per le grandezze r", "Per le grandezze ρ e per la resistenza alla fatica, i controlli si effettuano una volta al semestre, per entrambe su 3 saggi provenienti dallo stesso lotto per ogni categoria di armatura.", [{ value: "ρ", latex: "\\rho" }, { value: "3 saggi", latex: "3\\;\\mathrm{saggi}" }]);
patchVerifiedText("11.3.3.5.2.2", 336, "La grandezza D", blockText(units.get("11.3.3.5.2.2").blocks.find((block: any) => block.evidence.pdfPage === 336 && blockText(block).startsWith("La grandezza D"))), [{ value: "D", latex: "D" }, { value: "12,5 mm", latex: "12{,}5\\;\\mathrm{mm}" }]);
patchVerifiedText("11.3.3.5.2.2", 336, "Le prove di corrosione", blockText(units.get("11.3.3.5.2.2").blocks.find((block: any) => block.evidence.pdfPage === 336 && blockText(block).startsWith("Le prove di corrosione"))), [{ value: "t", latex: "t" }]);
patchVerifiedText("11.3.3.5.2.2", 336, "Le prove per la determinazione", "Le prove per la determinazione delle grandezze ρ, D e t e per la valutazione delle resistenza alla fatica, vengono eseguite nel laboratorio di cui all’art. 59 del DPR n. 380/2001. Tutti i risultati di prova devono essere positivi in relazione al valore indicato nella Tabella 11.3.VIII per la caduta di rilassamento e alle limitazioni date nel § 11.3.3.5.2.3 per le grandezze D e t.", [{ value: "ρ", latex: "\\rho" }, { value: "D", latex: "D" }, { value: "t", latex: "t" }, { value: "D", latex: "D" }, { value: "t", latex: "t" }]);
patchVerifiedText("11.3.3.5.2.2", 336, "Su un saggio per lotto di trecce", blockText(units.get("11.3.3.5.2.2").blocks.find((block: any) => block.evidence.pdfPage === 336 && blockText(block).startsWith("Su un saggio per lotto di trecce"))), [{ value: "Z", latex: "Z" }, { value: "p", latex: "p" }]);

patchVerifiedText("11.3.3.5.2.3", 336, "I valori delle tensioni", "I valori delle tensioni fpt, fpy, fp(0,1), fp(1) devono essere riferiti al valore nominale dell’area della sezione trasversale riportata nel catalogo del fabbricante.", [{ value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(1)", latex: "f_{p(1)}" }]);
patchVerifiedText("11.3.3.5.2.3", 336, "Diametro (", "Diametro (Ø), area della sezione trasversale (A) e massa per unità di lunghezza (M) L’area della sezione trasversale si valuta per pesata assumendo che la densità dell’acciaio sia pari a 7,81 kg/dm³ per i fili, le trecce e i trefoli e 7,85 kg/dm³ per le barre. Qualora richiesto, il diametro dei fili lisci e delle barre lisce si misura con uno strumento appropriato che garantisca una accuratezza di lettura di 0,01 mm o migliore. Il valore ottenuto per la massa deve essere riferito a un metro di lunghezza di prodotto. Sui valori nominali delle aree delle sezioni dei fili, delle barre, delle trecce e dei trefoli è ammessa una tolleranza di ± 2%. Per le barre la tolleranza è compresa tra -2% e +6%. Le stesse tolleranze si applicano al valore della massa nominale per unità di lunghezza dichiarata dal fabbricante. Nei calcoli statici si adottano le aree delle sezioni nominali.", [
    { value: "(Ø)", latex: "(\\varnothing)" }, { value: "(A)", latex: "(A)" }, { value: "(M)", latex: "(M)" }, { value: "7,81 kg/dm³", latex: "7{,}81\\;\\mathrm{kg/dm^3}" }, { value: "7,85 kg/dm³", latex: "7{,}85\\;\\mathrm{kg/dm^3}" }, { value: "0,01 mm", latex: "0{,}01\\;\\mathrm{mm}" }, { value: "± 2%", latex: "\\pm2\\%" }, { value: "-2% e +6%", latex: "-2\\%\\text{ e }+6\\%" },
]);
patchVerifiedText("11.3.3.5.2.3", 336, "Rettilineità", "Rettilineità I prodotti forniti in rotolo o in bobine devono avere raggio di avvolgimento tale per cui all’atto dello svolgimento, allungati al suolo, su un tratto di 1 m non presentino curvatura con freccia superiore a 25 mm; il fabbricante deve indicare il diametro minimo di avvolgimento del prodotto. Nel caso di fili forniti in fasci il valore massimo di curvatura come sopra definito è pari a 10 mm. Per le barre il valore massimo di deviazione dalla rettilineità, misurato su una qualsiasi lunghezza, non deve superare 4 mm per metro di lunghezza.", [{ value: "1 m", latex: "1\\;\\mathrm{m}" }, { value: "25 mm", latex: "25\\;\\mathrm{mm}" }, { value: "10 mm", latex: "10\\;\\mathrm{mm}" }, { value: "4 mm", latex: "4\\;\\mathrm{mm}" }]);
patchVerifiedText("11.3.3.5.2.3", 336, "L’ovalità", "L’ovalità dei fili lisci, definita come differenza tra massimo e minimo diametro misurato, non deve essere maggiore di 2/100 del loro diametro nominale. La misurazione delle dimensioni deve essere effettuata con uno strumento che garantisca una accuratezza di lettura di 1/100 di mm o migliore. Il diametro medio, inteso come media delle misurazione di due diametri ortogonali tra loro di cui uno sia il massimo tra quelli ottenuti, non deve differire per più dell’1% dal valore nominale del diametro dichiarato dal fabbricante.", [{ value: "2/100", latex: "2/100" }, { value: "1/100 di mm", latex: "1/100\\;\\mathrm{mm}" }, { value: "1%", latex: "1\\%" }]);
patchVerifiedText("11.3.3.5.2.3", 336, "Passo di avvolgimento", "Passo di avvolgimento (p) Il passo di avvolgimento dei fili delle trecce deve essere compreso tra 14 e 22 volte il loro diametro nominale. Il passo di avvolgimento dei fili esterni dei trefoli deve essere compreso tra 14 e 18 volte il loro diametro nominale.", [{ value: "(p)", latex: "(p)" }, { value: "14 e 22", latex: "14\\text{ e }22" }, { value: "14 e 18", latex: "14\\text{ e }18" }]);

patchVerifiedText("11.3.3.5.2.3", 337, "Diametro dei fili", "Diametro dei fili delle trecce e dei trefoli Il rapporto tra il diametro del filo interno e quello di ciascuno dei fili esterni di un trefolo a fili lisci o improntati deve essere almeno pari a 1,03. Per la misurazione deve essere usato uno strumento che assicuri una risoluzione di 0,01 mm o migliore.", [{ value: "1,03", latex: "1{,}03" }, { value: "0,01 mm", latex: "0{,}01\\;\\mathrm{mm}" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Coefficiente di strizione", "Coefficiente di strizione (Z) Il valore minimo del coefficiente di strizione Z, riferito al valore dell’area della sezione trasversale effettiva dei fili costituenti le trecce e i trefoli, è pari al 25% per i fili lisci e pari al 20% per i fili improntati. Per i fili lisci la grandezza Z non deve essere inferiore al 25%. Tale limite si riduce al 20% per i fili improntati. Per le barre è richiesta una rottura duttile (con strizione) visibile ad occhio nudo.", [{ value: "(Z)", latex: "(Z)" }, { value: "Z", latex: "Z" }, { value: "25%", latex: "25\\%" }, { value: "20%", latex: "20\\%" }, { value: "Z", latex: "Z" }, { value: "25%", latex: "25\\%" }, { value: "20%", latex: "20\\%" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Tensione al carico", "Tensione al carico massimo (fpt) La determinazione di fpt si effettua per mezzo della prova di trazione. La tensione al carico massimo non può essere maggiore del corrispondente valore caratteristico garantito dal fabbricante, incrementato del 15%.", [{ value: "(fpt)", latex: "(f_{pt})" }, { value: "fpt", latex: "f_{pt}" }, { value: "15%", latex: "15\\%" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Tensione di scostamento", "Tensione di scostamento dalla proporzionalità allo 0.1% (fp(0,1)) Il valore della tensione fp(0,1) si ricava dal corrispondente diagramma sforzi – deformazioni, ottenuto con prove di trazione.", [{ value: "0.1%", latex: "0.1\\%" }, { value: "(fp(0,1))", latex: "(f_{p(0{,}1)})" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Tensione di snervamento", "Tensione di snervamento (fpy)", [{ value: "(fpy)", latex: "(f_{py})" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Per le barre, il valore", "Per le barre, il valore della tensione di snervamento fpy si ricava dal corrispondente diagramma sforzi – deformazioni ottenuto con la prova di trazione.", [{ value: "fpy", latex: "f_{py}" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Modulo di elasticità", "Modulo di elasticità (Ep) Il modulo di elasticità Ep è inteso come rapporto fra la differenza di tensione media e la differenza di deformazione corrispondente, valutato per l’intervallo di tensione (0,2-0,7) fpt sul diagramma sforzi-deformazioni ottenuto con la prova di trazione. Sono tollerati scarti del ± 5% rispetto al valore dichiarato dal fabbricante.", [{ value: "(Ep)", latex: "(E_p)" }, { value: "Ep", latex: "E_p" }, { value: "(0,2-0,7) fpt", latex: "(0{,}2-0{,}7)f_{pt}" }, { value: "± 5%", latex: "\\pm5\\%" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Tensione all’1%", "Tensione all’1% di deformazione totale (fp(1)) Il valore della tensione corrispondente all’1% di deformazione totale si ricava dal diagramma sforzi-deformazioni ottenuto con la prova di trazione.", [{ value: "1%", latex: "1\\%" }, { value: "(fp(1))", latex: "(f_{p(1)})" }, { value: "1%", latex: "1\\%" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Limiti del rapporto", "Limiti del rapporto tra le tensioni fp(0,1), fpy, fp(1) e la tensione al carico massimo fpt Il valore delle grandezze fp(0,1)/fpt, fpy/fpt, e fp(1)/fpt ottenute come rapporto tra i valori singoli fp(0,1), fpy, fp(1) e il corrispondente valore al carico massimo fpt, deve risultare compreso tra i limiti 0,87 e 0,95.", [{ value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "fpt", latex: "f_{pt}" }, { value: "fp(0,1)/fpt", latex: "f_{p(0{,}1)}/f_{pt}" }, { value: "fpy/fpt", latex: "f_{py}/f_{pt}" }, { value: "fp(1)/fpt", latex: "f_{p(1)}/f_{pt}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "fpt", latex: "f_{pt}" }, { value: "0,87 e 0,95", latex: "0{,}87\\text{ e }0{,}95" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Allungamento totale", "Allungamento totale percentuale sotto carico massimo (Agt) Il valore dell’allungamento totale percentuale sotto carico massimo si ricava dal diagramma sforzi-deformazioni ottenuto con la prova di trazione La base di misura dell’estensimetro deve essere in accordo alla UNI 7676:2016 per trefolo e treccia; UNI 7675:2016 per i fili e ≥ 200 mm per le barre.", [{ value: "(Agt)", latex: "(A_{gt})" }, { value: "≥ 200 mm", latex: "\\ge200\\;\\mathrm{mm}" }]);
patchVerifiedText("11.3.3.5.2.3", 337, "Prova di piegamento alternato", "Prova di piegamento alternato (N) La prova di piegamento alternato si esegue su fili aventi Ø ≤ 8. Il numero dei piegamenti alterni a rottura non deve risultare inferiore a 4 per i fili lisci e a 3 per i fili con impronte. Per il filo centrale dei trefoli valgono gli stessi limiti precedenti.", [{ value: "(N)", latex: "(N)" }, { value: "Ø ≤ 8", latex: "\\varnothing\\le8" }, { value: "4", latex: "4" }, { value: "3", latex: "3" }]);

patchVerifiedText("11.3.3.5.2.3", 338, "Prova di piegamento (", "Prova di piegamento (α) La prova di piegamento si esegue su fili aventi Ø ≥ 8 mm e su barre. L’angolo di piegamento deve essere di 180° e il diametro del mandrino deve essere pari a: 5 Ø per i fili; 6 Ø per le barre con Ø ≤ 26 mm; 8 Ø per le barre con Ø > 26 mm.", [{ value: "(α)", latex: "(\\alpha)" }, { value: "Ø ≥ 8 mm", latex: "\\varnothing\\ge8\\;\\mathrm{mm}" }, { value: "180°", latex: "180^\\circ" }, { value: "5 Ø", latex: "5\\varnothing" }, { value: "6 Ø", latex: "6\\varnothing" }, { value: "Ø ≤ 26 mm", latex: "\\varnothing\\le26\\;\\mathrm{mm}" }, { value: "8 Ø", latex: "8\\varnothing" }, { value: "Ø > 26 mm", latex: "\\varnothing>26\\;\\mathrm{mm}" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "Resistenza a fatica", "Resistenza a fatica (L) Le prove per la determinazione del limite di fatica L e della resistenza alla fatica, vengono condotte con sollecitazione assiale a ciclo pulsante, facendo oscillare la tensione fra un valore superiore σ1 e un valore inferiore σ2. Il risultato della prova per la verifica di resistenza a fatica è ritenuto soddisfacente se il campione sopporta, senza rompersi, almeno due milioni di cicli. Nelle prove di resistenza alla fatica, il valore superiore della tensione di prova σ1 deve essere pari al 70% del valore ottenuto come media delle tensioni al carico massimo, ricavate su due saggi prelevati in adiacenza a quello sottoposto a prova. Il valore inferiore della tensione di prova σ2 è dato in Tab. 11.3.XI.", [{ value: "(L)", latex: "(L)" }, { value: "L", latex: "L" }, { value: "σ1", latex: "\\sigma_1" }, { value: "σ2", latex: "\\sigma_2" }, { value: "σ1", latex: "\\sigma_1" }, { value: "70%", latex: "70\\%" }, { value: "σ2", latex: "\\sigma_2" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "La frequenza", blockText(units.get("11.3.3.5.2.3").blocks.find((block: any) => block.evidence.pdfPage === 338 && blockText(block).startsWith("La frequenza"))), [{ value: "120 Hz", latex: "120\\;\\mathrm{Hz}" }, { value: "20 Hz", latex: "20\\;\\mathrm{Hz}" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "Prove di rilassamento", "Prove di rilassamento a temperatura ordinaria (ρ) Le prove per la determinazione della caduta di tensione nel tempo a lunghezza costante ed alla temperatura T = 20°C ± 1°C devono essere condotte a partire dalla tensione iniziale σspi del punto 11.3.3.3 e per la durata stabilita. I diagrammi sperimentali ottenuti devono essere allegati al certificato di prova. La durata stabilita della singola prova è di 1000 ore. Sono consentiti tempi di prova pari a 120 ore. In sede di prima qualificazione del prodotto, tutte le prove devono avere durata di 1000 ore. In sede di verifica della qualità le prove devono avere durata di 120 ore. I risultati di prova, per ciascuna delle durate stabilite, devono essere tutti non superiori:", [{ value: "(ρ)", latex: "(\\rho)" }, { value: "T = 20°C ± 1°C", latex: "T=20^\\circ\\mathrm{C}\\pm1^\\circ\\mathrm{C}" }, { value: "σspi", latex: "\\sigma_{spi}" }, { value: "1000 ore", latex: "1000\\;\\mathrm{h}" }, { value: "120 ore", latex: "120\\;\\mathrm{h}" }, { value: "1000 ore", latex: "1000\\;\\mathrm{h}" }, { value: "120 ore", latex: "120\\;\\mathrm{h}" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "- Per treccia", blockText(units.get("11.3.3.5.2.3").blocks.find((block: any) => block.evidence.pdfPage === 338 && blockText(block).startsWith("- Per treccia"))), [{ value: "1,5%", latex: "1{,}5\\%" }, { value: "120 ore", latex: "120\\;\\mathrm{h}" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "- Per barre", blockText(units.get("11.3.3.5.2.3").blocks.find((block: any) => block.evidence.pdfPage === 338 && blockText(block).startsWith("- Per barre"))), [{ value: "4%", latex: "4\\%" }, { value: "1000 ore", latex: "1000\\;\\mathrm{h}" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "- Per tutti", "- Per tutti i prodotti: a quanto stabilito in tabella 11.3.IX Il campione deve essere sollecitato per un tratto non inferiore a 100 cm; in conseguenza la lunghezza del saggio deve essere convenientemente incrementata per tener conto della lunghezza dei dispositivi di afferraggio. Nella zona sollecitata il campione non deve subire alcuna lavorazione, deformazione meccanica o pulitura.", [{ value: "100 cm", latex: "100\\;\\mathrm{cm}" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "Prove per la determinazione del coefficiente", "Prove per la determinazione del coefficiente medio D di riduzione del carico massimo (trazione deviata).", [{ value: "D", latex: "D" }]);
patchVerifiedText("11.3.3.5.2.3", 338, "Le prove per la determinazione del coefficiente", "Le prove per la determinazione del coefficiente medio D di riduzione del carico massimo per trazione deviata, sono richieste per i trefoli con diametro nominale maggiore o uguale a 12,5 mm e per i trefoli compattati. Il valore limite di D non può superare il 28%.", [{ value: "D", latex: "D" }, { value: "12,5 mm", latex: "12{,}5\\;\\mathrm{mm}" }, { value: "D", latex: "D" }, { value: "28%", latex: "28\\%" }]);
patchVerifiedText("11.3.3.5.2.4", 338, "Negli stabilimenti", blockText(units.get("11.3.3.5.2.4").blocks.find((block: any) => block.evidence.pdfPage === 338 && blockText(block).startsWith("Negli stabilimenti"))), [{ value: "100 t", latex: "100\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.3.5.3", 338, "Effettuato un prelievo", "Effettuato un prelievo di 3 saggi ogni 30 t della stessa categoria di acciaio proveniente dallo stesso stabilimento, anche se con forniture successive, si determinano, mediante prove eseguite presso un laboratorio di cui all’art. 59 del DPR n. 380/2001, i corrispondenti valori minimi di fpt, fpy, fp(1), fp(0,1), Agt e Ep.", [{ value: "3 saggi ogni 30 t", latex: "3\\;\\mathrm{saggi\\ ogni}\\;30\\;\\mathrm{t}" }, { value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(1)", latex: "f_{p(1)}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "Agt", latex: "A_{gt}" }, { value: "Ep", latex: "E_p" }]);
patchVerifiedText("11.3.3.5.3", 338, "- tutti i valori di tensione", "- tutti i valori di tensione al carico massimo fpt non superano il valore caratteristico fptk corrispondente, incrementato del 15%.", [{ value: "fpt", latex: "f_{pt}" }, { value: "fptk", latex: "f_{ptk}" }, { value: "15%", latex: "15\\%" }]);
patchVerifiedText("11.3.3.5.3", 338, "- tutti i valori dell’allungamento", blockText(units.get("11.3.3.5.3").blocks.find((block: any) => block.evidence.pdfPage === 338 && blockText(block).startsWith("- tutti i valori dell’allungamento"))), [{ value: "Agt", latex: "A_{gt}" }]);

removeVerifiedTableResidues("11.3.4.5", 342, ["Tipo di azione sulle strutture", "Materiale Base:", "Nota 1)"]);
removeVerifiedTableResidues("11.3.4.6.1", 342, ["Viti Dadi Rondelle", "Classe di resistenza", "UNI EN ISO 898-1", "UNI EN ISO 898-2", "4.6 ", "100 HV", "UNI EN 15048-1", "4.8", "5.6", "6.8"]);
removeVerifiedTableResidues("11.3.4.6.2", 342, ["Sistema Viti Dadi", "HR 8.8"]);

patchVerifiedText("11.3.3.5.3", 339, "Effettuato il prelievo supplementare", "Effettuato il prelievo supplementare si determinano, mediante prove effettuate presso un laboratorio di cui all’art. 59 del DPR n. 380/2001, i valori di fpt, fpy, fp(1), fp(0,1), Agt, Ep.", [
    { value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(1)", latex: "f_{p(1)}" },
    { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "Agt", latex: "A_{gt}" }, { value: "Ep", latex: "E_p" },
]);
patchVerifiedText("11.3.3.5.3", 339, "- la media dei risultati ottenuti per le grandezze", "- la media dei risultati ottenuti per le grandezze fpt, fpy, fp(0,1), fp(1) sugli ulteriori saggi è almeno uguale al valore caratteristico garantito dal fabbricante e i singoli valori sono superiori allo stesso valore caratteristico garantito, diminuito dell’1,5%.", [
    { value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" },
    { value: "fp(1)", latex: "f_{p(1)}" }, { value: "1,5%", latex: "1{,}5\\%" },
]);
patchVerifiedText("11.3.3.5.3", 339, "- la media dei risultati ottenuti per la grandezza", "- la media dei risultati ottenuti per la grandezza fpt sui 10 ulteriori saggi è al massimo uguale a 1,15 volte il valore caratteristico fptk garantito dal fabbricante e i singoli valori sono inferiori allo stesso limite, incrementato dell’1,5%. La media dei risultati ottenuti per la grandezza Agt sui 10 ulteriori saggi è al minimo uguale al limite indicato nella Tab. 11.3.VIII e i singoli valori sono superiori allo stesso limite, diminuito del 5%.", [
    { value: "fpt", latex: "f_{pt}" }, { value: "10", latex: "10" }, { value: "1,15", latex: "1{,}15" },
    { value: "fptk", latex: "f_{ptk}" }, { value: "1,5%", latex: "1{,}5\\%" }, { value: "Agt", latex: "A_{gt}" },
    { value: "10", latex: "10" }, { value: "5%", latex: "5\\%" },
]);
patchVerifiedText("11.3.3.5.4", 339, "I controlli di accettazione", blockText(units.get("11.3.3.5.4").blocks.find((block: any) => block.evidence.pdfPage === 339 && blockText(block).startsWith("I controlli di accettazione"))), [{ value: "30 t", latex: "30\\;\\mathrm{t}" }]);

for (const unitNumber of ["11.3.3.5.5", "11.3.3.5.7"]) {
    patchVerifiedText(unitNumber, 340, "Nei certificati di prova", "Nei certificati di prova che il laboratorio di cui all’art. 59 del DPR n. 380/2001 rilascia a seguito delle prove di cui ai § 11.3.3.5.2.1 e 11.3.3.5.2.2, devono essere riportati sia i valori delle forze Fpt, Fpy, Fp(0,1), Fp(1), ottenuti dalle singole prove, sia i corrispondenti valori delle tensioni fpt, fpy, fp(0,1), fp(1) calcolate in riferimento alle aree delle sezioni trasversali nominali dei saggi sottoposti a prova. Nei certificati rilasciati dal menzionato laboratorio e relativi a prove ove non sono richieste elaborazioni statistiche dei risultati, oppure dove il solo riferimento per lo svolgimento della prova è il valore del carico massimo ottenuto su saggi gemelli (prova di rilassamento, di fatica, di corrosione sotto tensione, ecc.), i dati di prova possono essere espressi anche solo in termini di forza Fpt.", [
        { value: "Fpt", latex: "F_{pt}" }, { value: "Fpy", latex: "F_{py}" }, { value: "Fp(0,1)", latex: "F_{p(0{,}1)}" }, { value: "Fp(1)", latex: "F_{p(1)}" },
        { value: "fpt", latex: "f_{pt}" }, { value: "fpy", latex: "f_{py}" }, { value: "fp(0,1)", latex: "f_{p(0{,}1)}" }, { value: "fp(1)", latex: "f_{p(1)}" },
        { value: "Fpt", latex: "F_{pt}" },
    ]);
}
for (const unitNumber of ["11.3.3.5.5", "11.3.4.1"]) {
    patchVerifiedText(unitNumber, 340, "Per le palancole metalliche", "Per le palancole metalliche e per i nastri zincati di spessore s ≤ 4 mm si farà riferimento rispettivamente alle UNI EN 10248-1:1997 ed UNI EN 10346:2015.", [{ value: "s ≤ 4 mm", latex: "s\\le4\\;\\mathrm{mm}" }]);
}
for (const unitNumber of ["11.3.3.5.5", "11.3.4.2"]) {
    patchVerifiedText(unitNumber, 340, "– nastri zincati", "– nastri zincati di spessore s ≤ 4 mm.", [{ value: "s ≤ 4 mm", latex: "s\\le4\\;\\mathrm{mm}" }]);
}
patchVerifiedText("11.3.4.1", 340, "Per la realizzazione di strutture", blockText(units.get("11.3.4.1").blocks.find((block: any) => block.evidence.pdfPage === 340 && blockText(block).startsWith("Per la realizzazione di strutture"))), [{ value: "2+", latex: "2+" }]);

patchVerifiedText("11.3.4.5", 341, "Le durezze eseguite", blockText(units.get("11.3.4.5").blocks.find((block: any) => block.evidence.pdfPage === 341 && blockText(block).startsWith("Le durezze eseguite"))), [{ value: "350 HV30", latex: "350\\;\\mathrm{HV30}" }]);
patchVerifiedText("11.3.4.5", 341, "L’entità ed il tipo", blockText(units.get("11.3.4.5").blocks.find((block: any) => block.evidence.pdfPage === 341 && blockText(block).startsWith("L’entità ed il tipo"))), [{ value: "100%", latex: "100\\%" }]);
patchVerifiedText("11.3.4.6.1", 342, "Le tensioni di snervamento", "Le tensioni di snervamento fyb e di rottura ftb delle viti appartenenti alle classi indicate nella precedente Tab. 11.3.XIII.a sono riportate nella seguente Tab. 11.3.XIII.b:", [{ value: "fyb", latex: "f_{yb}" }, { value: "ftb", latex: "f_{tb}" }]);

patchVerifiedText("11.3.4.7", 343, "– allungamento percentuale", "– allungamento percentuale a rottura (valutato su base L0 = 5,65 √A0, dove A0 è l’area della sezione trasversale del saggio) ≥ 12;", [
    { value: "L0 = 5,65 √A0", latex: "L_0=5{,}65\\sqrt{A_0}" }, { value: "A0", latex: "A_0" }, { value: "≥ 12", latex: "\\ge12" },
]);
patchVerifiedText("11.3.4.7", 343, "– rapporto", "– rapporto ft/fy ≥ 1,2. Quando i connettori vengono uniti alle strutture con procedimenti di saldatura speciali, senza metallo d’apporto, essi devono essere fabbricati con acciai la cui composizione chimica soddisfi le limitazioni seguenti: C ≤ 0,18%, Mn ≤ 0,9%, S ≤ 0,04%, P ≤ 0,05%. Per essi si applica quanto riportato al § 11.3.4.10 per le officine per la produzione di elementi strutturali in serie.", [
    { value: "ft/fy ≥ 1,2", latex: "f_t/f_y\\ge1{,}2" }, { value: "C ≤ 0,18%", latex: "C\\le0{,}18\\%" },
    { value: "Mn ≤ 0,9%", latex: "Mn\\le0{,}9\\%" }, { value: "S ≤ 0,04%", latex: "S\\le0{,}04\\%" }, { value: "P ≤ 0,05%", latex: "P\\le0{,}05\\%" },
]);
patchVerifiedText("11.3.4.9", 343, "– per gli acciai da carpenteria", "– per gli acciai da carpenteria il rapporto fra i valori caratteristici della tensione di rottura ftk e la tensione di snervamento fyk deve essere maggiore di 1,10 e l’allungamento a rottura A5, misurato su provino standard, deve essere non inferiore al 20%;", [
    { value: "ftk", latex: "f_{tk}" }, { value: "fyk", latex: "f_{yk}" }, { value: "1,10", latex: "1{,}10" }, { value: "A5", latex: "A_5" }, { value: "20%", latex: "20\\%" },
]);
patchVerifiedText("11.3.4.9", 343, "– la tensione di snervamento media", "– la tensione di snervamento media fy,media deve risultare inferiore a 1,20 fy,k per acciai S235 e S275, oppure a 1,10 fy,k per acciai S355, S420 ed S460;", [
    { value: "fy,media", latex: "f_{y,\\mathrm{media}}" }, { value: "1,20 fy,k", latex: "1{,}20f_{y,k}" }, { value: "1,10 fy,k", latex: "1{,}10f_{y,k}" },
]);
patchVerifiedText("11.3.4.9", 343, "Il valore del coefficiente", "Il valore del coefficiente γov è specificato nel § 7.5.", [{ value: "γov", latex: "\\gamma_{ov}" }]);

patchVerifiedText("11.3.4.11.1.1", 344, "Un lotto di produzione", blockText(units.get("11.3.4.11.1.1").blocks.find((block: any) => block.evidence.pdfPage === 344 && blockText(block).startsWith("Un lotto di produzione"))), [{ value: "30 e 120 t", latex: "30\\text{ e }120\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.4.11.1.2", 344, "La documentazione deve essere", "La documentazione deve essere riferita ad una produzione relativa ad un periodo di tempo di almeno sei mesi e ad un quantitativo di prodotti tale da fornire un quadro statisticamente significativo della produzione stessa e comunque ≥ 500 t oppure ad un numero di colate o di lotti ≥ 25.", [{ value: "≥ 500 t", latex: "\\ge500\\;\\mathrm{t}" }, { value: "≥ 25", latex: "\\ge25" }]);
patchVerifiedText("11.3.4.11.1.2", 344, "Le prove di qualificazione", blockText(units.get("11.3.4.11.1.2").blocks.find((block: any) => block.evidence.pdfPage === 344 && blockText(block).startsWith("Le prove di qualificazione"))), [{ value: "30 prove", latex: "30\\;\\mathrm{prove}" }, { value: "30 saggi", latex: "30\\;\\mathrm{saggi}" }, { value: "3 lotti", latex: "3\\;\\mathrm{lotti}" }]);
patchVerifiedText("11.3.4.11.1.3", 344, "Per ogni colata", blockText(units.get("11.3.4.11.1.3").blocks.find((block: any) => block.evidence.pdfPage === 344 && blockText(block).startsWith("Per ogni colata"))), [{ value: "80 t", latex: "80\\;\\mathrm{t}" }, { value: "40 t", latex: "40\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.4.11.1.3", 344, "Per quanto concerne", "Per quanto concerne fy e ft i dati singoli raccolti, suddivisi per qualità e prodotti (secondo le gamme dimensionali) vengono riportati su idonei diagrammi per consentire di valutare statisticamente nel tempo i risultati della produzione rispetto alle prescrizioni delle presenti norme tecniche.", [{ value: "fy", latex: "f_y" }, { value: "ft", latex: "f_t" }]);
patchVerifiedText("11.3.4.11.1.4", 345, "Inoltre il laboratorio", blockText(units.get("11.3.4.11.1.4").blocks.find((block: any) => block.evidence.pdfPage === 345 && blockText(block).startsWith("Inoltre il laboratorio"))), [{ value: "3 campioni", latex: "3\\;\\mathrm{campioni}" }]);
patchVerifiedText("11.3.4.11.1.4", 345, "Per quanto concerne le prove", blockText(units.get("11.3.4.11.1.4").blocks.find((block: any) => block.evidence.pdfPage === 345 && blockText(block).startsWith("Per quanto concerne le prove"))), [{ value: "8%", latex: "8\\%" }]);
patchVerifiedText("11.3.4.11.1.4", 345, "Per gli acciai con", blockText(units.get("11.3.4.11.1.4").blocks.find((block: any) => block.evidence.pdfPage === 345 && blockText(block).startsWith("Per gli acciai con"))), [{ value: "6%", latex: "6\\%" }]);
patchVerifiedText("11.3.4.11.2.1", 345, "Oltre a quanto previsto", "Oltre a quanto previsto al §11.3.1.7 per i centri di trasformazione, per le lamiere grecate da impiegare in solette composte (di cui al precedente § 4.3.6 delle presenti norme) il fabbricante deve effettuare una specifica sperimentazione al fine di determinare la resistenza a taglio longitudinale di progetto τu,Rd della lamiera grecata. La sperimentazione e la elaborazione dei risultati sperimentali devono essere conformi alle prescrizioni dell’Appendice B.3 alla norma UNI EN 1994-1-1:2005. Questa sperimentazione e l’elaborazione dei risultati sperimentali devono essere eseguite da un laboratorio di cui all’articolo 59 del DPR 380/2001, di adeguata competenza. Il rapporto di prova deve essere trasmesso in copia al Servizio Tecnico Centrale e deve essere riprodotto integralmente nel catalogo dei prodotti.", [{ value: "τu,Rd", latex: "\\tau_{u,Rd}" }]);
patchVerifiedText("11.3.4.11.2.1", 346, "I controlli in officina", blockText(units.get("11.3.4.11.2.1").blocks.find((block: any) => block.evidence.pdfPage === 346 && blockText(block).startsWith("I controlli in officina"))), [{ value: "2 prelievi ogni 10 t", latex: "2\\;\\mathrm{prelievi\\ ogni}\\;10\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.4.11.2.3", 346, "Detti controlli in officina", blockText(units.get("11.3.4.11.2.3").blocks.find((block: any) => block.evidence.pdfPage === 346 && blockText(block).startsWith("Detti controlli in officina"))), [{ value: "1 prova ogni 30 t", latex: "1\\;\\mathrm{prova\\ ogni}\\;30\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.4.11.2.4", 347, "I controlli in stabilimento", blockText(units.get("11.3.4.11.2.4").blocks.find((block: any) => block.evidence.pdfPage === 347 && blockText(block).startsWith("I controlli in stabilimento"))), [{ value: "1 prova", latex: "1\\;\\mathrm{prova}" }, { value: "1000 prodotti", latex: "1000\\;\\mathrm{prodotti}" }]);
patchVerifiedText("11.3.4.11.3", 347, "- Elementi di Carpenteria", blockText(units.get("11.3.4.11.3").blocks.find((block: any) => block.evidence.pdfPage === 347 && blockText(block).startsWith("- Elementi di Carpenteria"))), [{ value: "3 prove ogni 90 tonnellate", latex: "3\\;\\mathrm{prove\\ ogni}\\;90\\;\\mathrm{t}" }, { value: "2 tonnellate", latex: "2\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.4.11.3", 347, "- Lamiere grecate", blockText(units.get("11.3.4.11.3").blocks.find((block: any) => block.evidence.pdfPage === 347 && blockText(block).startsWith("- Lamiere grecate"))), [{ value: "3 prove ogni 15 tonnellate", latex: "3\\;\\mathrm{prove\\ ogni}\\;15\\;\\mathrm{t}" }, { value: "0.5 tonnellate", latex: "0.5\\;\\mathrm{t}" }]);
patchVerifiedText("11.3.4.11.3", 347, "- Bulloni e chiodi", blockText(units.get("11.3.4.11.3").blocks.find((block: any) => block.evidence.pdfPage === 347 && blockText(block).startsWith("- Bulloni e chiodi"))), [{ value: "3 campioni ogni 1500 pezzi", latex: "3\\;\\mathrm{campioni\\ ogni}\\;1500\\;\\mathrm{pezzi}" }, { value: "100", latex: "100" }]);
patchVerifiedText("11.3.4.11.3", 347, "- Giunzioni meccaniche", blockText(units.get("11.3.4.11.3").blocks.find((block: any) => block.evidence.pdfPage === 347 && blockText(block).startsWith("- Giunzioni meccaniche"))), [{ value: "3 campioni ogni 100 pezzi", latex: "3\\;\\mathrm{campioni\\ ogni}\\;100\\;\\mathrm{pezzi}" }, { value: "10", latex: "10" }]);

removeVerifiedTableResidues("11.7.1.1", 349, ["Flessione fm,k"]);
removeVerifiedOcrResidues("11.7.1.1", 350, ["°", "h 150 mink", "h 600 mink"]);

patchVerifiedText("11.7.1.1", 349, "Si definiscono valori caratteristici", blockText(units.get("11.7.1.1").blocks.find((block: any) => block.evidence.pdfPage === 349 && blockText(block).startsWith("Si definiscono valori caratteristici"))), [
    { value: "5%", latex: "5\\%" }, { value: "300 secondi", latex: "300\\;\\mathrm{s}" },
    { value: "20 ±2 °C", latex: "20\\pm2\\;{}^\\circ\\mathrm{C}" }, { value: "65 ± 5%", latex: "65\\pm5\\%" },
]);
patchVerifiedText("11.7.1.1", 349, "Per il modulo elastico", blockText(units.get("11.7.1.1").blocks.find((block: any) => block.evidence.pdfPage === 349 && blockText(block).startsWith("Per il modulo elastico"))), [{ value: "5%", latex: "5\\%" }]);
patchVerifiedText("11.7.1.1", 349, "Si definisce massa volumica", blockText(units.get("11.7.1.1").blocks.find((block: any) => block.evidence.pdfPage === 349 && blockText(block).startsWith("Si definisce massa volumica"))), [
    { value: "5%", latex: "5\\%" }, { value: "20 ± 2 °C", latex: "20\\pm2\\;{}^\\circ\\mathrm{C}" }, { value: "65 ± 5%", latex: "65\\pm5\\%" },
]);
patchVerifiedText("11.7.1.1", 350, "Per il legno massiccio", blockText(units.get("11.7.1.1").blocks.find((block: any) => block.evidence.pdfPage === 350 && blockText(block).startsWith("Per il legno massiccio"))), [
    { value: "150 mm", latex: "150\\;\\mathrm{mm}" }, { value: "150 mm", latex: "150\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.7.1.1", 350, "Pertanto, per elementi", "Pertanto, per elementi di legno massiccio sottoposti a flessione o a trazione parallela alla fibratura che presentino rispettivamente una altezza o il lato maggiore della sezione trasversale inferiore a 150 mm, i valori caratteristici fm,k e ft,0,k, indicati nei profili resistenti, possono essere incrementati tramite il coefficiente moltiplicativo kh, così definito:", [
    { value: "150 mm", latex: "150\\;\\mathrm{mm}" }, { value: "fm,k", latex: "f_{m,k}" },
    { value: "ft,0,k", latex: "f_{t,0,k}" }, { value: "kh", latex: "k_h" },
]);
patchVerifiedText("11.7.1.1", 350, "essendo h", blockText(units.get("11.7.1.1").blocks.find((block: any) => block.evidence.pdfPage === 350 && blockText(block).startsWith("essendo h"))), [{ value: "h", latex: "h" }]);
patchVerifiedText("11.7.1.1", 350, "Per il legno lamellare", blockText(units.get("11.7.1.1").blocks.find((block: any) => block.evidence.pdfPage === 350 && blockText(block).startsWith("Per il legno lamellare"))), [
    { value: "600 mm", latex: "600\\;\\mathrm{mm}" }, { value: "600 mm", latex: "600\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.7.1.1", 350, "Di conseguenza", "Di conseguenza, per elementi di legno lamellare sottoposti a flessione o a trazione parallela alla fibratura che presentino rispettivamente una altezza o il lato maggiore della sezione trasversale inferiore a 600 mm, i valori caratteristici fm,k e ft,0,k, indicati nei profili resistenti, possono essere incrementati tramite il coefficiente moltiplicativo kh, così definito:", [
    { value: "600 mm", latex: "600\\;\\mathrm{mm}" }, { value: "fm,k", latex: "f_{m,k}" },
    { value: "ft,0,k", latex: "f_{t,0,k}" }, { value: "kh", latex: "k_h" },
]);
patchVerifiedText("11.7.1.1", 350, "essendo h", blockText(units.get("11.7.1.1").blocks.filter((block: any) => block.evidence.pdfPage === 350 && blockText(block).startsWith("essendo h"))[1]), [{ value: "h", latex: "h" }], 1);
patchVerifiedText("11.7.5", 351, "Per la valutazione", blockText(units.get("11.7.5").blocks.find((block: any) => block.evidence.pdfPage === 351 && blockText(block).startsWith("Per la valutazione"))), [{ value: "80 mm", latex: "80\\;\\mathrm{mm}" }]);
patchVerifiedText("11.7.10.1.1", 353, "I produttori, i successivi", blockText(units.get("11.7.10.1.1").blocks.find((block: any) => block.evidence.pdfPage === 353 && blockText(block).startsWith("I produttori, i successivi"))), [{ value: "10 anni", latex: "10\\;\\mathrm{anni}" }]);
patchVerifiedText("11.7.10.2", 354, "Il prelievo potrà", blockText(units.get("11.7.10.2").blocks.find((block: any) => block.evidence.pdfPage === 354 && blockText(block).startsWith("Il prelievo potrà"))), [{ value: "trenta giorni", latex: "30\\;\\mathrm{giorni}" }]);
patchVerifiedText("11.7.10.2", 354, "Per gli elementi di legno massiccio", blockText(units.get("11.7.10.2").blocks.find((block: any) => block.evidence.pdfPage === 354 && blockText(block).startsWith("Per gli elementi di legno massiccio"))), [{ value: "cinque per cento", latex: "5\\%" }]);
patchVerifiedText("11.7.10.2", 354, "Per gli elementi di legno lamellare", blockText(units.get("11.7.10.2").blocks.find((block: any) => block.evidence.pdfPage === 354 && blockText(block).startsWith("Per gli elementi di legno lamellare"))), [{ value: "5%", latex: "5\\%" }]);
patchVerifiedText("11.7.10.2", 354, "Per gli altri elementi giuntati", blockText(units.get("11.7.10.2").blocks.find((block: any) => block.evidence.pdfPage === 354 && blockText(block).startsWith("Per gli altri elementi giuntati"))), [{ value: "5%", latex: "5\\%" }]);
patchVerifiedText("11.7.10.2", 354, "Infine, su almeno", blockText(units.get("11.7.10.2").blocks.find((block: any) => block.evidence.pdfPage === 354 && blockText(block).startsWith("Infine, su almeno"))), [{ value: "5%", latex: "5\\%" }]);

patchVerifiedText("11.8.3.1", 356, "Il tecnico suddetto", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("Il tecnico suddetto"))), [{ value: "dieci anni", latex: "10\\;\\mathrm{anni}" }]);
patchVerifiedText("11.8.3.1", 356, "Le prove di stabilimento", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("Le prove di stabilimento"))), [{ value: "28 giorni", latex: "28\\;\\mathrm{giorni}" }]);
patchVerifiedText("11.8.3.1", 356, "Inoltre dovranno eseguirsi", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("Inoltre dovranno eseguirsi"))), [
    { value: "28 giorni", latex: "28\\;\\mathrm{giorni}" }, { value: "un prelievo ogni cinque giorni", latex: "1\\;\\mathrm{prelievo\\ ogni}\\;5\\;\\mathrm{giorni}" },
    { value: "tre prelievi", latex: "3\\;\\mathrm{prelievi}" },
]);
patchVerifiedText("11.8.3.1", 356, "La prova di piegatura", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("La prova di piegatura"))), [
    { value: "tre campioni ogni 90 tonnellate", latex: "3\\;\\mathrm{campioni\\ ogni}\\;90\\;\\mathrm{t}" }, { value: "1 volta al mese", latex: "1\\;\\mathrm{volta\\ al\\ mese}" },
]);
patchVerifiedText("11.8.3.1", 356, "Le prove sulle saldature", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("Le prove sulle saldature"))), [{ value: "due anni", latex: "2\\;\\mathrm{anni}" }]);
patchVerifiedText("11.8.3.1", 356, "A valle dell’operazione", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("A valle dell’operazione"))), [{ value: "tre campioni ogni 10 rotoli", latex: "3\\;\\mathrm{campioni\\ ogni}\\;10\\;\\mathrm{rotoli}" }]);
patchVerifiedText("11.8.3.1", 356, "Il Direttore tecnico di stabilimento curerà", blockText(units.get("11.8.3.1").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("Il Direttore tecnico di stabilimento curerà"))), [{ value: "dieci anni", latex: "10\\;\\mathrm{anni}" }]);
patchVerifiedText("11.8.3.4", 356, "Inoltre, per manufatti", blockText(units.get("11.8.3.4").blocks.find((block: any) => block.evidence.pdfPage === 356 && blockText(block).startsWith("Inoltre, per manufatti"))), [{ value: "8 kN", latex: "8\\;\\mathrm{kN}" }]);

patchVerifiedText("11.9", 358, "Tutti i dispositivi", blockText(units.get("11.9").blocks.find((block: any) => block.evidence.pdfPage === 358 && blockText(block).startsWith("Tutti i dispositivi"))), [
    { value: "10 anni", latex: "10\\;\\mathrm{anni}" }, { value: "–15 °C", latex: "-15\\;{}^\\circ\\mathrm{C}" }, { value: "+45 °C", latex: "+45\\;{}^\\circ\\mathrm{C}" },
]);
patchVerifiedText("11.9", 358, "Nei casi in cui si applica", "Nei casi in cui si applica la norma europea armonizzata UNI EN 15129, le grandezze di riferimento ivi citate andranno desunte da quanto prescritto nelle presenti Norme Tecniche per le Costruzioni; in particolare si intende per dbd lo spostamento valutato per un terremoto riferito allo SLV, e per γx · dbd lo spostamento valutato per un terremoto riferito allo SLC (dpd e γx sono i simboli utilizzati nella UNI EN 15129 rispettivamente per lo spostamento di progetto di un dispositivo e per il fattore di amplificazione di al § 4.1.2 della stessa UNI EN 15129).", [
    { value: "dbd", latex: "d_{bd}" }, { value: "γx · dbd", latex: "\\gamma_x\\cdot d_{bd}" },
    { value: "dpd", latex: "d_{pd}" }, { value: "γx", latex: "\\gamma_x" },
]);

removeVerifiedTableResidues("11.9.5", 361, ["K 2", "K sec", "Βe", "(1) Valori ottenuti"]);
removeVerifiedTableResidues("11.9.6", 362, ["Fornitura Invecchiamento", "F max", "Ed -15%"]);
removeVerifiedTableResidues("11.9.7", 363, ["Fornitura Invecchiamento"]);
removeVerifiedOcrResidues("11.9.5", 361, ["-F1", "-d 1"]);
removeVerifiedOcrResidues("11.9.6", 362, ["confronti delle azioni verticali."]);
removeVerifiedOcrResidues("11.9.3", 359, ["Fabbrica (Factory Production Control tests)."]);

patchVerifiedText("11.9.1", 359, "DISPOSITIVI DI VINCOLO TEMPORANEO", "DISPOSITIVI DI VINCOLO TEMPORANEO: questi dispositivi sono utilizzati per obbligare i movimenti in uno o più direzioni secondo modalità differenziate a seconda del tipo e dell’entità dell’azione. Si distinguono in:", []);
patchVerifiedText("11.9.1", 359, "D ISPOSITIVI DIPENDENTI", "DISPOSITIVI DIPENDENTI DALLO SPOSTAMENTO, a loro volta suddivisi in: Dispositivi a comportamento lineare o “Lineari”: caratterizzati da un legame forza-spostamento sostanzialmente lineare, fino ad un dato livello di spostamento, con comportamento stabile per il numero di cicli richiesti e sostanzialmente indipendente dalla velocità; nella fase di scarico non devono mostrare spostamenti residui significativi.", []);
patchVerifiedText("11.9.1", 359, "DISPOSITIVI costituti", "DISPOSITIVI COSTITUITI DA UNA COMBINAZIONE DELLE PRECEDENTI CATEGORIE.", []);
patchVerifiedText("11.9.3", 359, "Per i dispositivi rientranti", "Per i dispositivi rientranti nel campo di applicazione della norma europea armonizzata UNI EN 15129, le metodologie per le prove di accettazione ed i relativi criteri di valutazione, ove non diversamente specificato nel seguito, sono quelli indicati, per ciascun tipo di dispositivo, nella suddetta norma europea armonizzata con riferimento alle prove di Controllo di Produzione in Fabbrica (Factory Production Control tests). Il numero dei dispositivi da sottoporre a prove di accettazione è di seguito specificato per ciascun tipo di dispositivo.", []);

patchVerifiedText("11.9.4", 360, "Il comportamento dei dispositivi", "Il comportamento dei dispositivi a comportamento lineare è definito tramite la rigidezza equivalente Ke e il coefficiente di smorzamento viscoso equivalente ξe, che devono rispettare le limitazioni", [
    { value: "Ke", latex: "K_e" }, { value: "ξe", latex: "\\xi_e" },
]);
patchVerifiedText("11.9.4", 360, "essendo Kin", "essendo Kin la rigidezza iniziale valutata come rigidezza secante tra i valori corrispondenti al 10% ed il 20% della forza di progetto.", [
    { value: "Kin", latex: "K_{in}" }, { value: "10%", latex: "10\\%" }, { value: "20%", latex: "20\\%" },
]);
patchVerifiedText("11.9.4", 360, "dove il pedice", "dove il pedice “(3)” si riferisce a quantità determinate nel terzo ciclo di carico ed il pedice “(i)” si riferisce a quantità relative all’i-esimo ciclo, escluso il primo (i ≥ 2).", [
    { value: "(3)", latex: "(3)" }, { value: "(i)", latex: "(i)" }, { value: "(i ≥ 2)", latex: "(i\\ge2)" },
]);
patchVerifiedText("11.9.4", 360, "Le variazioni devono", "Le variazioni devono essere valutate con riferimento al 3° ciclo di prova.", [{ value: "3°", latex: "3^\\circ" }]);
patchVerifiedText("11.9.4.1", 360, "Le prove di accettazione", blockText(units.get("11.9.4.1").blocks.find((block: any) => block.evidence.pdfPage === 360 && blockText(block).startsWith("Le prove di accettazione"))), [
    { value: "20%", latex: "20\\%" }, { value: "4", latex: "4" },
]);
patchVerifiedText("11.9.4.1", 360, "Su almeno un dispositivo", "Su almeno un dispositivo verrà anche condotta una prova “quasi statica”, imponendo almeno 5 cicli completi di deformazioni alternate, con ampiezza massima pari a ± d2.", [
    { value: "5 cicli", latex: "5\\;\\mathrm{cicli}" }, { value: "± d2", latex: "\\pm d_2" },
]);

patchVerifiedText("11.9.5", 361, "Il loro comportamento", "Il loro comportamento è individuato dalla curva caratteristica che lega la forza trasmessa dal dispositivo al corrispondente spostamento; tali curve caratteristiche sono, in generale, schematizzabili con delle relazioni bilineari definite imponendo il passaggio per il punto di coordinate (F1, d1), corrispondente al limite teorico del comportamento elastico lineare del dispositivo, e per il punto di coordinate (F2, d2), corrispondente alla condizione di progetto allo SLC.", [
    { value: "(F1, d1)", latex: "(F_1,d_1)" }, { value: "(F2, d2)", latex: "(F_2,d_2)" },
]);
patchVerifiedText("11.9.5", 361, "d el =", "del = spostamento nel primo ramo di carico in una prova sperimentale entro il quale il comportamento è sostanzialmente lineare. In generale può assumersi un valore pari a d2/20;", [
    { value: "del", latex: "d_{el}" }, { value: "d2/20", latex: "d_2/20" },
]);
patchVerifiedText("11.9.5", 361, "Fel =", "Fel = Forza corrispondente a del, nel ramo di carico iniziale sperimentale.", [
    { value: "Fel", latex: "F_{el}" }, { value: "del", latex: "d_{el}" },
]);
patchVerifiedText("11.9.5", 361, "d 1 =", "d1 = ascissa del punto d’intersezione della linea retta congiungente l’origine con il punto (del, Fel) e la linea retta congiungente i punti (d2/4, F(d2/4)) e (d2, F2) nel terzo ciclo della prova sperimentale;", [
    { value: "d1", latex: "d_1" }, { value: "(del, Fel)", latex: "(d_{el},F_{el})" }, { value: "(d2/4, F(d2/4))", latex: "(d_2/4,F(d_2/4))" }, { value: "(d2, F2)", latex: "(d_2,F_2)" },
]);
patchVerifiedText("11.9.5", 361, "F1 =", "F1 = ordinata del punto d’intersezione della linea retta congiungente l’origine con il punto (del, Fel) e la linea retta congiungente i punti (d2/4, F(d2/4)) e (d2, F2) nel terzo ciclo della prova sperimentale;", [
    { value: "F1", latex: "F_1" }, { value: "(del, Fel)", latex: "(d_{el},F_{el})" }, { value: "(d2/4, F(d2/4))", latex: "(d_2/4,F(d_2/4))" }, { value: "(d2, F2)", latex: "(d_2,F_2)" },
]);
patchVerifiedText("11.9.5", 361, "d 2 =", "d2 = spostamento massimo di progetto del dispositivo corrispondente allo SLC;", [{ value: "d2", latex: "d_2" }]);
patchVerifiedText("11.9.5", 361, "F2 =", "F2 = forza corrispondente allo spostamento d2, ottenuta al terzo ciclo sperimentale.", [
    { value: "F2", latex: "F_2" }, { value: "d2", latex: "d_2" },
]);
patchVerifiedText("11.9.5", 361, "Le rigidezze elastica", "Le rigidezze elastica e post-elastica, rispettivamente del primo ramo e del secondo ramo, vengono definite come: K1 = F1/d1; K2 = (F2−F1)/(d2−d1), mentre la rigidezza secante è data da Ksec = F2/d2 e lo smorzamento equivalente è ξe = Ed/(2π F2 d2) essendo Ed l’area del ciclo d’isteresi.", [
    { value: "K1 = F1/d1", latex: "K_1=F_1/d_1" }, { value: "K2 = (F2−F1)/(d2−d1)", latex: "K_2=(F_2-F_1)/(d_2-d_1)" },
    { value: "Ksec = F2/d2", latex: "K_{sec}=F_2/d_2" }, { value: "ξe = Ed/(2π F2 d2)", latex: "\\xi_e=E_d/(2\\pi F_2d_2)" }, { value: "Ed", latex: "E_d" },
]);
patchVerifiedText("11.9.5", 361, "dove il pedice", "dove il pedice “(3)” si riferisce a quantità determinate nel terzo ciclo di carico ed il pedice “(i)” si riferisce a quantità relative all’i-esimo ciclo, escluso il primo (i ≥ 2).", [
    { value: "(3)", latex: "(3)" }, { value: "(i)", latex: "(i)" }, { value: "(i ≥ 2)", latex: "(i\\ge2)" },
]);
patchVerifiedText("11.9.5", 361, "Il ciclo teorico", blockText(units.get("11.9.5").blocks.find((block: any) => block.evidence.pdfPage === 361 && blockText(block).startsWith("Il ciclo teorico"))), [{ value: "10%", latex: "10\\%" }]);
patchVerifiedText("11.9.5", 361, "Le variazioni devono", "Le variazioni devono essere valutate con riferimento al 3° ciclo di prova.", [{ value: "3°", latex: "3^\\circ" }]);
patchVerifiedText("11.9.5", 362, "Quando il rapporto", "Quando il rapporto d’incrudimento risulta K2/K1 ≤ 0,05, il limite su K2 viene sostituito dal limite sulla variazione di K2/K1 che deve differire meno di 0,01 dal valore di progetto.", [
    { value: "K2/K1 ≤ 0,05", latex: "K_2/K_1\\le0{,}05" }, { value: "K2", latex: "K_2" }, { value: "K2/K1", latex: "K_2/K_1" }, { value: "0,01", latex: "0{,}01" },
]);

patchVerifiedText("11.9.6", 362, "I dispositivi a comportamento viscoso", "I dispositivi a comportamento viscoso trasmettono, in generale, soltanto azioni orizzontali ed hanno rigidezza trascurabile nei confronti delle azioni verticali. Essi sono caratterizzati da un valore della forza proporzionale a vα, e pertanto non contribuiscono significativamente alla rigidezza del sistema. La relazione forza spostamento di un dispositivo viscoso, per una legge sinusoidale dello spostamento, è riportata in Fig. 11.9.2. La forma del ciclo è ellittica per α = 1.", [
    { value: "vα", latex: "v^\\alpha" }, { value: "α = 1", latex: "\\alpha=1" },
]);
patchVerifiedText("11.9.6", 362, "Il loro comportamento", "Il loro comportamento è caratterizzato dalla massima forza sviluppata Fmax e dall’energia dissipata Ed in un ciclo, per una prefissata ampiezza e frequenza, ossia dalle costanti C e α.", [
    { value: "Fmax", latex: "F_{max}" }, { value: "Ed", latex: "E_d" }, { value: "C", latex: "C" }, { value: "α", latex: "\\alpha" },
]);
patchVerifiedText("11.9.6", 362, "Per assicurare", "Per assicurare un comportamento ciclico stabile, le variazioni dell’energia dissipata Ed in una serie di cicli di carico riferiti a stessa velocità e spostamento massimi devono essere limitate nel modo seguente:", [{ value: "Ed", latex: "E_d" }]);
patchVerifiedText("11.9.6", 362, "dove il pedice", "dove il pedice “(3)” si riferisce a quantità determinate nel terzo ciclo di carico ed il pedice “(i)” si riferisce a quantità relative all’i-esimo ciclo, escluso il primo (i ≥ 2).", [
    { value: "(3)", latex: "(3)" }, { value: "(i)", latex: "(i)" }, { value: "(i ≥ 2)", latex: "(i\\ge2)" },
]);
patchVerifiedText("11.9.6", 362, "Per tener conto", "Per tener conto di possibili valori di velocità superiori a quelli di progetto, la forza massima di progetto del dispositivo va amplificata con un fattore di affidabilità γv dato da", [{ value: "γv", latex: "\\gamma_v" }]);
patchVerifiedText("11.9.6", 362, "in cui td", "in cui td è la tolleranza sulla forza di progetto fornita dal fabbricante, comprensiva della variabilità per effetto della temperatura, e α è l’esponente della legge costitutiva.", [
    { value: "td", latex: "t_d" }, { value: "α", latex: "\\alpha" },
]);
patchVerifiedText("11.9.6", 362, "Il dispositivo deve possedere", blockText(units.get("11.9.6").blocks.find((block: any) => block.evidence.pdfPage === 362 && blockText(block).startsWith("Il dispositivo deve possedere"))), [{ value: "2 gradi sessagesimali", latex: "2^\\circ" }]);
patchVerifiedText("11.9.6.1", 362, "Le prove di accettazione", blockText(units.get("11.9.6.1").blocks.find((block: any) => block.evidence.pdfPage === 362 && blockText(block).startsWith("Le prove di accettazione"))), [
    { value: "20%", latex: "20\\%" }, { value: "4", latex: "4" },
]);

patchVerifiedText("11.9.7", 363, "Le piastre di acciaio", blockText(units.get("11.9.7").blocks.find((block: any) => block.evidence.pdfPage === 363 && blockText(block).startsWith("Le piastre di acciaio"))), [
    { value: "18%", latex: "18\\%" }, { value: "2 mm", latex: "2\\;\\mathrm{mm}" }, { value: "20 mm", latex: "20\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.9.7", 363, "S1 fattore", "S1 fattore di forma primario, rapporto tra la superficie A’ comune al singolo strato di elastomero ed alla singola piastra d’acciaio, depurata degli eventuali fori (se non riempiti successivamente), e la superficie laterale libera L del singolo strato di elastomero, maggiorata della superficie laterale degli eventuali fori (se non riempiti successivamente) ossia S1 = A’/L;", [
    { value: "S1", latex: "S_1" }, { value: "A’", latex: "A'" }, { value: "L", latex: "L" }, { value: "S1 = A’/L", latex: "S_1=A'/L" },
]);
patchVerifiedText("11.9.7", 363, "S2 fattore", "S2 fattore di forma secondario, rapporto tra la dimensione in pianta D della singola piastra in acciaio, parallelamente all’azione orizzontale agente, e lo spessore totale te degli strati di elastomero ossia S2 = D/te.", [
    { value: "S2", latex: "S_2" }, { value: "D", latex: "D" }, { value: "te", latex: "t_e" }, { value: "S2 = D/te", latex: "S_2=D/t_e" },
]);
patchVerifiedText("11.9.7", 363, "Gli isolatori in materiale", "Gli isolatori in materiale elastomerico ed acciaio sono individuati attraverso le loro curve caratteristiche forza-spostamento, generalmente non lineari, tramite i due parametri sintetici: la rigidezza equivalente Ke, il coefficiente di smorzamento viscoso equivalente ξe.", [
    { value: "Ke", latex: "K_e" }, { value: "ξe", latex: "\\xi_e" },
]);
patchVerifiedText("11.9.7", 363, "La rigidezza equivalente", "La rigidezza equivalente Ke, relativa ad un ciclo di carico, è definita come rapporto tra la forza F corrispondente allo spostamento massimo d raggiunto in quel ciclo e lo stesso spostamento (Ke = F/d) e si valuta come prodotto del modulo dinamico equivalente a taglio Gdin per A/te.", [
    { value: "Ke", latex: "K_e" }, { value: "F", latex: "F" }, { value: "d", latex: "d" }, { value: "(Ke = F/d)", latex: "(K_e=F/d)" }, { value: "Gdin", latex: "G_{din}" }, { value: "A/te", latex: "A/t_e" },
]);
patchVerifiedText("11.9.7", 363, "Il coefficiente", "Il coefficiente di smorzamento viscoso equivalente ξe si definisce come rapporto tra l’energia dissipata in un ciclo completo di carico Ed e 2πFd, ossia ξe = Ed/(2πFd).", [
    { value: "ξe", latex: "\\xi_e" }, { value: "Ed", latex: "E_d" }, { value: "2πFd", latex: "2\\pi Fd" }, { value: "ξe = Ed/(2πFd)", latex: "\\xi_e=E_d/(2\\pi Fd)" },
]);
patchVerifiedText("11.9.7", 363, "La rigidezza verticale", "La rigidezza verticale Kv è definita come rapporto tra la forza verticale di progetto Fv e lo spostamento verticale dv (Kv = Fv/dv).", [
    { value: "Kv", latex: "K_v" }, { value: "Fv", latex: "F_v" }, { value: "dv", latex: "d_v" }, { value: "(Kv = Fv/dv)", latex: "(K_v=F_v/d_v)" },
]);
patchVerifiedText("11.9.7", 363, "Le variazioni devono", "Le variazioni devono essere valutate con riferimento al 3° ciclo di prova. Le frequenze di prova per valutare le variazioni delle caratteristiche meccaniche sono 0,1 Hz e 0,5 Hz.", [
    { value: "3°", latex: "3^\\circ" }, { value: "0,1 Hz", latex: "0{,}1\\;\\mathrm{Hz}" }, { value: "0,5 Hz", latex: "0{,}5\\;\\mathrm{Hz}" },
]);
patchVerifiedText("11.9.7", 363, "Le variazioni dovute", blockText(units.get("11.9.7").blocks.find((block: any) => block.evidence.pdfPage === 363 && blockText(block).startsWith("Le variazioni dovute"))), [{ value: "15%", latex: "15\\%" }]);
patchVerifiedText("11.9.7.1", 363, "Le prove di accettazione", blockText(units.get("11.9.7.1").blocks.find((block: any) => block.evidence.pdfPage === 363 && blockText(block).startsWith("Le prove di accettazione"))), [
    { value: "20%", latex: "20\\%" }, { value: "4", latex: "4" },
]);

patchVerifiedText("11.9.8", 363, "Gli isolatori a scorrimento", "Gli isolatori a scorrimento devono essere in grado di sopportare, sotto spostamento massimo impresso pari a d2, almeno 5 cicli di carico e scarico. I cicli si riterranno favorevolmente sopportati se il coefficiente d’attrito (f), nei cicli successivi al primo, non varierà di più del 25% rispetto alle caratteristiche riscontrate durante il terzo ciclo, ossia", [
    { value: "d2", latex: "d_2" }, { value: "5 cicli", latex: "5\\;\\mathrm{cicli}" }, { value: "(f)", latex: "(f)" }, { value: "25%", latex: "25\\%" },
]);
patchVerifiedText("11.9.8", 363, "avendo contrassegnato", "avendo contrassegnato con il pedice “(i)” le caratteristiche valutate all’i-esimo ciclo e con il pedice “(3)” le caratteristiche valutate al terzo ciclo. Detto ddc lo spostamento massimo di progetto del centro di rigidezza del sistema d’isolamento, corrispondente allo SLC, qualora l’incremento della forza nel sistema di isolamento per spostamenti tra 0,5 ddc e ddc sia inferiore all’1,25% del peso totale della sovrastruttura, gli isolatori a scorrimento debbono essere in grado di garantire la loro funzione di appoggio fino a spostamenti pari ad 1,25 d2.", [
    { value: "(i)", latex: "(i)" }, { value: "(3)", latex: "(3)" }, { value: "ddc", latex: "d_{dc}" },
    { value: "0,5 ddc", latex: "0{,}5d_{dc}" }, { value: "ddc", latex: "d_{dc}" }, { value: "1,25%", latex: "1{,}25\\%" }, { value: "1,25 d2", latex: "1{,}25d_2" },
]);
patchVerifiedText("11.9.8.1", 363, "Le prove di accettazione", blockText(units.get("11.9.8.1").blocks.find((block: any) => block.evidence.pdfPage === 363 && blockText(block).startsWith("Le prove di accettazione"))), [
    { value: "20%", latex: "20\\%" }, { value: "4", latex: "4" },
]);
patchVerifiedText("11.9.8.1", 364, "Qualora gli isolatori", "Qualora gli isolatori fossero dotati di elementi o meccanismi supplementari atti a migliorarne le prestazioni sismiche, su almeno un dispositivo completo di tali parti supplementari verrà anche condotta una prova “quasi statica”, imponendo almeno 5 cicli completi di deformazioni alternate, con ampiezza massima pari a ± d2. Il dispositivo non potrà essere utilizzato nella costruzione, a meno che il suo perfetto funzionamento non sia ripristinabile con la sostituzione degli elementi base.", [
    { value: "5 cicli", latex: "5\\;\\mathrm{cicli}" }, { value: "± d2", latex: "\\pm d_2" },
]);

patchVerifiedText("11.9.9.1", 364, "Le prove di accettazione", blockText(units.get("11.9.9.1").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("Le prove di accettazione"))), [{ value: "±10%", latex: "\\pm10\\%" }]);
patchVerifiedText("11.9.9.1", 364, "ȡ misura", "– misura della geometria esterna, con tolleranza di ±10% sugli spessori e ±5% sulle lunghezze, per i componenti determinanti ai fini del comportamento.", [
    { value: "±10%", latex: "\\pm10\\%" }, { value: "±5%", latex: "\\pm5\\%" },
]);
patchVerifiedText("11.9.9.1", 364, "ȡ Valutazione della capacità", "– Valutazione della capacità di sostenere almeno 3 cicli monotonici con carico massimo impresso pari al valore di progetto di servizio, con una tolleranza del +10%, in assenza di snervamenti o rotture.", [
    { value: "3 cicli", latex: "3\\;\\mathrm{cicli}" }, { value: "+10%", latex: "+10\\%" },
]);
patchVerifiedText("11.9.9.1", 364, "ȡ Valutazione della forza", "– Valutazione della forza di rilascio, sottoponendo il campione ad un carico monotonico sino al raggiungimento della rottura del fusibile (forza di rilascio). La tolleranza, rispetto al valore di progetto, deve essere definita dal progettista e, in assenza di tale valutazione, è pari a ±15%.", [{ value: "±15%", latex: "\\pm15\\%" }]);
for (const prefix of ["– misura", "– Valutazione della capacità", "– Valutazione della forza"]) {
    const block = units.get("11.9.9.1").blocks.find((candidate: any) => candidate.evidence.pdfPage === 364 && blockText(candidate).startsWith(prefix));
    if (block === undefined) throw new Error(`Voce elenco verificata non trovata: ${prefix}`);
    block.kind = "list-item";
}
patchVerifiedText("11.9.9.1", 364, "Le prove di accettazione devono", blockText(units.get("11.9.9.1").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("Le prove di accettazione devono"))), [
    { value: "20%", latex: "20\\%" }, { value: "4", latex: "4" },
]);

patchVerifiedText("11.9.10", 364, "La corsa disponibile", blockText(units.get("11.9.10").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("La corsa disponibile"))), [
    { value: "±50 mm", latex: "\\pm50\\;\\mathrm{mm}" }, { value: "±25 mm", latex: "\\pm25\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.9.10", 364, "Il dispositivo deve possedere", blockText(units.get("11.9.10").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("Il dispositivo deve possedere"))), [{ value: "2 gradi", latex: "2^\\circ" }]);
patchVerifiedText("11.9.10", 364, "Il fattore di sicurezza", blockText(units.get("11.9.10").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("Il fattore di sicurezza"))), [
    { value: "1,5", latex: "1{,}5" }, { value: "110%", latex: "110\\%" }, { value: "1,1", latex: "1{,}1" },
]);
patchVerifiedText("11.9.10", 364, "La velocità di attivazione", blockText(units.get("11.9.10").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("La velocità di attivazione"))), [
    { value: "0,5 mm/s", latex: "0{,}5\\;\\mathrm{mm/s}" }, { value: "5 mm/s", latex: "5\\;\\mathrm{mm/s}" }, { value: "0,01 mm/s", latex: "0{,}01\\;\\mathrm{mm/s}" },
]);
patchVerifiedText("11.9.10.1", 364, "Le prove di accettazione", blockText(units.get("11.9.10.1").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("Le prove di accettazione"))), [
    { value: "20%", latex: "20\\%" }, { value: "4", latex: "4" },
]);
patchVerifiedText("11.9.10.1", 364, "Per le prove di accettazione", blockText(units.get("11.9.10.1").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("Per le prove di accettazione"))), [{ value: "1,5 volte", latex: "1{,}5\\;\\mathrm{volte}" }]);
patchVerifiedText("11.9.10.1", 364, "a) Raggiungimento", blockText(units.get("11.9.10.1").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("a) Raggiungimento"))), [
    { value: "0,5 secondi", latex: "0{,}5\\;\\mathrm{s}" }, { value: "5 secondi", latex: "5\\;\\mathrm{s}" },
]);
patchVerifiedText("11.9.10.1", 364, "b) Inversione", blockText(units.get("11.9.10.1").blocks.find((block: any) => block.evidence.pdfPage === 364 && blockText(block).startsWith("b) Inversione"))), [
    { value: "1 secondo", latex: "1\\;\\mathrm{s}" }, { value: "5 secondi", latex: "5\\;\\mathrm{s}" },
]);

removeVerifiedTableResidues("11.10.1", 365, ["Specifica Tecnica Europea", "Categoria II"]);
removeVerifiedTableResidues("11.10.2.1", 366, ["Classe M 2,5", "Resistenza a compressione N/mm2", "d è una resistenza", "Specifica Tecnica Europea"]);
removeVerifiedTableResidues("11.10.2.2", 366, ["Specifica Tecnica Europea"]);
removeVerifiedTableResidues("11.10.3.1.2", 368, ["Resistenza caratteristica a compressione fbk"]);
removeVerifiedTableResidues("11.10.3.2.2", 368, ["Elementi per muratura", "Laterizio M10", "0,30 *", "0,20 **", "* valore valido"]);
removeVerifiedOcrResidues("11.10.1.1.1", 365, ["menti con"]);

patchVerifiedText("11.10.1", 365, "Come più precisamente", blockText(units.get("11.10.1").blocks.find((block: any) => block.evidence.pdfPage === 365 && blockText(block).startsWith("Come più precisamente"))), [{ value: "5%", latex: "5\\%" }]);
patchVerifiedText("11.10.1", 365, "L’uso di elementi", "L’uso di elementi per muratura portante di Categoria I e II è subordinato all’adozione, nella valutazione della resistenza di progetto, del corrispondente coefficiente di sicurezza γM riportato nel relativo paragrafo 4.5.6.", [{ value: "γM", latex: "\\gamma_M" }]);

patchVerifiedText("11.10.1.1.1", 365, "Il controllo di accettazione", "Il controllo di accettazione in cantiere ha lo scopo di accertare se gli elementi da mettere in opera abbiano le caratteristiche dichiarate dal fabbricante. Nel caso in cui il fabbricante abbia dichiarato la resistenza media, il controllo sarà effettuato su almeno un campione per ogni 350 m³ di fornitura per elementi di Categoria II, e per ogni 650 m³ per elementi di Categoria I. Ogni campione sarà costituito da n elementi (n ≥ 6) da sottoporre a prova di compressione. Per ogni campione siano f1, f2, …, fn le resistenze a compressione degli elementi con f1 < f2 < … < fn; il controllo sul campione si considera positivo se risultino verificate entrambe le disuguaglianze:", [
    { value: "350 m³", latex: "350\\;\\mathrm{m^3}" }, { value: "650 m³", latex: "650\\;\\mathrm{m^3}" }, { value: "n", latex: "n" }, { value: "(n ≥ 6)", latex: "(n\\ge6)" },
    { value: "f1, f2, …, fn", latex: "f_1,f_2,\\ldots,f_n" }, { value: "f1 < f2 < … < fn", latex: "f_1<f_2<\\ldots<f_n" },
]);
patchVerifiedText("11.10.1.1.1", 365, "Nel caso in cui il fabbricante", "Nel caso in cui il fabbricante non abbia dichiarato la resistenza media ma abbia dichiarato la sola resistenza caratteristica, il controllo di accettazione in cantiere sarà effettuato su almeno un campione per ogni 350 m³ di fornitura per elementi di Categoria II, innalzabili a 650 m³ per elementi di Categoria I. Per ogni campione, siano f1, f2, …, f6 le resistenze a compressione dei sei elementi con f1 < f2 < … < f6; il controllo si considera effettuato con esito positivo se risulta verificata la seguente disuguaglianza: f1 ≥ fbk, dove fbk è la resistenza caratteristica a compressione dichiarata dal fabbricante.", [
    { value: "350 m³", latex: "350\\;\\mathrm{m^3}" }, { value: "650 m³", latex: "650\\;\\mathrm{m^3}" }, { value: "f1, f2, …, f6", latex: "f_1,f_2,\\ldots,f_6" },
    { value: "f1 < f2 < … < f6", latex: "f_1<f_2<\\ldots<f_6" }, { value: "f1 ≥ fbk", latex: "f_1\\ge f_{bk}" }, { value: "fbk", latex: "f_{bk}" },
]);

patchVerifiedText("11.10.2", 366, "Le prestazioni meccaniche", "Le prestazioni meccaniche di una malta sono definite mediante la sua resistenza media a compressione fm.", [{ value: "fm", latex: "f_m" }]);
patchVerifiedText("11.10.2", 366, "La classe di una malta", "La classe di una malta è definita da una sigla costituita dalla lettera M seguita da un numero che indica la resistenza fm espressa in N/mm² secondo la Tab. 11.10.II. Per l’impiego in muratura portante non sono ammesse malte con resistenza fm < 2,5 N/mm².", [
    { value: "fm", latex: "f_m" }, { value: "N/mm²", latex: "\\mathrm{N/mm^2}" }, { value: "fm < 2,5 N/mm²", latex: "f_m<2{,}5\\;\\mathrm{N/mm^2}" },
]);
patchVerifiedText("11.10.2.4", 367, "Il prelievo potrà", "Il prelievo potrà anche essere eseguito dallo stesso laboratorio incaricato della esecuzione delle prove. I laboratori devono conservare i campioni sottoposti a prova per almeno trenta giorni dopo l’emissione dei certificati di prova, in modo da consentirne l’identificabilità e la rintracciabilità.", [{ value: "trenta giorni", latex: "30\\;\\mathrm{giorni}" }]);
patchVerifiedText("11.10.2.4", 367, "Il controllo di accettazione", "Il controllo di accettazione va eseguito su miscele omogenee e prevede il campionamento di almeno 3 provini prismatici 40 × 40 × 160 mm ogni 350 m³ di muratura realizzata con la stessa miscela nel caso di malte a composizione prescritta o prodotte in cantiere, oppure ogni 700 m³ di muratura realizzata con la stessa miscela nel caso di malte a prestazione garantita, da sottoporre a flessione, e quindi a compressione sulle 6 metà risultanti, secondo quanto indicato nella norma UNI EN 1015-11:2007. Il valore medio delle resistenze a compressione misurate deve risultare maggiore o uguale del valore di progetto.", [
    { value: "3 provini", latex: "3\\;\\mathrm{provini}" }, { value: "40 × 40 × 160 mm", latex: "40\\times40\\times160\\;\\mathrm{mm}" },
    { value: "350 m³", latex: "350\\;\\mathrm{m^3}" }, { value: "700 m³", latex: "700\\;\\mathrm{m^3}" }, { value: "6", latex: "6" },
]);

patchVerifiedText("11.10.3.1.1", 367, "La resistenza caratteristica", "La resistenza caratteristica sperimentale a compressione si determina su n muretti (n ≥ 6), secondo la procedura descritta nella norma UNI EN 1052-1:2001.", [
    { value: "n", latex: "n" }, { value: "(n ≥ 6)", latex: "(n\\ge6)" },
]);
patchVerifiedText("11.10.3.1.1", 367, "– malta:", "– malta: n. 3 provini prismatici 40 × 40 × 160 mm da sottoporre a flessione, e quindi a compressione sulle 6 metà risultanti, secondo la norma UNI EN 1015-11:2007;", [
    { value: "3 provini", latex: "3\\;\\mathrm{provini}" }, { value: "40 × 40 × 160 mm", latex: "40\\times40\\times160\\;\\mathrm{mm}" }, { value: "6", latex: "6" },
]);
patchVerifiedText("11.10.3.1.1", 367, "– elementi resistenti:", blockText(units.get("11.10.3.1.1").blocks.find((block: any) => block.evidence.pdfPage === 367 && blockText(block).startsWith("– elementi resistenti:"))), [{ value: "10 elementi", latex: "10\\;\\mathrm{elementi}" }]);
patchVerifiedText("11.10.3.1.2", 367, "In sede di progetto", "In sede di progetto, per le murature formate da elementi artificiali pieni o semipieni il valore della resistenza caratteristica a compressione della muratura fk può essere dedotto dalla resistenza caratteristica a compressione degli elementi e dalla classe di appartenenza della malta tramite la Tab. 11.10.VI. Ai fini dell’uso di tale tabella, nel caso la resistenza a compressione degli elementi sia dichiarata mediante il suo valore medio fbm, in assenza di una determinazione sperimentale diretta, la resistenza caratteristica dell’elemento fbk può essere stimata mediante la relazione fbk = 0,8 fbm. La validità della tabella è limitata a quelle murature aventi giunti orizzontali e verticali riempiti di malta e di spessore compreso tra 5 e 15 mm. Per valori non contemplati in tabella è ammessa l’interpolazione lineare; in nessun caso sono ammesse estrapolazioni.", [
    { value: "fk", latex: "f_k" }, { value: "fbm", latex: "f_{bm}" }, { value: "fbk", latex: "f_{bk}" }, { value: "fbk = 0,8 fbm", latex: "f_{bk}=0{,}8f_{bm}" }, { value: "5 e 15 mm", latex: "5\\text{ e }15\\;\\mathrm{mm}" },
]);
patchVerifiedText("11.10.3.1.2", 368, "Nel caso di murature", "Nel caso di murature costituite da elementi naturali si assume convenzionalmente la resistenza caratteristica a compressione dell’elemento fbk pari a:", [{ value: "fbk", latex: "f_{bk}" }]);
patchVerifiedText("11.10.3.1.2", 368, "dove fbm", "dove fbm rappresenta la resistenza media a compressione degli elementi in pietra squadrata.", [{ value: "fbm", latex: "f_{bm}" }]);
patchVerifiedText("11.10.3.1.2", 368, "Il valore della resistenza", "Il valore della resistenza caratteristica a compressione della muratura fk può essere dedotto dalla resistenza caratteristica a compressione degli elementi fbk e dalla classe di appartenenza della malta tramite la seguente Tab. 11.10.VII.", [
    { value: "fk", latex: "f_k" }, { value: "fbk", latex: "f_{bk}" },
]);
patchVerifiedText("11.10.3.1.2", 368, "In alternativa alla determinazione", "In alternativa alla determinazione sperimentale della resistenza a compressione, per la stima della resistenza caratteristica a compressione della muratura in elementi artificiali e naturali, è anche possibile fare riferimento a quanto riportato al § 3.6 della norma UNI EN 1996-1-1:2013, integrata dalla relativa Appendice Nazionale. Per la determinazione della resistenza normalizzata del blocco fb a cui queste norme si riferiscono, qualora essa non sia dichiarata dal fabbricante, si utilizzano i fattori di conversione della resistenza alla compressione media del blocco contenuti nella appendice A della UNI EN 772-1.", [{ value: "fb", latex: "f_b" }]);
patchVerifiedText("11.10.3.2.1", 368, "La resistenza caratteristica", "La resistenza caratteristica sperimentale a taglio si determina su n campioni (n ≥ 6), seguendo sia, per la confezione che per la prova, le modalità indicate nella norma UNI EN 1052-3:2007 e, per quanto applicabile, UNI EN 1052-4:2001. In alternativa, la resistenza caratteristica a taglio può essere valutata con prove di compressione diagonale su n campioni di muratura (n ≥ 6) seguendo, sia per la confezione che per la prova, le modalità indicate in normative di comprovata validità.", [
    { value: "n", latex: "n" }, { value: "(n ≥ 6)", latex: "(n\\ge6)" }, { value: "n", latex: "n" }, { value: "(n ≥ 6)", latex: "(n\\ge6)" },
]);
patchVerifiedText("11.10.3.2.2", 368, "In sede di progetto", "In sede di progetto, per le murature formate da elementi artificiali oppure in pietra naturale squadrata, il valore di fvk0, in alternativa alla determinazione sperimentale, può essere dedotto dalla Tab. 11.10.VIII. Per valori non contemplati in tabella è ammessa l’interpolazione lineare; in nessun caso sono ammesse estrapolazioni. Per caratteristiche dei materiali (resistenza della malta o resistenza dei blocchi) diverse da quelle contemplate in tabella, è necessario ricorrere alla determinazione sperimentale.", [{ value: "fvk0", latex: "f_{vk0}" }]);
patchVerifiedText("11.10.3.2.2", 369, "I valori in tabella", "I valori in tabella possono essere direttamente utilizzati nel caso di giunti orizzontali e verticali riempiti di malta. Nel caso di giunti orizzontali riempiti di malta e giunti verticali non riempiti, ma con le facce adiacenti degli elementi di muratura poste in contatto l’una con l’altra, i valori della tabella vanno dimezzati. Per la stima della resistenza a taglio della muratura con letto di malta interrotto, nella quale gli elementi di muratura sono disposti su due o più strisce uguali di malta ordinaria riempiti, i valori di fvk0 relativi al letto pieno vanno opportunamente ridotti secondo quanto indicato nella norma UNI EN 1996-1-1 integrata dalla relativa Appendice Nazionale.", [{ value: "fvk0", latex: "f_{vk0}" }]);

patchVerifiedText("11.10.3.3", 369, "In presenza di tensioni", "In presenza di tensioni di compressione, la resistenza caratteristica a taglio della muratura, fvk, è definita come resistenza all’effetto combinato delle forze orizzontali e dei carichi verticali agenti nel piano del muro e può essere ricavata tramite la relazione", [{ value: "fvk", latex: "f_{vk}" }]);
patchVerifiedText("11.10.3.3", 369, "dove:", "dove: fvk0 è la resistenza caratteristica a taglio in assenza di carichi verticali;", [{ value: "fvk0", latex: "f_{vk0}" }]);
patchVerifiedText("11.10.3.3", 369, "Vn", "σn è la tensione normale media dovuta ai carichi verticali agenti nella sezione di verifica.", [{ value: "σn", latex: "\\sigma_n" }]);
patchVerifiedText("11.10.3.3", 369, "fvk,lim valore", "fvk,lim valore massimo della resistenza caratteristica a taglio che può essere impiegata nel calcolo;", [{ value: "fvk,lim", latex: "f_{vk,\\lim}" }]);
patchVerifiedText("11.10.3.3", 369, "ad eccezione degli elementi", "ad eccezione degli elementi pieni in calcestruzzo aerato autoclavato e di tutti gli elementi caratterizzati da una resistenza a trazione (misurata in direzione orizzontale parallelamente al piano di posa) maggiore o uguale a 0,2 fb, per i quali si pone:", [{ value: "0,2 fb", latex: "0{,}2f_b" }]);
patchVerifiedText("11.10.3.3", 369, "dove fb", "dove fb è la resistenza normalizzata a compressione verticale dei blocchi valutata secondo le norme armonizzate della serie UNI EN 771. I valori di fvk,lim sopra riportati sono relativi a muratura con giunti verticali riempiti di malta. Nel caso di giunti orizzontali riempiti di malta e giunti verticali non riempiti, ma con le facce adiacenti degli elementi di muratura poste in contatto l’una dell’altra, si adotta fvk,lim = 0,045 fb.", [
    { value: "fb", latex: "f_b" }, { value: "fvk,lim", latex: "f_{vk,\\lim}" }, { value: "fvk,lim = 0,045 fb", latex: "f_{vk,\\lim}=0{,}045f_b" },
]);
patchVerifiedText("11.10.3.4", 369, "Il modulo di elasticità", "Il modulo di elasticità normale secante della muratura è valutato sperimentalmente su n muretti (n ≥ 6), seguendo sia per la confezione che per la prova le modalità indicate nella norma UNI EN 1052-1:2001.", [
    { value: "n", latex: "n" }, { value: "(n ≥ 6)", latex: "(n\\ge6)" },
]);

const figureManifest: any[] = [];
await mkdir(figureDir, { recursive: true });
for (const definition of figures) {
    const unit = units.get(definition.unit);
    if (unit === undefined) throw new Error(`Unità mancante per figura ${definition.number}`);
    const captionPattern = new RegExp(`^Fig\\.\\s*${escapeRegExp(definition.number)}`, "u");
    const index = unit.blocks.findIndex((block: any) => block.kind === "paragraph" && block.evidence.pdfPage === definition.page && captionPattern.test(blockText(block)));
    if (index < 0) throw new Error(`Figura ${definition.number} non trovata nella unità ${definition.unit}`);
    const sourceBlock = unit.blocks[index];
    const id = assetId("figure", definition.number);
    const sourcePath = join(evidenceRenderDir, definition.sourceName);
    const image = await readFile(sourcePath);
    const imageName = `fig${definition.number}.png`;
    await copyFile(sourcePath, join(figureDir, imageName));
    if (!unit.assets.figureIds.includes(id)) unit.assets.figureIds.push(id);
    unit.blocks[index] = { blockId: sourceBlock.blockId, kind: "figure-ref", origin: "official", assetId: id, evidence: refEvidence(sourceBlock) };
    figureManifest.push({ id, unitId: unit.id, officialNumber: definition.number, pdfPage: definition.page, caption: definition.caption, alt: definition.alt, imagePath: `figures/ntc2018/${imageName}`, region: definition.region, sha256: sha256(image) });
}

for (const unit of units.values()) reindex(unit);
for (const unit of units.values()) {
    if (dirtyUnits.has(unit.numbering.official) || unit.assets.formulaIds.length > 0 || unit.assets.tableIds.length > 0 || unit.assets.figureIds.length > 0) {
        await writeFile(join(unitDir, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "11-step2",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaManifest,
    tables: tableManifest,
    figures: figureManifest,
};
await mkdir(manifestDir, { recursive: true });
await writeFile(join(manifestDir, "11-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc11-step2: generated ${formulaManifest.length} formulas, ${tableManifest.length} tables and ${figureManifest.length} figures`);
