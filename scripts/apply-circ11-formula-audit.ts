/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const manifestPath = join(repoRoot, "corpus", "assets", "circ2019", "C11-step2.json");
const profile = "circ11-formula-audit-0.1.0";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const unitId = (number: string): string => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (suffix: string): string => `urn:structural-codes:it:asset:formula:circ2019:${suffix}`;

async function loadUnit(number: string): Promise<any> {
    return JSON.parse(await readFile(join(unitDir, `${number.toLowerCase()}.json`), "utf8"));
}

function appendTransformation(block: any, note: string): any[] {
    const transformations = block.evidence?.transformations ?? [];
    if (transformations.some((item: any) => item.ruleVersion === profile && item.note === note)) return transformations;
    return [...transformations, { operation: "manual-correction", ruleVersion: profile, note }];
}

function inlineSegments(value: string, terms: Array<[string, string]>): any[] {
    const ordered = [...terms].sort((a, b) => b[0].length - a[0].length);
    const result: any[] = [];
    let cursor = 0;
    while (cursor < value.length) {
        let best: { index: number; text: string; latex: string } | undefined;
        for (const [text, latex] of ordered) {
            const index = value.indexOf(text, cursor);
            if (index < 0) continue;
            if (!best || index < best.index || (index === best.index && text.length > best.text.length)) best = { index, text, latex };
        }
        if (!best) {
            result.push({ kind: "text", value: value.slice(cursor) });
            break;
        }
        if (best.index > cursor) result.push({ kind: "text", value: value.slice(cursor, best.index) });
        result.push({ kind: "math", value: best.text, latex: best.latex });
        cursor = best.index + best.text.length;
    }
    return result;
}

function correctBlock(unit: any, startsWith: string, normalized: string, terms: Array<[string, string]>): void {
    const block = unit.blocks.find((candidate: any) => candidate.text?.normalized?.startsWith(startsWith))
        ?? unit.blocks.find((candidate: any) => candidate.text?.normalized === normalized);
    if (!block) throw new Error(`Blocco non trovato in ${unit.numbering.official}: ${startsWith}`);
    const note = "Notazione matematica inline ricostruita mediante confronto con il render ufficiale ad alta risoluzione.";
    block.text = {
        raw: block.text.raw,
        normalized,
        normalizationVersion: profile,
        inline: inlineSegments(normalized, terms),
    };
    block.evidence = {
        ...block.evidence,
        transformations: appendTransformation(block, note),
        normalizedSha256: sha256(normalized),
    };
}

function installDisplayGroup(unit: any, prefixes: string[], id: string, note: string): void {
    if (unit.blocks.some((block: any) => block.assetId === id)) return;
    const first = unit.blocks.findIndex((block: any) => block.text?.normalized?.startsWith(prefixes[0]));
    if (first < 0 || !prefixes.every((prefix, offset) => unit.blocks[first + offset]?.text?.normalized?.startsWith(prefix))) {
        throw new Error(`Gruppo formula non trovato in ${unit.numbering.official}`);
    }
    const original = unit.blocks[first];
    unit.blocks.splice(first, prefixes.length, {
        blockId: original.blockId,
        kind: "formula-ref",
        origin: "official",
        assetId: id,
        evidence: {
            ...original.evidence,
            transformations: appendTransformation(original, note),
        },
    });
    unit.assets.formulaIds = [...new Set([...unit.assets.formulaIds, id])];
    const issueId = `${unit.numbering.official.toLowerCase().replaceAll(".", "-")}-formula-audit-review`;
    if (!unit.workflow.openIssues.some((issue: any) => issue.issueId === issueId)) {
        unit.workflow.openIssues.push({
            issueId,
            type: "asset-review",
            severity: "blocking",
            note: "Gruppo di disuguaglianze trascritto dal PDF ufficiale; resta richiesta la revisione umana indipendente.",
        });
    }
}

function installFormulaGroup(unit: any, firstPrefix: string, secondPrefix: string, id: string): void {
    installDisplayGroup(unit, [firstPrefix, secondPrefix], id, "Due disuguaglianze consecutive conservate come unico gruppo display, inclusa la numerazione tipografica 1) e 2).");
}

function mergeTextBlocks(unit: any, prefixes: string[], normalized: string, terms: Array<[string, string]>): void {
    const firstPrefix = prefixes[0];
    if (!firstPrefix) throw new Error(`Nessun prefisso fornito per ${unit.numbering.official}`);
    const first = unit.blocks.findIndex((block: any) => block.text?.normalized?.startsWith(firstPrefix));
    if (first < 0) throw new Error(`Primo blocco da unire non trovato in ${unit.numbering.official}`);
    if (unit.blocks[first].text.normalized === normalized) {
        correctBlock(unit, firstPrefix, normalized, terms);
        return;
    }
    if (!prefixes.every((prefix, offset) => unit.blocks[first + offset]?.text?.normalized?.startsWith(prefix))) {
        throw new Error(`Sequenza di blocchi da unire non trovata in ${unit.numbering.official}`);
    }
    const selected = unit.blocks.slice(first, first + prefixes.length);
    const original = selected[0];
    const raw = selected.map((block: any) => block.text.raw).join("\n");
    const note = "Ricongiunti blocchi creati da ritorni a capo tipografici che interrompevano un’unica espressione matematica.";
    original.text = {
        raw,
        normalized,
        normalizationVersion: profile,
        inline: inlineSegments(normalized, terms),
    };
    original.evidence = {
        ...original.evidence,
        transformations: appendTransformation(original, note),
        rawSha256: sha256(raw),
        normalizedSha256: sha256(normalized),
    };
    unit.blocks.splice(first, prefixes.length, original);
}

function reindex(unit: any): void {
    unit.blocks.forEach((block: any, index: number) => {
        block.blockId = `${unit.id}#block-${index === 0 ? "heading" : String(index).padStart(3, "0")}`;
    });
    unit.titleBlockId = unit.blocks[0].blockId;
}

const c1121 = await loadUnit("C11.2.1");
correctBlock(c1121, "Per quanto attiene la classe di resistenza", "Per quanto attiene la classe di resistenza, la stessa è individuata esclusivamente dai valori caratteristici delle resistenze cilindrica fck e cubica Rck a compressione uniassiale, misurate su provini normalizzati e cioè rispettivamente su cilindri di diametro 150 mm", [["fck", "f_{ck}"], ["Rck", "R_{ck}"], ["150 mm", "150\\,\\mathrm{mm}"]]);
correctBlock(c1121, "e di altezza 300 mm", "e di altezza 300 mm e su cubi di spigolo 150 mm.", [["300 mm", "300\\,\\mathrm{mm}"], ["150 mm", "150\\,\\mathrm{mm}"]]);

const c1124 = await loadUnit("C11.2.4");
correctBlock(c1124, "Premesso che se il prelievo", c1124.blocks[2].text.normalized, [["20%", "20\\%"]]);
correctBlock(c1124, "In questo caso il laboratorio", c1124.blocks[3].text.normalized, [["20%", "20\\%"]]);

const c11251 = await loadUnit("C11.2.5.1");
correctBlock(c11251, "Ai fini di un efficace controllo", c11251.blocks[1].text.normalized, [["100 m3", "100\\,\\mathrm{m^3}"]]);
correctBlock(c11251, "Premesso che Rc", c11251.blocks[2].text.normalized, [["Rc", "R_c"]]);
installFormulaGroup(c11251, "Rc,min", "Rcm28", formulaId("c11.2.5.1.a"));
correctBlock(c11251, "Rc,min è", "Rc,min è il valore di resistenza di prelievo Rc minore fra i tre prelievi;", [["Rc,min", "R_{c,\\min}"], ["Rc", "R_c"]]);
correctBlock(c11251, "Rcm28 è", c11251.blocks.find((block: any) => block.text?.normalized?.startsWith("Rcm28 è")).text.normalized, [["Rcm28", "R_{cm28}"]]);
correctBlock(c11251, "Rck è", "Rck è il valore caratteristico di resistenza di progetto.", [["Rck", "R_{ck}"]]);

const c11252 = await loadUnit("C11.2.5.2");
correctBlock(c11252, "superiore a 1500", "superiore a 1500 m3. Il controllo di Tipo B è costituito quindi da almeno 15 prelievi, ciascuno dei quali eseguito su 100 m3 di getto", [["1500 m3", "1500\\,\\mathrm{m^3}"], ["100 m3", "100\\,\\mathrm{m^3}"]]);
installFormulaGroup(c11252, "Rc,min", "Rcm28", formulaId("c11.2.5.2.a"));
correctBlock(c11252, "con s =", "con s = scarto quadratico medio.", [["s", "s"]]);
correctBlock(c11252, "Qualora la quantità", "Qualora la quantità di miscela omogenea da impiegare nell’opera sia maggiore di 1500 m3, ai fini del controllo si consiglia la seguente procedura:", [["1500 m3", "1500\\,\\mathrm{m^3}"]]);
correctBlock(c11252, "I requisiti prestazionali", "I requisiti prestazionali più stringenti, adottati per i controlli di Tipo B, sono finalizzati a garantire la costanza prestazionale della miscela. In tal senso viene anche precisato che non possono essere accettati calcestruzzi con coefficiente di variazione (s/Rm)", [["s/Rm", "s/R_m"]]);
correctBlock(c11252, "superiore a 0,3", "superiore a 0,3, dove s è lo scarto quadratico medio e Rm è la resistenza media dei prelievi (N/mm2). Inoltre, la norma prevede che con coefficiente di variazione superiore a 0,15 occorrono controlli più accurati, integrati con prove complementari di cui al § 11.2.7.", [["s", "s"], ["Rm", "R_m"], ["N/mm2", "\\mathrm{N/mm^2}"]]);

const c1126 = await loadUnit("C11.2.6");
correctBlock(c1126, "Sotto il profilo operativo", "Sotto il profilo operativo, effettuato il prelievo di un determinato numero di carote ed eseguita sulle stesse la prova di compressione con le procedure previste, si determina il valore caratteristico della resistenza strutturale cilindrica in situ, definita come fck,is. A tale riguardo, le norme prevedono che la resistenza caratteristica in situ va calcolata in accordo alle Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera elaborate e pubblicate dal Servizio Tecnico Centrale del Consiglio Superiore dei Lavori Pubblici, edizione 2017, nonché secondo quanto previsto nella norma UNI EN 13791:2008 (§§ 7.3.2 e 7.3.3).", [["fck,is", "f_{ck,is}"]]);
correctBlock(c1126, "In particolare, le Linee Guida", "In particolare, le Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera sottolineano come l’estrazione delle carote dalla struttura, per quanto condotta con le attenzioni sopra raccomandate, produca comunque un disturbo al calcestruzzo, per cui nel risultato di prova sulla carota si manifesta un decremento di resistenza. Per tenere conto di tale decremento, le citate Linee Guida hanno introdotto un Fattore di danno Fd, moltiplicativo della resistenza ottenuta dalla prova; il valore di Fd decresce all’aumentare della resistenza fcarota rilevata sulla specifica carota, come indicato nella tabella seguente:", [["Fd", "F_d"], ["fcarota", "f_{\\mathrm{carota}}"]]);
correctBlock(c1126, "Le medesime Linee Guida", c1126.blocks.find((block: any) => block.text?.normalized?.startsWith("Le medesime Linee Guida")).text.normalized, [["H/D = 1", "H/D=1"], ["± 0,05", "\\pm0{,}05"], ["H/D = 2", "H/D=2"], ["H/D", "H/D"]]);
correctBlock(c1126, "fcarota *", "fcarota * Fd = Rc,is, nel caso di provini, ottenuti da carote con rapporto H/D=1;", [["fcarota * Fd = Rc,is", "f_{\\mathrm{carota}} * F_d = R_{c,is}"], ["H/D=1", "H/D=1"]]);
correctBlock(c1126, "f carota *", "fcarota * Fd = fc,is, nel caso di provini, ottenuti da carote con rapporto H/D=2.", [["fcarota * Fd = fc,is", "f_{\\mathrm{carota}} * F_d = f_{c,is}"], ["H/D=2", "H/D=2"]]);
correctBlock(c1126, "Ciò premesso, il valore", "Ciò premesso, il valore della resistenza caratteristica in opera fck,is può essere determinata considerando l’approccio B se il numero di carote è minore di 15, oppure l’approccio A se il numero di carote è ≥ 15, secondo quanto previsto nella norma UNI EN 13791:2008 (§§ 7.3.2 e 7.3.3).", [["fck,is", "f_{ck,is}"], ["≥ 15", "\\ge 15"]]);
correctBlock(c1126, "Determinato il valore", c1126.blocks.find((block: any) => block.text?.normalized?.startsWith("Determinato il valore")).text.normalized, [["85%", "85\\%"]]);

const c1128 = await loadUnit("C11.2.8");
correctBlock(c1128, "Si precisa, inoltre", c1128.blocks[4].text.normalized, [["1500 m³", "1500\\,\\mathrm{m^3}"]]);
correctBlock(c1128, "Nei cantieri di opere", c1128.blocks[5].text.normalized, [["1.500 m³", "1{.}500\\,\\mathrm{m^3}"]]);

const c11212 = await loadUnit("C11.2.12");
correctBlock(c11212, "Al riguardo occorre precisare", c11212.blocks[2].text.normalized, [["0.3%", "0.3\\%"]]);

const c11317 = await loadUnit("C11.3.1.7");
correctBlock(c11317, "La necessaria attenzione", c11317.blocks[5].text.normalized, [["– 5 °C", "-5\\,{}^\\circ\\mathrm{C}"], ["5°C", "5\\,{}^\\circ\\mathrm{C}"]]);

const c11321 = await loadUnit("C11.3.2.1");
correctBlock(c11321, "La norma stabilisce", "La norma stabilisce, preliminarmente, i valori nominali della tensione di snervamento fy,nom e di rottura ft,nom che possono essere", [["fy,nom", "f_{y,\\mathrm{nom}}"], ["ft,nom", "f_{t,\\mathrm{nom}}"]]);
correctBlock(c11321, "Vengono quindi fissati", "Vengono quindi fissati i requisiti che gli acciai devono possedere per rispondere alle attese previste nel calcolo. Nella Tabella 11.3.1.b delle NTC si stabilisce infatti che i valori caratteristici con frattile 5%, fyk e ftk, ottenuti mediante prove su un numero", [["5%", "5\\%"], ["fyk", "f_{yk}"], ["ftk", "f_{tk}"]]);
correctBlock(c11321, "significativo di saggi", c11321.blocks[4].text.normalized, [["450 N/mm²", "450\\,\\mathrm{N/mm^2}"], ["540 N/mm²", "540\\,\\mathrm{N/mm^2}"]]);
correctBlock(c11321, "il valore caratteristico con frattile 10% del rapporto fra il valore della tensione di snervamento", "il valore caratteristico con frattile 10% del rapporto fra il valore della tensione di snervamento effettiva, riscontrata sulla barra, ed il valore nominale (fy/fy,nom)k non sia superiore a 1,25;", [["10%", "10\\%"], ["(fy/fy,nom)k", "\\left(f_y/f_{y,\\mathrm{nom}}\\right)_k"]]);
correctBlock(c11321, "il valore caratteristico con frattile 10% del rapporto fra il valore della tensione di rottura", "il valore caratteristico con frattile 10% del rapporto fra il valore della tensione di rottura e la tensione di snervamento (ft/fy)k sia compreso fra 1,15 e 1,35;", [["10%", "10\\%"], ["(ft/fy)k", "\\left(f_t/f_y\\right)_k"]]);
correctBlock(c11321, "il valore caratteristico con frattile 10% dell’allungamento", "il valore caratteristico con frattile 10% dell’allungamento al massimo sforzo (Agt)k non sia inferiore al 7,5%.", [["10%", "10\\%"], ["(Agt)k", "(A_{gt})_k"], ["7,5%", "7{,}5\\%"]]);
correctBlock(c11321, "Al fine di garantire", c11321.blocks[11].text.normalized, [["90°", "90^\\circ"]]);

const c11323 = await loadUnit("C11.3.2.3");
correctBlock(c11323, "In relazione alle prove", c11323.blocks[1].text.normalized, [["100 ± 10 °C", "100\\pm10\\,{}^\\circ\\mathrm{C}"]]);
correctBlock(c11323, "La prova di piegamento", c11323.blocks[2].text.normalized, [["10°C", "10\\,{}^\\circ\\mathrm{C}"], ["35 °C", "35\\,{}^\\circ\\mathrm{C}"]]);

const c113212 = await loadUnit("C11.3.2.12");
correctBlock(c113212, "Il campionamento è costituito", c113212.blocks[2].text.normalized, [["30 t", "30\\,\\mathrm{t}"]]);
correctBlock(c113212, "Oltre alla verifica", "Oltre alla verifica di quanto riportato nelle Tabelle 11.3.VII delle NTC e con riferimento al § 4.1.2.1.2.2 delle NTC, deve farsi presente, in merito al controllo del rapporto rottura/snervamento (ft/fy) che se il progettista ha adottato il modello costitutivo a) della relativa Figura 4.1.3, utilizzando un valore del rapporto di sovraresistenza k = (ft/fy)k maggiore di 1,15, il Direttore dei lavori", [["(ft/fy)", "(f_t/f_y)"], ["k = (ft/fy)k", "k=\\left(f_t/f_y\\right)_k"]]);
correctBlock(c113212, "deve accertare", "deve accertare, mediante le previste prove di accettazione in cantiere e, se necessario, anche mediante prove aggiuntive, che il valore caratteristico del rapporto ft/fy risulti non inferiore a quello stabilito dal progettista.", [["ft/fy", "f_t/f_y"]]);
correctBlock(c113212, "È sempre opportuno", "È sempre opportuno che i diversi valori del rapporto snervamento/snervamento nominale (fy/fynom), determinato sui singoli saggi, vengano riportati nei certificati rilasciati dai laboratori di cui all’art.59 del D.P.R. n. 380/2001, in relazione al comportamento strutturale di progetto (non-dissipativo o dissipativo) e alla classe di acciaio utilizzata. Il Direttore dei lavori deve infatti accertare, mediante le previste prove di cantiere e, se necessario, anche mediante prove aggiuntive, che il valore del predetto rapporto snervamento/snervamento nominale (fy/fynom) risulti sempre non minore di 0.94 (fy,min ≥ 425 N/mm²) e non maggiore di 1,27 (fy,max ≤ 572 N/mm²).", [["(fy/fynom)", "(f_y/f_{y,\\mathrm{nom}})"], ["0.94 (fy,min ≥ 425 N/mm²)", "0.94\\ \\left(f_{y,\\min}\\ge425\\,\\mathrm{N/mm^2}\\right)"], ["1,27 (fy,max ≤ 572 N/mm²)", "1{,}27\\ \\left(f_{y,\\max}\\le572\\,\\mathrm{N/mm^2}\\right)"]]);

const c1133521 = await loadUnit("C11.3.3.5.2.1");
correctBlock(c1133521, "La norma prevede", c1133521.blocks[1].text.normalized, [["r, L, D e t", "r,\\,L,\\,D\\ \\text{e}\\ t"]]);
correctBlock(c1133521, "Quanto sopra si applica", c1133521.blocks[2].text.normalized, [["r, D e t", "r,\\,D\\ \\text{e}\\ t"]]);

const c11341121 = await loadUnit("C11.3.4.11.2.1");
correctBlock(c11341121, "Per gli acciai da qualificare", "Per gli acciai da qualificare secondo il punto B del § 11.1 delle NTC, si possono assumere nei calcoli i valori nominali delle tensioni caratteristiche di snervamento fyk e rottura ftk riportati nella seguente tabella C11.3.4.11.2.I. Tali acciai potranno essere", [["fyk", "f_{yk}"], ["ftk", "f_{tk}"]]);
correctBlock(c11341121, "impiegati nella gamma", c11341121.blocks[6].text.normalized, [["0,6 a 15 mm", "0{,}6\\text{ a }15\\,\\mathrm{mm}"]]);
installDisplayGroup(c11341121, ["Acciai S 235", "8 mm", "Acciai S 355", "4 mm"], formulaId("c11.3.4.11.2.1.a"), "Quattro limitazioni consecutive su spessore e rapporto r/t conservate come unico gruppo display.");

const c117102 = await loadUnit("C11.7.10.2");
correctBlock(c117102, "per gli elementi in legno massiccio oggetto di una classificazione a vista", c117102.blocks.find((block: any) => block.text?.normalized?.startsWith("per gli elementi in legno massiccio oggetto di una classificazione a vista")).text.normalized, [["5%", "5\\%"]]);
correctBlock(c117102, "In relazione ad elementi lineari", c117102.blocks.find((block: any) => block.text?.normalized?.startsWith("In relazione ad elementi lineari")).text.normalized, [["18%", "18\\%"], ["10%", "10\\%"]]);
correctBlock(c117102, "In relazione ai collegamenti", c117102.blocks.find((block: any) => block.text?.normalized?.startsWith("In relazione ai collegamenti")).text.normalized, [["5%", "5\\%"]]);

const c1194 = await loadUnit("C11.9.4");
correctBlock(c1194, "La linearità della risposta", c1194.blocks[2].text.normalized, [["15%", "15\\%"], ["K_in", "K_{in}"], ["10%", "10\\%"], ["20%", "20\\%"], ["K_e", "K_e"]]);
correctBlock(c1194, "negativo in un ciclo completo", c1194.blocks[3].text.normalized, [["20%", "20\\%"], ["K_in", "K_{in}"], ["K_1", "K_1"]]);

const c1195 = await loadUnit("C11.9.5");
correctBlock(c1195, "La stabilità del ciclo", c1195.blocks[2].text.normalized, [["K2(i)", "K_{2(i)}"], ["K2(3)", "K_{2(3)}"], ["10%", "10\\%"]]);
correctBlock(c1195, "riscontrare che lo scarto", c1195.blocks[3].text.normalized, [["10%", "10\\%"]]);
correctBlock(c1195, "Per i dispositivi dotati", c1195.blocks[5].text.normalized, [["K1", "K_1"], ["Kin", "K_{in}"]]);

const c1196 = await loadUnit("C11.9.6");
correctBlock(c1196, "L’obbligo di disporre", c1196.blocks[2].text.normalized, [["±2°", "\\pm2^\\circ"]]);

const c1197 = await loadUnit("C11.9.7");
correctBlock(c1197, "la tensione massima", c1197.blocks[2].text.normalized, [["σ_s", "\\sigma_s"]]);
mergeTextBlocks(c1197, ["Il carico massimo verticale", "sicurezza 2,0"], "Il carico massimo verticale agente sul singolo isolatore dovrà essere inferiore al carico critico V_cr diviso per un coefficiente di sicurezza 2,0.", [["V_cr", "V_{cr}"], ["2,0", "2{,}0"]]);
mergeTextBlocks(c1197, ["t_1 e t_2", "2 mm"], "t_1 e t_2 sono gli spessori dei due strati di elastomero direttamente a contatto con la piastra; t_s è il suo spessore (t_s ≥ 2 mm), deve risultare inferiore alla tensione di snervamento dell’acciaio f_yk.", [["t_1 e t_2", "t_1\\text{ e }t_2"], ["t_s ≥ 2 mm", "t_s\\ge2\\,\\mathrm{mm}"], ["t_s", "t_s"], ["f_yk", "f_{yk}"]]);
correctBlock(c1197, "γ^* è", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("γ^* è")).text.normalized, [["γ^*", "\\gamma^*"]]);
correctBlock(c1197, "A_r è", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("A_r è")).text.normalized, [["A_r", "A_r"]]);
mergeTextBlocks(c1197, ["per isolatori rettangolari", "uno spostamento relativo"], "per isolatori rettangolari di lati b_x e b_y e per uno spostamento relativo tra le due facce (superiore e inferiore) degli isolatori, prodotti dall’azione sismica agente nelle direzioni x ed y (d_{Ex}, d_{Ey})", [["b_x e b_y", "b_x\\text{ e }b_y"], ["(d_{Ex}, d_{Ey})", "(d_{Ex},d_{Ey})"]]);
correctBlock(c1197, "V_cr è", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("V_cr è")).text.normalized, [["V_cr", "V_{cr}"]]);
correctBlock(c1197, "b_min = min", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("b_min = min")).text.normalized, [["b_min = min(b_x, b_y)", "b_{\\min}=\\min(b_x,b_y)"]]);
correctBlock(c1197, "b_min = D", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("b_min = D")).text.normalized, [["b_min = D", "b_{\\min}=D"]]);
correctBlock(c1197, "con α_x", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("con α_x")).text.normalized, [["α_x ed α_y", "\\alpha_x\\text{ ed }\\alpha_y"]]);
correctBlock(c1197, "E c modulo", "E_c modulo di compressibilità assiale valutato (in MPa) come", [["E_c", "E_c"]]);
correctBlock(c1197, "G_{din} modulo", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("G_{din} modulo")).text.normalized, [["G_{din}", "G_{din}"]]);
correctBlock(c1197, "E_b modulo", c1197.blocks.find((block: any) => block.text?.normalized?.startsWith("E_b modulo")).text.normalized, [["E_b", "E_b"], ["2000 MPa", "2000\\,\\mathrm{MPa}"]]);
mergeTextBlocks(c1197, ["d_{rftx}, d_{rfty}", "termiche"], "d_{rftx}, d_{rfty} spostamenti relativi tra le due facce (superiore e inferiore) degli isolatori, prodotti dalle azioni di ritiro, fluage e termiche (ridotte al 50%), ove rilevanti;", [["d_{rftx}, d_{rfty}", "d_{rftx},d_{rfty}"], ["50%", "50\\%"]]);

const c11971 = await loadUnit("C11.9.7.1");
correctBlock(c11971, "Le prove di accettazione", c11971.blocks[1].text.normalized, [["G", "G"]]);
correctBlock(c11971, "In luogo del modulo", "In luogo del modulo di taglio statico G è auspicabile la determinazione del Gdin.", [["Gdin", "G_{din}"], ["G", "G"]]);

const c11101111 = await loadUnit("C11.10.1.1.1.1");
correctBlock(c11101111, "Si definisce resistenza caratteristica", c11101111.blocks[1].text.normalized, [["5%", "5\\%"]]);
correctBlock(c11101111, "Il valore della f_bk", c11101111.blocks.find((block: any) => block.text?.normalized?.startsWith("Il valore della f_bk")).text.normalized, [["f_bk", "f_{bk}"], ["δ > 0.2", "\\delta>0.2"]]);
const deltaFormulaIndex = c11101111.blocks.findIndex((block: any) => block.assetId === formulaId("c11.10.1.1.1.1.c"));
if (deltaFormulaIndex < 0) throw new Error("Formula del coefficiente di variazione non trovata");
if (c11101111.blocks[deltaFormulaIndex + 1]?.text?.normalized?.startsWith("= coefficiente di variazione")) {
    const deltaBlock = c11101111.blocks[deltaFormulaIndex];
    deltaBlock.evidence.transformations = appendTransformation(deltaBlock, "Definizione testuale del coefficiente di variazione ricongiunta alla formula sulla stessa riga come nella fonte.");
    c11101111.blocks.splice(deltaFormulaIndex + 1, 1);
}

const c11101112 = await loadUnit("C11.10.1.1.1.2");
correctBlock(c11101112, "La resistenza caratteristica", c11101112.blocks[2].text.normalized, [["f_bk", "\\overline{f}_{bk}"], ["f_bm", "\\overline{f}_{bm}"]]);
correctBlock(c11101112, "in cui la resistenza media", c11101112.blocks[4].text.normalized, [["f_bm", "\\overline{f}_{bm}"]]);

const c1110321 = await loadUnit("C11.10.3.2.1");
correctBlock(c1110321, "La norma, per la determinazione", c1110321.blocks[1].text.normalized.replace(/ s$/u, ""), [["G", "G"]]);
const noiseNote = "Rimossi residui duplicati della formula statistica stampata a inizio pagina e il piè di pagina, estranei all’unità C11.10.3.2.1.";
c1110321.blocks[1].evidence.transformations = appendTransformation(c1110321.blocks[1], noiseNote);
c1110321.blocks.splice(2);

const units = [c1121, c1124, c11251, c11252, c1126, c1128, c11212, c11317, c11321, c11323, c113212, c1133521, c11341121, c117102, c1194, c1195, c1196, c1197, c11971, c11101111, c11101112, c1110321];
for (const unit of units) {
    reindex(unit);
    await writeFile(join(unitDir, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const additions = [
    {
        id: formulaId("c11.2.5.1.a"),
        unitId: unitId("C11.2.5.1"),
        officialNumber: null,
        pdfPage: 320,
        latex: "\\begin{aligned}\\text{1)}\\quad &R_{c,\\min}\\ge R_{ck}-3{,}5\\\\\\text{2)}\\quad &R_{cm28}\\ge R_{ck}+3{,}5\\end{aligned}",
    },
    {
        id: formulaId("c11.2.5.2.a"),
        unitId: unitId("C11.2.5.2"),
        officialNumber: null,
        pdfPage: 320,
        latex: "\\begin{aligned}\\text{1)}\\quad &R_{c,\\min}\\ge R_{ck}-3{,}5\\\\\\text{2)}\\quad &R_{cm28}\\ge R_{ck}+1{,}48 * s\\end{aligned}",
    },
    {
        id: formulaId("c11.3.4.11.2.1.a"),
        unitId: unitId("C11.3.4.11.2.1"),
        officialNumber: null,
        pdfPage: 332,
        latex: "\\begin{aligned}\\text{Acciai S 235 – S 275}\\qquad &t\\le8\\,\\mathrm{mm}\\qquad &&r/t\\ge1\\\\&8\\,\\mathrm{mm}<t\\le15\\,\\mathrm{mm}\\qquad &&r/t\\ge1{,}5\\\\\\text{Acciai S 355 – S 469}\\qquad &t\\le4\\,\\mathrm{mm}\\qquad &&r/t\\ge1\\\\&4\\,\\mathrm{mm}<t\\le15\\,\\mathrm{mm}\\qquad &&r/t\\ge1{,}5\\end{aligned}",
    },
];
const ids = new Set(additions.map((asset) => asset.id));
manifest.formulas = [...manifest.formulas.filter((asset: any) => !ids.has(asset.id)), ...additions];
const formulaOverrides = new Map([
    [formulaId("c11.9.4.a"), "\\xi_e=\\frac{E_d}{2\\pi F\\,d}=\\frac{E_d}{2\\pi K_e\\,d^2}"],
    [formulaId("c11.9.7.e"), "A_r=\\min\\left[(b_x-d_{rftx}-d_{Ex})(b_y-d_{rfty}-0{,}3d_{Ey}),\\,(b_x-d_{rftx}-0{,}3d_{Ex})(b_y-d_{rfty}-d_{Ey})\\right]"],
    [formulaId("c11.9.7.j"), "a^2=(\\alpha_x b_x^2+\\alpha_y b_y^2)"],
    [formulaId("c11.9.7.n"), "d_E=\\operatorname{Max}\\left\\{\\left[(d_{Ex}+d_{rftx})^2+(0{,}3d_{Ey}+d_{rfty})^2\\right]^{1/2},\\,\\left[(0{,}3d_{Ex}+d_{rftx})^2+(d_{Ey}+d_{rfty})^2\\right]^{1/2}\\right\\}"],
    [formulaId("c11.10.1.1.1.1.c"), "\\delta=\\frac{s}{f_{bm}}\\quad=\\text{coefficiente di variazione};"],
]);
manifest.formulas = manifest.formulas.map((asset: any) => formulaOverrides.has(asset.id) ? { ...asset, latex: formulaOverrides.get(asset.id) } : asset);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`circ11-formula-audit: aggiornate ${units.length} unità e ${additions.length} formule display`);
