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
    | { kind: "em"; value: string }
    | { kind: "math"; value: string; latex: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type UnitBlock = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    listLevel?: number;
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
type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number; align?: "left" | "center" | "right" };

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});
const text = (value: string): InlineSegment => ({ kind: "text", value });
const em = (value: string): InlineSegment => ({ kind: "em", value });
const math = (value: string, latex = value): InlineSegment => ({ kind: "math", value, latex });
const cell = (value: string, extra: Partial<Cell> = {}): Cell => ({ text: value, ...extra });
const mathCell = (value: string, latex: string, extra: Partial<Cell> = {}): Cell => ({ text: value, latex, ...extra });
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
    listMarker?: "bullet" | "dash" | "none",
    listLevel?: number,
): Promise<UnitBlock> {
    const inline = typeof value === "string" ? undefined : value;
    const normalized = typeof value === "string" ? value : value.map((segment) => segment.value).join("");
    const raw = await rawFor(page, target);
    return {
        blockId: uid(unit) + "#block-" + suffix,
        kind,
        origin: "official",
        ...(listMarker ? { listMarker } : {}),
        ...(listLevel !== undefined ? { listLevel } : {}),
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
                : transformations("Separati i blocchi editoriali e ripristinati pedici, apici, operatori, unità e punteggiatura verificati sul render ufficiale."),
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

async function fixThermalUnits(): Promise<void> {
    const unit354 = await readUnit("3.5.4");
    updateText(block(unit354, "3.5.4", "editorial-001"), [
        text("Il campo di temperatura sulla sezione di un elemento strutturale monodimensionale con asse longitudinale "),
        math("x"),
        text(" può essere in generale descritto mediante:"),
    ]);
    updateText(block(unit354, "3.5.4", "editorial-002"), [
        text("a) la componente uniforme "), math("ΔTu = T − T0", "\\Delta T_u=T-T_0"),
        text(" pari alla differenza tra la temperatura media attuale "), math("T"),
        text(" e quella iniziale alla data della costruzione "), math("T0", "T_0"), text(";"),
    ]);
    updateText(block(unit354, "3.5.4", "editorial-003"), [
        text("b) le componenti variabili con legge lineare secondo gli assi principali "), math("y"), text(" e "), math("z"),
        text(" della sezione, "), math("ΔTMy", "\\Delta T_{My}"), text(" e "), math("ΔTMz", "\\Delta T_{Mz}"), text("."),
    ]);
    updateText(block(unit354, "3.5.4", "editorial-005"), [
        text("La temperatura media attuale "), math("T"),
        text(" può essere valutata come media tra la temperatura della superficie esterna "), math("Tsup,est", "T_{sup,est}"),
        text(" e quella della superficie interna dell’elemento considerato, "), math("Tsup,int", "T_{sup,int}"), text("."),
    ]);
    updateText(block(unit354, "3.5.4", "editorial-006"), [
        text("Le temperature della superficie esterna, "), math("Tsup,est", "T_{sup,est}"),
        text(", e quella della superficie interna "), math("Tsup,int", "T_{sup,int}"),
        text(", dell’elemento considerato vengono valutate a partire dalla temperatura dell’aria esterna, "), math("Test", "T_{est}"),
        text(", e di quella interna, "), math("Tint", "T_{int}"),
        text(", tenendo conto del trasferimento di calore per irraggiamento e per convezione all’interfaccia aria-costruzione e della eventuale presenza di materiale isolante (vedi Fig. 3.5.2)."),
    ]);
    updateText(block(unit354, "3.5.4", "editorial-007"), [
        text("In mancanza di determinazioni più precise, la temperatura iniziale può essere assunta "),
        math("T0=15 °C", "T_0=15\\,{}^\\circ\\mathrm{C}"), text("."),
    ]);
    await writeUnit("3.5.4", unit354);

    const unit355 = await readUnit("3.5.5");
    updateText(block(unit355, "3.5.5", "editorial-001"), [
        text("Nel caso in cui la temperatura non costituisca azione fondamentale per la sicurezza o per la efficienza funzionale della struttura è consentito tener conto, per gli edifici, della sola componente "),
        math("ΔTu", "\\Delta T_u"), text(", ricavandola direttamente dalla Tab. 3.5.II."),
    ]);
    updateText(block(unit355, "3.5.5", "editorial-002"), [
        text("Nel caso in cui la temperatura costituisca, invece, azione fondamentale per la sicurezza o per la efficienza funzionale della struttura, l’andamento della temperatura "),
        math("T"), text(" nelle sezioni degli elementi strutturali deve essere valutato più approfonditamente studiando il problema della trasmissione del calore."),
    ]);
    unit355.blocks = [
        block(unit355, "3.5.5", "heading"),
        block(unit355, "3.5.5", "editorial-001"),
        block(unit355, "3.5.5", "editorial-002"),
        await assetRef("3.5.5", "editorial-003", "table-ref", tableId("3.5.II"), 65, region(78, 607, 285, 72)),
    ];
    unit355.assets.tableIds = [tableId("3.5.II")];
    await writeUnit("3.5.5", unit355);

    const unit357 = await readUnit("3.5.7");
    updateText(block(unit357, "3.5.7", "editorial-001"), [
        text("Per la valutazione degli effetti delle azioni termiche, si può fare riferimento ai coefficienti di dilatazione termica a temperatura ambiente "),
        math("αT", "\\alpha_T"), text(" riportati in Tab. 3.5.III."),
    ]);
    unit357.blocks = [
        block(unit357, "3.5.7", "heading"),
        block(unit357, "3.5.7", "editorial-001"),
        await assetRef("3.5.7", "editorial-002", "table-ref", tableId("3.5.III"), 66, region(78, 130, 285, 105)),
    ];
    unit357.assets.tableIds = [tableId("3.5.III")];
    await writeUnit("3.5.7", unit357);
}

async function rebuildFireDefinitions(): Promise<void> {
    const number = "3.6.1.1";
    const unit = await readUnit(number);
    const openingBlocks = unit.blocks.slice(0, 4);
    const firstOpeningBlock = openingBlocks[1];
    const secondOpeningBlock = openingBlocks[2];
    if (!firstOpeningBlock || !secondOpeningBlock) throw new Error(`Blocchi introduttivi mancanti per ${number}`);
    updateText(firstOpeningBlock, [
        text("Per "), em("incendio"), text(", si intende la combustione autoalimentata ed incontrollata di materiali combustibili presenti in un compartimento."),
    ]);
    updateText(secondOpeningBlock, [
        text("Ai fini della presente norma si fa riferimento ad un "), em("incendio convenzionale di progetto"),
        text(" definito attraverso una "), em("curva di incendio"),
        text(" che rappresenta l’andamento, in funzione del tempo, della temperatura media dei gas di combustione nell’intorno della superficie degli elementi strutturali."),
    ]);
    unit.blocks = [
        ...openingBlocks,
        await textBlock(number, "editorial-004", "list-item", 66, region(78, 490, 440, 10), [
            em("nominale"), text(": curva adottata per la classificazione delle costruzioni e per le verifiche di resistenza al fuoco di tipo convenzionale;"),
        ], "none"),
        await textBlock(number, "editorial-004-b", "list-item", 66, region(78, 503, 440, 22), [
            em("naturale"), text(": curva determinata in base a modelli d’incendio e a parametri fisici che definiscono le variabili di stato all’interno del compartimento."),
        ], "none"),
        await textBlock(number, "editorial-005", "paragraph", 66, region(78, 526, 441, 30), [
            text("La "), em("capacità di compartimentazione"), text(" in caso di incendio è l’attitudine di un elemento costruttivo a conservare, sotto l’azione del fuoco, oltre alla propria stabilità, un sufficiente isolamento termico ed una sufficiente tenuta ai fumi ed ai gas caldi della combustione, nonché tutte le altre prestazioni se richieste."),
        ]),
        await textBlock(number, "editorial-006", "paragraph", 66, region(78, 560, 441, 22), [
            text("La "), em("capacità portante in caso di incendio"), text(" è l’attitudine di una struttura, di una parte della struttura o di un elemento strutturale a conservare una sufficiente resistenza meccanica sotto l’azione del fuoco con riferimento alle altre azioni agenti."),
        ]),
        await textBlock(number, "editorial-007", "paragraph", 66, region(78, 583, 441, 29), [
            text("La "), em("resistenza al fuoco"), text(" riguarda la capacità portante in caso di incendio per una struttura, per una parte della struttura o per un elemento strutturale nonché la capacità di compartimentazione rispetto all’incendio per gli elementi di separazione sia strutturali, come muri e solai, sia non strutturali, come porte e tramezzi."),
        ]),
        await textBlock(number, "editorial-008", "paragraph", 66, region(78, 617, 441, 21), [
            text("Per "), em("compartimento antincendio"), text(" si intende una parte della costruzione delimitata da elementi costruttivi idonei a garantire, sotto l’azione del fuoco e per un dato intervallo di tempo, la capacità di compartimentazione."),
        ]),
        await textBlock(number, "editorial-009", "paragraph", 66, region(78, 640, 441, 19), [
            text("Per "), em("carico di incendio"), text(" si intende il potenziale termico netto della totalità dei materiali combustibili contenuti in uno spazio, corretto in base ai parametri indicativi della partecipazione alla combustione dei singoli materiali."),
        ]),
        await textBlock(number, "editorial-010", "paragraph", 66, region(78, 664, 441, 9), [
            text("Per "), em("carico d’incendio specifico"), text(" si intende il carico di incendio riferito all’unità di superficie lorda."),
        ]),
        await textBlock(number, "editorial-011", "paragraph", 66, region(78, 677, 441, 20), [
            text("Per "), em("carico di incendio specifico di progetto"), text(" si intende il carico di incendio specifico corretto in base ai parametri indicatori del rischio di incendio del compartimento e dei fattori relativi alle misure di protezione presenti."),
        ]),
        await textBlock(number, "editorial-012", "paragraph", 66, region(78, 690, 440, 16), [
            text("I valori del carico d’incendio specifico di progetto ("), math("qf,d", "q_{f,d}"),
            text(") sono determinati mediante la relazione:"),
        ]),
        await assetRef(number, "editorial-013", "formula-ref", formulaId("3.6.1"), 66, region(155, 704, 220, 22)),
        await textBlock(number, "editorial-014", "paragraph", 67, region(83, 92, 45, 10), "dove:"),
        await textBlock(number, "editorial-015", "list-item", 67, region(83, 99, 430, 14), [
            math("qf", "q_f"), text(" è il valore nominale del carico d’incendio ["), math("MJ/m²", "\\mathrm{MJ/m^2}"), text("]."),
        ], "none"),
        await textBlock(number, "editorial-016", "list-item", 67, region(83, 113, 430, 22), [
            math("δq1 ≥ 1,00", "\\delta_{q1}\\ge1{,}00"), text(" è un fattore che tiene conto del rischio di incendio in relazione alla superficie del compartimento"),
        ], "none"),
        await textBlock(number, "editorial-017", "list-item", 67, region(83, 136, 430, 22), [
            math("δq2 ≥ 0,80", "\\delta_{q2}\\ge0{,}80"), text(" è un fattore che tiene conto del rischio di incendio in relazione al tipo di attività svolta nel compartimento"),
        ], "none"),
        await textBlock(number, "editorial-018", "list-item", 67, region(83, 158, 430, 28), [
            math("δn = ∏i=1^10 δni ≥ 0,20", "\\delta_n=\\prod_{i=1}^{10}\\delta_{ni}\\ge0{,}20"),
            text(" è un fattore che tiene conto delle differenti misure di protezione dall’incendio (sistemi automatici di estinzione, rivelatori, rete idranti, squadre antincendio, ecc.)"),
        ], "none"),
        await textBlock(number, "editorial-019", "paragraph", 67, region(83, 202, 430, 48), [
            text("Qualora nel compartimento siano presenti elevate dissimmetrie nella distribuzione dei materiali combustibili il valore nominale "),
            math("qf", "q_f"),
            text(" del carico d’incendio è calcolato anche con riferimento all’effettiva distribuzione dello stesso. Per distribuzioni molto concentrate del materiale combustibile si può fare riferimento all’"),
            em("incendio localizzato"),
            text(", valutando, in ogni caso, se si hanno le condizioni per lo sviluppo di un incendio generalizzato. Le indicazioni per il calcolo del carico di incendio specifico di progetto sono fornite nel decreto del Ministro dell’Interno 9 marzo 2007 e ss.mm.ii."),
        ]),
        await textBlock(number, "editorial-020", "paragraph", 67, region(83, 256, 430, 28), "Per incendio localizzato deve intendersi un focolaio d’incendio che interessa una zona limitata del compartimento antincendio, con sviluppo di calore concentrato in prossimità degli elementi strutturali posti superiormente al focolaio o immediatamente adiacenti."),
        await textBlock(number, "editorial-021", "paragraph", 67, region(83, 289, 430, 22), "Nel caso di presenza di elementi strutturali lignei è possibile considerare solo una quota parte del loro contributo alla determinazione del carico di incendio, da definire con riferimento a riconosciute normative o documenti di comprovata validità."),
    ];
    unit.assets.formulaIds = [formulaId("3.6.1")];
    await writeUnit(number, unit);

    const unit3612 = await readUnit("3.6.1.2");
    unit3612.blocks = [
        block(unit3612, "3.6.1.2", "heading"),
        block(unit3612, "3.6.1.2", "editorial-001"),
        await assetRef("3.6.1.2", "editorial-002", "table-ref", tableId("3.5.IV"), 67, region(83, 365, 290, 122)),
        block(unit3612, "3.6.1.2", "editorial-003"),
        block(unit3612, "3.6.1.2", "editorial-004"),
    ];
    unit3612.assets.tableIds = [tableId("3.5.IV")];
    await writeUnit("3.6.1.2", unit3612);
}

async function rebuildFireCurves(): Promise<void> {
    const number = "3.6.1.5.1";
    const unit = await readUnit(number);
    unit.blocks = [
        block(unit, number, "heading"),
        await textBlock(number, "editorial-001", "paragraph", 68, region(81, 162, 434, 24), "Secondo l’incendio convenzionale di progetto adottato, l’andamento delle temperature viene valutato con riferimento a una delle due seguenti condizioni:"),
        await textBlock(number, "editorial-002", "list-item", 68, region(90, 188, 425, 25), "curva nominale d’incendio, da individuare tra quelle indicate successivamente, per l’intervallo di tempo di esposizione pari alla classe di resistenza al fuoco prevista, senza alcuna fase di raffreddamento,"),
        await textBlock(number, "editorial-003", "list-item", 68, region(90, 211, 425, 25), "curva naturale d’incendio, da individuare tenendo conto dell’intera durata dello stesso, compresa la fase di raffreddamento fino al ritorno alla temperatura ambiente."),
        await textBlock(number, "editorial-004", "paragraph", 68, region(81, 235, 434, 17), "Nel caso di incendio di materiali combustibili prevalentemente di natura cellulosica, la curva di incendio nominale di riferimento è la curva di incendio nominale standard definita come segue:"),
        await assetRef(number, "editorial-005", "formula-ref", formulaId("3.6.2"), 68, region(150, 244, 220, 20)),
        await textBlock(number, "editorial-006", "paragraph", 68, region(81, 262, 434, 13), [
            text("dove "), math("θg", "\\theta_g"), text(" è la temperatura dei gas caldi, espressa in "), math("°C", "{}^\\circ\\mathrm{C}"),
            text(", e "), math("t"), text(" è il tempo espresso in minuti primi."),
        ]),
        await textBlock(number, "editorial-007", "paragraph", 68, region(81, 276, 434, 19), [
            text("Nel caso di incendi di quantità rilevanti di idrocarburi o altre sostanze con equivalente velocità di rilascio termico, la curva di incendio nominale standard può essere sostituita con la "),
            em("curva nominale degli idrocarburi"), text(" seguente:"),
        ]),
        await assetRef(number, "editorial-008", "formula-ref", formulaId("3.6.3"), 68, region(125, 296, 245, 18)),
        await textBlock(number, "editorial-009", "paragraph", 68, region(81, 314, 434, 18), [
            text("Nel caso di incendi sviluppatisi all’interno del compartimento, ma che coinvolgono strutture poste all’esterno, per queste ultime la curva di incendio nominale standard può essere sostituita con la "),
            em("curva nominale esterna"), text(" seguente:"),
        ]),
        await assetRef(number, "editorial-010", "formula-ref", formulaId("3.6.4"), 68, region(125, 334, 245, 18)),
        await textBlock(number, "editorial-011", "paragraph", 68, region(81, 352, 434, 13), "Gli incendi convenzionali di progetto vengono generalmente applicati ad un compartimento dell’edificio alla volta."),
        await textBlock(number, "editorial-012", "paragraph", 68, region(81, 365, 434, 17), "Sono ammesse altresì specifiche curve nominali, per descrivere particolari scenari di incendio (tunnel curve, slow heating curve, ecc.), purché di comprovata validità."),
    ];
    unit.assets.formulaIds = ["3.6.2", "3.6.3", "3.6.4"].map(formulaId);
    await writeUnit(number, unit);
}

async function rebuildExplosionUnits(): Promise<void> {
    const unit3622 = await readUnit("3.6.2.2");
    unit3622.blocks = [
        block(unit3622, "3.6.2.2", "heading"),
        block(unit3622, "3.6.2.2", "editorial-001"),
        await assetRef("3.6.2.2", "editorial-002", "table-ref", tableId("3.6.I"), 69, region(70, 218, 300, 55)),
    ];
    unit3622.assets.tableIds = [tableId("3.6.I")];
    await writeUnit("3.6.2.2", unit3622);

    const number = "3.6.2.3";
    const unit = await readUnit(number);
    unit.blocks = [
        block(unit, number, "heading"),
        await textBlock(number, "editorial-001", "paragraph", 69, region(70, 294, 454, 21), "Le esplosioni esercitano sulle costruzioni onde di pressione. Per le costruzioni usuali, è ammesso che tali onde di pressione siano convenzionalmente ricondotte a distribuzioni di pressioni statiche equivalenti, purché comprovate da modelli teorici adeguati."),
        await textBlock(number, "editorial-002", "paragraph", 69, region(70, 318, 454, 12), "Per esplosioni di Categoria 1 non è richiesto alcun tipo di verifica."),
        await textBlock(number, "editorial-003", "paragraph", 69, region(70, 331, 454, 19), [
            text("Per esplosioni di Categoria 2, ove negli ambienti a rischio di esplosione siano presenti idonei pannelli di sfogo, si può utilizzare la pressione statica equivalente nominale, espressa in "),
            math("kN/m²", "\\mathrm{kN/m^2}"), text(", data dal valore maggiore fra quelli forniti dalle espressioni:"),
        ]),
        await assetRef(number, "editorial-004", "formula-ref", formulaId("3.6.5a"), 69, region(135, 351, 235, 16)),
        await assetRef(number, "editorial-005", "formula-ref", formulaId("3.6.5b"), 69, region(120, 366, 250, 17)),
        await textBlock(number, "editorial-006", "paragraph", 69, region(70, 382, 454, 11), "dove:"),
        await textBlock(number, "editorial-007", "paragraph", 69, region(70, 394, 454, 14), [
            math("pv", "p_v"), text(" è la pressione statica uniformemente distribuita in corrispondenza della quale le aperture di sfogo cedono, in "), math("kN/m²", "\\mathrm{kN/m^2}"),
        ]),
        await textBlock(number, "editorial-008", "paragraph", 69, region(70, 409, 454, 12), [
            math("Av", "A_v"), text(" è l’area delle aperture di sfogo, in "), math("m²", "\\mathrm{m^2}"),
        ]),
        await textBlock(number, "editorial-009", "paragraph", 69, region(70, 422, 454, 12), [
            math("V"), text(" è il volume dell’ambiente, in "), math("m³", "\\mathrm{m^3}"),
        ]),
        await textBlock(number, "editorial-010", "paragraph", 69, region(70, 436, 454, 13), "Il rapporto fra l’area dei componenti di sfogo e il volume da proteggere deve soddisfare la relazione:"),
        await assetRef(number, "editorial-011", "formula-ref", formulaId("3.6.6"), 69, region(130, 449, 240, 20)),
        await textBlock(number, "editorial-012", "paragraph", 69, region(70, 471, 454, 13), [
            text("Queste espressioni sono valide in ambienti o in zone di edifici il cui volume totale non superi "), math("1.000 m³", "1000\\,\\mathrm{m^3}"), text("."),
        ]),
        await textBlock(number, "editorial-013", "paragraph", 69, region(70, 484, 454, 20), "La pressione dovuta all’esplosione è intesa agire simultaneamente su tutte le pareti dell’ambiente o del gruppo di ambienti considerati."),
        await textBlock(number, "editorial-014", "paragraph", 69, region(70, 508, 454, 43), [
            text("Comunque, tutti gli elementi chiave e le loro connessioni devono essere progettati per sopportare una pressione statica equivalente con valore di progetto "),
            math("pd = 20 kN/m²", "p_d=20\\,\\mathrm{kN/m^2}"),
            text(", applicata da ogni direzione, insieme con la reazione che ci si attende venga trasmessa direttamente alle membrature dell’elemento chiave da ogni elemento costruttivo, ad esso collegato, altresì soggetto alla stessa pressione."),
        ]),
        await textBlock(number, "editorial-015", "paragraph", 69, region(70, 554, 454, 13), "Per esplosioni di Categoria 3 devono essere effettuati studi più approfonditi."),
    ];
    unit.assets.formulaIds = ["3.6.5a", "3.6.5b", "3.6.6"].map(formulaId);
    await writeUnit(number, unit);
}

async function rebuildImpactUnits(): Promise<void> {
    const unit3632 = await readUnit("3.6.3.2");
    unit3632.blocks = [
        block(unit3632, "3.6.3.2", "heading"),
        await textBlock("3.6.3.2", "editorial-001", "paragraph", 70, region(69, 196, 456, 22), "Le azioni di progetto dovute agli urti sono classificate, sulla base degli effetti che possono produrre sulle costruzioni, in tre categorie, come indicato nella Tab. 3.6.II."),
        await assetRef("3.6.3.2", "editorial-002", "table-ref", tableId("3.6.II"), 70, region(69, 225, 305, 58)),
        await textBlock("3.6.3.2", "editorial-003", "paragraph", 70, region(69, 288, 456, 20), "Le azioni dovute agli urti devono essere applicate a quegli elementi strutturali, o ai loro sistemi di protezione, per i quali le relative conseguenze appartengono alle categorie 2 e 3."),
    ];
    unit3632.assets.tableIds = [tableId("3.6.II")];
    await writeUnit("3.6.3.2", unit3632);

    const number = "3.6.3.3.1";
    const unit = await readUnit(number);
    unit.blocks = [
        block(unit, number, "heading"),
        await textBlock(number, "editorial-001", "paragraph", 70, region(69, 351, 456, 25), [
            text("Le azioni da urto hanno direzione parallela a quella del moto del veicolo al momento dell’impatto. Nelle verifiche si possono considerare, non simultaneamente, due azioni nelle direzioni parallela ("),
            math("Fd,x", "F_{d,x}"), text(") e ortogonale ("), math("Fd,y", "F_{d,y}"), text(") alla direzione di marcia normale, con"),
        ]),
        await assetRef(number, "editorial-002", "formula-ref", formulaId("3.6.7"), 70, region(145, 378, 230, 16)),
        await textBlock(number, "editorial-003", "paragraph", 70, region(69, 390, 456, 22), "In assenza di determinazioni più accurate e trascurando la capacità dissipativa della struttura, si possono adottare le forze statiche equivalenti riportate in Tab. 3.6.III."),
        await assetRef(number, "editorial-004", "table-ref", tableId("3.6.III"), 70, region(69, 416, 305, 101)),
        await textBlock(number, "editorial-005", "paragraph", 70, region(69, 525, 456, 28), [
            text("Per urti di automobili su membrature verticali, la forza risultante di collisione "), math("F"),
            text(" deve essere applicata sulla struttura "), math("0,5 m", "0{,}5\\,\\mathrm{m}"),
            text(" al di sopra della superficie di marcia. L’area di applicazione della forza è pari a "), math("0,25 m", "0{,}25\\,\\mathrm{m}"),
            text(" (in altezza) per il valore più piccolo tra "), math("1,50 m", "1{,}50\\,\\mathrm{m}"), text(" e la larghezza della membratura (in larghezza)."),
        ]),
        await textBlock(number, "editorial-006", "paragraph", 70, region(69, 557, 456, 28), [
            text("Per urti sulle membrature verticali, la forza risultante di collisione "), math("F"),
            text(" deve essere applicata sulla struttura "), math("1,25 m", "1{,}25\\,\\mathrm{m}"),
            text(" al di sopra della superficie di marcia. L’area di applicazione della forza è pari a "), math("0,5 m", "0{,}5\\,\\mathrm{m}"),
            text(" (in altezza) per il valore più piccolo tra "), math("1,50 m", "1{,}50\\,\\mathrm{m}"), text(" e la larghezza della membratura (in larghezza)."),
        ]),
        await textBlock(number, "editorial-007", "paragraph", 70, region(69, 589, 456, 18), [
            text("Nel caso di urti su elementi strutturali orizzontali al di sopra della strada, la forza risultante di collisione "), math("F"),
            text(" da utilizzare per le verifiche dell’equilibrio statico o della resistenza o della capacità di deformazione degli elementi strutturali è data da:"),
        ]),
        await assetRef(number, "editorial-008", "formula-ref", formulaId("3.6.8"), 70, region(145, 608, 230, 17)),
        await textBlock(number, "editorial-009", "paragraph", 70, region(69, 621, 456, 18), [
            text("dove il fattore "), math("r"), text(" è pari ad "), math("1,0", "1{,}0"),
            text(" per altezze del sottovia fino a "), math("5 m", "5\\,\\mathrm{m}"),
            text(", decresce linearmente da "), math("1,0", "1{,}0"), text(" a "), math("0"),
            text(" per altezze comprese fra "), math("5 e 6 m", "5\\,\\mathrm{m}\\text{ e }6\\,\\mathrm{m}"),
            text(" ed è pari a "), math("0"), text(" per altezze superiori a "), math("6 m", "6\\,\\mathrm{m}"),
            text(". La forza "), math("F"), text(" è applicata sulle superfici verticali (prospetto dell’elemento strutturale)."),
        ]),
        await textBlock(number, "editorial-010", "paragraph", 70, region(69, 643, 456, 18), [
            text("Sull’intradosso dell’elemento strutturale si devono considerare gli stessi carichi da urto "), math("F"),
            text(" di cui sopra, con un’inclinazione rispetto all’orizzontale di "), math("10°", "10^\\circ"), text(" verso l’alto."),
        ]),
        await textBlock(number, "editorial-011", "paragraph", 70, region(69, 665, 456, 13), [
            text("L’area di applicazione della forza è assunta pari a "), math("0,25 per 0,25 m", "0{,}25\\,\\mathrm{m}\\times0{,}25\\,\\mathrm{m}"), text("."),
        ]),
        await textBlock(number, "editorial-012", "paragraph", 70, region(69, 677, 456, 20), "Nelle costruzioni dove sono presenti con regolarità carrelli elevatori si può considerare equivalente agli urti accidentali un’azione orizzontale statica, applicata all’altezza di 0,75 m dal piano di calpestio, pari a"),
        await assetRef(number, "editorial-013", "formula-ref", formulaId("3.6.9"), 70, region(145, 696, 230, 17)),
        await textBlock(number, "editorial-014", "paragraph", 70, region(69, 709, 456, 13), [
            text("essendo "), math("W"), text(" il peso complessivo del carrello elevatore e del massimo carico trasportabile."),
        ]),
    ];
    unit.assets.formulaIds = ["3.6.7", "3.6.8", "3.6.9"].map(formulaId);
    unit.assets.tableIds = [tableId("3.6.III")];
    await writeUnit(number, unit);

    const unit36332 = await readUnit("3.6.3.3.2");
    updateText(block(unit36332, "3.6.3.3.2", "editorial-001"), [
        text("In assenza di specifiche prescrizioni, nel progetto strutturale dei ponti si può tener conto delle forze causate da collisioni accidentali sugli elementi di sicurezza attraverso una forza orizzontale equivalente di collisione pari a "),
        math("100 kN", "100\\,\\mathrm{kN}"),
        text(". Essa rappresenta l’effetto dell’impatto da trasmettere ai vincoli e deve essere considerata agente trasversalmente ed orizzontalmente "),
        math("100 mm", "100\\,\\mathrm{mm}"), text(" sotto la sommità dell’elemento o "), math("1,0 m", "1{,}0\\,\\mathrm{m}"),
        text(" sopra il livello del piano di marcia, a seconda di quale valore sia più piccolo."),
    ]);
    await writeUnit("3.6.3.3.2", unit36332);

    const unit3634 = await readUnit("3.6.3.4");
    unit3634.blocks = [
        block(unit3634, "3.6.3.4", "heading"),
        block(unit3634, "3.6.3.4", "editorial-001"),
        block(unit3634, "3.6.3.4", "editorial-002"),
        block(unit3634, "3.6.3.4", "editorial-003"),
        await textBlock("3.6.3.4", "editorial-004", "paragraph", 71, region(72, 271, 450, 17), [
            text("In mancanza di specifiche analisi di rischio possono assumersi le seguenti azioni statiche equivalenti, in funzione della distanza "),
            math("d"), text(" degli elementi esposti dall’asse del binario:"),
        ]),
        await textBlock("3.6.3.4", "editorial-005", "list-item", 71, region(83, 294, 430, 12), [text("per "), math("d ≤ 5 m", "d\\le5\\,\\mathrm{m}"), text(":"),], "bullet", 0),
        await textBlock("3.6.3.4", "editorial-006", "list-item", 71, region(95, 305, 420, 13), [math("4000 kN", "4000\\,\\mathrm{kN}"), text(" in direzione parallela alla direzione di marcia dei convogli ferroviari;"),], "dash", 1),
        await textBlock("3.6.3.4", "editorial-007", "list-item", 71, region(95, 318, 420, 13), [math("1500 kN", "1500\\,\\mathrm{kN}"), text(" in direzione perpendicolare alla direzione di marcia dei convogli ferroviari;"),], "dash", 1),
        await textBlock("3.6.3.4", "editorial-008", "list-item", 71, region(83, 332, 430, 12), [text("per "), math("5 m < d ≤ 15 m", "5\\,\\mathrm{m}<d\\le15\\,\\mathrm{m}"), text(":"),], "bullet", 0),
        await textBlock("3.6.3.4", "editorial-009", "list-item", 71, region(95, 342, 420, 13), [math("2000 kN", "2000\\,\\mathrm{kN}"), text(" in direzione parallela alla direzione di marcia dei convogli ferroviari;"),], "dash", 1),
        await textBlock("3.6.3.4", "editorial-010", "list-item", 71, region(95, 356, 420, 13), [math("750 kN", "750\\,\\mathrm{kN}"), text(" in direzione perpendicolare alla direzione di marcia dei convogli ferroviari;"),], "dash", 1),
        await textBlock("3.6.3.4", "editorial-011", "list-item", 71, region(83, 369, 430, 13), [text("per "), math("d > 15 m", "d>15\\,\\mathrm{m}"), text(" pari a zero in entrambe le direzioni."),], "bullet", 0),
        await textBlock("3.6.3.4", "editorial-012", "paragraph", 71, region(72, 382, 450, 14), [
            text("Queste forze dovranno essere applicate a "), math("1,80 m", "1{,}80\\,\\mathrm{m}"), text(" dal piano del ferro e non dovranno essere considerate agenti simultaneamente."),
        ]),
    ];
    await writeUnit("3.6.3.4", unit3634);
}

const tables = [
    {
        id: tableId("3.5.I"), unitId: uid("3.5.4"), officialNumber: "3.5.I", pdfPage: 65,
        caption: "Tabella 3.5.I - Contributo dell’irraggiamento solare", columnCount: 4,
        headers: [
            [cell("Stagione", { rowSpan: 2 }), cell("Natura della superficie", { rowSpan: 2 }), cell("Incremento di Temperatura", { colSpan: 2 })],
            [cell("superfici esposte\na Nord-Est"), cell("superfici esposte a Sud-Ovest\nod orizzontali")],
        ],
        rows: [
            [cell("Estate", { rowSpan: 3 }), cell("Superficie riflettente"), mathCell("0 °C", "0\\,{}^\\circ\\mathrm{C}", { align: "center" }), mathCell("18 °C", "18\\,{}^\\circ\\mathrm{C}", { align: "center" })],
            [cell("Superficie chiara"), mathCell("2 °C", "2\\,{}^\\circ\\mathrm{C}", { align: "center" }), mathCell("30 °C", "30\\,{}^\\circ\\mathrm{C}", { align: "center" })],
            [cell("Superficie scura"), mathCell("4 °C", "4\\,{}^\\circ\\mathrm{C}", { align: "center" }), mathCell("42 °C", "42\\,{}^\\circ\\mathrm{C}", { align: "center" })],
            [cell("Inverno", { colSpan: 2 }), mathCell("0 °C", "0\\,{}^\\circ\\mathrm{C}", { align: "center" }), mathCell("0 °C", "0\\,{}^\\circ\\mathrm{C}", { align: "center" })],
        ], notes: [],
    },
    {
        id: tableId("3.5.II"), unitId: uid("3.5.5"), officialNumber: "3.5.II", pdfPage: 65,
        caption: "Tabella 3.5.II - Valori di ΔTu per gli edifici", columnCount: 2,
        headers: [[cell("Tipo di struttura"), mathCell("ΔTu", "\\Delta T_u", { align: "center" })]],
        rows: [
            [cell("Strutture in c.a. e c.a.p. esposte"), mathCell("± 15 °C", "\\pm15\\,{}^\\circ\\mathrm{C}", { align: "center" })],
            [cell("Strutture in c.a. e c.a.p. protette"), mathCell("± 10 °C", "\\pm10\\,{}^\\circ\\mathrm{C}", { align: "center" })],
            [cell("Strutture in acciaio esposte"), mathCell("± 25 °C", "\\pm25\\,{}^\\circ\\mathrm{C}", { align: "center" })],
            [cell("Strutture in acciaio protette"), mathCell("± 15 °C", "\\pm15\\,{}^\\circ\\mathrm{C}", { align: "center" })],
        ], notes: [],
    },
    {
        id: tableId("3.5.III"), unitId: uid("3.5.7"), officialNumber: "3.5.III", pdfPage: 66,
        caption: "Tabella 3.5.III - Coefficienti di dilatazione termica a temperatura ambiente", columnCount: 2,
        headers: [[cell("Materiale"), mathCell("αT [10⁻⁶/°C]", "\\alpha_T\\,[10^{-6}/{}^\\circ\\mathrm{C}]", { align: "center" })]],
        rows: [
            [cell("Alluminio"), cell("24", { align: "center" })], [cell("Acciaio da carpenteria"), cell("12", { align: "center" })],
            [cell("Calcestruzzo strutturale"), cell("10", { align: "center" })], [cell("Strutture miste acciaio-calcestruzzo"), cell("12", { align: "center" })],
            [cell("Calcestruzzo alleggerito"), cell("7", { align: "center" })], [cell("Muratura"), mathCell("6 ÷ 10", "6\\div10", { align: "center" })],
            [cell("Legno (parallelo alle fibre)"), cell("5", { align: "center" })], [cell("Legno (ortogonale alle fibre)"), mathCell("30 ÷ 70", "30\\div70", { align: "center" })],
        ], notes: [],
    },
    {
        id: tableId("3.5.IV"), unitId: uid("3.6.1.2"), officialNumber: "3.5.IV", pdfPage: 67,
        caption: "Tabella 3.5.IV - Livelli di prestazione in caso di incendi", columnCount: 2, headers: [],
        rows: [
            [cell("Livello I"), cell("Nessun requisito specifico di resistenza al fuoco dove le conseguenze del collasso delle strutture siano accettabili o dove il rischio di incendio sia trascurabile;")],
            [cell("Livello II"), cell("Mantenimento dei requisiti di resistenza al fuoco delle strutture per un periodo sufficiente a garantire l’evacuazione degli occupanti in luogo sicuro all’esterno della costruzione;")],
            [cell("Livello III"), cell("Mantenimento dei requisiti di resistenza al fuoco delle strutture per un periodo congruo con la gestione dell’emergenza;")],
            [cell("Livello IV"), cell("Requisiti di resistenza al fuoco delle strutture per garantire, dopo la fine dell’incendio, un limitato danneggiamento delle strutture stesse;")],
            [cell("Livello V"), cell("Requisiti di resistenza al fuoco delle strutture per garantire, dopo la fine dell’incendio, il mantenimento della totale funzionalità delle strutture stesse.")],
        ], notes: [],
    },
    {
        id: tableId("3.6.I"), unitId: uid("3.6.2.2"), officialNumber: "3.6.I", pdfPage: 69,
        caption: "Tabella 3.6.I - Categorie di azione dovute alle esplosioni", columnCount: 2,
        headers: [[cell("Categoria di azione", { align: "center" }), cell("Possibili effetti")]],
        rows: [[cell("1", { align: "center" }), cell("Effetti trascurabili sulle strutture")], [cell("2", { align: "center" }), cell("Effetti localizzati su parte delle strutture")], [cell("3", { align: "center" }), cell("Effetti generalizzati sulle strutture")]], notes: [],
    },
    {
        id: tableId("3.6.II"), unitId: uid("3.6.3.2"), officialNumber: "3.6.II", pdfPage: 70,
        caption: "Tabella 3.6.II - Categorie di azione", columnCount: 2,
        headers: [[cell("Categoria di azione", { align: "center" }), cell("Possibili effetti")]],
        rows: [[cell("1", { align: "center" }), cell("Effetti trascurabili sulle strutture")], [cell("2", { align: "center" }), cell("Effetti localizzati su parte delle strutture")], [cell("3", { align: "center" }), cell("Effetti generalizzati sulle strutture")]], notes: [],
    },
    {
        id: tableId("3.6.III"), unitId: uid("3.6.3.3.1"), officialNumber: "3.6.III", pdfPage: 70,
        caption: "Tabella 3.6.III - Forze statiche equivalenti agli urti di veicoli", columnCount: 3,
        headers: [[cell("Tipo di strada"), cell("Tipo di veicolo"), mathCell("Forza Fd,x [kN]", "F_{d,x}\\,[\\mathrm{kN}]", { align: "center" })]],
        rows: [
            [cell("Autostrade, strade extraurbane"), cell("-"), cell("1000", { align: "center" })],
            [cell("Strade locali"), cell("-"), cell("750", { align: "center" })],
            [cell("Strade urbane"), cell("-"), cell("500", { align: "center" })],
            [cell("Aree di parcheggio e autorimesse", { rowSpan: 2 }), cell("Automobili"), cell("50", { align: "center" })],
            [cell("Veicoli destinati al trasporto di merci, aventi massa massima superiore a 3,5 t"), cell("150", { align: "center" })],
        ], notes: [],
    },
];

async function rebuildTables(): Promise<void> {
    const manifest = JSON.parse(await readFile(tableManifestPath, "utf8"));
    const replacements = new Map(tables.map((table) => [table.id, table]));
    const existingIds = new Set<string>();
    manifest.tables = manifest.tables.map((table: { id: string }) => {
        existingIds.add(table.id);
        return replacements.get(table.id) ?? table;
    });
    manifest.tables.push(...tables.filter((table) => !existingIds.has(table.id)));
    await writeFile(tableManifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

await fixThermalUnits();
await rebuildFireDefinitions();
await rebuildFireCurves();
await rebuildExplosionUnits();
await rebuildImpactUnits();
await rebuildTables();
console.log("ntc3-step4: rebuilt formulas, inline math and Tables 3.5.I–IV/3.6.I–III for PDF pages 65–71");
