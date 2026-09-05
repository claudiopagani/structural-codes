import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitsRoot = repoRoot + "/corpus/units/ntc2018";
const tableManifestPath = repoRoot + "/corpus/assets/ntc2018/core-tables.json";
const profile = "core-editorial-profile-0.1.1";

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type InlineSegment =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type UnitBlock = {
    blockId: string;
    kind: string;
    listMarker?: "dash" | "none";
    assetId?: string;
    text?: {
        raw: string;
        normalized: string;
        normalizationVersion: string;
        inline?: InlineSegment[];
    };
    evidence: {
        normalizedSha256: string;
        transformations?: Transformation[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
};
type CanonicalUnit = {
    blocks: UnitBlock[];
    assets: {
        formulaIds: string[];
        tableIds: string[];
        figureIds: string[];
    };
    [key: string]: unknown;
};
type EvidenceItem = {
    sequence: number;
    text: string;
    hasEol: boolean;
    region: Region;
};
type PageEvidence = { textItems: EvidenceItem[] };
type Cell = {
    text: string;
    latex?: string;
    inline?: InlineSegment[];
    colSpan?: number;
    rowSpan?: number;
    align?: "left" | "center" | "right";
};

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});
const text = (value: string): InlineSegment => ({ kind: "text", value });
const math = (value: string, latex = value): InlineSegment => ({ kind: "math", value, latex });
const cell = (value: string, options: Omit<Cell, "text" | "latex" | "inline"> = {}): Cell => ({ text: value, ...options });
const mathCell = (value: string, latex: string, options: Omit<Cell, "text" | "latex" | "inline"> = {}): Cell => ({ text: value, latex, ...options });
const inlineCell = (value: string, inline: InlineSegment[], options: Omit<Cell, "text" | "latex" | "inline"> = {}): Cell => ({ text: value, inline, ...options });
const uid = (unit: string): string => "urn:structural-codes:it:unit:ntc2018:" + unit;
const formulaId = (number: string): string => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const tableId = (number: string): string => "urn:structural-codes:it:asset:table:ntc2018:" + number.toLowerCase();

const pageCache = new Map<number, PageEvidence>();
async function pageEvidence(page: number): Promise<PageEvidence> {
    const cached = pageCache.get(page);
    if (cached) return cached;
    const path = repoRoot + "/evidence/gu-so8-2018-ntc/pages/page-" + String(page).padStart(4, "0") + ".json";
    const parsed = JSON.parse(await readFile(path, "utf8")) as PageEvidence;
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

function transformations(note: string): Transformation[] {
    return [
        {
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Rimosse le andate a capo di impaginazione senza creare nuovi capoversi.",
        },
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note,
        },
        {
            operation: "normalize-whitespace",
            ruleVersion: profile,
            note: "Uniformati gli spazi dopo la separazione di prosa, formule e tabelle.",
        },
        {
            operation: "unicode-nfc",
            ruleVersion: profile,
            note: "Testo normalizzato in Unicode NFC.",
        },
    ];
}

async function textBlock(
    unit: string,
    suffix: string,
    kind: "heading" | "paragraph" | "list-item",
    page: number,
    target: Region,
    value: string | InlineSegment[],
    listMarker?: "dash" | "none",
): Promise<UnitBlock> {
    const inline = typeof value === "string" ? undefined : value;
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    const raw = await rawFor(page, target);
    return {
        blockId: uid(unit) + "#block-" + suffix,
        kind,
        origin: "official",
        ...(listMarker ? { listMarker } : {}),
        text: {
            raw,
            normalized,
            normalizationVersion: profile,
            ...(inline ? { inline } : {}),
        },
        evidence: {
            sourceId: "gu-so8-2018-ntc",
            pdfPage: page,
            printedPage: String(page - 4),
            region: target,
            extraction: {
                method: "pdf-text",
                tool: "pdfjs-dist",
                toolVersion: "4.10.38",
            },
            transformations: raw === normalized
                ? []
                : transformations("Separati i blocchi editoriali e ripristinati pedici, apici, operatori e punteggiatura verificati sul render ufficiale."),
            rawSha256: sha256(raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

async function assetRef(
    unit: string,
    suffix: string,
    kind: "formula-ref" | "table-ref",
    assetId: string,
    page: number,
    target: Region,
): Promise<UnitBlock> {
    const raw = await rawFor(page, target);
    return {
        blockId: uid(unit) + "#block-" + suffix,
        kind,
        origin: "official",
        assetId,
        evidence: {
            sourceId: "gu-so8-2018-ntc",
            pdfPage: page,
            printedPage: String(page - 4),
            region: target,
            extraction: {
                method: "manual-transcription",
                tool: "codex-reviewed-source-transcription",
                toolVersion: profile,
            },
            transformations: [{
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Asset trascritto e collocato confrontando direttamente il render della fonte ufficiale.",
            }],
            rawSha256: sha256(raw),
            normalizedSha256: sha256(assetId),
        },
    };
}

async function readUnit(unit: string): Promise<CanonicalUnit> {
    return JSON.parse(await readFile(unitsRoot + "/" + unit + ".json", "utf8")) as CanonicalUnit;
}

async function writeUnit(unit: string, record: CanonicalUnit): Promise<void> {
    await writeFile(unitsRoot + "/" + unit + ".json", JSON.stringify(record, null, 2) + "\n", "utf8");
}

function block(unit: CanonicalUnit, number: string, suffix: string): UnitBlock {
    const id = uid(number) + "#block-" + suffix;
    const found = unit.blocks.find((candidate) => candidate.blockId === id);
    if (!found) throw new Error("Blocco mancante: " + id);
    return found;
}

function asset(unit: CanonicalUnit, assetId: string): UnitBlock {
    const found = unit.blocks.find((candidate) => candidate.assetId === assetId);
    if (!found) throw new Error("Riferimento asset mancante: " + assetId);
    return found;
}

function updateText(target: UnitBlock, value: string | InlineSegment[]): void {
    if (!target.text) throw new Error("Payload testuale mancante: " + target.blockId);
    const inline = typeof value === "string" ? undefined : value;
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    target.text.normalized = normalized;
    target.text.normalizationVersion = profile;
    if (inline) target.text.inline = inline;
    else delete target.text.inline;
    target.evidence.normalizedSha256 = sha256(normalized);
    target.evidence.transformations = [
        ...(target.evidence.transformations ?? []).filter((entry) => entry.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinata la segmentazione matematica confrontando direttamente il render ufficiale.",
        },
    ];
}

async function rebuildUnit3242(): Promise<void> {
    const number = "3.2.4.2";
    const unit = await readUnit(number);
    unit.blocks = [
        block(unit, number, "heading"),
        await textBlock(number, "editorial-001", "paragraph", 55, region(73, 415, 449, 14), [
            text("Il valore dello spostamento assoluto orizzontale massimo del suolo ("),
            math("dg", "d_g"),
            text(") può ottenersi utilizzando l’espressione [3.2.12]."),
        ]),
        await textBlock(number, "editorial-002", "paragraph", 55, region(73, 429, 449, 35), [
            text("Nel caso in cui sia necessario valutare gli effetti della variabilità spaziale del moto richiamati nel paragrafo precedente, il valore dello spostamento relativo tra due punti "),
            math("i"),
            text(" e "),
            math("j"),
            text(" caratterizzati dalle proprietà stratigrafiche del rispettivo sottosuolo ed il cui moto possa considerarsi indipendente, può essere stimato secondo l’espressione seguente:"),
        ]),
        await assetRef(number, "editorial-003", "formula-ref", formulaId("3.2.13"), 55, region(180, 458, 190, 20)),
        await textBlock(number, "editorial-004", "paragraph", 55, region(73, 478, 449, 22), [
            text("dove "),
            math("dgi", "d_{gi}"),
            text(" e "),
            math("dgj", "d_{gj}"),
            text(" sono rispettivamente gli spostamenti massimi del suolo nei punti "),
            math("i"),
            text(" e "),
            math("j"),
            text(", calcolati con riferimento alle caratteristiche locali del sottosuolo."),
        ]),
        await textBlock(number, "editorial-005", "paragraph", 55, region(73, 503, 449, 22), "Il moto di due punti del terreno può considerarsi indipendente per punti posti a distanze notevoli, in relazione al tipo di sottosuolo; il moto è reso indipendente anche dalla presenza di forti variabilità orografiche tra i punti."),
        await textBlock(number, "editorial-006", "paragraph", 55, region(73, 527, 449, 18), [
            text("In assenza di forti discontinuità orografiche, lo spostamento relativo tra punti a distanza "),
            math("x"),
            text(" (in "),
            math("m", "\\mathrm{m}"),
            text(") si può valutare con l’espressione:"),
        ]),
        await assetRef(number, "editorial-007", "formula-ref", formulaId("3.2.14"), 55, region(145, 544, 225, 25)),
        await textBlock(number, "editorial-008", "paragraph", 55, region(73, 568, 449, 17), [
            text("dove "),
            math("vs", "v_s"),
            text(" è la velocità di propagazione delle onde di taglio in "),
            math("m/s", "\\mathrm{m/s}"),
            text(" e "),
            math("dij0", "d_{ij0}"),
            text(" è dato dall’espressione"),
        ]),
        await assetRef(number, "editorial-009", "formula-ref", formulaId("3.2.15"), 55, region(180, 581, 190, 20)),
        await textBlock(number, "editorial-010", "paragraph", 55, region(73, 600, 449, 25), [
            text("Per punti che ricadano su sottosuoli differenti a distanza inferiore a "),
            math("20 m", "20\\,\\mathrm{m}"),
            text(", lo spostamento relativo è rappresentato da "),
            math("dij0", "d_{ij0}"),
            text("; se i punti ricadono su sottosuolo dello stesso tipo, lo spostamento relativo può essere stimato, anziché con l’espressione [3.2.14], con le espressioni"),
        ]),
        await assetRef(number, "editorial-011", "formula-ref", formulaId("3.2.16"), 55, region(100, 630, 270, 48)),
        await textBlock(number, "editorial-012", "paragraph", 55, region(73, 682, 449, 23), "Per la determinazione delle sollecitazioni indotte nei ponti dagli spostamenti relativi del terreno, si possono utilizzare criteri riportati in documenti di comprovata validità."),
    ];
    unit.assets.formulaIds = ["3.2.13", "3.2.14", "3.2.15", "3.2.16"].map(formulaId);
    await writeUnit(number, unit);
}

async function fixExistingWindUnits(): Promise<void> {
    const unit331 = await readUnit("3.3.1");
    updateText(block(unit331, "3.3.1", "editorial-001"), [
        text("La velocità base di riferimento "),
        math("vb", "v_b"),
        text(" è il valore medio su 10 minuti, a 10 m di altezza sul suolo su un terreno pianeggiante e omogeneo di categoria di esposizione II (vedi Tab. 3.3.II), riferito ad un periodo di ritorno "),
        math("TR = 50 anni", "T_R=50\\,\\text{anni}"),
        text("."),
    ]);
    updateText(block(unit331, "3.3.1", "editorial-002"), [
        text("In mancanza di specifiche ed adeguate indagini statistiche, "),
        math("vb", "v_b"),
        text(" è data dall’espressione:"),
    ]);
    const vb0Definition = await textBlock("3.3.1", "editorial-004", "list-item", 56, region(71.85, 257.5, 451.7, 21.8), [
        math("Vb,0", "V_{b,0}"),
        text(" è la velocità base di riferimento al livello del mare, assegnata nella Tab. 3.3.I in funzione della zona in cui sorge la costruzione (Fig. 3.3.1);"),
    ], "none");
    const caDefinition = await textBlock("3.3.1", "editorial-004-b", "list-item", 56, region(71.85, 279.5, 451.7, 13.2), [
        math("ca", "c_a"),
        text(" è il coefficiente di altitudine fornito dalla relazione:"),
    ], "none");
    const a0Definition = await textBlock("3.3.1", "editorial-007", "list-item", 56, region(71.85, 361.5, 451.7, 11.5), [
        math("a0, ks", "a_0,\\,k_s"),
        text(" sono parametri forniti nella Tab. 3.3.I in funzione della zona in cui sorge la costruzione (Fig. 3.3.1);"),
    ], "none");
    const asDefinition = await textBlock("3.3.1", "editorial-007-b", "list-item", 56, region(71.85, 372.9, 451.7, 11.5), [
        math("as", "a_s"),
        text(" è l’altitudine sul livello del mare del sito ove sorge la costruzione."),
    ], "none");
    updateText(block(unit331, "3.3.1", "editorial-006"), "dove:");
    unit331.blocks = [
        block(unit331, "3.3.1", "heading"),
        block(unit331, "3.3.1", "editorial-001"),
        block(unit331, "3.3.1", "editorial-002"),
        block(unit331, "3.3.1", "editorial-003"),
        vb0Definition,
        caDefinition,
        block(unit331, "3.3.1", "editorial-005"),
        block(unit331, "3.3.1", "editorial-006"),
        a0Definition,
        asDefinition,
        block(unit331, "3.3.1", "editorial-008"),
        block(unit331, "3.3.1", "editorial-009"),
        block(unit331, "3.3.1", "editorial-010"),
        block(unit331, "3.3.1", "editorial-011"),
    ];
    await writeUnit("3.3.1", unit331);

    const unit332 = await readUnit("3.3.2");
    updateText(block(unit332, "3.3.2", "editorial-001"), [
        text("La velocità di riferimento "),
        math("vr", "v_r"),
        text(" è il valore medio su 10 minuti, a 10 m di altezza dal suolo su un terreno pianeggiante e omogeneo di categoria di esposizione II (vedi Tab. 3.3.II), riferito al periodo di ritorno di progetto "),
        math("TR", "T_R"),
        text(". Tale velocità è definita dalla relazione:"),
    ]);
    updateText(block(unit332, "3.3.2", "editorial-003"), "dove");
    const vbDefinition = await textBlock("3.3.2", "editorial-003-a", "list-item", 57, region(70.56, 347.5, 454.3, 12), [
        math("vb", "v_b"),
        text(" è la velocità base di riferimento, di cui al § 3.3.1;"),
    ], "none");
    const crDefinition = await textBlock("3.3.2", "editorial-003-b", "list-item", 57, region(70.56, 360.8, 454.3, 12), [
        math("cr", "c_r"),
        text(" è il coefficiente di ritorno, funzione del periodo di ritorno di progetto "),
        math("TR", "T_R"),
        text("."),
    ], "none");
    updateText(block(unit332, "3.3.2", "editorial-006"), [
        text("dove "),
        math("TR", "T_R"),
        text(" è il periodo di ritorno espresso in anni."),
    ]);
    updateText(block(unit332, "3.3.2", "editorial-007"), [
        text("Ove non specificato diversamente, si assumerà "),
        math("TR = 50 anni", "T_R=50\\,\\text{anni}"),
        text(", cui corrisponde "),
        math("cr = 1", "c_r=1"),
        text(". Per un’opera di nuova realizzazione in fase di costruzione o per le fasi transitorie relative ad interventi sulle costruzioni esistenti, il periodo di ritorno dell’azione potrà essere ridotto come di seguito specificato:"),
    ]);
    updateText(block(unit332, "3.3.2", "editorial-008"), [
        text("per fasi di costruzione o fasi transitorie con durata prevista in sede di progetto non superiore a tre mesi, si assumerà "),
        math("TR ≥ 5 anni", "T_R\\ge5\\,\\text{anni}"),
        text(";"),
    ]);
    updateText(block(unit332, "3.3.2", "editorial-009"), [
        text("per fasi di costruzione o fasi transitorie con durata prevista in sede di progetto compresa fra tre mesi ed un anno, si assumerà "),
        math("TR ≥ 10 anni", "T_R\\ge10\\,\\text{anni}"),
        text(";"),
    ]);
    unit332.blocks = [
        block(unit332, "3.3.2", "heading"),
        block(unit332, "3.3.2", "editorial-001"),
        block(unit332, "3.3.2", "editorial-002"),
        block(unit332, "3.3.2", "editorial-003"),
        vbDefinition,
        crDefinition,
        block(unit332, "3.3.2", "editorial-004"),
        block(unit332, "3.3.2", "editorial-005"),
        block(unit332, "3.3.2", "editorial-006"),
        block(unit332, "3.3.2", "editorial-007"),
        block(unit332, "3.3.2", "editorial-008"),
        block(unit332, "3.3.2", "editorial-009"),
    ];
    await writeUnit("3.3.2", unit332);

    const unit334 = await readUnit("3.3.4");
    updateText(block(unit334, "3.3.4", "editorial-003"), "dove");
    const qrDefinition = await textBlock("3.3.4", "editorial-003-a", "list-item", 58, region(72.74, 148.8, 297.2, 11.5), [
        math("qr", "q_r"), text(" è la pressione cinetica di riferimento di cui al § 3.3.6;"),
    ], "none");
    const ceDefinition = await textBlock("3.3.4", "editorial-003-b", "list-item", 58, region(72.74, 162.1, 297.2, 11.5), [
        math("ce", "c_e"), text(" è il coefficiente di esposizione di cui al § 3.3.7;"),
    ], "none");
    const cpDefinition = await textBlock("3.3.4", "editorial-003-c", "list-item", 58, region(72.74, 175.5, 297.2, 11.5), [
        math("cp", "c_p"), text(" è il coefficiente di pressione di cui al § 3.3.8;"),
    ], "none");
    const cdDefinition = await textBlock("3.3.4", "editorial-003-d", "list-item", 58, region(72.74, 188.8, 297.2, 11.5), [
        math("cd", "c_d"), text(" è il coefficiente dinamico di cui al § 3.3.9."),
    ], "none");
    unit334.blocks = [
        block(unit334, "3.3.4", "heading"),
        block(unit334, "3.3.4", "editorial-001"),
        block(unit334, "3.3.4", "editorial-002"),
        block(unit334, "3.3.4", "editorial-003"),
        qrDefinition,
        ceDefinition,
        cpDefinition,
        cdDefinition,
    ];
    await writeUnit("3.3.4", unit334);

    const unit335 = await readUnit("3.3.5");
    updateText(block(unit335, "3.3.5", "editorial-003"), "dove");
    const qrTangentDefinition = await textBlock("3.3.5", "editorial-003-a", "list-item", 58, region(72.74, 260.2, 339.1, 11.5), [
        math("qr", "q_r"), text(" è la pressione cinetica di riferimento di cui al § 3.3.6;"),
    ], "none");
    const ceTangentDefinition = await textBlock("3.3.5", "editorial-003-b", "list-item", 58, region(72.74, 273.5, 339.1, 11.5), [
        math("ce", "c_e"), text(" è il coefficiente di esposizione di cui al § 3.3.7;"),
    ], "none");
    const cfTangentDefinition = await textBlock("3.3.5", "editorial-003-c", "list-item", 58, region(72.74, 286.8, 339.1, 11.5), [
        math("cf", "c_f"), text(" è il coefficiente d’attrito di cui al § 3.3.8."),
    ], "none");
    unit335.blocks = [
        block(unit335, "3.3.5", "heading"),
        block(unit335, "3.3.5", "editorial-001"),
        block(unit335, "3.3.5", "editorial-002"),
        block(unit335, "3.3.5", "editorial-003"),
        qrTangentDefinition,
        ceTangentDefinition,
        cfTangentDefinition,
    ];
    await writeUnit("3.3.5", unit335);

    const unit336 = await readUnit("3.3.6");
    updateText(block(unit336, "3.3.6", "editorial-001"), [
        text("La pressione cinetica di riferimento "),
        math("qr", "q_r"),
        text(" è data dall’espressione:"),
    ]);
    updateText(block(unit336, "3.3.6", "editorial-003"), "dove");
    const vrDefinition = await textBlock("3.3.6", "editorial-003-a", "list-item", 58, region(72.74, 366.5, 297.1, 11.5), [
        math("vr", "v_r"), text(" è la velocità di riferimento del vento di cui al § 3.3.2;"),
    ], "none");
    const rhoDefinition = await textBlock("3.3.6", "editorial-003-b", "list-item", 58, region(72.74, 379.7, 297.1, 11.5), [
        math("ρ", "\\rho"), text(" è la densità dell’aria assunta convenzionalmente costante e pari a "),
        math("1,25 kg/m³", "1{,}25\\,\\mathrm{kg/m^3}"), text("."),
    ], "none");
    updateText(block(unit336, "3.3.6", "editorial-004"), [
        text("Esprimendo "),
        math("ρ", "\\rho"), text(" in "), math("kg/m³", "\\mathrm{kg/m^3}"),
        text(" e "), math("vr", "v_r"), text(" in "), math("m/s", "\\mathrm{m/s}"),
        text(", "), math("qr", "q_r"), text(" risulta espresso in "), math("N/m²", "\\mathrm{N/m^2}"), text("."),
    ]);
    unit336.blocks = [
        block(unit336, "3.3.6", "heading"),
        block(unit336, "3.3.6", "editorial-001"),
        block(unit336, "3.3.6", "editorial-002"),
        block(unit336, "3.3.6", "editorial-003"),
        vrDefinition,
        rhoDefinition,
        block(unit336, "3.3.6", "editorial-004"),
    ];
    await writeUnit("3.3.6", unit336);
}

async function rebuildUnit337(): Promise<void> {
    const number = "3.3.7";
    const unit = await readUnit(number);
    updateText(block(unit, number, "editorial-001"), [
        text("Il coefficiente di esposizione "),
        math("ce", "c_e"),
        text(" dipende dall’altezza "),
        math("z"),
        text(" sul suolo del punto considerato, dalla topografia del terreno e dalla categoria di esposizione del sito ove sorge la costruzione. In assenza di analisi specifiche che tengano in conto la direzione di provenienza del vento e l’effettiva scabrezza e topografia del terreno che circonda la costruzione, per altezze sul suolo non maggiori di "),
        math("z = 200 m", "z=200\\,\\mathrm{m}"),
        text(", esso è dato dalla formula:"),
    ]);
    updateText(block(unit, number, "editorial-003"), "dove");
    const roughnessParameters = await textBlock(number, "editorial-003-a", "list-item", 58, region(72.74, 517.5, 450.7, 11.5), [
        math("kr, z0, zmin", "k_r,\\,z_0,\\,z_{min}"),
        text(" sono assegnati in Tab. 3.3.II in funzione della categoria di esposizione del sito ove sorge la costruzione;"),
    ], "none");
    const topographyCoefficient = await textBlock(number, "editorial-003-b", "list-item", 58, region(72.74, 531.7, 450.7, 11.5), [
        math("ct", "c_t"), text(" è il coefficiente di topografia."),
    ], "none");
    updateText(block(unit, number, "editorial-005"), [
        text("La categoria di esposizione è assegnata nella Fig. 3.3.2 in funzione della posizione geografica del sito ove sorge la costruzione e della classe di rugosità del terreno definita in Tab. 3.3.III. Nelle fasce entro "),
        math("40 km", "40\\,\\mathrm{km}"),
        text(" dalla costa, la categoria di esposizione è indipendente dall’altitudine del sito."),
    ]);
    updateText(block(unit, number, "editorial-006"), [
        text("Il coefficiente di topografia "),
        math("ct", "c_t"),
        text(" è posto generalmente pari a 1, sia per le zone pianeggianti sia per quelle ondulate, collinose e montane. In questo caso, la Fig. 3.3.3 riporta le leggi di variazione di "),
        math("ce", "c_e"),
        text(" per le diverse categorie di esposizione."),
    ]);
    updateText(block(unit, number, "editorial-007"), [
        text("Nel caso di costruzioni ubicate presso la sommità di colline o pendii isolati, il coefficiente di topografia "),
        math("ct", "c_t"),
        text(" può essere ricavato da dati suffragati da opportuna documentazione."),
    ]);
    const table = await assetRef(number, "editorial-008", "table-ref", tableId("3.3.III"), 59, region(65, 97, 310, 158));
    unit.blocks = [
        block(unit, number, "heading"),
        block(unit, number, "editorial-001"),
        block(unit, number, "editorial-002"),
        block(unit, number, "editorial-003"),
        roughnessParameters,
        topographyCoefficient,
        block(unit, number, "editorial-004"),
        block(unit, number, "editorial-005"),
        block(unit, number, "editorial-006"),
        block(unit, number, "editorial-007"),
        table,
        asset(unit, "urn:structural-codes:it:asset:figure:ntc2018:3.3.2"),
        asset(unit, "urn:structural-codes:it:asset:figure:ntc2018:3.3.3"),
    ];
    unit.assets.tableIds = [tableId("3.3.II"), tableId("3.3.III")];
    await writeUnit(number, unit);
}

async function fixUnit338(): Promise<void> {
    const number = "3.3.8";
    const unit = await readUnit(number);
    updateText(block(unit, number, "editorial-001"), [
        text("Il coefficiente di pressione "),
        math("cp", "c_p"),
        text(" dipende dalla tipologia e dalla geometria della costruzione e dal suo orientamento rispetto alla direzione del vento."),
    ]);
    updateText(block(unit, number, "editorial-002"), [
        text("Il coefficiente d’attrito "),
        math("cf", "c_f"),
        text(" dipende dalla scabrezza della superficie sulla quale il vento esercita l’azione tangente."),
    ]);
    await writeUnit(number, unit);
}

async function fixUnit341(): Promise<void> {
    const number = "3.4.1";
    const unit = await readUnit(number);
    const qskDefinition = await textBlock(number, "editorial-004", "list-item", 61, region(75.8, 167.0, 260, 9), [
        math("qsk", "q_{sk}"), text(" è il valore di riferimento del carico della neve al suolo, di cui al § 3.4.2; "),
    ], "none");
    const muiDefinition = await textBlock(number, "editorial-004-b", "list-item", 61, region(75.8, 181.0, 220, 9), [
        math("μi", "\\mu_i"), text(" è il coefficiente di forma della copertura, di cui al § 3.4.3; "),
    ], "none");
    const ceDefinition = await textBlock(number, "editorial-004-c", "list-item", 61, region(75.8, 195.0, 190, 9), [
        math("CE", "C_E"), text(" è il coefficiente di esposizione di cui al § 3.4.4; "),
    ], "none");
    const ctDefinition = await textBlock(number, "editorial-004-d", "list-item", 61, region(75.8, 209.0, 170, 9), [
        math("Ct", "C_t"), text(" è il coefficiente termico di cui al § 3.4.5."),
    ], "none");
    unit.blocks = [
        block(unit, number, "heading"),
        block(unit, number, "editorial-001"),
        block(unit, number, "editorial-002"),
        block(unit, number, "editorial-003"),
        qskDefinition,
        muiDefinition,
        ceDefinition,
        ctDefinition,
        block(unit, number, "editorial-005"),
    ];
    await writeUnit(number, unit);
}

async function rebuildUnit342(): Promise<void> {
    const number = "3.4.2";
    const unit = await readUnit(number);
    updateText(block(unit, number, "editorial-002"), [
        text("In mancanza di adeguate indagini statistiche e specifici studi locali, che tengano conto sia dell’altezza del manto nevoso che della sua densità, il carico di riferimento della neve al suolo, per località poste a quota inferiore a "),
        math("1500 m", "1500\\,\\mathrm{m}"),
        text(" sul livello del mare, non dovrà essere assunto minore di quello calcolato in base alle espressioni riportate nel seguito, cui corrispondono valori associati ad un periodo di ritorno pari a "),
        math("50 anni", "50\\,\\text{anni}"),
        text(" per le varie zone indicate nella Fig. 3.4.1. Tale zonazione non tiene conto di aspetti specifici e locali che, se necessario, devono essere definiti singolarmente."),
    ]);
    unit.blocks = [
        block(unit, number, "heading"),
        block(unit, number, "editorial-001"),
        block(unit, number, "editorial-002"),
        asset(unit, "urn:structural-codes:it:asset:figure:ntc2018:3.4.1"),
        await textBlock(number, "editorial-004", "paragraph", 62, region(76, 95, 444, 24), [
            text("Nelle espressioni seguenti, l’altitudine di riferimento "),
            math("as", "a_s"),
            text(" (espressa in "),
            math("m", "\\mathrm{m}"),
            text(") è la quota del suolo sul livello del mare nel sito dove è realizzata la costruzione."),
        ]),
        await textBlock(number, "editorial-005", "heading", 62, region(76, 120, 100, 11), "Zona I - Alpina"),
        await textBlock(number, "editorial-006", "paragraph", 62, region(76, 130, 444, 23), "Aosta, Belluno, Bergamo, Biella, Bolzano, Brescia, Como, Cuneo, Lecco, Pordenone, Sondrio, Torino, Trento, Udine, Verbano-Cusio-Ossola, Vercelli, Vicenza:"),
        await assetRef(number, "editorial-007", "formula-ref", formulaId("3.4.2"), 62, region(100, 151, 270, 45)),
        await textBlock(number, "editorial-008", "heading", 62, region(76, 207, 110, 11), "Zona I - Mediterranea"),
        await textBlock(number, "editorial-009", "paragraph", 62, region(76, 218, 444, 23), "Alessandria, Ancona, Asti, Bologna, Cremona, Forlì-Cesena, Lodi, Milano, Modena, Monza Brianza, Novara, Parma, Pavia, Pesaro e Urbino, Piacenza, Ravenna, Reggio Emilia, Rimini, Treviso, Varese:"),
        await assetRef(number, "editorial-010", "formula-ref", formulaId("3.4.3"), 62, region(100, 238, 270, 43)),
        await textBlock(number, "editorial-011", "heading", 62, region(76, 284, 70, 11), "Zona II"),
        await textBlock(number, "editorial-012", "paragraph", 62, region(76, 294, 444, 31), "Arezzo, Ascoli Piceno, Avellino, Bari, Barletta-Andria-Trani, Benevento, Campobasso, Chieti, Fermo, Ferrara, Firenze, Foggia, Frosinone, Genova, Gorizia, Imperia, Isernia, L’Aquila, La Spezia, Lucca, Macerata, Mantova, Massa Carrara, Padova, Perugia, Pescara, Pistoia, Prato, Rieti, Rovigo, Savona, Teramo, Trieste, Venezia, Verona:"),
        await assetRef(number, "editorial-013", "formula-ref", formulaId("3.4.4"), 62, region(100, 327, 271, 43)),
        await textBlock(number, "editorial-014", "heading", 62, region(76, 371, 70, 12), "Zona III"),
        await textBlock(number, "editorial-015", "paragraph", 62, region(76, 384, 444, 31), "Agrigento, Brindisi, Cagliari, Caltanissetta, Carbonia-Iglesias, Caserta, Catania, Catanzaro, Cosenza, Crotone, Enna, Grosseto, Latina, Lecce, Livorno, Matera, Medio Campidano, Messina, Napoli, Nuoro, Ogliastra, Olbia-Tempio, Oristano, Palermo, Pisa, Potenza, Ragusa, Reggio Calabria, Roma, Salerno, Sassari, Siena, Siracusa, Taranto, Terni, Trapani, Vibo Valentia, Viterbo:"),
        await assetRef(number, "editorial-016", "formula-ref", formulaId("3.4.5"), 62, region(100, 416, 270, 44)),
        await textBlock(number, "editorial-017", "paragraph", 62, region(76, 461, 444, 23), [
            text("Per altitudini superiori a "),
            math("1500 m", "1500\\,\\mathrm{m}"),
            text(" sul livello del mare si deve fare riferimento alle condizioni locali di clima e di esposizione utilizzando comunque valori di carico neve non inferiori a quelli previsti per "),
            math("1500 m", "1500\\,\\mathrm{m}"),
            text("."),
        ]),
        await textBlock(number, "editorial-018", "paragraph", 62, region(76, 484, 444, 24), "Per un’opera di nuova realizzazione in fase di costruzione o per le fasi transitorie relative ad interventi sulle costruzioni esistenti, il periodo di ritorno dell’azione può essere ridotto come di seguito specificato:"),
        await textBlock(number, "editorial-019", "list-item", 62, region(91, 510, 430, 23), [
            text("per fasi di costruzione o fasi transitorie con durata prevista in sede di progetto non superiore a tre mesi, si assumerà "),
            math("TR ≥ 5 anni", "T_R\\ge5\\,\\text{anni}"),
            text(";"),
        ]),
        await textBlock(number, "editorial-020", "list-item", 62, region(91, 536, 430, 24), [
            text("per fasi di costruzione o fasi transitorie con durata prevista in sede di progetto compresa fra tre mesi ed un anno, si assumerà "),
            math("TR ≥ 10 anni", "T_R\\ge10\\,\\text{anni}"),
            text("."),
        ]),
    ];
    unit.assets.formulaIds = ["3.4.2", "3.4.3", "3.4.4", "3.4.5"].map(formulaId);
    await writeUnit(number, unit);
}

async function rebuildUnit3431(): Promise<void> {
    const number = "3.4.3.1";
    const unit = await readUnit(number);
    unit.blocks = [
        block(unit, number, "heading"),
        await textBlock(number, "editorial-001", "paragraph", 62, region(76, 622, 444, 23), "I coefficienti di forma delle coperture dipendono dalla forma stessa della copertura e dall’inclinazione sull’orizzontale delle sue parti componenti e dalle condizioni climatiche locali del sito ove sorge la costruzione."),
        await textBlock(number, "editorial-002", "paragraph", 62, region(76, 645, 444, 32), [
            text("In assenza di dati suffragati da opportuna documentazione, i valori nominali del coefficiente di forma "),
            math("μ1", "\\mu_1"),
            text(" delle coperture ad una o a due falde possono essere ricavati dalla Tab. 3.4.II, essendo "),
            math("α", "\\alpha"),
            text(", espresso in gradi sessagesimali, l’angolo formato dalla falda con l’orizzontale."),
        ]),
        await assetRef(number, "editorial-003", "table-ref", tableId("3.4.II"), 62, region(76, 683, 275, 43)),
        await textBlock(number, "editorial-004", "paragraph", 63, region(79, 95, 437, 24), [
            text("Si assume che alla neve non sia impedito di scivolare. Se l’estremità più bassa della falda termina con un parapetto, una barriera od altre ostruzioni, allora il coefficiente di forma non potrà essere assunto inferiore a "),
            math("0,8", "0{,}8"),
            text(" indipendentemente dall’angolo "),
            math("α", "\\alpha"),
            text("."),
        ]),
        await textBlock(number, "editorial-005", "paragraph", 63, region(79, 119, 437, 29), "Per coperture a più falde, per coperture con forme diverse, così come per coperture contigue a edifici più alti o per accumulo di neve contro parapetti o più in generale per altre situazioni ritenute significative dal progettista si deve fare riferimento a normative o documenti di comprovata validità."),
    ];
    unit.assets.tableIds = [tableId("3.4.II")];
    await writeUnit(number, unit);
}

async function fixRemainingSnowUnits(): Promise<void> {
    const unit344 = await readUnit("3.4.4");
    updateText(block(unit344, "3.4.4", "editorial-001"), [
        text("Il coefficiente di esposizione "),
        math("CE", "C_E"),
        text(" tiene conto delle caratteristiche specifiche dell’area in cui sorge l’opera. Valori consigliati di questo coefficiente sono forniti in Tab. 3.4.I per diverse classi di esposizione. Se non diversamente indicato, si assumerà "),
        math("CE = 1", "C_E=1"),
        text("."),
    ]);
    await writeUnit("3.4.4", unit344);

    const unit345 = await readUnit("3.4.5");
    updateText(block(unit345, "3.4.5", "editorial-001"), [
        text("Il coefficiente termico tiene conto della riduzione del carico della neve, a causa dello scioglimento della stessa, causata dalla perdita di calore della costruzione. Tale coefficiente dipende dalle proprietà di isolamento termico del materiale utilizzato in copertura. In assenza di uno specifico e documentato studio, deve essere posto "),
        math("Ct = 1", "C_t=1"),
        text("."),
    ]);
    await writeUnit("3.4.5", unit345);
}

async function rebuildUnit352(): Promise<void> {
    const number = "3.5.2";
    const unit = await readUnit(number);
    unit.blocks = [
        block(unit, number, "heading"),
        await textBlock(number, "editorial-001", "paragraph", 64, region(78, 108, 441, 23), [
            text("La temperatura dell’aria esterna, "),
            math("Test", "T_{est}"),
            text(", può assumere il valore "),
            math("Tmax", "T_{max}"),
            text(" o "),
            math("Tmin", "T_{min}"),
            text(", definite rispettivamente come temperatura massima estiva e minima invernale dell’aria nel sito della costruzione, con riferimento ad un periodo di ritorno di "),
            math("50 anni", "50\\,\\text{anni}"),
            text("."),
        ]),
        await textBlock(number, "editorial-002", "paragraph", 64, region(78, 132, 441, 22), "Per un’opera di nuova realizzazione in fase di costruzione o per le fasi transitorie relative ad interventi sulle costruzioni esistenti, il periodo di ritorno dell’azione potrà essere ridotto come di seguito specificato:"),
        await textBlock(number, "editorial-003", "list-item", 64, region(93, 157, 426, 23), [
            text("per fasi di costruzione o fasi transitorie con durata prevista in sede di progetto non superiore a tre mesi, si assumerà "),
            math("TR ≥ 5 anni", "T_R\\ge5\\,\\text{anni}"),
            text(";"),
        ]),
        await textBlock(number, "editorial-004", "list-item", 64, region(93, 183, 426, 23), [
            text("per fasi di costruzione o fasi transitorie con durata prevista in sede di progetto compresa fra tre mesi ed un anno, si assumerà "),
            math("TR ≥ 10 anni", "T_R\\ge10\\,\\text{anni}"),
            text(";"),
        ]),
        await textBlock(number, "editorial-005", "paragraph", 64, region(78, 209, 441, 32), [
            text("In mancanza di adeguate indagini statistiche basate su dati specifici relativi al sito in esame, "),
            math("Tmax", "T_{max}"),
            text(" o "),
            math("Tmin", "T_{min}"),
            text(" dovranno essere calcolati in base alle espressioni riportate nel seguito, per le varie zone indicate nella Fig. 3.5.1. Tale zonazione non tiene conto di aspetti specifici e locali che, se necessario, dovranno essere definiti singolarmente."),
        ]),
        asset(unit, "urn:structural-codes:it:asset:figure:ntc2018:3.5.1"),
        await textBlock(number, "editorial-007", "paragraph", 64, region(78, 463, 441, 23), [
            text("Nelle espressioni seguenti, "),
            math("Tmax", "T_{max}"),
            text(" o "),
            math("Tmin", "T_{min}"),
            text(" sono espressi in "),
            math("°C", "{}^\\circ\\mathrm{C}"),
            text("; l’altitudine di riferimento "),
            math("as", "a_s"),
            text(" (espressa in "),
            math("m", "\\mathrm{m}"),
            text(") è la quota del suolo sul livello del mare nel sito dove è realizzata la costruzione."),
        ]),
        await textBlock(number, "editorial-008", "heading", 64, region(78, 487, 60, 11), "Zona I"),
        await textBlock(number, "editorial-009", "paragraph", 64, region(78, 498, 365, 11), "Valle d’Aosta, Piemonte, Lombardia, Trentino-Alto Adige, Veneto, Friuli-Venezia Giulia, Emilia Romagna:"),
        await assetRef(number, "editorial-010", "formula-ref", formulaId("3.5.1"), 64, region(178, 507, 195, 17)),
        await assetRef(number, "editorial-011", "formula-ref", formulaId("3.5.2"), 64, region(178, 520, 195, 17)),
        await textBlock(number, "editorial-012", "heading", 64, region(78, 536, 60, 11), "Zona II"),
        await textBlock(number, "editorial-013", "paragraph", 64, region(78, 547, 260, 11), "Liguria, Toscana, Umbria, Lazio, Sardegna, Campania, Basilicata:"),
        await assetRef(number, "editorial-014", "formula-ref", formulaId("3.5.3"), 64, region(178, 556, 195, 17)),
        await assetRef(number, "editorial-015", "formula-ref", formulaId("3.5.4"), 64, region(178, 569, 195, 17)),
        await textBlock(number, "editorial-016", "heading", 64, region(78, 585, 60, 11), "Zona III"),
        await textBlock(number, "editorial-017", "paragraph", 64, region(78, 596, 160, 11), "Marche, Abruzzo, Molise, Puglia:"),
        await assetRef(number, "editorial-018", "formula-ref", formulaId("3.5.5"), 64, region(178, 605, 195, 17)),
        await assetRef(number, "editorial-019", "formula-ref", formulaId("3.5.6"), 64, region(178, 618, 195, 17)),
        await textBlock(number, "editorial-020", "heading", 64, region(78, 634, 60, 11), "Zona IV"),
        await textBlock(number, "editorial-021", "paragraph", 64, region(78, 645, 90, 11), "Calabria, Sicilia:"),
        await assetRef(number, "editorial-022", "formula-ref", formulaId("3.5.7"), 64, region(178, 654, 195, 17)),
        await assetRef(number, "editorial-023", "formula-ref", formulaId("3.5.8"), 64, region(178, 667, 195, 17)),
    ];
    unit.assets.formulaIds = ["3.5.1", "3.5.2", "3.5.3", "3.5.4", "3.5.5", "3.5.6", "3.5.7", "3.5.8"].map(formulaId);
    await writeUnit(number, unit);
}

async function fixUnit353(): Promise<void> {
    const number = "3.5.3";
    const unit = await readUnit(number);
    updateText(block(unit, number, "editorial-001"), [
        text("In mancanza di più precise valutazioni, legate alla tipologia della costruzione ed alla sua destinazione d’uso, la temperatura dell’aria interna, "),
        math("Tint", "T_{int}"),
        text(", può essere assunta pari a "),
        math("20 °C", "20\\,{}^\\circ\\mathrm{C}"),
        text("."),
    ]);
    await writeUnit(number, unit);
}

const tables = [
    {
        id: tableId("3.3.I"),
        unitId: uid("3.3.1"),
        officialNumber: "3.3.I",
        pdfPage: 56,
        caption: "Tabella 3.3.I - Valori dei parametri vb,0, a0, ks",
        captionInline: [text("Valori dei parametri "), math("vb,0", "v_{b,0}"), text(", "), math("a0", "a_0"), text(", "), math("ks", "k_s")],
        columnCount: 5,
        headers: [[cell("Zona", { align: "center" }), cell("Descrizione"), mathCell("vb,0 [m/s]", "v_{b,0}\\,[\\mathrm{m/s}]", { align: "center" }), mathCell("a0 [m]", "a_0\\,[\\mathrm{m}]", { align: "center" }), mathCell("ks", "k_s", { align: "center" })]],
        rows: [
            [cell("1", { align: "center" }), cell("Valle d’Aosta, Piemonte, Lombardia, Trentino Alto Adige, Veneto, Friuli Venezia Giulia (con l’eccezione della provincia di Trieste)"), cell("25", { align: "center" }), cell("1000", { align: "center" }), mathCell("0,40", "0{,}40", { align: "center" })],
            [cell("2", { align: "center" }), cell("Emilia Romagna"), cell("25", { align: "center" }), cell("750", { align: "center" }), mathCell("0,45", "0{,}45", { align: "center" })],
            [cell("3", { align: "center" }), cell("Toscana, Marche, Umbria, Lazio, Abruzzo, Molise, Puglia, Campania, Basilicata, Calabria (esclusa la provincia di Reggio Calabria)"), cell("27", { align: "center" }), cell("500", { align: "center" }), mathCell("0,37", "0{,}37", { align: "center" })],
            [cell("4", { align: "center" }), cell("Sicilia e provincia di Reggio Calabria"), cell("28", { align: "center" }), cell("500", { align: "center" }), mathCell("0,36", "0{,}36", { align: "center" })],
            [cell("5", { align: "center" }), cell("Sardegna (zona a oriente della retta congiungente Capo Teulada con l’Isola di Maddalena)"), cell("28", { align: "center" }), cell("750", { align: "center" }), mathCell("0,40", "0{,}40", { align: "center" })],
            [cell("6", { align: "center" }), cell("Sardegna (zona a occidente della retta congiungente Capo Teulada con l’Isola di Maddalena)"), cell("28", { align: "center" }), cell("500", { align: "center" }), mathCell("0,36", "0{,}36", { align: "center" })],
            [cell("7", { align: "center" }), cell("Liguria"), cell("28", { align: "center" }), cell("1000", { align: "center" }), mathCell("0,54", "0{,}54", { align: "center" })],
            [cell("8", { align: "center" }), cell("Provincia di Trieste"), cell("30", { align: "center" }), cell("1500", { align: "center" }), mathCell("0,50", "0{,}50", { align: "center" })],
            [cell("9", { align: "center" }), cell("Isole (con l’eccezione di Sicilia e Sardegna) e mare aperto"), cell("31", { align: "center" }), cell("500", { align: "center" }), mathCell("0,32", "0{,}32", { align: "center" })],
        ],
        notes: [],
    },
    {
        id: tableId("3.3.II"),
        unitId: uid("3.3.7"),
        officialNumber: "3.3.II",
        pdfPage: 58,
        caption: "Tabella 3.3.II - Parametri per la definizione del coefficiente di esposizione",
        columnCount: 4,
        headers: [[cell("Categoria di esposizione del sito", { align: "center" }), mathCell("Kr", "K_r", { align: "center" }), mathCell("z0 [m]", "z_0\\,[\\mathrm{m}]", { align: "center" }), mathCell("zmin [m]", "z_{min}\\,[\\mathrm{m}]", { align: "center" })]],
        rows: [
            [cell("I", { align: "center" }), mathCell("0,17", "0{,}17", { align: "center" }), mathCell("0,01", "0{,}01", { align: "center" }), cell("2", { align: "center" })],
            [cell("II", { align: "center" }), mathCell("0,19", "0{,}19", { align: "center" }), mathCell("0,05", "0{,}05", { align: "center" }), cell("4", { align: "center" })],
            [cell("III", { align: "center" }), mathCell("0,20", "0{,}20", { align: "center" }), mathCell("0,10", "0{,}10", { align: "center" }), cell("5", { align: "center" })],
            [cell("IV", { align: "center" }), mathCell("0,22", "0{,}22", { align: "center" }), mathCell("0,30", "0{,}30", { align: "center" }), cell("8", { align: "center" })],
            [cell("V", { align: "center" }), mathCell("0,23", "0{,}23", { align: "center" }), mathCell("0,70", "0{,}70", { align: "center" }), cell("12", { align: "center" })],
        ],
        notes: [],
    },
    {
        id: tableId("3.3.III"),
        unitId: uid("3.3.7"),
        officialNumber: "3.3.III",
        pdfPage: 59,
        caption: "Tabella 3.3.III - Classi di rugosità del terreno",
        columnCount: 2,
        headers: [[cell("Classe di rugosità del terreno", { align: "center" }), cell("Descrizione")]],
        rows: [
            [cell("A", { align: "center" }), cell("Aree urbane in cui almeno il 15% della superficie sia coperto da edifici la cui altezza media superi i 15 m")],
            [cell("B", { align: "center" }), cell("Aree urbane (non di classe A), suburbane, industriali e boschive")],
            [cell("C", { align: "center" }), cell("Aree con ostacoli diffusi (alberi, case, muri, recinzioni,....); aree con rugosità non riconducibile alle classi A, B, D")],
            [cell("D", { align: "center" }), cell("a) Mare e relativa fascia costiera (entro 2 km dalla costa); b) Lago (con larghezza massima pari ad almeno 1 km) e relativa fascia costiera (entro 1 km dalla costa) c) Aree prive di ostacoli o con al più rari ostacoli isolati (aperta campagna, aeroporti, aree agricole, pascoli, zone paludose o sabbiose, superfici innevate o ghiacciate, ....)")],
            [inlineCell("L’assegnazione della classe di rugosità non dipende dalla conformazione orografica e topografica del terreno. Si può assumere che il sito appartenga alla Classe A o B, purché la costruzione si trovi nell’area relativa per non meno di 1 km e comunque per non meno di 20 volte l’altezza della costruzione, per tutti i settori di provenienza del vento ampi almeno 30°. Si deve assumere che il sito appartenga alla Classe D, qualora la costruzione sorga nelle aree indicate con le lettere a) o b), oppure entro un raggio di 1 km da essa vi sia un settore ampio 30°, dove il 90% del terreno sia del tipo indicato con la lettera c). Laddove sussistessero dubbi sulla scelta della classe di rugosità, si deve assegnare la classe più sfavorevole (l’azione del vento è in genere minima in Classe A e massima in Classe D).", [
                text("L’assegnazione della classe di rugosità non dipende dalla conformazione orografica e topografica del terreno. Si può assumere che il sito appartenga alla Classe A o B, purché la costruzione si trovi nell’area relativa per non meno di "),
                math("1 km", "1\\,\\mathrm{km}"),
                text(" e comunque per non meno di 20 volte l’altezza della costruzione, per tutti i settori di provenienza del vento ampi almeno "),
                math("30°", "30^\\circ"),
                text(". Si deve assumere che il sito appartenga alla Classe D, qualora la costruzione sorga nelle aree indicate con le lettere a) o b), oppure entro un raggio di "),
                math("1 km", "1\\,\\mathrm{km}"),
                text(" da essa vi sia un settore ampio "),
                math("30°", "30^\\circ"),
                text(", dove il "),
                math("90%", "90\\%"),
                text(" del terreno sia del tipo indicato con la lettera c). Laddove sussistessero dubbi sulla scelta della classe di rugosità, si deve assegnare la classe più sfavorevole (l’azione del vento è in genere minima in Classe A e massima in Classe D)."),
            ], { colSpan: 2 })],
        ],
        notes: [],
    },
    {
        id: tableId("3.4.I"),
        unitId: uid("3.4.4"),
        officialNumber: "3.4.I",
        pdfPage: 63,
        caption: "Tabella 3.4.I - Valori di CE per diverse classi di esposizione",
        columnCount: 3,
        headers: [[cell("Topografia"), cell("Descrizione"), mathCell("CE", "C_E")]],
        rows: [
            [cell("Battuta dai venti"), cell("Aree pianeggianti non ostruite esposte su tutti i lati, senza costruzioni o alberi più alti"), mathCell("0,9", "0{,}9")],
            [cell("Normale"), cell("Aree in cui non è presente una significativa rimozione di neve sulla costruzione prodotta dal vento, a causa del terreno, altre costruzioni o alberi"), mathCell("1,0", "1{,}0")],
            [cell("Riparata"), cell("Aree in cui la costruzione considerata è sensibilmente più bassa del circostante terreno o circondata da costruzioni o alberi più alti"), mathCell("1,1", "1{,}1")],
        ],
        notes: [],
    },
    {
        id: tableId("3.4.II"),
        unitId: uid("3.4.3.1"),
        officialNumber: "3.4.II",
        pdfPage: 62,
        caption: "Tabella 3.4.II - Valori del coefficiente di forma",
        columnCount: 4,
        headers: [[cell("Coefficiente di forma", { align: "center" }), mathCell("0° ≤ α ≤ 30°", "0^\\circ\\le\\alpha\\le30^\\circ", { align: "center" }), mathCell("30° < α < 60°", "30^\\circ<\\alpha<60^\\circ", { align: "center" }), mathCell("α ≥ 60°", "\\alpha\\ge60^\\circ", { align: "center" })]],
        rows: [[mathCell("μ1", "\\mu_1", { align: "center" }), mathCell("0,8", "0{,}8", { align: "center" }), mathCell("0,8 · (60 − α) / 30", "0{,}8\\cdot\\dfrac{60-\\alpha}{30}", { align: "center" }), mathCell("0,0", "0{,}0", { align: "center" })]],
        notes: [],
    },
];

async function rebuildTables(): Promise<void> {
    const manifest = JSON.parse(await readFile(tableManifestPath, "utf8"));
    const replacements = new Map(tables.map((table) => [table.id, table]));
    const replaced = new Set<string>();
    manifest.tables = manifest.tables.map((table: { id: string }) => {
        const replacement = replacements.get(table.id);
        if (!replacement) return table;
        replaced.add(table.id);
        return replacement;
    });
    manifest.tables.push(...tables.filter((table) => !replaced.has(table.id)));
    await writeFile(tableManifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

await rebuildUnit3242();
await fixExistingWindUnits();
await rebuildUnit337();
await fixUnit338();
await fixUnit341();
await rebuildUnit342();
await rebuildUnit3431();
await fixRemainingSnowUnits();
await rebuildUnit352();
await fixUnit353();
await rebuildTables();
console.log("ntc3-step3: rebuilt formulas, inline math and Tables 3.3.I–III/3.4.I–II for PDF pages 55–64");
