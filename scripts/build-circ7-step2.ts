/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitsPath = join(root, "corpus", "units", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ7-manual-render-transcription-0.2.0";
const createdAt = "2026-08-23T00:00:00Z";
type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type TextKind = "heading" | "paragraph" | "list-item" | "footnote";
type TextSpec = { kind: TextKind; page: number; text: string };
type AssetSpec = { kind: "formula-ref" | "figure-ref" | "table-ref"; page: number; number: string; label: string; region?: Region };
type Spec = TextSpec | AssetSpec;
const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const aid = (kind: "formula" | "figure" | "table", number: string) => `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const pageRegion = (): Region => ({ coordinateSystem: "pdf-points-top-left", x: 73.9, y: 55, width: 450, height: 730 });
const p = (page: number, text: string): TextSpec => ({ kind: "paragraph", page, text });
const h = (page: number, text: string): TextSpec => ({ kind: "heading", page, text });
const li = (page: number, text: string): TextSpec => ({ kind: "list-item", page, text });
const fn = (page: number, text: string): TextSpec => ({ kind: "footnote", page, text: text.replaceAll("\n", " ") });
const f = (page: number, number: string): AssetSpec => ({ kind: "formula-ref", page, number, label: number });
const fig = (page: number, number: string, region: Region): AssetSpec => ({ kind: "figure-ref", page, number, label: `Figura ${number}`, region });
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });

const mathTerms: Array<[string, string]> = [
    ["S_e,SLV(T_1)", "S_{e,SLV}(T_1)"], ["S_e,SLD(T_1)", "S_{e,SLD}(T_1)"],
    ["F*_{bu} = F_{bu}/Γ", "F_{bu}^*=F_{bu}/\\Gamma"], ["≤0,15F*_{bu}", "\\le0{,}15F_{bu}^*"],
    ["q* = S_e(T*)m*/F*_y", "q^*=S_e(T^*)m^*/F_y^*"], ["d*_{max} = d*_{e,max}", "d_{max}^*=d_{e,max}^*"],
    ["(F*_{max},d*_{max})", "(F_{max}^*,d_{max}^*)"], ["d*_{max}^{(1)}", "d_{max}^{*(1)}"], ["d*_{max}^{(0)}", "d_{max}^{*(0)}"],
    ["F*_y-d*_{max}", "F_y^*-d_{max}^*"], ["F*-d*", "F^*-d^*"], ["F_b-d_c", "F_b-d_c"],
    ["m* = Φ Mτ", "m^*=\\Phi M\\tau"], ["d_c = 1", "d_c=1"], ["T* ≥ T_C", "T^*\\ge T_C"], ["T* < T_C", "T^*<T_C"],
    ["q* ≤ 1", "q^*\\le1"], ["ξ = 5%", "\\xi=5\\%"], ["T_1 < 2T_C", "T_1<2T_C"],
    ["d_r = d_{r,E}", "d_r=d_{r,E}"], ["0,6F*_{bu}", "0{,}6F_{bu}^*"],
    ["F*_{bu}", "F_{bu}^*"], ["F*_y", "F_y^*"], ["F_bu", "F_{bu}"], ["d*_u", "d_u^*"], ["d*_{max}", "d_{max}^*"], ["m*", "m^*"], ["k*", "k^*"], ["q*", "q^*"],
    ["F*", "F^*"], ["d*", "d^*"], ["q’", "q'"],
    ["S_{De}", "S_{De}"], ["S_e", "S_e"], ["ξ_eq", "\\xi_{eq}"], ["ρ_ij", "\\rho_{ij}"],
    ["k = 0,66", "k=0{,}66"], ["k = 0,33", "k=0{,}33"], ["k = 1", "k=1"],
    ["q'", "q'"], ["q_ND", "q_{ND}"], ["S_e,SLV", "S_{e,SLV}"], ["S_e,SLD", "S_{e,SLD}"],
    ["T_1", "T_1"], ["T_C", "T_C"], ["T^*", "T^*"], ["d_{r,E}", "d_{r,E}"], ["d_r", "d_r"], ["d^*", "d^*"], ["F_a", "F_a"], ["F^*", "F^*"],
    ["F_b", "F_b"], ["d_c", "d_c"], ["ξ", "\\xi"], ["Γ", "\\Gamma"], ["φ", "\\phi"],
    ["γ_Rd", "\\gamma_{Rd}"], ["α_f", "\\alpha_f"], ["0,0075h", "0{,}0075h"], ["0,0100h", "0{,}0100h"],
    ["500 mm", "500\\,\\mathrm{mm}"], ["50%", "50\\%"], ["85%", "85\\%"], ["10%", "10\\%"], ["5%", "5\\%"],
    ["C_1", "C_1"], ["A_c", "A_c"], ["f_cd", "f_{cd}"], ["λ", "\\lambda"], ["τ", "\\tau"],
    ["N", "N"], ["q", "q"], ["T", "T"], ["H", "H"], ["M", "M"], ["k", "k"],
    ["§ 7.2.6", "\\S 7.2.6"], ["§ 7.3.3", "\\S 7.3.3"], ["§ 7.3.5", "\\S 7.3.5"],
    ["§ 7.3.6", "\\S 7.3.6"], ["§ C3.2.3.6", "\\S C3.2.3.6"], ["§ 3.2.3.6", "\\S 3.2.3.6"],
    ["§ 3.2.3.2.3", "\\S 3.2.3.2.3"], ["§ 3.2.4", "\\S 3.2.4"], ["§ 7.10.6.2.2", "\\S 7.10.6.2.2"],
];
function findTerm(text: string, value: string, cursor: number): number {
    let index = text.indexOf(value, cursor);
    if (!/^[A-Za-z]$/.test(value)) return index;
    while (index >= 0) {
        const before = index > 0 ? text.charAt(index - 1) : "";
        const after = index + 1 < text.length ? text.charAt(index + 1) : "";
        if (!/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after)) return index;
        index = text.indexOf(value, index + 1);
    }
    return -1;
}
function inline(text: string): any[] | undefined {
    const terms = mathTerms.filter(([value]) => text.includes(value)).sort((a, b) => b[0].length - a[0].length);
    if (!terms.length) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of terms) {
            const index = findTerm(text, value, cursor);
            if (index >= 0 && (!next || index < next.index || (index === next.index && value.length > next.value.length))) next = { index, value, latex };
        }
        if (!next) { result.push({ kind: "text", value: text.slice(cursor) }); break; }
        if (next.index > cursor) result.push({ kind: "text", value: text.slice(cursor, next.index) });
        result.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    return result.filter(({ value }) => value);
}
function evidence(page: number, value: string, region: Region = pageRegion()) {
    return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: profile }, transformations: [], rawSha256: hash(value), normalizedSha256: hash(value) };
}
function block(id: string, spec: Spec, index: number) {
    const blockId = `${id}#block-editorial-${String(index).padStart(3, "0")}`;
    if (spec.kind === "formula-ref" || spec.kind === "figure-ref" || spec.kind === "table-ref") {
        return { blockId, kind: spec.kind, origin: "official", assetId: aid(spec.kind === "formula-ref" ? "formula" : spec.kind === "figure-ref" ? "figure" : "table", spec.number), evidence: evidence(spec.page, spec.label, spec.region ?? pageRegion()) };
    }
    const textSpec = spec as TextSpec;
    const segments = inline(textSpec.text);
    return { blockId, kind: textSpec.kind, origin: "official", text: { raw: textSpec.text, normalized: textSpec.text, normalizationVersion: profile, ...(segments ? { inline: segments } : {}) }, evidence: evidence(textSpec.page, textSpec.text) };
}
function parent(number: string) { const parts = number.split("."); return parts.length === 1 ? null : uid(parts.slice(0, -1).join(".")); }
function ancestors(number: string) { const parts = number.split("."); return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join("."))); }
function makeRecord(number: string, title: string, specs: readonly Spec[]) {
    const id = uid(number);
    const blocks = specs.map((spec, index) => index === 0 && spec.kind === "heading" ? { ...block(id, spec, index), blockId: `${id}#block-heading` } : block(id, spec, index));
    const parts = number.slice(1).split(".").map(Number);
    const lower = number.toLowerCase();
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id, workId, expressionId,
        kind: parts.length === 1 ? "section" : parts.length === 2 ? "paragraph" : "subparagraph",
        numbering: { official: number, sortKey: parts.map((part) => String(part).padStart(3, "0")).join(".") }, title, titleBlockId: `${id}#block-heading`,
        hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: parts.at(-1) }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-23" }, blocks, citations: [], relations: [],
        assets: {
            formulaIds: blocks.filter(({ kind }) => kind === "formula-ref").map(({ assetId }: any) => assetId),
            tableIds: blocks.filter(({ kind }) => kind === "table-ref").map(({ assetId }: any) => assetId),
            figureIds: blocks.filter(({ kind }) => kind === "figure-ref").map(({ assetId }: any) => assetId),
        },
        workflow: { status: "extracted", createdBy: { actorId: "generator:circ7:step2", kind: "script", toolVersion: profile }, createdAt, reviews: [], openIssues: [
            { issueId: `circ2019-${lower.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con i render delle pagine ufficiali; resta obbligatoria la revisione umana indipendente." },
            { issueId: `circ2019-${lower.replaceAll(".", "-")}-missing-text-layer`, type: "missing-region", severity: "blocking", note: "Le pagine ufficiali sono scansioni con un layer testuale limitato a intestazione e numero pagina; i blocchi sono stati trascritti dal render PDF." },
        ] },
    };
}

const c726Continuation: Spec[] = [
    p(207, "Per gli elementi in calcestruzzo armato si può, in maniera semplificata, adottare un coefficiente riduttivo della rigidezza denominato coefficiente di fessurazione α_f, da applicare sia alla rigidezza flessionale sia alla rigidezza a taglio di ciascun elemento. Tale coefficiente è espresso in funzione del carico assiale N e del fattore di comportamento q adottati per la progettazione allo SLV."),
    p(207, "Nelle Figure C7.2.5 (a) e C7.2.5 (b), q rappresenta il fattore di comportamento, N lo sforzo normale dovuto ai soli carichi verticali nella combinazione sismica, A_c l’area della sezione, f_cd la resistenza a compressione del calcestruzzo."),
    fig(207, "C7.2.5", reg(117, 178, 360, 175)),
    h(207, "Modellazione dell’azione sismica"),
    p(207, "Per semplicità di analisi è possibile descrivere la variabilità spaziale del moto e l’aleatorietà dell’effettivo baricentro delle masse e delle rigidezze attraverso lo spostamento del centro di massa dalla sua posizione originaria nella direzione delle due componenti orizzontali e in ambo i versi. In alternativa è consentito (§ 7.3.3) applicare un momento torcente valutato a partire dalla risultante orizzontale della forza agente al piano, determinata come in § 7.3.3.2, moltiplicata per l’eccentricità accidentale⁷ del baricentro delle masse rispetto alla sua posizione di calcolo, determinata come in § 7.2.6."),
    p(207, "Nel valutare gli effetti dell’eccentricità accidentale, si dovranno considerare, ovviamente, gli effetti concomitanti delle due componenti dell’azione sismica, utilizzando le regole di combinazione indicate al § 7.3.5."),
    fn(207, "Si specifica che l’eccentricità accidentale, oltre che per considerare le incertezze legate alla localizzazione delle masse, è una maniera indiretta per tener conto della variabilità spaziale del moto sismico. A rigore, infatti, si dovrebbe considerare una componente torsionale del trascinamento sismico, sia nelle analisi statiche, sia nelle analisi dinamiche; tradizionalmente, invece, l’azione sismica viene descritta esclusivamente attraverso le due componenti traslazionali orizzontali del moto, cui va aggiunta, ove significativa, la componente verticale."),
];

const c73: Spec[] = [h(207, "C7.3 METODI DI ANALISI E CRITERI DI VERIFICA")];
const c731: Spec[] = [
    h(207, "C7.3.1 ANALISI LINEARE O NON LINEARE"),
    p(207, "Quando nella progettazione allo SLV si adottano fattori di comportamento q elevati (mediamente superiori a 2,5), può accadere che le ordinate dello spettro SLD superino le corrispondenti ordinate dello spettro SLV."),
    p(207, "Ciò implica, per le strutture in classe d’uso 1 e 2, per le quali allo SLD è richiesta dalle NTC la sola verifica in termini di rigidezza (RIG, si veda § 7.3.6) che gli elementi strutturali possano plasticizzarsi anche per eventi sismici relativamente frequenti, quali quelli corrispondenti allo SLD. In questo caso, se si vuole garantire l’assenza di danno strutturale allo SLD, è necessario effettuare, allo stesso SLD, anche la verifica in termini di resistenza (RES) oppure si può ridurre il fattore di comportamento da adottare nella progettazione allo SLV in modo tale da mantenere le ordinate dello spettro SLD al di sotto delle corrispondenti ordinate dello spettro SLV."),
    p(207, "Il nuovo fattore di comportamento q’ può essere ottenuto, per ciascuna direzione, dalla relazione C7.3.1:"),
    f(207, "C7.3.1"),
    p(207, "Dove: q_ND è il fattore di comportamento non dissipativo definito dall’espressione [7.3.2] della norma; T_1 è il periodo del primo modo traslazionale nella direzione considerata; S_e,SLV(T_1) e S_e,SLD(T_1) sono, rispettivamente, la risposta spettrale elastica allo SLV e allo SLD, relative al periodo T_1."),
    fn(207, "Si specifica che l’eccentricità accidentale, oltre che per considerare le incertezze legate alla localizzazione delle masse, è una maniera indiretta per tener conto della variabilità spaziale del moto sismico. A rigore, infatti, si dovrebbe considerare una componente torsionale del trascinamento sismico, sia nelle analisi statiche, sia nelle analisi dinamiche; tradizionalmente, invece, l’azione sismica viene descritta esclusivamente attraverso le due componenti traslazionali orizzontali del moto, cui va aggiunta, ove significativa, la componente verticale."),
];

const c733: Spec[] = [h(208, "C7.3.3 ANALISI LINEARE DINAMICA O STATICA")];
const c7331: Spec[] = [
    h(208, "C7.3.3.1 ANALISI LINEARE DINAMICA⁸"),
    fn(208, "L’analisi lineare dinamica, così come presentata nelle NTC, avviene in tre passi fondamentali:\n1) determinazione dei modi di vibrare “naturali” della struttura (analisi modale);\n2) calcolo degli effetti dell’azione sismica, rappresentati dallo spettro di risposta di progetto, per ciascuno dei modi di vibrare individuati;\n3) combinazione degli effetti relativi a ciascun modo di vibrare per valutare la risposta complessiva.\nL’analisi modale consiste nella soluzione delle equazioni del moto della struttura, considerata elastica, in condizioni di oscillazioni libere (assenza di forzante esterna) e nella individuazione di particolari configurazioni deformate che costituiscono i modi naturali di vibrare di una costruzione. Questi modi di vibrare sono una caratteristica propria della struttura, in quanto sono individuati in assenza di forzante, e sono caratterizzati da un periodo proprio di oscillazione T e da un fattore di smorzamento convenzionale ξ, nonché da una forma. Tranne che per casi particolari, quali ad esempio quelli di costruzioni dotate di sistemi di isolamento e di dissipazione, si assume che i modi di vibrare abbiano tutti lo stesso valore del fattore di smorzamento convenzionale ossia ξ = 5%. Qualunque configurazione deformata di una struttura (e lo stato di sollecitazione a tale deformata connesso), può essere ottenuta come combinazione di deformate elementari, ciascuna con la forma di un modo di vibrare. Ovviamente, in funzione dell’azione che agisce sulla costruzione, alcuni modi di vibrare avranno parte più significativa di altri nella descrizione della configurazione deformata. La massa partecipante di un modo di vibrare esprime la quota parte delle forze sismiche di trascinamento ad esso associate, da cui dipendono, unitamente alla corrispondente amplificazione, gli effetti che il singolo modo è in grado di descrivere. Per poter cogliere con sufficiente approssimazione gli effetti dell’azione sismica sulla costruzione, è opportuno considerare tutti i modi con massa partecipante superiore al 5% e comunque un numero di modi la cui massa partecipante totale sia superiore all’85%, trascurando solo i modi di vibrare meno significativi in termini di massa partecipante. L’utilizzo dello spettro di risposta consente di calcolare gli effetti massimi del terremoto sulla costruzione associati a ciascun modo di vibrare. Tuttavia, poiché durante il terremoto gli effetti massimi associati ad un modo di vibrare non si verificano generalmente nello stesso istante in cui sono massimi quelli associati ad un altro modo di vibrare, tali effetti non possono essere combinati tra di loro mediante una semplice somma ma con specifiche regole di combinazione, di natura probabilistica, che tengono conto di questo sfasamento temporale. La regola di combinazione imposta dalla norma è la regola di combinazione quadratica completa CQC (Complete Quadratic Combination): tale regola porta in conto anche l’eventuale correlazione tra i modi, attraverso il fattore ρ_ij. Essa degenera nella più semplice regola SRSS (Square Root of Sum of Squares), valida nell’ipotesi in cui i contributi massimi dei singoli modi non siano correlati e non si verifichino contemporaneamente. La SRSS può essere utilizzata, ove ritenuto necessario, come riferimento per il controllo dei risultati, tenendo presente che, in assenza di correlazione, la CQC degenera nella SRSS e che, in generale, quando il periodo di vibrazione di ciascun modo differisce di più del 10% da quello degli altri modi, le differenze tra le due regole diventano trascurabili."),
];
const c7332: Spec[] = [
    h(208, "C7.3.3.2 ANALISI LINEARE STATICA⁹"),
    p(208, "In letteratura e nei diversi documenti tecnici di riferimento esistono espressioni più o meno semplici per determinare, in maniera approssimata, il periodo del primo modo di vibrare della struttura, in ciascuna delle due direzioni principali."),
    p(208, "L’equazione [7.3.6] della norma porta in conto, in maniera indiretta, l’effettiva rigidezza laterale della struttura e risulta, pertanto, più affidabile rispetto ad altre formulazioni più semplici, basate unicamente sul numero di piani o sull’altezza complessiva della costruzione, ma richiede necessariamente un modello di calcolo e un’analisi statica specifica."),
    p(208, "Dipende dalle finalità dell’analisi il grado di approssimazione da conseguire nella determinazione del periodo T_1, cui è legata la risposta spettrale e quindi l’entità delle forze statiche equivalenti. In via di prima approssimazione, si può utilizzare la seguente espressione semplificata:"),
    f(208, "C7.3.2"),
    p(208, "dove H è l’altezza della costruzione, in metri, dal piano di fondazione e C_1 vale 0,085 per costruzioni con struttura a telaio di acciaio o di legno, 0,075 per costruzioni con struttura a telaio di calcestruzzo armato e 0,050 per costruzioni di muratura o per qualsiasi altro tipo di struttura."),
    fn(208, "L’analisi lineare statica consiste sostanzialmente in un’analisi lineare dinamica semplificata in cui:\n1) invece di effettuare l’analisi dinamica della costruzione si assume per essa un modo di vibrare principale avente un periodo T_1 calcolato in maniera approssimata (utilizzando l’espressione [7.3.6] delle NTC) e spostamenti linearmente crescenti con l’altezza dal piano di fondazione, ai quali corrisponde la distribuzione di forze statiche data dall’espressione [7.3.7] delle NTC. A questo modo di vibrare si associa un’aliquota λ di massa partecipante pari a 0,85 se la costruzione ha almeno tre orizzontamenti e se T_1 < 2T_C, pari a 1,0 in tutti gli altri casi;\n2) si calcolano gli effetti dell’azione sismica, rappresentata dallo spettro di risposta di progetto, per il modo di vibrare principale considerato;\n3) non si effettua alcuna combinazione degli effetti in quanto non si considerano altri modi di vibrare."),
];

const c734: Spec[] = [h(209, "C7.3.4 ANALISI NON LINEARE DINAMICA O STATICA")];
const c7341: Spec[] = [
    h(209, "C7.3.4.1 ANALISI NON LINEARE DINAMICA"),
    p(209, "Per eseguire analisi non lineari dinamiche occorre definire da un lato un modello della struttura che descriva opportunamente le fonti di non linearità significative, dall’altro le storie temporali di accelerazioni che descrivono il moto del terreno. Ciascuna storia temporale (accelerogramma) descrive una componente, orizzontale o verticale, dell’azione sismica; l’insieme delle tre componenti (due orizzontali, tra loro ortogonali, e una verticale) costituisce un gruppo di storie temporali del moto del terreno. Gli accelerogrammi possono essere artificiali, naturali o simulati e devono essere opportunamente selezionati e scalati, secondo quanto indicato nel § 3.2.3.6 e nel § C3.2.3.6."),
    p(209, "Nelle analisi non lineari con integrazione al passo, un punto cruciale, oltre alla selezione degli accelerogrammi, è rappresentato dalla scelta delle direzioni di applicazione dell’input sismico rispetto alle direzioni principali della struttura."),
    p(209, "A questo scopo, per gli accelerogrammi naturali, può essere utile proiettare ciascuna coppia di registrazioni lungo le direzioni principali del sisma, come indicato al § C3.2.3.6."),
    p(209, "I modelli da utilizzare per effettuare analisi non lineari dinamiche devono rispettare i requisiti del § 7.2.6 delle NTC. In particolare essi devono consentire una corretta rappresentazione degli elementi strutturali in termini di rigidezza, resistenza, e di comportamento post-elastico, dovendo rappresentare correttamente la capacità dissipativa per isteresi e i possibili fenomeni di degrado associati alle deformazioni cicliche. Un punto cruciale, nelle analisi non lineari dinamiche, è rappresentato dalla adeguata definizione della matrice di smorzamento."),
    p(209, "La norma richiede espressamente il confronto tra i risultati dell’analisi dinamica non lineare e quelli dell’analisi modale con spettro di progetto, in termini di sollecitazioni globali alla base della struttura. Tale confronto deve fornire risultati coerenti, in generale spiegabili attraverso il fattore di comportamento o, in caso contrario, attraverso l’interpretazione della risposta della struttura e dei meccanismi inelastici evidenziati dalle analisi non lineari."),
];

const c7342: Spec[] = [
    h(209, "C7.3.4.2 ANALISI NON LINEARE STATICA"),
    p(209, "L’analisi non lineare statica consente di determinare la curva di capacità della struttura, espressa dalla relazione F_b-d_c, in cui F_b è il taglio alla base e d_c lo spostamento di un punto di controllo, che per gli edifici è in genere rappresentato dal centro di massa dell’ultimo orizzontamento. Per ogni stato limite considerato, il confronto tra la curva di capacità e la domanda di spostamento consente di determinare il livello di prestazione raggiunto. A tal fine, abitualmente, si associa al sistema strutturale reale un sistema strutturale equivalente a un grado di libertà."),
    fig(209, "C7.3.1", reg(75, 435, 400, 170)),
    p(209, "La forza F* e lo spostamento d* del sistema equivalente sono legati alle corrispondenti grandezze F_b e d_c del sistema reale dalle relazioni:"),
    f(209, "C7.3.3"), f(209, "C7.3.4"),
    p(209, "dove Γ è il “fattore di partecipazione modale” definito dalla relazione:"),
    f(209, "C7.3.5"),
    p(210, "Il vettore τ è il vettore di trascinamento corrispondente alla direzione del sisma considerata; il vettore φ è il modo di vibrare fondamentale del sistema reale normalizzato ponendo d_c = 1; la matrice M è la matrice di massa del sistema reale."),
    p(210, "Ai fini operativi, per poter determinare in forma chiusa l’energia dissipata dal sistema e, quindi, lo smorzamento equivalente, alla curva di capacità del sistema equivalente è utile sostituire una curva bilineare. Le tecniche di bilinearizzazione si basano usualmente su principi di equivalenza energetica, imponendo che le aree sottese dalla curva bilineare e dalla curva F*-d* siano uguali."),
    p(210, "Per la valutazione del punto di prestazione (PP) della struttura è possibile seguire uno dei seguenti metodi:"),
    li(210, "Metodo A, basato sull’individuazione della domanda anelastica attraverso il principio di uguali spostamenti o uguale energia."),
    li(210, "Metodo B, basato sulla costruzione di uno spettro di capacità."),
    h(210, "Metodo A"),
    p(210, "Alla curva di capacità del sistema equivalente si sostituisce una curva bilineare avente un primo tratto elastico ed un secondo tratto perfettamente plastico (si veda Figura C7.3.1). Detta F_bu la resistenza massima del sistema strutturale reale ed F*_{bu} = F_{bu}/Γ la resistenza massima del sistema equivalente, il tratto elastico si individua imponendone il passaggio per il punto 0,6F*_{bu} della curva di capacità del sistema equivalente, la forza di plasticizzazione F*_y si individua imponendo l’uguaglianza delle aree sottese dalla curva bilineare e dalla curva di capacità per lo spostamento massimo d*_u corrispondente ad una riduzione di resistenza ≤0,15F*_{bu}."),
    p(210, "Il periodo elastico del sistema bilineare è dato dall’espressione:"),
    f(210, "C7.3.6"),
    p(210, "dove m* = Φ Mτ e k* è la rigidezza del tratto elastico della bilineare."),
    p(210, "Nel caso in cui T* ≥ T_C la domanda in spostamento per il sistema anelastico è assunta uguale a quella di un sistema elastico di pari periodo (v. § 3.2.3.2.3 delle NTC e Figura C7.3.2a):"),
    f(210, "C7.3.7"),
    p(210, "Nel caso in cui T* < T_C la domanda in spostamento per il sistema anelastico è maggiore di quella di un sistema elastico di pari periodo (v. Figura C7.3.2b) e si ottiene da quest’ultima mediante l’espressione:"),
    f(210, "C7.3.8"),
    p(210, "dove q* = S_e(T*)m*/F*_y è il rapporto tra la forza di risposta elastica e la forza di snervamento del sistema equivalente."),
    p(210, "Se risulta q* ≤ 1 allora si ha d*_{max} = d*_{e,max}."),
    fig(210, "C7.3.2", reg(75, 490, 450, 160)),
    h(210, "Metodo B"),
    p(210, "In questo metodo il punto di prestazione e lo spostamento atteso per un dato livello di azione sono valutati attraverso un processo iterativo."),
    p(210, "Si converte lo spettro di domanda nel relativo spettro sul piano ADRS, in cui le accelerazioni spettrali S_e sono rappresentate in funzione degli spostamenti spettrali S_{De}, ottenuti attraverso l’espressione [3.2.10] delle NTC."),
    p(211, "Si effettua una prima stima del punto di prestazione ipotizzando, generalmente, che lo spostamento d*_{max} sia pari a quello di una struttura elastica avente la stessa rigidezza iniziale della struttura analizzata:"),
    f(211, "C7.3.9"),
    p(211, "Stimato il punto di prestazione (F*_{max},d*_{max}) sulla curva di capacità del sistema equivalente F*-d*, ad essa si sostituisce una curva bilineare equivalente, in termini energetici, ottenuta adottando un primo tratto con pendenza pari alla rigidezza iniziale della struttura ed identificando la forza F*_y e la pendenza del tratto F*_y-d*_{max} imponendo l’uguaglianza dell’area sottesa dalle due curve, come mostrato in Figura C7.3.3. Per rappresentare la curva bilineare F*-d* sul piano ADRS, occorre dividere le forze per m*."),
    fig(211, "C7.3.3", reg(175, 205, 245, 180)),
    p(211, "A partire dalla curva bilinearizzata così definita, si calcola lo smorzamento viscoso equivalente associato, espresso in percentuale, attraverso la [C7.3.10]:"),
    f(211, "C7.3.10"),
    p(211, "dove il coefficiente k tiene conto delle capacità dissipative della struttura ed in particolare delle caratteristiche del ciclo di isteresi."),
    p(211, "Indicativamente, si possono assumere i seguenti valori, a seconda della differente tipologia strutturale:"),
    li(211, "strutture a elevata capacità dissipativa (caratterizzate da cicli di isteresi stabili e ragionevolmente ampi): k = 1;"),
    li(211, "strutture a moderata capacità dissipativa (caratterizzate da cicli di isteresi con moderata riduzione dell’area): k = 0,66;"),
    li(211, "strutture a bassa capacità dissipativa (caratterizzate da cicli di isteresi con pinching elevato e da una sostanziale riduzione dell’area): k = 0,33;"),
    li(211, "strutture dotate di appositi dispositivi di dissipazione: va valutata l’energia dissipata complessivamente, attribuendo alla struttura e al sistema di dissipazione il valore di k corrispondente all’effettiva capacità di dissipazione."),
    p(211, "Grazie al coefficiente ξ_eq così calcolato si abbatte, utilizzando l’espressione [3.2.4] delle NTC, lo spettro di domanda."),
    p(211, "L’intersezione, sul piano ADRS, fra lo spettro di domanda abbattuto e la curva di capacità del sistema equivalente fornisce il nuovo punto di prestazione, come mostrato in Figura C7.3.4; se esso è caratterizzato da uno spostamento d*_{max}^{(1)} ragionevolmente prossimo a quello stimato in partenza d*_{max}^{(0)}, la procedura iterativa ha termine e si ha la soluzione."),
    fig(212, "C7.3.4", reg(190, 75, 250, 195)),
    p(212, "La procedura, iterativa, è ripetuta fino a convergenza della soluzione, entro la tolleranza stabilita, secondo lo schema di Figura C7.3.5."),
    fig(212, "C7.3.5", reg(75, 300, 450, 270)),
    p(212, "Una volta trovata la domanda in spostamento, d*_{max}, per lo stato limite in esame si verifica la compatibilità degli spostamenti, per gli elementi/meccanismi duttili, e delle resistenze, per gli elementi/meccanismi fragili."),
    p(212, "L’analisi non lineare statica, condotta nei modi previsti dalle NTC, può sottostimare significativamente le deformazioni sui lati più rigidi e resistenti di strutture flessibili torsionalmente, cioè strutture in cui il modo di vibrare torsionale abbia un periodo superiore ad almeno uno dei modi di vibrare principali traslazionali. Per tener conto di questo effetto, tra le distribuzioni secondarie delle forze occorre scegliere la distribuzione adattiva."),
    p(212, "Per ciascuna direzione, devono essere eseguite due analisi distinte, applicando l’azione sismica in entrambi i possibili versi e considerando gli effetti più sfavorevoli derivanti da ciascuna delle due analisi."),
];

const c735: Spec[] = [
    h(213, "C7.3.5 RISPOSTA ALLE DIVERSE COMPONENTI DELL’AZIONE SISMICA ED ALLA VARIABILITÀ SPAZIALE DEL MOTO"),
    p(213, "Nel caso di analisi statiche non lineari è possibile applicare separatamente ciascuna delle due componenti orizzontali (insieme a quella verticale ove necessario ed agli spostamenti relativi prodotti della variabilità spaziale del moto ove necessario), riconducendo quindi la valutazione unitaria degli effetti massimi ai valori più sfavorevoli così ottenuti."),
    p(213, "Quando la variabilità spaziale del moto può avere effetti significativi sulla risposta strutturale essa deve essere considerata."),
    p(213, "In generale l’effetto principale della variabilità è dovuto ai notevoli spostamenti relativi che essa genera alla base delle strutture, mentre la risposta dinamica risulta inferiore a quella ottenuta con moto sincrono. In questi casi risulta pertanto cautelativa la valutazione della risposta sovrapponendo l’effetto della distorsione degli appoggi a terra alla risposta all’azione sincrona, come indicato al punto 3.2.4."),
    p(213, "Qualora si utilizzi l’analisi non lineare si potranno cautelativamente imporre le distorsioni alla base ed effettuare l’analisi dinamica sincrona."),
    p(213, "In alternativa è possibile imporre alla base della costruzione serie temporali del moto sismico differenziate ma coerenti tra loro, in accordo con le caratteristiche dei siti ove sono situati i punti di appoggio della costruzione."),
    p(213, "Quest’ultimo criterio, apparentemente più rigoroso, presentando difficoltà operative nella effettiva definizione delle storie temporali, richiede una notevole cautela da parte del progettista."),
    p(213, "In ogni caso si deve considerare anche la risposta al moto sincrono."),
];

const c736: Spec[] = [
    h(213, "C7.3.6 RISPETTO DEI REQUISITI NEI CONFRONTI DEGLI STATI LIMITE"),
    p(213, "In generale, la progettazione ha un’articolazione di tipo multi-prestazionale e multi-strategico. I diversi livelli prestazionali sono associati ai diversi stati limite, mentre le diverse strategie sono associate alla destinazione d’uso della costruzione."),
    p(213, "La Tab. 7.3.III della norma sintetizza le diverse verifiche da eseguire per le costruzioni a comportamento dissipativo; nella Tabella C7.3.I, si esplicitano con maggiore dettaglio le verifiche riportate nella Tabella 7.3.III della norma, fornendo anche una descrizione sintetica della prestazione associata a ciascuno stato limite e indicando, per ogni elemento costruttivo, il riferimento al paragrafo della norma a cui si riferisce ciascuna delle verifiche."),
    p(213, "La tabella C7.3.I fornisce, per ciascuno Stato Limite e per ciascun tipo di elemento (strutturale, non strutturale o impianto), la descrizione delle prestazioni in termini di danno, capacità ultima (resistenza o duttilità) o funzionamento; essa indica, inoltre, il tipo di verifica, in termini di confronto tra capacità e domanda, e il tipo di elemento su cui la verifica deve essere eseguita, per soddisfare il requisito prestazionale dato."),
    { kind: "table-ref", page: 213, number: "C7.3.I", label: "Tabella C7.3.I" },
];
const c7361: Spec[] = [
    h(214, "C7.3.6.1 ELEMENTI STRUTTURALI (ST)"),
    p(214, "Nelle verifiche di cui al § 7.3.6.1, nel caso di analisi lineari (§ 7.3.3.) si assume d_r = d_{r,E}.¹⁰"),
    p(214, "In merito alle “Verifiche di Rigidezza (RIG)”, per le tamponature duttili di cui al punto a) e per le tamponature di cui al punto b), va verificato sperimentalmente che il raggiungimento dei rispettivi limiti di interpiano 0,0075h e 0,0100h siano ottenuti sulla parte ascendente della curva di comportamento Forza-Spostamento relativo, oppure sul ramo discendente verificando però che la perdita di resistenza sia inferiore al 10% del massimo. Inoltre, durante la prova non si dovranno riscontrare significativi danneggiamenti sugli elementi."),
    p(214, "Per tamponature duttili si intendono elementi non strutturali che sviluppano un comportamento plastico o incrudente al di là del limite elastico e deformazioni significativamente maggiori delle deformazioni al limite elastico."),
];
const c7362: Spec[] = [
    h(214, "C7.3.6.2 ELEMENTI NON STRUTTURALI (NS)"),
    p(214, "Il controllo del danno negli elementi non strutturali si effettua, in maniera indiretta, intervenendo sulla rigidezza degli elementi strutturali al fine di contenere gli spostamenti di interpiano, come indicato al § 7.3.6.1. Devono essere eseguite invece verifiche dirette in termini di stabilità. La prestazione, consistente nell’evitare la possibile espulsione delle tamponature sotto l’azione della F_a, si può ritenere conseguita con l’inserimento di leggere reti da intonaco sui due lati della muratura, collegate tra loro ed alle strutture circostanti a distanza non superiore a 500 mm sia in direzione orizzontale sia in direzione verticale, ovvero con l’inserimento di elementi di armatura orizzontale nei letti di malta, a distanza non superiore a 500 mm. La domanda sismica F_a si determina secondo le indicazioni del § 7.2.3 della norma e del § C7.2.3."),
];

const c736Table = {
    id: aid("table", "C7.3.I"), unitId: uid("C7.3.6"), officialNumber: "C7.3.I", pdfPage: 213,
    caption: "Tabella C7.3.I – Stati Limite di elementi strutturali primari, elementi non strutturali e impianti: descrizione delle prestazioni e corrispondenti verifiche",
    columnCount: 13,
    headers: [
        [{ text: "STATI LIMITE", colSpan: 2 }, { text: "Descrizione della prestazione", colSpan: 2 }, { text: "ST", colSpan: 3 }, { text: "NS" }, { text: "IM", colSpan: 2 }, { text: "Classe d’uso", colSpan: 3 }],
        [{ text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "RIG" }, { text: "RES" }, { text: "DUT (SPO)" }, { text: "STA" }, { text: "FUN" }, { text: "STA" }, { text: "I" }, { text: "II" }, { text: "III / IV" }],
    ],
    rows: [
        [{ text: "SLE", rowSpan: 4 }, { text: "SLO", rowSpan: 2 }, { text: "NS\nST" }, { text: "Limitazione del danno degli elementi non strutturali, o delle pareti per le costruzioni di muratura" }, { text: "§ 7.3.6.1" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }],
        [{ text: "IM" }, { text: "Funzionamento degli impianti" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "§ 7.3.6.3" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }],
        [{ text: "SLD", rowSpan: 2 }, { text: "ST" }, { text: "Controllo del danno degli elementi strutturali" }, { text: "" }, { text: "§ 7.3.1" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }],
        [{ text: "NS\nST" }, { text: "Controllo del danno degli elementi non strutturali, o delle pareti per le costruzioni di muratura" }, { text: "§ 7.3.6.1" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }, { text: "X" }, { text: "" }],
        [{ text: "SLU", rowSpan: 5 }, { text: "SLV", rowSpan: 3 }, { text: "ST" }, { text: "Livello di danno degli elementi strutturali coerente con il fattore di comportamento adottato, assenza di rotture fragili e meccanismi locali/globali instabili" }, { text: "" }, { text: "" }, { text: "§ 7.3.6.1" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }, { text: "X" }, { text: "X" }],
        [{ text: "NS" }, { text: "Assenza di crolli degli elementi non strutturali pericolosi per l’incolumità, pur in presenza di danni diffusi" }, { text: "" }, { text: "" }, { text: "" }, { text: "§ 7.3.6.3" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }, { text: "X" }],
        [{ text: "IM" }, { text: "Capacità ultima degli impianti e dei collegamenti" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "§ 7.3.6.3" }, { text: "" }, { text: "X" }, { text: "X" }],
        [{ text: "SLC", rowSpan: 2 }, { text: "ST" }, { text: "Margine di sicurezza sufficiente per azioni verticali ed esiguo per azioni orizzontali" }, { text: "" }, { text: "" }, { text: "§ 7.3.6.1\n(DUT)" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }, { text: "X" }],
        [{ text: "ST" }, { text: "Capacità di spostamento dei dispositivi nelle costruzioni con isolamento sismico" }, { text: "" }, { text: "" }, { text: "§ 7.10.6.2.2\n(SPO)" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "X" }, { text: "X" }],
    ], notes: ["La tabella continua a pagina PDF 214; le righe SLC sono state verificate sul render ufficiale di quella pagina."],
};
for (const row of c736Table.rows) {
    for (const cell of row as any[]) {
        if (!("text" in cell)) cell.text = "";
    }
}

const formulas = [
    ["C7.3.1", "C7.3.1", 207, "q'=q_{ND}\\frac{S_{e,SLV}(T_1)}{S_{e,SLD}(T_1)}"],
    ["C7.3.2", "C7.3.3.2", 208, "T_1=C_1H^{3/4}"],
    ["C7.3.3", "C7.3.4.2", 209, "F^*=F_b/\\Gamma"],
    ["C7.3.4", "C7.3.4.2", 209, "d^*=d_c/\\Gamma"],
    ["C7.3.5", "C7.3.4.2", 209, "\\Gamma=\\frac{\\boldsymbol{\\phi}^{T}\\mathbf{M}\\boldsymbol{\\tau}}{\\boldsymbol{\\phi}^{T}\\mathbf{M}\\boldsymbol{\\phi}}"],
    ["C7.3.6", "C7.3.4.2", 210, "T^*=2\\pi\\sqrt{\\frac{m^*}{k^*}}"],
    ["C7.3.7", "C7.3.4.2", 210, "d^*_{max}=d^*_{e,max}=S_{De}(T^*)"],
    ["C7.3.8", "C7.3.4.2", 210, "d^*_{max}=\\frac{d^*_{e,max}}{q^*}\\left[1+(q^*-1)\\frac{T_C}{T^*}\\right]\\ge d^*_{e,max}"],
    ["C7.3.9", "C7.3.4.2", 211, "d_{max}^{*(0)}=d_e"],
    ["C7.3.10", "C7.3.4.2", 211, "\\xi_{eq}^{(1)}=k\\frac{63.7\\left(F_y^{*(0)}d_{max}^{*(0)}-F_{max}^{*(0)}d_y^{*(0)}\\right)}{F_{max}^{*(0)}d_{max}^{*(0)}}+5"],
] as const;
const figures = [
    ["C7.3.1", "C7.3.4.2", 209, "Figura C7.3.1 – Sistema e diagramma bilineare equivalente", [75, 435, 475, 605]],
    ["C7.3.2", "C7.3.4.2", 210, "Figure C7.3.2a–b – Spostamento di riferimento per T ≥ T_C e T < T_C", [75, 490, 525, 650]],
    ["C7.3.3", "C7.3.4.2", 211, "Figura C7.3.3 – Bilinearizzazione equivalente", [175, 205, 420, 385]],
    ["C7.3.4", "C7.3.4.2", 212, "Figura C7.3.4 – Individuazione del Punto di prestazione", [190, 75, 440, 270]],
    ["C7.3.5", "C7.3.4.2", 212, "Figura C7.3.5 – Diagramma di flusso per la procedura iterativa di ricerca del punto di prestazione", [75, 300, 525, 570]],
] as const;

async function appendC726() {
    const path = join(unitsPath, "c7.2.6.json");
    const unit = JSON.parse(await readFile(path, "utf8"));
    const id = uid("C7.2.6");
    const existingStart = unit.blocks.findIndex((candidate: { evidence?: { pdfPage?: number } }) => candidate.evidence?.pdfPage === 207);
    const start = existingStart >= 0 ? existingStart : unit.blocks.length;
    const extra = c726Continuation.map((spec, index) => block(id, spec, start + index));
    unit.blocks.splice(start, unit.blocks.length - start, ...extra);
    unit.assets.figureIds = [...new Set([...unit.assets.figureIds, aid("figure", "C7.2.5")])];
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

const units = [
    ["C7.3", "METODI DI ANALISI E CRITERI DI VERIFICA", c73], ["C7.3.1", "ANALISI LINEARE O NON LINEARE", c731], ["C7.3.3", "ANALISI LINEARE DINAMICA O STATICA", c733],
    ["C7.3.3.1", "ANALISI LINEARE DINAMICA", c7331], ["C7.3.3.2", "ANALISI LINEARE STATICA", c7332], ["C7.3.4", "ANALISI NON LINEARE DINAMICA O STATICA", c734],
    ["C7.3.4.1", "ANALISI NON LINEARE DINAMICA", c7341], ["C7.3.4.2", "ANALISI NON LINEARE STATICA", c7342], ["C7.3.5", "RISPOSTA ALLE DIVERSE COMPONENTI DELL’AZIONE SISMICA ED ALLA VARIABILITÀ SPAZIALE DEL MOTO", c735],
    ["C7.3.6", "RISPETTO DEI REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", c736], ["C7.3.6.1", "ELEMENTI STRUTTURALI (ST)", c7361], ["C7.3.6.2", "ELEMENTI NON STRUTTURALI (NS)", c7362],
] as const;

await appendC726();
for (const [number, title, specs] of units) await writeFile(join(unitsPath, `${number.toLowerCase()}.json`), `${JSON.stringify(makeRecord(number, title, specs), null, 2)}\n`, "utf8");
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C7.3", sourceId,
    status: "transcribed-unreviewed",
    formulas: formulas.map(([number, unit, page, latex]) => ({ id: aid("formula", number), unitId: uid(unit), officialNumber: number, pdfPage: page, latex })),
    tables: [c736Table],
    figures: figures.map(([number, unit, page, caption, box]) => ({ id: aid("figure", number), unitId: uid(unit), officialNumber: number, pdfPage: page, caption, alt: caption, imagePath: `figures/circ2019/fig${number.toLowerCase()}.png`, region: reg(box[0], box[1], box[2] - box[0], box[3] - box[1]), sha256: "0".repeat(64) })),
};
await writeFile(join(root, "corpus", "assets", "circ2019", "7.3.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const asset72Path = join(root, "corpus", "assets", "circ2019", "7.2.json");
const asset72 = JSON.parse(await readFile(asset72Path, "utf8"));
asset72.figures = asset72.figures.filter((candidate: { officialNumber?: string }) => candidate.officialNumber !== "C7.2.5");
asset72.figures.push({ id: aid("figure", "C7.2.5"), unitId: uid("C7.2.6"), officialNumber: "C7.2.5", pdfPage: 207, caption: "Figura C7.2.5 – Dipendenza di α_f dal carico assiale N e dal fattore di comportamento q", alt: "Figura C7.2.5 – Dipendenza di α_f dal carico assiale N e dal fattore di comportamento q", imagePath: "figures/circ2019/figc7.2.5.png", region: reg(117, 178, 360, 175), sha256: "0".repeat(64) });
await writeFile(asset72Path, `${JSON.stringify(asset72, null, 2)}\n`, "utf8");
console.log(`circ7-step2: generated ${units.length} units, ${formulas.length} formulas and ${figures.length} figures; completed C7.2.6`);
