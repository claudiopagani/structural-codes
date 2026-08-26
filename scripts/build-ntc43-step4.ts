import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfFile, sha256OfText } from "../src/lib/hash.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(repoRoot, "corpus", "units", "ntc2018");
const assetDirectory = join(repoRoot, "corpus", "assets", "ntc2018");
const figureDirectory = join(repoRoot, "corpus", "assets", "figures", "ntc2018");
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc43-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const actorId = "codex:ntc43-step4";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Page = { printedPage: string | null; textItems: Array<{ sequence: number; text: string; region: Region }> };

const pageCache = new Map<number, Page>();
for (const pageNumber of [132, 133, 134, 135, 136]) {
    const file = join(repoRoot, "evidence", sourceId, "pages", `page-${String(pageNumber).padStart(4, "0")}.json`);
    pageCache.set(pageNumber, JSON.parse(readFileSync(file, "utf8")) as Page);
}

const region = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const unitId = (number: string) => `urn:structural-codes:it:unit:ntc2018:${number}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:ntc2018:${number}`;
const t = (value: string): Inline => ({ kind: "text", value });
const m = (value: string, latex = value): Inline => ({ kind: "math", value, latex });

function rawFor(pageNumber: number, blockRegion: Region): string {
    const page = pageCache.get(pageNumber);
    if (!page) throw new Error(`evidence mancante per pagina ${pageNumber}`);
    const bottom = blockRegion.y + blockRegion.height;
    const right = blockRegion.x + blockRegion.width;
    return page.textItems.filter((item) => {
        const itemBottom = item.region.y + item.region.height;
        const itemRight = item.region.x + item.region.width;
        return item.text.length > 0 && item.region.y < bottom && itemBottom > blockRegion.y && item.region.x < right && itemRight > blockRegion.x;
    }).sort((a, b) => a.sequence - b.sequence).map((item) => item.text).join(" ");
}

function transformations(options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {}) {
    const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
    if (options.control) result.push({ operation: "remove-control-character", ruleVersion: profile, note: "Rimossi i caratteri di controllo privi di resa visuale dall’estrazione ufficiale." });
    if (options.hyphen) result.push({ operation: "remove-discretionary-hyphen", ruleVersion: profile, note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga dopo confronto con il render." });
    if (options.wrap) {
        result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." });
        result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione delle righe." });
    }
    if (options.manual) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli matematici e sillabazioni confrontati con il render della fonte ufficiale." });
    if (options.wrap || options.manual) result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}

function evidence(page: number, blockRegion: Region, raw: string, normalized: string, method: "pdf-text" | "manual-transcription" = "pdf-text", options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {}) {
    return { sourceId, pdfPage: page, printedPage: pageCache.get(page)?.printedPage ?? String(page - 4), region: blockRegion, extraction: { method, tool: method === "pdf-text" ? "pdfjs-dist" : "codex-source-transcription", toolVersion: method === "pdf-text" ? "4.10.38" : profile }, transformations: transformations(options), rawSha256: sha256OfText(raw), normalizedSha256: sha256OfText(normalized) };
}

function textBlock(number: string, suffix: string, kind: "heading" | "paragraph" | "list-item", page: number, blockRegion: Region, normalized: string, inline: Inline[] = [t(normalized)], options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = { wrap: true, manual: true }) {
    const raw = rawFor(page, blockRegion) || normalized;
    return { blockId: `${unitId(number)}#block-${suffix}`, kind, origin: "official", text: { raw, normalized, normalizationVersion: profile, inline: inline.length === 0 ? [t(normalized)] : inline }, evidence: evidence(page, blockRegion, raw, normalized, "pdf-text", options) };
}

function heading(number: string, title: string, page: number, blockRegion: Region) {
    return textBlock(number, "heading", "heading", page, blockRegion, `${number} ${title}`, [t(`${number} ${title}`)], { manual: true });
}

function formulaRef(unitNumber: string, formulaNumber: string, suffix: string, page: number, blockRegion: Region) {
    const id = formulaId(formulaNumber);
    return { blockId: `${unitId(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: id, evidence: evidence(page, blockRegion, id, id, "manual-transcription", { manual: true }) };
}

function assetRef(unitNumber: string, suffix: string, kind: "figure-ref", id: string, page: number, blockRegion: Region) {
    return { blockId: `${unitId(unitNumber)}#block-${suffix}`, kind, origin: "official", assetId: id, evidence: evidence(page, blockRegion, id, id, "manual-transcription", { manual: true }) };
}

function parent(number: string): string | null { const parts = number.split("."); return parts.length === 1 ? null : unitId(parts.slice(0, -1).join(".")); }
function ancestors(number: string): string[] { const parts = number.split("."); return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join("."))); }

function makeUnit(number: string, title: string, kind: "section" | "subparagraph", blocks: unknown[], figureIds: string[]) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: unitId(number), workId, expressionId, kind,
        numbering: { official: number, sortKey: number.split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: `${unitId(number)}#block-heading`, hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1)) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: formulaAssets.filter((asset) => asset.unitId === unitId(number)).map((asset) => asset.id), tableIds: [], figureIds },
        workflow: { status: "extracted", createdBy: { actorId, kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [
            { issueId: `ntc2018-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
            ...(formulaAssets.some((asset) => asset.unitId === unitId(number)) || figureIds.length > 0 ? [{ issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule e figure sono state separate e collocate; resta obbligatoria la revisione umana puntuale sulla fonte ufficiale." }] : []),
            ...(number === "4.3.5.5.1" ? [{ issueId: "ntc2018-4-3-5-5-1-source-typo", type: "other", severity: "blocking", note: "La fonte stampa «Fig. 4.3.-9» nel capoverso, mentre la didascalia e il riferimento successivo stampano «Fig. 4.3.9»; mantenere l’anomalia per revisione umana." }] : []),
        ] },
    };
}

const p132 = {
    h543: region(82, 170, 430, 25), f3334: region(82, 92, 440, 52), defs3334: region(82, 140, 430, 30), p543a: region(82, 182, 430, 18), f335: region(140, 194, 300, 18), p543b: region(82, 212, 430, 35), p543c: region(82, 248, 430, 20), p543d: region(82, 262, 430, 28), f336: region(140, 281, 280, 39), p543e: region(82, 320, 430, 25), p543f: region(82, 344, 430, 28), f337: region(140, 365, 280, 29), p543g: region(82, 395, 430, 35), h55: region(82, 425, 430, 24), p55a: region(82, 438, 430, 25), p55b: region(82, 462, 430, 30), p55c: region(82, 495, 430, 28), p55d: region(82, 518, 430, 40), h551: region(82, 566, 430, 24), p551a: region(82, 580, 430, 32), p551b: region(82, 615, 430, 20), l030: region(82, 637, 430, 18), l055: region(82, 650, 430, 18), l040: region(82, 663, 430, 18), l020: region(82, 676, 430, 18), l000: region(82, 689, 430, 12), p551c: region(82, 702, 430, 18),
};
const p133 = {
    p551c: region(82, 94, 430, 28), p551d: region(82, 118, 430, 35), l300: region(82, 162, 430, 18), l400: region(82, 174, 430, 18), l600: region(82, 184, 430, 20), fig39: region(82, 198, 440, 120), h56: region(82, 325, 430, 25), p56a: region(82, 340, 430, 38), p56b: region(82, 372, 430, 22), p56c: region(82, 384, 430, 22), l561: region(82, 394, 430, 18), l562: region(82, 416, 430, 18), l563: region(82, 427, 430, 22), l564: region(82, 448, 430, 22), l565: region(82, 427, 430, 22), l566: region(82, 448, 430, 22), p56d: region(82, 470, 430, 20), fig310: region(82, 492, 440, 76), h36: region(82, 572, 430, 25), p36a: region(82, 584, 430, 25), p36b: region(82, 607, 430, 20), l361: region(82, 628, 430, 24), l362: region(82, 649, 430, 25), l363: region(82, 670, 430, 25),
};
const p134 = {
    p36c: region(82, 94, 430, 18), fig311: region(82, 110, 440, 70), h361: region(82, 174, 430, 25), p361a: region(82, 187, 430, 25), la: region(82, 210, 430, 18), lb: region(82, 223, 430, 30), lc: region(82, 246, 430, 20), p361b: region(82, 258, 430, 25), p361c: region(82, 281, 430, 25), p361d: region(82, 304, 430, 32), p361e: region(82, 337, 430, 25), h3611: region(82, 365, 430, 25), p3611a: region(82, 378, 430, 35), f338: region(140, 401, 300, 35), dove: region(82, 416, 430, 18), p3611b: region(82, 427, 430, 55), fig312: region(82, 500, 440, 105), h362: region(82, 607, 430, 25), p362a: region(82, 620, 430, 20), l3621: region(82, 632, 430, 18), l3622: region(82, 645, 430, 18), l3623: region(82, 658, 430, 18), p362b: region(82, 670, 430, 38),
};
const p135 = {
    p362c: region(82, 94, 430, 30), h363: region(82, 134, 430, 25), h3631: region(82, 153, 430, 25), p3631a: region(82, 166, 430, 22), p3631b: region(82, 187, 430, 35), h3632: region(82, 233, 430, 25), p3632a: region(82, 245, 430, 30), p3632b: region(82, 276, 430, 25), h364: region(82, 305, 430, 25), h3641: region(82, 325, 430, 25), p3641a: region(82, 337, 430, 30), h3642: region(82, 375, 430, 25), p3642a: region(82, 387, 430, 24), p3642b: region(82, 408, 430, 35), h365: region(82, 456, 430, 25), h3651: region(82, 475, 430, 25), p3651a: region(82, 487, 430, 30), h3652: region(82, 525, 430, 25), p3652a: region(82, 537, 430, 22), p3652b: region(82, 558, 430, 25), h3653: region(82, 587, 430, 25), p3653a: region(82, 598, 430, 25), h3654: region(82, 627, 430, 25), p3654a: region(82, 639, 430, 22), p3654b: region(82, 660, 430, 22), p3654c: region(82, 681, 430, 22), p3654d: region(82, 702, 430, 24),
};
const p136 = {
    h37: region(77, 88, 440, 25), p37a: region(77, 101, 430, 30), p37b: region(77, 133, 430, 22), h38: region(77, 165, 440, 25), p38a: region(77, 178, 440, 28), h39: region(77, 221, 440, 25), p39a: region(77, 234, 440, 25), h310: region(77, 279, 440, 25), p310a: region(77, 292, 440, 25), p310b: region(77, 313, 440, 32), p310c: region(77, 344, 440, 25),
};

const formulaAssets = [
    { id: formulaId("4.3.35"), unitId: unitId("4.3.5.4.3"), officialNumber: "4.3.35", pdfPage: 132, latex: "M_{Ed}\\le\\alpha_M\\cdot M_{pl,Rd}(N_{Ed})" },
    { id: formulaId("4.3.36"), unitId: unitId("4.3.5.4.3"), officialNumber: "4.3.36", pdfPage: 132, latex: "k=\\frac{\\beta}{1-\\frac{N_{Ed}}{N_{cr}}}\\ge1{,}0" },
    { id: formulaId("4.3.37"), unitId: unitId("4.3.5.4.3"), officialNumber: "4.3.37", pdfPage: 132, latex: "\\beta=0{,}66+0{,}44\\cdot\\frac{M_{min}}{M_{max}}\\ge0{,}44" },
    { id: formulaId("4.3.38"), unitId: unitId("4.3.6.1.1"), officialNumber: "4.3.38", pdfPage: 134, latex: "b_m=b_p+2(h_c+h_f)" },
];

const figureAssets = [
    { id: figureId("4.3.9"), unitId: unitId("4.3.5.5.1"), officialNumber: "4.3.9", pdfPage: 133, caption: "Disposizione dei pioli per la connessione meccanica acciaio-calcestruzzo", alt: "Tre disposizioni di pioli a taglio tra ali di un profilo a doppio T, per una, due e tre o più file di connettori.", filename: "fig4.3.9.png", imagePath: "figures/ntc2018/fig4.3.9.png", region: p133.fig39 },
    { id: figureId("4.3.10"), unitId: unitId("4.3.5.6"), officialNumber: "4.3.10", pdfPage: 133, caption: "Perimetro efficace delle barre di armatura.", alt: "Schema del perimetro efficace di una barra di armatura adiacente al profilo.", filename: "fig4.3.10.png", imagePath: "figures/ntc2018/fig4.3.10.png", region: p133.fig310 },
    { id: figureId("4.3.11"), unitId: unitId("4.3.6"), officialNumber: "4.3.11", pdfPage: 134, caption: "Tipiche forme di connessione per ingranamento delle solette composte", alt: "Quattro schemi di forme di connessione per ingranamento, identificate con (a), (b), (c) e (d).", filename: "fig4.3.11.png", imagePath: "figures/ntc2018/fig4.3.11.png", region: p134.fig311 },
    { id: figureId("4.3.12"), unitId: unitId("4.3.6.1.1"), officialNumber: "4.3.12", pdfPage: 134, caption: "Diffusione del carico concentrato", alt: "Diffusione a 45 gradi di un carico concentrato attraverso una soletta con lamiera grecata.", filename: "fig4.3.12.png", imagePath: "figures/ntc2018/fig4.3.12.png", region: p134.fig312 },
];

const units = [
    makeUnit("4.3.5.4.3", "Colonne pressoinflesse", "subparagraph", [
        heading("4.3.5.4.3", "Colonne pressoinflesse", 132, p132.h543),
        textBlock("4.3.5.4.3", "p-001", "paragraph", 132, p132.p543a, "La verifica a presso-flessione della colonna composta è condotta controllando che:"),
        formulaRef("4.3.5.4.3", "4.3.35", "formula-001", 132, p132.f335),
        textBlock("4.3.5.4.3", "p-002", "paragraph", 132, p132.p543b, "dove M_Ed, associato allo sforzo normale N_Ed, è il massimo valore del momento flettente nella colonna, calcolato considerando, se rilevanti, i difetti di rettilineità della colonna, vedi Tab. 4.3. III, e gli effetti del secondo ordine e M_pl,Rd(N_Ed) il momento resistente di progetto disponibile, funzione di N_Ed.", [t("dove "), m("M_Ed", "M_{Ed}"), t(", associato allo sforzo normale "), m("N_Ed", "N_{Ed}"), t(", è il massimo valore del momento flettente nella colonna, calcolato considerando, se rilevanti, i difetti di rettilineità della colonna, vedi Tab. 4.3. III, e gli effetti del secondo ordine e "), m("M_pl,Rd(N_Ed)", "M_{pl,Rd}(N_{Ed})"), t(" il momento resistente di progetto disponibile, funzione di "), m("N_Ed", "N_{Ed}"), t(".")]),
        textBlock("4.3.5.4.3", "p-003", "paragraph", 132, p132.p543c, "Il coefficiente α_M è assunto pari a 0,9 per gli acciai compresi tra le classi S235 ed S355, mentre per l’S420 e l’S460 è posto pari a 0,8.", [t("Il coefficiente "), m("α_M", "\\alpha_M"), t(" è assunto pari a 0,9 per gli acciai compresi tra le classi S235 ed S355, mentre per l’S420 e l’S460 è posto pari a 0,8.")]),
        textBlock("4.3.5.4.3", "p-004", "paragraph", 132, p132.p543d, "Gli effetti dei fenomeni del secondo ordine possono essere tenuti in conto incrementando i momenti ottenuti dall’analisi elastica tramite il coefficiente amplificativo:"),
        formulaRef("4.3.5.4.3", "4.3.36", "formula-002", 132, p132.f336),
        textBlock("4.3.5.4.3", "p-005", "paragraph", 132, p132.p543e, "in cui N_cr è il carico euleriano e β è un coefficiente che dipende dalla distribuzione del momento flettente lungo l’asse dell’elemento.", [t("in cui "), m("N_cr", "N_{cr}"), t(" è il carico euleriano e "), m("β", "\\beta"), t(" è un coefficiente che dipende dalla distribuzione del momento flettente lungo l’asse dell’elemento.")]),
        textBlock("4.3.5.4.3", "p-006", "paragraph", 132, p132.p543f, "Il coefficiente β è assunto pari ad 1, quando l’andamento del momento flettente è parabolico o triangolare con valori nulli alle estremità della colonna, ed è dato da:" , [t("Il coefficiente "), m("β", "\\beta"), t(" è assunto pari ad 1, quando l’andamento del momento flettente è parabolico o triangolare con valori nulli alle estremità della colonna, ed è dato da:")]),
        formulaRef("4.3.5.4.3", "4.3.37", "formula-003", 132, p132.f337),
        textBlock("4.3.5.4.3", "p-007", "paragraph", 132, p132.p543g, "quando l’andamento è lineare, con M_max e M_min i momenti alle estremità della colonna, concordi se tendono le fibre poste dalla stessa parte dell’elemento (se M è costante M_max = M_min e β=1,1).", [t("quando l’andamento è lineare, con "), m("M_max", "M_{max}"), t(" e "), m("M_min", "M_{min}"), t(" i momenti alle estremità della colonna, concordi se tendono le fibre poste dalla stessa parte dell’elemento (se "), m("M", "M"), t(" è costante "), m("M_max = M_min", "M_{max}=M_{min}"), t(" e "), m("β=1,1", "\\beta=1{,}1"), t(").")]),
    ], []),
    makeUnit("4.3.5.5", "TRASFERIMENTO DEGLI SFORZI TRA COMPONENTE IN ACCIAIO E COMPONENTE IN CALCESTRUZZO", "subparagraph", [
        heading("4.3.5.5", "TRASFERIMENTO DEGLI SFORZI TRA COMPONENTE IN ACCIAIO E COMPONENTE IN CALCESTRUZZO", 132, p132.h55),
        textBlock("4.3.5.5", "p-001", "paragraph", 132, p132.p55a, "La lunghezza di trasferimento degli sforzi tra acciaio e calcestruzzo non deve superare il doppio della dimensione minore della sezione trasversale oppure, se minore, un terzo dell’altezza della colonna."),
        textBlock("4.3.5.5", "p-002", "paragraph", 132, p132.p55b, "Qualora, nel trasferimento degli sforzi, si faccia affidamento sulla resistenza dovuta all’aderenza ed all’attrito, il valore puntuale della tensione tangenziale può calcolarsi mediante un’analisi elastica in fase non fessurata. Il valore puntuale massimo non deve superare le tensioni tangenziali limite di aderenza fornite nel paragrafo successivo."),
        textBlock("4.3.5.5", "p-003", "paragraph", 132, p132.p55c, "Se si realizza un collegamento meccanico, utilizzando connettori duttili di cui al § 4.3.4.3.1, si può effettuare una valutazione in campo plastico degli sforzi trasferiti, ripartendoli in modo uniforme fra i connettori."),
        textBlock("4.3.5.5", "p-004", "paragraph", 132, p132.p55d, "Nelle sezioni parzialmente rivestite composte con profili metallici a doppio T, il calcestruzzo tra le ali deve essere collegato all’anima mediante connettori individuando un chiaro meccanismo di trasferimento tra il calcestruzzo e l’anima se vi è flessione secondo l’asse debole; inoltre, se la resistenza a taglio non è attribuita al solo profilo in acciaio, le staffe necessarie a raggiungere la resistenza a taglio della parte in calcestruzzo armato devono essere passanti o saldate all’anima."),
    ], []),
    makeUnit("4.3.5.5.1", "Resistenza allo scorrimento fra i componenti", "subparagraph", [
        heading("4.3.5.5.1", "Resistenza allo scorrimento fra i componenti", 132, p132.h551),
        textBlock("4.3.5.5.1", "p-001", "paragraph", 132, p132.p551a, "La resistenza allo scorrimento fra profili in acciaio e calcestruzzo è dovuta alle tensioni di aderenza, all’attrito all’interfaccia acciaio-calcestruzzo nonché al collegamento meccanico; la resistenza deve essere tale da evitare scorrimenti rilevanti che possano inficiare i modelli di calcolo considerati."),
        textBlock("4.3.5.5.1", "p-002", "paragraph", 132, p132.p551b, "Nell’ambito del metodo di verifica agli stati limiti si può assumere una tensione tangenziale di progetto dovuta all’aderenza ed all’attrito, fino ai seguenti limiti:"),
        textBlock("4.3.5.5.1", "list-001", "list-item", 132, p132.l030, "– 0,30 MPa, per sezioni completamente rivestite;", [t("– "), m("0,30 MPa", "0{,}30\\,\\mathrm{MPa}"), t(", per sezioni completamente rivestite;")]),
        textBlock("4.3.5.5.1", "list-002", "list-item", 132, p132.l055, "– 0,55 MPa, per sezioni circolari riempite di calcestruzzo;", [t("– "), m("0,55 MPa", "0{,}55\\,\\mathrm{MPa}"), t(", per sezioni circolari riempite di calcestruzzo;")]),
        textBlock("4.3.5.5.1", "list-003", "list-item", 132, p132.l040, "– 0,40 MPa, per sezioni rettangolari riempite di calcestruzzo;", [t("– "), m("0,40 MPa", "0{,}40\\,\\mathrm{MPa}"), t(", per sezioni rettangolari riempite di calcestruzzo;")]),
        textBlock("4.3.5.5.1", "list-004", "list-item", 132, p132.l020, "– 0,20 MPa, per le ali delle sezioni parzialmente rivestite;", [t("– "), m("0,20 MPa", "0{,}20\\,\\mathrm{MPa}"), t(", per le ali delle sezioni parzialmente rivestite;")]),
        textBlock("4.3.5.5.1", "list-005", "list-item", 132, p132.l000, "– 0 (zero), per l’anima delle sezioni parzialmente rivestite.", [t("– "), m("0 (zero)", "0\\;(\\mathrm{zero})"), t(", per l’anima delle sezioni parzialmente rivestite.")]),
        textBlock("4.3.5.5.1", "p-003", "paragraph", 132, p132.p551c, "Se tali limiti vengono superati, l’intero sforzo va affidato a collegamenti meccanici. Il collegamento meccanico tra il profilo in acciaio a doppio T ed il calcestruzzo può essere realizzato mediante staffe saldate all’anima del profilo oppure passanti; un altro meccanismo di connessione può essere realizzato con pioli a taglio. In ogni caso è necessario definire un sistema di connessione dal chiaro funzionamento meccanico per il trasferimento delle sollecitazioni."),
        textBlock("4.3.5.5.1", "p-004", "paragraph", 133, p133.p551d, "Qualora vi siano connettori a piolo sull’anima di sezioni in acciaio a doppio T o similari, le ali limitano l’espansione laterale del calcestruzzo incrementando la resistenza allo scorrimento dei pioli. Questa resistenza aggiuntiva si può assumere pari a μP_Rd/2, vedi Fig. 4.3.-9, su ogni ala per ogni fila di pioli, essendo P_Rd la resistenza di progetto del singolo connettore. Si può assumere μ=0,5. Tali valori delle resistenze meccaniche sono considerati validi se la distanza tra le ali rispetta le limitazioni (vedi Fig. 4.3.9):", [t("Qualora vi siano connettori a piolo sull’anima di sezioni in acciaio a doppio T o similari, le ali limitano l’espansione laterale del calcestruzzo incrementando la resistenza allo scorrimento dei pioli. Questa resistenza aggiuntiva si può assumere pari a "), m("μP_Rd/2", "\\mu P_{Rd}/2"), t(", vedi Fig. 4.3.-9, su ogni ala per ogni fila di pioli, essendo "), m("P_Rd", "P_{Rd}"), t(" la resistenza di progetto del singolo connettore. Si può assumere "), m("μ=0,5", "\\mu=0{,}5"), t(". Tali valori delle resistenze meccaniche sono considerati validi se la distanza tra le ali rispetta le limitazioni (vedi Fig. 4.3.9):")]),
        textBlock("4.3.5.5.1", "list-006", "list-item", 133, p133.l300, "– 300 mm, se è presente un connettore per fila;", [t("– "), m("300 mm", "300\\,\\mathrm{mm}"), t(", se è presente un connettore per fila;")]),
        textBlock("4.3.5.5.1", "list-007", "list-item", 133, p133.l400, "– 400 mm, se sono presenti due connettori per fila;", [t("– "), m("400 mm", "400\\,\\mathrm{mm}"), t(", se sono presenti due connettori per fila;")]),
        textBlock("4.3.5.5.1", "list-008", "list-item", 133, p133.l600, "– 600 mm, se sono presenti tre o più connettori per fila.", [t("– "), m("600 mm", "600\\,\\mathrm{mm}"), t(", se sono presenti tre o più connettori per fila.")]),
        assetRef("4.3.5.5.1", "figure-001", "figure-ref", figureId("4.3.9"), 133, p133.fig39),
    ], [figureId("4.3.9")]),
    makeUnit("4.3.5.6", "COPRIFERRO E MINIMI DI ARMATURA", "subparagraph", [
        heading("4.3.5.6", "COPRIFERRO E MINIMI DI ARMATURA", 133, p133.h56),
        textBlock("4.3.5.6", "p-001", "paragraph", 133, p133.p56a, "Si devono rispettare le seguenti limitazioni:"),
        textBlock("4.3.5.6", "list-001", "list-item", 133, p133.l561, "– il copriferro dell’ala delle colonne completamente rivestite deve essere non minore di 40 mm, né minore di 1/6 della larghezza dell’ala;", [t("– il copriferro dell’ala delle colonne completamente rivestite deve essere non minore di "), m("40 mm", "40\\,\\mathrm{mm}"), t(", né minore di "), m("1/6", "1/6"), t(" della larghezza dell’ala;")]),
        textBlock("4.3.5.6", "list-002", "list-item", 133, p133.l562, "– il copriferro delle armature deve essere in accordo con le disposizioni relative alle strutture in calcestruzzo armato ordinario."),
        textBlock("4.3.5.6", "p-002", "paragraph", 133, p133.p56c, "Le armature devono essere realizzate rispettando le seguenti indicazioni:"),
        textBlock("4.3.5.6", "list-003", "list-item", 133, p133.l563, "– l’armatura longitudinale, nel caso che venga considerata nel calcolo, non deve essere inferiore allo 0,3% della sezione in calcestruzzo;", [t("– l’armatura longitudinale, nel caso che venga considerata nel calcolo, non deve essere inferiore allo "), m("0,3%", "0{,}3\\%"), t(" della sezione in calcestruzzo;")]),
        textBlock("4.3.5.6", "list-004", "list-item", 133, p133.l564, "– l’armatura trasversale deve essere progettata seguendo le regole delle strutture in calcestruzzo armato ordinario;"),
        textBlock("4.3.5.6", "list-005", "list-item", 133, p133.l565, "– la distanza tra le barre ed il profilo può essere inferiore a quella tra le barre oppure nulla; in questi casi il perimetro efficace per l’aderenza acciaio-calcestruzzo deve essere ridotto alla metà o a un quarto, rispettivamente (fig. 4.3.10);"),
        textBlock("4.3.5.6", "list-006", "list-item", 133, p133.l566, "– le reti elettrosaldate possono essere utilizzate come staffe nelle colonne rivestite ma non possono sostituire l’armatura longitudinale."),
        textBlock("4.3.5.6", "p-003", "paragraph", 133, p133.p56d, "Nelle sezioni riempite di calcestruzzo generalmente l’armatura non è necessaria."),
        assetRef("4.3.5.6", "figure-001", "figure-ref", figureId("4.3.10"), 133, p133.fig310),
    ], [figureId("4.3.10")]),
    makeUnit("4.3.6", "SOLETTE COMPOSTE CON LAMIERA GRECATA", "section", [
        heading("4.3.6", "SOLETTE COMPOSTE CON LAMIERA GRECATA", 133, p133.h36),
        textBlock("4.3.6", "p-001", "paragraph", 133, p133.p36a, "Si definisce come composta una soletta in calcestruzzo gettata su una lamiera grecata, in cui quest’ultima, ad avvenuto indurimento del calcestruzzo, partecipa alla resistenza dell’insieme costituendo interamente o in parte l’armatura inferiore."),
        textBlock("4.3.6", "p-002", "paragraph", 133, p133.p36b, "La trasmissione delle forze di scorrimento all’interfaccia fra lamiera e calcestruzzo non può essere affidata alla sola aderenza, ma si devono adottare sistemi specifici che possono essere:"),
        textBlock("4.3.6", "list-001", "list-item", 133, p133.l361, "– a ingranamento meccanico fornito dalla deformazione del profilo metallico o ingranamento ad attrito nel caso di profili sagomati con forme rientranti, (a) e (b), Fig. 4.3.11;"),
        textBlock("4.3.6", "list-002", "list-item", 133, p133.l362, "– ancoraggi di estremità costituiti da pioli saldati o altri tipi di connettori, purché combinati a sistemi ad ingranamento (c), Fig. 4.3.11;"),
        textBlock("4.3.6", "list-003", "list-item", 133, p133.l363, "– ancoraggi di estremità ottenuti con deformazione della lamiera, purché combinati con sistemi a ingranamento per attrito, (d) Fig. 4.3.11."),
        textBlock("4.3.6", "p-003", "paragraph", 134, p134.p36c, "Occorre in ogni caso verificare l’efficacia e la sicurezza del collegamento tra lamiera grecata e calcestruzzo."),
        assetRef("4.3.6", "figure-001", "figure-ref", figureId("4.3.11"), 134, p134.fig311),
    ], [figureId("4.3.11")]),
    makeUnit("4.3.6.1", "ANALISI PER IL CALCOLO DELLE SOLLECITAZIONI", "subparagraph", [
        heading("4.3.6.1", "ANALISI PER IL CALCOLO DELLE SOLLECITAZIONI", 134, p134.h361),
        textBlock("4.3.6.1", "p-001", "paragraph", 134, p134.p361a, "Nel caso in cui le solette siano calcolate come travi continue si possono utilizzare i seguenti metodi di analisi, già presentati nel paragrafo § 4.3.2.2:"),
        textBlock("4.3.6.1", "list-001", "list-item", 134, p134.la, "(a) analisi lineare con o senza ridistribuzione;"),
        textBlock("4.3.6.1", "list-002", "list-item", 134, p134.lb, "(b) analisi globale plastica, a condizione che, dove vi sono richieste di rotazione plastica, le sezioni abbiano sufficiente capacità rotazionale;"),
        textBlock("4.3.6.1", "list-003", "list-item", 134, p134.lc, "(c) analisi elasto-plastica che tenga conto del comportamento non lineare dei materiali."),
        textBlock("4.3.6.1", "p-002", "paragraph", 134, p134.p361b, "I metodi lineari di analisi sono idonei sia per gli stati limite ultimi, sia per gli stati limite di esercizio. I metodi plastici devono essere utilizzati solo nello stato limite ultimo."),
        textBlock("4.3.6.1", "p-003", "paragraph", 134, p134.p361c, "Si può utilizzare, per lo stato limite ultimo, l’analisi plastica senza alcuna verifica diretta della capacità rotazionale se si utilizza acciaio da armatura B450C (di cui al § 11.3.2.1) e se le campate hanno luce minore di 3 m."),
        textBlock("4.3.6.1", "p-004", "paragraph", 134, p134.p361d, "Se nell’analisi si trascurano gli effetti della fessurazione del calcestruzzo, i momenti flettenti negativi in corrispondenza degli appoggi interni possono essere ridotti fino al 30%, considerando i corrispondenti aumenti dei momenti flettenti positivi nelle campate adiacenti."),
        textBlock("4.3.6.1", "p-005", "paragraph", 134, p134.p361e, "Una soletta continua può essere progettata come una serie di campate semplicemente appoggiate; in corrispondenza degli appoggi intermedi si raccomanda di disporre armature secondo le indicazioni del successivo § 4.3.6.3.1."),
    ], []),
    makeUnit("4.3.6.1.1", "Larghezza efficace per forze concentrate o lineari", "subparagraph", [
        heading("4.3.6.1.1", "Larghezza efficace per forze concentrate o lineari", 134, p134.h3611),
        textBlock("4.3.6.1.1", "p-001", "paragraph", 134, p134.p3611a, "Forze concentrate o applicate lungo una linea parallela alle nervature della lamiera possono essere considerate ripartite su una larghezza b_m operando una diffusione a 45° sino al lembo superiore della lamiera, vedi Fig. 4.3.12, secondo la formula:", [t("Forze concentrate o applicate lungo una linea parallela alle nervature della lamiera possono essere considerate ripartite su una larghezza "), m("b_m", "b_m"), t(" operando una diffusione a 45° sino al lembo superiore della lamiera, vedi Fig. 4.3.12, secondo la formula:")]),
        formulaRef("4.3.6.1.1", "4.3.38", "formula-001", 134, p134.f338),
        textBlock("4.3.6.1.1", "p-002", "paragraph", 134, p134.dove, "dove:"),
        textBlock("4.3.6.1.1", "p-003", "paragraph", 134, p134.p3611b, "b_p è la larghezza su cui agisce il carico, h_c è lo spessore della soletta sopra la nervatura e h_f è lo spessore delle finiture. Per stese di carico lineari disposte trasversalmente all’asse della greca si può utilizzare la medesima formula considerando come b_p l’estensione della linea di carico. Possono assumersi differenti larghezze efficaci b_m in presenza di differenti dettagli di armatura nella soletta così come indicato in altri riferimenti tecnici di cui al Capitolo 12.", [m("b_p", "b_p"), t(" è la larghezza su cui agisce il carico, "), m("h_c", "h_c"), t(" è lo spessore della soletta sopra la nervatura e "), m("h_f", "h_f"), t(" è lo spessore delle finiture. Per stese di carico lineari disposte trasversalmente all’asse della greca si può utilizzare la medesima formula considerando come "), m("b_p", "b_p"), t(" l’estensione della linea di carico. Possono assumersi differenti larghezze efficaci "), m("b_m", "b_m"), t(" in presenza di differenti dettagli di armatura nella soletta così come indicato in altri riferimenti tecnici di cui al Capitolo 12.")]),
        assetRef("4.3.6.1.1", "figure-001", "figure-ref", figureId("4.3.12"), 134, p134.fig312),
    ], [figureId("4.3.12")]),
    makeUnit("4.3.6.2", "VERIFICHE DI RESISTENZA ALLO STATO LIMITE ULTIMO", "subparagraph", [
        heading("4.3.6.2", "VERIFICHE DI RESISTENZA ALLO STATO LIMITE ULTIMO", 134, p134.h362),
        textBlock("4.3.6.2", "p-001", "paragraph", 134, p134.p362a, "Si considereranno di regola le seguenti verifiche:"),
        textBlock("4.3.6.2", "list-001", "list-item", 134, p134.l3621, "– resistenza a flessione;"),
        textBlock("4.3.6.2", "list-002", "list-item", 134, p134.l3622, "– resistenza allo scorrimento;"),
        textBlock("4.3.6.2", "list-003", "list-item", 134, p134.l3623, "– resistenza al punzonamento ed al taglio."),
        textBlock("4.3.6.2", "p-002", "paragraph", 134, p134.p362b, "Ai fini della verifica allo scorrimento occorre conoscere la resistenza a taglio longitudinale di progetto τ_u,Rd tipica della lamiera grecata prevista, determinata secondo i criteri di cui al Capitolo 11 delle presenti norme. La resistenza di una soletta composta alle sollecitazioni di taglio-punzonamento è di regola valutata sulla base di una adeguata sperimentazione, condotta in modo da riprodurre le effettive condizioni della superficie di contatto tra lamiere e getto in calcestruzzo riscontrabili in cantiere.", [t("Ai fini della verifica allo scorrimento occorre conoscere la resistenza a taglio longitudinale di progetto "), m("τ_u,Rd", "\\tau_{u,Rd}"), t(" tipica della lamiera grecata prevista, determinata secondo i criteri di cui al Capitolo 11 delle presenti norme. La resistenza di una soletta composta alle sollecitazioni di taglio-punzonamento è di regola valutata sulla base di una adeguata sperimentazione, condotta in modo da riprodurre le effettive condizioni della superficie di contatto tra lamiere e getto in calcestruzzo riscontrabili in cantiere.")]),
        textBlock("4.3.6.2", "p-003", "paragraph", 135, p135.p362c, "Qualora si consideri efficace la sola lamiera grecata, attribuendo al calcestruzzo esclusivamente la funzione di contrasto all’imbozzamento locale, la resistenza può essere verificata in accordo con le indicazioni di normative di comprovata validità sui profilati sottili di acciaio formati a freddo."),
    ], []),
    makeUnit("4.3.6.3", "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO", "subparagraph", [heading("4.3.6.3", "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO", 135, p135.h363)], []),
    makeUnit("4.3.6.3.1", "Verifiche a fessurazione", "subparagraph", [
        heading("4.3.6.3.1", "Verifiche a fessurazione", 135, p135.h3631),
        textBlock("4.3.6.3.1", "p-001", "paragraph", 135, p135.p3631a, "L’ampiezza delle fessure del calcestruzzo nelle regioni di momento negativo di solette continue deve essere calcolata in accordo col § 4.1.2.2.4."),
        textBlock("4.3.6.3.1", "p-002", "paragraph", 135, p135.p3631b, "Qualora le solette continue siano progettate come semplicemente appoggiate in accordo con il precedente § 4.3.6.1, la sezione trasversale dell’armatura di controllo della fessurazione non deve essere minore di 0,2% dell’area della sezione trasversale del calcestruzzo posta al di sopra delle nervature nelle costruzioni non puntellate in fase di getto, e di 0,4% dell’area della sezione trasversale del calcestruzzo posta al di sopra delle nervature per le costruzioni puntellate in fase di getto.", [t("Qualora le solette continue siano progettate come semplicemente appoggiate in accordo con il precedente § 4.3.6.1, la sezione trasversale dell’armatura di controllo della fessurazione non deve essere minore di "), m("0,2%", "0{,}2\\%"), t(" dell’area della sezione trasversale del calcestruzzo posta al di sopra delle nervature nelle costruzioni non puntellate in fase di getto, e di "), m("0,4%", "0{,}4\\%"), t(" dell’area della sezione trasversale del calcestruzzo posta al di sopra delle nervature per le costruzioni puntellate in fase di getto.")]),
    ], []),
    makeUnit("4.3.6.3.2", "Verifiche di deformazione", "subparagraph", [
        heading("4.3.6.3.2", "Verifiche di deformazione", 135, p135.h3632),
        textBlock("4.3.6.3.2", "p-001", "paragraph", 135, p135.p3632a, "L’effetto dello scorrimento di estremità può essere trascurato se nei risultati sperimentali il carico che causa uno scorrimento di 0,5 mm è maggiore di 1,2 volte il carico della combinazione caratteristica considerata, oppure se la tensione tangenziale di scorrimento all’interfaccia è inferiore al 30% della tensione limite di aderenza τ_u,Rd.", [t("L’effetto dello scorrimento di estremità può essere trascurato se nei risultati sperimentali il carico che causa uno scorrimento di "), m("0,5 mm", "0{,}5\\,\\mathrm{mm}"), t(" è maggiore di "), m("1,2", "1{,}2"), t(" volte il carico della combinazione caratteristica considerata, oppure se la tensione tangenziale di scorrimento all’interfaccia è inferiore al "), m("30%", "30\\%"), t(" della tensione limite di aderenza "), m("τ_u,Rd", "\\tau_{u,Rd}"), t(".")]),
        textBlock("4.3.6.3.2", "p-002", "paragraph", 135, p135.p3632b, "Il calcolo delle frecce può essere omesso se il rapporto tra luce ed altezza non supera i limiti indicati nel precedente § 4.1 relativo alle strutture di c.a. e risulta trascurabile l’effetto dello scorrimento di estremità."),
    ], []),
    makeUnit("4.3.6.4", "VERIFICHE DELLA LAMIERA GRECATA NELLA FASE DI GETTO", "subparagraph", [heading("4.3.6.4", "VERIFICHE DELLA LAMIERA GRECATA NELLA FASE DI GETTO", 135, p135.h364)], []),
    makeUnit("4.3.6.4.1", "Verifica di resistenza", "subparagraph", [
        heading("4.3.6.4.1", "Verifica di resistenza", 135, p135.h3641),
        textBlock("4.3.6.4.1", "p-001", "paragraph", 135, p135.p3641a, "La verifica della lamiera grecata deve essere svolta in accordo con le indicazioni della normativa UNI EN1993-1-3 in materia di profilati sottili di acciaio formati a freddo. Gli effetti delle dentellature o delle bugnature devono essere opportunamente considerati nella valutazione della resistenza."),
    ], []),
    makeUnit("4.3.6.4.2", "Verifiche agli stati limite di esercizio", "subparagraph", [
        heading("4.3.6.4.2", "Verifiche agli stati limite di esercizio", 135, p135.h3642),
        textBlock("4.3.6.4.2", "p-001", "paragraph", 135, p135.p3642a, "L’inflessione della lamiera sotto il peso proprio ed il peso del calcestruzzo fresco, escludendo i carichi di costruzione, non deve essere maggiore di L/180 o 20 mm, essendo L la luce effettiva della campata fra due appoggi definitivi o provvisori.", [t("L’inflessione della lamiera sotto il peso proprio ed il peso del calcestruzzo fresco, escludendo i carichi di costruzione, non deve essere maggiore di "), m("L/180", "L/180"), t(" o "), m("20 mm", "20\\,\\mathrm{mm}"), t(", essendo "), m("L", "L"), t(" la luce effettiva della campata fra due appoggi definitivi o provvisori.")]),
        textBlock("4.3.6.4.2", "p-002", "paragraph", 135, p135.p3642b, "Tali limiti possono essere aumentati qualora inflessioni maggiori non inficino la resistenza o l’efficienza del solaio e sia considerato nella progettazione del solaio e della struttura di supporto il peso addizionale dovuto all’accumulo del calcestruzzo. Nel caso in cui l’inflessione dell’estradosso possa condurre a problemi legati ai requisiti di funzionalità della struttura, i limiti deformativi debbono essere ridotti."),
    ], []),
    makeUnit("4.3.6.5", "DETTAGLI COSTRUTTIVI", "subparagraph", [heading("4.3.6.5", "DETTAGLI COSTRUTTIVI", 135, p135.h365)], []),
    makeUnit("4.3.6.5.1", "Spessore minimo delle lamiere grecate", "subparagraph", [
        heading("4.3.6.5.1", "Spessore minimo delle lamiere grecate", 135, p135.h3651),
        textBlock("4.3.6.5.1", "p-001", "paragraph", 135, p135.p3651a, "Lo spessore delle lamiere grecate impiegate nelle solette composte non deve essere inferiore a 0,8 mm. Lo spessore della lamiera potrà essere ridotto a 0,7 mm quando in fase costruttiva vengano studiati idonei provvedimenti atti a consentire il transito in sicurezza di mezzi d’opera e personale.", [t("Lo spessore delle lamiere grecate impiegate nelle solette composte non deve essere inferiore a "), m("0,8 mm", "0{,}8\\,\\mathrm{mm}"), t(". Lo spessore della lamiera potrà essere ridotto a "), m("0,7 mm", "0{,}7\\,\\mathrm{mm}"), t(" quando in fase costruttiva vengano studiati idonei provvedimenti atti a consentire il transito in sicurezza di mezzi d’opera e personale.")]),
    ], []),
    makeUnit("4.3.6.5.2", "Spessore della soletta", "subparagraph", [
        heading("4.3.6.5.2", "Spessore della soletta", 135, p135.h3652),
        textBlock("4.3.6.5.2", "p-001", "paragraph", 135, p135.p3652a, "L’altezza complessiva h del solaio composto non deve essere minore di 80 mm. Lo spessore del calcestruzzo h_c al di sopra dell’estradosso delle nervature della lamiera non deve essere minore di 40 mm.", [t("L’altezza complessiva "), m("h", "h"), t(" del solaio composto non deve essere minore di "), m("80 mm", "80\\,\\mathrm{mm}"), t(". Lo spessore del calcestruzzo "), m("h_c", "h_c"), t(" al di sopra dell’estradosso delle nervature della lamiera non deve essere minore di "), m("40 mm", "40\\,\\mathrm{mm}"), t(".")]),
        textBlock("4.3.6.5.2", "p-002", "paragraph", 135, p135.p3652b, "Se la soletta realizza con la trave una membratura composta, oppure è utilizzata come diaframma orizzontale, l’altezza complessiva non deve essere minore di 90 mm ed h_c non deve essere minore di 50 mm.", [t("Se la soletta realizza con la trave una membratura composta, oppure è utilizzata come diaframma orizzontale, l’altezza complessiva non deve essere minore di "), m("90 mm", "90\\,\\mathrm{mm}"), t(" ed "), m("h_c", "h_c"), t(" non deve essere minore di "), m("50 mm", "50\\,\\mathrm{mm}"), t(".")]),
    ], []),
    makeUnit("4.3.6.5.3", "Inerti", "subparagraph", [
        heading("4.3.6.5.3", "Inerti", 135, p135.h3653),
        textBlock("4.3.6.5.3", "p-001", "paragraph", 135, p135.p3653a, "La dimensione nominale dell’inerte dipende dalla più piccola dimensione dell’elemento strutturale nel quale il calcestruzzo è gettato."),
    ], []),
    makeUnit("4.3.6.5.4", "Appoggi", "subparagraph", [
        heading("4.3.6.5.4", "Appoggi", 135, p135.h3654),
        textBlock("4.3.6.5.4", "p-001", "paragraph", 135, p135.p3654a, "Le solette composte sostenute da elementi di acciaio o calcestruzzo devono avere una larghezza di appoggio minima di 75 mm, con una dimensione di appoggio del bordo della lamiera grecata di almeno 50 mm.", [t("Le solette composte sostenute da elementi di acciaio o calcestruzzo devono avere una larghezza di appoggio minima di "), m("75 mm", "75\\,\\mathrm{mm}"), t(", con una dimensione di appoggio del bordo della lamiera grecata di almeno "), m("50 mm", "50\\,\\mathrm{mm}"), t(".")]),
        textBlock("4.3.6.5.4", "p-002", "paragraph", 135, p135.p3654b, "Nel caso di solette composte sostenute da elementi in diverso materiale, tali valori devono essere portati rispettivamente a 100 mm e 70 mm.", [t("Nel caso di solette composte sostenute da elementi in diverso materiale, tali valori devono essere portati rispettivamente a "), m("100 mm", "100\\,\\mathrm{mm}"), t(" e "), m("70 mm", "70\\,\\mathrm{mm}"), t(".")]),
        textBlock("4.3.6.5.4", "p-003", "paragraph", 135, p135.p3654c, "Nel caso di lamiere sovrapposte o continue che poggiano su elementi di acciaio o calcestruzzo, l’appoggio minimo deve essere 75 mm e per elementi in altro materiale 100 mm.", [t("Nel caso di lamiere sovrapposte o continue che poggiano su elementi di acciaio o calcestruzzo, l’appoggio minimo deve essere "), m("75 mm", "75\\,\\mathrm{mm}"), t(" e per elementi in altro materiale "), m("100 mm", "100\\,\\mathrm{mm}"), t(".")]),
        textBlock("4.3.6.5.4", "p-004", "paragraph", 135, p135.p3654d, "I valori minimi delle larghezze di appoggio riportati in precedenza possono essere ridotti, in presenza di adeguate specifiche di progetto circa tolleranze, carichi, campate, altezza dell’appoggio e requisiti di continuità per le armature."),
    ], []),
    makeUnit("4.3.7", "VERIFICHE PER SITUAZIONI TRANSITORIE", "section", [
        heading("4.3.7", "VERIFICHE PER SITUAZIONI TRANSITORIE", 136, p136.h37),
        textBlock("4.3.7", "p-001", "paragraph", 136, p136.p37a, "Per le situazioni costruttive transitorie, come quelle che si hanno durante le fasi della costruzione, dovranno adottarsi tecnologie costruttive e programmi di lavoro che non possano provocare danni permanenti alla struttura o agli elementi strutturali e che comunque non possano riverberarsi sulla sicurezza dell’opera."),
        textBlock("4.3.7", "p-002", "paragraph", 136, p136.p37b, "Le entità delle azioni ambientali da prendere in conto saranno determinate in relazione alla durata della situazione transitoria e della tecnologia esecutiva."),
    ], []),
    makeUnit("4.3.8", "VERIFICHE PER SITUAZIONI ECCEZIONALI", "section", [
        heading("4.3.8", "VERIFICHE PER SITUAZIONI ECCEZIONALI", 136, p136.h38),
        textBlock("4.3.8", "p-001", "paragraph", 136, p136.p38a, "Per situazioni progettuali eccezionali, il progetto dovrà dimostrare la robustezza della costruzione mediante procedure di scenari di danno per i quali i fattori parziali γ_M dei materiali possono essere assunti pari ai valori precisati per il calcestruzzo nel § 4.1.4 e per l’acciaio nel § 4.2.6.", [t("Per situazioni progettuali eccezionali, il progetto dovrà dimostrare la robustezza della costruzione mediante procedure di scenari di danno per i quali i fattori parziali "), m("γ_M", "\\gamma_M"), t(" dei materiali possono essere assunti pari ai valori precisati per il calcestruzzo nel § 4.1.4 e per l’acciaio nel § 4.2.6.")]),
    ], []),
    makeUnit("4.3.9", "RESISTENZA AL FUOCO", "section", [
        heading("4.3.9", "RESISTENZA AL FUOCO", 136, p136.h39),
        textBlock("4.3.9", "p-001", "paragraph", 136, p136.p39a, "Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1994-1-2, utilizzando i coefficienti γ_M (vedi § 4.3.8) relativi alle combinazioni eccezionali.", [t("Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1994-1-2, utilizzando i coefficienti "), m("γ_M", "\\gamma_M"), t(" (vedi § 4.3.8) relativi alle combinazioni eccezionali.")]),
    ], []),
    makeUnit("4.3.10", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE", "section", [
        heading("4.3.10", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE", 136, p136.h310),
        textBlock("4.3.10", "p-001", "paragraph", 136, p136.p310a, "La resistenza e la funzionalità di strutture e elementi strutturali può essere misurata attraverso prove su campioni di adeguata numerosità."),
        textBlock("4.3.10", "p-002", "paragraph", 136, p136.p310b, "I risultati delle prove eseguite su opportuni campioni devono essere trattati con i metodi dell’analisi statistica, in modo tale da ricavare parametri significativi quali media, deviazione standard e fattore di asimmetria della distribuzione, sì da caratterizzare adeguatamente un modello probabilistico descrittore delle quantità indagate (variabili aleatorie)."),
        textBlock("4.3.10", "p-003", "paragraph", 136, p136.p310c, "Indicazioni più dettagliate al riguardo e metodi operativi completi per la progettazione integrata da prove possono essere reperiti nella Appendice D della UNI EN 1990:2006."),
    ], []),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "4.3-step4", sourceId, status: "transcribed-unreviewed", formulas: formulaAssets,
    tables: [], figures: await Promise.all(figureAssets.map(async (asset) => { const { filename, ...manifestAsset } = asset; return { ...manifestAsset, sha256: await sha256OfFile(join(figureDirectory, filename)) }; })),
};

mkdirSync(unitDirectory, { recursive: true });
mkdirSync(assetDirectory, { recursive: true });
for (const unit of units) writeFileSync(join(unitDirectory, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
writeFileSync(join(assetDirectory, "4.3-step4.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`NTC 4.3 step4: generate ${units.length} unità e ${formulaAssets.length} formule, 0 tabelle, ${figureAssets.length} figure.`);
