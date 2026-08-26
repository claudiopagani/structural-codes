import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitsRoot = `${repoRoot}/corpus/units/ntc2018`;
const tableManifestPath = `${repoRoot}/corpus/assets/ntc2018/core-tables.json`;
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

type EvidenceItem = {
    sequence: number;
    text: string;
    hasEol: boolean;
    region: Region;
};

type PageEvidence = { textItems: EvidenceItem[] };

type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };
type Transformation = { operation: string; ruleVersion: string; note: string };
type UnitBlock = {
    blockId: string;
    kind: string;
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
const cell = (value: string, span: Pick<Cell, "colSpan" | "rowSpan"> = {}): Cell => ({ text: value, ...span });
const mathCell = (value: string, latex: string, span: Pick<Cell, "colSpan" | "rowSpan"> = {}): Cell => ({ text: value, latex, ...span });

const pageCache = new Map<number, PageEvidence>();
async function pageEvidence(page: number): Promise<PageEvidence> {
    const cached = pageCache.get(page);
    if (cached) return cached;
    const path = `${repoRoot}/evidence/gu-so8-2018-ntc/pages/page-${String(page).padStart(4, "0")}.json`;
    const parsed = JSON.parse(await readFile(path, "utf8")) as PageEvidence;
    pageCache.set(page, parsed);
    return parsed;
}

function intersects(a: Region, b: Region): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function rawFor(page: number, target: Region): Promise<string> {
    const evidence = await pageEvidence(page);
    return evidence.textItems
        .filter((item) => item.text && intersects(item.region, target))
        .sort((left, right) => left.sequence - right.sequence)
        .map((item) => `${item.text}${item.hasEol ? "\n" : ""}`)
        .join("")
        .trim();
}

const uid = (unit: string): string => `urn:structural-codes:it:unit:ntc2018:${unit}`;
const formulaId = (number: string): string => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string): string => `urn:structural-codes:it:asset:table:ntc2018:${number.toLowerCase()}`;

function transformations(note: string) {
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
) {
    const inline = typeof value === "string" ? undefined : value;
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    const raw = await rawFor(page, target);
    return {
        blockId: `${uid(unit)}#block-${suffix}`,
        kind,
        origin: "official",
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
                : transformations("Separati i blocchi editoriali e ripristinati pedici, apici, simboli greci e punteggiatura verificati sul render ufficiale."),
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
    normalizedEvidence: string,
    note = "Asset trascritto e collocato confrontando direttamente il render della fonte ufficiale.",
) {
    const raw = await rawFor(page, target);
    return {
        blockId: `${uid(unit)}#block-${suffix}`,
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
            transformations: [{ operation: "manual-correction", ruleVersion: profile, note }],
            rawSha256: sha256(raw),
            normalizedSha256: sha256(normalizedEvidence),
        },
    };
}

function updateExistingText(block: UnitBlock, value: string | InlineSegment[]): UnitBlock {
    if (!block.text) throw new Error("Blocco testuale privo di payload: " + block.blockId);
    const inline = typeof value === "string" ? undefined : value;
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    block.text.normalized = normalized;
    block.text.normalizationVersion = profile;
    if (inline) block.text.inline = inline;
    else delete block.text.inline;
    block.evidence.normalizedSha256 = sha256(normalized);
    block.evidence.transformations = [
        ...(block.evidence.transformations ?? []).filter((entry: { operation: string }) => entry.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinata la segmentazione matematica confrontando direttamente il render ufficiale.",
        },
    ];
    return block;
}

function existingBlock(unit: CanonicalUnit, index: number): UnitBlock {
    const block = unit.blocks[index];
    if (!block) throw new Error("Blocco mancante all’indice " + index);
    return block;
}

function textBlockStartingWith(unit: CanonicalUnit, prefix: string): UnitBlock {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    if (!block) throw new Error("Blocco di testo mancante con prefisso: " + prefix);
    return block;
}

async function readUnit(unit: string): Promise<CanonicalUnit> {
    return JSON.parse(await readFile(`${unitsRoot}/${unit}.json`, "utf8")) as CanonicalUnit;
}

async function writeUnit(unit: string, record: CanonicalUnit): Promise<void> {
    await writeFile(`${unitsRoot}/${unit}.json`, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

async function rebuildUnit321(): Promise<void> {
    const unit = await readUnit("3.2.1");
    updateExistingText(existingBlock(unit, 8), [
        text("Le probabilità di superamento nel periodo di riferimento "),
        math("PVR", "P_{VR}"),
        text(", cui riferirsi per individuare l’azione sismica agente in ciascuno degli stati limite considerati, sono riportate nella Tab. 3.2.I."),
    ]);
    updateExistingText(existingBlock(unit, 10), [
        text("Qualora la protezione nei confronti degli stati limite di esercizio sia di prioritaria importanza, i valori di "),
        math("PVR", "P_{VR}"),
        text(" forniti in tabella devono essere ridotti in funzione del grado di protezione che si vuole raggiungere."),
    ]);
    updateExistingText(existingBlock(unit, 11), [
        text("Per ciascuno stato limite e relativa probabilità di eccedenza "),
        math("PVR", "P_{VR}"),
        text(" nel periodo di riferimento "),
        math("VR", "V_R"),
        text(" si ricava il periodo di ritorno "),
        math("TR", "T_R"),
        text(" del sisma utilizzando la relazione:"),
    ]);
    unit.assets.tableIds = [tableId("3.2.I")];
    await writeUnit("3.2.1", unit);
}

async function rebuildUnit322(): Promise<void> {
    const unit = await readUnit("3.2.2");
    updateExistingText(existingBlock(unit, 2), [
        text("Ai fini della definizione dell’azione sismica di progetto, l’effetto della risposta sismica locale si valuta mediante specifiche analisi, da eseguire con le modalità indicate nel § 7.11.3. In alternativa, qualora le condizioni stratigrafiche e le proprietà dei terreni siano chiaramente riconducibili alle categorie definite nella Tab. 3.2.II, si può fare riferimento a un approccio semplificato che si basa sulla classificazione del sottosuolo in funzione dei valori della velocità di propagazione delle onde di taglio, "),
        math("VS", "V_S"),
        text(". I valori dei parametri meccanici necessari per le analisi di risposta sismica locale o delle velocità "),
        math("VS", "V_S"),
        text(" per l’approccio semplificato costituiscono parte integrante della caratterizzazione geotecnica dei terreni compresi nel volume significativo, di cui al § 6.2.2."),
    ]);
    updateExistingText(existingBlock(unit, 3), [
        text("I valori di "), math("VS", "V_S"),
        text(" sono ottenuti mediante specifiche prove oppure, con giustificata motivazione e limitatamente all’approccio semplificato, sono valutati tramite relazioni empiriche di comprovata affidabilità con i risultati di altre prove in sito, quali ad esempio le prove penetrometriche dinamiche per i terreni a grana grossa e le prove penetrometriche statiche."),
    ]);
    updateExistingText(existingBlock(unit, 4), [
        text("La classificazione del sottosuolo si effettua in base alle condizioni stratigrafiche e ai valori della velocità equivalente di propagazione delle onde di taglio, "),
        math("VS,eq", "V_{S,eq}"),
        text(" (in m/s), definita dall’espressione:"),
    ]);
    updateExistingText(existingBlock(unit, 7), [
        math("hi", "h_i"), text(" spessore dell’i-esimo strato; "),
        math("VS,i", "V_{S,i}"), text(" velocità delle onde di taglio nell’i-esimo strato; "),
        math("N", "N"), text(" numero di strati; "),
        math("H", "H"), text(" profondità del substrato, definito come quella formazione costituita da roccia o terreno molto rigido, caratterizzata da "),
        math("VS", "V_S"), text(" non inferiore a 800 m/s."),
    ]);
    updateExistingText(existingBlock(unit, 9), [
        text("Per depositi con profondità "), math("H", "H"),
        text(" del substrato superiore a 30 m, la velocità equivalente delle onde di taglio "), math("VS,eq", "V_{S,eq}"),
        text(" è definita dal parametro "), math("VS,30", "V_{S,30}"),
        text(", ottenuto ponendo "), math("H = 30 m", "H=30\\,\\mathrm{m}"),
        text(" nella precedente espressione e considerando le proprietà degli strati di terreno fino a tale profondità."),
    ]);

    unit.blocks = [
        ...unit.blocks.slice(0, 11),
        await assetRef("3.2.2", "editorial-011", "table-ref", tableId("3.2.II"), 50, region(75, 557, 445, 181), tableId("3.2.II")),
        { ...textBlockStartingWith(unit, "Per queste cinque categorie di sottosuolo"), blockId: `${uid("3.2.2")}#block-editorial-012` },
        { ...textBlockStartingWith(unit, "Per qualsiasi condizione di sottosuolo"), blockId: `${uid("3.2.2")}#block-editorial-013` },
        { ...textBlockStartingWith(unit, "Condizioni topografiche"), blockId: `${uid("3.2.2")}#block-editorial-014` },
        { ...textBlockStartingWith(unit, "Per condizioni topografiche complesse"), blockId: `${uid("3.2.2")}#block-editorial-015` },
        await assetRef("3.2.2", "editorial-016", "table-ref", tableId("3.2.III"), 51, region(75, 180, 445, 77), tableId("3.2.III")),
        await textBlock(
            "3.2.2",
            "editorial-017",
            "paragraph",
            51,
            region(75, 270, 445, 38),
            "Le suesposte categorie topografiche si riferiscono a configurazioni geometriche prevalentemente bidimensionali, creste o dorsali allungate, e devono essere considerate nella definizione dell’azione sismica se di altezza maggiore di 30 m.",
        ),
    ];
    unit.assets.tableIds = [tableId("3.2.II"), tableId("3.2.III")];
    await writeUnit("3.2.2", unit);
}

async function rebuildUnit32321(): Promise<void> {
    const unit = await readUnit("3.2.3.2.1");
    unit.blocks = [
        existingBlock(unit, 0),
        await textBlock("3.2.3.2.1", "editorial-001", "paragraph", 51, region(75, 675, 445, 24), [
            text("Lo spettro di risposta elastico in accelerazione della componente orizzontale del moto sismico, "),
            math("Se", "S_e"), text(", è definito dalle espressioni seguenti:"),
        ]),
        await assetRef(
            "3.2.3.2.1",
            "editorial-002",
            "formula-ref",
            formulaId("3.2.2"),
            51,
            region(75, 700, 300, 38),
            formulaId("3.2.2"),
            "Sistema [3.2.2] trascritto come unico asset; la prima riga è a pagina 51 e le tre righe successive continuano a pagina 52 del PDF ufficiale.",
        ),
        await textBlock("3.2.3.2.1", "editorial-003", "paragraph", 52, region(73, 156, 55, 12), "nelle quali:"),
        await textBlock("3.2.3.2.1", "editorial-004", "paragraph", 52, region(73, 169, 145, 13), [math("T", "T"), text(" è il periodo proprio di vibrazione;")]),
        await textBlock("3.2.3.2.1", "editorial-005", "paragraph", 52, region(73, 183, 447, 14), [
            math("S", "S"), text(" è il coefficiente che tiene conto della categoria di sottosuolo e delle condizioni topografiche mediante la relazione seguente"),
        ]),
        await assetRef("3.2.3.2.1", "editorial-006", "formula-ref", formulaId("3.2.3"), 52, region(195, 197, 185, 14), formulaId("3.2.3")),
        await textBlock("3.2.3.2.1", "editorial-007", "paragraph", 52, region(85, 211, 435, 26), [
            text("essendo "), math("SS", "S_S"), text(" il coefficiente di amplificazione stratigrafica (vedi Tab. 3.2.IV) e "),
            math("ST", "S_T"), text(" il coefficiente di amplificazione topografica (vedi Tab. 3.2.V);"),
        ]),
        await textBlock("3.2.3.2.1", "editorial-008", "paragraph", 52, region(73, 236, 447, 27), [
            math("η", "\\eta"), text(" è il fattore che altera lo spettro elastico per coefficienti di smorzamento viscosi convenzionali "),
            math("ξ", "\\xi"), text(" diversi dal 5%, mediante la relazione"),
        ]),
        await assetRef("3.2.3.2.1", "editorial-009", "formula-ref", formulaId("3.2.4"), 52, region(175, 258, 205, 20), formulaId("3.2.4")),
        await textBlock("3.2.3.2.1", "editorial-010", "paragraph", 52, region(85, 274, 420, 15), [
            text("dove "), math("ξ", "\\xi"), text(" (espresso in percentuale) è valutato sulla base dei materiali, della tipologia strutturale e del terreno di fondazione;"),
        ]),
        await textBlock("3.2.3.2.1", "editorial-011", "paragraph", 52, region(73, 288, 447, 27), [
            math("Fo", "F_o"), text(" è il fattore che quantifica l’amplificazione spettrale massima, su sito di riferimento rigido orizzontale, ed ha valore minimo pari a 2,2;"),
        ]),
        await textBlock("3.2.3.2.1", "editorial-012", "paragraph", 52, region(73, 313, 447, 16), [
            math("TC", "T_C"), text(" è il periodo corrispondente all’inizio del tratto a velocità costante dello spettro, dato dalla relazione"),
        ]),
        await assetRef("3.2.3.2.1", "editorial-013", "formula-ref", formulaId("3.2.5"), 52, region(190, 325, 190, 18), formulaId("3.2.5")),
        await textBlock("3.2.3.2.1", "editorial-014", "paragraph", 52, region(85, 338, 370, 17), [
            text("dove: "), math("TC*", "T_C^*"), text(" è definito al § 3.2 e "), math("CC", "C_C"),
            text(" è un coefficiente funzione della categoria di sottosuolo (vedi Tab. 3.2.IV);"),
        ]),
        await textBlock("3.2.3.2.1", "editorial-015", "paragraph", 52, region(73, 352, 447, 17), [
            math("TB", "T_B"), text(" è il periodo corrispondente all’inizio del tratto dello spettro ad accelerazione costante, dato dalla relazione"),
        ]),
        await assetRef("3.2.3.2.1", "editorial-016", "formula-ref", formulaId("3.2.6"), 52, region(190, 365, 190, 19), formulaId("3.2.6")),
        await textBlock("3.2.3.2.1", "editorial-017", "paragraph", 52, region(73, 379, 447, 17), [
            math("TD", "T_D"), text(" è il periodo corrispondente all’inizio del tratto a spostamento costante dello spettro, espresso in secondi mediante la relazione:"),
        ]),
        await assetRef("3.2.3.2.1", "editorial-018", "formula-ref", formulaId("3.2.7"), 52, region(180, 390, 205, 21), formulaId("3.2.7")),
        await textBlock("3.2.3.2.1", "editorial-019", "paragraph", 52, region(73, 407, 447, 70), "Per categorie speciali di sottosuolo, per determinati sistemi geotecnici o se si intenda aumentare il grado di accuratezza nella previsione dei fenomeni di amplificazione, le azioni sismiche da considerare nella progettazione possono essere determinate mediante più rigorose analisi di risposta sismica locale. Queste analisi presuppongono un’adeguata conoscenza delle proprietà geotecniche dei terreni e, in particolare, delle relazioni sforzi-deformazioni in campo ciclico, da determinare mediante specifiche indagini e prove."),
        await textBlock("3.2.3.2.1", "editorial-020", "paragraph", 52, region(73, 475, 447, 44), [
            text("In mancanza di tali determinazioni, per le componenti orizzontali del moto e per le categorie di sottosuolo di fondazione definite nel § 3.2.2, la forma spettrale su sottosuolo di categoria A è modificata attraverso il coefficiente stratigrafico "),
            math("SS", "S_S"), text(", il coefficiente topografico "), math("ST", "S_T"), text(" e il coefficiente "), math("CC", "C_C"),
            text(" che modifica il valore del periodo "), math("TC", "T_C"), text("."),
        ]),
        await textBlock("3.2.3.2.1", "editorial-021", "heading", 52, region(73, 520, 180, 12), "Amplificazione stratigrafica"),
        await textBlock("3.2.3.2.1", "editorial-022", "paragraph", 52, region(73, 532, 260, 13), [
            text("Per sottosuolo di categoria A i coefficienti "), math("SS", "S_S"), text(" e "), math("CC", "C_C"), text(" valgono 1."),
        ]),
        await textBlock("3.2.3.2.1", "editorial-023", "paragraph", 52, region(73, 545, 447, 45), [
            text("Per le categorie di sottosuolo B, C, D ed E i coefficienti "), math("SS", "S_S"), text(" e "), math("CC", "C_C"),
            text(" possono essere calcolati, in funzione dei valori di "), math("Fo", "F_o"), text(" e "), math("TC*", "T_C^*"),
            text(" relativi al sottosuolo di categoria A, mediante le espressioni fornite nella Tab. 3.2.IV, nelle quali "),
            math("g = 9,81 m/s²", "g=9{,}81\\,\\mathrm{m/s^2}"), text(" è l’accelerazione di gravità e "), math("TC*", "T_C^*"), text(" è espresso in secondi."),
        ]),
        await assetRef("3.2.3.2.1", "editorial-024", "table-ref", tableId("3.2.IV"), 52, region(73, 580, 375, 145), tableId("3.2.IV")),
        await textBlock("3.2.3.2.1", "editorial-025", "heading", 53, region(77, 93, 180, 12), "Amplificazione topografica"),
        await textBlock("3.2.3.2.1", "editorial-026", "paragraph", 53, region(77, 105, 440, 34), [
            text("Per tener conto delle condizioni topografiche e in assenza di specifiche analisi di risposta sismica locale, si utilizzano i valori del coefficiente topografico "),
            math("ST", "S_T"), text(" riportati nella Tab. 3.2.V, in funzione delle categorie topografiche definite nel § 3.2.2 e dell’ubicazione dell’opera o dell’intervento."),
        ]),
        await assetRef("3.2.3.2.1", "editorial-027", "table-ref", tableId("3.2.V"), 53, region(77, 143, 345, 111), tableId("3.2.V")),
        await textBlock("3.2.3.2.1", "editorial-028", "paragraph", 53, region(77, 255, 440, 37), [
            text("La variazione spaziale del coefficiente di amplificazione topografica è definita da un decremento lineare con l’altezza del pendio o del rilievo, dalla sommità o dalla cresta, dove "),
            math("ST", "S_T"), text(" assume il valore massimo riportato nella Tab. 3.2.V, fino alla base, dove "), math("ST", "S_T"), text(" assume valore unitario."),
        ]),
    ];
    unit.assets.formulaIds = ["3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7"].map(formulaId);
    unit.assets.tableIds = [tableId("3.2.IV"), tableId("3.2.V")];
    await writeUnit("3.2.3.2.1", unit);
}

async function rebuildUnit32322(): Promise<void> {
    const unit = await readUnit("3.2.3.2.2");
    unit.blocks = [
        existingBlock(unit, 0),
        await textBlock("3.2.3.2.2", "editorial-001", "paragraph", 53, region(77, 303, 440, 14), [
            text("Lo spettro di risposta elastico in accelerazione della componente verticale del moto sismico, "), math("Sve", "S_{ve}"),
            text(", è definito dalle espressioni:"),
        ]),
        await assetRef("3.2.3.2.2", "editorial-002", "formula-ref", formulaId("3.2.8"), 53, region(77, 317, 300, 96), formulaId("3.2.8")),
        await textBlock("3.2.3.2.2", "editorial-003", "paragraph", 53, region(77, 411, 55, 12), "nelle quali:"),
        await textBlock("3.2.3.2.2", "editorial-004", "paragraph", 53, region(77, 423, 225, 14), [math("T", "T"), text(" è il periodo proprio di vibrazione (in direzione verticale);")]),
        await textBlock("3.2.3.2.2", "editorial-005", "paragraph", 53, region(77, 435, 440, 27), [
            math("Fv", "F_v"), text(" è il fattore che quantifica l’amplificazione spettrale massima, in termini di accelerazione orizzontale massima del terreno "),
            math("ag", "a_g"), text(" su sito di riferimento rigido orizzontale, mediante la relazione:"),
        ]),
        await assetRef("3.2.3.2.2", "editorial-006", "formula-ref", formulaId("3.2.9"), 53, region(180, 458, 205, 31), formulaId("3.2.9")),
        await textBlock("3.2.3.2.2", "editorial-007", "paragraph", 53, region(77, 487, 440, 29), [
            text("I valori di "), math("ag", "a_g"), text(", "), math("Fo", "F_o"), text(", "), math("S", "S"), text(", "), math("η", "\\eta"),
            text(" sono definiti nel § 3.2.3.2.1 per le componenti orizzontali del moto sismico; i valori di "), math("SS", "S_S"), text(", "),
            math("TB", "T_B"), text(", "), math("TC", "T_C"), text(" e "), math("TD", "T_D"),
            text(", salvo più accurate determinazioni, sono riportati nella Tab. 3.2.VI."),
        ]),
        await assetRef("3.2.3.2.2", "editorial-008", "table-ref", tableId("3.2.VI"), 53, region(77, 516, 295, 42), tableId("3.2.VI")),
        await textBlock("3.2.3.2.2", "editorial-009", "paragraph", 53, region(77, 558, 440, 26), [
            text("Per tener conto delle condizioni topografiche, in assenza di specifiche analisi si utilizzano i valori del coefficiente topografico "),
            math("ST", "S_T"), text(" riportati in Tab. 3.2.V."),
        ]),
    ];
    unit.assets.formulaIds = [formulaId("3.2.8"), formulaId("3.2.9")];
    unit.assets.tableIds = [tableId("3.2.VI")];
    await writeUnit("3.2.3.2.2", unit);
}

async function rebuildUnit323223(): Promise<void> {
    const unit = await readUnit("3.2.3.2.3");
    unit.blocks = [
        existingBlock(unit, 0),
        await textBlock("3.2.3.2.3", "editorial-001", "paragraph", 53, region(77, 604, 440, 32), [
            text("Lo spettro di risposta elastico in spostamento delle componenti orizzontali "), math("SDe(T)", "S_{De}(T)"),
            text(" si ricava dalla corrispondente risposta in accelerazione "), math("Se(T)", "S_e(T)"), text(" mediante la seguente espressione:"),
        ]),
        await assetRef("3.2.3.2.3", "editorial-002", "formula-ref", formulaId("3.2.10"), 53, region(170, 631, 220, 25), formulaId("3.2.10")),
        await textBlock("3.2.3.2.3", "editorial-003", "paragraph", 53, region(77, 650, 440, 15), [
            text("purché il periodo proprio di vibrazione "), math("T", "T"), text(" non ecceda i valori "), math("TE", "T_E"), text(" indicati in Tab. 3.2.VII."),
        ]),
        await assetRef("3.2.3.2.3", "editorial-004", "table-ref", tableId("3.2.VII"), 53, region(77, 672, 330, 61), tableId("3.2.VII")),
        await textBlock("3.2.3.2.3", "editorial-005", "paragraph", 54, region(77, 93, 440, 15), [
            text("Per periodi di vibrazione eccedenti "), math("TE", "T_E"), text(", le ordinate dello spettro possono essere ottenute dalle formule seguenti:"),
        ]),
        await assetRef("3.2.3.2.3", "editorial-006", "formula-ref", formulaId("3.2.11"), 54, region(77, 108, 300, 47), formulaId("3.2.11")),
        await textBlock("3.2.3.2.3", "editorial-007", "paragraph", 54, region(77, 153, 285, 15), [
            text("dove tutti i simboli sono già stati definiti, ad eccezione di "), math("dg", "d_g"), text(", definito nel § 3.2.3.3."),
        ]),
    ];
    unit.assets.formulaIds = [formulaId("3.2.10"), formulaId("3.2.11")];
    unit.assets.tableIds = [tableId("3.2.VII")];
    await writeUnit("3.2.3.2.3", unit);
}

async function rebuildUnit3233(): Promise<void> {
    const unit = await readUnit("3.2.3.3");
    unit.blocks = [
        existingBlock(unit, 0),
        await textBlock("3.2.3.3", "editorial-001", "paragraph", 54, region(77, 189, 440, 17), [
            text("I valori dello spostamento orizzontale "), math("dg", "d_g"), text(" e della velocità orizzontale "), math("vg", "v_g"),
            text(" massimi del terreno sono dati dalle seguenti espressioni:"),
        ]),
        await assetRef("3.2.3.3", "editorial-002", "formula-ref", formulaId("3.2.12"), 54, region(135, 207, 260, 42), formulaId("3.2.12")),
        await textBlock("3.2.3.3", "editorial-003", "paragraph", 54, region(77, 244, 355, 15), [
            text("dove "), math("ag", "a_g"), text(", "), math("S", "S"), text(", "), math("TC", "T_C"), text(", "), math("TD", "T_D"),
            text(" assumono i valori già utilizzati al § 3.2.3.2.1."),
        ]),
    ];
    unit.assets.formulaIds = [formulaId("3.2.12")];
    await writeUnit("3.2.3.3", unit);
}

const tables = [
    {
        id: tableId("3.2.I"), unitId: uid("3.2.1"), officialNumber: "3.2.I", pdfPage: 50,
        caption: "Tabella 3.2.I - Probabilità di superamento PVR in funzione dello stato limite considerato",
        columnCount: 3,
        headers: [[cell("Stati Limite", { colSpan: 2 }), mathCell("PVR: Probabilità di superamento nel periodo di riferimento VR", "P_{VR}:\\text{ Probabilità di superamento nel periodo di riferimento }V_R")]],
        rows: [
            [cell("Stati limite di esercizio", { rowSpan: 2 }), cell("SLO"), mathCell("81%", "81\\%")],
            [cell("SLD"), mathCell("63%", "63\\%")],
            [cell("Stati limite ultimi", { rowSpan: 2 }), cell("SLV"), mathCell("10%", "10\\%")],
            [cell("SLC"), mathCell("5%", "5\\%")],
        ],
        notes: [],
    },
    {
        id: tableId("3.2.II"), unitId: uid("3.2.2"), officialNumber: "3.2.II", pdfPage: 50,
        caption: "Tabella 3.2.II - Categorie di sottosuolo che permettono l’utilizzo dell’approccio semplificato",
        columnCount: 2,
        headers: [[cell("Categoria"), cell("Caratteristiche della superficie topografica")]],
        rows: [
            [cell("A"), cell("Ammassi rocciosi affioranti o terreni molto rigidi caratterizzati da valori di velocità delle onde di taglio superiori a 800 m/s, eventualmente comprendenti in superficie terreni di caratteristiche meccaniche più scadenti con spessore massimo pari a 3 m.")],
            [cell("B"), cell("Rocce tenere e depositi di terreni a grana grossa molto addensati o terreni a grana fina molto consistenti, caratterizzati da un miglioramento delle proprietà meccaniche con la profondità e da valori di velocità equivalente compresi tra 360 m/s e 800 m/s.")],
            [cell("C"), cell("Depositi di terreni a grana grossa mediamente addensati o terreni a grana fina mediamente consistenti con profondità del substrato superiori a 30 m, caratterizzati da un miglioramento delle proprietà meccaniche con la profondità e da valori di velocità equivalente compresi tra 180 m/s e 360 m/s.")],
            [cell("D"), cell("Depositi di terreni a grana grossa scarsamente addensati o di terreni a grana fina scarsamente consistenti, con profondità del substrato superiori a 30 m, caratterizzati da un miglioramento delle proprietà meccaniche con la profondità e da valori di velocità equivalente compresi tra 100 e 180 m/s.")],
            [cell("E"), cell("Terreni con caratteristiche e valori di velocità equivalente riconducibili a quelle definite per le categorie C o D, con profondità del substrato non superiore a 30 m.")],
        ],
        notes: [],
    },
    {
        id: tableId("3.2.III"), unitId: uid("3.2.2"), officialNumber: "3.2.III", pdfPage: 51,
        caption: "Tabella 3.2.III - Categorie topografiche",
        columnCount: 2,
        headers: [[cell("Categoria"), cell("Caratteristiche della superficie topografica")]],
        rows: [
            [cell("T1"), cell("Superficie pianeggiante, pendii e rilievi isolati con inclinazione media i ≤ 15°")],
            [cell("T2"), cell("Pendii con inclinazione media i > 15°")],
            [cell("T3"), cell("Rilievi con larghezza in cresta molto minore che alla base e inclinazione media 15° ≤ i ≤ 30°")],
            [cell("T4"), cell("Rilievi con larghezza in cresta molto minore che alla base e inclinazione media i > 30°")],
        ],
        notes: [],
    },
    {
        id: tableId("3.2.IV"), unitId: uid("3.2.3.2.1"), officialNumber: "3.2.IV", pdfPage: 52,
        caption: "Tabella 3.2.IV - Espressioni di SS e di CC",
        columnCount: 3,
        headers: [[cell("Categoria sottosuolo"), mathCell("SS", "S_S"), mathCell("CC", "C_C")]],
        rows: [
            [cell("A"), mathCell("1,00", "1{,}00"), mathCell("1,00", "1{,}00")],
            [cell("B"), mathCell("1,00 ≤ 1,40 − 0,40 · Fo · ag/g ≤ 1,20", "1{,}00\\le1{,}40-0{,}40\\cdot F_o\\cdot\\frac{a_g}{g}\\le1{,}20"), mathCell("1,10 · (TC*)^-0,20", "1{,}10\\cdot(T_C^*)^{-0{,}20}")],
            [cell("C"), mathCell("1,00 ≤ 1,70 − 0,60 · Fo · ag/g ≤ 1,50", "1{,}00\\le1{,}70-0{,}60\\cdot F_o\\cdot\\frac{a_g}{g}\\le1{,}50"), mathCell("1,05 · (TC*)^-0,33", "1{,}05\\cdot(T_C^*)^{-0{,}33}")],
            [cell("D"), mathCell("0,90 ≤ 2,40 − 1,50 · Fo · ag/g ≤ 1,80", "0{,}90\\le2{,}40-1{,}50\\cdot F_o\\cdot\\frac{a_g}{g}\\le1{,}80"), mathCell("1,25 · (TC*)^-0,50", "1{,}25\\cdot(T_C^*)^{-0{,}50}")],
            [cell("E"), mathCell("1,00 ≤ 2,00 − 1,10 · Fo · ag/g ≤ 1,60", "1{,}00\\le2{,}00-1{,}10\\cdot F_o\\cdot\\frac{a_g}{g}\\le1{,}60"), mathCell("1,15 · (TC*)^-0,40", "1{,}15\\cdot(T_C^*)^{-0{,}40}")],
        ],
        notes: [],
    },
    {
        id: tableId("3.2.V"), unitId: uid("3.2.3.2.1"), officialNumber: "3.2.V", pdfPage: 53,
        caption: "Tabella 3.2.V - Valori massimi del coefficiente di amplificazione topografica ST",
        columnCount: 3,
        headers: [[cell("Categoria topografica"), cell("Ubicazione dell’opera o dell’intervento"), mathCell("ST", "S_T")]],
        rows: [
            [cell("T1"), cell("-"), mathCell("1,0", "1{,}0")],
            [cell("T2"), cell("In corrispondenza della sommità del pendio"), mathCell("1,2", "1{,}2")],
            [cell("T3"), cell("In corrispondenza della cresta di un rilievo con pendenza media minore o uguale a 30°"), mathCell("1,2", "1{,}2")],
            [cell("T4"), cell("In corrispondenza della cresta di un rilievo con pendenza media maggiore di 30°"), mathCell("1,4", "1{,}4")],
        ],
        notes: [],
    },
    {
        id: tableId("3.2.VI"), unitId: uid("3.2.3.2.2"), officialNumber: "3.2.VI", pdfPage: 53,
        caption: "Tabella 3.2.VI - Valori dei parametri dello spettro di risposta elastico della componente verticale",
        columnCount: 5,
        headers: [[cell("Categoria di sottosuolo"), mathCell("SS", "S_S"), mathCell("TB", "T_B"), mathCell("TC", "T_C"), mathCell("TD", "T_D")]],
        rows: [[cell("A, B, C, D, E"), mathCell("1,0", "1{,}0"), mathCell("0,05 s", "0{,}05\\,\\mathrm{s}"), mathCell("0,15 s", "0{,}15\\,\\mathrm{s}"), mathCell("1,0 s", "1{,}0\\,\\mathrm{s}")]],
        notes: [],
    },
    {
        id: tableId("3.2.VII"), unitId: uid("3.2.3.2.3"), officialNumber: "3.2.VII", pdfPage: 53,
        caption: "Tabella 3.2.VII - Valori dei parametri TE e TF",
        columnCount: 3,
        headers: [[cell("Categoria sottosuolo"), mathCell("TE [s]", "T_E\\,[\\mathrm{s}]"), mathCell("TF [s]", "T_F\\,[\\mathrm{s}]")]],
        rows: [
            [cell("A"), mathCell("4,5", "4{,}5"), mathCell("10,0", "10{,}0")],
            [cell("B"), mathCell("5,0", "5{,}0"), mathCell("10,0", "10{,}0")],
            [cell("C, D, E"), mathCell("6,0", "6{,}0"), mathCell("10,0", "10{,}0")],
        ],
        notes: [],
    },
];

async function rebuildTables(): Promise<void> {
    const manifest = JSON.parse(await readFile(tableManifestPath, "utf8"));
    const replacementIds = new Set(tables.map((table) => table.id));
    manifest.tables = manifest.tables.filter((table: { id: string }) => !replacementIds.has(table.id));
    manifest.tables.push(...tables);
    await writeFile(tableManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await rebuildUnit321();
await rebuildUnit322();
await rebuildUnit32321();
await rebuildUnit32322();
await rebuildUnit323223();
await rebuildUnit3233();
await rebuildTables();
console.log("ntc32-step2: rebuilt NTC 3.2 formula flow and Tables 3.2.I–VII for PDF pages 49–54");
