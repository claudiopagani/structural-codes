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

function sha256(value: Buffer): string {
    return createHash("sha256").update(value).digest("hex");
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
    { number: "11.2.8", unit: "11.2.10.6", page: 318, marker: "2.8", latex: "\\varepsilon_{cd}(t)=\\beta_{ds}(t-t_s)\\varepsilon_{cd,\\infty}" },
    { number: "11.2.9", unit: "11.2.10.6", page: 318, marker: "2.9", latex: "\\beta_{ds}(t-t_s)=\\frac{t-t_s}{(t-t_s)+0{,}04\\sqrt{h_0^3}}" },
    { number: "11.2.10", unit: "11.2.10.6", page: 318, marker: "2.10", latex: "\\varepsilon_{ca,\\infty}=-2{,}5\\,(f_{ck}-10)\\,10^{-6}" },
    { number: "11.3.1", unit: "11.3.2.5", page: 325, marker: "3.1", latex: "\\frac{\\phi_{\\min}}{\\phi_{\\max}}\\ge0{,}6" },
    { number: "11.3.2", unit: "11.3.2.6", page: 325, marker: "3.2", latex: "C_{eq}=C+\\frac{Mn}{6}+\\frac{Cr+Mo+V}{5}+\\frac{Ni+Cu}{15}" },
    { number: "11.3.3", unit: "11.3.2.10.1.3", page: 327, marker: "3.3", latex: "\\bar{x}-ks\\ge C_v" },
    { number: "11.3.4", unit: "11.3.2.10.1.3", page: 327, marker: "3.4", latex: "\\bar{x}+ks\\le C_v" },
    { number: "11.3.5", unit: "11.3.2.10.4", page: 329, marker: "3.5", latex: "\\tau_m\\ge0{,}098(80-1{,}2\\phi)" },
    { number: "11.3.6", unit: "11.3.2.10.4", page: 329, marker: "3.6", latex: "\\tau_r\\ge0{,}098(130-1{,}9\\phi)" },
    { number: "11.7.1", unit: "11.7.1.1", page: 350, marker: "7.1", latex: "k_h=\\min\\left\\{\\left(\\frac{150}{h}\\right)^{0{,}2},1{,}3\\right\\}" },
    { number: "11.7.2", unit: "11.7.1.1", page: 350, marker: "7.2", latex: "k_h=\\min\\left\\{\\left(\\frac{600}{h}\\right)^{0{,}1},1{,}1\\right\\}" },
    { number: "11.9.1", unit: "11.9.4", page: 360, marker: "9.1", latex: "\\xi_e<15\\%" },
    { number: "11.9.2", unit: "11.9.4", page: 360, marker: "9.2", latex: "\\left|K_e-K_{in}\\right|/K_{in}<20\\%" },
    { number: "11.9.3", unit: "11.9.4", page: 360, marker: "9.3", latex: "\\left|K_{e,(i)}-K_{e,(3)}\\right|/K_{e,(3)}\\le10\\%" },
    { number: "11.9.4", unit: "11.9.4", page: 360, marker: "9.4", latex: "\\left|\\xi_{e,(i)}-\\xi_{e,(3)}\\right|/\\xi_{e,(3)}\\le10\\%" },
    { number: "11.9.5", unit: "11.9.5", page: 361, marker: "9.5", latex: "\\left|K_{2,(i)}-K_{2,(3)}\\right|/K_{2,(3)}\\le10\\%" },
    { number: "11.9.6", unit: "11.9.5", page: 361, marker: "9.6", latex: "\\left|\\xi_{e,(i)}-\\xi_{e,(3)}\\right|/\\xi_{e,(3)}\\le10\\%" },
    { number: "11.9.7", unit: "11.9.6", page: 362, marker: "9.7", latex: "\\left|E_{d,(i)}-E_{d,(3)}\\right|/E_{d,(3)}\\le10\\%" },
    { number: "11.9.8", unit: "11.9.6", page: 362, marker: "9.8", latex: "\\gamma_v=(1+t_d)\\,(1{,}5)^\\alpha" },
    { number: "11.9.9", unit: "11.9.8", page: 363, marker: "9.9", latex: "\\left|f_{(i)}-f_{(3)}\\right|/f_{(3)}\\le0{,}25" },
    { number: "11.10.1", unit: "11.10.1.1.1", page: 365, marker: "10.1", latex: "\\frac{f_1+\\cdots+f_n}{n}\\ge f_{bm}" },
    { number: "11.10.2", unit: "11.10.1.1.1", page: 365, marker: "10.2", latex: "f_1\\ge0{,}80f_{bm}" },
    { number: "11.10.3", unit: "11.10.3.1.2", page: 368, marker: "10.3", latex: "f_{bk}=0{,}75f_{bm}" },
    { number: "11.10.4", unit: "11.10.3.3", page: 369, marker: "10.4", latex: "f_{vk}=f_{vk0}+0{,}4\\sigma_n" },
    { number: "11.10.5", unit: "11.10.3.3", page: 369, marker: "10.5", latex: "f_{vk}\\le f_{vk,\\lim}" },
    { number: "11.10.6", unit: "11.10.3.3", page: 369, marker: "10.6", latex: "f_{vk,\\lim}=0{,}065f_b" },
    { number: "11.10.7", unit: "11.10.3.3", page: 369, marker: "10.7", latex: "f_{vk,\\lim}=0{,}10f_b" },
    { number: "11.10.8", unit: "11.10.3.4", page: 369, marker: "10.8", latex: "E=1000f_k" },
    { number: "11.10.9", unit: "11.10.3.4", page: 369, marker: "10.9", latex: "G=0{,}4E" },
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
for (const definition of formulas) {
    const unit = units.get(definition.unit);
    if (unit === undefined) throw new Error(`Unità mancante per formula ${definition.number}`);
    const marker = formulaMarkerPattern(definition.marker);
    const index = unit.blocks.findIndex((block: any) => block.kind !== "heading" && block.evidence.pdfPage === definition.page && marker.test(blockText(block)));
    if (index < 0) throw new Error(`Formula ${definition.number} non trovata nella unità ${definition.unit}`);
    const sourceBlock = unit.blocks[index];
    const id = assetId("formula", definition.number);
    if (!unit.assets.formulaIds.includes(id)) unit.assets.formulaIds.push(id);
    const ref = { blockId: sourceBlock.blockId, kind: "formula-ref", origin: "official", assetId: id, evidence: refEvidence(sourceBlock) };
    if (blockText(sourceBlock).length <= 120 || /^h \[|^,lim /u.test(blockText(sourceBlock))) {
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
    tableManifest.push({
        id,
        unitId: unit.id,
        officialNumber: definition.number,
        pdfPage: definition.page,
        caption: clean(blockText(sourceBlock)),
        columnCount: 1,
        headers: [],
        rows: tableRows(unit, index),
        notes: [
            "Dati acquisiti dai blocchi evidence della pagina ufficiale.",
            "[TABELLA_DA_VERIFICARE] Struttura delle colonne, celle unite, simboli e valori richiede verifica manuale cella per cella prima della pubblicazione.",
        ],
    });
    appendIssue(unit, `table-${definition.number.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-review`, "Tabella acquisita dall’evidence; la trascrizione strutturata deve ancora essere verificata cella per cella sul render ufficiale.");
}

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
    if (unit.assets.formulaIds.length > 0 || unit.assets.tableIds.length > 0 || unit.assets.figureIds.length > 0) {
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
