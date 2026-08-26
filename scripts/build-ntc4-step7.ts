import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitsRoot = root + "/corpus/units/ntc2018";
const manifest41Path = root + "/corpus/assets/ntc2018/4.1.json";
const manifest42Step4aPath = root + "/corpus/assets/ntc2018/4.2-step4a.json";
const profile = "ntc4-step7-editorial-profile-0.1.0";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Segment = { kind: "text"; value: string } | { kind: "math"; value: string; latex: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type Block = {
    blockId: string;
    kind: string;
    origin: string;
    assetId?: string;
    text?: { raw: string; normalized: string; normalizationVersion: string; inline?: Segment[] };
    evidence: { normalizedSha256: string; transformations?: Transformation[]; [key: string]: unknown };
    [key: string]: unknown;
};
type Unit = {
    blocks: Block[];
    assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] };
    [key: string]: unknown;
};
type EvidenceItem = { sequence: number; text: string; hasEol: boolean; region: Region };
type PageEvidence = { textItems: EvidenceItem[] };

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const uid = (number: string) => "urn:structural-codes:it:unit:ntc2018:" + number;
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const text = (value: string): Segment => ({ kind: "text", value });
const math = (value: string, latex = value): Segment => ({ kind: "math", value, latex });
const region = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });

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
        { operation: "manual-correction", ruleVersion: profile, note: "Ripristinata la segmentazione matematica confrontando direttamente il render della fonte ufficiale." },
    ];
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
    return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
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

async function textBlock(number: string, suffix: string, page: number, target: Region, value: string): Promise<Block> {
    const raw = await rawFor(page, target);
    return {
        blockId: uid(number) + "#block-" + suffix,
        kind: "paragraph",
        origin: "official",
        text: { raw, normalized: value, normalizationVersion: profile },
        evidence: {
            sourceId: "gu-so8-2018-ntc",
            pdfPage: page,
            printedPage: String(page - 4),
            region: target,
            extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
            transformations: raw === value ? [] : [
                { operation: "manual-correction", ruleVersion: profile, note: "Separata l’etichetta testuale dal gruppo di formule verificato sul render ufficiale." },
                { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
            ],
            rawSha256: sha256(raw),
            normalizedSha256: sha256(value),
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
            transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Formula trascritta e collocata confrontando direttamente il render della fonte ufficiale." }],
            rawSha256: sha256(raw),
            normalizedSha256: sha256(assetId),
        },
    };
}

const f41150 = formulaId("4.1.50:4.1.11.1");
const fShear = formulaId("4.1.11.1:shear");
const fShearStrength = formulaId("4.1.11.1:shear-strength");
const fShearParameters = formulaId("4.1.11.1:shear-parameters");
const fTensileStrength = formulaId("4.1.11.1:tensile-strength");
const f41250 = formulaId("4.1.50:4.1.12.1");

const formulas41 = [
    { id: f41150, unitId: uid("4.1.11.1"), officialNumber: "4.1.50", pdfPage: 94, latex: "N_{Ed}\\le N_{Rd}=f_{cd}b x" },
    { id: fShear, unitId: uid("4.1.11.1"), officialNumber: null, pdfPage: 95, latex: "V_{Ed}\\le V_{Rd}=f_{cvd}b x/1{,}5" },
    { id: fShearStrength, unitId: uid("4.1.11.1"), officialNumber: null, pdfPage: 95, latex: "\\begin{aligned}f_{cvd}&=\\sqrt{f_{ct1d}^{2}+\\sigma_c f_{ct1d}}&&\\text{per }\\sigma_c\\le\\sigma_{clim}\\\\f_{cvd}&=\\sqrt{f_{ct1d}^{2}+\\sigma_c f_{ct1d}-\\delta^{2}/4}&&\\text{per }\\sigma_c>\\sigma_{clim}\\end{aligned}" },
    { id: fShearParameters, unitId: uid("4.1.11.1"), officialNumber: null, pdfPage: 95, latex: "\\begin{aligned}\\sigma_c&=N_{Ed}/(b x)\\\\\\delta&=\\sigma_c-\\sigma_{clim}\\\\\\sigma_{clim}&=f_{cd}-2\\sqrt{f_{ct1d}^{2}+f_{cd}f_{ct1d}}\\end{aligned}" },
    { id: fTensileStrength, unitId: uid("4.1.11.1"), officialNumber: null, pdfPage: 95, latex: "f_{ct1d}=0{,}85f_{ctd}" },
    { id: f41250, unitId: uid("4.1.12.1"), officialNumber: "4.1.50", pdfPage: 95, latex: "f_{lctd}=0{,}85f_{lctk}/\\gamma_c" },
];

async function rebuildManifests(): Promise<void> {
    const manifest41 = JSON.parse(await readFile(manifest41Path, "utf8"));
    const replacement41 = new Map(formulas41.map((formula) => [formula.id, formula]));
    manifest41.formulas = manifest41.formulas.filter((formula: { id: string }) => !replacement41.has(formula.id));
    const insertAt = manifest41.formulas.findIndex((formula: { pdfPage: number }) => formula.pdfPage > 94);
    manifest41.formulas.splice(insertAt < 0 ? manifest41.formulas.length : insertAt, 0, ...formulas41);
    await writeFile(manifest41Path, JSON.stringify(manifest41, null, 2) + "\n", "utf8");

    const manifest42 = JSON.parse(await readFile(manifest42Step4aPath, "utf8"));
    const exact42 = new Map([
        [formulaId("4.2.3"), "R_d=\\frac{R_k}{\\gamma_M}"],
        [formulaId("4.2.4"), "\\sigma_{x,Ed}^2+\\sigma_{z,Ed}^2-\\sigma_{x,Ed}\\sigma_{z,Ed}+3\\tau_{Ed}^2\\le\\left(\\frac{f_{yk}}{\\gamma_{M0}}\\right)^2"],
    ]);
    for (const formula of manifest42.formulas as Array<{ id: string; latex: string }>) {
        const latex = exact42.get(formula.id);
        if (latex !== undefined) formula.latex = latex;
    }
    await writeFile(manifest42Step4aPath, JSON.stringify(manifest42, null, 2) + "\n", "utf8");
}

async function rebuildShearFlow(): Promise<void> {
    const number = "4.1.11.1";
    const unit = await readUnit(number);
    unit.blocks = [
        findBlock(unit, number, "heading"),
        findBlock(unit, number, "editorial-001"),
        findBlock(unit, number, "editorial-002"),
        findBlock(unit, number, "editorial-003"),
        findBlock(unit, number, "editorial-004"),
        await assetRef(number, "editorial-005", fShear, 95, region(250, 116, 100, 15)),
        await textBlock(number, "editorial-005a", 95, region(82, 127, 25, 12), "con"),
        await assetRef(number, "editorial-005b", fShearStrength, 95, region(82, 137, 135, 24)),
        await textBlock(number, "editorial-005c", 95, region(82, 157, 28, 12), "dove"),
        await assetRef(number, "editorial-005d", fShearParameters, 95, region(82, 167, 105, 34)),
        await textBlock(number, "editorial-005e", 95, region(82, 197, 28, 12), "dove"),
        await assetRef(number, "editorial-005f", fTensileStrength, 95, region(270, 207, 70, 15)),
        findBlock(unit, number, "editorial-006"),
    ];
    unit.assets.formulaIds = [f41150, fShear, fShearStrength, fShearParameters, fTensileStrength];
    await writeUnit(number, unit);
}

async function patchUnit(number: string, patches: Record<string, string | Segment[]>): Promise<void> {
    const unit = await readUnit(number);
    for (const [suffix, value] of Object.entries(patches)) updateText(findBlock(unit, number, suffix), value);
    await writeUnit(number, unit);
}

async function fixInlineMath(): Promise<void> {
    await patchUnit("4.1.9.1", {
        "editorial-002": "Nel caso di blocchi non collaboranti la resistenza allo stato limite ultimo è affidata al calcestruzzo ed alle armature ordinarie e/o di precompressione. Nel caso di blocchi collaboranti questi partecipano alla resistenza in modo solidale con gli altri materiali.",
    });
    await patchUnit("4.1.10", {
        "editorial-002": "Rientrano nel campo di applicazione delle presenti norme i componenti prodotti in stabilimenti permanenti o in impianti temporanei allestiti per uno specifico cantiere, oppure realizzati a piè d’opera.",
    });
    await patchUnit("4.1.10.1", {
        "editorial-001": "Per gli elementi strutturali prefabbricati qui disciplinati, quando non soggetti a Dichiarazione di Prestazione e conseguente Marcatura CE secondo una specifica tecnica armonizzata elaborata ai sensi del Regolamento UE 305/2011 e i cui riferimenti sono pubblicati sulla Gazzetta Ufficiale dell’Unione Europea, sono previste due categorie di produzione:",
        "editorial-003": "serie controllata I componenti per i quali non sia applicabile la marcatura CE, ai sensi del Regolamento UE 305/2011, devono essere realizzati attraverso processi sottoposti ad un sistema di controllo della produzione ed i produttori di componenti in serie dichiarata ed in serie controllata, devono altresì provvedere alla preventiva qualificazione del sistema di produzione, con le modalità indicate nel § 11.8.",
    });
    await patchUnit("4.1.10.2.2", {
        "editorial-004": [text("i componenti realizzati con l’impiego di calcestruzzi speciali o di classe "), math("> C 45/55", ">\\mathrm{C}\\,45/55"), text(";")],
    });
    await patchUnit("4.1.10.3", {
        "editorial-001": "Il Progettista e il Direttore tecnico dello stabilimento di prefabbricazione, ciascuno per le proprie competenze, sono responsabili della capacità portante e della sicurezza del componente, sia incorporato nell’opera, sia durante le fasi di trasporto fino a piè d’opera.",
    });
    await patchUnit("4.1.10.5.1", {
        "editorial-001": "Per i componenti appoggiati in via definitiva, particolare attenzione va posta alla posizione e dimensione dell’apparecchio d’appoggio, sia rispetto alla geometria dell’elemento di sostegno, sia rispetto alla sezione terminale dell’elemento portato, tenendo nel dovuto conto le tolleranze dimensionali e di montaggio e le deformazioni per fenomeni reologici e/o termici.",
    });

    await patchUnit("4.1.11.1", {
        "editorial-001": [text("Per le verifiche di resistenza delle sezioni sotto sforzi normali si adottano le competenti ipotesi tratte dal § 4.1.2.3.4.1. Per una sezione rettangolare di lati "), math("a"), text(" e "), math("b"), text(" soggetta ad una forza normale "), math("NEd", "N_{Ed}"), text(" con una eccentricità "), math("e"), text(" nella direzione del lato "), math("a"), text(" la verifica di resistenza allo SLU, con il modello ("), math("c"), text(") di § 4.1.2.1.2.1, si pone con")],
        "editorial-003": [text("con "), math("x = a − 2e", "x=a-2e"), text(".")],
        "editorial-004": [text("La verifica di resistenza della stessa sezione rettangolare di lati "), math("a"), text(" e "), math("b"), text(" soggetta anche ad un sforzo di taglio "), math("VEd", "V_{Ed}"), text(" nella direzione del lato "), math("a"), text(" si pone con")],
    });

    await patchUnit("4.1.12", {
        "editorial-003": "Sulla base della denominazione normalizzata come definita in § 4.1 per il calcestruzzo di peso normale, vengono ammesse classi di resistenza fino alla classe LC55/60.",
    });
    await patchUnit("4.1.12.1", {
        "editorial-003": [text("Non possono impiegarsi barre di diametro maggiore di "), math("32 mm", "32\\,\\mathrm{mm}"), text(". Per ogni indicazione applicativa si potrà fare utile riferimento alla sezione 11 di UNI EN 1992-1-1:2005.")],
    });

    await patchUnit("4.2.4.1.1", {
        "editorial-003": [math("Rk", "R_k"), text(" è il valore caratteristico della resistenza (trazione, compressione, flessione, taglio e torsione) della membratura, determinata dai valori caratteristici delle resistenze dei materiali "), math("fyk", "f_{yk}"), text(" e dalle caratteristiche geometriche degli elementi strutturali, dipendenti dalla classe della sezione.")],
        "editorial-005": [text("Nel caso in cui si abbiamo elementi con sezioni di classe 4 può farsi riferimento alle caratteristiche geometriche “efficaci”, area efficace "), math("Aeff", "A_{eff}"), text(", modulo di resistenza efficace "), math("Weff", "W_{eff}"), text(", modulo di inerzia efficace "), math("Jeff", "J_{eff}"), text(", valutati seguendo il procedimento indicato in UNI EN 1993-1-5. Nel caso di elementi strutturali formati a freddo e lamiere sottili, per valutare le caratteristiche “efficaci” si può fare riferimento a quanto indicato in UNI EN1993-1-3. In alternativa al metodo delle caratteristiche geometriche efficaci si potrà utilizzare il metodo delle tensioni ridotte, indicato in UNI EN 1993-1-5.")],
        "editorial-006": [text("Per le verifiche di resistenza delle sezioni delle membrature, con riferimento ai modelli di resistenza esposti nella presente normativa ed utilizzando acciai dal grado S 235 al grado S 460 di cui al § 11.3, si adottano i fattori parziali "), math("γM0", "\\gamma_{M0}"), text(" e "), math("γM2", "\\gamma_{M2}"), text(" indicati nella Tab. 4.2.VII. Il coefficiente di sicurezza "), math("γM2", "\\gamma_{M2}"), text(", in particolare, deve essere impiegato qualora si eseguano verifiche di elementi tesi nelle zone di unione delle membrature indebolite dai fori.")],
        "editorial-007": [text("Per valutare la stabilità degli elementi strutturali compressi, inflessi e presso-inflessi, si utilizza il coefficiente parziale di sicurezza "), math("γM1", "\\gamma_{M1}"), text(" indicato nella seguente tabella.")],
    });
}

await rebuildManifests();
await rebuildShearFlow();
await fixInlineMath();
console.log("ntc4-step7: rebuilt formulas and inline math for PDF pages 92-101");
