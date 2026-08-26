import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc7-editorial-profile-0.1.0";
const createdAt = "2026-08-10T00:00:00Z";
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetDir = join(root, "corpus", "assets", "ntc2018");

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Part = [page: number, from: number, to: number];
type UnitKind = "subparagraph";

const uid = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const fid = (name: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${name}`;
const tid = (name: string) =>
    `urn:structural-codes:it:asset:table:ntc2018:${name}`;
const reg = (
    x: number,
    y: number,
    width: number,
    height: number,
): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

const pageLines = new Map<number, string[]>();
for (let page = 220; page <= 224; page += 1) {
    const file = join(
        root,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
    pageLines.set(
        page,
        (await readFile(file, "utf8")).replace(/\r\n/gu, "\n").split("\n"),
    );
}

function rawPart(page: number, from: number, to: number): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}

function raw(parts: Part[]): string {
    return parts.map(([page, from, to]) => rawPart(page, from, to)).join("\n");
}

function autoNormalize(value: string): string {
    return value
        .replace(/\r?\n/gu, " ")
        .replace(/\s+/gu, " ")
        .replace(/^x /u, "- ")
        .replace(/\s+([,.;:])/gu, "$1")
        .replace(/^77\.3\.1\./u, "7.3.1.")
        .replace(/^77\.3\.2\./u, "7.3.2.")
        .replace(/^77\.3\.3\./u, "7.3.3.")
        .replace(/^77\.3\.3\.1/u, "7.3.3.1")
        .replace(/A NALISI/gu, "ANALISI")
        .replace(/V ALUTAZIONE/gu, "VALUTAZIONE")
        .replace(/CD[“”]A[“”]/gu, "CD “A”")
        .replace(/CD[“”]B[“”]/gu, "CD “B”")
        .replace(/CD[“”]/gu, "CD “")
        .replace(/Ώ/gu, "λ")
        .replace(/Ό/gu, "θ")
        .replace(/΅/gu, "α")
        .replace(/Ε/gu, "ξ")
        .trim();
}

function textInline(value: string): Inline[] {
    return [{ kind: "text", value }];
}

function inlineTerms(
    value: string,
    terms: Array<[value: string, latex: string]>,
): Inline[] {
    const ordered = [...terms]
        .filter(([term]) => value.includes(term))
        .sort((left, right) => right[0].length - left[0].length);
    const result: Inline[] = [];
    let cursor = 0;
    while (cursor < value.length) {
        let found:
            | { index: number; value: string; latex: string }
            | undefined;
        for (const [term, latex] of ordered) {
            let index = value.indexOf(term, cursor);
            while (index >= 0 && term.length === 1) {
                const before = index > 0 ? value[index - 1] ?? "" : "";
                const after = value[index + term.length] ?? "";
                if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) break;
                index = value.indexOf(term, index + term.length);
            }
            if (
                index >= 0 &&
                (!found ||
                    index < found.index ||
                    (index === found.index && term.length > found.value.length))
            ) {
                found = { index, value: term, latex };
            }
        }
        if (!found) {
            result.push({ kind: "text", value: value.slice(cursor) });
            break;
        }
        if (found.index > cursor) {
            result.push({
                kind: "text",
                value: value.slice(cursor, found.index),
            });
        }
        result.push({ kind: "math", value: found.value, latex: found.latex });
        cursor = found.index + found.value.length;
    }
    return result.filter(({ value: segment }) => segment.length > 0);
}

function lineRegion(page: number, from: number, to: number): Region {
    const y = Math.max(70, 65 + from * 10.35);
    const height = Math.max(8, (to - from + 1) * 10.35);
    return reg(82.954, y, 428.6, height);
}

function transformations(source: string, normalized: string, manual = false) {
    if (source === normalized) return [];
    const result: Array<{
        operation: string;
        ruleVersion: string;
        note: string;
    }> = [];
    if (source.includes("\n")) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
        });
    }
    if (manual || /[\u0000-\u001f\u007f-\u009fΏΌ΅Ε]/u.test(source)) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati numerazione, glifi, simboli e matematica confrontati con il render ufficiale.",
        });
    }
    result.push({
        operation: "normalize-whitespace",
        ruleVersion: profile,
        note: "Uniformati gli spazi dopo la ricomposizione editoriale.",
    });
    result.push({
        operation: "unicode-nfc",
        ruleVersion: profile,
        note: "Testo normalizzato in Unicode NFC.",
    });
    return result;
}

function evidence(
    page: number,
    source: string,
    normalized: string,
    region: Region | null,
    manual = false,
) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: {
            method: manual ? "manual-transcription" : "pdf-text",
            tool: manual ? "codex-source-transcription" : "pdfjs-dist",
            toolVersion: manual ? profile : "4.10.38",
        },
        transformations: transformations(source, normalized, manual),
        rawSha256: sha256OfText(source),
        normalizedSha256: sha256OfText(normalized),
    };
}

function block(
    number: string,
    suffix: string,
    kind: "heading" | "paragraph" | "list-item",
    parts: Part[],
    normalized: string,
    options: { manual?: boolean; inline?: Inline[] } = {},
) {
    const source = raw(parts);
    const firstPart = parts[0]!;
    const page = firstPart[0];
    return {
        blockId: `${uid(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: {
            raw: source,
            normalized,
            normalizationVersion: profile,
            inline: options.inline ?? textInline(normalized),
        },
        evidence: evidence(
            page,
            source,
            normalized,
            lineRegion(page, firstPart[1], firstPart[2]),
            options.manual,
        ),
    };
}

function autoBlock(
    number: string,
    suffix: string,
    kind: "paragraph" | "list-item",
    parts: Part[],
    options: { manual?: boolean; inline?: Inline[] } = {},
) {
    return block(number, suffix, kind, parts, autoNormalize(raw(parts)), options);
}

function heading(number: string, suffix: string, parts: Part[], normalized: string) {
    return block(number, suffix, "heading", parts, normalized, { manual: true });
}

function formulaBlock(
    number: string,
    suffix: string,
    page: number,
    officialNumber: string | null,
    region: Region,
) {
    const asset = fid(suffix);
    const label = officialNumber ? `[${officialNumber}]` : `[formula-${suffix}]`;
    return {
        blockId: `${uid(number)}#block-formula-${suffix.replaceAll(".", "-")}`,
        kind: "formula-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(page, label, label, region, true),
    };
}

function tableBlock(number: string, suffix: string, page: number, asset: string, region: Region) {
    const label = `Tabella ${suffix}`;
    return {
        blockId: `${uid(number)}#block-table-${suffix.replaceAll(".", "-").toLowerCase()}`,
        kind: "table-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(page, label, label, region, true),
    };
}

function cell(text: string, latex?: string, extra: Record<string, number> = {}) {
    return { text, ...(latex ? { latex } : {}), ...extra };
}

function parent(number: string): string | null {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts
        .slice(1)
        .map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(
    number: string,
    title: string,
    blocks: unknown[],
    formulas: string[] = [],
    tables: string[] = [],
) {
    const issuePrefix = `ntc2018-${number.replaceAll(".", "-")}`;
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind: "subparagraph" as UnitKind,
        numbering: {
            official: number,
            sortKey: number
                .split(".")
                .map((part) => part.padStart(3, "0"))
                .join("."),
        },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: Number(number.split(".").at(-1)),
        },
        validity: {
            from: "2018-03-22",
            to: null,
            status: "in-force",
            asOf: "2026-08-10",
        },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: formulas.map(fid),
            tableIds: tables.map(tid),
            figureIds: [],
        },
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "generator:ntc7:step2",
                kind: "script",
                toolVersion: profile,
            },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `${issuePrefix}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
                ...tables.map((table) => ({
                    issueId: `${issuePrefix}-${table}-review`,
                    type: "asset-review",
                    severity: "blocking",
                    note: "La tabella è strutturata dal render ufficiale e richiede verifica umana cella per cella.",
                })),
            ],
        },
    };
}

const table73ii = {
    id: tid("7.3.ii"),
    unitId: uid("7.3.1"),
    officialNumber: "7.3.II",
    pdfPage: 220,
    caption: "Valori massimi del valore di base q_0 del fattore di comportamento allo SLV per diverse tecniche costruttive ed in funzione della tipologia strutturale e della classe di duttilità CD",
    columnCount: 3,
    headers: [
        [cell(""), cell("q_0", "q_0", { colSpan: 2 })],
        [cell("Tipologia strutturale"), cell("CD “A”"), cell("CD “B”")],
    ],
    rows: [
        [cell("Costruzioni di calcestruzzo (§ 7.4.3.2)", undefined, { colSpan: 3 })],
        [cell("Strutture a telaio, a pareti accoppiate, miste (v. § 7.4.3.1)"), cell("4,5 α_u/α_1", "4{,}5\\,\\alpha_u/\\alpha_1"), cell("3,0 α_u/α_1", "3{,}0\\,\\alpha_u/\\alpha_1")],
        [cell("Strutture a pareti non accoppiate (v. § 7.4.3.1)"), cell("4,0 α_u/α_1", "4{,}0\\,\\alpha_u/\\alpha_1"), cell("3,0")],
        [cell("Strutture deformabili torsionalmente (v. § 7.4.3.1)"), cell("3,0"), cell("2,0")],
        [cell("Strutture a pendolo inverso (v. § 7.4.3.1)"), cell("2,0"), cell("1,5")],
        [cell("Strutture a pendolo inverso intelaiate monopiano (v. § 7.4.3.1)"), cell("3,5"), cell("2,5")],
        [cell("Costruzioni con struttura prefabbricata (§ 7.4.5.1)", undefined, { colSpan: 3 })],
        [cell("Strutture a pannelli"), cell("4,0 α_u/α_1", "4{,}0\\,\\alpha_u/\\alpha_1"), cell("3,0")],
        [cell("Strutture monolitiche a cella"), cell("3,0"), cell("2,0")],
        [cell("Strutture con pilastri incastrati e orizzontamenti incernierati"), cell("3,5"), cell("2,5")],
        [cell("Costruzioni d’acciaio (§ 7.5.2.2) e composte di acciaio-calcestruzzo (§ 7.6.2.2)", undefined, { colSpan: 3 })],
        [cell("Strutture intelaiate\nStrutture con controventi eccentrici"), cell("5,0 α_u/α_1", "5{,}0\\,\\alpha_u/\\alpha_1"), cell("4,0")],
        [cell("Strutture con controventi concentrici a diagonale tesa attiva"), cell("4,0"), cell("4,0")],
        [cell("Strutture con controventi concentrici a V"), cell("2,5"), cell("2,0")],
        [cell("Strutture a mensola o a pendolo inverso"), cell("2,0 α_u/α_1", "2{,}0\\,\\alpha_u/\\alpha_1"), cell("2,0")],
        [cell("Strutture intelaiate con controventi concentrici"), cell("4,0 α_u/α_1", "4{,}0\\,\\alpha_u/\\alpha_1"), cell("4,0")],
        [cell("Strutture intelaiate con tamponature in murature"), cell("2,0"), cell("2,0")],
        [cell("Costruzioni di legno (§ 7.7.3)", undefined, { colSpan: 3 })],
        [cell("Pannelli di parete a telaio leggero chiodati con diaframmi incollati, collegati mediante chiodi, viti e bulloni\nStrutture reticolari iperstatiche con giunti chiodati"), cell("3,0"), cell("2,0")],
        [cell("Portali iperstatici con mezzi di unione a gambo cilindrico"), cell("4,0"), cell("2,5")],
        [cell("Pannelli di parete a telaio leggero chiodati con diaframmi chiodati, collegati mediante chiodi, viti e bulloni."), cell("5,0"), cell("3,0")],
        [cell("Pannelli di tavole incollate a strati incrociati, collegati mediante chiodi, viti, bulloni\nStrutture reticolari con collegamenti a mezzo di chiodi, viti, bulloni o spinotti"), cell(""), cell("2,5")],
        [cell("Strutture cosiddette miste, con intelaiatura (sismo-resistente) in legno e tamponature non portanti"), cell(""), cell("")],
        [cell("Strutture isostatiche in genere, compresi portali isostatici con mezzi di unione a gambo cilindrico, e altre tipologie strutturali"), cell(""), cell("1,5")],
        [cell("Costruzioni di muratura (§ 7.8.1.3)", undefined, { colSpan: 3 })],
        [cell("Costruzioni di muratura ordinaria"), cell("1,75 α_u/α_1", "1{,}75\\,\\alpha_u/\\alpha_1", { colSpan: 2 })],
        [cell("Costruzioni di muratura armata"), cell("2,5 α_u/α_1", "2{,}5\\,\\alpha_u/\\alpha_1", { colSpan: 2 })],
        [cell("Costruzioni di muratura armata con progettazione in capacità"), cell("3,0 α_u/α_1", "3{,}0\\,\\alpha_u/\\alpha_1", { colSpan: 2 })],
        [cell("Costruzioni di muratura confinata"), cell("2,0 α_u/α_1", "2{,}0\\,\\alpha_u/\\alpha_1", { colSpan: 2 })],
        [cell("Costruzioni di muratura confinata con progettazione in capacità"), cell("3,0 α_u/α_1", "3{,}0\\,\\alpha_u/\\alpha_1", { colSpan: 2 })],
        [cell("Ponti (§ 7.9.2.1)", undefined, { colSpan: 3 })],
        [cell("Pile in calcestruzzo armato\n    Pile verticali inflesse\n    Elementi di sostegno inclinati inflessi"), cell("3,5 λ\n2,1 λ", "3{,}5\\,\\lambda\\\\2{,}1\\,\\lambda"), cell("1,5\n1,2")],
        [cell("Pile in acciaio:\n    Pile verticali inflesse\n    Elementi di sostegno inclinati inflessi\n    Pile con controventi concentrici\n    Pile con controventi eccentrici"), cell("3,5\n2,0\n2,5\n3,5"), cell("1,5\n1,2\n1,5\n-")],
        [cell("Spalle\n    In genere\n    Se si muovono col terreno"), cell("1,5\n1,0"), cell("1,5\n1,0")],
    ],
    notes: [],
};

const fQlim = "7.3.1-7.3.1";
const fKw = "7.3.1-kw";
const fQnd = "7.3.1-7.3.2";
const fTheta = "7.3.1-7.3.3";
const fE = "7.3.3.1-7.3.4";
const fRhoA = "7.3.3.1-7.3.5a";
const fRhoB = "7.3.3.1-7.3.5b";
const fT = "7.3.3.2-7.3.6";
const fFi = "7.3.3.2-7.3.7";
const fDe = "7.3.3.3-7.3.8";
const fMu = "7.3.3.3-7.3.9";

const units = [
    makeUnit("7.3.1", "ANALISI LINEARE O NON LINEARE", [
        heading("7.3.1", "heading", [[220, 3, 3]], "7.3.1 ANALISI LINEARE O NON LINEARE"),
        autoBlock("7.3.1", "p1", "paragraph", [[220, 4, 4]]),
        heading("7.3.1", "heading-lineare", [[220, 5, 5]], "ANALISI LINEARE"),
        block("7.3.1", "p2", "paragraph", [[220, 6, 9]], "L’analisi lineare può essere utilizzata per calcolare la domanda sismica nel caso di comportamento strutturale sia non dissipativo sia dissipativo (§ 7.2.2). In entrambi i casi, la domanda sismica è calcolata, quale che sia la modellazione utilizzata per l’azione sismica, riferendosi allo spettro di progetto (§ 3.2.3.4 e § 3.2.3.5) ottenuto, per ogni stato limite, assumendo per il fattore di comportamento q, i limiti riportati nella tabella 7.3.I con i valori dei fattori di base q_0 riportati in Tab. 7.3.II.", { manual: true, inline: inlineTerms("L’analisi lineare può essere utilizzata per calcolare la domanda sismica nel caso di comportamento strutturale sia non dissipativo sia dissipativo (§ 7.2.2). In entrambi i casi, la domanda sismica è calcolata, quale che sia la modellazione utilizzata per l’azione sismica, riferendosi allo spettro di progetto (§ 3.2.3.4 e § 3.2.3.5) ottenuto, per ogni stato limite, assumendo per il fattore di comportamento q, i limiti riportati nella tabella 7.3.I con i valori dei fattori di base q_0 riportati in Tab. 7.3.II.", [["q", "q"], ["q_0", "q_0"]]) }),
        heading("7.3.1", "heading-valori", [[220, 10, 10]], "Valori del fattore di comportamento q"),
        autoBlock("7.3.1", "p3", "paragraph", [[220, 11, 15]], { inline: inlineTerms(autoNormalize(raw([[220, 11, 15]])), [["q", "q"]]) }),
        block("7.3.1", "p4", "paragraph", [[220, 16, 18]], "Il limite superiore q_{lim} del fattore di comportamento relativo allo SLV è calcolato tramite la seguente espressione:", { manual: true, inline: inlineTerms("Il limite superiore q_{lim} del fattore di comportamento relativo allo SLV è calcolato tramite la seguente espressione:", [["q_{lim}", "q_{lim}"]]) }),
        formulaBlock("7.3.1", fQlim, 220, "7.3.1", reg(170, 255, 260, 42)),
        autoBlock("7.3.1", "p5", "paragraph", [[220, 19, 19]]),
        block("7.3.1", "p6", "paragraph", [[220, 20, 25]], "q_0 è il valore base del fattore di comportamento allo SLV, i cui massimi valori sono riportati in tabella 7.3.II in dipendenza della Classe di Duttilità, della tipologia strutturale, del coefficiente λ di cui al § 7.9.2.1 e del rapporto α_u/α_1 tra il valore dell’azione sismica per il quale si verifica la plasticizzazione in un numero di zone dissipative tale da rendere la struttura un meccanismo e quello per il quale il primo elemento strutturale raggiunge la plasticizzazione a flessione; la scelta di q_0 deve essere esplicitamente giustificata;", { manual: true, inline: inlineTerms("q_0 è il valore base del fattore di comportamento allo SLV, i cui massimi valori sono riportati in tabella 7.3.II in dipendenza della Classe di Duttilità, della tipologia strutturale, del coefficiente λ di cui al § 7.9.2.1 e del rapporto α_u/α_1 tra il valore dell’azione sismica per il quale si verifica la plasticizzazione in un numero di zone dissipative tale da rendere la struttura un meccanismo e quello per il quale il primo elemento strutturale raggiunge la plasticizzazione a flessione; la scelta di q_0 deve essere esplicitamente giustificata;", [["q_0", "q_0"], ["λ", "\\lambda"], ["α_u/α_1", "\\alpha_u/\\alpha_1"]]) }),
        block("7.3.1", "p7", "paragraph", [[220, 26, 28]], "K_R è un fattore che dipende dalle caratteristiche di regolarità in altezza della costruzione, con valore pari ad 1 per costruzioni regolari in altezza e pari a 0,8 per costruzioni non regolari in altezza.", { manual: true, inline: inlineTerms("K_R è un fattore che dipende dalle caratteristiche di regolarità in altezza della costruzione, con valore pari ad 1 per costruzioni regolari in altezza e pari a 0,8 per costruzioni non regolari in altezza.", [["K_R", "K_R"]]) }),
        tableBlock("7.3.1", "7.3.II", 220, table73ii.id, reg(78, 392, 440, 365)),
        block("7.3.1", "p8", "paragraph", [[221, 41, 45]], "Per le costruzioni regolari in pianta, qualora non si proceda ad un’analisi non lineare finalizzata alla sua valutazione, per il rapporto α_u/α_1, possono essere adottati i valori indicati nei paragrafi successivi per le diverse tipologie costruttive. Per le costruzioni non regolari in pianta, si possono adottare valori di α_u/α_1 pari alla media tra 1,0 e i valori di volta in volta forniti per le diverse tipologie costruttive.", { manual: true, inline: inlineTerms("Per le costruzioni regolari in pianta, qualora non si proceda ad un’analisi non lineare finalizzata alla sua valutazione, per il rapporto α_u/α_1, possono essere adottati i valori indicati nei paragrafi successivi per le diverse tipologie costruttive. Per le costruzioni non regolari in pianta, si possono adottare valori di α_u/α_1 pari alla media tra 1,0 e i valori di volta in volta forniti per le diverse tipologie costruttive.", [["α_u/α_1", "\\alpha_u/\\alpha_1"]]) }),
        block("7.3.1", "p9", "paragraph", [[221, 46, 48]], "Qualora nella costruzione siano presenti pareti di calcestruzzo armato, per prevenirne il collasso fragile, i valori di q_0 devono essere ridotti mediante il fattore k_w, con:", { manual: true, inline: inlineTerms("Qualora nella costruzione siano presenti pareti di calcestruzzo armato, per prevenirne il collasso fragile, i valori di q_0 devono essere ridotti mediante il fattore k_w, con:", [["q_0", "q_0"], ["k_w", "k_w"]]) }),
        formulaBlock("7.3.1", fKw, 221, null, reg(82, 430, 430, 92)),
        block("7.3.1", "p10", "paragraph", [[221, 59, 62]], "dove α_0 è il valore assunto in prevalenza dal rapporto tra altezza totale (dalle fondazioni o dalla struttura scatolare rigida di base di cui al § 7.2.1, fino alla sommità) e lunghezza delle pareti; nel caso in cui gli α_0 delle pareti non differiscano significativamente tra di loro, il valore di α_0 per l’insieme delle pareti può essere calcolato assumendo, come altezza, la somma delle altezze delle singole pareti, come lunghezza, la somma delle lunghezze.", { manual: true, inline: inlineTerms("dove α_0 è il valore assunto in prevalenza dal rapporto tra altezza totale (dalle fondazioni o dalla struttura scatolare rigida di base di cui al § 7.2.1, fino alla sommità) e lunghezza delle pareti; nel caso in cui gli α_0 delle pareti non differiscano significativamente tra di loro, il valore di α_0 per l’insieme delle pareti può essere calcolato assumendo, come altezza, la somma delle altezze delle singole pareti, come lunghezza, la somma delle lunghezze.", [["α_0", "\\alpha_0"]]) }),
        autoBlock("7.3.1", "p11", "paragraph", [[221, 63, 66]]),
        autoBlock("7.3.1", "p12", "paragraph", [[221, 67, 68]], { inline: inlineTerms(autoNormalize(raw([[221, 67, 68]])), [["q", "q"]]) }),
        block("7.3.1", "p13", "paragraph", [[221, 69, 75]], "Per le strutture a comportamento strutturale non dissipativo si adotta un fattore di comportamento q_{ND}, ridotto rispetto al valore minimo relativo alla CD “B” (Tab. 7.3.II) secondo l’espressione:", { manual: true, inline: inlineTerms("Per le strutture a comportamento strutturale non dissipativo si adotta un fattore di comportamento q_{ND}, ridotto rispetto al valore minimo relativo alla CD “B” (Tab. 7.3.II) secondo l’espressione:", [["q_{ND}", "q_{ND}"]]) }),
        formulaBlock("7.3.1", fQnd, 221, "7.3.2", reg(125, 585, 350, 48)),
        heading("7.3.1", "heading-effetti", [[221, 76, 78]], "Effetti delle non linearità geometriche"),
        block("7.3.1", "p14", "paragraph", [[221, 77, 78]], "Le non linearità geometriche sono prese in conto attraverso il fattore θ che, in assenza di più accurate determinazioni, può essere definito come:", { manual: true, inline: inlineTerms("Le non linearità geometriche sono prese in conto attraverso il fattore θ che, in assenza di più accurate determinazioni, può essere definito come:", [["θ", "\\theta"]]) }),
        formulaBlock("7.3.1", fTheta, 221, "7.3.3", reg(165, 680, 320, 50)),
        autoBlock("7.3.1", "p15", "paragraph", [[221, 84, 85]], { inline: inlineTerms(autoNormalize(raw([[221, 84, 85]])), [["P", "P"]]) }),
        block("7.3.1", "p16", "paragraph", [[222, 3, 6]], "d_{Er} è lo spostamento orizzontale medio d’interpiano allo SLV, ottenuto come differenza tra lo spostamento orizzontale dell’orizzontamento considerato e lo spostamento orizzontale dell’orizzontamento immediatamente sottostante, entrambi valutati come indicato al § 7.3.3.3;", { manual: true, inline: inlineTerms("d_{Er} è lo spostamento orizzontale medio d’interpiano allo SLV, ottenuto come differenza tra lo spostamento orizzontale dell’orizzontamento considerato e lo spostamento orizzontale dell’orizzontamento immediatamente sottostante, entrambi valutati come indicato al § 7.3.3.3;", [["d_{Er}", "d_{Er}"]]) }),
        autoBlock("7.3.1", "p17", "paragraph", [[222, 7, 8]], { inline: inlineTerms(autoNormalize(raw([[222, 7, 8]])), [["V", "V"], ["q", "q"]]) }),
        autoBlock("7.3.1", "p18", "paragraph", [[222, 9, 9]], { inline: inlineTerms(autoNormalize(raw([[222, 9, 9]])), [["h", "h"]]) }),
        autoBlock("7.3.1", "p19", "paragraph", [[222, 10, 10]]),
        autoBlock("7.3.1", "li-a", "list-item", [[222, 11, 11]], { inline: inlineTerms(autoNormalize(raw([[222, 11, 11]])), [["θ", "\\theta"]]) }),
        block("7.3.1", "li-b", "list-item", [[222, 12, 13]], "- possono essere presi in conto incrementando gli effetti dell’azione sismica orizzontale di un fattore pari a 1/(1−θ), quando θ è compreso tra 0,1 e 0,2;", { manual: true, inline: inlineTerms("- possono essere presi in conto incrementando gli effetti dell’azione sismica orizzontale di un fattore pari a 1/(1−θ), quando θ è compreso tra 0,1 e 0,2;", [["1/(1−θ)", "\\frac{1}{1-\\theta}"], ["θ", "\\theta"]]) }),
        autoBlock("7.3.1", "li-c", "list-item", [[222, 14, 14]], { inline: inlineTerms(autoNormalize(raw([[222, 14, 14]])), [["θ", "\\theta"]]) }),
        autoBlock("7.3.1", "p20", "paragraph", [[222, 15, 15]], { inline: inlineTerms(autoNormalize(raw([[222, 15, 15]])), [["θ", "\\theta"]]) }),
        heading("7.3.1", "heading-nonlineare", [[222, 16, 16]], "ANALISI NON LINEARE"),
        autoBlock("7.3.1", "p21", "paragraph", [[222, 17, 20]]),
    ], [fQlim, fKw, fQnd, fTheta], ["7.3.ii"]),
    makeUnit("7.3.2", "ANALISI DINAMICA O STATICA", [
        heading("7.3.2", "heading", [[222, 21, 21]], "7.3.2 ANALISI DINAMICA O STATICA"),
        autoBlock("7.3.2", "p1", "paragraph", [[222, 22, 23]]),
        autoBlock("7.3.2", "p2", "paragraph", [[222, 24, 26]]),
        autoBlock("7.3.2", "p3", "paragraph", [[222, 27, 28]]),
        autoBlock("7.3.2", "p4", "paragraph", [[222, 29, 32]]),
        autoBlock("7.3.2", "p5", "paragraph", [[222, 33, 34]]),
        autoBlock("7.3.2", "li-a", "list-item", [[222, 35, 35]]),
        autoBlock("7.3.2", "li-b", "list-item", [[222, 36, 37]]),
    ]),
    makeUnit("7.3.3", "ANALISI LINEARE DINAMICA O STATICA", [
        heading("7.3.3", "heading", [[222, 38, 38]], "7.3.3 ANALISI LINEARE DINAMICA O STATICA"),
        autoBlock("7.3.3", "p1", "paragraph", [[222, 39, 43]]),
    ]),
    makeUnit("7.3.3.1", "ANALISI LINEARE DINAMICA", [
        heading("7.3.3.1", "heading", [[222, 44, 44]], "7.3.3.1 ANALISI LINEARE DINAMICA"),
        block("7.3.3.1", "p1", "paragraph", [[222, 45, 45]], "L’analisi lineare dinamica consiste:", { manual: true }),
        block("7.3.3.1", "li-a", "list-item", [[222, 46, 46]], "- nella determinazione dei modi di vibrare della costruzione (analisi modale);", { manual: true }),
        block("7.3.3.1", "li-b", "list-item", [[222, 47, 48]], "- nel calcolo degli effetti dell’azione sismica, rappresentata dallo spettro di risposta di progetto, per ciascuno dei modi di vibrare individuati;", { manual: true }),
        block("7.3.3.1", "li-c", "list-item", [[222, 49, 49]], "- nella combinazione di questi effetti.", { manual: true }),
        autoBlock("7.3.3.1", "p2", "paragraph", [[222, 50, 51]], { inline: inlineTerms(autoNormalize(raw([[222, 50, 51]])), [["5%", "5\\%"], ["85%", "85\\%"]]) }),
        autoBlock("7.3.3.1", "p3", "paragraph", [[222, 52, 53]]),
        formulaBlock("7.3.3.1", fE, 222, "7.3.4", reg(170, 720, 300, 50)),
        block("7.3.3.1", "p4", "paragraph", [[223, 3, 6]], "con: E_j valore dell’effetto relativo al modo j; ρ_{ij} coefficiente di correlazione tra il modo i e il modo j, calcolato con formule di comprovata validità quale:", { manual: true, inline: inlineTerms("con: E_j valore dell’effetto relativo al modo j; ρ_{ij} coefficiente di correlazione tra il modo i e il modo j, calcolato con formule di comprovata validità quale:", [["E_j", "E_j"], ["ρ_{ij}", "\\rho_{ij}"]]) }),
        formulaBlock("7.3.3.1", fRhoA, 223, "7.3.5a", reg(110, 170, 400, 105)),
        block("7.3.3.1", "p5", "paragraph", [[223, 25, 27]], "ξ_{i,j} smorzamento viscoso dei modi i e j; β_{ij} rapporto tra l’inverso dei periodi di ciascuna coppia i-j di modi (β_{ij} = T_j / T_i).", { manual: true, inline: inlineTerms("ξ_{i,j} smorzamento viscoso dei modi i e j; β_{ij} rapporto tra l’inverso dei periodi di ciascuna coppia i-j di modi (β_{ij} = T_j / T_i).", [["ξ_{i,j}", "\\xi_{i,j}"], ["β_{ij}", "\\beta_{ij}"], ["T_j / T_i", "T_j/T_i"]]) }),
        block("7.3.3.1", "p6", "paragraph", [[223, 28, 28]], "La [7.3.5a], nel caso di uguale smorzamento ξ dei modi i e j, si esprime come:", { manual: true, inline: inlineTerms("La [7.3.5a], nel caso di uguale smorzamento ξ dei modi i e j, si esprime come:", [["ξ", "\\xi"]]) }),
        formulaBlock("7.3.3.1", fRhoB, 223, "7.3.5b", reg(150, 300, 340, 75)),
    ], [fE, fRhoA, fRhoB]),
    makeUnit("7.3.3.2", "ANALISI LINEARE STATICA", [
        heading("7.3.3.2", "heading", [[223, 40, 40]], "7.3.3.2 ANALISI LINEARE STATICA"),
        block("7.3.3.2", "p1", "paragraph", [[223, 41, 46]], "L’analisi lineare statica consiste nell’applicazione di forze statiche equivalenti alle forze d’inerzia indotte dall’azione sismica e può essere effettuata per costruzioni che rispettino i requisiti specifici riportati nei paragrafi successivi, a condizione che il periodo del modo di vibrare principale nella direzione in esame (T_1) non superi 2,5 T_C o T_D e che la costruzione sia regolare in altezza.", { manual: true, inline: inlineTerms("L’analisi lineare statica consiste nell’applicazione di forze statiche equivalenti alle forze d’inerzia indotte dall’azione sismica e può essere effettuata per costruzioni che rispettino i requisiti specifici riportati nei paragrafi successivi, a condizione che il periodo del modo di vibrare principale nella direzione in esame (T_1) non superi 2,5 T_C o T_D e che la costruzione sia regolare in altezza.", [["T_1", "T_1"], ["T_C", "T_C"], ["T_D", "T_D"]]) }),
        block("7.3.3.2", "p2", "paragraph", [[223, 47, 48]], "Per costruzioni civili o industriali che non superino i 40 m di altezza e la cui massa sia distribuita in modo approssimativamente uniforme lungo l’altezza, T_1 (in secondi) può essere stimato, in assenza di calcoli più dettagliati, utilizzando la formula seguente:", { manual: true, inline: inlineTerms("Per costruzioni civili o industriali che non superino i 40 m di altezza e la cui massa sia distribuita in modo approssimativamente uniforme lungo l’altezza, T_1 (in secondi) può essere stimato, in assenza di calcoli più dettagliati, utilizzando la formula seguente:", [["T_1", "T_1"]]) }),
        formulaBlock("7.3.3.2", fT, 223, "7.3.6", reg(185, 410, 260, 48)),
        block("7.3.3.2", "p3", "paragraph", [[223, 50, 51]], "d è lo spostamento laterale elastico del punto più alto dell’edificio, espresso in metri, dovuto alla combinazione di carichi [2.5.7] applicata nella direzione orizzontale.", { manual: true, inline: inlineTerms("d è lo spostamento laterale elastico del punto più alto dell’edificio, espresso in metri, dovuto alla combinazione di carichi [2.5.7] applicata nella direzione orizzontale.", [["d", "d"]]) }),
        block("7.3.3.2", "p4", "paragraph", [[223, 52, 54]], "L’entità delle forze si ottiene dall’ordinata dello spettro di progetto corrispondente al periodo T_1 e la loro distribuzione sulla struttura segue la forma del modo di vibrare principale nella direzione in esame, valutata in modo approssimato.", { manual: true, inline: inlineTerms("L’entità delle forze si ottiene dall’ordinata dello spettro di progetto corrispondente al periodo T_1 e la loro distribuzione sulla struttura segue la forma del modo di vibrare principale nella direzione in esame, valutata in modo approssimato.", [["T_1", "T_1"]]) }),
        block("7.3.3.2", "p5", "paragraph", [[223, 55, 55]], "La forza da applicare a ciascuna massa della costruzione è data dalla formula seguente:", { manual: true }),
        formulaBlock("7.3.3.2", fFi, 223, "7.3.7", reg(170, 525, 300, 75)),
        block("7.3.3.2", "p6", "paragraph", [[223, 64, 64]], "dove:", { manual: true }),
        block("7.3.3.2", "p7", "paragraph", [[223, 65, 67]], "F_h = S_d(T_1) W λ/g", { manual: true, inline: inlineTerms("F_h = S_d(T_1) W λ/g", [["F_h = S_d(T_1) W λ/g", "F_h=S_d(T_1)W\\lambda/g"]]) }),
        block("7.3.3.2", "p8", "paragraph", [[223, 68, 68]], "F_i è la forza da applicare alla massa i-esima;", { manual: true, inline: inlineTerms("F_i è la forza da applicare alla massa i-esima;", [["F_i", "F_i"]]) }),
        block("7.3.3.2", "p9", "paragraph", [[223, 69, 69]], "W_i e W_j sono i pesi, rispettivamente, della massa i e della massa j;", { manual: true, inline: inlineTerms("W_i e W_j sono i pesi, rispettivamente, della massa i e della massa j;", [["W_i", "W_i"], ["W_j", "W_j"]]) }),
        block("7.3.3.2", "p10", "paragraph", [[223, 70, 71]], "z_i e z_j sono le quote, rispetto al piano di fondazione (v. § 3.2.3.1), delle masse i e j;", { manual: true, inline: inlineTerms("z_i e z_j sono le quote, rispetto al piano di fondazione (v. § 3.2.3.1), delle masse i e j;", [["z_i", "z_i"], ["z_j", "z_j"]]) }),
        block("7.3.3.2", "p11", "paragraph", [[223, 72, 75]], "S_d(T_1) è l’ordinata dello spettro di risposta di progetto definito al § 3.2.3.5;", { manual: true, inline: inlineTerms("S_d(T_1) è l’ordinata dello spettro di risposta di progetto definito al § 3.2.3.5;", [["S_d(T_1)", "S_d(T_1)"], ["T_1", "T_1"]]) }),
        block("7.3.3.2", "p12", "paragraph", [[223, 76, 76]], "W è il peso complessivo della costruzione;", { manual: true, inline: inlineTerms("W è il peso complessivo della costruzione;", [["W", "W"]]) }),
        block("7.3.3.2", "p13", "paragraph", [[223, 77, 77]], "λ è un coefficiente pari a 0,85 se T_1 < 2T_C e la costruzione ha almeno tre orizzontamenti, uguale a 1,0 in tutti gli altri casi;", { manual: true, inline: inlineTerms("λ è un coefficiente pari a 0,85 se T_1 < 2T_C e la costruzione ha almeno tre orizzontamenti, uguale a 1,0 in tutti gli altri casi;", [["λ", "\\lambda"], ["T_1 < 2T_C", "T_1<2T_C"]]) }),
        block("7.3.3.2", "p14", "paragraph", [[223, 78, 78]], "g è l’accelerazione di gravità.", { manual: true, inline: inlineTerms("g è l’accelerazione di gravità.", [["g", "g"]]) }),
    ], [fT, fFi]),
    makeUnit("7.3.3.3", "VALUTAZIONE DEGLI SPOSTAMENTI DELLA STRUTTURA", [
        heading("7.3.3.3", "heading", [[223, 79, 79]], "7.3.3.3 VALUTAZIONE DEGLI SPOSTAMENTI DELLA STRUTTURA"),
        block("7.3.3.3", "p1", "paragraph", [[223, 80, 81]], "Gli spostamenti d_E sotto l’azione sismica di progetto relativa allo SLV si ottengono moltiplicando per il fattore di duttilità in spostamento μ_d i valori d_{Ee} ottenuti dall’analisi lineare, dinamica o statica, secondo l’espressione seguente:", { manual: true, inline: inlineTerms("Gli spostamenti d_E sotto l’azione sismica di progetto relativa allo SLV si ottengono moltiplicando per il fattore di duttilità in spostamento μ_d i valori d_{Ee} ottenuti dall’analisi lineare, dinamica o statica, secondo l’espressione seguente:", [["d_E", "d_E"], ["μ_d", "\\mu_d"], ["d_{Ee}", "d_{Ee}"]]) }),
        formulaBlock("7.3.3.3", fDe, 223, "7.3.8", reg(185, 650, 270, 48)),
        autoBlock("7.3.3.3", "p2", "paragraph", [[223, 83, 83]]),
        formulaBlock("7.3.3.3", fMu, 223, "7.3.9", reg(185, 705, 300, 75)),
        block("7.3.3.3", "p3", "paragraph", [[223, 97, 97]], "In ogni caso μ_d ≤ 5q − 4.", { manual: true, inline: inlineTerms("In ogni caso μ_d ≤ 5q − 4.", [["μ_d ≤ 5q − 4", "\\mu_d\\le5q-4"]]) }),
        block("7.3.3.3", "p4", "paragraph", [[224, 3, 4]], "Gli spostamenti allo SLC si possono ottenere, in assenza di più accurate valutazioni che considerino l’effettivo rapporto delle ordinate spettrali in spostamento, moltiplicando per 1,25 gli spostamenti allo SLV.", { manual: true }),
    ], [fDe, fMu]),
];

const formulaRows = [
    [fQlim, "7.3.1", "7.3.1", "q_{\\lim}=q_0\\cdot K_R"],
    [fKw, "7.3.1", null, "k_w=\\begin{cases}1{,}00 & \\text{per strutture a telaio e miste equivalenti a telai}\\\\0{,}5\\le\\frac{1+\\alpha_0}{3}\\le1 & \\text{per strutture a pareti, miste equivalenti a pareti, torsionalmente deformabili}\\end{cases}"],
    [fQnd, "7.3.1", "7.3.2", "1\\le q_{ND}=\\frac{2}{3}q_{\\mathrm{CD\"B\"}}\\le1{,}5"],
    [fTheta, "7.3.1", "7.3.3", "\\theta=\\frac{P\\cdot d_{Er}}{V\\cdot h}"],
    [fE, "7.3.3.1", "7.3.4", "E=\\sqrt{\\sum_j\\sum_i\\rho_{ij}\\cdot E_i\\cdot E_j}"],
    [fRhoA, "7.3.3.1", "7.3.5a", "\\rho_{ij}=\\frac{8\\sqrt{\\xi_i\\cdot\\xi_j}\\cdot(\\beta_{ij}\\cdot\\xi_i+\\xi_j)\\cdot\\beta_{ij}^{3/2}}{(1-\\beta_{ij}^2)^2+4\\cdot\\xi_i\\cdot\\xi_j\\cdot\\beta_{ij}(1+\\beta_{ij}^2)+4\\cdot(\\xi_i^2+\\xi_j^2)\\cdot\\beta_{ij}^2}"],
    [fRhoB, "7.3.3.1", "7.3.5b", "\\rho_{ij}=\\frac{8\\xi^2\\beta_{ij}^{3/2}}{(1+\\beta_{ij})\\cdot\\left[(1-\\beta_{ij})^2+4\\xi^2\\beta_{ij}\\right]}"],
    [fT, "7.3.3.2", "7.3.6", "T_1=2\\sqrt{d}"],
    [fFi, "7.3.3.2", "7.3.7", "F_i=F_h\\cdot z_i\\cdot\\frac{W_i}{\\sum_j z_j W_j}"],
    [fDe, "7.3.3.3", "7.3.8", "d_E=\\pm\\mu_d\\cdot d_{Ee}"],
    [fMu, "7.3.3.3", "7.3.9", "\\mu_d=\\begin{cases}q & \\text{se }T_1\\ge T_C\\\\1+(q-1)\\cdot\\frac{T_C}{T_1} & \\text{se }T_1<T_C\\end{cases}"],
] as const;

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7-step2",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map(([id, unit, officialNumber, latex], index) => ({
        id: fid(id),
        unitId: uid(unit),
        officialNumber,
        pdfPage: index < 2 ? 220 + index : index < 4 ? 221 : index < 7 ? 222 + (index === 4 ? 0 : 1) : 223,
        latex,
    })),
    tables: [table73ii],
    figures: [],
};

await mkdir(unitDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
for (const unit of units) {
    const number = String(unit.numbering.official);
    await writeFile(join(unitDir, `${number}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}
await writeFile(join(assetDir, "7-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`NTC 7 step2: generate ${units.length} unità, ${formulaRows.length} formule e 1 tabella.`);
